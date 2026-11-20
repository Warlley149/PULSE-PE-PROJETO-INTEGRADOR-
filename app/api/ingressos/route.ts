import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  deleteServerTicket,
  getServerTicketByCode,
  listAllServerTickets,
  upsertServerTicket,
} from "@/app/lib/server-tickets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  const codigos = searchParams.get("codigos");

  // Client can query status of its own ticket code(s)
  if (codigo) {
    const found = getServerTicketByCode(codigo);
    return NextResponse.json({ ticket: found });
  }

  if (codigos) {
    const list = codigos
      .split(",")
      .map((c) => getServerTicketByCode(c))
      .filter(Boolean);
    return NextResponse.json({ tickets: list });
  }

  // Listing ALL tickets requires authenticated Admin session
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores autenticados." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    tickets: listAllServerTickets(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      codigo?: string;
      matchId?: string;
      competicao?: string;
      jogo?: string;
      estadio?: string;
      dataHorario?: string;
      setor?: string;
      subsetor?: string;
      portao?: string;
      enderecoPortao?: string;
      titular?: string;
      cpf?: string;
      biometriaOk?: boolean;
    };

    if (!body.codigo || !body.jogo) {
      return NextResponse.json(
        { error: "Dados obrigatórios do ingresso ausentes." },
        { status: 400 },
      );
    }

    const saved = upsertServerTicket({
      codigo: body.codigo,
      matchId: body.matchId || "",
      competicao: body.competicao || "",
      jogo: body.jogo,
      estadio: body.estadio || "",
      dataHorario: body.dataHorario || "",
      setor: body.setor || "",
      subsetor: body.subsetor || "",
      portao: body.portao || "",
      enderecoPortao: body.enderecoPortao || "",
      titular: body.titular || "Titular não informado",
      cpf: body.cpf || "",
      biometriaOk: Boolean(body.biometriaOk),
    });

    return NextResponse.json({ ticket: saved }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível registrar o ingresso." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  if (!codigo) {
    return NextResponse.json({ error: "Código obrigatório." }, { status: 400 });
  }
  const deleted = deleteServerTicket(codigo);
  return NextResponse.json({ deleted });
}
