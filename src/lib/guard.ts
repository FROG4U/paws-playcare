import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { ROLES } from "./constants";

// Page-level guards that redirect (vs the throw-style guards in auth.ts).
export async function pageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function pageRole(roles: string[]) {
  const user = await pageUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export const requireAdmin = () => pageRole([ROLES.ADMIN]);
// Admins are workers by default, so they may use the worker area too.
export const requireWorker = () => pageRole([ROLES.ADMIN, ROLES.WORKER]);
export const requireClient = () => pageRole([ROLES.CLIENT]);
