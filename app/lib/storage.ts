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
  faceFingerprintId: string;
  faceHashSha256: string;
  faceQualityScore: number;
  imageWidth: number;
  imageHeight: number;
  livenessVerified: boolean;
  faceLocked: boolean;
  dependentes: DependentMember[];
  acessibilidade: string;
  alertasPortao: boolean;
  catracaTempoReal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAccess {
  id: string;
  matchId: string;
  codigoIngresso: string;
  competicao: string;
  temporada: string;
  mandante: string;
  mandanteSigla: string;
  mandanteCor: string;
  mandanteLogoUrl?: string;
  visitante: string;
  visitanteSigla: string;
  visitanteCor: string;
  visitanteLogoUrl?: string;
  estadio: string;
  dataHorario: string;
  aberturaPortoes: string;
  setor: string;
  subsetor: string;
  portao: string;
  enderecoPortao: string;
  tipoAcesso: string;
  fila: string;
  fonte: string;
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

export interface UserAccount {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  passwordHash: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  PROFILE: "pulse_pe_real_profile_v2",
  TICKETS: "pulse_pe_real_tickets_v2",
  NOTIFICATIONS: "pulse_pe_real_notifications_v2",
  ACCOUNTS: "pulse_pe_user_accounts_v1",
  SESSION_EMAIL: "pulse_pe_user_session_email_v1",
} as const;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/biometria";
const PYTHON_API_URL = (
  process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

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
  return clean.length === 11;
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

function getProfileStorageKey(email?: string | null): string | null {
  const activeEmail = (email ?? getLoggedUserEmail() ?? "")
    .trim()
    .toLowerCase();
  if (!activeEmail) return null;
  return `${STORAGE_KEYS.PROFILE}_${activeEmail}`;
}

export function getStoredProfile(
  email?: string | null,
): BiometricProfile | null {
  if (typeof window === "undefined") return null;
  const key = getProfileStorageKey(email);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as BiometricProfile;
  } catch {
    return null;
  }
}

export async function saveBiometricProfile(
  partial: Partial<BiometricProfile>,
): Promise<BiometricProfile> {
  const targetEmail = (partial.email ?? getLoggedUserEmail() ?? "")
    .trim()
    .toLowerCase();
  const existing = getStoredProfile(targetEmail);
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
    faceFingerprintId:
      partial.faceFingerprintId ?? existing?.faceFingerprintId ?? "",
    faceHashSha256,
    faceQualityScore:
      partial.faceQualityScore ?? existing?.faceQualityScore ?? 0,
    imageWidth: partial.imageWidth ?? existing?.imageWidth ?? 0,
    imageHeight: partial.imageHeight ?? existing?.imageHeight ?? 0,
    livenessVerified:
      partial.livenessVerified ??
      existing?.livenessVerified ??
      Boolean(nextFaceUrl),
    faceLocked:
      partial.faceLocked ?? existing?.faceLocked ?? Boolean(nextFaceUrl),
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
    const key = getProfileStorageKey(record.email);
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(record));
    }
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

  // Also sync profile edits (dependents, documento, acessibilidade, canais) to Python SQLite
  if (record.email) {
    void fetch(`${PYTHON_API_URL}/api/v1/users/perfil`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: record.email,
        nome: record.nome,
        matricula: record.matricula,
        plano: record.plano,
        categoria: record.categoria,
        membroDesde: record.membroDesde,
        telefone: record.telefone,
        documentoIdentificacao: record.documentoIdentificacao,
        orgaoEmissor: record.orgaoEmissor,
        acessibilidade: record.acessibilidade,
        alertasPortao: record.alertasPortao,
        catracaTempoReal: record.catracaTempoReal,
        dependentes: record.dependentes,
      }),
    }).catch(() => {});
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

function getTicketsStorageKey(email?: string | null): string | null {
  const activeEmail = (email ?? getLoggedUserEmail() ?? "")
    .trim()
    .toLowerCase();
  if (!activeEmail) return null;
  return `${STORAGE_KEYS.TICKETS}_${activeEmail}`;
}

export function getStoredTickets(email?: string | null): TicketAccess[] {
  if (typeof window === "undefined") return [];
  const key = getTicketsStorageKey(email);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as TicketAccess[];
  } catch {
    return [];
  }
}

export function getActiveTicket(email?: string | null): TicketAccess | null {
  const list = getStoredTickets(email);
  return list.length > 0 ? list[0] : null;
}

export function saveTicketAccess(
  ticket: Omit<TicketAccess, "id" | "createdAt">,
  existingId?: string,
  email?: string | null,
): TicketAccess {
  const list = getStoredTickets(email);
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
    const key = getTicketsStorageKey(email);
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(filtered));
    }
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

