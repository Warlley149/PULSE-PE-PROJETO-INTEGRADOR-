const seedAuthenticatedTorcedor = (win: Cypress.AUTWindow) => {
  const email = "warlley@pulsepe.com";
  const avatarDataUrl =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#02669c"/><circle cx="160" cy="92" r="42" fill="#ffffff"/><path d="M90 215 a70 60 0 0 1 140 0" fill="#ffffff"/></svg>',
    );

  win.localStorage.setItem("pulse_pe_user_session_email_v1", email);
  win.localStorage.setItem(
    `pulse_pe_real_profile_v2_${email}`,
    JSON.stringify({
      id: "prof-warlley",
      nome: "Warlley dos Santos Tenório",
      cpf: "123.456.789-00",
      documentoIdentificacao: "9988776",
      orgaoEmissor: "SDS-PE",
      matricula: "45990",
      plano: "PLANO OURO",
      categoria: "SÓCIO RUBRO-NEGRO",
      membroDesde: "Janeiro/2025",
      email,
      telefone: "(81) 99876-5432",
      faceImageDataUrl: avatarDataUrl,
      faceFingerprintId: "REC-459900",
      faceHashSha256:
        "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
      faceQualityScore: 99.1,
      imageWidth: 640,
      imageHeight: 480,
      livenessVerified: true,
      faceLocked: true,
      dependentes: [],
      acessibilidade: "",
      alertasPortao: true,
      catracaTempoReal: true,
      createdAt: "2026-11-20T12:00:00.000Z",
      updatedAt: "2026-11-22T18:00:00.000Z",
    }),
  );
};

