// Compute SHA-256 hash of a file in the browser -> 0x-prefixed bytes32 string
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function formatDate(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ipfsUrl(cid) {
  return cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : null;
}

// Public verification link for a certificate; this is what the QR code encodes
export function verifyUrl(certId) {
  return `${window.location.origin}/?id=${encodeURIComponent(certId.trim())}`;
}

// Accepts either a full verification link (from a QR code) or a bare certificate ID
export function extractCertId(text) {
  const raw = (text || "").trim();
  try {
    const id = new URL(raw).searchParams.get("id");
    if (id) return id.trim();
  } catch {
    // not a URL, treat as a plain ID
  }
  return raw;
}
