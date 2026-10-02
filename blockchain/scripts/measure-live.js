// Deploys a fresh CredentialVerification contract to a live testnet, runs the same
// operations as measure-gas.js, and records gas and the fee actually paid.
// On OP Stack networks such as Base, the fee has two parts: L2 execution and the
// L1 data fee, which is read from the receipt.
// It then estimates what the same transactions would cost today on Base mainnet
// and on Ethereum mainnet, using read-only calls (nothing is sent to mainnet).
//
//   npx hardhat run scripts/measure-live.js --network baseSepolia
//
// Optional env: ETH_USD (default 2600), FUND_ETH (minimum funding for the institute wallet, default 0.002),
//               BASE_MAINNET_RPC, ETH_MAINNET_RPC
const { ethers, network } = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ETH_USD = Number(process.env.ETH_USD || 2600);
const FUND_ETH = process.env.FUND_ETH || "0.002";
const BASE_MAINNET_RPCS = [process.env.BASE_MAINNET_RPC, "https://base-rpc.publicnode.com", "https://mainnet.base.org"].filter(Boolean);
const ETH_MAINNET_RPC = process.env.ETH_MAINNET_RPC || "https://ethereum-rpc.publicnode.com";
const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F"; // OP Stack predeploy

const INSTITUTE_NAME = "Creative IT Institute";          // 21 characters
const INSTITUTE_ID = "INST-001";
const FREELANCER_NAME = "Example Person";                // 14 characters
const FREELANCER_ID = "0123456";
const COURSE = "Full Stack Web Development";             // 26 characters
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // 59 characters

async function record(label, txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  const raw = await ethers.provider.send("eth_getTransactionReceipt", [receipt.hash]);
  const l1Fee = raw.l1Fee ? BigInt(raw.l1Fee) : 0n;
  const l2Fee = receipt.gasUsed * receipt.gasPrice;
  const full = await ethers.provider.getTransaction(receipt.hash);
  console.log(`  ${label}: ${receipt.gasUsed} gas  (${receipt.hash})`);
  return {
    label,
    hash: receipt.hash,
    gasUsed: receipt.gasUsed,
    gasPrice: receipt.gasPrice,
    l2Fee,
    l1Fee,
    unsigned: ethers.Transaction.from(full).unsignedSerialized,
  };
}

const eth = (wei) => Number(ethers.formatEther(wei));
const usd = (wei) => (eth(wei) * ETH_USD).toFixed(4);

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId === 1n || chainId === 8453n) throw new Error("Refusing to run on a mainnet.");

  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer.address}, balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // A fresh wallet acts as the institute, because one address holds one role
  const institute = ethers.Wallet.createRandom().connect(ethers.provider);
  const freelancer = ethers.Wallet.createRandom().address;
  // Fund it for 12 issuances and one revocation, with a margin for price changes and L1 fees
  const { gasPrice } = await ethers.provider.getFeeData();
  const need = gasPrice * 450000n * 13n * 3n;
  const fund = need > ethers.parseEther(FUND_ETH) ? need : ethers.parseEther(FUND_ETH);
  await (await deployer.sendTransaction({ to: institute.address, value: fund })).wait();
  console.log(`Institute wallet ${institute.address} funded with ${ethers.formatEther(fund)} ETH`);

  const Factory = await ethers.getContractFactory("CredentialVerification", deployer);
  const c = await Factory.deploy();
  const deployTx = c.deploymentTransaction();
  await c.waitForDeployment();
  console.log(`Contract deployed at ${await c.getAddress()}`);

  const rows = [];
  rows.push(await record("Contract deployment", Promise.resolve(deployTx)));
  rows.push(await record("registerInstitute", c.registerInstitute(institute.address, INSTITUTE_NAME, INSTITUTE_ID)));
  rows.push(await record("approveInstitute", c.approveInstitute(institute.address)));

  const asInst = c.connect(institute);
  const issue = (i) => {
    const hash = "0x" + crypto.createHash("sha256").update("certificate " + i).digest("hex");
    return asInst.issueCertificate(`CERT-2026-${String(i).padStart(3, "0")}`, FREELANCER_NAME,
      FREELANCER_ID, freelancer, COURSE, CID, hash, 0);
  };
  rows.push(await record("issueCertificate (first for a wallet)", issue(1)));
  const later = [];
  for (let i = 2; i <= 11; i++) later.push(await record(`issueCertificate #${i}`, issue(i)));
  rows.push(await record("revokeCertificate", asInst.revokeCertificate("CERT-2026-002")));

  // Mainnet estimates (read-only)
  // Public RPCs rate-limit, so calls are spaced out, retried, and spread over several endpoints
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const baseProviders = BASE_MAINNET_RPCS.map((u) => new ethers.JsonRpcProvider(u, 8453, { staticNetwork: true }));
  const withRetry = async (fn) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      try { return await fn(baseProviders[attempt % baseProviders.length]); }
      catch (e) { await sleep(1000 * (attempt + 1)); }
    }
    throw new Error("Base mainnet RPC unavailable; set BASE_MAINNET_RPC to your own endpoint.");
  };
  const ethMain = new ethers.JsonRpcProvider(ETH_MAINNET_RPC, 1, { staticNetwork: true });
  const abi = ["function getL1Fee(bytes) view returns (uint256)"];
  const baseGasPrice = await withRetry(async (p) => (await p.getFeeData()).gasPrice);
  const ethGasPrice = (await ethMain.getFeeData()).gasPrice;

  const estimate = async (r) => {
    await sleep(400);
    const baseL1 = await withRetry((p) => new ethers.Contract(GAS_PRICE_ORACLE, abi, p).getL1Fee(r.unsigned));
    return { baseTotal: r.gasUsed * baseGasPrice + baseL1, baseL1, ethTotal: r.gasUsed * ethGasPrice };
  };
  for (const r of [...rows, ...later]) Object.assign(r, await estimate(r));

  // Mean of the ten subsequent issuances
  const mean = (k) => later.reduce((a, r) => a + r[k], 0n) / BigInt(later.length);
  const laterRow = { label: "issueCertificate (subsequent, mean of 10)" };
  for (const k of ["gasUsed", "l2Fee", "l1Fee", "baseTotal", "baseL1", "ethTotal"]) laterRow[k] = mean(k);
  rows.splice(4, 0, laterRow);

  console.log(`\nETH = USD ${ETH_USD}; Base mainnet gas price ${ethers.formatUnits(baseGasPrice, "gwei")} gwei; ` +
    `Ethereum mainnet gas price ${ethers.formatUnits(ethGasPrice, "gwei")} gwei`);
  console.table(Object.fromEntries(rows.map((r) => [r.label, {
    gas: Number(r.gasUsed),
    "testnet fee paid (ETH)": eth(r.l2Fee + r.l1Fee).toFixed(9),
    "Base mainnet est. (USD)": usd(r.baseTotal),
    "  of which L1 data (USD)": usd(r.baseL1),
    "Ethereum mainnet est. (USD)": usd(r.ethTotal),
  }])));

  const out = {
    network: network.name, chainId: Number(chainId), date: new Date().toISOString(),
    contract: await c.getAddress(), ethUsd: ETH_USD,
    baseMainnetGasPriceWei: baseGasPrice.toString(), ethMainnetGasPriceWei: ethGasPrice.toString(),
    rows: [...rows, ...later].map(({ unsigned, ...r }) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]))),
  };
  const dir = path.join(__dirname, "..", "results");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `gas-${network.name}-${out.date.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nSaved ${file}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
