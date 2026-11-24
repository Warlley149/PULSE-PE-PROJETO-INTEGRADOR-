import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createSessionToken,
  getAdminSession,
  validateAdminCredentials,
} from "@/app/lib/admin-auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, email: null });
  }
  return NextResponse.json({
    authenticated: true,
    email: session.email,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!validateAdminCredentials(email, password)) {
      return NextResponse.json(
        { error: "Credenciais inválidas. Acesso restrito ao administrador." },
        { status: 401 },
      );
    }

    const token = createSessionToken(email.toLowerCase());
    const response = NextResponse.json({
      authenticated: true,
      email: email.toLowerCase(),
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar autenticação." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
