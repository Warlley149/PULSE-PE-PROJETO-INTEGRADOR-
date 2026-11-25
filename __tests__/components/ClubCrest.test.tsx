import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClubCrest } from "@/app/components/ClubCrest";

describe("Componente <ClubCrest />", () => {
  it("renderiza o escudo oficial SVG do Sport Recife (SPO)", () => {
    render(<ClubCrest sigla="SPO" nome="Sport Recife" />);
    const svg = screen.getByLabelText("Sport Recife");
    expect(svg).toBeInTheDocument();
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("renderiza o escudo oficial SVG do Náutico (NAU) com texto CNC", () => {
    render(<ClubCrest sigla="nau" />);
    const svg = screen.getByLabelText("Náutico");
    expect(svg).toBeInTheDocument();
    expect(screen.getByText("CNC")).toBeInTheDocument();
  });

  it("renderiza o escudo oficial SVG do Santa Cruz (STA) com texto SCFC", () => {
    render(<ClubCrest sigla=" STA " nome="Santa Cruz FC" />);
    expect(screen.getByLabelText("Santa Cruz FC")).toBeInTheDocument();
    expect(screen.getByText("SCFC")).toBeInTheDocument();
  });

  it("renderiza o escudo oficial SVG do Central (CEN) com texto CSC", () => {
    render(<ClubCrest sigla="CEN" />);
    expect(screen.getByLabelText("Central")).toBeInTheDocument();
    expect(screen.getByText("CSC")).toBeInTheDocument();
  });

  it("renderiza o escudo oficial SVG do América-PE (AME) com texto AFC", () => {
    render(<ClubCrest sigla="AME" />);
    expect(screen.getByLabelText("América-PE")).toBeInTheDocument();
    expect(screen.getByText("AFC")).toBeInTheDocument();
  });

  it("renderiza o escudo oficial SVG do Petrolina (PET) com texto PSFC", () => {
    render(<ClubCrest sigla="PET" />);
    expect(screen.getByLabelText("Petrolina")).toBeInTheDocument();
    expect(screen.getByText("PSFC")).toBeInTheDocument();
  });

  it("renderiza o escudo oficial SVG do Íbis (IBI) com texto ÍBIS", () => {
    render(<ClubCrest sigla="IBI" />);
    expect(screen.getByLabelText("Íbis")).toBeInTheDocument();
    expect(screen.getByText("ÍBIS")).toBeInTheDocument();
  });

  it("renderiza escudo heráldico genérico para clubes nacionais fora do catálogo PE", () => {
    render(
      <ClubCrest sigla="FLA" nome="Flamengo" corPrimaria="#c8102e" size="lg" />,
    );
    const svg = screen.getByLabelText("Flamengo");
    expect(svg).toBeInTheDocument();
    expect(screen.getByText("FLA")).toBeInTheDocument();
  });

  it("renderiza traço '—' quando nenhuma sigla nem logoUrl são informados", () => {
    render(<ClubCrest />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("aplica classes corretas de tamanho para variantes sm, md e lg", () => {
    const { container: smContainer } = render(
      <ClubCrest sigla="SPO" size="sm" />,
    );
    expect(smContainer.firstElementChild?.className).toContain("w-9 h-9");

    const { container: mdContainer } = render(
      <ClubCrest sigla="SPO" size="md" />,
    );
    expect(mdContainer.firstElementChild?.className).toContain("w-11 h-11");

    const { container: lgContainer } = render(
      <ClubCrest sigla="SPO" size="lg" />,
    );
    expect(lgContainer.firstElementChild?.className).toContain("w-12 h-12");
  });

  it("renderiza imagem externa quando logoUrl é fornecida e faz fallback para escudo SVG em caso de erro", () => {
    render(
      <ClubCrest
        sigla="SPO"
        nome="Sport Recife"
        logoUrl="https://cdn.exemplo.com/sport.png"
      />,
    );

    const img = screen.getByRole("img", { name: "Sport Recife" });
    expect(img).toHaveAttribute("src", "https://cdn.exemplo.com/sport.png");

    // Simula erro de carregamento da imagem externa
    fireEvent.error(img);

    // Deve cair automaticamente no escudo vetorial SVG
    const fallbackSvg = screen.getByLabelText("Sport Recife");
    expect(fallbackSvg.tagName.toLowerCase()).toBe("svg");
  });
});
