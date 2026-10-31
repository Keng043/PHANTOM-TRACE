export const instant = false;

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UsersClient from "./users-client";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  return <UsersClient />;
}
