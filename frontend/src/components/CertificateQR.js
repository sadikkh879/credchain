import React, { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { verifyUrl } from "../utils";

// QR code that opens the public verification page for one certificate.
// Error-correction level H keeps it readable when printed small or partly covered.
export default function CertificateQR({ certId, size = 168 }) {
  const wrapRef = useRef(null);
  const link = verifyUrl(certId);

  const download = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${certId.trim()}-qr.png`;
    a.click();
  };

  return (
    <div className="qr-box">
      <div ref={wrapRef} className="qr-canvas">
        <QRCodeCanvas value={link} size={size} level="H" marginSize={2} />
      </div>
      <p className="mono muted qr-id">{certId.trim()}</p>
      <p className="muted qr-link">{link}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={download}>Download QR (PNG)</button>
    </div>
  );
}
