"use client";

import React, { useState } from "react";

interface ClubCrestProps {
  sigla?: string;
  nome?: string;
  corPrimaria?: string;
  logoUrl?: string;
  size?: "sm" | "md" | "lg";
}

export function ClubCrest({
  sigla = "",
  nome = "",
  corPrimaria = "#016294",
  logoUrl,
  size = "md",
}: ClubCrestProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const code = sigla.trim().toUpperCase();

  const containerSize =
    size === "lg"
      ? "w-12 h-12 sm:w-14 sm:h-14 p-1.5"
      : size === "sm"
        ? "w-9 h-9 p-1"
        : "w-11 h-11 p-1";

  const renderShield = () => {
    switch (code) {
      case "SPO":
        // Sport Club do Recife: Red & Black horizontal stripes, gold border, 3 stars & gold lion emblem
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "Sport Recife"}
          >
            <circle cx="16" cy="5.5" r="1.4" fill="#d4af37" />
            <circle cx="22" cy="4.2" r="1.7" fill="#d4af37" />
            <circle cx="28" cy="5.5" r="1.4" fill="#d4af37" />
            <path
              d="M9 9.5H35V24C35 32.5 22 39 22 39C22 39 9 32.5 9 24V9.5Z"
              fill="#141414"
              stroke="#d4af37"
              strokeWidth="1.7"
            />
            <rect x="10.5" y="12.5" width="23" height="3.8" fill="#c8102e" />
            <rect x="10.5" y="19.8" width="23" height="3.8" fill="#c8102e" />
            <path
              d="M12.5 27.2H31.5C29.2 31.8 22 35.8 22 35.8C22 35.8 14.8 31.8 12.5 27.2Z"
              fill="#c8102e"
            />
            <circle
              cx="22"
              cy="22"
              r="5.8"
              fill="#141414"
              stroke="#d4af37"
              strokeWidth="1.3"
            />
            <path
              d="M19.5 24.5L20.7 19.2L22.5 21L24.5 19L24 24.5H19.5Z"
              fill="#d4af37"
            />
          </svg>
        );

      case "NAU":
        // Clube Náutico Capibaribe: Red & White vertical stripes, CNC header, stars
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "Náutico"}
          >
            <circle cx="15" cy="5.5" r="1.2" fill="#d4af37" />
            <circle cx="19.5" cy="4.4" r="1.3" fill="#d4af37" />
            <circle cx="24.5" cy="4.4" r="1.3" fill="#d4af37" />
            <circle cx="29" cy="5.5" r="1.2" fill="#d4af37" />
            <path
              d="M9.5 9.5H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V9.5Z"
              fill="#ffffff"
              stroke="#d91c24"
              strokeWidth="1.8"
            />
            <path d="M10.5 10.5H33.5V16.5H10.5V10.5Z" fill="#d91c24" />
            <text
              x="22"
              y="15"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="4.8"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              CNC
            </text>
            <path d="M13 17H16.5V31.5L13 28.5V17Z" fill="#d91c24" />
            <path d="M20.2 17H23.8V36.8L22 37.8L20.2 36.8V17Z" fill="#d91c24" />
            <path d="M27.5 17H31V28.5L27.5 31.5V17Z" fill="#d91c24" />
          </svg>
        );

      case "STA":
        // Santa Cruz FC: Black, White & Red horizontal tricolor shield
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "Santa Cruz"}
          >
            <path
              d="M9.5 8H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V8Z"
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="1.8"
            />
            <rect x="10.5" y="9" width="23" height="6" fill="#111111" />
            <rect x="10.5" y="18" width="23" height="6" fill="#e11d48" />
            <path
              d="M12.5 27H31.5C29 31.5 22 36 22 36C22 36 15 31.5 12.5 27Z"
              fill="#111111"
            />
            <circle
              cx="22"
              cy="21"
              r="6"
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="1.2"
            />
            <text
              x="22"
              y="22.8"
              textAnchor="middle"
              fill="#111111"
              fontSize="4.6"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              SCFC
            </text>
          </svg>
        );

      case "CEN":
        // Central Sport Club (Caruaru): Black & White vertical stripes + CSC
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "Central"}
          >
            <circle cx="22" cy="4.8" r="1.8" fill="#d4af37" />
            <path
              d="M9.5 9.5H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V9.5Z"
              fill="#111111"
              stroke="#111111"
              strokeWidth="1.6"
            />
            <path d="M13.5 16.5H17V32.5L13.5 29.5V16.5Z" fill="#ffffff" />
            <path
              d="M20.2 16.5H23.8V36.8L22 37.8L20.2 36.8V16.5Z"
              fill="#ffffff"
            />
            <path d="M27 16.5H30.5V29.5L27 32.5V16.5Z" fill="#ffffff" />
            <rect x="10.5" y="10.5" width="23" height="5.5" fill="#111111" />
            <text
              x="22"
              y="14.8"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="4.8"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              CSC
            </text>
          </svg>
        );

      case "AME":
        // América-PE: Green & White vertical stripes + AFC
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "América-PE"}
          >
            <path
              d="M9.5 8H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V8Z"
              fill="#ffffff"
              stroke="#15803d"
              strokeWidth="1.8"
            />
            <path d="M10.5 9H33.5V15.5H10.5V9Z" fill="#15803d" />
            <text
              x="22"
              y="13.8"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="4.8"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              AFC
            </text>
            <path d="M13 16H16.8V31.5L13 28.5V16Z" fill="#15803d" />
            <path d="M20.1 16H23.9V36.8L22 37.8L20.1 36.8V16Z" fill="#15803d" />
            <path d="M27.2 16H31V28.5L27.2 31.5V16Z" fill="#15803d" />
          </svg>
        );

      case "PET":
        // Petrolina Social FC: Red, Yellow & Green shield
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "Petrolina"}
          >
            <path
              d="M9.5 8H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V8Z"
              fill="#b91c1c"
              stroke="#facc15"
              strokeWidth="1.8"
            />
            <path d="M10.5 16H33.5V23H10.5V16Z" fill="#facc15" />
            <path
              d="M12 24H32C29.5 31 22 36.5 22 36.5C22 36.5 14.5 31 12 24Z"
              fill="#15803d"
            />
            <text
              x="22"
              y="21.2"
              textAnchor="middle"
              fill="#111111"
              fontSize="5"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              PSFC
            </text>
          </svg>
        );

      case "IBI":
        // Íbis Sport Club: Red & Black shield + ISC
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || "Íbis"}
          >
            <path
              d="M9.5 8H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V8Z"
              fill="#dc2626"
              stroke="#111111"
              strokeWidth="1.8"
            />
            <path
              d="M10.5 9H33.5V17L10.5 28V9Z"
              fill="#111111"
              opacity="0.92"
            />
            <circle
              cx="22"
              cy="22"
              r="7"
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="1.3"
            />
            <text
              x="22"
              y="24"
              textAnchor="middle"
              fill="#dc2626"
              fontSize="5.5"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              ÍBIS
            </text>
          </svg>
        );

      default:
        // Generic Heraldic Shield with club color & sigla
        return (
          <svg
            viewBox="0 0 44 44"
            className="w-full h-full"
            aria-label={nome || code || "Clube"}
          >
            <path
              d="M9.5 8H34.5V24C34.5 32.5 22 39 22 39C22 39 9.5 32.5 9.5 24V8Z"
              fill={corPrimaria}
              stroke="#e5e7eb"
              strokeWidth="1.5"
            />
            <text
              x="22"
              y="24"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="7"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              {code || "—"}
            </text>
          </svg>
        );
    }
  };

  return (
    <div
      className={`${containerSize} rounded-full bg-white border border-[#e5e7eb] shadow-xs flex items-center justify-center shrink-0 overflow-hidden`}
    >
      {logoUrl && !imgFailed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt={nome || code || "Escudo do clube"}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : code ? (
        renderShield()
      ) : (
        <span className="text-xs font-extrabold text-[#4e5462]">—</span>
      )}
    </div>
  );
}
