export interface BiometricProfile {
  id: string;
  nome: string;
  cpf: string;
  matricula: string;
  categoria: string;
  email: string;
  telefone: string;
  faceImageDataUrl: string;
  faceHashSha256: string;
  imageWidth: number;
  imageHeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAccess {
  id: string;
  competicao: string;
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

export interface SystemNotification {
  id: string;
  titulo: string;
  mensagem: string;
  createdAt: string;
  lida: boolean;
}

const STORAGE_KEYS = {
  PROFILE: "pulse_pe_biometric_profile_v1",
  TICKET: "pulse_pe_ticket_access_v1",
  NOTIFICATIONS: "pulse_pe_notifications_v1",
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
  if (typeof window !== "undefined" && window.crypto?.subtle) {
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
  profileData: Omit<
    BiometricProfile,
    "id" | "faceHashSha256" | "createdAt" | "updatedAt"
  >,
): Promise<BiometricProfile> {
  const existing = getStoredProfile();
  const now = new Date().toISOString();
  const faceHashSha256 = await computeSha256Hex(profileData.faceImageDataUrl);

  const record: BiometricProfile = {
    ...profileData,
    id: existing?.id || crypto.randomUUID(),
    faceHashSha256,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(record));
  }

  addSystemNotification(
    existing ? "Biometria facial atualizada" : "Biometria facial cadastrada",
    `Cadastro facial de ${record.nome} registrado e pronto para sincronização.`,
  );

  try {
    await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch {
    // Offline or external backend not yet connected; data remains safely persisted locally
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
    // Ignore network error if external backend is offline
  }
}

export function getStoredTicket(): TicketAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.TICKET);
    if (!raw) return null;
    return JSON.parse(raw) as TicketAccess;
  } catch {
    return null;
  }
}

export function saveTicketAccess(
  ticket: Omit<TicketAccess, "id" | "createdAt">,
): TicketAccess {
  const record: TicketAccess = {
    ...ticket,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.TICKET, JSON.stringify(record));
  }
  addSystemNotification(
    "Ingresso vinculado",
    `${record.mandante} vs ${record.visitante} (${record.setor} • Portão ${record.portao}).`,
  );
  return record;
}

export function removeTicketAccess(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEYS.TICKET);
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

export function addSystemNotification(
  titulo: string,
  mensagem: string,
): SystemNotification {
  const list = getStoredNotifications();
  const item: SystemNotification = {
    id: crypto.randomUUID(),
    titulo,
    mensagem,
    createdAt: new Date().toISOString(),
    lida: false,
  };
  const updated = [item, ...list].slice(0, 50);
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
