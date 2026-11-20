import React, { Suspense } from "react";
import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import { AdminPortalClient } from "@/app/admin/AdminPortalClient";

async function AdminPortalLoader({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  await connection();
  const session = await getAdminSession();
  const params = await searchParams;

  return (
    <AdminPortalClient
      initialAuthenticated={Boolean(session)}
      initialEmail={session?.email || null}
      initialScannedCode={params.codigo || ""}
    />
  );
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#faf8ff] flex items-center justify-center text-sm font-bold text-[#4e5462]">
          Verificando sessão administrativa...
        </div>
      }
    >
      <AdminPortalLoader searchParams={searchParams} />
    </Suspense>
  );
}
