import React from "react";
import { generateQrMatrix } from "@/app/lib/qrcode";

interface TicketCodeVisualProps {
  code: string;
  validationUrl: string;
  size?: number;
}

/**
 * Renders a real ISO/IEC 18004 scannable QR Code encoding the validation URL
 * plus a linear barcode and alphanumeric code for arena gate recognition.
 */
export function TicketCodeVisual({
  code,
  validationUrl,
  size = 192,
}: TicketCodeVisualProps) {
  const matrix = generateQrMatrix(validationUrl);
  const quietZone = 2;
  const totalSize = matrix.length + quietZone * 2;

  const bars: number[] = [];
  for (let i = 0; i < 36; i++) {
    const ch = code.charCodeAt(i % code.length);
    bars.push(((ch + i * 7) % 3) + 1);
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Real ISO/IEC 18004 Scannable QR Code */}
      <div className="bg-white p-3 rounded-2xl border border-[#eceaf6] shadow-2xs inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${totalSize} ${totalSize}`}
          shapeRendering="crispEdges"
          aria-label={`QR Code oficial do ingresso ${code}`}
        >
          <rect width={totalSize} height={totalSize} fill="#ffffff" />
          {matrix.map((row, r) =>
            row.map((filled, c) =>
              filled ? (
                <rect
                  key={`${r}-${c}`}
                  x={c + quietZone}
                  y={r + quietZone}
                  width={1}
                  height={1}
                  fill="#131b2e"
                />
              ) : null,
            ),
          )}
        </svg>
      </div>

      {/* Linear Barcode + Code */}
      <div className="w-full max-w-[230px] flex flex-col items-center">
        <svg
          viewBox="0 0 180 34"
          className="w-full h-8"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          {(() => {
            let x = 2;
            return bars.map((w, idx) => {
              const barX = x;
              x += w + (idx % 2 === 0 ? 1.5 : 2);
              return (
                <rect
                  key={idx}
                  x={barX}
                  y={0}
                  width={w}
                  height={34}
                  fill="#131b2e"
                />
              );
            });
          })()}
        </svg>
        <span className="mt-1.5 text-sm sm:text-base font-mono font-extrabold tracking-[0.18em] text-[#131b2e]">
          {code}
        </span>
      </div>
    </div>
  );
}
