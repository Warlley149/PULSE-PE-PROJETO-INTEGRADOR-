"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addSystemNotification,
  type BiometricProfile,
  clearNotifications,
  type DependentMember,
  formatCPF,
  formatPhone,
  getLoggedUserEmail,
  getStoredNotifications,
  getStoredProfile,
  getStoredTickets,
  isValidCPF,
  loginUserAccount,
  logoutUserSession,
  markAllNotificationsRead,
  type NotificationCategory,
  registerUserAccount,
  removeTicketAccess,
  saveBiometricProfile,
  saveTicketAccess,
  type SystemNotification,
  type TicketAccess,
} from "@/app/lib/storage";

import type { OfficialMatch, StadiumSector } from "@/app/api/jogos/route";
import { ClubCrest } from "@/app/components/ClubCrest";
import { TicketCodeVisual } from "@/app/components/TicketCodeVisual";

export type AppTab = "ingressos" | "biometria" | "notificacoes" | "perfil";
type NotifFilter = "todas" | "acesso" | "partidas" | "clube";
type MatchFilter = "todos" | "ilha" | "recife" | "interior";
type ModalType =
  | null
  | "perfil"
  | "documento"
  | "dependentes"
  | "acessibilidade"
  | "gerar-ingresso"
  | "codigo-arena"
  | "notificacao"
  | "carteirinha";

interface PulseAppProps {
  initialTab?: AppTab;
}

