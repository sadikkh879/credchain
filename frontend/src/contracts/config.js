// ============================================================
//  Contract configuration
//  1. After deploying to Sepolia, paste the deployed address below.
//  2. Replace ABI with the compiled artifact ABI from:
//     blockchain/artifacts/contracts/CredentialVerification.sol/CredentialVerification.json
//     (copy the "abi" array only)
//
//  NOTE: This ABI matches the functions your Step 2 contract must
//  implement. Keep the signatures identical.
// ============================================================

export const CONTRACT_ADDRESS = "0x3334e49F28231e1406d930B6d348a6FbdbA572c0";

export const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

// Public Sepolia RPC endpoints used for read-only verification, so a client
// can verify a certificate (e.g. after scanning its QR code on a phone)
// without installing MetaMask. Tried in order; the next one is used if one fails.
// Optionally set REACT_APP_SEPOLIA_RPC_URL (e.g. an Alchemy or Infura URL) at build time.
export const SEPOLIA_RPC_URLS = [
  process.env.REACT_APP_SEPOLIA_RPC_URL,
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
].filter(Boolean);

export const CONTRACT_ABI = [
  // ---- Read ----
  "function admin() view returns (address)",
  "function getUserRole(address user) view returns (uint8)",
  "function getInstitute(address wallet) view returns (string name, address walletAddress, bool isApproved, bool exists)",
  "function getInstituteList() view returns (address[])",
  "function getCertificate(string certId) view returns (tuple(string freelancerName, string freelancerId, address freelancerAddress, string courseName, string instituteId, string instituteName, string ipfsCid, bytes32 documentHash, uint256 issueDate, uint256 expiryDate, bool isRevoked, bool exists))",
  "function getFreelancerCertificates(address freelancer) view returns (string[])",

  // ---- Write ----
  "function registerInstitute(address wallet, string name, string instituteId)",
  "function approveInstitute(address wallet)",
  "function issueCertificate(string certId, string freelancerName, string freelancerId, address freelancerAddress, string courseName, string ipfsCid, bytes32 documentHash, uint256 expiryDate)",
  "function revokeCertificate(string certId)",
];

export const ROLE_NAMES = ["None", "Admin", "Institute", "Freelancer"];
