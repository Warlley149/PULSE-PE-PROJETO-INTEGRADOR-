// Suporte global para testes E2E do Cypress no PULSE PE

// Auxiliar para simular câmera WebRTC (getUserMedia) com frames ativos em ambiente headless
Cypress.Commands.add("mockWebRtcCamera", () => {
  cy.on("window:before:load", (win) => {
    const fakeCanvas = win.document.createElement("canvas");
    fakeCanvas.width = 640;
    fakeCanvas.height = 480;
    const ctx = fakeCanvas.getContext("2d");

    const drawFrame = () => {
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, "#dbeafe");
      grad.addColorStop(1, "#93c5fd");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Moldura biométrica simulando rosto bem iluminado e centralizado
      ctx.fillStyle = "#1e3a5f";
      ctx.beginPath();
      ctx.arc(320, 195, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(320, 395, 135, 100, 0, Math.PI, 0, false);
      ctx.fill();
    };

    drawFrame();
    const fakeStream = fakeCanvas.captureStream(15);
    win.setInterval(drawFrame, 120);

    if (!win.navigator.mediaDevices) {
      Object.defineProperty(win.navigator, "mediaDevices", {
        value: {},
        configurable: true,
      });
    }

    Object.defineProperty(win.navigator.mediaDevices, "getUserMedia", {
      value: async () => fakeStream,
      configurable: true,
      writable: true,
    });
  });
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      mockWebRtcCamera(): Chainable<void>;
    }
  }
}

export {};
