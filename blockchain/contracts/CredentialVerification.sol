// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CredentialVerification
 * @notice Blockchain-based credential verification system for freelancers in Bangladesh
 * @dev Step 2: Events and functions added on top of Step 1's data structures
 *      Deployed on Ethereum Sepolia testnet
 *      Author: MD Sadik Khandakar (Student ID: 2002038), UFTB
 */
contract CredentialVerification {

    // =========================================================
    //  SECTION 1: ROLES
    // =========================================================

    enum Role {
        None,        // 0 - Default, unregistered user
        Admin,       // 1 - Contract deployer, manages institutes
        Institute,   // 2 - Can issue and revoke certificates
        Freelancer   // 3 - Receives certificates (clients need no registration)
    }

    // =========================================================
    //  SECTION 2: CERTIFICATE STRUCT
    // =========================================================

    struct Certificate {
        string  freelancerName;
        string  freelancerId;
        address freelancerAddress;
        string  courseName;
        string  instituteId;
        string  instituteName;
        string  ipfsCid;
        bytes32 documentHash;
        uint256 issueDate;
        uint256 expiryDate;      // 0 means no expiry (permanent)
        bool    isRevoked;
        bool    exists;
    }

    // =========================================================
    //  SECTION 3: INSTITUTE STRUCT
    // =========================================================

    struct Institute {
        string  name;
        string  instituteId;     // NEW in Step 2: e.g. "INST-001", shown on certificates
        address walletAddress;
        bool    isApproved;
        bool    exists;
    }

    // =========================================================
    //  SECTION 4: STORAGE VARIABLES
    // =========================================================

    address public admin;

    mapping(string => Certificate) private certificates;
    mapping(address => Institute) private institutes;
    mapping(address => string[]) private freelancerCertificates;
    mapping(address => Role) private userRoles;
    address[] private instituteList;

    // =========================================================
    //  SECTION 5: EVENTS  (NEW in Step 2)
    //  Events are log entries written to the blockchain when
    //  something important happens. They cost very little gas,
    //  and frontends / block explorers can listen to them.
    //  "indexed" makes a field searchable in those logs.
    // =========================================================

    event InstituteRegistered(address indexed wallet, string name);
    event InstituteApproved(address indexed wallet);
    event CertificateIssued(
        string certId,
        address indexed freelancer,
        address indexed institute
    );
    event CertificateRevoked(string certId, address indexed institute);

    // =========================================================
    //  SECTION 6: CONSTRUCTOR
    // =========================================================

    constructor() {
        admin = msg.sender;
        userRoles[msg.sender] = Role.Admin;
    }

    // =========================================================
    //  SECTION 7: MODIFIERS
    // =========================================================

    modifier onlyAdmin() {
        require(userRoles[msg.sender] == Role.Admin, "Access denied: Admin only");
        _;
    }

    modifier onlyApprovedInstitute() {
        require(
            userRoles[msg.sender] == Role.Institute &&
            institutes[msg.sender].isApproved,
            "Access denied: Approved institute only"
        );
        _;
    }

    modifier certificateExists(string memory certId) {
        require(certificates[certId].exists, "Certificate not found");
        _;
    }

    modifier certificateNotRevoked(string memory certId) {
        require(!certificates[certId].isRevoked, "Certificate has been revoked");
        _;
    }

    // =========================================================
    //  SECTION 8: ADMIN FUNCTIONS  (NEW in Step 2)
    //  Only the Admin (contract deployer) can call these.
    //  Flow: register an institute first, then approve it.
    //  Two steps on purpose - mirrors real life, where an
    //  authority reviews an institute before trusting it.
    // =========================================================

    /**
     * @notice Register a training institute by its wallet address.
     * @dev The institute starts UNapproved - it cannot issue
     *      certificates until approveInstitute() is called.
     */
    function registerInstitute(
        address wallet,
        string memory name,
        string memory instituteId
    ) external onlyAdmin {
        require(wallet != address(0), "Invalid wallet address");
        require(!institutes[wallet].exists, "Institute already registered");
        require(bytes(name).length > 0, "Name cannot be empty");

        institutes[wallet] = Institute({
            name: name,
            instituteId: instituteId,
            walletAddress: wallet,
            isApproved: false,          // approval is a separate step
            exists: true
        });

        userRoles[wallet] = Role.Institute;  // role granted, but not yet approved
        instituteList.push(wallet);          // so we can list all institutes later

        emit InstituteRegistered(wallet, name);
    }

    /**
     * @notice Approve a registered institute so it can issue certificates.
     */
    function approveInstitute(address wallet) external onlyAdmin {
        require(institutes[wallet].exists, "Institute not registered");
        require(!institutes[wallet].isApproved, "Already approved");

        institutes[wallet].isApproved = true;

        emit InstituteApproved(wallet);
    }

    // =========================================================
    //  SECTION 9: INSTITUTE FUNCTIONS  (NEW in Step 2)
    //  Only approved institutes can call these.
    //  This is the heart of the system: writing a certificate's
    //  fingerprint (hash) permanently onto the blockchain.
    // =========================================================

    /**
     * @notice Issue a certificate to a freelancer.
     * @dev Stores the SHA-256 hash of the certificate file and the
     *      IPFS CID on-chain. The actual PDF lives on IPFS (off-chain),
     *      keeping gas costs low - only the fingerprint is on-chain.
     * @param expiryDate Unix timestamp, or 0 for a permanent certificate.
     */
    function issueCertificate(
        string memory certId,
        string memory freelancerName,
        string memory freelancerId,
        address freelancerAddress,
        string memory courseName,
        string memory ipfsCid,
        bytes32 documentHash,
        uint256 expiryDate
    ) external onlyApprovedInstitute {
        require(bytes(certId).length > 0, "Certificate ID cannot be empty");
        require(!certificates[certId].exists, "Certificate ID already used");
        require(freelancerAddress != address(0), "Invalid freelancer address");
        require(documentHash != bytes32(0), "Document hash required");
        // If an expiry is given, it must be in the future
        require(expiryDate == 0 || expiryDate > block.timestamp, "Expiry must be in the future");

        certificates[certId] = Certificate({
            freelancerName: freelancerName,
            freelancerId: freelancerId,
            freelancerAddress: freelancerAddress,
            courseName: courseName,
            instituteId: institutes[msg.sender].instituteId,   // taken from the CALLER
            instituteName: institutes[msg.sender].name,        // - cannot be faked
            ipfsCid: ipfsCid,
            documentHash: documentHash,
            issueDate: block.timestamp,                        // "now" on the blockchain
            expiryDate: expiryDate,
            isRevoked: false,
            exists: true
        });

        // Link the certificate to the freelancer's wallet
        freelancerCertificates[freelancerAddress].push(certId);

        // Grant the Freelancer role on their first certificate,
        // so the "My certificates" page unlocks for them.
        if (userRoles[freelancerAddress] == Role.None) {
            userRoles[freelancerAddress] = Role.Freelancer;
        }

        emit CertificateIssued(certId, freelancerAddress, msg.sender);
    }

    /**
     * @notice Revoke a certificate. Permanent - cannot be undone.
     * @dev Only the institute that ISSUED the certificate may revoke it.
     */
    function revokeCertificate(string memory certId)
        external
        onlyApprovedInstitute
        certificateExists(certId)
        certificateNotRevoked(certId)
    {
        // keccak256 string comparison: Solidity cannot compare
        // strings with ==, so we compare their hashes instead.
        require(
            keccak256(bytes(certificates[certId].instituteId)) ==
            keccak256(bytes(institutes[msg.sender].instituteId)),
            "Only the issuing institute can revoke"
        );

        certificates[certId].isRevoked = true;

        emit CertificateRevoked(certId, msg.sender);
    }

    // =========================================================
    //  SECTION 10: PUBLIC READ FUNCTIONS  (NEW in Step 2)
    //  "view" functions read data without changing it, so they
    //  cost NO gas and need no transaction - this is what makes
    //  client verification instant and free.
    // =========================================================

    /**
     * @notice Look up a certificate by its ID. The core verification call.
     */
    function getCertificate(string memory certId)
        external
        view
        returns (Certificate memory)
    {
        require(certificates[certId].exists, "Certificate not found");
        return certificates[certId];
    }

    /**
     * @notice Get all certificate IDs belonging to a freelancer.
     */
    function getFreelancerCertificates(address freelancer)
        external
        view
        returns (string[] memory)
    {
        return freelancerCertificates[freelancer];
    }

    /**
     * @notice Get a user's role (0=None, 1=Admin, 2=Institute, 3=Freelancer).
     */
    function getUserRole(address user) external view returns (uint8) {
        return uint8(userRoles[user]);
    }

    /**
     * @notice Get details of one institute.
     */
    function getInstitute(address wallet)
        external
        view
        returns (string memory name, address walletAddress, bool isApproved, bool exists)
    {
        Institute memory i = institutes[wallet];
        return (i.name, i.walletAddress, i.isApproved, i.exists);
    }

    /**
     * @notice Get the wallet addresses of all registered institutes.
     */
    function getInstituteList() external view returns (address[] memory) {
        return instituteList;
    }
}