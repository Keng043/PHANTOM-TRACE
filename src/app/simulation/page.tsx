import { ConsentGate } from "@/components/simulation/consent-gate";
export const metadata = { title: "Before you begin | PHANTOM TRACE", description: "Review the privacy notice and choose whether to join this phishing-awareness simulation." };
export default function SimulationPage() { return <ConsentGate />; }
