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
  userEmail?: string;
  biometriaOk: boolean;
  status: TicketValidationStatus;
  motivoReprovacao?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const PYTHON_API_URL = (
  process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

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
    // ignore fs errors on read-only serverless environments (Vercel)
  }
}

async function fetchPython(
  urlPath: string,
  init?: RequestInit,
  timeoutMs = 15000,
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${PYTHON_API_URL}${urlPath}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res;
  } catch {
    return null;
  }
}

export function listAllServerTickets(): ServerTicketRecord[] {
  const map = readDiskTickets();
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Merges tickets from the Python/Supabase back-end AND local disk so the Admin
 * portal ALWAYS displays every ticket from every user (both locally and on Vercel).
 */
export async function listAllMergedServerTickets(): Promise<
  ServerTicketRecord[]
> {
  const map = readDiskTickets();
  let changed = false;

  const res = await fetchPython("/api/v1/tickets");
  if (res && res.ok) {
    try {
      const data = (await res.json()) as { tickets?: ServerTicketRecord[] };
      if (Array.isArray(data.tickets)) {
        for (const pyTicket of data.tickets) {
          if (!pyTicket?.codigo) continue;
          const code = pyTicket.codigo.trim().toUpperCase();
          const local = map.get(code);
          if (!local) {
            map.set(code, { ...pyTicket, codigo: code });
            changed = true;
          } else {
            const localRev = local.reviewedAt
              ? new Date(local.reviewedAt).getTime()
              : 0;
            const pyRev = pyTicket.reviewedAt
              ? new Date(pyTicket.reviewedAt).getTime()
              : 0;
            const merged: ServerTicketRecord =
              pyRev >= localRev
                ? {
                    ...local,
                    ...pyTicket,
                    codigo: code,
                    userEmail: pyTicket.userEmail || local.userEmail,
                  }
                : {
                    ...pyTicket,
                    ...local,
                    codigo: code,
                    userEmail: local.userEmail || pyTicket.userEmail,
                  };
            map.set(code, merged);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  if (changed) {
    writeDiskTickets(map);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getServerTicketByCode(
  codigo: string,
): Promise<ServerTicketRecord | null> {
  const code = codigo.trim().toUpperCase();
  if (!code) return null;

  const res = await fetchPython(
    `/api/v1/tickets?codigos=${encodeURIComponent(code)}`,
  );
  if (res && res.ok) {
    try {
      const data = (await res.json()) as { tickets?: ServerTicketRecord[] };
      if (Array.isArray(data.tickets) && data.tickets.length > 0) {
        return data.tickets[0];
      }
    } catch {
      // fallback to local disk
    }
  }

  const map = readDiskTickets();
  return map.get(code) || null;
}

export async function getServerTicketsByCodes(
  codigos: string[],
): Promise<ServerTicketRecord[]> {
  const clean = codigos.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (clean.length === 0) return [];

  const resultMap = new Map<string, ServerTicketRecord>();
  const diskMap = readDiskTickets();
  for (const c of clean) {
    const local = diskMap.get(c);
    if (local) resultMap.set(c, local);
  }

  const res = await fetchPython(
    `/api/v1/tickets?codigos=${encodeURIComponent(clean.join(","))}`,
  );
  if (res && res.ok) {
    try {
      const data = (await res.json()) as { tickets?: ServerTicketRecord[] };
      if (Array.isArray(data.tickets)) {
        for (const item of data.tickets) {
          if (item?.codigo) {
            resultMap.set(item.codigo.trim().toUpperCase(), item);
          }
        }
      }
    } catch {
      // ignore parse error
    }
  }

  return Array.from(resultMap.values());
}

export async function upsertServerTicket(
  input: Omit<ServerTicketRecord, "status" | "createdAt"> & {
    status?: TicketValidationStatus;
    createdAt?: string;
  },
): Promise<ServerTicketRecord> {
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

  // Await persistence on Python/Supabase so Vercel Serverless never drops it
  const res = await fetchPython("/api/v1/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (res && res.ok) {
    try {
      const data = (await res.json()) as { ticket?: ServerTicketRecord };
      if (data.ticket) return data.ticket;
    } catch {
      // return local record
    }
  }

  return record;
}

export async function reviewServerTicket(params: {
  codigo: string;
  decision: "aprovado" | "reprovado" | "pendente";
  motivoReprovacao?: string;
  reviewedBy: string;
  fallbackMeta?: Partial<ServerTicketRecord>;
}): Promise<ServerTicketRecord> {
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
    userEmail: existing?.userEmail || params.fallbackMeta?.userEmail || "",
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

  // Await review update on Python/Supabase so Vercel Serverless persists it
  const res = await fetchPython("/api/v1/tickets/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigo: code,
      decision: params.decision,
      motivoReprovacao: updated.motivoReprovacao || "",
      reviewedBy: params.reviewedBy,
    }),
  });
  if (res && res.ok) {
    try {
      const data = (await res.json()) as { ticket?: ServerTicketRecord };
      if (data.ticket) return data.ticket;
    } catch {
      // return local updated
    }
  }

  return updated;
}

export async function deleteServerTicket(codigo: string): Promise<boolean> {
  const map = readDiskTickets();
  const code = codigo.trim().toUpperCase();
  const existed = map.delete(code);
  if (existed) {
    writeDiskTickets(map);
  }
  const res = await fetchPython(`/api/v1/tickets/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
  return existed || Boolean(res && res.ok);
}
