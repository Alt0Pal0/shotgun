import { redirect } from "next/navigation";
import { backendConfigured } from "@/lib/backend";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!backendConfigured()) redirect("/setup");
  return <>{children}</>;
}