export function removeTicketAccess(id: string, email?: string | null): void {
  const list = getStoredTickets(email).filter((t) => t.id !== id);
  if (typeof window !== "undefined") {
    const key = getTicketsStorageKey(email);
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(list));
    }
  }
}

function getNotificationsStorageKey(email?: string | null): string | null {
  const activeEmail = (email ?? getLoggedUserEmail() ?? "")
    .trim()
    .toLowerCase();
  if (!activeEmail) return null;
  return `${STORAGE_KEYS.NOTIFICATIONS}_${activeEmail}`;
}

export function getStoredNotifications(
  email?: string | null,
): SystemNotification[] {
  if (typeof window === "undefined") return [];
  const key = getNotificationsStorageKey(email);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
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
    const key = getNotificationsStorageKey();
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(updated));
    }
    const currentEmail =
      window.localStorage.getItem(STORAGE_KEYS.SESSION_EMAIL) || "";
    void fetch(`${PYTHON_API_URL}/api/v1/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: currentEmail,
        categoria: item.categoria,
        selo: item.selo,
        titulo: item.titulo,
        mensagem: item.mensagem,
        detalheRodape: item.detalheRodape || "",
      }),
    }).catch(() => {});
  }
  return item;
}

export function markNotificationRead(id: string): SystemNotification[] {
  const list = getStoredNotifications().map((n) =>
    n.id === id ? { ...n, lida: true } : n,
  );
  if (typeof window !== "undefined") {
    const key = getNotificationsStorageKey();
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(list));
    }
  }
  return list;
}

export function markAllNotificationsRead(): SystemNotification[] {
  const list = getStoredNotifications().map((n) => ({ ...n, lida: true }));
  if (typeof window !== "undefined") {
    const key = getNotificationsStorageKey();
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(list));
    }
  }
  return list;
}

export function clearNotifications(): void {
  if (typeof window !== "undefined") {
    const key = getNotificationsStorageKey();
    if (key) {
      window.localStorage.removeItem(key);
    }
  }
}

export function setLoggedUserEmail(email: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEYS.SESSION_EMAIL,
      email.trim().toLowerCase(),
    );
  }
}

export function getLoggedUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEYS.SESSION_EMAIL);
}

export function logoutUserSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEYS.SESSION_EMAIL);
  }
}

export async function registerUserAccount(input: {
  nome: string;
  email: string;
  cpf: string;
  password: string;
  matricula?: string;
}): Promise<{ ok: true; account: UserAccount } | { ok: false; error: string }> {
  const emailNorm = input.email.trim().toLowerCase();
  if (!emailNorm || !input.password || input.password.length < 4) {
    return {
      ok: false,
      error:
        "Informe um e-mail válido e uma senha com pelo menos 4 caracteres.",
    };
  }

  let accounts: UserAccount[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (raw) accounts = JSON.parse(raw) as UserAccount[];
    } catch {
      accounts = [];
    }
  }

  if (accounts.some((a) => a.email === emailNorm)) {
    return { ok: false, error: "Este e-mail já está cadastrado. Faça login." };
  }

  const passwordHash = await computeSha256Hex(input.password);
  const account: UserAccount = {
    id: crypto.randomUUID(),
    nome: input.nome.trim(),
    email: emailNorm,
    cpf: formatCPF(input.cpf),
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEYS.ACCOUNTS,
      JSON.stringify(accounts),
    );
    window.localStorage.setItem(STORAGE_KEYS.SESSION_EMAIL, account.email);
  }

  await saveBiometricProfile({
    nome: account.nome,
    email: account.email,
    cpf: account.cpf,
    matricula: (input.matricula || "").trim(),
  });

  return { ok: true, account };
}

export async function loginUserAccount(
  email: string,
  password: string,
): Promise<{ ok: true; account: UserAccount } | { ok: false; error: string }> {
  const emailNorm = email.trim().toLowerCase();
  if (typeof window === "undefined") {
    return { ok: false, error: "Ambiente indisponível." };
  }

  let accounts: UserAccount[] = [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (raw) accounts = JSON.parse(raw) as UserAccount[];
  } catch {
    accounts = [];
  }

  const found = accounts.find((a) => a.email === emailNorm);
  if (!found) {
    return {
      ok: false,
      error:
        "E-mail ou senha incorretos. Cadastre-se caso ainda não tenha conta.",
    };
  }

  const hash = await computeSha256Hex(password);
  if (hash !== found.passwordHash) {
    return { ok: false, error: "E-mail ou senha incorretos." };
  }

  window.localStorage.setItem(STORAGE_KEYS.SESSION_EMAIL, found.email);
  await saveBiometricProfile({
    nome: found.nome,
    email: found.email,
    cpf: found.cpf,
  });

  return { ok: true, account: found };
}
