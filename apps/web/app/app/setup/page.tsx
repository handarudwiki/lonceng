import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const ctx = await requireSchool("manageSettings");
  if (ctx.school.onboardedAt) redirect("/app");
  return (
    <>
      <PageHeader title="Siapkan sekolah Anda" subtitle="Tiga hal ini cukup untuk mulai. Semuanya bisa diubah nanti." />
      <SetupForm />
    </>
  );
}
