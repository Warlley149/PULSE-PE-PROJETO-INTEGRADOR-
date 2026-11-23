"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BiometricProfile } from "@/app/lib/storage";

export interface HeaderProps {
  variant?: "torcedor" | "admin";
  profile?: BiometricProfile | null;
  adminEmail?: string | null;
  unreadCount?: number;
  isAuthenticated?: boolean;
  onOpenProfile?: () => void;
  onOpenCarteirinha?: () => void;
  onOpenNotificacoes?: () => void;
  onOpenSuporte?: () => void;
  onOpenPrivacidade?: () => void;
  onLogout?: () => void;
  disableBrandClick?: boolean;
}

export function AppHeader({
  variant = "torcedor",
  profile,
  adminEmail,
  unreadCount = 0,
  isAuthenticated = true,
  onOpenProfile,
  onOpenCarteirinha,
  onOpenNotificacoes,
  onOpenSuporte,
  onOpenPrivacidade,
  onLogout,
  disableBrandClick = false,
}: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = variant === "admin" || Boolean(adminEmail && !profile?.email);
  const hasFaceRegistered = Boolean(profile?.faceImageDataUrl);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#f9f8fe]/95 backdrop-blur-xs border-b border-[#eceaf6] w-full select-none">
      <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-3 sm:py-3.5 flex items-center justify-between gap-3">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-3.5 text-left">
          {disableBrandClick ? (
            <div className="flex items-center gap-3 sm:gap-3.5 text-left cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-b from-[#0682c4] to-[#02669c] flex items-center justify-center shadow-xs relative shrink-0">
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 text-white"
                  viewBox="0 0 36 36"
                  fill="none"
                >
                  <path
                    d="M25.5 10.5A11 11 0 1 0 27 23"
                    stroke="white"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22.5 13A7.5 7.5 0 1 0 23.5 21.5"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19.8 15.5A4 4 0 1 0 20.2 20"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="17.5" cy="18" r="1.5" fill="white" />
                  <path
                    d="M22 8.5L23.5 7M25.5 11.5L27.5 10.5"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="23.5" cy="23.5" r="2.3" fill="#1bb381" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.06em] text-[#3b8dbd] uppercase leading-[1.15]">
                  ILHA DO RETIRO
                </span>
                <span className="text-[14px] sm:text-[16px] font-extrabold tracking-[0.02em] text-[#131b2e] uppercase mt-0.5">
                  {isAdmin ? "PULSE PE • ADM" : "PULSE PE"}
                </span>
              </div>
            </div>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-3 sm:gap-3.5 text-left cursor-pointer group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-b from-[#0682c4] to-[#02669c] flex items-center justify-center shadow-xs relative shrink-0 transition-transform group-hover:scale-105">
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 text-white"
                  viewBox="0 0 36 36"
                  fill="none"
                >
                  <path
                    d="M25.5 10.5A11 11 0 1 0 27 23"
                    stroke="white"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22.5 13A7.5 7.5 0 1 0 23.5 21.5"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19.8 15.5A4 4 0 1 0 20.2 20"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="17.5" cy="18" r="1.5" fill="white" />
                  <path
                    d="M22 8.5L23.5 7M25.5 11.5L27.5 10.5"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="23.5" cy="23.5" r="2.3" fill="#1bb381" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.06em] text-[#3b8dbd] uppercase leading-[1.15]">
                  ILHA DO RETIRO
                </span>
                <span className="text-[14px] sm:text-[16px] font-extrabold tracking-[0.02em] text-[#131b2e] uppercase mt-0.5">
                  {isAdmin ? "PULSE PE • ADM" : "PULSE PE"}
                </span>
              </div>
            </Link>
          )}
        </div>

        {/* Right Section: Notification Bell + Profile Avatar Dropdown (Only when Authenticated) */}
        {isAuthenticated ? (
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notification Bell Button */}
            {onOpenNotificacoes && (
              <button
                type="button"
                onClick={onOpenNotificacoes}
                aria-label="Abrir Notificações"
                className="relative p-2 text-[#2f3648] hover:bg-[#f2f3ff] rounded-full transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5 sm:w-[22px] sm:h-[22px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#006c4a] ring-2 ring-white" />
                )}
              </button>
            )}

            {/* Profile Avatar Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-label="Menu do Usuário"
                aria-expanded={dropdownOpen}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-[#f2f3ff] transition-all cursor-pointer"
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] border-2 ${
                    hasFaceRegistered
                      ? "border-[#006c4a]"
                      : "border-[#d5d8e2]"
                  } bg-white overflow-hidden flex items-center justify-center relative shadow-xs`}
                >
                  {profile?.faceImageDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profile.faceImageDataUrl}
                      alt={profile.nome || "Foto facial"}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <svg
                      className="w-5 h-5 text-[#4e5462]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M5 20a7 7 0 0 1 14 0" />
                    </svg>
                  )}

                  {hasFaceRegistered && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#006c4a] ring-2 ring-white" />
                  )}
                </div>
              </button>

              {/* Dropdown Popup Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white shadow-2xl border border-[#eceaf6] p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                  {/* User Header in Dropdown */}
                  <div className="p-3 bg-[#f2f3ff] rounded-xl mb-2 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-white shrink-0 border border-[#d5d8e2] flex items-center justify-center">
                      {profile?.faceImageDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={profile.faceImageDataUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          className="w-6 h-6 text-[#4e5462]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M5 20a7 7 0 0 1 14 0" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-[#131b2e] truncate">
                        {isAdmin
                          ? "Administrador da Arena"
                          : profile?.nome || profile?.email || "Torcedor"}
                      </p>
                      <p className="text-[10.5px] text-[#4e5462] truncate">
                        {isAdmin
                          ? adminEmail || "admin@pulsepe.gov.br"
                          : profile?.matricula
                            ? `Matrícula #${profile.matricula.replace(/^#/, "")}`
                            : profile?.cpf
                              ? `CPF ${profile.cpf}`
                              : profile?.email}
                      </p>
                      <span
                        className={`inline-block mt-0.5 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isAdmin
                            ? "bg-[#016294] text-white"
                            : hasFaceRegistered
                              ? "text-[#006c4a] bg-[#d4f4e4]"
                              : "text-[#93000a] bg-[#ffdad6]"
                        }`}
                      >
                        {isAdmin
                          ? "Operador Autorizado"
                          : hasFaceRegistered
                            ? "Biometria Homologada ✓"
                            : "Biometria Pendente"}
                      </span>
                    </div>
                  </div>

                  {/* Navigation Options */}
                  <div className="flex flex-col gap-1 text-xs">
                    {isAdmin ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            router.push("/admin");
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f2f3ff] text-[#131b2e] font-bold text-left transition-colors cursor-pointer"
                        >
                          <svg
                            className="w-4 h-4 text-[#016294]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                          </svg>
                          <span>Painel ADM (Scanner & Bilhetes)</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {onOpenProfile && (
                          <button
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false);
                              onOpenProfile();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f2f3ff] text-[#131b2e] font-bold text-left transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 text-[#016294]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span>Acessar Dados do Perfil</span>
                          </button>
                        )}

                        {onOpenCarteirinha && (
                          <button
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false);
                              onOpenCarteirinha();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f2f3ff] text-[#131b2e] font-bold text-left transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 text-[#016294]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            <span>Carteirinha Digital de Sócio</span>
                          </button>
                        )}

                        {onOpenNotificacoes && (
                          <button
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false);
                              onOpenNotificacoes();
                            }}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#f2f3ff] text-[#131b2e] font-bold text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <svg
                                className="w-4 h-4 text-[#016294]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                              </svg>
                              <span>Notificações & Avisos</span>
                            </div>
                            {unreadCount > 0 && (
                              <span className="text-[10px] font-black bg-[#006c4a] text-white px-2 py-0.5 rounded-full">
                                {unreadCount}
                              </span>
                            )}
                          </button>
                        )}

                        {onOpenSuporte && (
                          <button
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false);
                              onOpenSuporte();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f2f3ff] text-[#131b2e] font-bold text-left transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 text-[#016294]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                              <path d="M12 17h.01" />
                            </svg>
                            <span>Central de Suporte</span>
                          </button>
                        )}

                        {onOpenPrivacidade && (
                          <button
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false);
                              onOpenPrivacidade();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f2f3ff] text-[#131b2e] font-bold text-left transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 text-[#016294]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <path d="m9 12 2 2 4-4" />
                            </svg>
                            <span>Privacidade & LGPD</span>
                          </button>
                        )}
                      </>
                    )}

                    <div className="my-1.5 border-t border-[#eceaf6]" />

                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#93000a] font-extrabold text-left transition-colors cursor-pointer"
                      >
                        <svg
                          className="w-4 h-4 text-[#93000a]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Deslogar</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-[#016294] bg-[#e6f0f5] px-3.5 py-1.5 rounded-full">
              Portal de Acesso
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