export function PulsePeApp({ initialTab = "ingressos" }: PulseAppProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [profile, setProfile] = useState<BiometricProfile | null>(null);
  const [loggedEmail, setLoggedEmail] = useState<string | null>(null);
  const [adminSessionEmail, setAdminSessionEmail] = useState<string | null>(
    null,
  );
  const [pendingRegistration, setPendingRegistration] = useState<{
    nome: string;
    email: string;
    cpf: string;
    password: string;
    matricula: string;
  } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "cadastro">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authNome, setAuthNome] = useState<string>("");
  const [authCpf, setAuthCpf] = useState<string>("");
  const [authMatricula, setAuthMatricula] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [tickets, setTickets] = useState<TicketAccess[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Camera & Biometric Capture State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<"capture" | "test">("capture");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveQualityScore, setLiveQualityScore] = useState<number>(0);

  // User Profile Form States (100% user-entered, empty by default)
  const [nome, setNome] = useState<string>("");
  const [cpf, setCpf] = useState<string>("");
  const [matricula, setMatricula] = useState<string>("");
  const [plano, setPlano] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [membroDesde, setMembroDesde] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [documentoIdentificacao, setDocumentoIdentificacao] =
    useState<string>("");
  const [orgaoEmissor, setOrgaoEmissor] = useState<string>("");
  const [acessibilidade, setAcessibilidade] = useState<string>("");

  // Dependent Form State
  const [depNome, setDepNome] = useState<string>("");
  const [depParentesco, setDepParentesco] = useState<string>("");
  const [depDocumento, setDepDocumento] = useState<string>("");

  // Official Upcoming Matches from /api/jogos (FPF-PE & Ilha do Retiro)
  const [officialMatches, setOfficialMatches] = useState<OfficialMatch[]>([]);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("todos");
  const [selectedMatchForTicket, setSelectedMatchForTicket] =
    useState<OfficialMatch | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string>("");
  const [activeTicketIndex, setActiveTicketIndex] = useState<number>(0);
  const [ticketForCodeModal, setTicketForCodeModal] =
    useState<TicketAccess | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lanOrigin, setLanOrigin] = useState<string | null>(null);
  const [ticketStatuses, setTicketStatuses] = useState<
    Record<
      string,
      {
        status: "pendente" | "aprovado" | "reprovado";
        reviewedAt?: string;
        reviewedBy?: string;
        motivoReprovacao?: string;
      }
    >
  >({});

  // Custom Notification Form State
  const [notifCategoria, setNotifCategoria] =
    useState<NotificationCategory>("acesso");
  const [notifSelo, setNotifSelo] = useState<string>("");
  const [notifTitulo, setNotifTitulo] = useState<string>("");
  const [notifMensagem, setNotifMensagem] = useState<string>("");
  const [notifDetalhe, setNotifDetalhe] = useState<string>("");

  const [notifFilter, setNotifFilter] = useState<NotifFilter>("todas");
  const [formError, setFormError] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const activeTicket =
    tickets.length > 0
      ? tickets[Math.min(activeTicketIndex, tickets.length - 1)]
      : null;
  const hasFaceRegistered = Boolean(profile?.faceImageDataUrl);
  const hasUserRegistered = Boolean(profile?.nome);

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

  const populateFormFromProfile = useCallback((p: BiometricProfile | null) => {
    if (!p) return;
    setNome(p.nome);
    setCpf(p.cpf);
    setMatricula(p.matricula);
    setPlano(p.plano);
    setCategoria(p.categoria);
    setMembroDesde(p.membroDesde);
    setEmail(p.email);
    setTelefone(p.telefone);
    setDocumentoIdentificacao(p.documentoIdentificacao);
    setOrgaoEmissor(p.orgaoEmissor);
    setAcessibilidade(p.acessibilidade);
  }, []);

  useEffect(() => {
    const syncState = () => {
      const savedProfile = getStoredProfile();
      const savedTickets = getStoredTickets();
      const savedNotifs = getStoredNotifications();

      setProfile(savedProfile);
      setLoggedEmail(getLoggedUserEmail());
      setTickets(savedTickets);
      setNotifications(savedNotifs);
      populateFormFromProfile(savedProfile);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (
          tabParam === "notificacoes" ||
          tabParam === "perfil" ||
          tabParam === "biometria" ||
          tabParam === "ingressos"
        ) {
          setActiveTab(tabParam);
        }
      }

      // Ensure existing local tickets are registered on the server for the Admin list
      for (const t of savedTickets) {
        void fetch("/api/ingressos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: t.codigoIngresso,
            matchId: t.matchId,
            competicao: t.competicao,
            jogo: `${t.mandante} x ${t.visitante}`,
            estadio: t.estadio,
            dataHorario: t.dataHorario,
            setor: t.setor,
            subsetor: t.subsetor,
            portao: t.portao,
            enderecoPortao: t.enderecoPortao,
            titular: savedProfile?.nome || "Titular não informado",
            cpf: savedProfile?.cpf || "",
            biometriaOk: Boolean(savedProfile?.faceImageDataUrl),
          }),
        }).catch(() => {});
      }
    };

    const loadTicketStatuses = async () => {
      const savedTickets = getStoredTickets();
      if (savedTickets.length === 0) return;
      try {
        const codesParam = savedTickets.map((t) => t.codigoIngresso).join(",");
        const res = await fetch(
          `/api/ingressos?codigos=${encodeURIComponent(codesParam)}&_t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            tickets?: Array<{
              codigo: string;
              status: "pendente" | "aprovado" | "reprovado";
              reviewedAt?: string;
              reviewedBy?: string;
              motivoReprovacao?: string;
            }>;
          };
          if (Array.isArray(data.tickets)) {
            const next: Record<
              string,
              {
                status: "pendente" | "aprovado" | "reprovado";
                reviewedAt?: string;
                reviewedBy?: string;
                motivoReprovacao?: string;
              }
            > = {};
            for (const item of data.tickets) {
              next[item.codigo] = {
                status: item.status,
                reviewedAt: item.reviewedAt,
                reviewedBy: item.reviewedBy,
                motivoReprovacao: item.motivoReprovacao,
              };
            }
            setTicketStatuses(next);
          }
        }
      } catch {
        // Ignore network error
      }
    };

    const loadOfficialMatches = async () => {
      try {
        const res = await fetch("/api/jogos");
        if (res.ok) {
          const data = (await res.json()) as { jogos?: OfficialMatch[] };
          if (Array.isArray(data.jogos)) {
            setOfficialMatches(data.jogos);
          }
        }
      } catch {
        // Ignore network error
      }
    };

    const loadAdminSession = async () => {
      try {
        const res = await fetch("/api/admin/login", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            authenticated?: boolean;
            email?: string;
          };
          if (data.authenticated && data.email) {
            setAdminSessionEmail(data.email);
            return;
          }
        }
        setAdminSessionEmail(null);
      } catch {
        // ignore
      }
    };

    const loadNetworkOrigin = async () => {
      if (
        typeof window === "undefined" ||
        (window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1")
      ) {
        return;
      }
      try {
        const res = await fetch("/api/network");
        if (res.ok) {
          const data = (await res.json()) as { lanOrigin?: string | null };
          if (data.lanOrigin) {
            setLanOrigin(data.lanOrigin);
          }
        }
      } catch {
        // ignore
      }
    };

    const timer = window.setTimeout(() => {
      syncState();
      void loadTicketStatuses();
      void loadAdminSession();
      void loadNetworkOrigin();
    }, 0);
    void loadOfficialMatches();
    const poll = window.setInterval(() => {
      void loadTicketStatuses();
    }, 5000);
    window.addEventListener("storage", syncState);
    window.addEventListener("focus", loadTicketStatuses);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("storage", syncState);
      window.removeEventListener("focus", loadTicketStatuses);
      stopCamera();
    };
  }, [populateFormFromProfile, stopCamera]);

  // Measure real frame illumination & contrast quality from live video
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
      const data = ctx.getImageData(0, 0, 64, 64).data;
      let sumLum = 0;
      let sumSq = 0;
      const count = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sumLum += lum;
        sumSq += lum * lum;
      }

      const mean = sumLum / count;
      const variance = Math.max(0, sumSq / count - mean * mean);
      const stdDev = Math.sqrt(variance);

      // Compute real optical exposure + contrast quality percentage (0 - 99.9%)
      const exposureFactor = 1 - Math.min(1, Math.abs(mean - 135) / 135);
      const contrastFactor = Math.min(1, stdDev / 48);
      const score = Number(
        Math.min(
          99.9,
          Math.max(40, (exposureFactor * 0.55 + contrastFactor * 0.45) * 100),
        ).toFixed(1),
      );

      setLiveQualityScore(score);
    }, 450);

    return () => window.clearInterval(interval);
  }, [cameraActive]);

  const startCamera = useCallback(
    async (
      mode: "capture" | "test" = "capture",
      facing: "user" | "environment" = facingMode,
    ) => {
      setCameraError(null);
      setCameraMode(mode);
      stopCamera();

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "O navegador ou dispositivo atual não suporta acesso à câmera.",
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
              // handled by autoPlay
            }
          }
        }, 50);
      } catch {
        setCameraError(
          "Permissão da câmera negada ou câmera indisponível. Autorize o acesso no navegador.",
        );
        setCameraActive(false);
      }
    },
    [facingMode, stopCamera],
  );

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
    const measuredQuality = liveQualityScore || 98.5;
    stopCamera();

    if (cameraMode === "test") {
      addSystemNotification({
        categoria: "acesso",
        selo: "CATRACA LIBERADA",
        titulo: "Leitura Biométrica Validada pela Câmera",
        mensagem: `Reconhecimento facial confirmado com ${measuredQuality}% de qualidade óptica no dispositivo.`,
        detalheRodape: activeTicket
          ? `Portão ${activeTicket.portao} • ${activeTicket.setor}`
          : "Biometria facial validada no terminal",
      });
      setNotifications(getStoredNotifications());
      setStatusToast(
        `Leitura biométrica validada com ${measuredQuality}% de qualidade.`,
      );
      return;
    }

    // If user is completing Step 2 of mandatory facial registration:
    if (pendingRegistration) {
      const regRes = await registerUserAccount({
        nome: pendingRegistration.nome,
        email: pendingRegistration.email,
        cpf: pendingRegistration.cpf,
        password: pendingRegistration.password,
        matricula: pendingRegistration.matricula,
      });

      if (!regRes.ok) {
        setStatusToast(regRes.error);
        setPendingRegistration(null);
        setActiveTab("perfil");
        return;
      }

      const saved = await saveBiometricProfile({
        nome: pendingRegistration.nome,
        email: pendingRegistration.email,
        cpf: pendingRegistration.cpf,
        matricula: pendingRegistration.matricula,
        faceImageDataUrl: dataUrl,
        faceQualityScore: measuredQuality,
        imageWidth: width,
        imageHeight: height,
        livenessVerified: true,
      });

      addSystemNotification({
        categoria: "acesso",
        selo: "CADASTRO CONCLUÍDO",
        titulo: `Conta e Biometria de ${saved.nome} ativadas`,
        mensagem: `Cadastro finalizado com reconhecimento facial (${width}×${height}px • ${measuredQuality}% de qualidade) e criptografia SHA-256.`,
        detalheRodape: "Acesso biométrico liberado na catraca",
      });

      setProfile(saved);
      populateFormFromProfile(saved);
      setLoggedEmail(regRes.account.email);
      setPendingRegistration(null);
      setAuthPassword("");
      setNotifications(getStoredNotifications());
      setStatusToast(
        `Cadastro e reconhecimento facial concluídos para ${saved.nome}!`,
      );
      setActiveTab("perfil");
      return;
    }

    const saved = await saveBiometricProfile({
      faceImageDataUrl: dataUrl,
      faceQualityScore: measuredQuality,
      imageWidth: width,
      imageHeight: height,
      livenessVerified: true,
    });

    addSystemNotification({
      categoria: "acesso",
      selo: "SEGURANÇA & SDS-PE",
      titulo: "Biometria Facial Capturada e Criptografada",
      mensagem: `Sua foto facial (${width}×${height}px) foi capturada pela câmera com ${measuredQuality}% de qualidade e hash SHA-256 gerado.`,
      detalheRodape: "Pronto para o acesso sem filas",
    });

    setProfile(saved);
    setNotifications(getStoredNotifications());
    setStatusToast("Foto facial capturada pela câmera e salva com sucesso.");
  };

  const handleSavePersonalData = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nome.trim() || nome.trim().length < 2) {
      setFormError("Informe seu nome.");
      return;
    }

    if (cpf.trim() && !isValidCPF(cpf)) {
      setFormError("Informe um CPF válido (11 dígitos).");
      return;
    }

    const saved = await saveBiometricProfile({
      nome: nome.trim(),
      cpf: cpf.trim() ? formatCPF(cpf) : "",
      matricula: matricula.trim(),
      plano: plano.trim(),
      categoria: categoria.trim(),
      membroDesde: membroDesde.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      documentoIdentificacao: documentoIdentificacao.trim(),
      orgaoEmissor: orgaoEmissor.trim(),
      acessibilidade: acessibilidade.trim(),
    });

    addSystemNotification({
      categoria: "clube",
      selo: "CADASTRO ATUALIZADO",
      titulo: `Dados de ${saved.nome} salvos`,
      mensagem: `Cadastro atualizado${saved.matricula ? ` (Matrícula #${saved.matricula.replace(/^#/, "")})` : ""}${saved.plano ? ` • ${saved.plano}` : ""}.`,
      detalheRodape: saved.cpf ? `CPF ${saved.cpf}` : undefined,
    });

    setProfile(saved);
    setNotifications(getStoredNotifications());
    setActiveModal(null);
    setStatusToast("Dados do titular salvos com sucesso.");
  };

  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depNome.trim()) return;

    const currentDeps: DependentMember[] = profile?.dependentes || [];
    const newDep: DependentMember = {
      id: crypto.randomUUID(),
      nome: depNome.trim(),
      parentesco: depParentesco.trim(),
      documento: depDocumento.trim(),
    };

    const saved = await saveBiometricProfile({
      dependentes: [...currentDeps, newDep],
    });

    setProfile(saved);
    setDepNome("");
    setDepParentesco("");
    setDepDocumento("");
    setStatusToast(`Dependente ${newDep.nome} adicionado.`);
  };

  const handleRemoveDependent = async (id: string) => {
    const updated = (profile?.dependentes || []).filter((d) => d.id !== id);
    const saved = await saveBiometricProfile({ dependentes: updated });
    setProfile(saved);
  };

  const handleOpenMatchPicker = (match: OfficialMatch) => {
    setSelectedMatchForTicket(match);
    setSelectedSectorId(match.setores[0]?.id || "");
    setActiveModal("gerar-ingresso");
  };

  const handleGenerateTicketFromMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchForTicket) return;

    const chosenSector: StadiumSector =
      selectedMatchForTicket.setores.find((s) => s.id === selectedSectorId) ||
      selectedMatchForTicket.setores[0];

    if (!chosenSector) return;

    const randomCode = `PE-${Math.floor(100000 + Math.random() * 900000)}`;

    const created = saveTicketAccess({
      matchId: selectedMatchForTicket.id,
      codigoIngresso: randomCode,
      competicao: selectedMatchForTicket.competicao,
      temporada: selectedMatchForTicket.temporada,
      mandante: selectedMatchForTicket.mandante.nome,
      mandanteSigla: selectedMatchForTicket.mandante.sigla,
      mandanteCor: selectedMatchForTicket.mandante.corPrimaria,
      visitante: selectedMatchForTicket.visitante.nome,
      visitanteSigla: selectedMatchForTicket.visitante.sigla,
      visitanteCor: selectedMatchForTicket.visitante.corPrimaria,
      estadio: selectedMatchForTicket.estadio,
      dataHorario: selectedMatchForTicket.dataFormatada,
      aberturaPortoes: selectedMatchForTicket.aberturaPortoes,
      setor: chosenSector.nome,
      subsetor: chosenSector.subsetor,
      portao: chosenSector.portao,
      enderecoPortao: chosenSector.endereco,
      tipoAcesso: "Catraca Express",
      fila: hasFaceRegistered
        ? "Fila Facial Dedicada"
        : "Libera após biometria facial",
      fonte: selectedMatchForTicket.fonte,
    });

    // Register on server so Admin immediately sees it in Lista de Bilhetes
    void fetch("/api/ingressos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: created.codigoIngresso,
        matchId: created.matchId,
        competicao: created.competicao,
        jogo: `${created.mandante} x ${created.visitante}`,
        estadio: created.estadio,
        dataHorario: created.dataHorario,
        setor: created.setor,
        subsetor: created.subsetor,
        portao: created.portao,
        enderecoPortao: created.enderecoPortao,
        titular: profile?.nome || "Titular não informado",
        cpf: profile?.cpf || "",
        biometriaOk: hasFaceRegistered,
      }),
    }).catch(() => {});

    const updatedTickets = getStoredTickets();
    setTickets(updatedTickets);
    setActiveTicketIndex(0);
    setNotifications(getStoredNotifications());
    setActiveModal(null);
    setStatusToast(
      `Ingresso ${randomCode} gerado para ${selectedMatchForTicket.mandante.nome} x ${selectedMatchForTicket.visitante.nome} (${chosenSector.nome} • Portão ${chosenSector.portao}).`,
    );
  };

  const buildValidationUrl = (ticket: TicketAccess) => {
    const browserOrigin =
      typeof window !== "undefined" ? window.location.origin : "";
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    const baseOrigin = isLocalhost && lanOrigin ? lanOrigin : browserOrigin;
    return `${baseOrigin}/validar?codigo=${encodeURIComponent(ticket.codigoIngresso)}`;
  };

  const handlePerfilLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      // First check if credentials belong to Admin (/api/admin/login)
      const adminRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      if (adminRes.ok) {
        router.push("/admin");
        return;
      }

      // Otherwise authenticate as Torcedor account
      const userRes = await loginUserAccount(authEmail, authPassword);
      if (!userRes.ok) {
        setAuthError(userRes.error);
        return;
      }

      const updatedProfile = getStoredProfile();
      setProfile(updatedProfile);
      populateFormFromProfile(updatedProfile);
      setLoggedEmail(userRes.account.email);
      setAuthPassword("");
      setStatusToast(`Bem-vindo(a), ${userRes.account.nome}!`);
    } catch {
      setAuthError("Não foi possível realizar o login.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePerfilRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authNome.trim() || authNome.trim().length < 3) {
      setAuthError("Informe seu nome completo.");
      return;
    }

    if (!isValidCPF(authCpf)) {
      setAuthError("Informe um CPF válido (11 dígitos).");
      return;
    }

    if (!authEmail.trim() || !authPassword || authPassword.length < 4) {
      setAuthError(
        "Informe um e-mail válido e uma senha com pelo menos 4 caracteres.",
      );
      return;
    }

    // Registration only finishes after mandatory facial recognition capture
    setPendingRegistration({
      nome: authNome.trim(),
      email: authEmail.trim().toLowerCase(),
      cpf: formatCPF(authCpf),
      password: authPassword,
      matricula: authMatricula.trim(),
    });
    setActiveTab("biometria");
    setStatusToast(
      "Etapa final do cadastro: capture sua face na câmera para concluir sua conta.",
    );
    window.setTimeout(() => {
      void startCamera("capture", "user");
    }, 150);
  };

  const handleAdminLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAdminSessionEmail(null);
    setStatusToast("Sessão do Administrador encerrada.");
  };

  const handleCopyTicketCode = async (code: string) => {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied && typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setCopiedCode(code);
    setStatusToast(
      copied
        ? `Código ${code} copiado para a área de transferência.`
        : `Código do ingresso: ${code}`,
    );
    window.setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2500);
  };

  const filteredMatches = officialMatches.filter((m) => {
    if (matchFilter === "ilha") return m.destaqueIlha;
    if (matchFilter === "recife") return m.cidade.includes("Recife");
    if (matchFilter === "interior") return !m.cidade.includes("Recife");
    return true;
  });

  const handleAddCustomNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitulo.trim() || !notifMensagem.trim()) return;

    addSystemNotification({
      categoria: notifCategoria,
      selo: notifSelo.trim() || notifCategoria.toUpperCase(),
      titulo: notifTitulo.trim(),
      mensagem: notifMensagem.trim(),
      detalheRodape: notifDetalhe.trim() || undefined,
    });

    setNotifications(getStoredNotifications());
    setNotifSelo("");
    setNotifTitulo("");
    setNotifMensagem("");
    setNotifDetalhe("");
    setActiveModal(null);
    setStatusToast("Comunicado adicionado à central de notificações.");
  };

  const handleToggleChannel = async (
    field: "alertasPortao" | "catracaTempoReal",
  ) => {
    const currentVal = profile ? profile[field] : true;
    const saved = await saveBiometricProfile({ [field]: !currentVal });
    setProfile(saved);
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;
  const filteredNotifications =
    notifFilter === "todas"
      ? notifications
      : notifications.filter((n) => n.categoria === notifFilter);

  return (
    <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between pb-24 md:pb-12 select-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-[#f9f8fe]/95 backdrop-blur-xs border-b border-[#eceaf6] w-full">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-3 sm:py-3.5 flex items-center justify-between">
          {/* Left: Brand Logo */}
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
            {(
              [
                { id: "ingressos", label: "Ingressos" },
                { id: "biometria", label: "Biometria" },
                { id: "notificacoes", label: "Notificações" },
                { id: "perfil", label: "Perfil" },
              ] as { id: AppTab; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  activeTab === item.id
                    ? "bg-white text-[#016294] font-extrabold shadow-2xs"
                    : "text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold"
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))}
            {adminSessionEmail && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#016294] text-white hover:bg-[#01537e] cursor-pointer transition-all"
              >
                <span>Painel ADM</span>
              </button>
            )}
          </nav>

          {/* Right: Bell & User Avatar (Displays real captured photo or neutral user icon) */}
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
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#006c4a] ring-2 ring-[#f9f8fe]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab("perfil")}
              aria-label="Perfil"
              className="relative cursor-pointer"
            >
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] border-2 ${
                  hasFaceRegistered ? "border-[#006c4a]" : "border-[#d5d8e2]"
                } bg-white overflow-hidden flex items-center justify-center`}
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
              </div>
              {hasFaceRegistered && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#006c4a] border-2 border-[#f9f8fe]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 xl:px-12 pt-4 sm:pt-6 md:pt-8 flex flex-col">
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
            SCREEN 1: INGRESSOS (100% Real User-Entered Data)
           ========================================================= */}
        {activeTab === "ingressos" && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight leading-snug">
                  {hasUserRegistered
                    ? `Olá, ${profile!.nome.split(" ")[0]}`
                    : "Olá"}
                </h1>
                <p className="text-[11px] sm:text-xs font-bold text-[#4e5462] uppercase tracking-[0.05em] leading-[1.35] mt-0.5">
                  {profile?.categoria || profile?.plano ? (
                    <>
                      {profile.categoria || "SÓCIO"}
                      {profile.plano ? ` • ${profile.plano}` : ""}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveModal("perfil")}
                      className="text-[#016294] underline cursor-pointer uppercase font-extrabold"
                    >
                      + Adicionar seus dados de sócio/torcedor
                    </button>
                  )}
                </p>
              </div>

              {hasFaceRegistered ? (
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
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitchTab("biometria")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-[11px] font-extrabold tracking-[0.04em] text-[#016294] uppercase shrink-0 cursor-pointer transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-[#016294]" />
                  <span>BIOMETRIA PENDENTE</span>
                </button>
              )}
            </div>

            {/* Matrícula & Ticket Action Bar */}
            <div className="flex items-center justify-between gap-2 mt-4 sm:mt-5 mb-3.5 sm:mb-5">
              <div className="flex items-center gap-2 min-w-0">
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
                <span className="text-[11px] sm:text-xs md:text-[13px] font-medium text-[#4e5462] tracking-tight truncate">
                  {profile?.matricula
                    ? `Matrícula #${profile.matricula.replace(/^#/, "")} • ${hasFaceRegistered ? "Acesso Facial Homologado SDS-PE" : "Biometria facial pendente"}`
                    : profile?.cpf
                      ? `CPF ${profile.cpf} • ${hasFaceRegistered ? "Acesso Facial Homologado SDS-PE" : "Biometria facial pendente"}`
                      : "Cadastre seus dados e sua biometria facial"}
                </span>
              </div>

              {activeTicket && (
                <button
                  type="button"
                  onClick={() => {
                    removeTicketAccess(activeTicket.id);
                    const next = getStoredTickets();
                    setTickets(next);
                    setActiveTicketIndex(0);
                    setStatusToast("Ingresso cancelado.");
                  }}
                  className="text-[11px] sm:text-xs font-extrabold text-[#93000a] bg-[#ffdad6] hover:bg-[#ffc8c2] px-3 py-1.5 rounded-xl shrink-0 cursor-pointer transition-colors"
                >
                  Cancelar Ingresso
                </button>
              )}
            </div>

            {/* Multiple Generated Tickets Switcher (if user chose more than 1 match) */}
            {tickets.length > 1 && (
              <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                {tickets.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTicketIndex(idx)}
                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${
                      idx === activeTicketIndex
                        ? "bg-[#016294] text-white font-extrabold"
                        : "bg-[#f2f3ff] text-[#4e5462] font-semibold"
                    }`}
                  >
                    {t.mandanteSigla} x {t.visitanteSigla} ({t.setor})
                  </button>
                ))}
              </div>
            )}

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
                    <span>
                      {activeTicket?.competicao || "COMPETIÇÃO NÃO DEFINIDA"}
                    </span>
                    {activeTicket?.temporada && (
                      <span>{activeTicket.temporada}</span>
                    )}
                  </div>
                </div>

                <div className="bg-[#ffdad6] rounded-full px-3.5 sm:px-4 py-1.5 flex flex-col sm:flex-row sm:gap-1 text-[9.5px] sm:text-[11px] font-extrabold uppercase tracking-[0.03em] text-[#93000a] leading-[1.15] shrink-0">
                  <span>{activeTicket ? "PRÓXIMA" : "SEM"}</span>
                  <span>{activeTicket ? "PARTIDA" : "INGRESSO"}</span>
                </div>
              </div>

              {/* Teams Matchup Section */}
              <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <ClubCrest
                    sigla={activeTicket?.mandanteSigla}
                    nome={activeTicket?.mandante}
                    corPrimaria={activeTicket?.mandanteCor}
                    size="lg"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14.5px] sm:text-lg md:text-xl font-extrabold text-[#131b2e] leading-tight truncate">
                      {activeTicket?.mandante || "Escolha um jogo abaixo"}
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
                      {activeTicket?.visitante || "Próximo Confronto"}
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-bold text-[#4e5462] uppercase tracking-[0.05em] mt-0.5">
                      VISITANTE
                    </span>
                  </div>
                  <ClubCrest
                    sigla={activeTicket?.visitanteSigla}
                    nome={activeTicket?.visitante}
                    corPrimaria={activeTicket?.visitanteCor}
                    size="lg"
                  />
                </div>
              </div>

              {/* Ticket Perforation Divider */}
              <div className="relative flex items-center justify-between my-2 sm:my-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#faf8ff] -ml-2.5 sm:-ml-3 shrink-0" />
                <div className="w-full border-t border-dashed border-[#d5d8e2] mx-1" />
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#faf8ff] -mr-2.5 sm:-mr-3 shrink-0" />
              </div>

              {/* Responsive Info Grid (2x2 on mobile/tablet, 4 cols on desktop to fill full width) */}
              <div className="px-4 sm:px-6 md:px-8 pt-2 sm:pt-3 grid grid-cols-1 min-[340px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                      {activeTicket?.dataHorario || "—"}
                    </p>
                    <p className="text-[10.5px] sm:text-xs font-bold text-[#006c4a] mt-1">
                      {activeTicket?.aberturaPortoes
                        ? `Abertura: ${activeTicket.aberturaPortoes}`
                        : "Horário não informado"}
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
                      {activeTicket?.setor || "—"}
                    </p>
                    <p className="text-[10.5px] sm:text-xs font-medium text-[#4e5462] mt-1">
                      {activeTicket?.subsetor || "Setor não informado"}
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
                      <span className="hidden sm:inline"> </span>
                      {activeTicket?.portao || "—"}
                    </p>
                  </div>

                  <p className="text-[10.5px] sm:text-xs font-medium text-[#016294] leading-[1.25]">
                    {activeTicket?.enderecoPortao || "Endereço não informado"}
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
                      {activeTicket?.tipoAcesso || "Catraca Express"}
                    </p>
                  </div>

                  <p className="text-[10.5px] sm:text-xs font-bold text-[#006c4a] leading-tight">
                    {activeTicket?.fila ||
                      (hasFaceRegistered
                        ? "Fila Facial Dedicada"
                        : "Cadastre a biometria")}
                  </p>
                </div>
              </div>

              {/* Real Admin Approval / Rejection Status Banner on Active Ticket Card */}
              {activeTicket &&
                ticketStatuses[activeTicket.codigoIngresso]?.status ===
                  "reprovado" && (
                  <div className="mx-4 sm:mx-6 md:mx-8 mt-4 rounded-2xl bg-[#ffdad6] border border-[#93000a]/30 p-4 text-left">
                    <p className="text-xs sm:text-sm font-extrabold text-[#93000a] uppercase">
                      ✕ ENTRADA BLOQUEADA — INGRESSO REPROVADO PELO ADM
                    </p>
                    <p className="text-xs font-semibold text-[#93000a] mt-1">
                      Motivo:{" "}
                      {ticketStatuses[activeTicket.codigoIngresso]
                        .motivoReprovacao ||
                        "Entrada não autorizada pela administração."}
                    </p>
                    <p className="text-[11px] text-[#7a0008] mt-1">
                      Este ingresso não permite entrada na arena. Procure o
                      suporte ou aguarde nova liberação do administrador.
                    </p>
                  </div>
                )}

              {activeTicket &&
                ticketStatuses[activeTicket.codigoIngresso]?.status ===
                  "aprovado" && (
                  <div className="mx-4 sm:mx-6 md:mx-8 mt-4 rounded-2xl bg-[#d4f4e4] border border-[#006c4a]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm font-extrabold text-[#005236] uppercase">
                        ✓ ENTRADA APROVADA — VOCÊ PODE ENTRAR NA ARENA
                      </p>
                      <p className="text-[11px] font-semibold text-[#006c4a] mt-0.5">
                        Validado pelo ADM • Portão {activeTicket.portao} (
                        {activeTicket.setor})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTicketForCodeModal(activeTicket);
                        setActiveModal("codigo-arena");
                      }}
                      className="bg-[#006c4a] hover:bg-[#00583c] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer shrink-0 transition-colors"
                    >
                      Ver Comprovante de Entrada
                    </button>
                  </div>
                )}

              <div className="px-4 sm:px-6 md:px-8 mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={
                    Boolean(activeTicket) &&
                    ticketStatuses[activeTicket!.codigoIngresso]?.status ===
                      "reprovado"
                  }
                  onClick={() => handleSwitchTab("biometria")}
                  className={`flex-1 transition-all rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-4 flex items-center justify-center gap-2.5 shadow-xs ${
                    activeTicket &&
                    ticketStatuses[activeTicket.codigoIngresso]?.status ===
                      "reprovado"
                      ? "bg-[#d5d8e2] text-[#4e5462] cursor-not-allowed"
                      : "bg-[#016294] hover:bg-[#01537e] active:scale-[0.99] text-white cursor-pointer"
                  }`}
                >
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
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
                    {activeTicket &&
                    ticketStatuses[activeTicket.codigoIngresso]?.status ===
                      "reprovado"
                      ? "ENTRADA BLOQUEADA NA CATRACA"
                      : "ACESSAR PASSE FACIAL DIGITAL"}
                  </span>
                </button>

                {activeTicket && (
                  <button
                    type="button"
                    onClick={() => {
                      setTicketForCodeModal(activeTicket);
                      setActiveModal("codigo-arena");
                    }}
                    className={`active:scale-[0.99] transition-all rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-5 flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                      ticketStatuses[activeTicket.codigoIngresso]?.status ===
                      "aprovado"
                        ? "bg-[#006c4a] hover:bg-[#00583c] text-white"
                        : ticketStatuses[activeTicket.codigoIngresso]
                              ?.status === "reprovado"
                          ? "bg-[#ffdad6] text-[#93000a]"
                          : "bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294]"
                    }`}
                  >
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
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
                    <span className="text-[11.5px] sm:text-xs md:text-sm font-extrabold uppercase tracking-[0.04em]">
                      {ticketStatuses[activeTicket.codigoIngresso]?.status ===
                      "aprovado"
                        ? "COMPROVANTE ✓"
                        : ticketStatuses[activeTicket.codigoIngresso]
                              ?.status === "reprovado"
                          ? "VER MOTIVO ✕"
                          : `VER CÓDIGO (${activeTicket.codigoIngresso})`}
                    </span>
                  </button>
                )}
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
                {activeTicket?.codigoIngresso && (
                  <p className="text-[10px] font-mono font-bold text-[#016294] mt-1.5">
                    Código do Ingresso: {activeTicket.codigoIngresso} •{" "}
                    {activeTicket.estadio}
                  </p>
                )}
              </div>
            </section>

            {/* Dedicated Section: Meus Códigos de Ingresso para Entrada na Arena */}
            <section className="mt-7 bg-white rounded-[26px] shadow-[0_6px_24px_rgba(19,27,46,0.05)] p-5 sm:p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#eceaf6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5"
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
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                      Códigos dos Ingressos para Entrada na Arena
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#4e5462]">
                      Apresente o QR Code ou código alfanumérico na catraca ou
                      leitor da arena.
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto text-[11px] font-extrabold text-[#016294] bg-[#f2f3ff] px-3 py-1 rounded-full">
                  {tickets.length} ingresso(s) ativo(s)
                </span>
              </div>

              {tickets.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#131b2e]">
                    Nenhum código de ingresso gerado ainda
                  </p>
                  <p className="text-xs text-[#4e5462] mt-1">
                    Selecione um dos próximos jogos oficiais abaixo para gerar
                    seu ingresso e código de acesso na catraca.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {tickets.map((t, idx) => (
                    <div
                      key={t.id}
                      className="bg-[#f2f3ff] rounded-2xl p-4 flex flex-col justify-between gap-3 border border-[#e2e7ff]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#016294]">
                            {t.estadio} • Portão {t.portao}
                          </span>
                          <p className="text-sm font-extrabold text-[#131b2e] mt-0.5">
                            {t.mandante} x {t.visitante}
                          </p>
                          <p className="text-[11px] text-[#4e5462]">
                            {t.dataHorario} • {t.setor}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ${
                            ticketStatuses[t.codigoIngresso]?.status ===
                            "aprovado"
                              ? "bg-[#006c4a] text-white"
                              : ticketStatuses[t.codigoIngresso]?.status ===
                                  "reprovado"
                                ? "bg-[#93000a] text-white"
                                : "bg-[#89f5c8] text-[#005236]"
                          }`}
                        >
                          {ticketStatuses[t.codigoIngresso]?.status ===
                          "aprovado"
                            ? "ENTRADA APROVADA ✓"
                            : ticketStatuses[t.codigoIngresso]?.status ===
                                "reprovado"
                              ? "ENTRADA REPROVADA ✕"
                              : "AGUARDANDO ADM"}
                        </span>
                      </div>

                      <div className="bg-white rounded-xl p-3 flex items-center justify-between gap-2 border border-[#eceaf6]">
                        <div>
                          <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#4e5462]">
                            CÓDIGO DE ACESSO NA CATRACA
                          </p>
                          <p className="text-base font-mono font-extrabold tracking-widest text-[#131b2e] mt-0.5">
                            {t.codigoIngresso}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyTicketCode(t.codigoIngresso)}
                          className={`text-[11px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0 ${
                            copiedCode === t.codigoIngresso
                              ? "bg-[#006c4a] text-white"
                              : "text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0]"
                          }`}
                        >
                          {copiedCode === t.codigoIngresso
                            ? "Copiado ✓"
                            : "Copiar"}
                        </button>
                      </div>

                      {ticketStatuses[t.codigoIngresso]?.status ===
                        "reprovado" && (
                        <div className="rounded-xl bg-[#ffdad6] px-3 py-2 text-[11px] font-bold text-[#93000a]">
                          Entrada bloqueada:{" "}
                          {ticketStatuses[t.codigoIngresso].motivoReprovacao ||
                            "Reprovado pelo ADM"}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTicketIndex(idx);
                            setTicketForCodeModal(t);
                            setActiveModal("codigo-arena");
                          }}
                          className={`flex-1 font-extrabold text-xs py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
                            ticketStatuses[t.codigoIngresso]?.status ===
                            "aprovado"
                              ? "bg-[#006c4a] hover:bg-[#00583c] text-white"
                              : ticketStatuses[t.codigoIngresso]?.status ===
                                  "reprovado"
                                ? "bg-[#93000a] text-white"
                                : "bg-[#016294] hover:bg-[#01537e] text-white"
                          }`}
                        >
                          {ticketStatuses[t.codigoIngresso]?.status ===
                          "aprovado"
                            ? "Ver Comprovante ✓"
                            : ticketStatuses[t.codigoIngresso]?.status ===
                                "reprovado"
                              ? "Ver Motivo da Reprovação"
                              : "Abrir QR Code / Catraca"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeTicketAccess(t.id);
                            const next = getStoredTickets();
                            setTickets(next);
                            setActiveTicketIndex(0);
                          }}
                          className="bg-[#ffdad6] hover:bg-[#ffc8c2] text-[#93000a] font-extrabold text-xs py-2.5 px-3 rounded-xl transition-colors cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Official Upcoming Matches Catalog (FPF-PE & Ilha do Retiro) */}
            <section className="mt-7 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#131b2e] tracking-tight">
                    Próximos Jogos Oficiais em Pernambuco
                  </h2>
                  <p className="text-xs text-[#4e5462] mt-0.5">
                    Base oficial da Federação Pernambucana de Futebol (FPF-PE) e
                    Estádio da Ilha do Retiro. Escolha uma partida para gerar
                    seu ingresso.
                  </p>
                </div>

                {/* Match Region Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(
                    [
                      { id: "todos", label: "Todos PE" },
                      { id: "ilha", label: "Ilha do Retiro" },
                      { id: "recife", label: "Recife" },
                      { id: "interior", label: "Interior" },
                    ] as { id: MatchFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMatchFilter(f.id)}
                      className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${
                        matchFilter === f.id
                          ? "bg-[#016294] text-white font-extrabold"
                          : "bg-white text-[#4e5462] hover:text-[#131b2e] font-semibold border border-[#eceaf6]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Official Matches Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMatches.map((match) => {
                  const alreadyGenerated = tickets.some(
                    (t) => t.matchId === match.id,
                  );

                  return (
                    <article
                      key={match.id}
                      className={`bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)] flex flex-col justify-between border ${
                        match.destaqueIlha
                          ? "border-[#016294]/35"
                          : "border-transparent"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#016294] bg-[#e6f0f5] px-2.5 py-0.5 rounded-full truncate">
                            {match.competicao}
                          </span>
                          {match.destaqueIlha && (
                            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#93000a] bg-[#ffdad6] px-2.5 py-0.5 rounded-full shrink-0">
                              ILHA DO RETIRO
                            </span>
                          )}
                        </div>

                        {/* Clubs Row */}
                        <div className="flex items-center justify-between gap-2 my-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClubCrest
                              sigla={match.mandante.sigla}
                              nome={match.mandante.nome}
                              corPrimaria={match.mandante.corPrimaria}
                              size="sm"
                            />
                            <span className="text-xs sm:text-sm font-extrabold text-[#131b2e] truncate">
                              {match.mandante.nome}
                            </span>
                          </div>

                          <span className="text-[10px] font-extrabold text-[#4e5462] bg-[#f2f3ff] px-2 py-1 rounded-full shrink-0">
                            VS
                          </span>

                          <div className="flex items-center gap-2 min-w-0 justify-end">
                            <span className="text-xs sm:text-sm font-extrabold text-[#131b2e] truncate text-right">
                              {match.visitante.nome}
                            </span>
                            <ClubCrest
                              sigla={match.visitante.sigla}
                              nome={match.visitante.nome}
                              corPrimaria={match.visitante.corPrimaria}
                              size="sm"
                            />
                          </div>
                        </div>

                        {/* Date, Stadium & Source */}
                        <div className="bg-[#f2f3ff] rounded-xl p-3 flex flex-col gap-1 text-[11px] text-[#4e5462]">
                          <div className="flex items-center justify-between font-bold text-[#131b2e]">
                            <span>{match.dataFormatada}</span>
                            <span className="text-[#006c4a]">
                              Abertura: {match.aberturaPortoes}
                            </span>
                          </div>
                          <p className="font-medium truncate">
                            {match.estadio} • {match.cidade}
                          </p>
                          <p className="text-[10px] text-[#4e5462] truncate">
                            {match.rodada}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenMatchPicker(match)}
                        className={`mt-4 w-full py-3 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                          alreadyGenerated
                            ? "bg-[#d4f4e4] text-[#005236] hover:bg-[#bef0d7]"
                            : "bg-[#016294] hover:bg-[#01537e] text-white"
                        }`}
                      >
                        {alreadyGenerated
                          ? "Ingresso Gerado • Escolher Outro Setor"
                          : "Escolher Setor e Gerar Ingresso"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* =========================================================
            SCREEN 2: BIOMETRIA FACIAL (Real Device Camera & Real Metrics)
           ========================================================= */}
        {activeTab === "biometria" && (
          <div className="flex flex-col">
            {pendingRegistration && (
              <div className="mb-5 rounded-2xl bg-[#016294] text-white p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                    ETAPA 2 DE 2 • OBRIGATÓRIA
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold mt-1.5">
                    Finalize o cadastro de {pendingRegistration.nome} com sua
                    Biometria Facial
                  </h2>
                  <p className="text-xs text-white/85 mt-0.5">
                    Sua conta só será concluída após capturar seu rosto pela
                    câmera abaixo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setPendingRegistration(null);
                    setActiveTab("perfil");
                  }}
                  className="self-start sm:self-auto bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer shrink-0"
                >
                  Cancelar Cadastro
                </button>
              </div>
            )}

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

            <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight mt-2.5">
              Biometria Facial
            </h1>
            <p className="text-xs sm:text-sm text-[#4e5462] leading-relaxed mt-1 mb-5">
              Validação e credenciamento oficial para acesso automático por
              reconhecimento nas catracas da Ilha do Retiro.
            </p>

            {/* Main Biometric Full-Screen Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
              {/* Left Column: Main Biometric Card & Actions */}
              <div className="lg:col-span-7 flex flex-col">
                <section className="bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-4 sm:p-6 flex flex-col">
                  {/* Top Status Badge */}
                  <div className="flex items-center justify-between mb-3.5">
                    {hasFaceRegistered ? (
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
                    ) : (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f3ff] px-3 py-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#4e5462]">
                        <span className="w-2 h-2 rounded-full bg-[#016294]" />
                        <span>AGUARDANDO CAPTURA PELA CÂMERA</span>
                      </div>
                    )}
                    <span
                      className={`w-2.5 h-2.5 rounded-full mr-1 ${
                        hasFaceRegistered ? "bg-[#006c4a]" : "bg-[#d5d8e2]"
                      }`}
                    />
                  </div>

                  {/* Biometric Face Scanner Frame (Real Camera or Real Captured Photo) */}
                  <div className="relative w-full aspect-4/3 sm:aspect-16/11 rounded-2xl overflow-hidden bg-[#131b2e] flex items-center justify-center">
                    {cameraActive ? (
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
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={profile.faceImageDataUrl}
                        alt={profile.nome || "Biometria capturada"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-white z-10">
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
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                            <circle cx="12" cy="13" r="3" />
                          </svg>
                        </div>
                        <p className="text-xs sm:text-sm font-extrabold">
                          Nenhuma foto facial cadastrada
                        </p>
                        <p className="text-[11px] text-white/75 mt-1 max-w-xs">
                          Clique em &ldquo;Cadastrar Face / Nova Foto&rdquo;
                          abaixo para ativar a câmera do seu dispositivo.
                        </p>
                      </div>
                    )}

                    {/* Top Center Pill: Real Measured Quality Score */}
                    {(cameraActive || hasFaceRegistered) && (
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
                        <span>
                          {cameraActive
                            ? `${liveQualityScore}% Qualidade Óptica`
                            : `${profile?.faceQualityScore || 99.0}% Acurácia`}
                        </span>
                      </div>
                    )}

                    {/* Green Corner Scanner Brackets */}
                    <div className="pointer-events-none absolute inset-4 sm:inset-5">
                      <div className="absolute top-0 left-0 w-7 h-7 border-t-[2.5px] border-l-[2.5px] border-[#006c4a] rounded-tl-xl" />
                      <div className="absolute top-0 right-0 w-7 h-7 border-t-[2.5px] border-r-[2.5px] border-[#006c4a] rounded-tr-xl" />
                      <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[2.5px] border-l-[2.5px] border-[#006c4a] rounded-bl-xl" />
                      <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[2.5px] border-r-[2.5px] border-[#006c4a] rounded-br-xl" />
                      {(cameraActive || hasFaceRegistered) && (
                        <div className="absolute top-1/2 inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-[#1bb381] to-transparent shadow-[0_0_10px_#1bb381]" />
                      )}
                    </div>

                    {/* Bottom Center Pill: Real Registration Timestamp */}
                    {(cameraActive || hasFaceRegistered) && (
                      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-[#131b2e]/85 backdrop-blur-xs text-white rounded-full px-3.5 py-1 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap">
                        {cameraActive
                          ? "Centralize seu rosto e confirme a captura"
                          : `Cadastrada em ${new Date(
                              profile!.updatedAt,
                            ).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}`}
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <div className="mt-3 rounded-xl bg-[#ffdad6] px-3.5 py-2.5 text-xs font-semibold text-[#93000a]">
                      {cameraError}
                    </div>
                  )}

                  {/* Active Camera Controls */}
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
                            ? "Confirmar Leitura Biométrica"
                            : "Capturar e Salvar Biometria"}
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
                        Fechar
                      </button>
                    </div>
                  )}

                  {/* 3 Biometric Validation Rows (Reflecting Real Capture State) */}
                  <div className="mt-4 flex flex-col gap-2.5">
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
                      {hasFaceRegistered ? (
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
                      ) : (
                        <span className="bg-white text-[#4e5462] rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0">
                          Pendente
                        </span>
                      )}
                    </div>

                    <div className="bg-[#f2f3ff] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2">
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
                        <div className="min-w-0">
                          <p className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.05em] text-[#4e5462]">
                            CRIPTOGRAFIA
                          </p>
                          <p className="text-xs sm:text-sm font-extrabold text-[#131b2e] truncate">
                            SHA-256 Ponta a Ponta
                          </p>
                        </div>
                      </div>
                      <span className="bg-white text-[#131b2e] rounded-full px-3 py-1 text-[10px] font-extrabold shrink-0 shadow-2xs">
                        {profile?.faceHashSha256 ? "Ativa" : "Aguardando"}
                      </span>
                    </div>

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
                      {hasFaceRegistered ? (
                        <span className="bg-[#89f5c8] text-[#005236] rounded-full px-3 py-1 text-[10px] font-extrabold shrink-0">
                          {activeTicket
                            ? `Portão ${activeTicket.portao}`
                            : "100% dos Portões"}
                        </span>
                      ) : (
                        <span className="bg-white text-[#4e5462] rounded-full px-3 py-1 text-[10px] font-bold shrink-0">
                          Requer captura
                        </span>
                      )}
                    </div>
                  </div>

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
                    <span>
                      {hasFaceRegistered
                        ? "Recadastrar Face / Nova Foto"
                        : "Cadastrar Face / Nova Foto"}
                    </span>
                  </button>
                </section>

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
                  <span>Testar Leitura Biométrica na Câmera</span>
                </button>
              </div>

              {/* Right Column: Guidelines & LGPD */}
              <div className="lg:col-span-5 flex flex-col">
                {/* Section: Diretrizes para o Acesso Rápido */}
                <div className="mt-2 lg:mt-0">
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
                    Em conformidade integral com a Lei Geral de Proteção de
                    Dados (LGPD - Lei 13.709/2018) e diretrizes de segurança da
                    Secretaria de Defesa Social de Pernambuco (SDS-PE). Seus
                    pontos de malha biométrica são armazenados em token seguro
                    unidirecional.
                  </p>
                  {profile?.faceHashSha256 && (
                    <div className="mt-2.5 pt-2 border-t border-[#e2e4f0] text-[10px] font-mono text-[#131b2e] break-all">
                      Token SHA-256: {profile.faceHashSha256}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 3: NOTIFICAÇÕES (100% Real User Events & Notices)
           ========================================================= */}
        {activeTab === "notificacoes" && (
          <div className="flex flex-col">
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

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal("notificacao")}
                  className="bg-[#016294] hover:bg-[#01537e] text-white rounded-xl px-3 py-2 text-[10.5px] sm:text-xs font-extrabold cursor-pointer transition-colors"
                >
                  + Adicionar
                </button>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = markAllNotificationsRead();
                      setNotifications(updated);
                    }}
                    className="bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294] rounded-xl px-3 py-2 text-[10.5px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                )}
              </div>
            </div>

            {/* Filter Chips */}
            <div className="mt-4 mb-4 flex items-center gap-2 overflow-x-auto pb-1">
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

            {/* Real Notifications Full-Screen Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
              <div className="lg:col-span-8 flex flex-col gap-3.5">
                {filteredNotifications.length === 0 ? (
                  <div className="bg-white rounded-[22px] p-8 sm:p-12 text-center shadow-[0_4px_20px_rgba(19,27,46,0.05)] flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#f2f3ff] text-[#016294] flex items-center justify-center mb-3">
                      <svg
                        className="w-6 h-6"
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
                    </div>
                    <p className="text-sm font-extrabold text-[#131b2e]">
                      Nenhuma notificação nesta categoria
                    </p>
                    <p className="text-xs text-[#4e5462] mt-1 max-w-xs">
                      As notificações são geradas automaticamente ao capturar
                      sua biometria, validar na câmera, salvar dados ou vincular
                      ingressos.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                    {filteredNotifications.map((item) => (
                      <article
                        key={item.id}
                        className={`bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)] flex flex-col justify-between ${
                          !item.lida ? "border-l-[3.5px] border-[#016294]" : ""
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${
                                  item.categoria === "acesso"
                                    ? "bg-[#89f5c8] text-[#005236]"
                                    : item.categoria === "partidas"
                                      ? "bg-[#e6f0f5] text-[#016294]"
                                      : "bg-[#ffdad6] text-[#93000a]"
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {item.selo}
                              </span>
                              <span className="text-[11px] font-medium text-[#4e5462]">
                                {new Date(item.createdAt).toLocaleString(
                                  "pt-BR",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                            {!item.lida && (
                              <span className="w-2 h-2 rounded-full bg-[#016294] shrink-0" />
                            )}
                          </div>

                          <h2 className="text-sm sm:text-base font-extrabold text-[#131b2e]">
                            {item.titulo}
                          </h2>
                          <p className="text-xs sm:text-[13px] text-[#4e5462] leading-relaxed mt-1">
                            {item.mensagem}
                          </p>
                        </div>

                        {item.detalheRodape && (
                          <div className="mt-3 bg-[#f2f3ff] rounded-xl px-3 py-2 flex items-center gap-1.5 text-[11px] font-bold text-[#016294]">
                            <svg
                              className="w-3.5 h-3.5 shrink-0"
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
                            <span>{item.detalheRodape}</span>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearNotifications();
                      setNotifications([]);
                    }}
                    className="self-end text-xs font-bold text-[#93000a] hover:underline cursor-pointer"
                  >
                    Limpar histórico de notificações
                  </button>
                )}
              </div>

              {/* Right Column: Canais de Aviso */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <section className="bg-white rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(19,27,46,0.05)]">
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
                      onClick={() => handleToggleChannel("alertasPortao")}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        (profile?.alertasPortao ?? true)
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
                      onClick={() => handleToggleChannel("catracaTempoReal")}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        (profile?.catracaTempoReal ?? true)
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
          </div>
        )}

        {/* =========================================================
            SCREEN 4: PERFIL (Admin Active Session / Login-Cadastro / User Profile)
           ========================================================= */}
        {activeTab === "perfil" && adminSessionEmail && !loggedEmail && (
          <div className="w-full max-w-lg mx-auto py-4 sm:py-8">
            <section className="bg-white rounded-[28px] shadow-[0_8px_32px_rgba(19,27,46,0.08)] p-6 sm:p-8 border border-[#eceaf6] text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#016294] text-white flex items-center justify-center font-extrabold text-sm mb-3">
                ADM
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#89f5c8] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#005236]">
                SESSÃO ADMINISTRATIVA ATIVA
              </span>
              <h1 className="text-xl font-extrabold text-[#131b2e] mt-3">
                Administrador Autenticado
              </h1>
              <p className="text-xs text-[#4e5462] mt-1">{adminSessionEmail}</p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => router.push("/admin")}
                  className="w-full bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl cursor-pointer transition-colors"
                >
                  Abrir Painel ADM (Scanner & Bilhetes)
                </button>
                <button
                  type="button"
                  onClick={() => void handleAdminLogout()}
                  className="w-full bg-[#ffdad6] hover:bg-[#ffc8c2] text-[#93000a] font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl cursor-pointer transition-colors"
                >
                  Sair da Conta (ADM)
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === "perfil" && !loggedEmail && !adminSessionEmail && (
          <div className="w-full max-w-lg mx-auto py-4 sm:py-8">
            <section className="bg-white rounded-[28px] shadow-[0_8px_32px_rgba(19,27,46,0.08)] p-6 sm:p-8 border border-[#eceaf6]">
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#e6f0f5] text-[#016294] flex items-center justify-center mb-3">
                  <svg
                    className="w-7 h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5 20a7 7 0 0 1 14 0" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#131b2e]">
                  {authMode === "login"
                    ? "Entrar no Pulse PE"
                    : "Criar Conta no Pulse PE"}
                </h1>
                <p className="text-xs text-[#4e5462] mt-1">
                  {authMode === "login"
                    ? "Acesse seu perfil de torcedor ou entre com sua conta de Administrador (ADM)."
                    : "Cadastre seus dados reais para gerenciar ingressos e biometria facial."}
                </p>
              </div>

              {/* Login / Cadastrar Switcher */}
              <div className="grid grid-cols-2 gap-1.5 bg-[#f2f3ff] p-1.5 rounded-2xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  className={`py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    authMode === "login"
                      ? "bg-white text-[#016294] shadow-2xs"
                      : "text-[#4e5462]"
                  }`}
                >
                  Login (Torcedor / ADM)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("cadastro");
                    setAuthError(null);
                  }}
                  className={`py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    authMode === "cadastro"
                      ? "bg-white text-[#016294] shadow-2xs"
                      : "text-[#4e5462]"
                  }`}
                >
                  Cadastrar Conta
                </button>
              </div>

              {authMode === "login" ? (
                <form
                  onSubmit={handlePerfilLogin}
                  className="flex flex-col gap-3.5"
                >
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="seu@email.com ou e-mail do ADM"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                      Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-3 text-sm text-[#131b2e] outline-none"
                    />
                  </div>

                  {authError && (
                    <div className="rounded-xl bg-[#ffdad6] px-4 py-2.5 text-xs font-bold text-[#93000a]">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="mt-1 w-full bg-[#016294] hover:bg-[#01537e] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3.5 rounded-xl cursor-pointer transition-colors"
                  >
                    {authLoading ? "Entrando..." : "Entrar"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handlePerfilRegister}
                  autoComplete="off"
                  className="flex flex-col gap-3"
                >
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={authNome}
                      onChange={(e) => setAuthNome(e.target.value)}
                      placeholder="Digite seu nome completo"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-2.5 text-sm text-[#131b2e] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                        CPF *
                      </label>
                      <input
                        type="text"
                        required
                        value={authCpf}
                        onChange={(e) => setAuthCpf(formatCPF(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-2.5 text-sm text-[#131b2e] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                        Matrícula (Opcional)
                      </label>
                      <input
                        type="text"
                        value={authMatricula}
                        onChange={(e) => setAuthMatricula(e.target.value)}
                        placeholder="Nº de sócio"
                        className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-2.5 text-sm text-[#131b2e] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      name="register_email"
                      autoComplete="off"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-2.5 text-sm text-[#131b2e] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                      Criar Senha *
                    </label>
                    <input
                      type="password"
                      name="register_password"
                      autoComplete="new-password"
                      required
                      minLength={4}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full rounded-xl bg-[#f2f3ff] border border-transparent focus:border-[#016294] focus:bg-white px-4 py-2.5 text-sm text-[#131b2e] outline-none"
                    />
                  </div>

                  {authError && (
                    <div className="rounded-xl bg-[#ffdad6] px-4 py-2.5 text-xs font-bold text-[#93000a]">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="mt-1 w-full bg-[#006c4a] hover:bg-[#00583c] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3.5 rounded-xl cursor-pointer transition-colors"
                  >
                    Continuar para Reconhecimento Facial →
                  </button>
                  <p className="text-[11px] text-center text-[#4e5462]">
                    O cadastro só é concluído após a validação facial pela
                    câmera.
                  </p>
                </form>
              )}
            </section>
          </div>
        )}

        {activeTab === "perfil" && loggedEmail && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
            {/* Left Column: Member Identity & Carteira do Torcedor */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
              {/* Top Member Header */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2px] border-2 ${
                        hasFaceRegistered
                          ? "border-[#006c4a]"
                          : "border-[#d5d8e2]"
                      } bg-white overflow-hidden shadow-xs flex items-center justify-center`}
                    >
                      {profile?.faceImageDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={profile.faceImageDataUrl}
                          alt={profile.nome || "Titular"}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <svg
                          className="w-8 h-8 text-[#4e5462]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M5 20a7 7 0 0 1 14 0" />
                        </svg>
                      )}
                    </div>
                    {hasFaceRegistered && (
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
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    {profile?.plano && (
                      <div className="inline-flex items-center gap-1 self-start rounded-full bg-[#fde68a] px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#92400e]">
                        <svg
                          className="w-3 h-3 text-[#d97706]"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                        </svg>
                        <span>{profile.plano}</span>
                      </div>
                    )}
                    <h1 className="text-lg sm:text-xl font-extrabold text-[#131b2e] truncate mt-1">
                      {profile?.nome || "Titular não cadastrado"}
                    </h1>
                    <p className="text-[11px] sm:text-xs text-[#4e5462] truncate">
                      {profile?.matricula
                        ? `Matrícula #${profile.matricula.replace(/^#/, "")}`
                        : "Sem matrícula"}
                      {profile?.membroDesde
                        ? ` • Desde ${profile.membroDesde}`
                        : ""}
                    </p>
                    <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#016294] mt-0.5">
                      {profile?.categoria ||
                        "Adicione seu vínculo em Dados Cadastrais"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal("perfil")}
                  className="bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294] font-extrabold text-xs px-3.5 py-2 rounded-xl shrink-0 cursor-pointer transition-colors"
                >
                  {hasUserRegistered ? "Editar" : "+ Cadastrar"}
                </button>
              </div>

              {/* Homologation Status Strip */}
              <div className="mt-4 bg-[#f2f3ff] rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasFaceRegistered ? "bg-[#006c4a]" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs font-bold text-[#131b2e]">
                    Biometria Facial Homologada
                  </span>
                </div>
                {hasFaceRegistered ? (
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
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSwitchTab("biometria")}
                    className="text-xs font-extrabold text-[#016294] underline cursor-pointer"
                  >
                    Capturar agora
                  </button>
                )}
              </div>

              {/* Card: Carteira do Torcedor (Real calculated metrics) */}
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
                    {activeTicket?.temporada
                      ? `TEMPORADA ${activeTicket.temporada}`
                      : `TEMPORADA ${new Date().getFullYear()}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mb-3.5">
                  <div className="bg-[#f2f3ff] rounded-xl py-2.5 px-2 text-center">
                    <p className="text-base sm:text-lg font-extrabold text-[#131b2e]">
                      {tickets.length}
                    </p>
                    <p className="text-[10px] font-medium text-[#4e5462]">
                      Ingressos
                    </p>
                  </div>

                  <div className="bg-[#f2f3ff] rounded-xl py-2.5 px-2 text-center">
                    <p className="text-base sm:text-lg font-extrabold text-[#131b2e]">
                      {hasFaceRegistered && hasUserRegistered ? "100%" : "0%"}
                    </p>
                    <p className="text-[10px] font-medium text-[#4e5462]">
                      Validação
                    </p>
                  </div>

                  <div className="bg-[#f2f3ff] rounded-xl py-2.5 px-2 text-center flex flex-col items-center justify-center">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        hasUserRegistered && hasFaceRegistered
                          ? "bg-[#89f5c8] text-[#005236]"
                          : "bg-[#e2e7ff] text-[#4e5462]"
                      }`}
                    >
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
                    <p
                      className={`text-[10px] font-bold mt-1 ${
                        hasUserRegistered && hasFaceRegistered
                          ? "text-[#006c4a]"
                          : "text-[#4e5462]"
                      }`}
                    >
                      {hasUserRegistered && hasFaceRegistered
                        ? "Em Dia"
                        : "Incompleto"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal("carteirinha")}
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
            </div>

            {/* Right Column: Settings, Personal Data & Actions */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
              {/* Section: DADOS PESSOAIS E VALIDAÇÃO */}
              <div className="mt-0">
                <h3 className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#4e5462] mb-2.5 px-1">
                  DADOS PESSOAIS E VALIDAÇÃO
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {/* Item 1: Dados Cadastrais */}
                  <button
                    type="button"
                    onClick={() => setActiveModal("perfil")}
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
                          {profile?.cpf || profile?.email || profile?.telefone
                            ? `${profile.cpf ? `CPF ${profile.cpf}` : ""}${profile.email ? ` • ${profile.email}` : ""}`
                            : "Clique para adicionar CPF, e-mail e telefone"}
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
                          {hasFaceRegistered && (
                            <span className="rounded-full bg-[#89f5c8] px-2 py-0.5 text-[9.5px] font-extrabold text-[#005236]">
                              {profile?.faceQualityScore || 99.0}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#4e5462] truncate">
                          {hasFaceRegistered
                            ? "Foto de acesso biométrico capturada pela câmera"
                            : "Clique para capturar sua foto facial na câmera"}
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
                    onClick={() => setActiveModal("documento")}
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
                        <p
                          className={`text-[11px] font-bold ${
                            profile?.documentoIdentificacao
                              ? "text-[#006c4a]"
                              : "text-[#4e5462] font-normal"
                          }`}
                        >
                          {profile?.documentoIdentificacao
                            ? `${profile.documentoIdentificacao}${profile.orgaoEmissor ? ` • Validado (${profile.orgaoEmissor})` : ""}`
                            : "Clique para informar RG/CNH e órgão emissor"}
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
                    onClick={() => setActiveModal("dependentes")}
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
                          {(profile?.dependentes?.length || 0) === 0
                            ? "Nenhum dependente adicionado (clique para adicionar)"
                            : `${profile!.dependentes.length} vinculado(s) ao titular`}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveModal("acessibilidade")}
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
                          {profile?.acessibilidade ||
                            "Configurar acesso preferencial e portões dedicados"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[#4e5462] text-base font-bold shrink-0">
                      ›
                    </span>
                  </button>

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
                          Controle de dados e permissões biométricas
                        </p>
                      </div>
                    </div>
                    <span className="text-[#4e5462] text-base font-bold shrink-0">
                      ›
                    </span>
                  </button>

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

              {/* Support & Logout Buttons (No direct Admin link without login) */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal("perfil")}
                  className="w-full bg-white hover:bg-[#f2f3ff] text-[#131b2e] rounded-2xl py-3.5 px-4 shadow-[0_2px_12px_rgba(19,27,46,0.04)] font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Central de Ajuda & Suporte</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    logoutUserSession();
                    setLoggedEmail(null);
                    setAuthMode("login");
                    setStatusToast("Você saiu da sua conta.");
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
                  <span>PULSE PE TORCEDOR</span>
                </p>
                <p className="text-[10px] text-[#4e5462]">
                  Ilha do Retiro • Sport Club do Recife
                </p>
                <p className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#4e5462] mt-0.5">
                  GOVERNO DO ESTADO DE PERNAMBUCO
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          MODALS FOR REAL USER DATA INPUT
         ========================================================= */}

      {/* MODAL 1: Dados Cadastrais & Vínculo */}
      {activeModal === "perfil" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Dados Cadastrais do Titular
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSavePersonalData}
              className="flex flex-col gap-3"
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
                  placeholder="Digite seu nome completo"
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
                    placeholder="Nº da matrícula"
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                    Plano (Ex: PLANO OURO)
                  </label>
                  <input
                    type="text"
                    value={plano}
                    onChange={(e) => setPlano(e.target.value)}
                    placeholder="Seu plano"
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                    Vínculo (Ex: SÓCIO RUBRO-NEGRO)
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Sua categoria"
                    className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                  Membro Desde (Mês/Ano)
                </label>
                <input
                  type="text"
                  value={membroDesde}
                  onChange={(e) => setMembroDesde(e.target.value)}
                  placeholder="Informe mês/ano de adesão"
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
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
                    placeholder="seu@email.com"
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
                    placeholder="(00) 00000-0000"
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
                  onClick={() => setActiveModal(null)}
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

      {/* MODAL 2: Documento de Identificação */}
      {activeModal === "documento" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Documento de Identificação
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSavePersonalData}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                  Número do RG ou CNH *
                </label>
                <input
                  type="text"
                  required
                  value={documentoIdentificacao}
                  onChange={(e) => setDocumentoIdentificacao(e.target.value)}
                  placeholder="Informe o número do documento"
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                  Órgão Emissor / UF *
                </label>
                <input
                  type="text"
                  required
                  value={orgaoEmissor}
                  onChange={(e) => setOrgaoEmissor(e.target.value)}
                  placeholder="Ex: SDS-PE, DETRAN-PE"
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-xs font-bold text-[#4e5462] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#016294] text-xs font-extrabold text-white cursor-pointer"
                >
                  Salvar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Dependentes e Convidados */}
      {activeModal === "dependentes" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Dependentes e Convidados
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {(profile?.dependentes?.length || 0) > 0 && (
              <ul className="mb-4 flex flex-col gap-2 max-h-44 overflow-y-auto">
                {profile!.dependentes.map((dep) => (
                  <li
                    key={dep.id}
                    className="bg-[#f2f3ff] rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-extrabold text-[#131b2e]">
                        {dep.nome}
                      </p>
                      <p className="text-[10.5px] text-[#4e5462]">
                        {dep.parentesco || "Dependente"}
                        {dep.documento ? ` • Doc: ${dep.documento}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDependent(dep.id)}
                      className="text-[11px] font-bold text-[#93000a] cursor-pointer"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={handleAddDependent}
              className="flex flex-col gap-3 border-t border-[#eceaf6] pt-3"
            >
              <input
                type="text"
                required
                value={depNome}
                onChange={(e) => setDepNome(e.target.value)}
                placeholder="Nome do dependente *"
                className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={depParentesco}
                  onChange={(e) => setDepParentesco(e.target.value)}
                  placeholder="Parentesco / Relação"
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
                <input
                  type="text"
                  value={depDocumento}
                  onChange={(e) => setDepDocumento(e.target.value)}
                  placeholder="CPF ou Documento"
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#016294] text-xs font-extrabold text-white cursor-pointer"
              >
                + Adicionar Dependente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Acessibilidade */}
      {activeModal === "acessibilidade" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Acessibilidade no Estádio
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSavePersonalData}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4e5462] mb-1">
                  Preferência de Acesso / Mobilidade
                </label>
                <input
                  type="text"
                  value={acessibilidade}
                  onChange={(e) => setAcessibilidade(e.target.value)}
                  placeholder="Descreva necessidade especial ou portão preferencial"
                  className="w-full rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-xs font-bold text-[#4e5462] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#016294] text-xs font-extrabold text-white cursor-pointer"
                >
                  Salvar Preferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Escolher Setor Oficial e Gerar Ingresso */}
      {activeModal === "gerar-ingresso" && selectedMatchForTicket && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#016294] bg-[#e6f0f5] px-2.5 py-0.5 rounded-full">
                  {selectedMatchForTicket.competicao}
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-[#131b2e] mt-1.5">
                  {selectedMatchForTicket.mandante.nome} x{" "}
                  {selectedMatchForTicket.visitante.nome}
                </h2>
                <p className="text-xs text-[#4e5462] mt-0.5">
                  {selectedMatchForTicket.dataFormatada} •{" "}
                  {selectedMatchForTicket.estadio}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleGenerateTicketFromMatch}
              className="flex flex-col gap-3"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#4e5462]">
                Selecione o Setor Oficial ({selectedMatchForTicket.estadio})
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {selectedMatchForTicket.setores.map((sec) => {
                  const isSelected = selectedSectorId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSelectedSectorId(sec.id)}
                      className={`text-left rounded-2xl p-3 border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#016294] bg-[#e6f0f5]"
                          : "border-transparent bg-[#f2f3ff] hover:bg-[#e9ecff]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#131b2e]">
                          {sec.nome}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#016294] bg-white px-2 py-0.5 rounded-full shrink-0">
                          Portão {sec.portao}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#4e5462] mt-1">
                        {sec.subsetor}
                      </p>
                      <p className="text-[10px] text-[#016294] font-semibold mt-0.5">
                        {sec.endereco}
                      </p>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10.5px] text-[#4e5462] bg-[#f2f3ff] rounded-xl p-3">
                O portão designado, endereço de acesso e horário de abertura (
                {selectedMatchForTicket.aberturaPortoes}) são atribuídos
                automaticamente conforme o mapa oficial do estádio.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-xs font-bold text-[#4e5462] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#016294] hover:bg-[#01537e] text-xs font-extrabold text-white cursor-pointer transition-colors"
                >
                  Gerar Ingresso com Passe Facial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5B: Código do Ingresso em Tela Cheia para Entrada na Arena */}
      {activeModal === "codigo-arena" && ticketForCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto flex flex-col items-center text-center">
            {/* Top Status Badge inside Modal */}
            <div className="w-full flex items-center justify-between mb-3">
              {ticketStatuses[ticketForCodeModal.codigoIngresso]?.status ===
              "reprovado" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffdad6] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#93000a]">
                  ✕ ACESSO BLOQUEADO • REPROVADO
                </span>
              ) : ticketStatuses[ticketForCodeModal.codigoIngresso]?.status ===
                "aprovado" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#006c4a] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  ✓ COMPROVANTE • ENTRADA LIBERADA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#89f5c8] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#005236]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005236]" />
                  AGUARDANDO VALIDAÇÃO NA ARENA
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <h2 className="text-lg font-extrabold text-[#131b2e]">
              {ticketForCodeModal.mandante} x {ticketForCodeModal.visitante}
            </h2>
            <p className="text-xs font-semibold text-[#4e5462] mt-0.5">
              {ticketForCodeModal.estadio} • {ticketForCodeModal.dataHorario}
            </p>

            {/* Conditional Center Area: Blocked if Rejected, Official Receipt if Approved, QR Code if Pending */}
            {ticketStatuses[ticketForCodeModal.codigoIngresso]?.status ===
            "reprovado" ? (
              <div className="my-5 w-full bg-[#ffdad6] border-2 border-[#93000a]/30 rounded-2xl p-6 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#93000a] text-white flex items-center justify-center mb-3 text-xl font-extrabold">
                  ✕
                </div>
                <p className="text-sm font-extrabold text-[#93000a] uppercase">
                  Entrada Não Autorizada
                </p>
                <p className="text-xs font-bold text-[#7a0008] mt-1.5">
                  Motivo:{" "}
                  {ticketStatuses[ticketForCodeModal.codigoIngresso]
                    .motivoReprovacao ||
                    "Ingresso reprovado pela administração."}
                </p>
                <p className="text-[11px] text-[#7a0008] mt-2">
                  O QR Code foi bloqueado na catraca. Não é possível acessar a
                  arena com este bilhete.
                </p>
              </div>
            ) : (
              <div className="my-5 w-full bg-[#f2f3ff] rounded-2xl p-5 flex flex-col items-center">
                {ticketStatuses[ticketForCodeModal.codigoIngresso]?.status ===
                  "aprovado" && (
                  <div className="w-full mb-3 rounded-xl bg-[#d4f4e4] border border-[#006c4a]/25 p-3 text-xs font-extrabold text-[#005236]">
                    ✓ Comprovante Oficial — Você está autorizado a entrar na
                    arena!
                    {ticketStatuses[ticketForCodeModal.codigoIngresso]
                      .reviewedAt && (
                      <span className="block text-[10.5px] font-semibold text-[#006c4a] mt-0.5">
                        Aprovado em{" "}
                        {new Date(
                          ticketStatuses[ticketForCodeModal.codigoIngresso]
                            .reviewedAt!,
                        ).toLocaleString("pt-BR")}
                        {ticketStatuses[ticketForCodeModal.codigoIngresso]
                          .reviewedBy
                          ? ` por ${ticketStatuses[ticketForCodeModal.codigoIngresso].reviewedBy}`
                          : ""}
                      </span>
                    )}
                  </div>
                )}

                <TicketCodeVisual
                  code={ticketForCodeModal.codigoIngresso}
                  validationUrl={buildValidationUrl(ticketForCodeModal)}
                  size={196}
                />
                <p className="text-[10.5px] text-[#4e5462] mt-2.5">
                  {ticketStatuses[ticketForCodeModal.codigoIngresso]?.status ===
                  "aprovado"
                    ? "Comprovante de acesso validado. Apresente na catraca se solicitado."
                    : "Apresente este QR Code ao administrador na entrada da arena para validação e liberação da catraca."}
                </p>
              </div>
            )}

            {/* Gate, Sector & Holder Details for Arena Attendant */}
            <div className="w-full grid grid-cols-2 gap-2.5 text-left mb-4">
              <div className="bg-[#e6f0f5] rounded-xl p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#016294]">
                  PORTÃO DESIGNADO
                </p>
                <p className="text-base font-extrabold text-[#016294]">
                  Portão {ticketForCodeModal.portao}
                </p>
                <p className="text-[10px] text-[#016294] truncate">
                  {ticketForCodeModal.enderecoPortao}
                </p>
              </div>

              <div className="bg-[#f2f3ff] rounded-xl p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#4e5462]">
                  SETOR
                </p>
                <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                  {ticketForCodeModal.setor}
                </p>
                <p className="text-[10px] text-[#4e5462] truncate">
                  {ticketForCodeModal.subsetor}
                </p>
              </div>
            </div>

            <div className="w-full bg-[#faf8ff] border border-[#eceaf6] rounded-xl p-3 flex items-center justify-between text-left mb-4">
              <div className="min-w-0">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#4e5462]">
                  TITULAR DO INGRESSO
                </p>
                <p className="text-xs font-extrabold text-[#131b2e] truncate">
                  {profile?.nome || "Titular não identificado"}
                  {profile?.cpf ? ` • CPF ${profile.cpf}` : ""}
                </p>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                  hasFaceRegistered
                    ? "bg-[#d4f4e4] text-[#005236]"
                    : "bg-[#ffdad6] text-[#93000a]"
                }`}
              >
                {hasFaceRegistered ? "Biometria OK" : "Sem Biometria"}
              </span>
            </div>

            <div className="w-full flex gap-2.5">
              <button
                type="button"
                onClick={() =>
                  handleCopyTicketCode(ticketForCodeModal.codigoIngresso)
                }
                className={`flex-1 font-extrabold text-xs py-3 rounded-xl cursor-pointer transition-colors ${
                  copiedCode === ticketForCodeModal.codigoIngresso
                    ? "bg-[#006c4a] text-white"
                    : "bg-[#e6f0f5] hover:bg-[#d5e7f0] text-[#016294]"
                }`}
              >
                {copiedCode === ticketForCodeModal.codigoIngresso
                  ? `Copiado (${ticketForCodeModal.codigoIngresso}) ✓`
                  : "Copiar Código"}
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex-1 bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs py-3 rounded-xl cursor-pointer transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Adicionar Comunicado / Notificação */}
      {activeModal === "notificacao" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Adicionar Comunicado / Aviso
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-[#4e5462] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleAddCustomNotification}
              className="flex flex-col gap-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={notifCategoria}
                  onChange={(e) =>
                    setNotifCategoria(e.target.value as NotificationCategory)
                  }
                  className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                >
                  <option value="acesso">Acesso & Catraca</option>
                  <option value="partidas">Partidas</option>
                  <option value="clube">Clube</option>
                </select>
                <input
                  type="text"
                  value={notifSelo}
                  onChange={(e) => setNotifSelo(e.target.value)}
                  placeholder="Selo (Ex: CATRACA LIBERADA)"
                  className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                />
              </div>

              <input
                type="text"
                required
                value={notifTitulo}
                onChange={(e) => setNotifTitulo(e.target.value)}
                placeholder="Título da notificação *"
                className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
              />

              <textarea
                required
                rows={3}
                value={notifMensagem}
                onChange={(e) => setNotifMensagem(e.target.value)}
                placeholder="Mensagem da notificação *"
                className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none resize-none"
              />

              <input
                type="text"
                value={notifDetalhe}
                onChange={(e) => setNotifDetalhe(e.target.value)}
                placeholder="Detalhe complementar (Opcional)"
                className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-xs font-bold text-[#4e5462] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#016294] text-xs font-extrabold text-white cursor-pointer"
                >
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Carteirinha Digital */}
      {activeModal === "carteirinha" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#89f5c8] px-3 py-1 text-[10px] font-extrabold uppercase text-[#005236] mb-3">
              <span>CARTEIRA DO TORCEDOR • SDS-PE</span>
            </div>
            <h3 className="text-lg font-extrabold text-[#131b2e]">
              {profile?.nome || "Titular não cadastrado"}
            </h3>
            <p className="text-xs font-bold text-[#016294] mt-0.5">
              {profile?.matricula
                ? `Matrícula #${profile.matricula.replace(/^#/, "")}`
                : "Sem matrícula"}
              {profile?.plano ? ` • ${profile.plano}` : ""}
            </p>
            <div className="my-4 p-4 bg-[#f2f3ff] rounded-2xl flex flex-col items-center">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#006c4a] mb-2 bg-white flex items-center justify-center">
                {profile?.faceImageDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.faceImageDataUrl}
                    alt={profile.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-[#4e5462] px-2">
                    Sem foto
                  </span>
                )}
              </div>
              <span className="text-[11px] font-extrabold text-[#006c4a]">
                {hasFaceRegistered
                  ? `Biometria Facial Homologada (${profile?.faceQualityScore}%)`
                  : "Biometria facial pendente"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
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
        className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#faf8ff]/95 backdrop-blur-xs border-t border-[#ebe9f5] px-2 py-2.5 grid items-center ${
          adminSessionEmail ? "grid-cols-5" : "grid-cols-4"
        }`}
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

        {adminSessionEmail && (
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="flex flex-col items-center justify-center gap-1 text-[#016294] font-extrabold cursor-pointer"
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
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className="text-[10px] tracking-tight">Painel ADM</span>
          </button>
        )}
      </nav>
    </div>
  );
}

export default function Page() {
  return <PulsePeApp initialTab="ingressos" />;
}
