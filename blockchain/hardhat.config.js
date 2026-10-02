require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Optimizer is on by default (200 runs). Set OPTIMIZER=false to reproduce the
// unoptimised v1.0 figures reported in the first version of the paper.
const optimizerEnabled = process.env.OPTIMIZER !== "false";

const networks = {};
if (process.env.PRIVATE_KEY) {
  if (process.env.SEPOLIA_RPC_URL) {
    networks.sepolia = { url: process.env.SEPOLIA_RPC_URL, accounts: [process.env.PRIVATE_KEY] };
  }
  networks.baseSepolia = {
    url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    accounts: [process.env.PRIVATE_KEY],
    chainId: 84532,
  };
}

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: { optimizer: { enabled: optimizerEnabled, runs: 200 } },
  },
  networks,
  gasReporter: { enabled: process.env.REPORT_GAS === "true" },
};
