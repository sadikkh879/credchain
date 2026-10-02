// Measures gas from transaction receipts on the Hardhat network, using the same
// input lengths as Section 6.2. Run: npx hardhat run scripts/measure-gas.js
const { ethers, config } = require("hardhat");
const crypto = require("crypto");

const INSTITUTE_NAME = "Creative IT Institute";          // 21 characters
const INSTITUTE_ID = "INST-001";
const FREELANCER_NAME = "Example Person";                // 14 characters
const FREELANCER_ID = "0123456";
const COURSE = "Full Stack Web Development";             // 26 characters
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // 59 characters

const gasOf = async (txPromise) => Number((await (await txPromise).wait()).gasUsed);

async function main() {
  const opt = config.solidity.compilers[0].settings.optimizer;
  const [admin, institute, freelancer] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("CredentialVerification");
  const c = await Factory.deploy();
  const deployGas = Number((await c.deploymentTransaction().wait()).gasUsed);
  const runtimeBytes = ((await ethers.provider.getCode(await c.getAddress())).length - 2) / 2;

  const register = await gasOf(c.registerInstitute(institute.address, INSTITUTE_NAME, INSTITUTE_ID));
  const approve = await gasOf(c.approveInstitute(institute.address));

  const issue = (i) => {
    const hash = "0x" + crypto.createHash("sha256").update("certificate " + i).digest("hex");
    return gasOf(c.connect(institute).issueCertificate(
      `CERT-2026-${String(i).padStart(3, "0")}`, FREELANCER_NAME, FREELANCER_ID,
      freelancer.address, COURSE, CID, hash, 0));
  };
  const first = await issue(1);
  const later = [];
  for (let i = 2; i <= 11; i++) later.push(await issue(i));
  const laterMean = Math.round(later.reduce((a, b) => a + b, 0) / later.length);
  const revoke = await gasOf(c.connect(institute).revokeCertificate("CERT-2026-002"));

  console.log(`Optimizer: ${opt.enabled ? `enabled, ${opt.runs} runs` : "disabled"}`);
  console.table({
    "Contract deployment": deployGas,
    registerInstitute: register,
    approveInstitute: approve,
    "issueCertificate (first for a wallet)": first,
    "issueCertificate (subsequent, mean of 10)": laterMean,
    revokeCertificate: revoke,
  });
  console.log(`Runtime bytecode size: ${runtimeBytes} bytes (${(runtimeBytes / 1024).toFixed(1)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
