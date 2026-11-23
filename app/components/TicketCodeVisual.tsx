"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface TicketCodeVisualProps {
  code: string;
  validationUrl: string;
  size?: number;
}

/**
 * Generates a 100% ISO/IEC 18004 spec-compliant, camera-scannable QR Code
 * using the official `qrcode` library, plus a high-contrast alphanumeric code.
 */
export function TicketCodeVisual({
  code,
  validationUrl,
  size = 220,
}: TicketCodeVisualProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(validationUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: size,
      color: {
        dark: "#131b2e",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });

    return () => {
      active = false;
    };
  }, [size, validationUrl]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Real Official Scannable QR Code */}
      <div className="bg-white p-3 rounded-2xl border border-[#eceaf6] shadow-2xs inline-flex items-center justify-center min-w-[200px] min-h-[200px]">
        {qrDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrDataUrl}
            alt={`QR Code oficial do ingresso ${code}`}
            width={size}
            height={size}
            className="rounded-lg block"
          />
        ) : (
          <div className="w-[180px] h-[180px] flex items-center justify-center text-xs font-semibold text-[#4e5462]">
            Gerando QR Code...
          </div>
        )}
      </div>

      {/* High-contrast Alphanumeric Code */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
          CÓDIGO DO BILHETE
        </span>
        <span className="mt-0.5 text-base sm:text-lg font-mono font-extrabold tracking-[0.2em] text-[#131b2e]">
          {code}
        </span>
      </div>
    </div>
  );
}
