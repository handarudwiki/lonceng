import { Card, PageHeader } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { AddSchoolForm, SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { school } = await requireSchool("manageSettings");
  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Profil sekolah dan aturan presensi." />
      <div className="max-w-3xl space-y-4">
        <SettingsForm school={{ ...school, latitude: school.latitude, longitude: school.longitude }} />
        <Card>
          <h2 className="mb-1 text-lg font-extrabold">Tambah sekolah lain</h2>
          <p className="mb-4 text-sm text-ink-2">Satu akun admin bisa mengelola beberapa sekolah; pindah lewat pemilih di bagian atas.</p>
          <AddSchoolForm />
        </Card>
      </div>
    </>
  );
}
