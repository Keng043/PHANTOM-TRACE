import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SupportViewer } from "@/components/support/support-viewer";
import "../support.css";
export const metadata = { title: "Remote Assist | PHANTOM TRACE" };
export const instant = false;
export default async function SupportRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { roomId } = await params;
  return <SupportViewer roomId={roomId} />;
}
