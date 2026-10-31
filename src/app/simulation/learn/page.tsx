import { Suspense } from "react";
import { LearningReview } from "@/components/simulation/learning-review";
export const metadata = { title: "Learning review | PHANTOM TRACE", description: "Learn how to identify suspicious messages and protect your accounts." };
export default function LearningPage() {
  return <Suspense fallback={<main className="sim-page"><p className="sim-lead">Loading learning review…</p></main>}><LearningReview /></Suspense>;
}
