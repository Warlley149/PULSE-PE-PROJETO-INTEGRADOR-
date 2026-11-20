"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  ServerTicketRecord,
  TicketValidationStatus,
} from "@/app/lib/server-tickets";

interface AdminPortalClientProps {
  initialAuthenticated: boolean;
  initialEmail: string | null;
  initialScannedCode?: string;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

export function AdminPortalClient({
  initialAuthenticated,
  initialEmail,
  initialScannedCode = "",
}: AdminPortalClientProps) {
  const [authenticated, setAuthenticated] =
    useState<boolean>(initialAuthenticated);
  const [adminEmail, setAdminEmail] = useState<string>(initialEmail || "");

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Admin dashboard state
  const [tickets, setTickets] = useState<ServerTicketRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<
    "todos" | TicketValidationStatus
  >("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [manualCode, setManualCode] = useState<string>(initialScannedCode);
  const [selectedTicket, setSelectedTicket] =
    useState<ServerTicketRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  // QR Camera Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [barcodeSupported, setBarcodeSupported] = useState<boolean>(true);

  const stopScanner = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
  }, []);

  const extractTicketCode = useCallback((rawValue: string): string => {
    const trimmed = rawValue.trim();
    try {
      const url = new URL(trimmed);
      const paramCode = url.searchParams.get("codigo");
      if (paramCode) return paramCode.trim().toUpperCase();
    } catch {
      // Not a URL, parse raw code
    }
    const match = trimmed.toUpperCase().match(/PE-\d{6}/);
    return match ? match[0] : trimmed.toUpperCase();
  }, []);

