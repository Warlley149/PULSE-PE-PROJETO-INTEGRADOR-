import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import QRCode from "qrcode";
import { TicketCodeVisual } from "@/app/components/TicketCodeVisual";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

describe("Componente <TicketCodeVisual />", () => {
  it("exibe estado inicial 'Gerando QR Code...' e depois renderiza imagem QR oficial e código alfanumérico", async () => {
    vi.mocked(QRCode.toDataURL).mockResolvedValueOnce(
      "data:image/png;base64,FAKE_QR_DATA" as never,
    );

    render(
      <TicketCodeVisual
        code="PE-416170"
        validationUrl="http://localhost:3000/validar?codigo=PE-416170"
        size={200}
      />,
    );

    expect(screen.getByText("Gerando QR Code...")).toBeInTheDocument();
    expect(screen.getByText("CÓDIGO DO BILHETE")).toBeInTheDocument();
    expect(screen.getByText("PE-416170")).toBeInTheDocument();

    const qrImg = await screen.findByAltText(
      "QR Code oficial do ingresso PE-416170",
    );
    expect(qrImg).toBeInTheDocument();
    expect(qrImg).toHaveAttribute("src", "data:image/png;base64,FAKE_QR_DATA");
    expect(qrImg).toHaveAttribute("width", "200");
    expect(qrImg).toHaveAttribute("height", "200");

    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      "http://localhost:3000/validar?codigo=PE-416170",
      expect.objectContaining({
        errorCorrectionLevel: "M",
        width: 200,
      }),
    );
  });

  it("mantém fallback seguro sem quebrar a tela quando a geração do QR Code falha (cenário de erro)", async () => {
    vi.mocked(QRCode.toDataURL).mockRejectedValueOnce(
      new Error("Falha ao gerar matriz QR"),
    );

    render(
      <TicketCodeVisual
        code="PE-999000"
        validationUrl="http://localhost:3000/validar?codigo=PE-999000"
      />,
    );

    await waitFor(() => {
      expect(QRCode.toDataURL).toHaveBeenCalled();
    });

    expect(screen.getByText("Gerando QR Code...")).toBeInTheDocument();
    expect(screen.getByText("PE-999000")).toBeInTheDocument();
    expect(
      screen.queryByAltText("QR Code oficial do ingresso PE-999000"),
    ).not.toBeInTheDocument();
  });
});
