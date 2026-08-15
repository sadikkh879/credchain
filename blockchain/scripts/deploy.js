const hre = require("hardhat");

async function main() {
  console.log("Deploying CredentialVerification to Sepolia...");

  const contract = await hre.ethers.deployContract("CredentialVerification");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Contract deployed to:", address);
  console.log("Admin (deployer):", (await hre.ethers.getSigners())[0].address);
  console.log("View it at: https://sepolia.etherscan.io/address/" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});