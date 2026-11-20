import React from "react";
import { getAdminSession } from "@/app/lib/admin-auth";
import { AdminPortalClient } from "@/app/admin/AdminPortalClient";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
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
