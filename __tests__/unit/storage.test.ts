import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatCPF,
  formatPhone,
  isValidCPF,
  computeSha256Hex,
  registerUserAccount,
  loginUserAccount,
  getLoggedUserEmail,
  setLoggedUserEmail,
  logoutUserSession,
  saveBiometricProfile,
  getStoredProfile,
  removeBiometricProfile,
  saveTicketAccess,
  getStoredTickets,
  getActiveTicket,
  removeTicketAccess,
  addSystemNotification,
  getStoredNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
} from "@/app/lib/storage";

describe("Módulo Unitário: app/lib/storage.ts", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  });

  describe("Formatação e Validação de CPF e Telefone", () => {
    it("formata CPF progressivamente e trunca acima de 11 dígitos", () => {
      expect(formatCPF("123")).toBe("123");
      expect(formatCPF("12345")).toBe("123.45");
      expect(formatCPF("12345678")).toBe("123.456.78");
      expect(formatCPF("12345678901")).toBe("123.456.789-01");
      expect(formatCPF("123.456.789-01999")).toBe("123.456.789-01");
    });

    it("valida se o CPF possui exatamente 11 dígitos numéricos", () => {
      expect(isValidCPF("123.456.789-01")).toBe(true);
      expect(isValidCPF("12345678901")).toBe(true);
      expect(isValidCPF("123.456.789")).toBe(false);
      expect(isValidCPF("")).toBe(false);
    });

    it("formata telefone fixo (10 dígitos) e celular (11 dígitos)", () => {
      expect(formatPhone("")).toBe("");
      expect(formatPhone("81")).toBe("(81");
      expect(formatPhone("813222")).toBe("(81) 3222");
      expect(formatPhone("8132224455")).toBe("(81) 3222-4455");
      expect(formatPhone("81988776655")).toBe("(81) 98877-6655");
    });
  });

  describe("Criptografia SHA-256", () => {
    it("gera hash SHA-256 hexadecimal determinístico de 64 caracteres", async () => {
      const hash1 = await computeSha256Hex("PulsePE@2026");
      const hash2 = await computeSha256Hex("PulsePE@2026");
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it("retorna string vazia quando entrada for vazia", async () => {
      expect(await computeSha256Hex("")).toBe("");
    });
  });

  describe("Cadastro, Login e Sessão de Conta do Torcedor", () => {
    it("rejeita cadastro com e-mail vazio ou senha menor que 4 caracteres", async () => {
      const invalidPass = await registerUserAccount({
        nome: "Teste",
        email: "teste@pe.com",
        cpf: "12345678901",
        password: "123",
      });
      expect(invalidPass.ok).toBe(false);
    });

    it("cadastra conta válida, impede duplicidade de e-mail e autentica login com sucesso", async () => {
      const created = await registerUserAccount({
        nome: "Torcedor Rubro Negro",
        email: "  TORCEDOR@Sport.com ",
        cpf: "11122233344",
        password: "senhaForte123",
        matricula: "9988",
      });

      expect(created.ok).toBe(true);
      if (created.ok) {
        expect(created.account.email).toBe("torcedor@sport.com");
        expect(created.account.cpf).toBe("111.222.333-44");
      }

      // Impede e-mail duplicado
      const duplicate = await registerUserAccount({
        nome: "Outro Nome",
        email: "torcedor@sport.com",
        cpf: "11122233344",
        password: "outraSenha",
      });
      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error).toContain("já está cadastrado");
      }

      // Logout e tentativa com senha incorreta
      logoutUserSession();
      expect(getLoggedUserEmail()).toBeNull();

      const wrongLogin = await loginUserAccount(
        "torcedor@sport.com",
        "errada",
      );
      expect(wrongLogin.ok).toBe(false);

      // Login correto
      const okLogin = await loginUserAccount(
        "torcedor@sport.com",
        "senhaForte123",
      );
      expect(okLogin.ok).toBe(true);
      expect(getLoggedUserEmail()).toBe("torcedor@sport.com");
    });
  });

  describe("Perfil Biométrico, Ingressos e Notificações", () => {
    it("isola perfis biométricos por e-mail e gera hash da imagem facial", async () => {
      setLoggedUserEmail("ana@pulsepe.com");
      const saved = await saveBiometricProfile({
        nome: "Ana Beatriz",
        email: "ana@pulsepe.com",
        faceImageDataUrl: "data:image/jpeg;base64,FACE_ANA",
      });

      expect(saved.faceLocked).toBe(true);
      expect(saved.livenessVerified).toBe(true);
      expect(saved.faceHashSha256).toHaveLength(64);
      expect(getStoredProfile("ana@pulsepe.com")?.nome).toBe("Ana Beatriz");
      expect(getStoredProfile("outro@pulsepe.com")).toBeNull();

      await removeBiometricProfile();
    });

    it("salva, lista, atualiza e remove ingressos gerando notificação automática", () => {
      setLoggedUserEmail("socio@ilha.com");

      const ticket = saveTicketAccess({
        matchId: "m-1",
        codigoIngresso: "PE-777888",
        competicao: "PERNAMBUCANO",
        temporada: "2027",
        mandante: "Sport Recife",
        mandanteSigla: "SPO",
        mandanteCor: "#c8102e",
        visitante: "Náutico",
        visitanteSigla: "NAU",
        visitanteCor: "#d91c24",
        estadio: "Ilha do Retiro",
        dataHorario: "03/Jan/2027, 16:00",
        aberturaPortoes: "14:00",
        setor: "Sociais",
        subsetor: "Portaria Principal",
        portao: "03",
        enderecoPortao: "Rua Sport Club do Recife",
        tipoAcesso: "Catraca Express",
        fila: "Fila Facial Dedicada",
        fonte: "FPF-PE",
      });

      expect(getStoredTickets()).toHaveLength(1);
      expect(getActiveTicket()?.codigoIngresso).toBe("PE-777888");
      expect(getStoredNotifications()[0]?.selo).toBe("INGRESSO CONFIRMADO");

      // Atualiza ingresso existente mantendo ID
      saveTicketAccess(
        {
          ...ticket,
          setor: "Camarotes",
          portao: "01",
        },
        ticket.id,
      );
      expect(getActiveTicket()?.setor).toBe("Camarotes");

      removeTicketAccess(ticket.id);
      expect(getStoredTickets()).toHaveLength(0);
      expect(getActiveTicket()).toBeNull();
    });

    it("marca notificações individuais/todas como lidas e limpa histórico", () => {
      setLoggedUserEmail("avisos@ilha.com");

      const n1 = addSystemNotification({
        categoria: "acesso",
        selo: "CATRACA",
        titulo: "Entrada 1",
        mensagem: "Liberada",
      });
      addSystemNotification({
        categoria: "clube",
        selo: "AVISO",
        titulo: "Comunicado 2",
        mensagem: "Portões abertos",
      });

      expect(getStoredNotifications().filter((n) => !n.lida)).toHaveLength(2);

      markNotificationRead(n1.id);
      expect(getStoredNotifications().filter((n) => !n.lida)).toHaveLength(1);

      markAllNotificationsRead();
      expect(getStoredNotifications().filter((n) => !n.lida)).toHaveLength(0);

      clearNotifications();
      expect(getStoredNotifications()).toHaveLength(0);
    });
  });
});
