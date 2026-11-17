"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  type BiometricProfile,
  clearNotifications,
  getStoredNotifications,
  getStoredProfile,
  getStoredTicket,
  markAllNotificationsRead,
  removeBiometricProfile,
  removeTicketAccess,
  saveTicketAccess,
  type SystemNotification,
  type TicketAccess,
} from "@/app/lib/storage";

type ActiveTab = "ingressos" | "notificacoes" | "perfil";

export default function PulsePeScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ingressos");
  const [profile, setProfile] = useState<BiometricProfile | null>(null);
  const [ticket, setTicket] = useState<TicketAccess | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showTicketForm, setShowTicketForm] = useState<boolean>(false);

  // Ticket registration fields (real user input, no hardcoded mock data)
  const [competicao, setCompeticao] = useState<string>("");
  const [mandante, setMandante] = useState<string>("");
  const [visitante, setVisitante] = useState<string>("");
  const [dataHorario, setDataHorario] = useState<string>("");
  const [aberturaPortoes, setAberturaPortoes] = useState<string>("");
  const [setor, setSetor] = useState<string>("");
  const [subsetor, setSubsetor] = useState<string>("");
  const [portao, setPortao] = useState<string>("");
  const [enderecoPortao, setEnderecoPortao] = useState<string>("");

  useEffect(() => {
    const syncState = () => {
      setProfile(getStoredProfile());
      setTicket(getStoredTicket());
      setNotifications(getStoredNotifications());

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab === "notificacoes" || tab === "perfil") {
          setActiveTab(tab);
        }
      }
    };

    const timer = window.setTimeout(syncState, 0);
    window.addEventListener("storage", syncState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncState);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const handleOpenNotifications = () => {
    setActiveTab("notificacoes");
    const updated = markAllNotificationsRead();
    setNotifications(updated);
  };

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !mandante.trim() ||
      !visitante.trim() ||
      !setor.trim() ||
      !portao.trim()
    ) {
      return;
    }

    const saved = saveTicketAccess({
      competicao: competicao.trim(),
      mandante: mandante.trim(),
      visitante: visitante.trim(),
      dataHorario: dataHorario.trim(),
      aberturaPortoes: aberturaPortoes.trim(),
      setor: setor.trim(),
      subsetor: subsetor.trim(),
      portao: portao.trim(),
      enderecoPortao: enderecoPortao.trim(),
      tipoAcesso: "Catraca Express",
      fila: "Fila Facial Dedicada",
    });

    setTicket(saved);
    setNotifications(getStoredNotifications());
    setShowTicketForm(false);
  };

  const handleRemoveTicket = () => {
    removeTicketAccess();
    setTicket(null);
  };

  const handleClearProfile = async () => {
    await removeBiometricProfile();
    setProfile(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between pb-24 md:pb-12 select-none">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-[#f9f8fe]/95 backdrop-blur-xs border-b border-[#eceaf6] w-full">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => setActiveTab("ingressos")}
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

          {/* Desktop Navigation Bar */}
          <nav
            aria-label="Navegação desktop"
            className="hidden md:flex items-center gap-1 lg:gap-2 bg-[#f2f3ff] p-1.5 rounded-2xl"
          >
            <button
              type="button"
              onClick={() => setActiveTab("ingressos")}
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

            <Link
              href="/biometria"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#4e5462] hover:text-[#131b2e] hover:bg-white/60 font-semibold text-xs transition-all"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
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

            <button
              type="button"
              onClick={handleOpenNotifications}
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
                strokeWidth="1.9"
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
              onClick={() => setActiveTab("perfil")}
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
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
              <span>Perfil</span>
            </button>
          </nav>

          {/* Right Actions: Notification Bell & User Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleOpenNotifications}
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
              onClick={() => setActiveTab("perfil")}
              aria-label="Perfil do titular"
              className="relative cursor-pointer"
            >
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] border-2 ${
                  profile ? "border-[#006c4a]" : "border-[#d5d8e2]"
                } bg-white overflow-hidden flex items-center justify-center`}
              >
                {profile?.faceImageDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.faceImageDataUrl}
                    alt={profile.nome}
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
              {profile && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#006c4a] border-2 border-[#f9f8fe]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 md:pt-8 flex flex-col">
        {activeTab === "ingressos" && (
          <>
            {/* Top Greeting + Biometria Status Pill */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-extrabold text-[#131b2e] tracking-tight leading-snug">
                  {profile ? `Olá, ${profile.nome.split(" ")[0]}` : "Bem-vindo"}
                </h1>
                <p className="text-[11px] sm:text-xs font-bold text-[#4e5462] uppercase tracking-[0.05em] leading-[1.35] mt-0.5">
                  {profile
                    ? profile.categoria || "TITULAR CADASTRADO"
                    : "CADASTRO BIOMÉTRICO"}
                </p>
              </div>

              {profile ? (
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
                <Link
                  href="/biometria"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-[11px] font-extrabold tracking-[0.04em] text-[#016294] uppercase shrink-0 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-[#016294]" />
                  <span>CADASTRAR BIOMETRIA</span>
                </Link>
              )}
            </div>

            {/* Identification / Homologation Status Line */}
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
                  {profile
                    ? `${profile.matricula ? `Matrícula #${profile.matricula.replace(/^#/, "")} • ` : `CPF ${profile.cpf} • `}Acesso Facial Homologado SDS-PE`
                    : "Cadastre sua face pela câmera para liberar o acesso biométrico"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowTicketForm((prev) => !prev)}
                className="text-[11px] font-bold text-[#016294] hover:underline shrink-0 cursor-pointer"
              >
                {ticket ? "Editar ingresso" : "+ Vincular ingresso"}
              </button>
            </div>

            {/* Collapsible Real Ticket Input Form */}
            {showTicketForm && (
              <form
                onSubmit={handleSaveTicket}
                className="mb-5 bg-white rounded-3xl shadow-[0_6px_24px_rgba(19,27,46,0.06)] p-4 sm:p-6 flex flex-col gap-3.5 border border-[#eceaf6]"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#131b2e]">
                    Dados do Ingresso / Partida
                  </h2>
                  {ticket && (
                    <button
                      type="button"
                      onClick={handleRemoveTicket}
                      className="text-[11px] font-bold text-[#93000a] hover:underline cursor-pointer"
                    >
                      Remover ingresso
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={competicao}
                    onChange={(e) => setCompeticao(e.target.value)}
                    placeholder="Competição"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={mandante}
                    onChange={(e) => setMandante(e.target.value)}
                    placeholder="Clube Mandante *"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={visitante}
                    onChange={(e) => setVisitante(e.target.value)}
                    placeholder="Clube Visitante *"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={dataHorario}
                    onChange={(e) => setDataHorario(e.target.value)}
                    placeholder="Data e Horário"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                  <input
                    type="text"
                    value={aberturaPortoes}
                    onChange={(e) => setAberturaPortoes(e.target.value)}
                    placeholder="Horário de Abertura"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    placeholder="Setor *"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                  <input
                    type="text"
                    value={subsetor}
                    onChange={(e) => setSubsetor(e.target.value)}
                    placeholder="Subsetor / Referência"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={portao}
                    onChange={(e) => setPortao(e.target.value)}
                    placeholder="Portão (Ex: 02) *"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                  <input
                    type="text"
                    value={enderecoPortao}
                    onChange={(e) => setEnderecoPortao(e.target.value)}
                    placeholder="Endereço / Acesso do Portão"
                    className="rounded-xl bg-[#f2f3ff] px-3.5 py-2.5 text-xs text-[#131b2e] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTicketForm(false)}
                    className="px-4 py-2 rounded-xl bg-[#f2f3ff] text-xs font-bold text-[#4e5462] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#016294] text-xs font-extrabold text-white cursor-pointer"
                  >
                    Salvar Ingresso
                  </button>
                </div>
              </form>
            )}

            {/* Main Match Ticket Card */}
            <section className="bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] pt-4 sm:pt-5 pb-5 sm:pb-7 flex flex-col overflow-hidden">
              {/* Championship Banner Strip */}
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
                      {ticket?.competicao || "ACESSO BIOMÉTRICO • PULSE PE"}
                    </span>
                  </div>
                </div>

                {/* Status Pill */}
                <div className="bg-[#ffdad6] rounded-full px-3.5 sm:px-4 py-1.5 flex flex-col sm:flex-row sm:gap-1 text-[9.5px] sm:text-[11px] font-extrabold uppercase tracking-[0.03em] text-[#93000a] leading-[1.15] shrink-0">
                  <span>{ticket ? "PRÓXIMA" : "PASSE"}</span>
                  <span>{ticket ? "PARTIDA" : "FACIAL"}</span>
                </div>
              </div>

              {/* Teams Matchup Section */}
              <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5 flex items-center justify-between gap-2">
                {/* Home Team */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#f2f3ff] border border-[#e5e7eb] shadow-xs flex items-center justify-center shrink-0 text-xs sm:text-sm font-extrabold text-[#016294] uppercase">
                    {ticket?.mandante ? (
                      ticket.mandante.slice(0, 2)
                    ) : (
                      <svg
                        className="w-5 h-5 text-[#016294]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14.5px] sm:text-lg md:text-xl font-extrabold text-[#131b2e] leading-tight truncate">
                      {ticket?.mandante || "Mandante"}
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-bold text-[#016294] uppercase tracking-[0.05em] mt-0.5">
                      MANDANTE
                    </span>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="bg-[#e2e7ff] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center shrink-0 mx-1">
                  <span className="text-[11.5px] sm:text-xs md:text-sm font-extrabold text-[#131b2e] tracking-wide uppercase">
                    VS
                  </span>
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="flex flex-col items-end text-right min-w-0">
                    <span className="text-[14.5px] sm:text-lg md:text-xl font-extrabold text-[#131b2e] leading-tight truncate">
                      {ticket?.visitante || "Visitante"}
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-bold text-[#4e5462] uppercase tracking-[0.05em] mt-0.5">
                      VISITANTE
                    </span>
                  </div>
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#f2f3ff] border border-[#e5e7eb] shadow-xs flex items-center justify-center shrink-0 text-xs sm:text-sm font-extrabold text-[#4e5462] uppercase">
                    {ticket?.visitante ? (
                      ticket.visitante.slice(0, 2)
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
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Ticket Perforation Divider */}
              <div className="relative flex items-center justify-between my-2 sm:my-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#faf8ff] -ml-2.5 sm:-ml-3 shrink-0" />
                <div className="w-full border-t border-dashed border-[#d5d8e2] mx-1" />
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#faf8ff] -mr-2.5 sm:-mr-3 shrink-0" />
              </div>

              {/* Responsive 2x2 Info Grid */}
              <div className="px-4 sm:px-6 md:px-8 pt-2 sm:pt-3 grid grid-cols-1 min-[340px]:grid-cols-2 gap-3 sm:gap-4">
                {/* Box 1: DATA & HORÁRIO */}
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
                      {ticket?.dataHorario || "—"}
                    </p>
                    <p className="text-[10.5px] sm:text-xs font-bold text-[#006c4a] mt-1">
                      {ticket?.aberturaPortoes
                        ? `Abertura: ${ticket.aberturaPortoes}`
                        : "Aguardando vínculo"}
                    </p>
                  </div>
                </div>

                {/* Box 2: SETOR */}
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
                      {ticket?.setor || "—"}
                    </p>
                    <p className="text-[10.5px] sm:text-xs font-medium text-[#4e5462] mt-1">
                      {ticket?.subsetor || "Não vinculado"}
                    </p>
                  </div>
                </div>

                {/* Box 3: PORTÃO DESIGNADO */}
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
                      {ticket?.portao || "—"}
                    </p>
                  </div>

                  <p className="text-[10.5px] sm:text-xs font-medium text-[#016294] leading-[1.25]">
                    {ticket?.enderecoPortao || "Definido ao vincular ingresso"}
                  </p>
                </div>

                {/* Box 4: ACESSO RÁPIDO */}
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
                    {profile
                      ? "Fila Facial Dedicada"
                      : "Requer cadastro facial"}
                  </p>
                </div>
              </div>

              {/* Primary CTA Button -> Goes directly to Facial Recognition Camera Page */}
              <div className="px-4 sm:px-6 md:px-8 mt-4 sm:mt-6">
                <Link
                  href="/biometria"
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
                </Link>
              </div>

              {/* Bottom Automatic Recognition Note */}
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

        {/* TAB: Notificações */}
        {activeTab === "notificacoes" && (
          <section className="bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-7 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#eceaf6] pb-4 mb-4">
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-[#131b2e]">
                  Notificações
                </h1>
                <p className="text-xs text-[#4e5462] mt-0.5">
                  Histórico de registros biométricos e vínculos realizados no
                  dispositivo.
                </p>
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearNotifications();
                    setNotifications([]);
                  }}
                  className="text-xs font-bold text-[#016294] hover:underline cursor-pointer"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#f2f3ff] text-[#4e5462] flex items-center justify-center mb-3">
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
                <p className="text-sm font-bold text-[#131b2e]">
                  Nenhuma notificação registrada
                </p>
                <p className="text-xs text-[#4e5462] mt-1 max-w-xs">
                  Os eventos de cadastro facial e vínculo de ingressos
                  aparecerão aqui.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {notifications.map((item) => (
                  <li
                    key={item.id}
                    className="bg-[#f2f3ff] rounded-2xl p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-extrabold text-[#131b2e]">
                        {item.titulo}
                      </p>
                      <p className="text-xs text-[#4e5462] mt-1">
                        {item.mensagem}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#4e5462] shrink-0">
                      {new Date(item.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* TAB: Perfil */}
        {activeTab === "perfil" && (
          <section className="bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_6px_28px_rgba(19,27,46,0.06)] p-5 sm:p-7 flex flex-col">
            <div className="border-b border-[#eceaf6] pb-4 mb-5">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#131b2e]">
                Perfil do Titular
              </h1>
              <p className="text-xs text-[#4e5462] mt-0.5">
                Dados armazenados a partir do seu cadastro biométrico.
              </p>
            </div>

            {!profile ? (
              <div className="py-10 text-center flex flex-col items-center">
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
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5 20a7 7 0 0 1 14 0" />
                  </svg>
                </div>
                <p className="text-sm font-extrabold text-[#131b2e]">
                  Nenhum titular cadastrado neste dispositivo
                </p>
                <p className="text-xs text-[#4e5462] mt-1 max-w-xs mb-5">
                  Utilize a câmera na aba de Biometria para capturar sua face e
                  registrar seus dados.
                </p>
                <Link
                  href="/biometria"
                  className="bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl transition-colors"
                >
                  Ir para Cadastro Biométrico
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.faceImageDataUrl}
                    alt={profile.nome}
                    className="w-24 h-24 rounded-3xl object-cover border-2 border-[#006c4a]"
                  />
                  <div className="text-center sm:text-left">
                    <h2 className="text-lg font-extrabold text-[#131b2e]">
                      {profile.nome}
                    </h2>
                    <p className="text-xs font-semibold text-[#4e5462] mt-0.5">
                      CPF: {profile.cpf}
                    </p>
                    {profile.matricula && (
                      <p className="text-xs font-semibold text-[#016294] mt-0.5">
                        Matrícula: #{profile.matricula.replace(/^#/, "")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#f2f3ff] rounded-xl p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                      Categoria / Vínculo
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold text-[#131b2e] mt-1">
                      {profile.categoria || "Não informada"}
                    </p>
                  </div>
                  <div className="bg-[#f2f3ff] rounded-xl p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                      E-mail / Telefone
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold text-[#131b2e] mt-1">
                      {profile.email || profile.telefone || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href="/biometria"
                    className="flex-1 bg-[#016294] hover:bg-[#01537e] text-white text-center font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-colors"
                  >
                    Gerenciar Passe Facial e Câmera
                  </Link>
                  <button
                    type="button"
                    onClick={handleClearProfile}
                    className="bg-[#ffdad6] hover:bg-[#ffc8c2] text-[#93000a] font-extrabold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-colors cursor-pointer"
                  >
                    Remover Dados
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação principal mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#faf8ff]/95 backdrop-blur-xs border-t border-[#ebe9f5] px-4 py-2.5 grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => setActiveTab("ingressos")}
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

        <Link
          href="/biometria"
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
          <span className="text-[10.5px] font-semibold tracking-tight">
            Biometria
          </span>
        </Link>

        <button
          type="button"
          onClick={handleOpenNotifications}
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
          onClick={() => setActiveTab("perfil")}
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
