import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "../context/Web3Context";
import { shortAddress } from "../utils";

export default function AdminDashboard() {
  const { contract, role } = useWeb3();
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [institutes, setInstitutes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }

  const loadInstitutes = useCallback(async () => {
    if (!contract) return;
    try {
      const addrs = await contract.getInstituteList();
      const rows = await Promise.all(
        addrs.map(async (a) => {
          const i = await contract.getInstitute(a);
          return { address: a, name: i.name, approved: i.isApproved };
        })
      );
      setInstitutes(rows);
    } catch {
      /* contract may not have data yet */
    }
  }, [contract]);

  useEffect(() => { loadInstitutes(); }, [loadInstitutes]);

  const registerInstitute = async () => {
    setMsg(null);
    if (!wallet || !name || !instituteId) {
      setMsg({ type: "error", text: "Fill in the wallet address, institute name, and institute ID." });
      return;
    }
    try {
      setBusy(true);
      const tx = await contract.registerInstitute(wallet.trim(), name.trim(), instituteId.trim());
      setMsg({ type: "info", text: "Transaction sent — waiting for confirmation…" });
      await tx.wait();
      setMsg({ type: "ok", text: `Institute "${name}" registered.` });
      setWallet(""); setName(""); setInstituteId("");
      loadInstitutes();
    } catch (e) {
      setMsg({ type: "error", text: e?.reason || e?.shortMessage || "Transaction failed." });
    } finally {
      setBusy(false);
    }
  };

  const approve = async (addr) => {
    try {
      setBusy(true);
      const tx = await contract.approveInstitute(addr);
      await tx.wait();
      loadInstitutes();
    } catch (e) {
      setMsg({ type: "error", text: e?.reason || e?.shortMessage || "Approval failed." });
    } finally {
      setBusy(false);
    }
  };

  if (role !== "Admin") {
    return <div className="page"><div className="alert alert-warn">Connect with the admin wallet to open this page.</div></div>;
  }

  return (
    <div className="page">
      <h1>Admin panel</h1>
      <p className="muted">Register training institutes and approve them so they can issue certificates.</p>

      <div className="card">
        <h2>Register an institute</h2>
        <div className="field">
          <label>Institute wallet address</label>
          <input placeholder="0x…" value={wallet} onChange={(e) => setWallet(e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Institute name</label>
            <input placeholder="e.g. Creative IT Institute" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Institute ID</label>
            <input placeholder="e.g. INST-001" value={instituteId} onChange={(e) => setInstituteId(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={registerInstitute} disabled={busy}>
          {busy ? "Working…" : "Register institute"}
        </button>
        {msg && <div className={`alert alert-${msg.type === "ok" ? "ok" : msg.type === "info" ? "warn" : "error"}`}>{msg.text}</div>}
      </div>

      <div className="card">
        <h2>Registered institutes</h2>
        {institutes.length === 0 ? (
          <p className="muted">No institutes registered yet. Register one above to get started.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Wallet</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {institutes.map((i) => (
                  <tr key={i.address}>
                    <td>{i.name}</td>
                    <td className="mono">{shortAddress(i.address)}</td>
                    <td>
                      {i.approved
                        ? <span className="status-pill ok">Approved</span>
                        : <span className="status-pill pending">Pending</span>}
                    </td>
                    <td>
                      {!i.approved && (
                        <button className="btn btn-sm btn-primary" onClick={() => approve(i.address)} disabled={busy}>
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
