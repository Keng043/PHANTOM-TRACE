export const instant = false;

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardClient from "./dashboard-client";
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <DashboardClient user={user} />;
}
