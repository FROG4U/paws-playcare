import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// Sends each user to their role's home.
export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === ROLES.ADMIN) redirect("/admin");
  if (user.role === ROLES.WORKER) redirect("/worker");
  redirect("/client");
}
