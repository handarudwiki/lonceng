import type { Metadata } from "next";
import { scannerContext } from "@/lib/scanner-context";
import { PairForm } from "./pair-form";
import { ScannerScreen } from "./scanner-screen";

export const metadata: Metadata = { title: "Mode scanner" };

export default async function ScannerPage() {
  const ctx = await scannerContext();
  if (!ctx) return <PairForm />;
  return <ScannerScreen schoolName={ctx.schoolName} deviceName={ctx.deviceName} />;
}
