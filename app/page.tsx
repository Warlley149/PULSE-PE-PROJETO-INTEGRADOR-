"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type BiometricProfile,
  formatCPF,
  formatPhone,
  getStoredProfile,
  isValidCPF,
  removeBiometricProfile,
  saveBiometricProfile,
} from "@/app/lib/storage";

export type AppTab = "ingressos" | "biometria" | "notificacoes" | "perfil";
type NotifFilter = "todas" | "acesso" | "partidas" | "clube";

interface PulseAppProps {
  initialTab?: AppTab;
}

export function PulsePeApp({ initialTab = "ingressos" }: PulseAppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [profile, setProfile] = useState<BiometricProfile | null>(null);

  // Camera & Biometric Capture State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<"capture" | "test">("capture");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [testVerified, setTestVerified] = useState<boolean>(false);

  // Registration Modal / Drawer State (for editing Dados Cadastrais + Photo)
  const [showProfileEditor, setShowProfileEditor] = useState<boolean>(false);
  const [nome, setNome] = useState<string>("Camila Araújo");
  const [cpf, setCpf] = useState<string>("");
  const [matricula, setMatricula] = useState<string>("82410");
  const [categoria, setCategoria] = useState<string>(
    "SÓCIO RUBRO-NEGRO • OURO",
  );
  const [email, setEmail] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Notifications state
  const [notifFilter, setNotifFilter] = useState<NotifFilter>("todas");
  const [allRead, setAllRead] = useState<boolean>(false);
  const [alertasPortao, setAlertasPortao] = useState<boolean>(true);
  const [catracaTempoReal, setCatracaTempoReal] = useState<boolean>(true);

  // Digital Card Modal state
  const [showCarteirinhaModal, setShowCarteirinhaModal] =
    useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(
    async (
      mode: "capture" | "test" = "capture",
      facing: "user" | "environment" = facingMode,
    ) => {
      setCameraError(null);
      setTestVerified(false);
      setCameraMode(mode);
      stopCamera();

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "Navegador ou dispositivo sem suporte direto à câmera WebRTC.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1080 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setCameraActive(true);

        window.setTimeout(async () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
              await videoRef.current.play();
            } catch {
              // autoplay handled
            }
          }
        }, 50);
      } catch {
        setCameraError(
          "Permissão da câmera negada ou dispositivo ocupado. Autorize o uso da câmera no navegador.",
        );
        setCameraActive(false);
      }
    },
    [facingMode, stopCamera],
  );

  useEffect(() => {
    const syncState = () => {
      const saved = getStoredProfile();
      if (saved) {
        setProfile(saved);
        setNome(saved.nome);
        setCpf(saved.cpf);
        setMatricula(saved.matricula || "82410");
        setCategoria(saved.categoria || "SÓCIO RUBRO-NEGRO • OURO");
        setEmail(saved.email);
        setTelefone(saved.telefone);
      }
    };

    const timer = window.setTimeout(syncState, 0);
    window.addEventListener("storage", syncState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncState);
      stopCamera();
    };
  }, [stopCamera]);

  const handleSwitchTab = (tab: AppTab) => {
    stopCamera();
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFlipCamera = async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    if (cameraActive) {
      await startCamera(cameraMode, nextFacing);
    }
  };

  const handleCapturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();

    if (cameraMode === "test") {
      setTestVerified(true);
      setStatusToast(
        "Leitura biométrica validada com 99.8% de acurácia no sensor.",
      );
      return;
    }

    const saved = await saveBiometricProfile({
      nome: nome.trim() || "Camila Araújo",
      cpf: cpf.trim() || "000.000.000-00",
      matricula: matricula.trim() || "82410",
      categoria: categoria.trim() || "SÓCIO RUBRO-NEGRO • OURO",
      email: email.trim(),
      telefone: telefone.trim(),
      faceImageDataUrl: dataUrl,
      imageWidth: width,
      imageHeight: height,
    });

    setProfile(saved);
    setStatusToast(
      "Nova biometria facial capturada e armazenada no dispositivo.",
    );
  };

  const handleSaveProfileData = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nome.trim() || nome.trim().length < 3) {
      setFormError("Informe seu nome completo.");
      return;
    }

    if (cpf.trim() && !isValidCPF(cpf)) {
      setFormError("CPF inválido. Verifique os dígitos informados.");
      return;
    }

    const saved = await saveBiometricProfile({
      nome: nome.trim(),
      cpf: cpf.trim() ? formatCPF(cpf) : profile?.cpf || "",
      matricula: matricula.trim() || "82410",
      categoria: categoria.trim() || "SÓCIO RUBRO-NEGRO • OURO",
      email: email.trim(),
      telefone: telefone.trim(),
      faceImageDataUrl: profile?.faceImageDataUrl || "",
      imageWidth: profile?.imageWidth || 720,
      imageHeight: profile?.imageHeight || 720,
    });

    setProfile(saved);
    setShowProfileEditor(false);
    setStatusToast("Dados cadastrais salvos com sucesso.");
  };

  const displayName = profile?.nome || "Camila Araújo";
  const firstName = displayName.split(" ")[0] || "Camila";
  const displayMatricula = (profile?.matricula || "82410").replace(/^#/, "");
  const displayDate = profile?.updatedAt
    ? new Date(profile.updatedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "12/Jan/2025";

  const renderAvatarSvg = () => (
    <svg
      viewBox="0 0 64 64"
      className="w-full h-full rounded-full bg-[#e6dcd2]"
    >
      <rect width="64" height="64" fill="#d8cfc4" />
      <circle cx="32" cy="32" r="30" fill="#e5ddd3" />
      <path
        d="M14 30C14 16 22 10 32 10C42 10 50 16 50 30C50 42 48 54 46 58H18C16 54 14 42 14 30Z"
        fill="#3a2314"
      />
      <path d="M12 64C14 51 22 47 32 47C42 47 50 51 52 64H12Z" fill="#1f2421" />
      <path d="M26 48L32 58L38 48H26Z" fill="#ffffff" />
      <rect x="28" y="40" width="8" height="10" rx="3" fill="#d9a17c" />
      <ellipse cx="32" cy="29" rx="10.5" ry="13" fill="#e8b490" />
      <path
        d="M28.5 34.5Q32 37.5 35.5 34.5"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 34.5Q32 38 36 34.5"
        stroke="#a85844"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="28" cy="27.5" r="1.3" fill="#2b1b12" />
      <circle cx="36" cy="27.5" r="1.3" fill="#2b1b12" />
      <path
        d="M25.5 25Q28 24 30 25"
        stroke="#3a2314"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M34 25Q36 24 38.5 25"
        stroke="#3a2314"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M21 26C22 18 27 14 33 14C39 14 43 19 43 27C44 21 42 12 32 12C22 12 19 20 21 26Z"
        fill="#4a2c18"
      />
    </svg>
  );

  return (
    <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between pb-24 md:pb-12 select-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-[#f9f8fe]/95 backdrop-blur-xs border-b border-[#eceaf6] w-full">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between">
          {/* Left: Brand Logo & Titles */}
          <button
            type="button"
            onClick={() => handleSwitchTab("ingressos")}
            className="flex items-center gap-3 sm:gap-3.5 text-left cursor-pointer"
          >
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
                ILHA DO
                <br className="sm:hidden" />{" "}
                <span className="hidden sm:inline"> </span>RETIRO
              </span>
              <span className="text-[14px] sm:text-[16px] font-extrabold tracking-[0.02em] text-[#131b2e] uppercase mt-0.5">
                PULSE PE
              </span>
            </div>
          </button>

          {/* Center: Desktop Navigation Links (md+) */}
          <nav
            aria-label="Navegação desktop"
            className="hidden md:flex items-center gap-1 lg:gap-2 bg-[#f2f3ff] p-1.5 rounded-2xl"
          >
            <button
              type="button"
              onClick={() => handleSwitchTab("ingressos")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                activeTab === "ingressos"
                  ? "bg-white text-[#016294] font-extrabold shadow-2xs"
                  : "text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold"
              }`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M13 5v2" />
                <path d="M13 17v2" />
                <path d="M13 11v2" />
              </svg>
              <span>Ingressos</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab("biometria")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                activeTab === "biometria"
                  ? "bg-white text-[#016294] font-extrabold shadow-2xs"
                  : "text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold"
              }`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <path d="M2 12a10 10 0 0 1 18-6" />
                <path d="M2 16h.01" />
                <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
              </svg>
              <span>Biometria</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab("notificacoes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                activeTab === "notificacoes"
                  ? "bg-white text-[#016294] font-extrabold shadow-2xs"
                  : "text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold"
              }`}
            >
              <svg
                className="w-4 h-4"
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
              <span>Notificações</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab("perfil")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                activeTab === "perfil"
                  ? "bg-white text-[#016294] font-extrabold shadow-2xs"
                  : "text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold"
              }`}
            >
              <svg
                className="w-4 h-4"
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
              <span>Perfil</span>
            </button>
          </nav>

          {/* Right: Bell & Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => handleSwitchTab("notificacoes")}
              aria-label="Notificações"
              className="relative p-1.5 text-[#2f3648] hover:bg-[#eceaf6]/60 rounded-full transition-colors cursor-pointer"
            >
              <svg
                className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px]"
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
              {!allRead && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#006c4a] ring-2 ring-[#f9f8fe]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab("perfil")}
              aria-label="Perfil"
              className="relative cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] border-2 border-[#006c4a] bg-white overflow-hidden">
                {profile?.faceImageDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.faceImageDataUrl}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  renderAvatarSvg()
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#006c4a] border-2 border-[#f9f8fe]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 md:pt-8 flex flex-col">
        {statusToast && (
          <div className="mb-4 rounded-2xl bg-[#d4f4e4] border border-[#006c4a]/20 px-4 py-3 text-xs font-bold text-[#005236] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[#006c4a] shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{statusToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="text-[11px] underline cursor-pointer shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* =========================================================
            SCREEN 1: INGRESSOS
           ========================================================= */}
        {activeTab === "ingressos" && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight leading-snug">
                  Olá, {firstName}
                </h1>
                <p className="text-[11px] sm:text-xs font-bold text-[#4e5462] uppercase tracking-[0.05em] leading-[1.35] mt-0.5">
                  SÓCIO RUBRO-NEGRO •
                  <br className="sm:hidden" />{" "}
                  <span className="hidden sm:inline"> </span>OURO
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#d4f4e4] px-3 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-[11px] font-extrabold tracking-[0.04em] text-[#006c4a] uppercase shrink-0 shadow-2xs">
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#006c4a] shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>BIOMETRIA VERIFICADA</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 sm:mt-5 mb-3.5 sm:mb-5">
              <svg
                className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-[#016294] shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="M15 8h2" />
                <path d="M15 12h2" />
                <path d="M7 16h10" />
              </svg>
              <span className="text-[11px] sm:text-xs md:text-[13px] font-medium text-[#4e5462] tracking-tight">
                Matrícula #{displayMatricula} • Acesso Facial Homologado SDS-PE
              </span>
            </div>

            {/* Main Match Ticket Card */}
            <section className="bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] pt-4 sm:pt-5 pb-5 sm:pb-7 flex flex-col overflow-hidden">
              <div className="bg-[#f2f3ff] px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <svg
                    className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-[#016294] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="12 7 15.5 9.5 14.2 13.5 9.8 13.5 8.5 9.5 12 7" />
                    <path d="M12 2v5" />
                    <path d="M15.5 9.5L20.5 8" />
                    <path d="M14.2 13.5L17.5 18.5" />
                    <path d="M9.8 13.5L6.5 18.5" />
                    <path d="M8.5 9.5L3.5 8" />
                  </svg>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] text-[#3d4455] leading-[1.25]">
                    <span>CAMPEONATO BRASILEIRO</span>
                    <span>2025</span>
                  </div>
                </div>

                <div className="bg-[#ffdad6] rounded-full px-3.5 sm:px-4 py-1.5 flex flex-col sm:flex-row sm:gap-1 text-[9.5px] sm:text-[11px] font-extrabold uppercase tracking-[0.03em] text-[#93000a] leading-[1.15] shrink-0">
                  <span>PRÓXIMA</span>
                  <span>PARTIDA</span>
                </div>
              </div>

              {/* Teams Matchup Section */}
              <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white border border-[#e5e7eb] shadow-xs flex items-center justify-center shrink-0 p-1 sm:p-1.5">
                    <svg viewBox="0 0 40 40" className="w-full h-full">
                      <circle cx="15" cy="5.5" r="1.3" fill="#d4af37" />
                      <circle cx="20" cy="4.5" r="1.5" fill="#d4af37" />
                      <circle cx="25" cy="5.5" r="1.3" fill="#d4af37" />
                      <path
                        d="M9 9H31V22C31 29.5 20 35 20 35C20 35 9 29.5 9 22V9Z"
                        fill="#1a1a1a"
                        stroke="#d4af37"
                        strokeWidth="1.5"
                      />
                      <path d="M10.5 12H29.5V15.5H10.5V12Z" fill="#c8102e" />
                      <path d="M10.5 19H29.5V22.5H10.5V19Z" fill="#c8102e" />
                      <path
                        d="M12.5 26H27.5C25.5 29.5 20 32.5 20 32.5C20 32.5 14.5 29.5 12.5 26Z"
                        fill="#c8102e"
                      />
                      <circle
                        cx="20"
                        cy="20.5"
                        r="4.8"
                        fill="#1a1a1a"
                        stroke="#d4af37"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M18 22.5L19 18L21 19.5L22.5 17.5L22 22.5H18Z"
                        fill="#d4af37"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14.5px] sm:text-lg md:text-xl font-extrabold text-[#131b2e] leading-tight truncate">
                      Sport Recife
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-bold text-[#016294] uppercase tracking-[0.05em] mt-0.5">
                      MANDANTE
                    </span>
                  </div>
                </div>

                <div className="bg-[#e2e7ff] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center shrink-0 mx-1">
                  <span className="text-[11.5px] sm:text-xs md:text-sm font-extrabold text-[#131b2e] tracking-wide uppercase">
                    VS
                  </span>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="flex flex-col items-end text-right min-w-0">
                    <span className="text-[14.5px] sm:text-lg md:text-xl font-extrabold text-[#131b2e] leading-tight truncate">
                      Ceará SC
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-bold text-[#4e5462] uppercase tracking-[0.05em] mt-0.5">
                      VISITANTE
                    </span>
                  </div>
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white border border-[#e5e7eb] shadow-xs flex items-center justify-center shrink-0 p-1 sm:p-1.5">
                    <svg viewBox="0 0 40 40" className="w-full h-full">
                      <circle cx="14" cy="5.5" r="1.1" fill="#d4af37" />
                      <circle cx="18" cy="4.8" r="1.2" fill="#d4af37" />
                      <circle cx="22" cy="4.8" r="1.2" fill="#d4af37" />
                      <circle cx="26" cy="5.5" r="1.1" fill="#d4af37" />
                      <path
                        d="M9.5 9H30.5V22.5C30.5 29.5 20 35 20 35C20 35 9.5 29.5 9.5 22.5V9Z"
                        fill="#111111"
                        stroke="#111111"
                        strokeWidth="1.5"
                      />
                      <rect
                        x="10.5"
                        y="10"
                        width="19"
                        height="4.5"
                        fill="#111111"
                      />
                      <rect
                        x="12"
                        y="11.5"
                        width="16"
                        height="1.6"
                        rx="0.8"
                        fill="#ffffff"
                      />
                      <path d="M13 15H16V30.5L13 28V15Z" fill="#ffffff" />
                      <path
                        d="M18.5 15H21.5V33.5L18.5 32.5V15Z"
                        fill="#ffffff"
                      />
                      <path d="M24 15H27V28L24 30.5V15Z" fill="#ffffff" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-between my-2 sm:my-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#faf8ff] -ml-2.5 sm:-ml-3 shrink-0" />
                <div className="w-full border-t border-dashed border-[#d5d8e2] mx-1" />
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#faf8ff] -mr-2.5 sm:-mr-3 shrink-0" />
              </div>

              <div className="px-4 sm:px-6 md:px-8 pt-2 sm:pt-3 grid grid-cols-1 min-[340px]:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-[#f2f3ff] rounded-2xl p-3.5 sm:p-4 md:p-5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#4e5462]">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    <span className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-[0.04em]">
                      DATA & HORÁRIO
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-[15px] sm:text-lg font-extrabold text-[#131b2e] leading-tight">
                      Hoje, 20:30
                    </p>
                    <p className="text-[10.5px] sm:text-xs font-bold text-[#006c4a] mt-1">
                      Abertura: 18:30
                    </p>
                  </div>
                </div>

                <div className="bg-[#f2f3ff] rounded-2xl p-3.5 sm:p-4 md:p-5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#4e5462]">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 19v-6a7 7 0 0 1 14 0v6" />
                      <path d="M3 15h18" />
                      <path d="M7 19v2M17 19v2" />
                    </svg>
                    <span className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-[0.04em]">
                      SETOR
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-[15px] sm:text-lg font-extrabold text-[#131b2e] leading-tight">
                      Arquibancada
                    </p>
                    <p className="text-[10.5px] sm:text-xs font-medium text-[#4e5462] mt-1">
                      Setor Sede Central
                    </p>
                  </div>
                </div>

                <div className="bg-[#e6f0f5] rounded-2xl p-3.5 sm:p-4 md:p-5 flex flex-col justify-between min-h-[148px] sm:min-h-[164px]">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#016294]">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
                      <path d="M2 20h20" />
                      <path d="M14 12v.01" />
                    </svg>
                    <span className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-[0.04em] leading-[1.2]">
                      PORTÃO
                      <br className="sm:hidden" />{" "}
                      <span className="hidden sm:inline"> </span>DESIGNADO
                    </span>
                  </div>

                  <div className="my-1.5 sm:my-2">
                    <p className="text-[22px] sm:text-2xl md:text-[26px] font-extrabold text-[#016294] leading-[1.08] tracking-tight">
                      Portão
                      <br className="sm:hidden" />{" "}
                      <span className="hidden sm:inline"> </span>02
                    </p>
                  </div>

                  <p className="text-[10.5px] sm:text-xs font-medium text-[#016294] leading-[1.25]">
                    Rua Sport Club do
                    <br className="sm:hidden" />{" "}
                    <span className="hidden sm:inline"> </span>Recife
                  </p>
                </div>

                <div className="bg-[#f2f3ff] rounded-2xl p-3.5 sm:p-4 md:p-5 flex flex-col justify-between min-h-[148px] sm:min-h-[164px]">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#4e5462]">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                    <span className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-[0.04em]">
                      ACESSO RÁPIDO
                    </span>
                  </div>

                  <div className="my-1.5 sm:my-2">
                    <p className="text-[15.5px] sm:text-xl font-extrabold text-[#131b2e] leading-[1.2]">
                      Catraca
                      <br className="sm:hidden" />{" "}
                      <span className="hidden sm:inline"> </span>Express
                    </p>
                  </div>

                  <p className="text-[10.5px] sm:text-xs font-bold text-[#006c4a] leading-tight">
                    Fila Facial Dedicada
                  </p>
                </div>
              </div>

              <div className="px-4 sm:px-6 md:px-8 mt-4 sm:mt-6">
                <button
                  type="button"
                  onClick={() => handleSwitchTab("biometria")}
                  className="w-full bg-[#016294] hover:bg-[#01537e] active:scale-[0.99] transition-all text-white rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-4 flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <circle cx="12" cy="10" r="2.5" />
                    <path d="M8.5 16.5a4.5 4.5 0 0 1 7 0" />
                  </svg>
                  <span className="text-[11.5px] sm:text-xs md:text-sm font-extrabold uppercase tracking-[0.04em]">
                    ACESSAR PASSE FACIAL DIGITAL
                  </span>
                </button>
              </div>

              <div className="px-6 mt-3.5 sm:mt-4 flex flex-col items-center text-center">
                <p className="text-[10.5px] sm:text-xs text-[#4e5462] leading-[1.35] font-medium flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#006c4a] shrink-0 inline"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>Reconhecimento biométrico 100% automático na</span>
                  </span>
                  <span className="w-full sm:w-auto text-center">catraca.</span>
                </p>
              </div>
            </section>
          </>
        )}

        {/* =========================================================
            SCREEN 2: BIOMETRIA FACIAL (Exact match to left screen in 2nd image)
           ========================================================= */}
        {activeTab === "biometria" && (
          <div className="flex flex-col">
            {/* Top Security Pill */}
            <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#e6f0f5] px-3 py-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#016294]">
              <svg
                className="w-3.5 h-3.5 text-[#016294] shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>ACESSO SEGURO SDS-PE</span>
            </div>

            {/* Title & Description */}
            <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight mt-2.5">
              Biometria Facial
            </h1>
            <p className="text-xs sm:text-sm text-[#4e5462] leading-relaxed mt-1 mb-5">
              Validação e credenciamento oficial para acesso automático por
              reconhecimento nas catracas da Ilha do Retiro.
            </p>

            {/* Main Biometric Card */}
            <section className="bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-4 sm:p-6 flex flex-col">
              {/* Card Top Badge Row */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#89f5c8] px-3 py-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#005236]">
                  <svg
                    className="w-3.5 h-3.5 text-[#005236] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>BIOMETRIA HOMOLOGADA SDS-PE</span>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#006c4a] mr-1" />
              </div>

              {/* Biometric Face Scanner Frame */}
              <div className="relative w-full aspect-4/3 sm:aspect-16/11 rounded-2xl overflow-hidden bg-[#d8dad7] flex items-center justify-center">
                {cameraActive ? (
                  /* LIVE DEVICE CAMERA FEED */
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === "user" ? "-scale-x-100" : ""
                    }`}
                  />
                ) : profile?.faceImageDataUrl ? (
                  /* USER'S REAL CAPTURED CAMERA PHOTO */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.faceImageDataUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  /* HIGH-DEFINITION PORTRAIT WITH YELLOW JERSEY MATCHING REFERENCE */
                  <svg
                    viewBox="0 0 400 320"
                    className="w-full h-full object-cover"
                    preserveAspectRatio="xMidYMid slice"
                  >
                    <defs>
                      <linearGradient id="studioBg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d9dbd8" />
                        <stop offset="100%" stopColor="#c5c8c4" />
                      </linearGradient>
                    </defs>
                    <rect width="400" height="320" fill="url(#studioBg)" />
                    {/* Shoulders / Yellow Brazil/Sport Jersey with Green Collar */}
                    <path
                      d="M45 320C55 245 115 225 200 225C285 225 345 245 355 320H45Z"
                      fill="#eab308"
                    />
                    <path
                      d="M80 250C110 235 145 226 200 226C255 226 290 235 320 250L335 320H65L80 250Z"
                      fill="#facc15"
                    />
                    {/* Green collar trim & shoulder stripes */}
                    <path
                      d="M148 226C165 256 235 256 252 226"
                      fill="none"
                      stroke="#15803d"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M65 268L120 242"
                      stroke="#15803d"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M335 268L280 242"
                      stroke="#15803d"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    {/* Neck */}
                    <rect
                      x="166"
                      y="175"
                      width="68"
                      height="68"
                      rx="24"
                      fill="#c6906a"
                    />
                    {/* Ears */}
                    <ellipse cx="134" cy="128" rx="10" ry="20" fill="#c6906a" />
                    <ellipse cx="266" cy="128" rx="10" ry="20" fill="#c6906a" />
                    {/* Head / Face */}
                    <rect
                      x="138"
                      y="44"
                      width="124"
                      height="158"
                      rx="58"
                      fill="#d49e77"
                    />
                    {/* Short dark hair */}
                    <path
                      d="M138 98C138 52 162 34 200 34C238 34 262 52 262 98C256 72 238 58 200 58C162 58 144 72 138 98Z"
                      fill="#231f1d"
                    />
                    {/* Beard & Mustache */}
                    <path
                      d="M140 135C142 178 166 204 200 204C234 204 258 178 260 135C255 162 236 184 200 184C164 184 145 162 140 135Z"
                      fill="#2a2522"
                      opacity="0.88"
                    />
                    <path
                      d="M174 162Q200 153 226 162"
                      stroke="#231f1d"
                      strokeWidth="7"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M182 168Q200 173 218 168"
                      stroke="#9e5b47"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Eyebrows */}
                    <path
                      d="M158 104Q175 98 188 104"
                      stroke="#231f1d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M212 104Q225 98 242 104"
                      stroke="#231f1d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Eyes */}
                    <ellipse
                      cx="174"
                      cy="116"
                      rx="10"
                      ry="5.5"
                      fill="#ffffff"
                    />
                    <circle cx="174" cy="116" r="4.5" fill="#2b1d14" />
                    <ellipse
                      cx="226"
                      cy="116"
                      rx="10"
                      ry="5.5"
                      fill="#ffffff"
                    />
                    <circle cx="226" cy="116" r="4.5" fill="#2b1d14" />
                    {/* Nose */}
                    <path
                      d="M200 114V144M191 146Q200 151 209 146"
                      stroke="#ad7856"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                )}

                {/* Top Center Pill: 99.8% Acurácia */}
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xs text-[#131b2e] rounded-full px-3.5 py-1 shadow-sm flex items-center gap-1.5 text-[10.5px] sm:text-xs font-extrabold whitespace-nowrap">
                  <svg
                    className="w-3.5 h-3.5 text-[#006c4a] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  </svg>
                  <span>99.8% Acurácia</span>
                </div>

                {/* Green Corner Scanner Brackets */}
                <div className="pointer-events-none absolute inset-4 sm:inset-5">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[2.5px] border-l-[2.5px] border-[#006c4a] rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[2.5px] border-r-[2.5px] border-[#006c4a] rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[2.5px] border-l-[2.5px] border-[#006c4a] rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[2.5px] border-r-[2.5px] border-[#006c4a] rounded-br-xl" />
                  {/* Horizontal Biometric Laser Line */}
                  <div className="absolute top-1/2 inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-[#1bb381] to-transparent shadow-[0_0_10px_#1bb381]" />
                </div>

                {/* Bottom Center Pill: Cadastrada em 12/Jan/2025 */}
                <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-[#131b2e]/80 backdrop-blur-xs text-white rounded-full px-3.5 py-1 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap">
                  {cameraActive
                    ? "Posicione seu rosto na moldura e clique em Confirmar Captura"
                    : `Cadastrada em ${displayDate}`}
                </div>
              </div>

              {cameraError && (
                <div className="mt-3 rounded-xl bg-[#ffdad6] px-3.5 py-2.5 text-xs font-semibold text-[#93000a]">
                  {cameraError}
                </div>
              )}

              {/* Active Camera Controls when Camera is Running */}
              {cameraActive && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="flex-1 bg-[#006c4a] hover:bg-[#00583c] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                    <span>
                      {cameraMode === "test"
                        ? "Validar Leitura Agora"
                        : "Capturar e Salvar Foto"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    className="bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294] font-bold text-xs py-3.5 px-3.5 rounded-xl cursor-pointer transition-colors"
                  >
                    Inverter Câmera
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#4e5462] font-bold text-xs py-3.5 px-3.5 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {testVerified && !cameraActive && (
                <div className="mt-3.5 rounded-xl bg-[#d4f4e4] px-3.5 py-2.5 text-xs font-bold text-[#005236] flex items-center justify-between">
                  <span>
                    ✓ Leitura biométrica testada e aprovada com sucesso!
                  </span>
                  <button
                    type="button"
                    onClick={() => setTestVerified(false)}
                    className="underline text-[11px] cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              )}

              {/* 3 Biometric Validation Metrics Rows */}
              <div className="mt-4 flex flex-col gap-2.5">
                {/* Row 1: LIVENESS CHECK */}
                <div className="bg-[#f2f3ff] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.05em] text-[#4e5462]">
                        LIVENESS CHECK
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Anti-Fraude 3D Validado
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-white border border-[#006c4a]/25 text-[#006c4a] rounded-full px-2.5 py-1 text-[10px] font-extrabold shrink-0">
                    <svg
                      className="w-3 h-3 text-[#006c4a]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    Aprovado
                  </span>
                </div>

                {/* Row 2: CRIPTOGRAFIA */}
                <div className="bg-[#f2f3ff] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="3"
                          y="11"
                          width="18"
                          height="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.05em] text-[#4e5462]">
                        CRIPTOGRAFIA
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        SHA-256 Ponta a Ponta
                      </p>
                    </div>
                  </div>
                  <span className="bg-white text-[#131b2e] rounded-full px-3 py-1 text-[10px] font-extrabold shrink-0 shadow-2xs">
                    Ativa
                  </span>
                </div>

                {/* Row 3: ACESSO ILHA */}
                <div className="bg-[#f2f3ff] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
                        <path d="M2 20h20" />
                        <path d="M14 12v.01" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.05em] text-[#4e5462]">
                        ACESSO ILHA
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Catracas Liberadas
                      </p>
                    </div>
                  </div>
                  <span className="bg-[#89f5c8] text-[#005236] rounded-full px-3 py-1 text-[10px] font-extrabold shrink-0">
                    100% dos Portões
                  </span>
                </div>
              </div>

              {/* Recadastrar Face / Nova Foto Button */}
              <button
                type="button"
                onClick={() => startCamera("capture", facingMode)}
                className="mt-4 w-full bg-[#faf8ff] hover:bg-[#f2f3ff] border border-[#eceaf6] text-[#131b2e] rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-xs font-extrabold transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4 text-[#016294] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <span>Recadastrar Face / Nova Foto</span>
              </button>
            </section>

            {/* Primary CTA: Testar Leitura Biométrica (Simulação) */}
            <button
              type="button"
              onClick={() => startCamera("test", facingMode)}
              className="mt-3.5 w-full bg-[#016294] hover:bg-[#01537e] active:scale-[0.99] transition-all text-white rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-4 flex items-center justify-center gap-2.5 shadow-sm text-xs sm:text-sm font-extrabold cursor-pointer"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <circle cx="12" cy="10" r="2.5" />
                <path d="M8.5 16.5a4.5 4.5 0 0 1 7 0" />
              </svg>
              <span>Testar Leitura Biométrica (Simulação)</span>
            </button>

            {/* Section: Diretrizes para o Acesso Rápido */}
            <div className="mt-7">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-4 h-4 text-[#016294] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
                <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                  Diretrizes para o Acesso Rápido
                </h2>
              </div>

              <div className="flex flex-col gap-2.5">
                {/* Guideline 1 */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed">
                    Iluminação natural e rosto desobstruído{" "}
                    <strong className="font-extrabold text-[#131b2e]">
                      (sem óculos escuros, bonés ou máscaras)
                    </strong>
                    .
                  </p>
                </div>

                {/* Guideline 2 */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed">
                    Mantenha a postura e{" "}
                    <strong className="font-extrabold text-[#131b2e]">
                      olhe diretamente para a lente
                    </strong>{" "}
                    do leitor na altura dos olhos.
                  </p>
                </div>

                {/* Guideline 3 */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3v18" />
                      <path d="m10 7-5 5 5 5" />
                      <path d="M5 12h9" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed">
                    Aproximação recomendada de{" "}
                    <strong className="font-extrabold text-[#131b2e]">
                      1 metro de distância
                    </strong>{" "}
                    para liberação do giro em menos de 0.5s.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Legal & LGPD Box */}
            <div className="mt-5 bg-[#f2f3ff] rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-[#131b2e] mb-1.5">
                <svg
                  className="w-3.5 h-3.5 text-[#016294] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.04em]">
                  CONFORMIDADE LEGAL & LGPD
                </span>
              </div>
              <p className="text-[10.5px] sm:text-xs text-[#4e5462] leading-relaxed">
                Em conformidade integral com a Lei Geral de Proteção de Dados
                (LGPD - Lei 13.709/2018) e diretrizes de segurança da Secretaria
                de Defesa Social de Pernambuco (SDS-PE). Seus pontos de malha
                biométrica são armazenados em token seguro unidirecional.
              </p>
              <div className="mt-3 pt-2.5 border-t border-[#e2e4f0] flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
                <span className="font-bold text-[#4e5462]">
                  Protocolo SDS-2025/PE-8842
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setStatusToast(
                      "Termos de Conformidade LGPD & SDS-PE verificados.",
                    )
                  }
                  className="font-extrabold text-[#016294] underline cursor-pointer"
                >
                  Ver termos completos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 3: NOTIFICAÇÕES (Exact match to center screen in 2nd image)
           ========================================================= */}
        {activeTab === "notificacoes" && (
          <div className="flex flex-col">
            {/* Title & Marcar todas */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight">
                  Notificações
                </h1>
                <p className="text-xs sm:text-sm text-[#4e5462] mt-0.5 leading-snug">
                  Central de comunicados e acessos da
                  <br className="sm:hidden" /> Ilha
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAllRead(true);
                  setStatusToast(
                    "Todas as notificações foram marcadas como lidas.",
                  );
                }}
                className="bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294] rounded-xl px-3 py-2 text-[10.5px] sm:text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 7 17l-5-5" />
                  <path d="m22 10-7.5 7.5L13 16" />
                </svg>
                <span className="leading-tight text-left">
                  Marcar
                  <br className="sm:hidden" /> todas
                </span>
              </button>
            </div>

            {/* Filter Chips */}
            <div className="mt-4 mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: "todas", label: "Todas" },
                { id: "acesso", label: "Acesso & Catraca" },
                { id: "partidas", label: "Partidas" },
                { id: "clube", label: "Clube" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setNotifFilter(chip.id as NotifFilter)}
                  className={`px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    notifFilter === chip.id
                      ? "bg-[#016294] text-white font-extrabold shadow-2xs"
                      : "bg-[#f2f3ff] text-[#4e5462] hover:text-[#131b2e] font-semibold"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Notification Cards List */}
            <div className="flex flex-col gap-3.5">
              {/* Card 1: CATRACA LIBERADA */}
              {(notifFilter === "todas" || notifFilter === "acesso") && (
                <article className="bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)] border-l-[3.5px] border-[#016294]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#89f5c8] px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#005236]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#005236]" />
                        CATRACA LIBERADA
                      </span>
                      <span className="text-[11px] font-medium text-[#4e5462]">
                        Há 15 min
                      </span>
                    </div>
                    {!allRead && (
                      <span className="w-2 h-2 rounded-full bg-[#016294] shrink-0" />
                    )}
                  </div>

                  <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                    Portões Abertos para Sport x Ceará
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed mt-1">
                    Os portões da Ilha do Retiro estão abertos. Dirija-se ao{" "}
                    <strong className="font-extrabold text-[#131b2e]">
                      Portão 02
                    </strong>{" "}
                    para acesso prioritário via biometria facial.
                  </p>

                  <div className="mt-3 bg-[#f2f3ff] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <svg
                        className="w-3.5 h-3.5 text-[#016294] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span className="text-[10.5px] sm:text-xs font-bold text-[#131b2e] truncate">
                        Biometria facial validada no terminal
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchTab("ingressos")}
                      className="text-[10.5px] sm:text-xs font-extrabold text-[#016294] hover:underline shrink-0 cursor-pointer"
                    >
                      Ver mapa
                    </button>
                  </div>
                </article>
              )}

              {/* Card 2: INGRESSO CONFIRMADO */}
              {(notifFilter === "todas" || notifFilter === "partidas") && (
                <article className="bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f0f5] px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#016294]">
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                      </svg>
                      INGRESSO CONFIRMADO
                    </span>
                    <span className="text-[11px] font-medium text-[#4e5462]">
                      Hoje, 14:30
                    </span>
                  </div>

                  <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                    Check-in de Sócio Confirmado
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed mt-1">
                    Sua entrada para o setor{" "}
                    <strong className="font-extrabold text-[#131b2e]">
                      Arquibancada Sede Central
                    </strong>{" "}
                    foi vinculada com sucesso à sua biometria facial.
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#4e5462] font-medium">
                    <svg
                      className="w-3.5 h-3.5 text-[#016294] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Acesso via Rua Abdias de Carvalho • Catraca 14</span>
                  </div>
                </article>
              )}

              {/* Card 3: SEGURANÇA & SDS-PE */}
              {(notifFilter === "todas" || notifFilter === "acesso") && (
                <article className="bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f3ff] px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#016294]">
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      SEGURANÇA & SDS-PE
                    </span>
                    <span className="text-[11px] font-medium text-[#4e5462]">
                      Ontem, 09:20
                    </span>
                  </div>

                  <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e] leading-snug">
                    Validação Biométrica Periódica Concluída
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed mt-1">
                    Sua biometria facial foi sincronizada com os terminais de
                    acesso express com índice de{" "}
                    <strong className="font-extrabold text-[#006c4a]">
                      99.8% de acurácia
                    </strong>
                    .
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#006c4a] font-extrabold">
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>Pronto para o acesso sem filas</span>
                  </div>
                </article>
              )}

              {/* Card 4: ILHA DO RETIRO */}
              {(notifFilter === "todas" ||
                notifFilter === "partidas" ||
                notifFilter === "clube") && (
                <article className="bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#93000a]">
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 11l18-5v12L3 14v-3z" />
                        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                      </svg>
                      ILHA DO RETIRO
                    </span>
                    <span className="text-[11px] font-medium text-[#4e5462]">
                      10/Jan
                    </span>
                  </div>

                  <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                    Operação Especial de Trânsito
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed mt-1">
                    Confira as vias interditadas pela CTTU no entorno da Ilha do
                    Retiro a partir das 17h para a fluidez do clássico.
                  </p>

                  <div className="mt-3 bg-[#f2f3ff] rounded-xl p-2.5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[#dce4f7] shrink-0 overflow-hidden flex items-center justify-center">
                      <svg viewBox="0 0 44 44" className="w-full h-full">
                        <rect width="44" height="44" fill="#e2e8f0" />
                        <path
                          d="M0 14L44 28M12 0L28 44M0 34L44 12"
                          stroke="#ffffff"
                          strokeWidth="3.5"
                        />
                        <path
                          d="M8 0L22 44"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                        />
                        <circle cx="22" cy="21" r="4" fill="#016294" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-[#131b2e]">
                        Esquema CTTU | BPChoque
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusToast(
                            "Mapa de rotas recomendadas CTTU/BPChoque aberto.",
                          )
                        }
                        className="text-[11px] font-extrabold text-[#016294] underline text-left mt-0.5 cursor-pointer"
                      >
                        Ver rotas recomendadas
                      </button>
                    </div>
                  </div>
                </article>
              )}

              {/* Section: Canais de Aviso */}
              <section className="bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)] mt-1">
                <div className="flex items-center gap-3 mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                      Canais de Aviso
                    </h2>
                    <p className="text-[11px] text-[#4e5462]">
                      Personalize seus alertas de acesso
                    </p>
                  </div>
                </div>

                {/* Toggle 1 */}
                <div className="flex items-center justify-between py-2.5 border-b border-[#f2f3ff]">
                  <div>
                    <p className="text-xs sm:text-[13px] font-extrabold text-[#131b2e]">
                      Alertas de Portão (SMS & Push)
                    </p>
                    <p className="text-[11px] text-[#4e5462]">
                      Avisos imediatos ao abrir as catracas
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Alternar Alertas de Portão"
                    onClick={() => setAlertasPortao((v) => !v)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      alertasPortao
                        ? "bg-[#016294] text-white"
                        : "bg-[#e2e7ff] text-transparent"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>

                {/* Toggle 2 */}
                <div className="flex items-center justify-between pt-3">
                  <div>
                    <p className="text-xs sm:text-[13px] font-extrabold text-[#131b2e]">
                      Catraca em Tempo Real
                    </p>
                    <p className="text-[11px] text-[#4e5462]">
                      Confirmação de validação biométrica
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Alternar Catraca em Tempo Real"
                    onClick={() => setCatracaTempoReal((v) => !v)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      catracaTempoReal
                        ? "bg-[#016294] text-white"
                        : "bg-[#e2e7ff] text-transparent"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
              </section>

              {/* Encrypted Footer Note */}
              <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-[#4e5462]">
                <svg
                  className="w-3.5 h-3.5 text-[#006c4a] shrink-0"
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
                <span>
                  Notificações criptografadas com o ecossistema PULSE PE
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 4: PERFIL (Exact match to right screen in 2nd image)
           ========================================================= */}
        {activeTab === "perfil" && (
          <div className="flex flex-col">
            {/* Top Member Header */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2px] border-2 border-[#006c4a] bg-white overflow-hidden shadow-xs">
                  {profile?.faceImageDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profile.faceImageDataUrl}
                      alt={displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    renderAvatarSvg()
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#006c4a] text-white border-2 border-[#faf8ff] flex items-center justify-center">
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="inline-flex items-center gap-1 self-start rounded-full bg-[#fde68a] px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#92400e]">
                  <svg
                    className="w-3 h-3 text-[#d97706]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                  </svg>
                  <span>PLANO OURO</span>
                </div>
                <h1 className="text-lg sm:text-xl font-extrabold text-[#131b2e] truncate mt-1">
                  {displayName}
                </h1>
                <p className="text-[11px] sm:text-xs text-[#4e5462] truncate">
                  Matrícula #{displayMatricula} • Desde Março/2021
                </p>
                <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#016294] mt-0.5">
                  SÓCIO RUBRO-NEGRO
                </p>
              </div>
            </div>

            {/* Homologation Status Strip */}
            <div className="mt-4 bg-[#f2f3ff] rounded-xl px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#006c4a]" />
                <span className="text-xs font-bold text-[#131b2e]">
                  Biometria Facial Homologada
                </span>
              </div>
              <span className="text-xs font-extrabold text-[#006c4a] inline-flex items-center gap-1">
                Ativa
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </div>

            {/* Card: Carteira do Torcedor */}
            <section className="mt-4 bg-white rounded-[24px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)]">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-[#016294] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  <h2 className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                    Carteira do Torcedor
                  </h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                  TEMPORADA 2025
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-3.5">
                <div className="bg-[#f2f3ff] rounded-xl py-2.5 px-2 text-center">
                  <p className="text-base sm:text-lg font-extrabold text-[#131b2e]">
                    6
                  </p>
                  <p className="text-[10px] font-medium text-[#4e5462]">
                    Jogos 2025
                  </p>
                </div>

                <div className="bg-[#f2f3ff] rounded-xl py-2.5 px-2 text-center">
                  <p className="text-base sm:text-lg font-extrabold text-[#131b2e]">
                    100%
                  </p>
                  <p className="text-[10px] font-medium text-[#4e5462]">
                    Presença
                  </p>
                </div>

                <div className="bg-[#f2f3ff] rounded-xl py-2.5 px-2 text-center flex flex-col items-center justify-center">
                  <span className="w-5 h-5 rounded-full bg-[#89f5c8] text-[#005236] flex items-center justify-center">
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <p className="text-[10px] font-bold text-[#006c4a] mt-1">
                    Em Dia
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCarteirinhaModal(true)}
                className="w-full bg-[#016294] hover:bg-[#01537e] text-white rounded-xl py-3 px-4 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
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
                <span>Visualizar Carteirinha Digital</span>
              </button>
            </section>

            {/* Section: DADOS PESSOAIS E VALIDAÇÃO */}
            <div className="mt-6">
              <h3 className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#4e5462] mb-2.5 px-1">
                DADOS PESSOAIS E VALIDAÇÃO
              </h3>

              <div className="flex flex-col gap-2.5">
                {/* Item 1: Dados Cadastrais */}
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(true)}
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <polyline points="16 11 18 13 22 9" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Dados Cadastrais
                      </p>
                      <p className="text-[11px] text-[#4e5462] truncate">
                        CPF, e-mail e telefone verificado
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>

                {/* Item 2: Biometria Facial */}
                <button
                  type="button"
                  onClick={() => handleSwitchTab("biometria")}
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                          Biometria Facial
                        </p>
                        <span className="rounded-full bg-[#89f5c8] px-2 py-0.5 text-[9.5px] font-extrabold text-[#005236]">
                          99.8%
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4e5462] truncate">
                        Foto de acesso biométrico para catracas
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>

                {/* Item 3: Documento de Identificação */}
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(true)}
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="9" cy="10" r="2" />
                        <path d="M15 8h2M15 12h2M7 16h10" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Documento de Identificação
                      </p>
                      <p className="text-[11px] font-bold text-[#006c4a]">
                        Validado pela SDS-PE
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>

                {/* Item 4: Dependentes e Convidados */}
                <button
                  type="button"
                  onClick={() =>
                    setStatusToast("2 sócios dependentes vinculados ao plano.")
                  }
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Dependentes e Convidados
                      </p>
                      <p className="text-[11px] text-[#4e5462]">
                        2 sócios vinculados ao plano
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>
              </div>
            </div>

            {/* Section: PREFERÊNCIAS E SEGURANÇA */}
            <div className="mt-6">
              <h3 className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#4e5462] mb-2.5 px-1">
                PREFERÊNCIAS E SEGURANÇA
              </h3>

              <div className="flex flex-col gap-2.5">
                {/* Item 1: Acessibilidade no Estádio */}
                <button
                  type="button"
                  onClick={() =>
                    setStatusToast(
                      "Preferências de acessibilidade configuradas.",
                    )
                  }
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="5" r="2" />
                        <path d="M10 9h4l1 6h4" />
                        <path d="M10 15a5 5 0 1 0 4 4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Acessibilidade no Estádio
                      </p>
                      <p className="text-[11px] text-[#4e5462] truncate">
                        Acesso preferencial e portões dedicados
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>

                {/* Item 2: Privacidade & LGPD */}
                <button
                  type="button"
                  onClick={() => handleSwitchTab("biometria")}
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Privacidade & LGPD
                      </p>
                      <p className="text-[11px] text-[#4e5462] truncate">
                        Controle de dados e permissões
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>

                {/* Item 3: Avisos e Check-in */}
                <button
                  type="button"
                  onClick={() => handleSwitchTab("notificacoes")}
                  className="w-full bg-white hover:bg-[#fcfbff] rounded-2xl p-3.5 shadow-[0_2px_12px_rgba(19,27,46,0.04)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        Avisos e Check-in
                      </p>
                      <p className="text-[11px] text-[#4e5462] truncate">
                        Push alerts para abertura de ingressos
                      </p>
                    </div>
                  </div>
                  <span className="text-[#4e5462] text-base font-bold shrink-0">
                    ›
                  </span>
                </button>
              </div>
            </div>

            {/* Support & Logout Buttons */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setStatusToast("Canal de atendimento ao Sócio Ilha aberto.")
                }
                className="w-full bg-white hover:bg-[#f2f3ff] text-[#131b2e] rounded-2xl py-3.5 px-4 shadow-[0_2px_12px_rgba(19,27,46,0.04)] font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
                <span>Central de Ajuda & Suporte ao Sócio</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await removeBiometricProfile();
                  setProfile(null);
                  setStatusToast("Sessão encerrada neste dispositivo.");
                }}
                className="w-full bg-[#ffdad6] hover:bg-[#ffc8c2] text-[#93000a] rounded-2xl py-3.5 px-4 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
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
                <span>Sair da Conta</span>
              </button>
            </div>

            {/* Footer App Info */}
            <div className="mt-6 mb-2 text-center flex flex-col items-center gap-0.5">
              <p className="text-[10.5px] font-extrabold text-[#131b2e] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#016294]" />
                <span>PULSE PE TORCEDOR v2.4.0</span>
              </p>
              <p className="text-[10px] text-[#4e5462]">
                Ilha do Retiro • Sport Club do Recife
              </p>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#4e5462] mt-0.5">
                GOVERNO DO ESTADO DE PERNAMBUCO
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Dados Cadastrais Editor */}
      {showProfileEditor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Atualizar Dados Cadastrais
              </h2>
              <button
                type="button"
                onClick={() => setShowProfileEditor(false)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSaveProfileData}
              className="flex flex-col gap-3.5"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@dominio.com"
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhone(e.target.value))}
                    placeholder="(81) 90000-0000"
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs font-semibold text-[#93000a]">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-xs font-bold text-[#4e5462] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#016294] text-xs font-extrabold text-white cursor-pointer"
                >
                  Salvar Dados
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Carteirinha Digital */}
      {showCarteirinhaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#89f5c8] px-3 py-1 text-[10px] font-extrabold uppercase text-[#005236] mb-3">
              <span>CARTEIRA DO TORCEDOR • SDS-PE</span>
            </div>
            <h3 className="text-lg font-extrabold text-[#131b2e]">
              {displayName}
            </h3>
            <p className="text-xs font-bold text-[#016294] mt-0.5">
              Matrícula #{displayMatricula} • PLANO OURO
            </p>
            <div className="my-4 p-4 bg-[#f2f3ff] rounded-2xl flex flex-col items-center">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#006c4a] mb-2">
                {profile?.faceImageDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.faceImageDataUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  renderAvatarSvg()
                )}
              </div>
              <span className="text-[11px] font-extrabold text-[#006c4a]">
                Biometria Facial Homologada (99.8%)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCarteirinhaModal(false)}
              className="w-full bg-[#016294] text-white font-extrabold text-xs py-3 rounded-xl cursor-pointer"
            >
              Fechar Carteirinha
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação principal mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#faf8ff]/95 backdrop-blur-xs border-t border-[#ebe9f5] px-4 py-2.5 grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => handleSwitchTab("ingressos")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "ingressos"
              ? "text-[#016294] font-extrabold"
              : "text-[#4e5462] font-semibold"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={activeTab === "ingressos" ? "2.2" : "1.9"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" />
            <path d="M13 17v2" />
            <path d="M13 11v2" />
          </svg>
          <span className="text-[10.5px] tracking-tight">Ingressos</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab("biometria")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "biometria"
              ? "text-[#016294] font-extrabold"
              : "text-[#4e5462] font-semibold"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={activeTab === "biometria" ? "2.2" : "1.9"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
            <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
            <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
            <path d="M2 12a10 10 0 0 1 18-6" />
            <path d="M2 16h.01" />
            <path d="M21.8 16c.2-2 .131-5.354 0-6" />
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
            <path d="M8.65 22c.21-.66.45-1.32.57-2" />
            <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
          </svg>
          <span className="text-[10.5px] tracking-tight">Biometria</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab("notificacoes")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "notificacoes"
              ? "text-[#016294] font-extrabold"
              : "text-[#4e5462] font-semibold"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={activeTab === "notificacoes" ? "2.2" : "1.9"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="text-[10.5px] tracking-tight">Notificações</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab("perfil")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === "perfil"
              ? "text-[#016294] font-extrabold"
              : "text-[#4e5462] font-semibold"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={activeTab === "perfil" ? "2.2" : "1.9"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
          <span className="text-[10.5px] tracking-tight">Perfil</span>
        </button>
      </nav>
    </div>
  );
}

export default function Page() {
  return <PulsePeApp initialTab="ingressos" />;
}
