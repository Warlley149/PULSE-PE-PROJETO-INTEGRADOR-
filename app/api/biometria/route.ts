import { NextResponse } from "next/server";
import type { BiometricProfile } from "@/app/lib/storage";

export async function GET() {
  return NextResponse.json({
    profile: null,
    profiles: [],
    storage: "Supabase Cloud (via Render API)",
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

    return NextResponse.json({ profile: saved }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar os dados biométricos." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  return NextResponse.json({ deleted: true });
}
