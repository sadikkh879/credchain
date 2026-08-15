import React, { useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { hashFile } from "../utils";

const emptyForm = {
  certId: "",
  freelancerName: "",
  freelancerId: "",
  freelancerAddress: "",
  courseName: "",
  ipfsCid: "",
  expiryDate: "", // yyyy-mm-dd or empty for permanent
};

export default function InstituteDashboard() {
  const { contract, role } = useWeb3();
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [fileHash, setFileHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [revokeId, setRevokeId] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onFile = async (e) => {
    const f = e.target.files[0] || null;
    setFile(f);
    setFileHash(f ? await hashFile(f) : "");
  };

  const issue = async () => {
    setMsg(null);
    const missing = ["certId", "freelancerName", "freelancerId", "freelancerAddress", "courseName", "ipfsCid"]
      .filter((k) => !form[k].trim());
    if (missing.length || !file) {
      setMsg({ type: "error", text: "Fill in every field, attach the certificate file, and paste its IPFS CID." });
      return;
    }
    try {
      setBusy(true);
      const expiry = form.expiryDate ? Math.floor(new Date(form.expiryDate).getTime() / 1000) : 0;
      const tx = await contract.issueCertificate(
        form.certId.trim(),
        form.freelancerName.trim(),
        form.freelancerId.trim(),
        form.freelancerAddress.trim(),
        form.courseName.trim(),
        form.ipfsCid.trim(),
        fileHash,
        expiry
      );
      setMsg({ type: "warn", text: "Transaction sent — waiting for confirmation…" });
      await tx.wait();
      setMsg({ type: "ok", text: `Certificate ${form.certId} issued. Share this verification link with the freelancer: ${window.location.origin}/?id=${encodeURIComponent(form.certId.trim())}` });
      setForm(emptyForm);
      setFile(null);
      setFileHash("");
    } catch (e) {
      setMsg({ type: "error", text: e?.reason || e?.shortMessage || "Transaction failed." });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!revokeId.trim()) return;
    try {
      setBusy(true);
      const tx = await contract.revokeCertificate(revokeId.trim());
      await tx.wait();
      setMsg({ type: "ok", text: `Certificate ${revokeId} revoked.` });
      setRevokeId("");
    } catch (e) {
      setMsg({ type: "error", text: e?.reason || e?.shortMessage || "Revoke failed." });
    } finally {
      setBusy(false);
    }
  };

  if (role !== "Institute") {
    return <div className="page"><div className="alert alert-warn">Connect with an approved institute wallet to open this page.</div></div>;
  }

  return (
    <div className="page">
      <h1>Institute panel</h1>
      <p className="muted">
        Issue tamper-proof certificates. Upload the file to IPFS first (e.g. via Pinata), then paste
        the CID here — the file's SHA-256 hash is computed automatically in your browser.
      </p>

      <div className="card">
        <h2>Issue a certificate</h2>

        <div className="grid-2">
          <div className="field">
            <label>Certificate ID</label>
            <input placeholder="e.g. CERT-2026-001" value={form.certId} onChange={set("certId")} />
          </div>
          <div className="field">
            <label>Course / skill name</label>
            <input placeholder="e.g. Web Development" value={form.courseName} onChange={set("courseName")} />
          </div>
          <div className="field">
            <label>Freelancer name</label>
            <input placeholder="Full name" value={form.freelancerName} onChange={set("freelancerName")} />
          </div>
          <div className="field">
            <label>Freelancer ID</label>
            <input placeholder="National ID or platform ID" value={form.freelancerId} onChange={set("freelancerId")} />
          </div>
        </div>

        <div className="field">
          <label>Freelancer wallet address</label>
          <input placeholder="0x…" value={form.freelancerAddress} onChange={set("freelancerAddress")} />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Certificate file (PDF/image)</label>
            <input type="file" accept=".pdf,image/*" onChange={onFile} />
            {fileHash && <p className="muted mono hash">SHA-256: {fileHash}</p>}
          </div>
          <div className="field">
            <label>IPFS CID</label>
            <input placeholder="Paste CID from Pinata after uploading" value={form.ipfsCid} onChange={set("ipfsCid")} />
          </div>
        </div>

        <div className="field">
          <label>Expiry date <span className="muted">(leave empty for permanent)</span></label>
          <input type="date" value={form.expiryDate} onChange={set("expiryDate")} />
        </div>

        <button className="btn btn-primary" onClick={issue} disabled={busy}>
          {busy ? "Working…" : "Issue certificate"}
        </button>
      </div>

      <div className="card">
        <h2>Revoke a certificate</h2>
        <p className="muted">Revoking permanently marks a certificate as invalid. This cannot be undone.</p>
        <div className="field">
          <label>Certificate ID</label>
          <input placeholder="e.g. CERT-2026-001" value={revokeId} onChange={(e) => setRevokeId(e.target.value)} />
        </div>
        <button className="btn btn-danger" onClick={revoke} disabled={busy}>Revoke certificate</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
    </div>
  );
}
