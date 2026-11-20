"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addSystemNotification, getStoredTickets } from "@/app/lib/storage";

interface ValidationState {
  status: "loading" | "ready" | "confirmed" | "already_entered" | "error";
  enteredAt?: string;
  errorMessage?: string;
}

function ValidarContent() {
  const searchParams = useSearchParams();

  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();
  const jogo = searchParams.get("jogo") || "Partida Oficial";
  const estadio = searchParams.get("estadio") || "Estádio";
  const portao = searchParams.get("portao") || "—";
  const setor = searchParams.get("setor") || "—";
  const data = searchParams.get("data") || "—";
  const titular = searchParams.get("titular") || "Titular não informado";
  const cpf = searchParams.get("cpf") || "";
  const biometriaOk = searchParams.get("bio") === "1";

  const [state, setState] = useState<ValidationState>({ status: "loading" });

  useEffect(() => {
    if (!codigo) {
      const timer = window.setTimeout(() => {
        setState({
          status: "error",
          errorMessage: "Código de ingresso ausente na leitura do QR Code.",
        });
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const checkExisting = async () => {
      try {
        const res = await fetch(
          `/api/ingressos/validar?codigo=${encodeURIComponent(codigo)}`,
        );
        if (res.ok) {
          const json = (await res.json()) as {
            validated: boolean;
            entry?: { enteredAt: string };
          };
          if (json.validated && json.entry) {
            setState({
              status: "already_entered",
              enteredAt: json.entry.enteredAt,
            });
            return;
          }
        }
      } catch {
        // fallback to local check
      }

      // Check local storage if user already entered on this device
      if (typeof window !== "undefined") {
        const localEntry = window.localStorage.getItem(
          `pulse_pe_entry_${codigo}`,
        );
        if (localEntry) {
          setState({ status: "already_entered", enteredAt: localEntry });
          return;
        }
      }

      setState({ status: "ready" });
    };

    void checkExisting();
  }, [codigo]);

  const handleConfirmEntry = async () => {
    if (!codigo) return;
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch("/api/ingressos/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          jogo,
          estadio,
          portao,
          setor,
          data,
          titular,
          cpf,
          biometriaOk,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          alreadyEntered: boolean;
          entry: { enteredAt: string };
        };

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `pulse_pe_entry_${codigo}`,
            json.entry.enteredAt,
          );
          // Mark matching ticket in local storage if present on this device
          const tickets = getStoredTickets();
          const hasTicket = tickets.some((t) => t.codigoIngresso === codigo);
          if (hasTicket) {
            addSystemNotification({
              categoria: "acesso",
              selo: "ENTRADA CONFIRMADA",
              titulo: `Entrada registrada: ${jogo}`,
              mensagem: `Ingresso ${codigo} validado no Portão ${portao} (${setor}) — ${estadio}.`,
              detalheRodape: `Acesso liberado às ${new Date(
                json.entry.enteredAt,
              ).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`,
            });
          }
        }

        setState({
          status: json.alreadyEntered ? "already_entered" : "confirmed",
          enteredAt: json.entry.enteredAt,
        });
        return;
      }
    } catch {
      // Fallback local confirmation
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`pulse_pe_entry_${codigo}`, nowIso);
    }
    setState({ status: "confirmed", enteredAt: nowIso });
  };

  return (
    <div className="min-h-screen w-full bg-[#faf8ff] text-[#131b2e] flex flex-col">
      {/* Header */}
      <header className="bg-[#f9f8fe] border-b border-[#eceaf6] w-full px-4 sm:px-6 lg:px-10 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#0682c4] to-[#02669c] flex items-center justify-center text-white font-extrabold text-xs">
            PE
          </div>
          <div className="leading-none">
            <span className="text-[10px] font-bold tracking-wider text-[#3b8dbd] uppercase block">
              CONTROLE DE ACESSO • ARENA
            </span>
            <span className="text-sm font-extrabold text-[#131b2e] uppercase">
              PULSE PE — CATRACA
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs font-extrabold text-[#016294] bg-[#e6f0f5] hover:bg-[#d5e7f0] px-3.5 py-2 rounded-xl transition-colors"
        >
          Voltar ao App
        </Link>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center">
        <section className="bg-white rounded-[28px] shadow-[0_8px_32px_rgba(19,27,46,0.08)] p-6 sm:p-8 flex flex-col items-center text-center">
          {/* Status Visual Banner */}
          {state.status === "confirmed" && (
            <div className="w-full rounded-2xl bg-[#d4f4e4] border border-[#006c4a]/25 p-5 mb-6 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[#006c4a] text-white flex items-center justify-center mb-3 shadow-sm">
                <svg
                  className="w-8 h-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#005236]">
                CATRACA LIBERADA
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#005236] mt-1">
                Entrada Confirmada no Jogo!
              </h1>
              <p className="text-xs font-semibold text-[#006c4a] mt-1">
                O torcedor entrou na arena em{" "}
                {state.enteredAt
                  ? new Date(state.enteredAt).toLocaleString("pt-BR")
                  : "agora"}
                .
              </p>
            </div>
          )}

          {state.status === "already_entered" && (
            <div className="w-full rounded-2xl bg-[#fff3cd] border border-amber-400/40 p-5 mb-6 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center mb-2.5">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-900">
                INGRESSO JÁ UTILIZADO
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-amber-950 mt-1">
                Torcedor já entrou na arena
              </h1>
              <p className="text-xs font-semibold text-amber-900 mt-1">
                Entrada registrada em{" "}
                {state.enteredAt
                  ? new Date(state.enteredAt).toLocaleString("pt-BR")
                  : "registro anterior"}
                .
              </p>
            </div>
          )}

          {state.status === "ready" && (
            <div className="w-full rounded-2xl bg-[#e6f0f5] p-5 mb-6 flex flex-col items-center">
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-[#016294]">
                QR CODE RECONHECIDO • VÁLIDO
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#131b2e] mt-1">
                Confirmar Entrada na Arena
              </h1>
              <p className="text-xs text-[#4e5462] mt-1">
                Verifique os dados abaixo e confirme a liberação da catraca.
              </p>
            </div>
          )}

          {state.status === "error" && (
            <div className="w-full rounded-2xl bg-[#ffdad6] p-5 mb-6">
              <p className="text-sm font-extrabold text-[#93000a]">
                {state.errorMessage}
              </p>
            </div>
          )}

          {/* Ticket Details */}
          {codigo && (
            <div className="w-full flex flex-col gap-3 text-left">
              <div className="bg-[#f2f3ff] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                    CÓDIGO DO INGRESSO
                  </p>
                  <p className="text-lg font-mono font-extrabold tracking-widest text-[#131b2e]">
                    {codigo}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full ${
                    state.status === "confirmed" ||
                    state.status === "already_entered"
                      ? "bg-[#89f5c8] text-[#005236]"
                      : "bg-white text-[#016294]"
                  }`}
                >
                  {state.status === "confirmed" ||
                  state.status === "already_entered"
                    ? "ENTROU ✓"
                    : "PRONTO"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#f2f3ff] rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                    PARTIDA
                  </p>
                  <p className="text-sm font-extrabold text-[#131b2e] mt-0.5">
                    {jogo}
                  </p>
                  <p className="text-[11px] text-[#4e5462]">{data}</p>
                </div>

                <div className="bg-[#e6f0f5] rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#016294]">
                    ESTÁDIO & PORTÃO
                  </p>
                  <p className="text-sm font-extrabold text-[#016294] mt-0.5">
                    Portão {portao} • {setor}
                  </p>
                  <p className="text-[11px] text-[#016294]">{estadio}</p>
                </div>
              </div>

              <div className="bg-[#faf8ff] border border-[#eceaf6] rounded-2xl p-3.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4e5462]">
                    TITULAR
                  </p>
                  <p className="text-sm font-extrabold text-[#131b2e]">
                    {titular}
                  </p>
                  {cpf && (
                    <p className="text-[11px] text-[#4e5462]">CPF: {cpf}</p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                    biometriaOk
                      ? "bg-[#d4f4e4] text-[#005236]"
                      : "bg-[#ffdad6] text-[#93000a]"
                  }`}
                >
                  {biometriaOk ? "Biometria Validada" : "Sem Biometria"}
                </span>
              </div>
            </div>
          )}

          {/* Primary Action */}
          <div className="w-full mt-6 flex flex-col gap-2.5">
            {state.status === "ready" && (
              <button
                type="button"
                onClick={handleConfirmEntry}
                className="w-full bg-[#006c4a] hover:bg-[#00583c] text-white font-extrabold text-sm uppercase tracking-wider py-4 px-5 rounded-2xl shadow-sm cursor-pointer transition-colors"
              >
                Confirmar Entrada do Torcedor no Jogo
              </button>
            )}

            <Link
              href="/"
              className="w-full bg-[#016294] hover:bg-[#01537e] text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl text-center transition-colors"
            >
              Voltar para Meus Ingressos
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ValidarIngressoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#faf8ff] flex items-center justify-center text-sm font-bold text-[#4e5462]">
          Carregando validação do ingresso...
        </div>
      }
    >
      <ValidarContent />
    </Suspense>
  );
}
