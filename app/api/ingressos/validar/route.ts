import { NextResponse } from "next/server";

export interface EntryValidationRecord {
  codigo: string;
  jogo: string;
  estadio: string;
  portao: string;
  setor: string;
  data: string;
  titular: string;
  cpf: string;
  biometriaOk: boolean;
  enteredAt: string;
}

const validatedEntries = new Map<string, EntryValidationRecord>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();

  if (!codigo) {
    return NextResponse.json(
      { validated: false, entries: Array.from(validatedEntries.values()) },
      { status: 200 },
    );
  }

  const existing = validatedEntries.get(codigo) || null;
  return NextResponse.json({
    validated: Boolean(existing),
    entry: existing,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<EntryValidationRecord>;
    const codigo = (body.codigo || "").trim().toUpperCase();

    if (!codigo) {
      return NextResponse.json(
        { error: "Código do ingresso obrigatório." },
        { status: 400 },
      );
    }

    const existing = validatedEntries.get(codigo);
    if (existing) {
      return NextResponse.json({
        alreadyEntered: true,
        entry: existing,
      });
    }

    const record: EntryValidationRecord = {
      codigo,
      jogo: body.jogo || "Partida Oficial",
      estadio: body.estadio || "Arena PE",
      portao: body.portao || "—",
      setor: body.setor || "—",
      data: body.data || "—",
      titular: body.titular || "Titular não informado",
      cpf: body.cpf || "",
      biometriaOk: Boolean(body.biometriaOk),
      enteredAt: new Date().toISOString(),
    };

    validatedEntries.set(codigo, record);

    return NextResponse.json(
      {
        alreadyEntered: false,
        entry: record,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Erro ao validar entrada na arena." },
      { status: 500 },
    );
  }
}
