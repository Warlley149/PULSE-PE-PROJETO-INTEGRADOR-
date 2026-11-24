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

const PYTHON_API_URL = (
  process.env.NEXT_PUBLIC_PYTHON_API_URL || "https://pulse-pe-api.onrender.com"
).replace(/\/+$/, "");

async function fetchPython(
  urlPath: string,
  init?: RequestInit,
  timeoutMs = 20000,
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

/**
 * Fetches ALL tickets from EVERY user directly from Render + Supabase PostgreSQL.
 */
export async function listAllMergedServerTickets(): Promise<
  ServerTicketRecord[]
> {
  const res = await fetchPython("/api/v1/tickets");
  if (!res || !res.ok) return [];

  try {
    const data = (await res.json()) as { tickets?: ServerTicketRecord[] };
    if (!Array.isArray(data.tickets)) return [];
    return data.tickets.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return [];
  }
}

export async function getServerTicketByCode(
  codigo: string,
): Promise<ServerTicketRecord | null> {
  const code = codigo.trim().toUpperCase();
  if (!code) return null;

  const res = await fetchPython(
    `/api/v1/tickets?codigos=${encodeURIComponent(code)}`,
  );
  if (!res || !res.ok) return null;

  try {
    const data = (await res.json()) as { tickets?: ServerTicketRecord[] };
    return Array.isArray(data.tickets) && data.tickets.length > 0
      ? data.tickets[0]
      : null;
  } catch {
    return null;
  }
}

export async function getServerTicketsByCodes(
  codigos: string[],
): Promise<ServerTicketRecord[]> {
  const clean = codigos.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (clean.length === 0) return [];

  const res = await fetchPython(
    `/api/v1/tickets?codigos=${encodeURIComponent(clean.join(","))}`,
  );
  if (!res || !res.ok) return [];

  try {
    const data = (await res.json()) as { tickets?: ServerTicketRecord[] };
    return Array.isArray(data.tickets) ? data.tickets : [];
  } catch {
    return [];
  }
}

export async function upsertServerTicket(
  input: Omit<ServerTicketRecord, "status" | "createdAt"> & {
    status?: TicketValidationStatus;
    createdAt?: string;
  },
): Promise<ServerTicketRecord> {
  const code = input.codigo.trim().toUpperCase();
  const record: ServerTicketRecord = {
    ...input,
    codigo: code,
    status: input.status || "pendente",
    createdAt: input.createdAt || new Date().toISOString(),
  };

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
      // return record
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
  const code = params.codigo.trim().toUpperCase();
  const now = new Date().toISOString();
  const motivo =
    params.decision === "reprovado"
      ? (
          params.motivoReprovacao || "Entrada reprovada pela administração."
        ).trim()
      : "";

  const res = await fetchPython("/api/v1/tickets/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigo: code,
      decision: params.decision,
      motivoReprovacao: motivo,
      reviewedBy: params.reviewedBy,
    }),
  });
  if (res && res.ok) {
    try {
      const data = (await res.json()) as { ticket?: ServerTicketRecord };
      if (data.ticket) return data.ticket;
    } catch {
      // fallback response
    }
  }

  return {
    codigo: code,
    matchId: params.fallbackMeta?.matchId || "",
    competicao: params.fallbackMeta?.competicao || "",
    jogo: params.fallbackMeta?.jogo || "Partida Oficial",
    estadio: params.fallbackMeta?.estadio || "Arena PE",
    dataHorario: params.fallbackMeta?.dataHorario || "—",
    setor: params.fallbackMeta?.setor || "—",
    subsetor: params.fallbackMeta?.subsetor || "",
    portao: params.fallbackMeta?.portao || "—",
    enderecoPortao: params.fallbackMeta?.enderecoPortao || "",
    titular: params.fallbackMeta?.titular || "Titular não informado",
    cpf: params.fallbackMeta?.cpf || "",
    userEmail: params.fallbackMeta?.userEmail || "",
    biometriaOk: Boolean(params.fallbackMeta?.biometriaOk),
    createdAt: now,
    status: params.decision,
    motivoReprovacao: params.decision === "reprovado" ? motivo : undefined,
    reviewedAt: params.decision === "pendente" ? undefined : now,
    reviewedBy: params.decision === "pendente" ? undefined : params.reviewedBy,
  };
}

export async function deleteServerTicket(codigo: string): Promise<boolean> {
  const code = codigo.trim().toUpperCase();
  const res = await fetchPython(`/api/v1/tickets/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
  return Boolean(res && res.ok);
}
