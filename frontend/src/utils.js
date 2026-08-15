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