describe("Fluxo 02 — Emissão de Ingressos, Bloqueio de Catraca, Perfil e Notificações", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.intercept("GET", "**/health", { statusCode: 200, body: { ok: true } });
    cy.intercept("PUT", "**/api/v1/users/perfil", {
      statusCode: 200,
      body: { ok: true },
    });
    cy.intercept("POST", "**/api/v1/notifications", {
      statusCode: 200,
      body: { ok: true },
    });
  });

  it("CT-E2E-04 [SUCESSO]: Seleciona partida oficial na Ilha do Retiro, gera ingresso e exibe QR Code escaneável", () => {
    cy.visit("/", {
      onBeforeLoad: (win) => seedAuthenticatedTorcedor(win),
    });

    cy.contains("Olá, Warlley").should("be.visible");
    cy.contains("BIOMETRIA VERIFICADA").should("be.visible");

    // Filtra partidas da Ilha do Retiro
    cy.contains("button", "Ilha do Retiro").click();
    cy.contains("Sport Recife").should("be.visible");
    cy.contains("button", "Escolher Setor e Gerar Ingresso").first().click();

    // Seleciona setor Sociais (Portão 03)
    cy.contains("Selecione o Setor Oficial").should("be.visible");
    cy.contains("button", "Sociais").click();
    cy.contains("button", "Gerar Ingresso com Passe Facial").click();

    // Verifica criação do ingresso e abre QR Code
    cy.contains("1 ingresso(s) ativo(s)").should("be.visible");
    cy.contains("Portão 03").should("be.visible");
    cy.contains("button", "Abrir QR Code / Catraca").click();

    cy.contains("AGUARDANDO VALIDAÇÃO NA ARENA").should("be.visible");
    cy.get('img[alt*="QR Code oficial do ingresso PE-"]')
      .should("be.visible")
      .and(($img) => {
        expect($img.attr("src")).to.include("data:image/png;base64,");
      });

    cy.screenshot("07_emissao_ingresso_qrcode_sucesso", {
      capture: "viewport",
      overwrite: true,
    });
  });

  it("CT-E2E-05 [ERRO]: Exibe bloqueio de entrada na catraca e motivo quando ingresso é reprovado pelo ADM", () => {
    cy.intercept("GET", "/api/ingressos?codigos=*", {
      statusCode: 200,
      body: {
        tickets: [
          {
            codigo: "PE-416170",
            status: "reprovado",
            reviewedAt: "2026-11-25T18:30:00.000Z",
            reviewedBy: "admin@pulsepe.gov.br",
            motivoReprovacao:
              "Documento de identificação divergente do titular na catraca.",
          },
        ],
      },
    }).as("statusReprovado");

    cy.visit("/", {
      onBeforeLoad: (win) => {
        seedAuthenticatedTorcedor(win);
        win.localStorage.setItem(
          "pulse_pe_real_tickets_v2_warlley@pulsepe.com",
          JSON.stringify([
            {
              id: "tkt-reprovado-1",
              matchId: "fpf-2027-frevo-sport-estreia",
              codigoIngresso: "PE-416170",
              competicao: "CAMPEONATO PERNAMBUCANO",
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
              setor: "Assento Especial",
              subsetor: "Portaria Principal",
              portao: "04",
              enderecoPortao: "Rua Sport Club do Recife",
              tipoAcesso: "Catraca Express",
              fila: "Fila Facial Dedicada",
              fonte: "FPF-PE • Oficial",
              createdAt: "2026-11-25T17:00:00.000Z",
            },
          ]),
        );
      },
    });

    cy.wait("@statusReprovado");

    cy.contains("✕ ENTRADA BLOQUEADA — INGRESSO REPROVADO PELO ADM").should(
      "be.visible",
    );
    cy.contains("button", "ENTRADA BLOQUEADA NA CATRACA").should("be.disabled");

    // Abre modal mostrando bloqueio do QR Code
    cy.contains("button", "VER MOTIVO ✕").click();
    cy.contains("✕ ACESSO BLOQUEADO • REPROVADO").should("be.visible");
    cy.contains("Entrada Não Autorizada").should("be.visible");
    cy.contains(
      "Documento de identificação divergente do titular na catraca.",
    ).should("be.visible");

    cy.screenshot("08_ingresso_reprovado_bloqueio_erro", {
      capture: "viewport",
      overwrite: true,
    });
  });

  it("CT-E2E-06 [ERRO + SUCESSO]: Valida erro de CPF na edição de Dados Cadastrais, salva dados válidos e abre Carteirinha Digital", () => {
    cy.visit("/", {
      onBeforeLoad: (win) => seedAuthenticatedTorcedor(win),
    });

    cy.get('button[aria-label="Menu do Usuário"]').click();
    cy.contains("button", "Acessar Dados do Perfil").click();

    cy.contains("Dados Cadastrais do Titular").should("be.visible");

    // Cenário de ERRO: CPF incompleto na edição cadastral
    cy.get('input[placeholder="000.000.000-00"]').clear().type("12345");
    cy.contains("button", "Salvar Dados").click();
    cy.contains("Informe um CPF válido (11 dígitos).").should("be.visible");

    cy.screenshot("09_edicao_perfil_erro", {
      capture: "viewport",
      overwrite: true,
    });

    // Cenário de SUCESSO: Corrige CPF, atualiza Plano e abre Carteirinha Digital
    cy.get('input[placeholder="000.000.000-00"]').clear().type("12345678900");
    cy.get('input[placeholder="Seu plano"]').clear().type("PLANO OURO VIP");
    cy.contains("button", "Salvar Dados").click();
    cy.contains("Dados do titular salvos com sucesso.").should("be.visible");

    cy.get('button[aria-label="Menu do Usuário"]').click();
    cy.contains("button", "Carteirinha Digital de Sócio").click();
    cy.contains("PASSE OFICIAL DO SÓCIO").should("be.visible");
    cy.contains("PLANO OURO VIP").should("be.visible");
    cy.contains("Biometria Homologada ✓").should("be.visible");
    cy.get('img[alt*="QR Code oficial do ingresso"]').should("be.visible");

    cy.screenshot("10_edicao_perfil_carteirinha_sucesso", {
      capture: "viewport",
      overwrite: true,
    });
  });

  it("CT-E2E-07 [ERRO + SUCESSO]: Verifica estado vazio/validação de Notificações e publica novo comunicado oficial", () => {
    cy.visit("/?tab=notificacoes", {
      onBeforeLoad: (win) => seedAuthenticatedTorcedor(win),
    });

    cy.contains("Nenhuma notificação nesta categoria").should("be.visible");
    cy.contains("button", "+ Adicionar").click();
    cy.contains("Adicionar Comunicado / Aviso").should("be.visible");

    // Tenta submeter vazio — validação HTML5 impede publicação e mantém modal aberto
    cy.get('input[placeholder="Título da notificação *"]').should(
      "have.attr",
      "required",
    );
    cy.contains("button", "Publicar").click();
    cy.contains("Adicionar Comunicado / Aviso").should("be.visible");

    cy.screenshot("15_notificacoes_vazio_validacao_erro", {
      capture: "viewport",
      overwrite: true,
    });

    // Preenche corretamente e publica comunicado
    cy.get('input[placeholder*="Selo"]').type("PORTÕES ABERTOS");
    cy.get('input[placeholder="Título da notificação *"]').type(
      "Portão 03 liberado para Sócios",
    );
    cy.get('textarea[placeholder="Mensagem da notificação *"]').type(
      "Catracas biométricas expressas em operação normal na Ilha do Retiro.",
    );
    cy.get('input[placeholder="Detalhe complementar (Opcional)"]').type(
      "Ilha do Retiro • Setor Sociais",
    );
    cy.contains("button", "Publicar").click();

    cy.contains("Comunicado adicionado à central de notificações.").should(
      "be.visible",
    );
    cy.contains("Portão 03 liberado para Sócios").should("be.visible");
    cy.contains("PORTÕES ABERTOS").should("be.visible");

    cy.screenshot("16_notificacoes_publicacao_sucesso", {
      capture: "viewport",
      overwrite: true,
    });
  });
});
