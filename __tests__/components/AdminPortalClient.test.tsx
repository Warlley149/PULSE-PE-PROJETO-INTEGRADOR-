import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminPortalClient } from "@/app/admin/AdminPortalClient";
import type { ServerTicketRecord } from "@/app/lib/server-tickets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const sampleTickets: ServerTicketRecord[] = [
  {
    codigo: "PE-416170",
    matchId: "fpf-2027-frevo-sport-estreia",
    competicao: "CAMPEONATO PERNAMBUCANO",
    jogo: "Sport Recife x Náutico",
    estadio: "Ilha do Retiro",
    dataHorario: "03/Jan/2027, 16:00",
    setor: "Assento Especial",
    subsetor: "Portaria Principal",
    portao: "04",
    enderecoPortao: "Rua Sport Club do Recife",
    titular: "Warlley dos Santos Tenório",
    cpf: "123.456.789-00",
    userEmail: "warlley@pulsepe.com",
    biometriaOk: true,
    status: "pendente",
    createdAt: "2026-11-22T20:00:00.000Z",
  },
  {
    codigo: "PE-194927",
    matchId: "fpf-2027-frevo-sport-estreia",
    competicao: "CAMPEONATO PERNAMBUCANO",
    jogo: "Sport Recife x Náutico",
    estadio: "Ilha do Retiro",
    dataHorario: "03/Jan/2027, 16:00",
    setor: "Cadeiras de Ampliação",
    subsetor: "Portaria Principal",
    portao: "11",
    enderecoPortao: "Rua Sport Club do Recife",
    titular: "Maria Clara Albuquerque",
    cpf: "987.654.321-11",
    userEmail: "maria@pulsepe.com",
    biometriaOk: true,
    status: "aprovado",
    createdAt: "2026-11-22T21:00:00.000Z",
    reviewedAt: "2026-11-22T21:20:16.000Z",
    reviewedBy: "admin@pulsepe.gov.br",
  },
];

