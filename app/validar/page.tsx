import { redirect } from "next/navigation";

export default async function ValidarProtectedRoute({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const params = await searchParams;
  const codigo = (params.codigo || "").trim().toUpperCase();

  // Route is strictly protected: always goes through the authenticated /admin gate
  if (codigo) {
    redirect(`/admin?codigo=${encodeURIComponent(codigo)}`);
  }
  redirect("/admin");
}
