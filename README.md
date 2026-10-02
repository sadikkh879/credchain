# CredChain BD — Frontend (React DApp)

Frontend for the blockchain-based credential verification system (UFTB thesis prototype).

## Setup

From the `frontend/` folder:

```bash
npx create-react-app .        # if you haven't scaffolded yet
npm install ethers react-router-dom
npm start
```

Then copy the `src/` files from this package over the generated `src/`.

## Configure the contract

Edit `src/contracts/config.js`:
1. Paste your deployed Sepolia contract address into `CONTRACT_ADDRESS`.
2. After compiling with Hardhat, you may replace the human-readable ABI with the
   JSON ABI from `blockchain/artifacts/.../CredentialVerification.json` — both work
   with Ethers v6.

## IMPORTANT — functions your Step 2 contract must add

Your uploaded contract (Step 1) only has structs, storage, and modifiers.
The frontend calls these functions, so Step 2 must implement them with
**exactly these signatures**:

```solidity
// Admin
function registerInstitute(address wallet, string memory name, string memory instituteId) external onlyAdmin;
function approveInstitute(address wallet) external onlyAdmin;

// Institute
function issueCertificate(
    string memory certId,
    string memory freelancerName,
    string memory freelancerId,
    address freelancerAddress,
    string memory courseName,
    string memory ipfsCid,
    bytes32 documentHash,
    uint256 expiryDate
) external onlyApprovedInstitute;
function revokeCertificate(string memory certId) external onlyApprovedInstitute;

// Public reads
function getUserRole(address user) external view returns (uint8);
function getInstitute(address wallet) external view returns (string memory, address, bool, bool);
function getInstituteList() external view returns (address[] memory);
function getCertificate(string memory certId) external view returns (
    string memory, string memory, address, string memory, string memory,
    string memory, string memory, bytes32, uint256, uint256, bool, bool
);
function getFreelancerCertificates(address freelancer) external view returns (string[] memory);
```

Notes:
- `issueCertificate` should also set `userRoles[freelancerAddress] = Role.Freelancer`
  and push the certId into `freelancerCertificates[freelancerAddress]`.
- `getCertificate` should return the struct fields in the order shown (same as the
  struct definition), or simply `returns (Certificate memory)` — Ethers handles both;
  if you use `Certificate memory`, keep the config.js ABI as-is (field names match).

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Anyone (clients) | Verify by certificate ID, optional file tamper-check. Shareable links: `/?id=CERT-2026-001` |
| `/admin` | Admin wallet | Register + approve institutes |
| `/institute` | Approved institute | Issue (with in-browser SHA-256 hashing) and revoke certificates |
| `/my-certificates` | Freelancer | List certificates, copy verification links |

## Workflow for issuing

1. Institute uploads the certificate PDF to Pinata (free tier) → copies the CID.
2. In the Institute panel, attach the same file (hash computed locally) + paste CID.
3. Confirm the MetaMask transaction (free Sepolia test ETH).
4. Freelancer connects their wallet → sees the certificate → copies the share link.
5. Client opens the link → instant on-chain verification, no wallet account needed.

## QR verification (v1.1)

- Every certificate has a QR code that encodes its public verification link (`/?id=<certId>`).
- Institutes generate the QR from the certificate ID in the issuance form and place it on the
  certificate **before** uploading the final file to IPFS, so the on-chain hash covers the QR.
- Freelancers can show or download the QR for each certificate on **My certificates**.
- Verifiers scan it with a phone camera (opens the link directly) or with **Scan QR code** on the
  verification page. Verification reads the contract through public Sepolia RPC endpoints, so no
  MetaMask or account is needed. Set `REACT_APP_SEPOLIA_RPC_URL` to use your own RPC endpoint.
