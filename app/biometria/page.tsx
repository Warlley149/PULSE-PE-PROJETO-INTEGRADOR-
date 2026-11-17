"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  type BiometricProfile,
  formatCPF,
  formatPhone,
  getStoredProfile,
  isValidCPF,
  removeBiometricProfile,
  saveBiometricProfile,
} from "@/app/lib/storage";

type LightStatus = "idle" | "low" | "good" | "high";

export default function BiometriaPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [existingProfile, setExistingProfile] =
    useState<BiometricProfile | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Camera state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [lightStatus, setLightStatus] = useState<LightStatus>("idle");
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [capturedDimensions, setCapturedDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // Live verification mode (for already registered users)
  const [verifyingLive, setVerifyingLive] = useState<boolean>(false);
  const [verificationSuccess, setVerificationSuccess] =
    useState<boolean>(false);

  // Form fields
  const [nome, setNome] = useState<string>("");
  const [cpf, setCpf] = useState<string>("");
  const [matricula, setMatricula] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLightStatus("idle");
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment" = facingMode) => {
      setCameraError(null);
      stopCamera();

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "O seu navegador ou dispositivo não suporta acesso à câmera.",
        );
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
        setCameraActive(true);
      } catch {
        setCameraError(
          "Permissão de câmera negada ou câmera indisponível. Verifique as permissões do navegador.",
        );
        setCameraActive(false);
      }
    },
    [facingMode, stopCamera],
  );

  // Load stored profile on mount and subscribe to storage changes
  useEffect(() => {
    const syncFromStorage = () => {
      const profile = getStoredProfile();
      if (profile) {
        setExistingProfile(profile);
        setNome(profile.nome);
        setCpf(profile.cpf);
        setMatricula(profile.matricula);
        setCategoria(profile.categoria);
        setEmail(profile.email);
        setTelefone(profile.telefone);
        setCapturedImage(profile.faceImageDataUrl);
        setCapturedDimensions({
          width: profile.imageWidth,
          height: profile.imageHeight,
        });
      } else {
        setIsEditing(true);
      }
    };

    const timer = window.setTimeout(syncFromStorage, 0);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncFromStorage);
      stopCamera();
    };
  }, [stopCamera]);

  // Real-time illumination analysis from video feed
  useEffect(() => {
    if (!cameraActive) return;

    const offscreen = document.createElement("canvas");
    offscreen.width = 64;
    offscreen.height = 64;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });

    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !ctx) return;

      ctx.drawImage(video, 0, 0, 64, 64);
      const frame = ctx.getImageData(0, 0, 64, 64).data;
      let totalLum = 0;
      const pixelCount = frame.length / 4;

      for (let i = 0; i < frame.length; i += 4) {
        totalLum +=
          0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
      }

      const avgLum = totalLum / pixelCount;
      if (avgLum < 45) {
        setLightStatus("low");
      } else if (avgLum > 230) {
        setLightStatus("high");
      } else {
        setLightStatus("good");
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [cameraActive]);

  const handleToggleFacingMode = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (cameraActive) {
      await startCamera(nextMode);
    }
  };

  const handleCaptureFrame = () => {
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
    setCapturedImage(dataUrl);
    setCapturedDimensions({ width, height });
    stopCamera();
    setFormError(null);
  };

  const handleRetake = async () => {
    setCapturedImage("");
    setCapturedDimensions({ width: 0, height: 0 });
    await startCamera(facingMode);
  };

  const handleStartLiveVerification = async () => {
    setVerifyingLive(true);
    setVerificationSuccess(false);
    await startCamera("user");
  };

  const handleConfirmLiveVerification = () => {
    stopCamera();
    setVerificationSuccess(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaveMessage(null);

    if (!capturedImage) {
      setFormError(
        "Capture sua foto facial utilizando a câmera antes de salvar.",
      );
      return;
    }

    if (!nome.trim() || nome.trim().length < 3) {
      setFormError("Informe seu nome completo.");
      return;
    }

    if (!isValidCPF(cpf)) {
      setFormError("Informe um CPF válido.");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveBiometricProfile({
        nome: nome.trim(),
        cpf: formatCPF(cpf),
        matricula: matricula.trim(),
        categoria: categoria.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        faceImageDataUrl: capturedImage,
        imageWidth: capturedDimensions.width,
        imageHeight: capturedDimensions.height,
      });

      setExistingProfile(saved);
      setIsEditing(false);
      setSaveMessage("Biometria facial cadastrada e armazenada com sucesso.");
    } catch {
      setFormError("Erro ao armazenar os dados biométricos.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    stopCamera();
    await removeBiometricProfile();
    setExistingProfile(null);
    setNome("");
    setCpf("");
    setMatricula("");
    setCategoria("");
    setEmail("");
    setTelefone("");
    setCapturedImage("");
    setCapturedDimensions({ width: 0, height: 0 });
    setIsEditing(true);
    setSaveMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between pb-24 md:pb-12">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-[#f9f8fe]/95 backdrop-blur-xs border-b border-[#eceaf6] w-full">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 sm:gap-3.5 hover:opacity-95 transition-opacity"
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
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Navegação desktop"
            className="hidden md:flex items-center gap-1 lg:gap-2 bg-[#f2f3ff] p-1.5 rounded-2xl"
          >
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold text-xs transition-all"
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
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M13 5v2" />
                <path d="M13 17v2" />
                <path d="M13 11v2" />
              </svg>
              <span>Ingressos</span>
            </Link>

            <Link
              href="/biometria"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#016294] font-extrabold text-xs shadow-2xs transition-all"
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
            </Link>
          </nav>

          {/* Back / Status Indicator */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3.5 py-2 rounded-xl transition-colors"
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
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Voltar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight">
              Passe Facial Digital & Biometria
            </h1>
            <p className="text-xs sm:text-sm text-[#4e5462] mt-1">
              Reconhecimento facial via câmera do dispositivo para acesso
              biométrico nas catracas.
            </p>
          </div>

          {existingProfile && !isEditing ? (
            <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-[#d4f4e4] px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.04em] text-[#006c4a] uppercase shrink-0">
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
              <span>BIOMETRIA VERIFICADA</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-[#f2f3ff] px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.04em] text-[#4e5462] uppercase shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#016294]" />
              <span>CAPTURA FACIAL</span>
            </div>
          )}
        </div>

        {saveMessage && (
          <div className="mb-6 rounded-2xl bg-[#d4f4e4] border border-[#006c4a]/20 px-4 py-3.5 text-xs sm:text-sm font-semibold text-[#006c4a] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{saveMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveMessage(null)}
              className="text-xs underline cursor-pointer shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* VIEW 1: Active Passe Facial Digital (when already registered and not editing) */}
        {existingProfile && !isEditing ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Digital Facial Pass Card */}
            <section className="lg:col-span-7 bg-white rounded-[28px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-7 flex flex-col">
              <div className="flex items-center justify-between border-b border-[#eceaf6] pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center">
                    <svg
                      className="w-5 h-5"
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
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e] uppercase tracking-wide">
                      Credencial Biométrica Ativa
                    </h2>
                    <p className="text-[11px] text-[#4e5462]">
                      Acesso Facial Homologado SDS-PE
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#006c4a] bg-[#d4f4e4] px-3 py-1 rounded-full">
                  ATIVO
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Captured Facial Image */}
                <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-2 border-[#006c4a] bg-[#f2f3ff] shrink-0 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingProfile.faceImageDataUrl}
                    alt={`Biometria facial de ${existingProfile.nome}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* User Details */}
                <div className="flex-1 w-full flex flex-col gap-3 text-center sm:text-left">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                      Titular
                    </p>
                    <p className="text-lg sm:text-xl font-extrabold text-[#131b2e]">
                      {existingProfile.nome}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-[#f2f3ff] rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                        CPF
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e] mt-0.5">
                        {existingProfile.cpf}
                      </p>
                    </div>

                    <div className="bg-[#f2f3ff] rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                        Matrícula
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e] mt-0.5">
                        {existingProfile.matricula
                          ? `#${existingProfile.matricula.replace(/^#/, "")}`
                          : "Não informada"}
                      </p>
                    </div>

                    <div className="bg-[#f2f3ff] rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                        Categoria / Vínculo
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e] mt-0.5">
                        {existingProfile.categoria || "Torcedor Cadastrado"}
                      </p>
                    </div>

                    <div className="bg-[#e6f0f5] rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#016294]">
                        Data de Registro
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#016294] mt-0.5">
                        {new Date(existingProfile.updatedAt).toLocaleString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Hash for Backend Verification */}
              {existingProfile.faceHashSha256 && (
                <div className="mt-5 bg-[#f2f3ff] rounded-2xl p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                      Assinatura Biométrica SHA-256 (Pronta para API/Banco)
                    </span>
                    <span className="text-[10px] font-bold text-[#016294]">
                      {existingProfile.imageWidth}×{existingProfile.imageHeight}
                      px
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#131b2e] break-all mt-1">
                    {existingProfile.faceHashSha256}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 pt-4 border-t border-[#eceaf6] flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyingLive(false);
                    setIsEditing(true);
                  }}
                  className="flex-1 bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  Atualizar Biometria ou Dados
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  className="bg-[#ffdad6] hover:bg-[#ffc8c2] text-[#93000a] font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  Excluir Cadastro
                </button>
              </div>
            </section>

            {/* Right Column: Live Camera Verification Test */}
            <section className="lg:col-span-5 bg-white rounded-[28px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-7 flex flex-col">
              <h3 className="text-sm sm:text-base font-extrabold text-[#131b2e] uppercase tracking-wide">
                Validação Facial na Catraca
              </h3>
              <p className="text-xs text-[#4e5462] mt-1">
                Teste o reconhecimento em tempo real com a câmera do seu
                dispositivo.
              </p>

              {!verifyingLive ? (
                <div className="mt-5 flex flex-col items-center justify-center bg-[#f2f3ff] rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center mb-3">
                    <svg
                      className="w-7 h-7"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-[#131b2e]">
                    Inicie a câmera para validar seu rosto com o passe
                    cadastrado.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartLiveVerification}
                    className="mt-4 w-full bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-colors cursor-pointer"
                  >
                    Abrir Câmera para Validar
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col">
                  <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-[#131b2e] flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        facingMode === "user" ? "-scale-x-100" : ""
                      }`}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                      <div className="w-40 h-52 rounded-full border-2 border-dashed border-[#1bb381] shadow-[0_0_0_9999px_rgba(19,27,46,0.45)]" />
                    </div>
                  </div>

                  {verificationSuccess ? (
                    <div className="mt-4 rounded-xl bg-[#d4f4e4] p-3.5 text-xs font-bold text-[#006c4a] text-center">
                      Identidade validada para {existingProfile.nome}. Catraca
                      liberada.
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2.5">
                      <button
                        type="button"
                        onClick={handleConfirmLiveVerification}
                        disabled={!cameraActive || lightStatus === "low"}
                        className="flex-1 bg-[#006c4a] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-4 rounded-xl cursor-pointer"
                      >
                        Confirmar Leitura Facial
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopCamera();
                          setVerifyingLive(false);
                        }}
                        className="bg-[#f2f3ff] text-[#4e5462] font-bold text-xs px-4 py-3 rounded-xl cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* VIEW 2: Camera Capture + User Registration Form */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Camera Capture */}
            <section className="lg:col-span-6 bg-white rounded-[28px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-7 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e] uppercase tracking-wide">
                    1. Captura Facial pela Câmera
                  </h2>
                  <p className="text-xs text-[#4e5462] mt-0.5">
                    Posicione seu rosto centralizado na guia oval.
                  </p>
                </div>

                {cameraActive && (
                  <button
                    type="button"
                    onClick={handleToggleFacingMode}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
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
                      <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
                      <path d="m17 7 3 3 3-3" />
                      <path d="M4 14c0 4.4 3.6 8 8 8s8-3.6 8-8" />
                      <path d="m7 17-3-3-3 3" />
                    </svg>
                    <span>Inverter</span>
                  </button>
                )}
              </div>

              {/* Camera Viewport */}
              <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-[#131b2e] flex items-center justify-center">
                {capturedImage && !cameraActive ? (
                  /* Captured Photo Preview */
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedImage}
                      alt="Rosto capturado pela câmera"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-[#006c4a] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                      Foto Capturada ({capturedDimensions.width}×
                      {capturedDimensions.height})
                    </div>
                  </>
                ) : (
                  /* Live Video Stream */
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        facingMode === "user" ? "-scale-x-100" : ""
                      } ${cameraActive ? "block" : "hidden"}`}
                    />

                    {cameraActive ? (
                      /* Oval Biometric Face Alignment Overlay */
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
                        <div
                          className={`w-44 h-56 sm:w-52 sm:h-64 rounded-full border-2 border-dashed transition-colors ${
                            lightStatus === "good"
                              ? "border-[#1bb381]"
                              : "border-amber-400"
                          } shadow-[0_0_0_9999px_rgba(19,27,46,0.48)]`}
                        />
                        <div className="mt-3 px-3 py-1 rounded-full bg-black/65 text-white text-[11px] font-semibold">
                          {lightStatus === "low" &&
                            "Ambiente escuro — aproxime-se de uma fonte de luz"}
                          {lightStatus === "high" &&
                            "Muita luz direta — ajuste o ângulo"}
                          {lightStatus === "good" &&
                            "Iluminação adequada — pronto para capturar"}
                          {lightStatus === "idle" &&
                            "Analisando imagem da câmera..."}
                        </div>
                      </div>
                    ) : (
                      /* Idle state before opening camera */
                      <div className="flex flex-col items-center justify-center p-6 text-center text-white">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3">
                          <svg
                            className="w-7 h-7 text-[#74b8dc]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
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
                        </div>
                        <p className="text-xs sm:text-sm font-bold">
                          Câmera pronta para captura biométrica
                        </p>
                        <p className="text-[11px] text-white/70 mt-1 max-w-xs">
                          Clique no botão abaixo para autorizar o uso da câmera
                          do seu dispositivo.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {cameraError && (
                <div className="mt-3 rounded-xl bg-[#ffdad6] p-3 text-xs font-semibold text-[#93000a]">
                  {cameraError}
                </div>
              )}

              {/* Camera Action Buttons */}
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                {!cameraActive && !capturedImage && (
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="w-full bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                    <span>Ativar Câmera do Dispositivo</span>
                  </button>
                )}

                {cameraActive && (
                  <>
                    <button
                      type="button"
                      onClick={handleCaptureFrame}
                      className="flex-1 bg-[#006c4a] hover:bg-[#00583c] text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                      <span>Capturar Biometria Facial</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#4e5462] font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-colors cursor-pointer"
                    >
                      Desligar Câmera
                    </button>
                  </>
                )}

                {capturedImage && !cameraActive && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="w-full bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294] font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    <span>Capturar Nova Foto</span>
                  </button>
                )}
              </div>
            </section>

            {/* Right Column: User Data Form */}
            <section className="lg:col-span-6 bg-white rounded-[28px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-7 flex flex-col">
              <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e] uppercase tracking-wide">
                2. Dados do Titular
              </h2>
              <p className="text-xs text-[#4e5462] mt-0.5 mb-5">
                Preencha seus dados reais para vincular à sua biometria facial.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="nome"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#3d4455] mb-1.5"
                  >
                    Nome Completo *
                  </label>
                  <input
                    id="nome"
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cpf"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[#3d4455] mb-1.5"
                    >
                      CPF *
                    </label>
                    <input
                      id="cpf"
                      type="text"
                      inputMode="numeric"
                      required
                      value={cpf}
                      onChange={(e) => setCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="matricula"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[#3d4455] mb-1.5"
                    >
                      Nº de Matrícula (Opcional)
                    </label>
                    <input
                      id="matricula"
                      type="text"
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      placeholder="Informe se possuir"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="categoria"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#3d4455] mb-1.5"
                  >
                    Categoria / Vínculo (Opcional)
                  </label>
                  <input
                    id="categoria"
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Sócio Rubro-Negro • Ouro, Torcedor, etc."
                    className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[#3d4455] mb-1.5"
                    >
                      E-mail (Opcional)
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="telefone"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[#3d4455] mb-1.5"
                    >
                      Telefone (Opcional)
                    </label>
                    <input
                      id="telefone"
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none transition-all"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl bg-[#ffdad6] px-4 py-3 text-xs font-semibold text-[#93000a]">
                    {formError}
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-[#016294] hover:bg-[#01537e] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-4 px-5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    <span>
                      {isSaving
                        ? "Armazenando..."
                        : "Salvar Cadastro Biométrico"}
                    </span>
                  </button>

                  {existingProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setCapturedImage(existingProfile.faceImageDataUrl);
                        setIsEditing(false);
                      }}
                      className="bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#4e5462] font-bold text-xs uppercase tracking-wider py-4 px-5 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação principal mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#faf8ff]/95 backdrop-blur-xs border-t border-[#ebe9f5] px-4 py-2.5 grid grid-cols-4 items-center"
      >
        <Link
          href="/"
          className="flex flex-col items-center justify-center gap-1 text-[#4e5462] hover:text-[#131b2e] transition-colors"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" />
            <path d="M13 17v2" />
            <path d="M13 11v2" />
          </svg>
          <span className="text-[10.5px] font-semibold tracking-tight">
            Ingressos
          </span>
        </Link>

        <Link
          href="/biometria"
          className="flex flex-col items-center justify-center gap-1 text-[#016294]"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
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
          <span className="text-[10.5px] font-extrabold tracking-tight">
            Biometria
          </span>
        </Link>

        <Link
          href="/?tab=notificacoes"
          className="flex flex-col items-center justify-center gap-1 text-[#4e5462] hover:text-[#131b2e] transition-colors"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="text-[10.5px] font-semibold tracking-tight">
            Notificações
          </span>
        </Link>

        <Link
          href="/?tab=perfil"
          className="flex flex-col items-center justify-center gap-1 text-[#4e5462] hover:text-[#131b2e] transition-colors"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
          <span className="text-[10.5px] font-semibold tracking-tight">
            Perfil
          </span>
        </Link>
      </nav>
    </div>
  );
}
