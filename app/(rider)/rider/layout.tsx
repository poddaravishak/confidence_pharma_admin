import type { Metadata } from "next";
import { RiderShell } from "@/components/rider/RiderShell";

export const metadata: Metadata = {
  title: "Rider app | Confidence Pharma",
};

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <RiderShell>{children}</RiderShell>;
}
