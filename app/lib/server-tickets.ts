import fs from "fs";
import path from "path";

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

const DATA_DIR = path.join(process.cwd(), "data");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const PYTHON_API_URL =
  process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://127.0.0.1:8000";

function readDiskTickets(): Map<string, ServerTicketRecord> {
  const map = new Map<string, ServerTicketRecord>();
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const raw = fs.readFileSync(TICKETS_FILE, "utf8");
      const arr = JSON.parse(raw) as ServerTicketRecord[];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item?.codigo) {
            map.set(item.codigo.trim().toUpperCase(), item);
          }
        }
      }
    }
  } catch {
    // ignore corrupt/missing file
  }
  return map;
}

function writeDiskTickets(map: Map<string, ServerTicketRecord>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const sorted = Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(sorted, null, 2), "utf8");
  } catch {
    // ignore fs errors on read-only serverless environments
  }
}

export function listAllServerTickets(): ServerTicketRecord[] {
  const map = readDiskTickets();
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getServerTicketByCode(
  codigo: string,
): ServerTicketRecord | null {
  const map = readDiskTickets();
  return map.get(codigo.trim().toUpperCase()) || null;
}

export function upsertServerTicket(
  input: Omit<ServerTicketRecord, "status" | "createdAt"> & {
    status?: TicketValidationStatus;
    createdAt?: string;
  },
): ServerTicketRecord {
  const map = readDiskTickets();
  const code = input.codigo.trim().toUpperCase();
  const existing = map.get(code);

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

  map.set(code, record);
  writeDiskTickets(map);

  // Also mirror to Python SQLite database asynchronously
  void fetch(`${PYTHON_API_URL}/api/v1/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => {});

  return record;
}

export function reviewServerTicket(params: {
  codigo: string;
  decision: "aprovado" | "reprovado" | "pendente";
  motivoReprovacao?: string;
  reviewedBy: string;
  fallbackMeta?: Partial<ServerTicketRecord>;
}): ServerTicketRecord {
  const map = readDiskTickets();
  const code = params.codigo.trim().toUpperCase();
  const existing = map.get(code);
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

  map.set(code, updated);
  writeDiskTickets(map);

  // Also mirror review decision to Python SQLite database
  void fetch(`${PYTHON_API_URL}/api/v1/tickets/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigo: code,
      decision: params.decision,
      motivoReprovacao: updated.motivoReprovacao || "",
      reviewedBy: params.reviewedBy,
    }),
  }).catch(() => {});

  return updated;
}

export function deleteServerTicket(codigo: string): boolean {
  const map = readDiskTickets();
  const code = codigo.trim().toUpperCase();
  const existed = map.delete(code);
  if (existed) {
    writeDiskTickets(map);
  }
  void fetch(`${PYTHON_API_URL}/api/v1/tickets/${encodeURIComponent(code)}`, {
    method: "DELETE",
  }).catch(() => {});
  return existed;
}
