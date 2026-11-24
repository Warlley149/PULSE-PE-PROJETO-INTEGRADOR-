import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  getServerTicketByCode,
  listAllMergedServerTickets,
  reviewServerTicket,
} from "@/app/lib/server-tickets";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Acesso restrito. Faça login como administrador." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();

  if (codigo) {
    const ticket = await getServerTicketByCode(codigo);
    return NextResponse.json({ ticket });
  }

  const tickets = await listAllMergedServerTickets();
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  // STRICT SERVER-SIDE AUTH CHECK: Only logged-in Admin can approve/reject tickets
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      {
        error:
          "Não autorizado. Apenas o administrador autenticado pode aprovar ou reprovar entradas.",
      },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      codigo?: string;
      decision?: "aprovado" | "reprovado" | "pendente";
      motivoReprovacao?: string;
      jogo?: string;
      estadio?: string;
      portao?: string;
      setor?: string;
      dataHorario?: string;
      titular?: string;
      cpf?: string;
      biometriaOk?: boolean;
    };

    const codigo = (body.codigo || "").trim().toUpperCase();
    if (!codigo) {
      return NextResponse.json(
        { error: "Código do ingresso obrigatório." },
        { status: 400 },
      );
    }

    if (
      body.decision !== "aprovado" &&
      body.decision !== "reprovado" &&
      body.decision !== "pendente"
    ) {
      return NextResponse.json(
        {
          error:
            "Decisão inválida. Informe 'aprovado', 'reprovado' ou 'pendente'.",
        },
        { status: 400 },
      );
    }

    const updated = await reviewServerTicket({
      codigo,
      decision: body.decision,
      motivoReprovacao: body.motivoReprovacao,
      reviewedBy: session.email,
      fallbackMeta: {
        jogo: body.jogo,
        estadio: body.estadio,
        portao: body.portao,
        setor: body.setor,
        dataHorario: body.dataHorario,
        titular: body.titular,
        cpf: body.cpf,
        biometriaOk: body.biometriaOk,
      },
    });

    return NextResponse.json({ ticket: updated }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar validação do bilhete." },
      { status: 500 },
    );
  }
}
