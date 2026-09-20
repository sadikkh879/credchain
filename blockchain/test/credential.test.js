const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require("crypto");

// Inputs of the same length as those reported in Section 6.2
const INSTITUTE_NAME = "Creative IT Institute";            // 21 characters
const INSTITUTE_ID = "INST-001";
const FREELANCER_NAME = "Example Person";                  // 14 characters
const FREELANCER_ID = "0123456";
const COURSE = "Full Stack Web Development";               // 26 characters
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // 59-character CIDv1
const sha256 = (buf) => "0x" + crypto.createHash("sha256").update(buf).digest("hex");
const ORIGINAL_FILE = Buffer.from("CredChain sample certificate, original file");
const EDITED_FILE = Buffer.from("CredChain sample certificate, edited file");
const HASH = sha256(ORIGINAL_FILE);

describe("CredentialVerification", function () {
  let contract, admin, institute, otherInstitute, freelancer, stranger;

  beforeEach(async function () {
    [admin, institute, otherInstitute, freelancer, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CredentialVerification");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  async function approvedInstitute(signer = institute, name = INSTITUTE_NAME, id = INSTITUTE_ID) {
    await contract.registerInstitute(signer.address, name, id);
    await contract.approveInstitute(signer.address);
  }
  const issue = (certId, signer = institute, hash = HASH, expiry = 0) =>
    contract.connect(signer).issueCertificate(certId, FREELANCER_NAME, FREELANCER_ID,
      freelancer.address, COURSE, CID, hash, expiry);

  it("TC01 deployer holds the admin role", async function () {
    expect(await contract.admin()).to.equal(admin.address);
    expect(await contract.getUserRole(admin.address)).to.equal(1n);
  });

  it("TC02 non-admin cannot register an institute", async function () {
    await expect(contract.connect(stranger).registerInstitute(institute.address, INSTITUTE_NAME, INSTITUTE_ID))
      .to.be.revertedWith("Access denied: Admin only");
  });

  it("TC03 the same institute cannot be registered twice", async function () {
    await contract.registerInstitute(institute.address, INSTITUTE_NAME, INSTITUTE_ID);
    await expect(contract.registerInstitute(institute.address, INSTITUTE_NAME, INSTITUTE_ID))
      .to.be.revertedWith("Institute already registered");
  });

  it("TC04 registered but unapproved institute cannot issue", async function () {
    await contract.registerInstitute(institute.address, INSTITUTE_NAME, INSTITUTE_ID);
    await expect(issue("CERT-2026-001")).to.be.revertedWith("Access denied: Approved institute only");
  });

  it("TC05 approved institute issues a certificate", async function () {
    await approvedInstitute();
    await expect(issue("CERT-2026-001")).to.emit(contract, "CertificateIssued");
    const c = await contract.getCertificate("CERT-2026-001");
    expect(c.instituteName).to.equal(INSTITUTE_NAME);   // copied from registration, not from input
    expect(c.instituteId).to.equal(INSTITUTE_ID);
    expect(c.documentHash).to.equal(HASH);
    expect(c.isRevoked).to.equal(false);
    expect(await contract.getUserRole(freelancer.address)).to.equal(3n);
  });

  it("TC06 a certificate ID cannot be reused", async function () {
    await approvedInstitute();
    await issue("CERT-2026-001");
    await expect(issue("CERT-2026-001")).to.be.revertedWith("Certificate ID already used");
  });

  it("TC07 zero hash and past expiry date are rejected", async function () {
    await approvedInstitute();
    await expect(issue("CERT-2026-001", institute, ethers.ZeroHash)).to.be.revertedWith("Document hash required");
    await expect(issue("CERT-2026-001", institute, HASH, 1)).to.be.revertedWith("Expiry must be in the future");
  });

  it("TC08 a file edited after issuance no longer matches the stored hash", async function () {
    await approvedInstitute();
    await issue("CERT-2026-001");
    const c = await contract.getCertificate("CERT-2026-001");
    expect(sha256(ORIGINAL_FILE)).to.equal(c.documentHash);
    expect(sha256(EDITED_FILE)).to.not.equal(c.documentHash);
  });

  it("TC09 an unknown certificate ID reverts", async function () {
    await expect(contract.getCertificate("CERT-0000-000")).to.be.revertedWith("Certificate not found");
  });

  it("TC10 issuing institute revokes once; a second revoke reverts", async function () {
    await approvedInstitute();
    await issue("CERT-2026-001");
    await expect(contract.connect(institute).revokeCertificate("CERT-2026-001")).to.emit(contract, "CertificateRevoked");
    expect((await contract.getCertificate("CERT-2026-001")).isRevoked).to.equal(true);
    await expect(contract.connect(institute).revokeCertificate("CERT-2026-001"))
      .to.be.revertedWith("Certificate has been revoked");
  });

  it("TC11 a different approved institute cannot revoke", async function () {
    await approvedInstitute();
    await approvedInstitute(otherInstitute, "Another Training House", "INST-002");
    await issue("CERT-2026-001");
    await expect(contract.connect(otherInstitute).revokeCertificate("CERT-2026-001"))
      .to.be.revertedWith("Only the issuing institute can revoke");
  });

  it("TC12 eleven certificates issued to one freelancer are all listed", async function () {
    await approvedInstitute();
    const ids = [];
    for (let i = 1; i <= 11; i++) {
      const id = "CERT-2026-" + String(i).padStart(3, "0");
      ids.push(id);
      await issue(id);
    }
    expect(await contract.getFreelancerCertificates(freelancer.address)).to.deep.equal(ids);
  });
});