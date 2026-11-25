import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PulsePeApp } from "@/app/page";
import {
  registerUserAccount,
  saveBiometricProfile,
  setLoggedUserEmail,
} from "@/app/lib/storage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCK_QR"),
  },
}));

const mockMatchesPayload = {
  atualizadoEm: "2026-11-25T18:00:00.000Z",
  fontePrincipal: "FPF-PE",
  totalAoVivoEspn: 0,
  jogos: [
    {
      id: "fpf-2027-frevo-sport-estreia",
      competicao: "CAMPEONATO PERNAMBUCANO",
      temporada: "2027",
      rodada: "1ª Rodada • Turno Frevo",
      mandante: {
        sigla: "SPO",
        nome: "Sport Recife",
        corPrimaria: "#c8102e",
        corSecundaria: "#1a1a1a",
        cidade: "Recife-PE",
      },
      visitante: {
        sigla: "NAU",
        nome: "Náutico",
        corPrimaria: "#d91c24",
        corSecundaria: "#ffffff",
        cidade: "Recife-PE",
      },
      dataIso: "2027-01-03T16:00:00-03:00",
      dataFormatada: "03/Jan/2027, 16:00",
      horario: "16:00",
      aberturaPortoes: "14:00",
      estadio: "Ilha do Retiro",
      cidade: "Recife-PE",
      regiao: "pe",
      destaqueIlha: true,
      fonte: "FPF-PE • Oficial",
      aoVivoApi: false,
      setores: [
        {
          id: "cadeiras-centrais",
          nome: "Cadeiras Centrais",
          subsetor: "Setor Central • Portaria Principal",
          portao: "02",
          endereco: "Rua Sport Club do Recife",
        },
        {
          id: "sociais",
          nome: "Sociais",
          subsetor: "Sociais Dona Maria",
          portao: "03",
          endereco: "Rua Sport Club do Recife",
        },
      ],
    },
  ],
};

