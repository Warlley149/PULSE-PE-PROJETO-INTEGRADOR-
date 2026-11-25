describe("Fluxo 01 — Autenticação, Cadastro e Biometria Facial do Torcedor", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.intercept("GET", "**/health", { statusCode: 200, body: { ok: true } });
  });

  it("CT-E2E-01 [ERRO]: Exibe alerta de erro ao tentar login com credenciais inválidas", () => {
    cy.intercept("POST", "**/api/v1/auth/login", {
      statusCode: 401,
      body: { detail: "Credenciais inválidas" },
    });

    cy.visit("/");
    cy.contains("Entrar no Pulse PE").should("be.visible");
    cy.contains("Portal de Acesso").should("be.visible");
    cy.get('button[aria-label="Menu do Usuário"]').should("not.exist");

    cy.get('input[placeholder="seu@email.com ou e-mail do ADM"]').type(
      "torcedor.invalido@pulsepe.com",
    );
    cy.get('input[placeholder="Digite sua senha"]').type("SenhaErrada99");
    cy.contains("button", "Entrar").click();

    cy.contains(
      "E-mail ou senha incorretos. Cadastre-se caso ainda não tenha conta.",
    ).should("be.visible");

    cy.screenshot("01_login_torcedor_erro", {
      capture: "viewport",
      overwrite: true,
    });
  });

  it("CT-E2E-02 [ERRO]: Valida campos inválidos no formulário de Cadastro de Conta (CPF inválido e Nome curto)", () => {
    cy.visit("/");
    cy.contains("button", "Cadastrar Conta").click();
    cy.contains("Criar Conta no Pulse PE").should("be.visible");

    // Erro de nome curto
    cy.get('input[placeholder="Digite seu nome completo"]').type("Jo");
    cy.get('input[placeholder="000.000.000-00"]').type("12345678901");
    cy.get('input[placeholder="seu@email.com"]').type("carlos@pulsepe.com");
    cy.get('input[placeholder="Mínimo 4 caracteres"]').type("Pulse@2026");
    cy.contains("button", "Continuar para Reconhecimento Facial").click();
    cy.contains("Informe seu nome completo.").should("be.visible");

    // Erro de CPF incompleto
    cy.get('input[placeholder="Digite seu nome completo"]')
      .clear()
      .type("Carlos Kauã Santana");
    cy.get('input[placeholder="000.000.000-00"]').clear().type("123456");
    cy.contains("button", "Continuar para Reconhecimento Facial").click();

    cy.contains("Informe um CPF válido (11 dígitos).").should("be.visible");

    cy.screenshot("03_cadastro_conta_erro", {
      capture: "viewport",
      overwrite: true,
    });
  });

  it("CT-E2E-03 [SUCESSO + ERRO + SUCESSO]: Conclui Cadastro válido, testa reprovação óptica na Biometria, homologa Biometria Facial e faz Login", () => {
    cy.mockWebRtcCamera();

    cy.visit("/");
    cy.contains("button", "Cadastrar Conta").click();

    cy.get('input[placeholder="Digite seu nome completo"]').type(
      "Carlos Kauã Santana",
    );
    cy.get('input[placeholder="000.000.000-00"]').type("12345678901");
    cy.get('input[placeholder="Nº de sócio"]').type("88420");
    cy.get('input[placeholder="seu@email.com"]').type(
      "carlos.kaua@pulsepe.com",
    );
    cy.get('input[placeholder="Mínimo 4 caracteres"]').type("Pulse@2026");
    cy.contains("button", "Continuar para Reconhecimento Facial").click();

    // Confirma avanço para Etapa 2 Obrigatória de Biometria
    cy.contains("ETAPA 2 DE 2 • OBRIGATÓRIA").should("be.visible");
    cy.contains(
      "Finalize o cadastro de Carlos Kauã Santana com sua Biometria Facial",
    ).should("be.visible");
    cy.contains("button", "Capturar e Validar Biometria", {
      timeout: 8000,
    }).should("be.visible");

    // Aguarda stream de vídeo renderizar frames reais do canvas
    cy.wait(500);
    cy.screenshot("04_cadastro_conta_sucesso", {
      capture: "viewport",
      overwrite: true,
    });

    // 1) Simula Cenário de ERRO na Biometria Facial (rosto obstruído / baixa iluminação)
    cy.intercept("POST", "**/api/v1/auth/cadastrar", {
      statusCode: 400,
      body: {
        cadastrado: false,
        detail: {
          mensagem: "Validação biométrica reprovada.",
          motivos: [
            "Acessório detectado: remova óculos escuros ou boné.",
            "Iluminação abaixo do limiar mínimo exigido pela SDS-PE.",
          ],
          checks: {
            rosto_unico: { ok: true, detalhe: "1 face detectada" },
            iluminacao: { ok: false, detalhe: "Baixa luminosidade (38%)" },
            sem_oculos: { ok: false, detalhe: "Obstrução ocular detectada" },
          },
        },
      },
    }).as("biometriaErro");

    cy.contains("button", "Capturar e Validar Biometria").click();
    cy.wait("@biometriaErro");

    cy.contains(
      "✕ Reconhecimento Facial Reprovado — Corrija para validar:",
    ).should("be.visible");
    cy.contains("Acessório detectado: remova óculos escuros ou boné.").should(
      "be.visible",
    );

    cy.scrollTo(0, 120, { ensureScrollable: false });
    cy.screenshot("05_biometria_facial_erro", {
      capture: "viewport",
      overwrite: true,
    });

    // 2) Simula Cenário de SUCESSO na Biometria Facial (homologada e travada)
    const validAvatarSvg =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#0682c4"/><circle cx="200" cy="115" r="52" fill="#ffffff"/><path d="M110 265 a90 75 0 0 1 180 0" fill="#ffffff"/></svg>',
      );

    cy.intercept("POST", "**/api/v1/auth/cadastrar", {
      statusCode: 200,
      body: {
        cadastrado: true,
        checks: {
          rosto_unico: { ok: true, detalhe: "1 face centralizada" },
          iluminacao: { ok: true, detalhe: "Iluminação ideal (98%)" },
          nitidez: { ok: true, detalhe: "Foco nítido aprovado" },
        },
        user: {
          nome: "Carlos Kauã Santana",
          cpf: "123.456.789-01",
          email: "carlos.kaua@pulsepe.com",
          matricula: "88420",
          faceFingerprintId: "REC-884201",
          faceHashSha256:
            "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          faceQualityScore: 98.7,
          faceImageDataUrl: validAvatarSvg,
          faceLocked: true,
        },
      },
    }).as("biometriaSucesso");

    cy.contains("button", "Capturar e Validar Biometria").click();
    cy.wait("@biometriaSucesso");

    cy.contains("Olá, Carlos").should("be.visible");
    cy.contains("BIOMETRIA VERIFICADA").should("be.visible");

    // Abre Passe Facial Digital comprovando a homologação imutável
    cy.contains("button", "ACESSAR PASSE FACIAL DIGITAL").click();
    cy.contains("Passe Facial Digital").should("be.visible");
    cy.contains("REC-884201").should("be.visible");
    cy.contains("TRAVADA").should("be.visible");

    cy.screenshot("06_biometria_facial_sucesso", {
      capture: "viewport",
      overwrite: true,
    });

    cy.contains("button", "Fechar Passe Facial").click();

    // Testa Logout completo e Login subsequente com SUCESSO
    cy.get('button[aria-label="Menu do Usuário"]').click();
    cy.contains("button", "Deslogar").click();
    cy.contains("Entrar no Pulse PE").should("be.visible");

    cy.intercept("POST", "**/api/v1/auth/login", {
      statusCode: 503,
      body: {},
    });

    cy.get('input[placeholder="seu@email.com ou e-mail do ADM"]')
      .clear()
      .type("carlos.kaua@pulsepe.com");
    cy.get('input[placeholder="Digite sua senha"]').clear().type("Pulse@2026");
    cy.contains("button", "Entrar").click();

    cy.contains("Bem-vindo(a), Carlos Kauã Santana!").should("be.visible");
    cy.contains("Olá, Carlos").should("be.visible");

    cy.screenshot("02_login_torcedor_sucesso", {
      capture: "viewport",
      overwrite: true,
    });
  });
});
