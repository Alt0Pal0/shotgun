import { redirect } from "next/navigation";
import { backendMode } from "@/lib/backend";
import { ResetWithTokenForm } from "./ResetWithTokenForm";

/** Password reset link target (postgres backend). */
export default async function ResetTokenPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (backendMode() !== "postgres" || !token) redirect("/forgot-password");
  return <ResetWithTokenForm token={token} />;
}
