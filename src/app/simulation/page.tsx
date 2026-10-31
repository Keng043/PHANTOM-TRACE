import { ConsentGate } from "@/components/simulation/consent-gate";

export const metadata = {
  title: "Join the experiment | PHANTOM TRACE",
  description: "Review the device-security experiment notice and choose which optional activities to join.",
};

export default function SimulationPage() {
  return <ConsentGate />;
}
