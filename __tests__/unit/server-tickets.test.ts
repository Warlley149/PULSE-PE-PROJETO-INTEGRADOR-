import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAllMergedServerTickets,
  getServerTicketByCode,
  getServerTicketsByCodes,
  upsertServerTicket,
  reviewServerTicket,
  deleteServerTicket,
  type ServerTicketRecord,
} from "@/app/lib/server-tickets";

const mockTicketOld: ServerTicketRecord = {
  codigo: "PE-100001",
  matchId: "m1",
  competicao: "PERNAMBUCANO",
  jogo: "Central x Íbis",
  estadio: "Lacerdão",
  dataHorario: "21/11 • 17:00",
  setor: "Norte",
  subsetor: "Popular",
  portao: "01",
  enderecoPortao: "Portão Norte",
  titular: "Pedro",
  cpf: "111.111.111-11",
  biometriaOk: false,
  status: "pendente",
  createdAt: "2026-11-20T10:00:00.000Z",
};

const mockTicketNew: ServerTicketRecord = {
  ...mockTicketOld,
  codigo: "PE-200002",
  titular: "Lucas",
  createdAt: "2026-11-25T15:00:00.000Z",
};

describe("Módulo Unitário: app/lib/server-tickets.ts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista todos os bilhetes ordenados do mais recente para o mais antigo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ tickets: [mockTicketOld, mockTicketNew] }),
        { status: 200 },
      ),
    );

    const list = await listAllMergedServerTickets();
    expect(list).toHaveLength(2);
    expect(list[0].codigo).toBe("PE-200002");
    expect(list[1].codigo).toBe("PE-100001");
  });

  it("retorna lista vazia quando a API externa está offline ou responde erro", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Offline"));
    expect(await listAllMergedServerTickets()).toEqual([]);
  });

  it("busca bilhete por código único normalizando espaços e letras maiúsculas", async () => {
    expect(await getServerTicketByCode("   ")).toBeNull();

    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ tickets: [mockTicketNew] }), {
        status: 200,
      }),
    );

    const found = await getServerTicketByCode(" pe-200002 ");
    expect(found?.codigo).toBe("PE-200002");
    expect(String(spy.mock.calls[0][0])).toContain("codigos=PE-200002");
  });

  it("busca múltiplos códigos e ignora entradas vazias", async () => {
    expect(await getServerTicketsByCodes(["", "  "])).toEqual([]);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ tickets: [mockTicketOld, mockTicketNew] }),
        { status: 200 },
      ),
    );

    const list = await getServerTicketsByCodes(["pe-100001", "PE-200002"]);
    expect(list).toHaveLength(2);
  });

  it("cria bilhete (upsert) com fallback local resiliente quando o backend Python está indisponível", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Timeout"));

    const saved = await upsertServerTicket({
      codigo: "pe-555111",
      matchId: "m-sport",
      competicao: "PERNAMBUCANO",
      jogo: "Sport Recife x Náutico",
      estadio: "Ilha do Retiro",
      dataHorario: "03/Jan/2027",
      setor: "Sociais",
      subsetor: "Principal",
      portao: "03",
      enderecoPortao: "Rua Sport Club do Recife",
      titular: "Torcedor Teste",
      cpf: "123.456.789-00",
      biometriaOk: true,
    });

    expect(saved.codigo).toBe("PE-555111");
    expect(saved.status).toBe("pendente");
    expect(saved.createdAt).toBeTruthy();
  });

  it("revisa bilhete (aprovação e reprovação com motivo padrão no fallback)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"));

    const rejected = await reviewServerTicket({
      codigo: "pe-888999",
      decision: "reprovado",
      reviewedBy: "admin@pulsepe.gov.br",
      fallbackMeta: { titular: "Visitante" },
    });

    expect(rejected.codigo).toBe("PE-888999");
    expect(rejected.status).toBe("reprovado");
    expect(rejected.motivoReprovacao).toBe(
      "Entrada reprovada pela administração.",
    );
    expect(rejected.reviewedBy).toBe("admin@pulsepe.gov.br");

    const approved = await reviewServerTicket({
      codigo: "pe-888999",
      decision: "aprovado",
      reviewedBy: "admin@pulsepe.gov.br",
    });
    expect(approved.status).toBe("aprovado");
    expect(approved.motivoReprovacao).toBeUndefined();
  });

  it("exclui bilhete retornando booleano de acordo com status HTTP", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("{}", { status: 200 }),
    );
    expect(await deleteServerTicket("PE-100001")).toBe(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Erro", { status: 500 }),
    );
    expect(await deleteServerTicket("PE-100001")).toBe(false);
  });
});
