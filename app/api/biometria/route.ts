import { NextResponse } from "next/server";
import type { BiometricProfile } from "@/app/lib/storage";

let memoryStore: BiometricProfile | null = null;

export async function GET() {
  return NextResponse.json({
    profile: memoryStore,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BiometricProfile>;

    if (!body.nome || !body.cpf || !body.faceImageDataUrl) {
      return NextResponse.json(
        {
          error:
            "Campos obrigatórios ausentes (nome, cpf ou imagem facial capturada).",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const saved: BiometricProfile = {
      id: body.id || crypto.randomUUID(),
      nome: body.nome.trim(),
      cpf: body.cpf.trim(),
      matricula: (body.matricula || "").trim(),
      categoria: (body.categoria || "").trim(),
      email: (body.email || "").trim(),
      telefone: (body.telefone || "").trim(),
      faceImageDataUrl: body.faceImageDataUrl,
      faceHashSha256: body.faceHashSha256 || "",
      imageWidth: Number(body.imageWidth) || 0,
      imageHeight: Number(body.imageHeight) || 0,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    memoryStore = saved;

    return NextResponse.json({ profile: saved }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar os dados biométricos." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  memoryStore = null;
  return NextResponse.json({ deleted: true });
}
