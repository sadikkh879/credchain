import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { hashFile, formatDate, ipfsUrl, shortAddress } from "../utils";

export default function VerifyPage() {
  const { readContract, hasMetaMask } = useWeb3();
  const [params] = useSearchParams();

  const [certId, setCertId] = useState(params.get("id") || "");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null); // { cert, fileMatch }
  const [status, setStatus] = useState("");   // "loading" | "notfound" | "error" | ""
  const [errMsg, setErrMsg] = useState("");

  const verify = async (id) => {
    if (!id.trim()) return;
    setStatus("loading");
    setResult(null);
    setErrMsg("");
    try {
      const c = await readContract.getCertificate(id.trim());
      if (!c.exists) {
        setStatus("notfound");
        return;
      }
      let fileMatch = null;
      if (file) {
        const h = await hashFile(file);
        fileMatch = h.toLowerCase() === c.documentHash.toLowerCase();
      }
      setResult({ cert: c, fileMatch });
      setStatus("");
    } catch (e) {
      // Contracts written with require("Certificate not found") revert instead of returning
      if ((e?.reason || e?.message || "").includes("not found")) setStatus("notfound");
      else {
        setStatus("error");
        setErrMsg(e?.shortMessage || "Could not reach the blockchain. Check your connection and the contract address.");
      }
    }
  };

  // Auto-verify when opened through a shared link (?id=CERT-...)
  useEffect(() => {
    if (params.get("id") && readContract) verify(params.get("id"));
  }, [readContract]);

  const cert = result?.cert;
  const revoked = cert?.isRevoked;
  const expired = cert && Number(cert.expiryDate) !== 0 && Number(cert.expiryDate) * 1000 < Date.now();
  const valid = cert && !revoked && !expired;

  return (
    <div className="page">
      <section className="hero">
        <h1>Verify a freelancer's certificate</h1>
        <p>
          Enter the certificate ID you received from a freelancer. The record is checked directly
          against the Ethereum blockchain — no account needed.
        </p>
      </section>

      {!hasMetaMask && (
        <div className="alert alert-warn">
          A browser wallet (MetaMask) is required to read from the blockchain. Install it from{" "}
          <a href="https://metamask.io" target="_blank" rel="noreferrer">metamask.io</a> — you do
          not need to create an account or hold any funds to verify.
        </div>
      )}

      <div className="card">
        <div className="field">
          <label htmlFor="certId">Certificate ID</label>
          <input
            id="certId"
            placeholder="e.g. CERT-2026-001"
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verify(certId)}
          />
        </div>

        <div className="field">
          <label htmlFor="certFile">Certificate file <span className="muted">(optional — checks for tampering)</span></label>
          <input id="certFile" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </div>

        <button className="btn btn-primary" onClick={() => verify(certId)} disabled={status === "loading" || !readContract}>
          {status === "loading" ? "Checking blockchain…" : "Verify certificate"}
        </button>
      </div>

      {status === "notfound" && (
        <div className="alert alert-error">
          <strong>No match.</strong> No certificate with this ID exists on the blockchain. The
          certificate may be fake, or the ID was typed incorrectly.
        </div>
      )}
      {status === "error" && <div className="alert alert-error">{errMsg}</div>}

      {cert && (
        <div className={"card result " + (valid ? "result-valid" : "result-invalid")}>
          <div className="result-status">
            {valid && <span className="status-pill ok">✔ Valid certificate</span>}
            {revoked && <span className="status-pill bad">✖ Revoked by institute</span>}
            {!revoked && expired && <span className="status-pill bad">✖ Expired</span>}
          </div>

          {result.fileMatch === true && (
            <div className="alert alert-ok">Uploaded file matches the on-chain hash — the document has not been altered.</div>
          )}
          {result.fileMatch === false && (
            <div className="alert alert-error">Uploaded file does <strong>not</strong> match the on-chain hash — this copy has been modified.</div>
          )}

          <dl className="detail-grid">
            <div><dt>Freelancer</dt><dd>{cert.freelancerName}</dd></div>
            <div><dt>Freelancer ID</dt><dd>{cert.freelancerId}</dd></div>
            <div><dt>Course / skill</dt><dd>{cert.courseName}</dd></div>
            <div><dt>Issued by</dt><dd>{cert.instituteName} ({cert.instituteId})</dd></div>
            <div><dt>Issue date</dt><dd>{formatDate(cert.issueDate)}</dd></div>
            <div><dt>Expiry</dt><dd>{Number(cert.expiryDate) === 0 ? "No expiry" : formatDate(cert.expiryDate)}</dd></div>
            <div><dt>Wallet</dt><dd className="mono">{shortAddress(cert.freelancerAddress)}</dd></div>
            <div><dt>Document hash</dt><dd className="mono hash">{cert.documentHash}</dd></div>
          </dl>

          {cert.ipfsCid && (
            <a className="btn btn-ghost" href={ipfsUrl(cert.ipfsCid)} target="_blank" rel="noreferrer">
              View original file on IPFS
            </a>
          )}
        </div>
      )}
    </div>
  );
}
