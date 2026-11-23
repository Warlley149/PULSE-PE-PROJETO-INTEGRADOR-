import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "pulse_pe_admin_session";

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  "pulse-pe-sds-admin-secret-key-2026-change-in-prod";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@pulsepe.gov.br";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "PulsePE@2026";

export interface AdminSessionPayload {
  email: string;
  role: "admin";
  iat: number;
  exp: number;
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
}

export function validateAdminCredentials(
  email: string,
  password: string,
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const expectedEmail = ADMIN_EMAIL.trim().toLowerCase();

  const emailBuf = Buffer.from(normalizedEmail);
  const expectedEmailBuf = Buffer.from(expectedEmail);
  const passBuf = Buffer.from(password);
  const expectedPassBuf = Buffer.from(ADMIN_PASSWORD);

  const emailMatch =
    emailBuf.length === expectedEmailBuf.length &&
    crypto.timingSafeEqual(emailBuf, expectedEmailBuf);
  const passMatch =
    passBuf.length === expectedPassBuf.length &&
    crypto.timingSafeEqual(passBuf, expectedPassBuf);

  return emailMatch && passMatch;
}

export function createSessionToken(email: string): string {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    email,
    role: "admin",
    iat: now,
    exp: now + 1000 * 60 * 60 * 8, // 8 hours
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
): AdminSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, providedSig] = parts;
  const expectedSig = signPayload(payloadB64);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as AdminSessionPayload;
    if (decoded.role !== "admin" || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
