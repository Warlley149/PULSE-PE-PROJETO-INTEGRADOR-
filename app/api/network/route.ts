import os from "os";
import { NextResponse } from "next/server";

function getLocalIpv4(): string | null {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        // Prioritize Wi-Fi / Ethernet over virtual adapters (WSL, Docker, VirtualBox)
        const lower = name.toLowerCase();
        if (
          lower.includes("wi-fi") ||
          lower.includes("wifi") ||
          lower.includes("wlan") ||
          lower.includes("ethernet")
        ) {
          candidates.unshift(addr.address);
        } else {
          candidates.push(addr.address);
        }
      }
    }
  }

  return candidates[0] || null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const port = url.port || "3000";
  const lanIp = getLocalIpv4();

  return NextResponse.json({
    lanIp,
    lanOrigin: lanIp ? `http://${lanIp}:${port}` : null,
  });
}
