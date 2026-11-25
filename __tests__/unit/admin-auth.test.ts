import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateAdminCredentials,
  createSessionToken,
  verifySessionToken,
} from "@/app/lib/admin-auth";

describe("Módulo Unitário: app/lib/admin-auth.ts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("valida credenciais oficiais do administrador de forma timing-safe e case-insensitive no e-mail", () => {
    expect(
      validateAdminCredentials("admin@pulsepe.gov.br", "PulsePE@2026"),
    ).toBe(true);
    expect(
      validateAdminCredentials("  ADMIN@PULSEPE.GOV.BR  ", "PulsePE@2026"),
    ).toBe(true);
  });

  it("rejeita senha incorreta, e-mail incorreto ou tamanhos diferentes de buffer", () => {
    expect(
      validateAdminCredentials("admin@pulsepe.gov.br", "SenhaIncorreta"),
    ).toBe(false);
    expect(
      validateAdminCredentials("outro@pulsepe.gov.br", "PulsePE@2026"),
    ).toBe(false);
    expect(validateAdminCredentials("", "")).toBe(false);
  });

  it("cria token HMAC-SHA256 válido e verifica integridade e assinatura", () => {
    const token = createSessionToken("admin@pulsepe.gov.br");
    expect(token.split(".")).toHaveLength(2);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("admin@pulsepe.gov.br");
    expect(verified?.role).toBe("admin");
  });

  it("rejeita tokens adulterados, malformados ou ausentes", () => {
    const validToken = createSessionToken("admin@pulsepe.gov.br");
    const [payloadB64, sig] = validToken.split(".");

    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("token-sem-ponto")).toBeNull();
    expect(verifySessionToken(`${payloadB64}.assinaturaFalsa123`)).toBeNull();

    const forgedPayload = Buffer.from(
      JSON.stringify({
        email: "hacker@evil.com",
        role: "admin",
        iat: Date.now(),
        exp: Date.now() + 999999,
      }),
    ).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  it("rejeita token expirado após a janela de 8 horas", () => {
    vi.useFakeTimers();
    const start = new Date("2026-11-25T10:00:00Z");
    vi.setSystemTime(start);

    const token = createSessionToken("admin@pulsepe.gov.br");
    expect(verifySessionToken(token)).not.toBeNull();

    // Avança 8 horas e 1 minuto
    vi.setSystemTime(new Date(start.getTime() + 1000 * 60 * 60 * 8 + 60_000));
    expect(verifySessionToken(token)).toBeNull();
  });
});
