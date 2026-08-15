import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider, useWeb3 } from "./context/Web3Context";
import Navbar from "./components/Navbar";
import VerifyPage from "./pages/VerifyPage";
import AdminDashboard from "./pages/AdminDashboard";
import InstituteDashboard from "./pages/InstituteDashboard";
import FreelancerDashboard from "./pages/FreelancerDashboard";

function Shell() {
  const { error, wrongNetwork } = useWeb3();
  return (
    <>
      <Navbar />
      {wrongNetwork && <div className="alert alert-warn banner">Switch MetaMask to the Sepolia test network.</div>}
      {error && <div className="alert alert-error banner">{error}</div>}
      <main>
        <Routes>
          <Route path="/" element={<VerifyPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/institute" element={<InstituteDashboard />} />
          <Route path="/my-certificates" element={<FreelancerDashboard />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>Blockchain-based credential verification for freelancers in Bangladesh · UFTB thesis prototype · Sepolia testnet</p>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </Web3Provider>
  );
}
