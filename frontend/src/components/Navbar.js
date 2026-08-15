import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { shortAddress } from "../utils";

export default function Navbar() {
  const { account, role, connectWallet, disconnect, connecting } = useWeb3();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Verify" },
    ...(role === "Admin" ? [{ to: "/admin", label: "Admin" }] : []),
    ...(role === "Institute" ? [{ to: "/institute", label: "Institute" }] : []),
    ...(role === "Freelancer" ? [{ to: "/my-certificates", label: "My certificates" }] : []),
  ];

  return (
    <header className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">◆</span> CredChain BD
        </NavLink>

        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          ☰
        </button>

        <nav className={"nav-links" + (open ? " open" : "")}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {l.label}
            </NavLink>
          ))}

          {account ? (
            <div className="wallet-chip">
              <span className={`role-badge role-${role.toLowerCase()}`}>{role}</span>
              <span className="addr">{shortAddress(account)}</span>
              <button className="btn btn-ghost btn-sm" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connectWallet} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
