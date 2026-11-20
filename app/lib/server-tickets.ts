export type TicketValidationStatus = "pendente" | "aprovado" | "reprovado";

export interface ServerTicketRecord {
  codigo: string;
  matchId: string;
  competicao: string;
  jogo: string;
  estadio: string;
  dataHorario: string;
  setor: string;
  subsetor: string;
  portao: string;
  enderecoPortao: string;
  titular: string;
  cpf: string;
  biometriaOk: boolean;
  status: TicketValidationStatus;
  motivoReprovacao?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// Persist across hot-reloads in Next.js dev mode using globalThis
const globalForTickets = globalThis as unknown as {
  __pulsePeTicketsStore?: Map<string, ServerTicketRecord>;
};

function getStore(): Map<string, ServerTicketRecord> {
  if (!globalForTickets.__pulsePeTicketsStore) {
    globalForTickets.__pulsePeTicketsStore = new Map<
      string,
      ServerTicketRecord
    >();
  }
  return globalForTickets.__pulsePeTicketsStore;
}

export function listAllServerTickets(): ServerTicketRecord[] {
  return Array.from(getStore().values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getServerTicketByCode(
  codigo: string,
): ServerTicketRecord | null {
  return getStore().get(codigo.trim().toUpperCase()) || null;
}

export function upsertServerTicket(
  input: Omit<ServerTicketRecord, "status" | "createdAt"> & {
    status?: TicketValidationStatus;
    createdAt?: string;
  },
): ServerTicketRecord {
  const code = input.codigo.trim().toUpperCase();
  const existing = getStore().get(code);

  const record: ServerTicketRecord = {
    ...input,
    codigo: code,
    status: existing?.status || input.status || "pendente",
    motivoReprovacao: existing?.motivoReprovacao,
    reviewedAt: existing?.reviewedAt,
    reviewedBy: existing?.reviewedBy,
    createdAt:
      existing?.createdAt || input.createdAt || new Date().toISOString(),
  };

  getStore().set(code, record);
  return record;
}

export function reviewServerTicket(params: {
  codigo: string;
  decision: "aprovado" | "reprovado" | "pendente";
  motivoReprovacao?: string;
  reviewedBy: string;
  fallbackMeta?: Partial<ServerTicketRecord>;
}): ServerTicketRecord {
  const code = params.codigo.trim().toUpperCase();
  const existing = getStore().get(code);
  const now = new Date().toISOString();

  const updated: ServerTicketRecord = {
    codigo: code,
    matchId: existing?.matchId || params.fallbackMeta?.matchId || "",
    competicao: existing?.competicao || params.fallbackMeta?.competicao || "",
    jogo: existing?.jogo || params.fallbackMeta?.jogo || "Partida Oficial",
    estadio: existing?.estadio || params.fallbackMeta?.estadio || "Arena PE",
    dataHorario:
      existing?.dataHorario || params.fallbackMeta?.dataHorario || "—",
    setor: existing?.setor || params.fallbackMeta?.setor || "—",
    subsetor: existing?.subsetor || params.fallbackMeta?.subsetor || "",
    portao: existing?.portao || params.fallbackMeta?.portao || "—",
    enderecoPortao:
      existing?.enderecoPortao || params.fallbackMeta?.enderecoPortao || "",
    titular:
      existing?.titular ||
      params.fallbackMeta?.titular ||
      "Titular não informado",
    cpf: existing?.cpf || params.fallbackMeta?.cpf || "",
    biometriaOk:
      existing?.biometriaOk ?? Boolean(params.fallbackMeta?.biometriaOk),
    createdAt: existing?.createdAt || now,
    status: params.decision,
    motivoReprovacao:
      params.decision === "reprovado"
        ? (
            params.motivoReprovacao || "Entrada reprovada pela administração."
          ).trim()
        : undefined,
    reviewedAt: params.decision === "pendente" ? undefined : now,
    reviewedBy: params.decision === "pendente" ? undefined : params.reviewedBy,
  };

  getStore().set(code, updated);
  return updated;
}

export function deleteServerTicket(codigo: string): boolean {
  return getStore().delete(codigo.trim().toUpperCase());
}