  const fetchTickets = useCallback(
    async (highlightCode?: string) => {
      setLoadingTickets(true);
      try {
        const res = await fetch("/api/ingressos", { cache: "no-store" });
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as {
            tickets?: ServerTicketRecord[];
          };
          const list = Array.isArray(data.tickets) ? data.tickets : [];
          setTickets(list);

          const codeToSelect = highlightCode || selectedTicket?.codigo;
          if (codeToSelect) {
            const match = list.find(
              (t) => t.codigo.toUpperCase() === codeToSelect.toUpperCase(),
            );
            if (match) setSelectedTicket(match);
          }
        }
      } finally {
        setLoadingTickets(false);
      }
    },
    [selectedTicket?.codigo],
  );

  useEffect(() => {
    if (!authenticated) return;
    const initTimer = window.setTimeout(() => {
      void fetchTickets(initialScannedCode || undefined);
    }, 0);
    const interval = window.setInterval(() => {
      void fetchTickets();
    }, 6000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
      stopScanner();
    };
  }, [authenticated, fetchTickets, initialScannedCode, stopScanner]);

  const startScanner = useCallback(
    async (facing: "environment" | "user" = facingMode) => {
      setScannerError(null);
      stopScanner();

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setScannerError("Dispositivo sem acesso à câmera WebRTC.");
        return;
      }

      const Detector = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
      ).BarcodeDetector;
      setBarcodeSupported(Boolean(Detector));

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        setScannerActive(true);

        window.setTimeout(async () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
              await videoRef.current.play();
            } catch {
              // handled
            }
          }
        }, 50);
      } catch {
        setScannerError(
          "Permissão da câmera negada ou indisponível. Você pode digitar o código manualmente abaixo.",
        );
        setScannerActive(false);
      }
    },
    [facingMode, stopScanner],
  );

  const lookupCode = useCallback(
    async (rawInput: string) => {
      const code = extractTicketCode(rawInput);
      if (!code) return;

      setManualCode(code);
      setActionMessage(null);

      const localMatch = tickets.find(
        (t) => t.codigo.toUpperCase() === code.toUpperCase(),
      );
      if (localMatch) {
        setSelectedTicket(localMatch);
        return;
      }

      try {
        const res = await fetch(
          `/api/ingressos/validar?codigo=${encodeURIComponent(code)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            ticket?: ServerTicketRecord | null;
          };
          if (data.ticket) {
            setSelectedTicket(data.ticket);
            return;
          }
        }
      } catch {
        // ignore
      }

      setSelectedTicket(null);
      setActionMessage({
        type: "error",
        text: `Bilhete ${code} não encontrado na base de ingressos gerados.`,
      });
    },
    [extractTicketCode, tickets],
  );

  // Continuous QR Code detection loop using native BarcodeDetector when active
  useEffect(() => {
    if (!scannerActive) return;

    const Detector = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!Detector) return;

    const detector = new Detector({ formats: ["qr_code"] });
    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const results = await detector.detect(video);
        if (results.length > 0 && results[0].rawValue) {
          const code = extractTicketCode(results[0].rawValue);
          if (code) {
            stopScanner();
            await lookupCode(code);
          }
        }
      } catch {
        // continue scanning
      }
    }, 350);

    return () => window.clearInterval(interval);
  }, [extractTicketCode, lookupCode, scannerActive, stopScanner]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = (await res.json()) as {
        authenticated?: boolean;
        email?: string;
        error?: string;
      };

      if (!res.ok || !data.authenticated) {
        setLoginError(data.error || "Falha na autenticação.");
        return;
      }

      setAdminEmail(data.email || loginEmail.trim());
      setAuthenticated(true);
      setLoginPassword("");
    } catch {
      setLoginError("Erro de conexão ao autenticar.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    stopScanner();
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthenticated(false);
    setTickets([]);
    setSelectedTicket(null);
  };

  const handleReviewDecision = async (
    ticket: ServerTicketRecord,
    decision: "aprovado" | "reprovado",
  ) => {
    setSubmittingDecision(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/ingressos/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: ticket.codigo,
          decision,
          motivoReprovacao:
            decision === "reprovado"
              ? rejectionReason.trim() ||
                "Entrada reprovada pelo operador da arena."
              : undefined,
        }),
      });

      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }

      const data = (await res.json()) as {
        ticket?: ServerTicketRecord;
        error?: string;
      };

      if (!res.ok || !data.ticket) {
        setActionMessage({
          type: "error",
          text: data.error || "Não foi possível atualizar o bilhete.",
        });
        return;
      }

      setSelectedTicket(data.ticket);
      setRejectionReason("");
      setActionMessage({
        type: "success",
        text:
          decision === "aprovado"
            ? `Entrada APROVADA para ${data.ticket.codigo} (${data.ticket.titular}).`
            : `Entrada REPROVADA para ${data.ticket.codigo}.`,
      });
      await fetchTickets(data.ticket.codigo);
    } catch {
      setActionMessage({
        type: "error",
        text: "Erro de comunicação com o servidor.",
      });
    } finally {
      setSubmittingDecision(false);
    }
  };

  // =========================================================
  // UNAUTHENTICATED VIEW: SECURE ADMIN LOGIN GATE ONLY
  // =========================================================
  if (!authenticated) {
    return (
      <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col">
        <header className="bg-[#f9f8fe] border-b border-[#eceaf6] w-full px-4 sm:px-6 lg:px-10 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#0682c4] to-[#02669c] flex items-center justify-center text-white font-extrabold text-xs">
              ADM
            </div>
            <div className="leading-none">
              <span className="text-[10px] font-bold tracking-wider text-[#3b8dbd] uppercase block">
                ÁREA RESTRITA • ARENA PE
              </span>
              <span className="text-sm font-extrabold text-[#131b2e] uppercase">
                PULSE PE — ADMINISTRAÇÃO
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="text-xs font-extrabold text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3.5 py-2 rounded-xl transition-colors"
          >
            Área do Torcedor
          </Link>
        </header>

        <main className="flex-1 w-full flex items-center justify-center p-4 sm:p-6">
          <section className="w-full max-w-md bg-white rounded-[28px] shadow-[0_8px_32px_rgba(19,27,46,0.08)] p-6 sm:p-8 border border-[#eceaf6]">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center mb-3">
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#016294] bg-[#e6f0f5] px-3 py-1 rounded-full">
                ACESSO EXCLUSIVO ADM
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#131b2e] mt-2.5">
                Login do Administrador
              </h1>
              <p className="text-xs text-[#4e5462] mt-1">
                Autentique-se para escanear QR Codes, aprovar ou reprovar
                entradas e visualizar a lista de bilhetes.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1.5"
                >
                  E-mail do Administrador
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@pulsepe.gov.br"
                  className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1.5"
                >
                  Senha
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                />
              </div>

              {loginError && (
                <div className="rounded-xl bg-[#ffdad6] px-4 py-3 text-xs font-bold text-[#93000a]">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="mt-1 w-full bg-[#016294] hover:bg-[#01537e] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-4 rounded-xl shadow-sm cursor-pointer transition-colors"
              >
                {loginLoading ? "Verificando..." : "Entrar no Painel ADM"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  // =========================================================
  // AUTHENTICATED VIEW: FULL-SCREEN RESPONSIVE ADMIN PANEL
  // =========================================================
  const totalCount = tickets.length;
  const pendingCount = tickets.filter((t) => t.status === "pendente").length;
  const approvedCount = tickets.filter((t) => t.status === "aprovado").length;
  const rejectedCount = tickets.filter((t) => t.status === "reprovado").length;

  const visibleTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === "todos" || t.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      t.codigo.toLowerCase().includes(q) ||
      t.titular.toLowerCase().includes(q) ||
      t.jogo.toLowerCase().includes(q) ||
      t.setor.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col pb-10">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-[#f9f8fe]/95 backdrop-blur-xs border-b border-[#eceaf6] w-full">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#0682c4] to-[#02669c] flex items-center justify-center text-white font-extrabold text-xs shrink-0">
              ADM
            </div>
            <div className="leading-none">
              <span className="text-[10px] font-bold tracking-wider text-[#006c4a] uppercase block">
                PAINEL AUTENTICADO • {adminEmail}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#131b2e] uppercase">
                PULSE PE — VALIDAÇÃO DE ENTRADA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="hidden sm:inline-flex text-xs font-bold text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3.5 py-2 rounded-xl transition-colors"
            >
              Ver App Torcedor
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-extrabold text-[#93000a] bg-[#ffdad6] hover:bg-[#ffc8c2] px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
            >
              Sair (ADM)
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 xl:px-12 pt-6 flex flex-col gap-6">
        {/* KPI Counters */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-[#eceaf6]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
              Total de Bilhetes
            </p>
            <p className="text-2xl font-extrabold text-[#131b2e] mt-1">
              {totalCount}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-[#eceaf6]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#016294]">
              Aguardando Validação
            </p>
            <p className="text-2xl font-extrabold text-[#016294] mt-1">
              {pendingCount}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-[#eceaf6]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#006c4a]">
              Entradas Aprovadas
            </p>
            <p className="text-2xl font-extrabold text-[#006c4a] mt-1">
              {approvedCount}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-[#eceaf6]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#93000a]">
              Entradas Reprovadas
            </p>
            <p className="text-2xl font-extrabold text-[#93000a] mt-1">
              {rejectedCount}
            </p>
          </div>
        </section>

        {actionMessage && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-[#d4f4e4] text-[#005236]"
                : "bg-[#ffdad6] text-[#93000a]"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="underline text-xs cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (5 cols): QR CODE CAMERA SCANNER & APPROVAL CONTROLS */}
          <section className="lg:col-span-5 bg-white rounded-[26px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-[#131b2e]">
                  Scanner de QR Code (Catraca ADM)
                </h2>
                <p className="text-xs text-[#4e5462]">
                  Escaneie o ingresso do torcedor pela câmera ou busque pelo
                  código.
                </p>
              </div>
              {scannerActive && (
                <button
                  type="button"
                  onClick={() => {
                    const next =
                      facingMode === "environment" ? "user" : "environment";
                    setFacingMode(next);
                    void startScanner(next);
                  }}
                  className="text-xs font-bold text-[#016294] bg-[#e6f0f5] px-3 py-1.5 rounded-xl cursor-pointer shrink-0"
                >
                  Inverter
                </button>
              )}
            </div>

            {/* Camera Viewport */}
            <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-[#131b2e] flex items-center justify-center">
              {scannerActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                    <div className="w-48 h-48 border-2 border-[#1bb381] rounded-2xl shadow-[0_0_0_9999px_rgba(19,27,46,0.45)]" />
                  </div>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    {barcodeSupported
                      ? "Aponte a câmera para o QR Code do bilhete"
                      : "Câmera ativa — digite o código abaixo se o navegador não ler automático"}
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-white">
                  <p className="text-sm font-extrabold">
                    Leitor de QR Code Pronto
                  </p>
                  <p className="text-xs text-white/75 mt-1">
                    Ative a câmera para ler o ingresso do torcedor na entrada da
                    arena.
                  </p>
                </div>
              )}
            </div>

            {scannerError && (
              <p className="text-xs font-semibold text-[#93000a] bg-[#ffdad6] rounded-xl p-3">
                {scannerError}
              </p>
            )}

            <div className="flex gap-2.5">
              {!scannerActive ? (
                <button
                  type="button"
                  onClick={() => void startScanner(facingMode)}
                  className="w-full bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl cursor-pointer transition-colors"
                >
                  Abrir Câmera para Escanear QR Code
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="w-full bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#4e5462] font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl cursor-pointer transition-colors"
                >
                  Desligar Câmera
                </button>
              )}
            </div>

            {/* Manual Code Lookup */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lookupCode(manualCode);
              }}
              className="flex gap-2 pt-2 border-t border-[#eceaf6]"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Digite ou cole o código (Ex: PE-416170)"
                className="flex-1 rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs font-mono font-bold text-[#131b2e] outline-none"
              />
              <button
                type="submit"
                className="bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer shrink-0"
              >
                Buscar
              </button>
            </form>

            {/* Selected / Scanned Ticket Review Box */}
            {selectedTicket && (
              <div className="mt-2 rounded-2xl bg-[#f2f3ff] border-2 border-[#016294]/30 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-mono font-extrabold text-[#131b2e]">
                    {selectedTicket.codigo}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                      selectedTicket.status === "aprovado"
                        ? "bg-[#89f5c8] text-[#005236]"
                        : selectedTicket.status === "reprovado"
                          ? "bg-[#ffdad6] text-[#93000a]"
                          : "bg-white text-[#016294]"
                    }`}
                  >
                    {selectedTicket.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-[#4e5462] flex flex-col gap-1">
                  <p className="font-extrabold text-[#131b2e] text-sm">
                    {selectedTicket.jogo}
                  </p>
                  <p>
                    {selectedTicket.estadio} • Portão{" "}
                    <strong>{selectedTicket.portao}</strong> (
                    {selectedTicket.setor})
                  </p>
                  <p>
                    Titular: <strong>{selectedTicket.titular}</strong>
                    {selectedTicket.cpf ? ` • CPF ${selectedTicket.cpf}` : ""}
                  </p>
                  <p>
                    Biometria:{" "}
                    <strong
                      className={
                        selectedTicket.biometriaOk
                          ? "text-[#006c4a]"
                          : "text-[#93000a]"
                      }
                    >
                      {selectedTicket.biometriaOk
                        ? "Verificada ✓"
                        : "Não cadastrada"}
                    </strong>
                  </p>
                  {selectedTicket.motivoReprovacao && (
                    <p className="text-[#93000a] font-bold">
                      Motivo da reprovação: {selectedTicket.motivoReprovacao}
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Motivo caso reprove (opcional)"
                  className="w-full rounded-xl bg-white px-3 py-2 text-xs text-[#131b2e] outline-none border border-[#eceaf6]"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={submittingDecision}
                    onClick={() =>
                      void handleReviewDecision(selectedTicket, "aprovado")
                    }
                    className="bg-[#006c4a] hover:bg-[#00583c] disabled:opacity-60 text-white font-extrabold text-xs uppercase py-3 rounded-xl cursor-pointer transition-colors"
                  >
                    ✓ Aprovar Entrada
                  </button>
                  <button
                    type="button"
                    disabled={submittingDecision}
                    onClick={() =>
                      void handleReviewDecision(selectedTicket, "reprovado")
                    }
                    className="bg-[#93000a] hover:bg-[#7a0008] disabled:opacity-60 text-white font-extrabold text-xs uppercase py-3 rounded-xl cursor-pointer transition-colors"
                  >
                    ✕ Reprovar Entrada
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT COLUMN (7 cols): COMPLETE LIST OF TICKETS */}
          <section className="lg:col-span-7 bg-white rounded-[26px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#131b2e]">
                  Lista de Bilhetes Gerados
                </h2>
                <p className="text-xs text-[#4e5462]">
                  Clique em um bilhete para inspecionar ou aprove/reprove
                  diretamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchTickets()}
                className="self-start sm:self-auto text-xs font-extrabold text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
              >
                {loadingTickets ? "Atualizando..." : "Atualizar Lista"}
              </button>
            </div>

            {/* Search & Status Filters */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por código, titular, partida ou setor..."
                className="flex-1 rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
              />
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { id: "todos", label: "Todos" },
                    { id: "pendente", label: "Pendentes" },
                    { id: "aprovado", label: "Aprovados" },
                    { id: "reprovado", label: "Reprovados" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === f.id
                        ? "bg-[#016294] text-white font-extrabold"
                        : "bg-[#f2f3ff] text-[#4e5462] font-semibold"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tickets List */}
            {visibleTickets.length === 0 ? (
              <div className="py-12 text-center bg-[#faf8ff] rounded-2xl border border-[#eceaf6]">
                <p className="text-sm font-extrabold text-[#131b2e]">
                  Nenhum bilhete encontrado
                </p>
                <p className="text-xs text-[#4e5462] mt-1">
                  Assim que os torcedores gerarem ingressos no app, eles
                  aparecerão automaticamente aqui.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleTickets.map((t) => (
                  <article
                    key={t.codigo}
                    onClick={() => setSelectedTicket(t)}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      selectedTicket?.codigo === t.codigo
                        ? "bg-[#e6f0f5]/60 border-[#016294]"
                        : "bg-[#f2f3ff] border-transparent hover:border-[#d5d8e2]"
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-extrabold text-[#131b2e] bg-white px-2.5 py-0.5 rounded-lg">
                          {t.codigo}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                            t.status === "aprovado"
                              ? "bg-[#89f5c8] text-[#005236]"
                              : t.status === "reprovado"
                                ? "bg-[#ffdad6] text-[#93000a]"
                                : "bg-white text-[#016294]"
                          }`}
                        >
                          {t.status}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.biometriaOk
                              ? "bg-[#d4f4e4] text-[#005236]"
                              : "bg-[#ffdad6] text-[#93000a]"
                          }`}
                        >
                          {t.biometriaOk ? "Biometria OK" : "Sem Biometria"}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-[#131b2e] truncate">
                        {t.jogo} — {t.setor} (Portão {t.portao})
                      </p>
                      <p className="text-xs text-[#4e5462] truncate">
                        Titular: <strong>{t.titular}</strong>
                        {t.cpf ? ` • CPF ${t.cpf}` : ""} • {t.dataHorario}
                      </p>
                      {t.reviewedAt && (
                        <p className="text-[10.5px] text-[#4e5462]">
                          Revisado em{" "}
                          {new Date(t.reviewedAt).toLocaleString("pt-BR")}
                          {t.motivoReprovacao
                            ? ` • Motivo: ${t.motivoReprovacao}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={submittingDecision}
                        onClick={() => void handleReviewDecision(t, "aprovado")}
                        className="bg-[#006c4a] hover:bg-[#00583c] text-white font-extrabold text-[11px] px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={submittingDecision}
                        onClick={() =>
                          void handleReviewDecision(t, "reprovado")
                        }
                        className="bg-[#ffdad6] hover:bg-[#ffc8c2] text-[#93000a] font-extrabold text-[11px] px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      >
                        Reprovar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
