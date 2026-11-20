import React, { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

async function ValidarRedirector({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const codigo = (params.codigo || "").trim().toUpperCase();

  // Route is strictly protected: always goes through the authenticated /admin gate
  if (codigo) {
    redirect(`/admin?codigo=${encodeURIComponent(codigo)}`);
  }
  redirect("/admin");
  return null;
}

export default function ValidarProtectedRoute({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#faf8ff] flex items-center justify-center text-sm font-bold text-[#4e5462]">
          Redirecionando para validação administrativa...
        </div>
      }
    >
      <ValidarRedirector searchParams={searchParams} />
    </Suspense>
  );
}
