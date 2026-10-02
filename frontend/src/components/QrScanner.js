import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

// Camera-based QR scanner for verifiers on a laptop or phone browser.
// Phone users can also simply scan with the camera app, which opens the link directly.
export default function QrScanner({ onResult, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const regionId = "qr-reader-region";

  useEffect(() => {
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;
    let done = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          if (done) return;
          done = true;
          scanner.stop().catch(() => {}).finally(() => onResult(decodedText));
        },
        () => {} // ignore frames without a QR code
      )
      .catch(() => setError("Could not open the camera. Allow camera access, or type the certificate ID instead."));

    return () => {
      if (scanner.isScanning) scanner.stop().catch(() => {});
    };
  }, [onResult]);

  return (
    <div className="card qr-scanner">
      <div id={regionId} className="qr-region" />
      {error && <div className="alert alert-error">{error}</div>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel scan</button>
    </div>
  );
}
