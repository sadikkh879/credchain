import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_CHAIN_ID, ROLE_NAMES } from "../contracts/config";

const Web3Context = createContext(null);
export const useWeb3 = () => useContext(Web3Context);

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);       // signer-connected (for transactions)
  const [readContract, setReadContract] = useState(null); // provider-connected (for reads, no wallet needed)
  const [role, setRole] = useState("None");
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;

  // Read-only contract so clients can verify without connecting a wallet
  useEffect(() => {
    if (!hasMetaMask) return;
    const provider = new BrowserProvider(window.ethereum);
    setReadContract(new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider));
  }, [hasMetaMask]);

  const loadRole = useCallback(async (addr, c) => {
    try {
      const r = await c.getUserRole(addr);
      setRole(ROLE_NAMES[Number(r)] || "None");
    } catch {
      setRole("None");
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setError("");
    if (!hasMetaMask) {
      setError("MetaMask is not installed. Install it from metamask.io to continue.");
      return;
    }
    try {
      setConnecting(true);
      const provider = new BrowserProvider(window.ethereum);

      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID) {
        setWrongNetwork(true);
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
          setWrongNetwork(false);
        } catch {
          setError("Please switch MetaMask to the Sepolia test network.");
          setConnecting(false);
          return;
        }
      }

      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAccount(accounts[0]);
      setContract(c);
      await loadRole(accounts[0], c);
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [hasMetaMask, loadRole]);

  const disconnect = () => {
    setAccount(null);
    setContract(null);
    setRole("None");
  };

  // React to account / network changes in MetaMask
  useEffect(() => {
    if (!hasMetaMask) return;
    const onAccounts = (accs) => {
      if (accs.length === 0) disconnect();
      else connectWallet();
    };
    const onChain = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [hasMetaMask, connectWallet]);

  return (
    <Web3Context.Provider
      value={{
        account,
        contract,
        readContract,
        role,
        connectWallet,
        disconnect,
        connecting,
        wrongNetwork,
        error,
        hasMetaMask,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}