describe("Componente <AdminPortalClient />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza tela de Login do Administrador quando desautenticado e exibe erro com credenciais inválidas", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Credenciais inválidas. Acesso restrito ao administrador.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <AdminPortalClient initialAuthenticated={false} initialEmail={null} />,
    );

    expect(screen.getByText("Login do Administrador")).toBeInTheDocument();
    expect(screen.getByText("ACESSO EXCLUSIVO ADM")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/E-mail do Administrador/i), {
      target: { value: "invasor@teste.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: "senhaerrada" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar no Painel ADM/i }));

    expect(
      await screen.findByText(
        "Credenciais inválidas. Acesso restrito ao administrador.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("autentica o Administrador com credenciais válidas e carrega o painel com KPIs e bilhetes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/login")) {
        return new Response(
          JSON.stringify({
            authenticated: true,
            email: "admin@pulsepe.gov.br",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/ingressos")) {
        return new Response(JSON.stringify({ tickets: sampleTickets }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <AdminPortalClient initialAuthenticated={false} initialEmail={null} />,
    );

    fireEvent.change(screen.getByLabelText(/E-mail do Administrador/i), {
      target: { value: "admin@pulsepe.gov.br" },
    });
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: "PulsePE@2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar no Painel ADM/i }));

    expect(
      await screen.findByText("Scanner de QR Code (Catraca ADM)"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Warlley dos Santos Tenório/i),
    ).toBeInTheDocument();
    expect(screen.getByText("2 bilhete(s) • 2 torcedor(es)")).toBeInTheDocument();
  });

  it("permite filtrar bilhetes, buscar código inexistente (erro) e buscar URL de QR Code válida (sucesso)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/ingressos/validar?codigo=PE-999999")) {
        return new Response(JSON.stringify({ ticket: null }), { status: 200 });
      }
      if (url.includes("/api/ingressos")) {
        return new Response(JSON.stringify({ tickets: sampleTickets }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <AdminPortalClient
        initialAuthenticated={true}
        initialEmail="admin@pulsepe.gov.br"
      />,
    );

    await screen.findByText("PE-416170");

    // Filtra apenas Reprovados (lista vazia)
    fireEvent.click(screen.getByRole("button", { name: "Reprovados" }));
    expect(screen.getByText("Nenhum bilhete encontrado")).toBeInTheDocument();

    // Volta para Todos
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("PE-416170")).toBeInTheDocument();

    // Busca código inexistente -> Cenário de Erro
    const codeInput = screen.getByPlaceholderText(
      /Digite ou cole o código/i,
    );
    fireEvent.change(codeInput, { target: { value: "PE-999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(
      await screen.findByText(
        "Bilhete PE-999999 não encontrado na base de ingressos gerados.",
      ),
    ).toBeInTheDocument();

    // Busca colando URL completa do QR Code -> Cenário de Sucesso
    fireEvent.change(codeInput, {
      target: { value: "http://localhost:3000/validar?codigo=PE-416170" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(
      await screen.findByRole("button", { name: /✓ Aprovar Entrada/i }),
    ).toBeInTheDocument();
  });

  it("aprova um bilhete pendente, exibe comprovante liberado e permite reprovar com motivo personalizado", async () => {
    let currentTicket: ServerTicketRecord = { ...sampleTickets[0] };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/ingressos/validar") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          codigo: string;
          decision: "aprovado" | "reprovado";
          motivoReprovacao?: string;
        };
        currentTicket = {
          ...currentTicket,
          codigo: body.codigo,
          status: body.decision,
          motivoReprovacao: body.motivoReprovacao,
          reviewedAt: "2026-11-25T19:00:00.000Z",
          reviewedBy: "admin@pulsepe.gov.br",
        };
        return new Response(JSON.stringify({ ticket: currentTicket }), {
          status: 200,
        });
      }
      if (url.includes("/api/ingressos")) {
        return new Response(JSON.stringify({ tickets: [currentTicket] }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 200 });
    });

    render(
      <AdminPortalClient
        initialAuthenticated={true}
        initialEmail="admin@pulsepe.gov.br"
      />,
    );

    await screen.findByText("PE-416170");

    // Aprova entrada diretamente na lista
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    expect(
      await screen.findByText(/Entrada APROVADA para PE-416170/i),
    ).toBeInTheDocument();

    // Abre modal de comprovante oficial
    const receiptButtons = screen.getAllByRole("button", {
      name: /Ver Comprovante/i,
    });
    fireEvent.click(receiptButtons[0]);
    expect(
      await screen.findByText("COMPROVANTE DE ENTRADA LIBERADA"),
    ).toBeInTheDocument();
    expect(screen.getByText("AUTORIZADO A ENTRAR ✓")).toBeInTheDocument();

    // Fecha modal de comprovante
    const closeButtons = screen.getAllByRole("button", { name: "Fechar" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    // Altera para reprovar informando motivo no modal
    fireEvent.click(
      screen.getByRole("button", { name: "Alterar p/ Reprovar" }),
    );
    expect(
      screen.getByText("Reprovar Entrada — PE-416170"),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(/Biometria não validada, documento divergente/i),
      { target: { value: "Documento divergente na catraca" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar Reprovação" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /Entrada REPROVADA para PE-416170. Motivo: Documento divergente na catraca/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("exibe mensagem amigável de erro quando o navegador não possui suporte WebRTC de câmera", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tickets: [] }), { status: 200 }),
    );

    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });

    render(
      <AdminPortalClient
        initialAuthenticated={true}
        initialEmail="admin@pulsepe.gov.br"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Abrir Câmera para Escanear QR Code/i,
      }),
    );

    expect(
      await screen.findByText("Dispositivo sem acesso à câmera WebRTC."),
    ).toBeInTheDocument();
  });
});
