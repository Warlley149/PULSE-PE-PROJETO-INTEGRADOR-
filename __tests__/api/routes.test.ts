import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionToken, ADMIN_COOKIE_NAME } from "@/app/lib/admin-auth";

const cookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = cookieMap.get(name);
      return val ? { name, value: val } : undefined;
    },
  })),
}));

import {
  GET as adminLoginGET,
  POST as adminLoginPOST,
  DELETE as adminLoginDELETE,
} from "@/app/api/admin/login/route";
import {
  GET as biometriaGET,
  POST as biometriaPOST,
  DELETE as biometriaDELETE,
} from "@/app/api/biometria/route";
import {
  GET as ingressosGET,
  POST as ingressosPOST,
  DELETE as ingressosDELETE,
} from "@/app/api/ingressos/route";
import {
  GET as validarGET,
  POST as validarPOST,
} from "@/app/api/ingressos/validar/route";
import { GET as jogosGET } from "@/app/api/jogos/route";
import { GET as networkGET } from "@/app/api/network/route";

describe("Testes de Integração das Rotas de API (Next.js Route Handlers)", () => {
  beforeEach(() => {
    cookieMap.clear();
    vi.restoreAllMocks();
  });

  describe("API /api/admin/login", () => {
    it("retorna authenticated=false quando não há cookie de sessão", async () => {
      const res = await adminLoginGET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ authenticated: false, email: null });
    });

    it("rejeita login com senha incorreta retornando HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@pulsepe.gov.br",
          password: "errada",
        }),
      });
      const res = await adminLoginPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Credenciais inválidas");
    });

    it("aprova login válido retornando HTTP 200 e cookie HttpOnly assinado", async () => {
      const req = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: "ADMIN@pulsepe.gov.br",
          password: "PulsePE@2026",
        }),
      });
      const res = await adminLoginPOST(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        authenticated: true,
        email: "admin@pulsepe.gov.br",
      });
      expect(res.headers.get("set-cookie")).toContain(ADMIN_COOKIE_NAME);
    });

    it("retorna HTTP 500 se o corpo da requisição for JSON malformado e limpa sessão no DELETE", async () => {
      const badReq = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        body: "{json-invalido",
      });
      const badRes = await adminLoginPOST(badReq);
      expect(badRes.status).toBe(500);

      const delRes = await adminLoginDELETE();
      expect(delRes.status).toBe(200);
      expect(await delRes.json()).toEqual({ authenticated: false });
    });
  });

  describe("API /api/biometria", () => {
    it("suporta GET, POST (201 com sanitização) e DELETE", async () => {
      const getRes = await biometriaGET();
      expect(getRes.status).toBe(200);

      const postReq = new Request("http://localhost:3000/api/biometria", {
        method: "POST",
        body: JSON.stringify({
          nome: "  Torcedor PE  ",
          cpf: "123.456.789-00",
          faceImageDataUrl: "data:image/jpeg;base64,ABC",
          faceQualityScore: 99.1,
        }),
      });
      const postRes = await biometriaPOST(postReq);
      expect(postRes.status).toBe(201);
      const data = await postRes.json();
      expect(data.profile.nome).toBe("Torcedor PE");
      expect(data.profile.faceLocked).toBe(true);

      const delRes = await biometriaDELETE();
      expect(await delRes.json()).toEqual({ deleted: true });
    });
  });

  describe("API /api/ingressos & /api/ingressos/validar", () => {
    it("bloqueia listagem global de ingressos sem sessão de Admin (HTTP 401)", async () => {
      const res = await ingressosGET(
        new Request("http://localhost:3000/api/ingressos"),
      );
      expect(res.status).toBe(401);
    });

    it("rejeita criação de ingresso sem campos obrigatórios (HTTP 400) e aceita payload válido (HTTP 201)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const invalidReq = new Request("http://localhost:3000/api/ingressos", {
        method: "POST",
        body: JSON.stringify({ codigo: "" }),
      });
      expect((await ingressosPOST(invalidReq)).status).toBe(400);

      const validReq = new Request("http://localhost:3000/api/ingressos", {
        method: "POST",
        body: JSON.stringify({
          codigo: "PE-303030",
          jogo: "Sport Recife x Náutico",
          estadio: "Ilha do Retiro",
          setor: "Sociais",
          portao: "03",
          titular: "Carlos",
          biometriaOk: true,
        }),
      });
      const validRes = await ingressosPOST(validReq);
      expect(validRes.status).toBe(201);
      const saved = await validRes.json();
      expect(saved.ticket.codigo).toBe("PE-303030");
    });

    it("valida exclusão exigindo parâmetro codigo (HTTP 400 vs HTTP 200)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("{}", { status: 200 }),
      );

      const badDel = await ingressosDELETE(
        new Request("http://localhost:3000/api/ingressos", {
          method: "DELETE",
        }),
      );
      expect(badDel.status).toBe(400);

      const okDel = await ingressosDELETE(
        new Request("http://localhost:3000/api/ingressos?codigo=PE-303030", {
          method: "DELETE",
        }),
      );
      expect(okDel.status).toBe(200);
    });

    it("protege /api/ingressos/validar contra usuários não autenticados (401) e valida decisões quando ADM autenticado", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"));

      // Sem cookie de admin -> 401
      const unauthGet = await validarGET(
        new Request("http://localhost:3000/api/ingressos/validar"),
      );
      expect(unauthGet.status).toBe(401);

      const unauthPost = await validarPOST(
        new Request("http://localhost:3000/api/ingressos/validar", {
          method: "POST",
          body: JSON.stringify({ codigo: "PE-123456", decision: "aprovado" }),
        }),
      );
      expect(unauthPost.status).toBe(401);

      // Com cookie válido de admin
      cookieMap.set(
        ADMIN_COOKIE_NAME,
        createSessionToken("admin@pulsepe.gov.br"),
      );

      // Erro 400: código ausente
      const missingCode = await validarPOST(
        new Request("http://localhost:3000/api/ingressos/validar", {
          method: "POST",
          body: JSON.stringify({ decision: "aprovado" }),
        }),
      );
      expect(missingCode.status).toBe(400);

      // Erro 400: decisão inválida
      const badDecision = await validarPOST(
        new Request("http://localhost:3000/api/ingressos/validar", {
          method: "POST",
          body: JSON.stringify({ codigo: "PE-123456", decision: "invalida" }),
        }),
      );
      expect(badDecision.status).toBe(400);

      // Sucesso 200: aprovação administrativa
      const okValidate = await validarPOST(
        new Request("http://localhost:3000/api/ingressos/validar", {
          method: "POST",
          body: JSON.stringify({
            codigo: "PE-123456",
            decision: "aprovado",
            titular: "Warlley",
          }),
        }),
      );
      expect(okValidate.status).toBe(200);
      const body = await okValidate.json();
      expect(body.ticket.status).toBe("aprovado");
      expect(body.ticket.reviewedBy).toBe("admin@pulsepe.gov.br");
    });
  });

  describe("API /api/jogos e /api/network", () => {
    it("retorna catálogo oficial de partidas FPF-PE com setores configurados", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ events: [] }), { status: 200 }),
      );

      const res = await jogosGET(
        new Request("http://localhost:3000/api/jogos?_t=1"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.jogos)).toBe(true);
      expect(data.jogos.length).toBeGreaterThanOrEqual(5);
      expect(
        data.jogos.some(
          (j: { estadio: string }) => j.estadio === "Ilha do Retiro",
        ),
      ).toBe(true);
    });

    it("retorna informações de rede local em /api/network", async () => {
      const res = await networkGET(
        new Request("http://localhost:3000/api/network"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("lanIp");
      expect(data).toHaveProperty("lanOrigin");
    });
  });
});
