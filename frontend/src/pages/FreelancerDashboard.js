import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "../context/Web3Context";
import { formatDate, ipfsUrl, verifyUrl } from "../utils";
import CertificateQR from "../components/CertificateQR";

export default function FreelancerDashboard() {
  const { contract, account, role } = useWeb3();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [qrFor, setQrFor] = useState("");

  const load = useCallback(async () => {
    if (!contract || !account) return;
    setLoading(true);
    try {
      const ids = await contract.getFreelancerCertificates(account);
      const rows = await Promise.all(
        ids.map(async (id) => {
          const c = await contract.getCertificate(id);
          return { id, ...c };
        })
      );
      setCerts(rows);
    } catch {
      setCerts([]);
    } finally {
      setLoading(false);
    }
  }, [contract, account]);

  useEffect(() => { load(); }, [load]);

  const copyLink = (id) => {
    navigator.clipboard.writeText(verifyUrl(id));
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  if (role !== "Freelancer") {
    return <div className="page"><div className="alert alert-warn">Connect with a freelancer wallet that has received a certificate to open this page.</div></div>;
  }

  return (
    <div className="page">
      <h1>My certificates</h1>
      <p className="muted">Share a verification link or QR code with any client — they can check it instantly, no account needed.</p>

      {loading ? (
        <p className="muted">Loading your certificates…</p>
      ) : certs.length === 0 ? (
        <div className="card"><p className="muted">No certificates yet. Once an institute issues one to your wallet, it appears here.</p></div>
      ) : (
        certs.map((c) => {
          const expired = Number(c.expiryDate) !== 0 && Number(c.expiryDate) * 1000 < Date.now();
          const valid = !c.isRevoked && !expired;
          return (
            <div className="card cert-card" key={c.id}>
              <div className="cert-head">
                <div>
                  <h2>{c.courseName}</h2>
                  <p className="muted">{c.instituteName} · Issued {formatDate(c.issueDate)}</p>
                </div>
                {valid
                  ? <span className="status-pill ok">Valid</span>
                  : <span className="status-pill bad">{c.isRevoked ? "Revoked" : "Expired"}</span>}
              </div>
              <p className="mono muted">ID: {c.id}</p>
              <div className="cert-actions">
                <button className="btn btn-primary btn-sm" onClick={() => copyLink(c.id)}>
                  {copied === c.id ? "Link copied ✔" : "Copy verification link"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setQrFor(qrFor === c.id ? "" : c.id)}>
                  {qrFor === c.id ? "Hide QR code" : "Show QR code"}
                </button>
                {c.ipfsCid && (
                  <a className="btn btn-ghost btn-sm" href={ipfsUrl(c.ipfsCid)} target="_blank" rel="noreferrer">
                    View file
                  </a>
                )}
              </div>
              {qrFor === c.id && <CertificateQR certId={c.id} />}
            </div>
          );
        })
      )}
    </div>
  );
}
