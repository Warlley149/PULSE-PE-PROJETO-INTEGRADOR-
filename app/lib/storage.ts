export interface DependentMember {
  id: string;
  nome: string;
  parentesco: string;
  documento: string;
}

export interface BiometricProfile {
  id: string;
  nome: string;
  cpf: string;
  documentoIdentificacao: string;
  orgaoEmissor: string;
  matricula: string;
  plano: string;
  categoria: string;
  membroDesde: string;
  email: string;
  telefone: string;
  faceImageDataUrl: string;
  faceHashSha256: string;
  faceQualityScore: number;
  imageWidth: number;
  imageHeight: number;
  livenessVerified: boolean;
  dependentes: DependentMember[];
  acessibilidade: string;
  alertasPortao: boolean;
  catracaTempoReal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAccess {
  id: string;
  competicao: string;
  temporada: string;
  mandante: string;
  visitante: string;
  dataHorario: string;
  aberturaPortoes: string;
  setor: string;
  subsetor: string;
  portao: string;
  enderecoPortao: string;
  tipoAcesso: string;
  fila: string;
  createdAt: string;
}

export type NotificationCategory = "acesso" | "partidas" | "clube";

export interface SystemNotification {
  id: string;
  categoria: NotificationCategory;
  selo: string;
  titulo: string;
  mensagem: string;
  detalheRodape?: string;
  createdAt: string;
  lida: boolean;
}

const STORAGE_KEYS = {
  PROFILE: "pulse_pe_real_profile_v2",
  TICKETS: "pulse_pe_real_tickets_v2",
  NOTIFICATIONS: "pulse_pe_real_notifications_v2",
} as const;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/biometria";

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10), 10);
}

export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle && input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "";
}

export function getStoredProfile(): BiometricProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) return null;
    return JSON.parse(raw) as BiometricProfile;
  } catch {
    return null;
  }
}

export async function saveBiometricProfile(
  partial: Partial<BiometricProfile>,
): Promise<BiometricProfile> {
  const existing = getStoredProfile();
  const now = new Date().toISOString();
  const nextFaceUrl =
    partial.faceImageDataUrl !== undefined
      ? partial.faceImageDataUrl
      : existing?.faceImageDataUrl || "";

  const faceHashSha256 = nextFaceUrl
    ? await computeSha256Hex(nextFaceUrl)
    : existing?.faceHashSha256 || "";

  const record: BiometricProfile = {
    id: existing?.id || crypto.randomUUID(),
    nome: (partial.nome ?? existing?.nome ?? "").trim(),
    cpf: (partial.cpf ?? existing?.cpf ?? "").trim(),
    documentoIdentificacao: (
      partial.documentoIdentificacao ??
      existing?.documentoIdentificacao ??
      ""
    ).trim(),
    orgaoEmissor: (partial.orgaoEmissor ?? existing?.orgaoEmissor ?? "").trim(),
    matricula: (partial.matricula ?? existing?.matricula ?? "").trim(),
    plano: (partial.plano ?? existing?.plano ?? "").trim(),
    categoria: (partial.categoria ?? existing?.categoria ?? "").trim(),
    membroDesde: (
      partial.membroDesde ??
      existing?.membroDesde ??
      new Date().toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
    ).trim(),
    email: (partial.email ?? existing?.email ?? "").trim(),
    telefone: (partial.telefone ?? existing?.telefone ?? "").trim(),
    faceImageDataUrl: nextFaceUrl,
    faceHashSha256,
    faceQualityScore:
      partial.faceQualityScore ?? existing?.faceQualityScore ?? 0,
    imageWidth: partial.imageWidth ?? existing?.imageWidth ?? 0,
    imageHeight: partial.imageHeight ?? existing?.imageHeight ?? 0,
    livenessVerified:
      partial.livenessVerified ??
      existing?.livenessVerified ??
      Boolean(nextFaceUrl),
    dependentes: partial.dependentes ?? existing?.dependentes ?? [],
    acessibilidade: (
      partial.acessibilidade ??
      existing?.acessibilidade ??
      ""
    ).trim(),
    alertasPortao: partial.alertasPortao ?? existing?.alertasPortao ?? true,
    catracaTempoReal:
      partial.catracaTempoReal ?? existing?.catracaTempoReal ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(record));
  }

  try {
    await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch {
    // Persisted locally until external backend is connected
  }

  return record;
}

export async function removeBiometricProfile(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEYS.PROFILE);
  }
  try {
    await fetch(API_BASE_URL, { method: "DELETE" });
  } catch {
    // Ignore if external backend is offline
  }
}

export function getStoredTickets(): TicketAccess[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!raw) return [];
    return JSON.parse(raw) as TicketAccess[];
  } catch {
    return [];
  }
}

export function getActiveTicket(): TicketAccess | null {
  const list = getStoredTickets();
  return list.length > 0 ? list[0] : null;
}

export function saveTicketAccess(
  ticket: Omit<TicketAccess, "id" | "createdAt">,
  existingId?: string,
): TicketAccess {
  const list = getStoredTickets();
  const now = new Date().toISOString();

  const record: TicketAccess = {
    ...ticket,
    id: existingId || crypto.randomUUID(),
    createdAt: now,
  };

  const filtered = existingId
    ? list.map((t) => (t.id === existingId ? record : t))
    : [record, ...list];

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(filtered));
  }

  addSystemNotification({
    categoria: "partidas",
    selo: "INGRESSO CONFIRMADO",
    titulo: `${record.mandante} x ${record.visitante}`,
    mensagem: `Ingresso para o setor ${record.setor}${record.subsetor ? ` (${record.subsetor})` : ""} vinculado ao Portão ${record.portao}.`,
    detalheRodape: record.enderecoPortao
      ? `Acesso via ${record.enderecoPortao} • Portão ${record.portao}`
      : `Portão ${record.portao}`,
  });

  return record;
}

export function removeTicketAccess(id: string): void {
  const list = getStoredTickets().filter((t) => t.id !== id);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(list));
  }
}

export function getStoredNotifications(): SystemNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) return [];
    return JSON.parse(raw) as SystemNotification[];
  } catch {
    return [];
  }
}

export function addSystemNotification(input: {
  categoria: NotificationCategory;
  selo: string;
  titulo: string;
  mensagem: string;
  detalheRodape?: string;
}): SystemNotification {
  const list = getStoredNotifications();
  const item: SystemNotification = {
    id: crypto.randomUUID(),
    categoria: input.categoria,
    selo: input.selo,
    titulo: input.titulo,
    mensagem: input.mensagem,
    detalheRodape: input.detalheRodape,
    createdAt: new Date().toISOString(),
    lida: false,
  };
  const updated = [item, ...list].slice(0, 100);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(updated),
    );
  }
  return item;
}

export function markAllNotificationsRead(): SystemNotification[] {
  const list = getStoredNotifications().map((n) => ({ ...n, lida: true }));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(list),
    );
  }
  return list;
}

export function clearNotifications(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
  }
}
