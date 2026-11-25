describe("Fluxo 03 — Painel Administrativo, Proteção de Rota e Auditoria de Catraca", () => {
  const initialAdminTickets = [
    {
      codigo: "PE-416170",
      matchId: "fpf-2027-frevo-sport-estreia",
      competicao: "CAMPEONATO PERNAMBUCANO",
      jogo: "Sport Recife x Náutico",
      estadio: "Ilha do Retiro",
      dataHorario: "03/Jan/2027, 16:00",
      setor: "Assento Especial",
      subsetor: "Portaria Principal",
      portao: "04",
      enderecoPortao: "Rua Sport Club do Recife",
      titular: "Warlley dos Santos Tenório",
      cpf: "123.456.789-00",
      userEmail: "warlley@pulsepe.com",
      biometriaOk: true,
      status: "pendente",
      createdAt: "2026-11-25T16:00:00.000Z",
    },
    {
      codigo: "PE-194927",
      matchId: "fpf-2027-frevo-sport-estreia",
      competicao: "CAMPEONATO PERNAMBUCANO",
      jogo: "Sport Recife x Náutico",
      estadio: "Ilha do Retiro",
      dataHorario: "03/Jan/2027, 16:00",
      setor: "Cadeiras de Ampliação",
      subsetor: "Portaria Principal",
      portao: "11",
      enderecoPortao: "Rua Sport Club do Recife",
      titular: "Carlos Kauã Santana",
      cpf: "987.654.321-11",
      userEmail: "carlos.kaua@pulsepe.com",
      biometriaOk: true,
      status: "aprovado",
      createdAt: "2026-11-25T15:30:00.000Z",
      reviewedAt: "2026-11-25T15:45:00.000Z",
      reviewedBy: "admin@pulsepe.gov.br",
    },
    {
      codigo: "PE-337378",
      matchId: "fpf-2026-forro-r1-pet-ame",
      competicao: "PERNAMBUCANO • TURNO FORRÓ",
      jogo: "Petrolina x América-PE",
      estadio: "Estádio Paulo Coelho",
      dataHorario: "Sáb, 21/11 • 16:00",
      setor: "Arquibancada Norte",
      subsetor: "Setor Popular",
      portao: "01",
      enderecoPortao: "Portão Norte",
      titular: "João Pedro Barros",
      cpf: "456.789.123-22",
      userEmail: "joao@pulsepe.com",
      biometriaOk: false,
      status: "pendente",
      createdAt: "2026-11-25T14:00:00.000Z",
    },
  ];

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it("CT-E2E-08 [ERRO]: Redireciona /validar para /admin e bloqueia tentativa de login administrativo com credenciais inválidas", () => {
    cy.visit("/validar?codigo=PE-416170");
    cy.url().should("include", "/admin?codigo=PE-416170");

    cy.contains("Login do Administrador").should("be.visible");
    cy.contains("ACESSO EXCLUSIVO ADM").should("be.visible");

    cy.get("#admin-email").type("invasor@arena.com");
    cy.get("#admin-password").type("SenhaIncorreta123");
    cy.contains("button", "Entrar no Painel ADM").click();

    cy.contains(
      "Credenciais inválidas. Acesso restrito ao administrador.",
    ).should("be.visible");

    cy.screenshot("11_login_admin_erro", {
      capture: "viewport",
      overwrite: true,
    });
  });

  it("CT-E2E-09 [SUCESSO + ERRO + SUCESSO]: Autentica Admin oficial, testa busca de código inexistente (erro), aprova bilhete e emite comprovante oficial", () => {
    cy.intercept("GET", "/api/ingressos?*", {
      statusCode: 200,
      body: { tickets: initialAdminTickets },
    }).as("listarBilhetes");

    cy.intercept("GET", "/api/ingressos/validar?codigo=PE-000999", {
      statusCode: 200,
      body: { ticket: null },
    }).as("buscarInexistente");

    cy.visit("/admin");

    // 1) Login Administrativo com SUCESSO (rota real /api/admin/login + cookie HttpOnly)
    cy.get("#admin-email").type("admin@pulsepe.gov.br");
    cy.get("#admin-password").type("PulsePE@2026");
    cy.contains("button", "Entrar no Painel ADM").click();

    cy.wait("@listarBilhetes");
    cy.contains("PULSE PE • ADM").should("be.visible");
    cy.contains("Scanner de QR Code (Catraca ADM)").should("be.visible");
    cy.contains("3 bilhete(s) • 3 torcedor(es)").should("be.visible");

    cy.screenshot("12_login_admin_sucesso", {
      capture: "viewport",
      overwrite: true,
    });

    // 2) Cenário de ERRO na Catraca ADM: Busca de código inexistente + reprovação
    cy.get('input[placeholder*="Digite ou cole o código"]')
      .clear()
      .type("PE-000999");
    cy.contains("button", "Buscar").click();
    cy.wait("@buscarInexistente");

    cy.contains(
      "Bilhete PE-000999 não encontrado na base de ingressos gerados.",
    ).should("be.visible");

    cy.screenshot("13_catraca_admin_busca_reprovacao_erro", {
      capture: "viewport",
      overwrite: true,
    });

    // 3) Cenário de SUCESSO na Catraca ADM: Busca código válido PE-416170, aprova via API real e exibe Comprovante
    cy.get('input[placeholder*="Digite ou cole o código"]')
      .clear()
      .type("PE-416170");
    cy.contains("button", "Buscar").click();

    cy.contains("button", "✓ Aprovar Entrada").should("be.visible").click();

    cy.contains("Entrada APROVADA para PE-416170").should("be.visible");
    cy.contains("button", "Ver Comprovante ✓").click();

    cy.contains("COMPROVANTE DE ENTRADA LIBERADA").should("be.visible");
    cy.contains("AUTORIZADO A ENTRAR ✓").should("be.visible");
    cy.contains("PE-416170").should("be.visible");

    cy.screenshot("14_catraca_admin_aprovacao_comprovante_sucesso", {
      capture: "viewport",
      overwrite: true,
    });

    // Fecha modal e encerra sessão do administrador
    cy.get("div.fixed.inset-0").contains("button", "Fechar").click();
    cy.get('button[aria-label="Menu do Usuário"]').click();
    cy.contains("button", "Deslogar").click();
    cy.contains("Login do Administrador").should("be.visible");
  });
});
