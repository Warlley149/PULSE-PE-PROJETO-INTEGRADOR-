import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppHeader } from "@/app/components/AppHeader";
import type { BiometricProfile } from "@/app/lib/storage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockProfile: BiometricProfile = {
  id: "prof-1",
  nome: "Carlos Eduardo Silva",
  cpf: "123.456.789-00",
  documentoIdentificacao: "8899001",
  orgaoEmissor: "SDS-PE",
  matricula: "45990",
  plano: "PLANO OURO",
  categoria: "SÓCIO RUBRO-NEGRO",
  membroDesde: "janeiro de 2025",
  email: "carlos@torcedor.com",
  telefone: "(81) 99999-1111",
  faceImageDataUrl: "data:image/jpeg;base64,FACE_MOCK",
  faceFingerprintId: "REC-887766",
  faceHashSha256: "abc123hash",
  faceQualityScore: 98.4,
  imageWidth: 640,
  imageHeight: 480,
  livenessVerified: true,
  faceLocked: true,
  dependentes: [],
  acessibilidade: "",
  alertasPortao: true,
  catracaTempoReal: true,
  createdAt: "2026-11-20T12:00:00.000Z",
  updatedAt: "2026-11-20T12:00:00.000Z",
};

describe("Componente <AppHeader />", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("oculta avatar, dropdown e sino quando isAuthenticated=false (tela de login/onboarding)", () => {
    render(
      <AppHeader
        isAuthenticated={false}
        disableBrandClick={true}
        onOpenNotificacoes={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("ILHA DO RETIRO")).toBeInTheDocument();
    expect(screen.getByText("PULSE PE")).toBeInTheDocument();
    expect(screen.getByText("Portal de Acesso")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir Notificações" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Menu do Usuário" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renderiza link clicável na marca quando disableBrandClick=false", () => {
    render(<AppHeader isAuthenticated={true} disableBrandClick={false} />);
    const brandLink = screen.getByRole("link");
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("exibe sino de notificações com indicador de não lidas e aciona callback ao clicar", () => {
    const onOpenNotificacoes = vi.fn();
    render(
      <AppHeader
        isAuthenticated={true}
        unreadCount={3}
        onOpenNotificacoes={onOpenNotificacoes}
      />,
    );

    const bellBtn = screen.getByRole("button", { name: "Abrir Notificações" });
    fireEvent.click(bellBtn);
    expect(onOpenNotificacoes).toHaveBeenCalledTimes(1);
  });

  it("exibe menu dropdown completo do Torcedor com biometria homologada e aciona todas as opções", () => {
    const callbacks = {
      onOpenProfile: vi.fn(),
      onOpenCarteirinha: vi.fn(),
      onOpenNotificacoes: vi.fn(),
      onOpenSuporte: vi.fn(),
      onOpenPrivacidade: vi.fn(),
      onLogout: vi.fn(),
    };

    render(
      <AppHeader
        variant="torcedor"
        profile={mockProfile}
        unreadCount={5}
        isAuthenticated={true}
        {...callbacks}
      />,
    );

    const avatarBtn = screen.getByRole("button", { name: "Menu do Usuário" });
    expect(avatarBtn).toHaveAttribute("aria-expanded", "false");

    // Abre dropdown
    fireEvent.click(avatarBtn);
    expect(avatarBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Carlos Eduardo Silva")).toBeInTheDocument();
    expect(screen.getByText("Matrícula #45990")).toBeInTheDocument();
    expect(screen.getByText("Biometria Homologada ✓")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // Clica em Acessar Dados do Perfil (deve chamar callback e fechar menu)
    fireEvent.click(screen.getByText("Acessar Dados do Perfil"));
    expect(callbacks.onOpenProfile).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Carteirinha Digital de Sócio"),
    ).not.toBeInTheDocument();

    // Reabre e testa Carteirinha
    fireEvent.click(avatarBtn);
    fireEvent.click(screen.getByText("Carteirinha Digital de Sócio"));
    expect(callbacks.onOpenCarteirinha).toHaveBeenCalledTimes(1);

    // Reabre e testa Notificações no dropdown
    fireEvent.click(avatarBtn);
    fireEvent.click(screen.getByText("Notificações & Avisos"));
    expect(callbacks.onOpenNotificacoes).toHaveBeenCalledTimes(1);

    // Reabre e testa Suporte
    fireEvent.click(avatarBtn);
    fireEvent.click(screen.getByText("Central de Suporte"));
    expect(callbacks.onOpenSuporte).toHaveBeenCalledTimes(1);

    // Reabre e testa Privacidade & LGPD
    fireEvent.click(avatarBtn);
    fireEvent.click(screen.getByText("Privacidade & LGPD"));
    expect(callbacks.onOpenPrivacidade).toHaveBeenCalledTimes(1);

    // Reabre e testa Deslogar
    fireEvent.click(avatarBtn);
    fireEvent.click(screen.getByText("Deslogar"));
    expect(callbacks.onLogout).toHaveBeenCalledTimes(1);
  });

  it("exibe status 'Biometria Pendente' quando o torcedor ainda não possui foto facial", () => {
    const profileWithoutFace: BiometricProfile = {
      ...mockProfile,
      faceImageDataUrl: "",
      matricula: "",
    };

    render(
      <AppHeader
        variant="torcedor"
        profile={profileWithoutFace}
        isAuthenticated={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu do Usuário" }));
    expect(screen.getByText("Biometria Pendente")).toBeInTheDocument();
    expect(screen.getByText("CPF 123.456.789-00")).toBeInTheDocument();
  });

  it("fecha o dropdown automaticamente ao clicar fora do componente", () => {
    render(
      <AppHeader
        variant="torcedor"
        profile={mockProfile}
        isAuthenticated={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu do Usuário" }));
    expect(screen.getByText("Biometria Homologada ✓")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByText("Biometria Homologada ✓"),
    ).not.toBeInTheDocument();
  });

  it("renderiza variante 'admin' com título PULSE PE • ADM e redirecionamento para /admin", () => {
    const onLogout = vi.fn();
    render(
      <AppHeader
        variant="admin"
        adminEmail="admin@pulsepe.gov.br"
        isAuthenticated={true}
        onLogout={onLogout}
      />,
    );

    expect(screen.getByText("PULSE PE • ADM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu do Usuário" }));
    expect(screen.getByText("Administrador da Arena")).toBeInTheDocument();
    expect(screen.getByText("admin@pulsepe.gov.br")).toBeInTheDocument();
    expect(screen.getByText("Operador Autorizado")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Painel ADM (Scanner & Bilhetes)"));
    expect(pushMock).toHaveBeenCalledWith("/admin");
  });
});
