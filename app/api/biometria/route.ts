import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { BiometricProfile } from "@/app/lib/storage";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

function readProfiles(): BiometricProfile[] {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"));
      return Array.isArray(parsed) ? (parsed as BiometricProfile[]) : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function writeProfiles(list: BiometricProfile[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export async function GET() {
  const profiles = readProfiles();
  return NextResponse.json({
    profile: profiles[0] || null,
    profiles,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BiometricProfile>;
    const now = new Date().toISOString();

    const saved: BiometricProfile = {
      id: body.id || crypto.randomUUID(),
      nome: (body.nome || "").trim(),
      cpf: (body.cpf || "").trim(),
      documentoIdentificacao: (body.documentoIdentificacao || "").trim(),
      orgaoEmissor: (body.orgaoEmissor || "").trim(),
      matricula: (body.matricula || "").trim(),
      plano: (body.plano || "").trim(),
      categoria: (body.categoria || "").trim(),
      membroDesde: (body.membroDesde || "").trim(),
      email: (body.email || "").trim(),
      telefone: (body.telefone || "").trim(),
      faceImageDataUrl: body.faceImageDataUrl || "",
      faceFingerprintId: body.faceFingerprintId || "",
      faceHashSha256: body.faceHashSha256 || "",
      faceQualityScore: Number(body.faceQualityScore) || 0,
      imageWidth: Number(body.imageWidth) || 0,
      imageHeight: Number(body.imageHeight) || 0,
      livenessVerified: Boolean(body.livenessVerified),
      faceLocked: body.faceLocked ?? Boolean(body.faceImageDataUrl),
      dependentes: Array.isArray(body.dependentes) ? body.dependentes : [],
      acessibilidade: (body.acessibilidade || "").trim(),
      alertasPortao: body.alertasPortao ?? true,
      catracaTempoReal: body.catracaTempoReal ?? true,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const list = readProfiles();
    const idx = list.findIndex(
      (p) =>
        (saved.email && p.email.toLowerCase() === saved.email.toLowerCase()) ||
        p.id === saved.id,
    );
    if (idx >= 0) {
      list[idx] = saved;
    } else {
      list.unshift(saved);
    }
    writeProfiles(list);

    return NextResponse.json({ profile: saved }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar os dados biométricos." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  writeProfiles([]);
  return NextResponse.json({ deleted: true });
}