describe("Componente <PulsePeApp /> (Portal do Torcedor & Onboarding)", () => {
  beforeEach(() => {
    pushMock.mockReset();
    window.localStorage.clear();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/admin/login") && (!init || !init.method)) {
        return new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
        });
      }
      if (url.includes("/api/admin/login") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          email: string;
          password: string;
        };
        if (
          body.email === "admin@pulsepe.gov.br" &&
          body.password === "PulsePE@2026"
        ) {
          return new Response(
            JSON.stringify({
              authenticated: true,
              email: "admin@pulsepe.gov.br",
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
        });
      }
      if (url.includes("/api/jogos")) {
        return new Response(JSON.stringify(mockMatchesPayload), {
          status: 200,
        });
      }
      if (url.includes("/api/network")) {
        return new Response(
          JSON.stringify({
            lanIp: "192.168.1.15",
            lanOrigin: "http://192.168.1.15:3000",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/ingressos")) {
        return new Response(JSON.stringify({ tickets: [] }), { status: 200 });
      }
      if (url.includes("/api/biometria")) {
        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      }
      // Simula backend Python externo offline para testar fallback resiliente local
      throw new Error("Python offline");
    });
  });

  it("exibe tela de Login desautenticada e mostra erro ao tentar entrar com conta inexistente", async () => {
    render(<PulsePeApp />);

    expect(screen.getByText("Entrar no Pulse PE")).toBeInTheDocument();
    expect(screen.getByText("Portal de Acesso")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("seu@email.com ou e-mail do ADM"),
      { target: { value: "naoexiste@email.com" } },
    );
    fireEvent.change(screen.getByPlaceholderText("Digite sua senha"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText(
        "E-mail ou senha incorretos. Cadastre-se caso ainda não tenha conta.",
      ),
    ).toBeInTheDocument();
  });

  it("redireciona automaticamente para /admin quando credenciais do Administrador são inseridas no login principal", async () => {
    render(<PulsePeApp />);

    fireEvent.change(
      screen.getByPlaceholderText("seu@email.com ou e-mail do ADM"),
      { target: { value: "admin@pulsepe.gov.br" } },
    );
    fireEvent.change(screen.getByPlaceholderText("Digite sua senha"), {
      target: { value: "PulsePE@2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin");
    });
  });

  it("valida todos os cenários de erro no formulário de Cadastro (nome curto, CPF inválido, senha curta) e avança para Biometria quando válido", async () => {
    render(<PulsePeApp />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar Conta" }));
    expect(screen.getByText("Criar Conta no Pulse PE")).toBeInTheDocument();

    const nomeInput = screen.getByPlaceholderText("Digite seu nome completo");
    const cpfInput = screen.getByPlaceholderText("000.000.000-00");
    const emailInput = screen.getByPlaceholderText("seu@email.com");
    const passInput = screen.getByPlaceholderText("Mínimo 4 caracteres");
    const form = nomeInput.closest("form")!;

    // Erro 1: Nome com menos de 3 letras
    fireEvent.change(nomeInput, { target: { value: "Ab" } });
    fireEvent.change(cpfInput, { target: { value: "12345678901" } });
    fireEvent.change(emailInput, { target: { value: "novo@torcedor.com" } });
    fireEvent.change(passInput, { target: { value: "1234" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText("Informe seu nome completo."),
    ).toBeInTheDocument();

    // Erro 2: CPF incompleto (< 11 dígitos)
    fireEvent.change(nomeInput, { target: { value: "João Pedro Barros" } });
    fireEvent.change(cpfInput, { target: { value: "123.456" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText("Informe um CPF válido (11 dígitos)."),
    ).toBeInTheDocument();

    // Erro 3: Senha curta (< 4 caracteres)
    fireEvent.change(cpfInput, { target: { value: "12345678901" } });
    fireEvent.change(passInput, { target: { value: "123" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText(
        "Informe um e-mail válido e uma senha com pelo menos 4 caracteres.",
      ),
    ).toBeInTheDocument();

    // Sucesso: Dados válidos avançam para Etapa 2 obrigatória (Biometria Facial)
    fireEvent.change(passInput, { target: { value: "Sport@2026" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText("ETAPA 2 DE 2 • OBRIGATÓRIA"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Finalize o cadastro de João Pedro Barros com sua Biometria Facial/i,
      ),
    ).toBeInTheDocument();
  });

  it("permite ao Torcedor autenticado visualizar partidas, gerar ingresso com QR Code, editar perfil e deslogar", async () => {
    await registerUserAccount({
      nome: "Warlley Tenório",
      email: "warlley@torcedor.com",
      cpf: "12345678901",
      password: "123456",
      matricula: "87901",
    });
    await saveBiometricProfile({
      nome: "Warlley Tenório",
      email: "warlley@torcedor.com",
      cpf: "123.456.789-01",
      matricula: "87901",
      faceImageDataUrl: "data:image/jpeg;base64,VALID_FACE",
      faceFingerprintId: "REC-554433",
      faceQualityScore: 97.5,
      livenessVerified: true,
      faceLocked: true,
    });
    setLoggedUserEmail("warlley@torcedor.com");

    render(<PulsePeApp />);

    // Saudação personalizada e selo de biometria verificada
    expect(await screen.findByText("Olá, Warlley")).toBeInTheDocument();
    expect(screen.getByText("BIOMETRIA VERIFICADA")).toBeInTheDocument();

    // Partida oficial carregada via /api/jogos
    const chooseSectorBtn = await screen.findByRole("button", {
      name: /Escolher Setor e Gerar Ingresso/i,
    });
    fireEvent.click(chooseSectorBtn);

    // Modal de seleção de setor aberto
    expect(
      await screen.findByText(/Selecione o Setor Oficial/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sociais"));
    fireEvent.click(
      screen.getByRole("button", { name: /Gerar Ingresso com Passe Facial/i }),
    );

    // Ingresso gerado aparece ativo na tela principal
    expect(
      await screen.findByText(/1 ingresso\(s\) ativo\(s\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Portão 03")).toBeInTheDocument();

    // Abre QR Code para entrada na arena
    fireEvent.click(
      screen.getByRole("button", { name: /Abrir QR Code \/ Catraca/i }),
    );
    expect(
      await screen.findByText("AGUARDANDO VALIDAÇÃO NA ARENA"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));

    // Abre Passe Facial Digital (somente leitura)
    fireEvent.click(
      screen.getByRole("button", { name: /ACESSAR PASSE FACIAL DIGITAL/i }),
    );
    expect(await screen.findByText("Passe Facial Digital")).toBeInTheDocument();
    expect(screen.getByText("REC-554433")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar Passe Facial" }));

    // Abre Dropdown do perfil e testa validação de erro + salvamento de Dados Cadastrais
    fireEvent.click(screen.getByRole("button", { name: "Menu do Usuário" }));
    fireEvent.click(screen.getByText("Acessar Dados do Perfil"));

    expect(
      await screen.findByText("Dados Cadastrais do Titular"),
    ).toBeInTheDocument();
    const modalCpfInput = screen.getByPlaceholderText("000.000.000-00");
    fireEvent.change(modalCpfInput, { target: { value: "111" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Dados" }));

    // Erro de CPF inválido dentro do modal de edição cadastral
    expect(
      await screen.findByText("Informe um CPF válido (11 dígitos)."),
    ).toBeInTheDocument();

    // Corrige CPF e salva com sucesso
    fireEvent.change(modalCpfInput, { target: { value: "12345678901" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Dados" }));

    expect(
      await screen.findByText("Dados do titular salvos com sucesso."),
    ).toBeInTheDocument();

    // Realiza logout pelo menu do usuário
    fireEvent.click(screen.getByRole("button", { name: "Menu do Usuário" }));
    fireEvent.click(screen.getByText("Deslogar"));

    expect(await screen.findByText("Entrar no Pulse PE")).toBeInTheDocument();
  });
});
