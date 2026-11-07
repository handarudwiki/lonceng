import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { PhotoPicker } from "@/components/photo-picker";
import { Btn, Card, Field, H2, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure, uploadPhoto } from "@/lib/api";
import { colors } from "@/lib/theme";
import { useApi } from "@/lib/use-api";

type Student = { id: string; name: string; classGroup: string | null };
type ViolationType = { id: string; name: string; category: string; points: number };

/** MG-08: goes to the BK queue; no points or parent notice until it is verified. */
export default function ReportViolation() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: students } = useApi<Student[]>(q.length >= 2 ? `/teacher/students?q=${encodeURIComponent(q)}` : null);
  const { data: types } = useApi<ViolationType[]>("/teacher/violation-types");

  const results = q.length >= 2 ? (students ?? []) : [];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const photoPath = photo ? await uploadPhoto(photo) : null;
      await api("/teacher/violations", { body: { studentId: student!.id, typeId: type, note: note || undefined, photoPath } });
      router.back();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };

  const option = (selected: boolean) => ({ minHeight: 48, justifyContent: "center" as const, paddingHorizontal: 12, borderRadius: 10, backgroundColor: selected ? colors.brandSoft : "transparent" });

  return (
    <Screen back title="Lapor pelanggaran" subtitle="Laporan diverifikasi guru BK sebelum berlaku.">
      {error && <Notice text={error} />}
      <Card>
        <H2>Siswa</H2>
        {student ? (
          <>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>
              {student.name}, {student.classGroup ?? "-"}
            </Text>
            <Btn tone="secondary" label="Ganti siswa" onPress={() => setStudent(null)} />
          </>
        ) : (
          <>
            <Field label="Cari nama" value={q} onChangeText={setQ} />
            {results.map((s) => (
              <Pressable key={s.id} accessibilityRole="button" onPress={() => setStudent(s)} style={option(false)}>
                <Text style={{ fontSize: 16, color: colors.ink }}>
                  {s.name}, {s.classGroup ?? "-"}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </Card>
      <Card>
        <H2>Jenis pelanggaran</H2>
        {types?.length === 0 && <Muted>Belum ada jenis pelanggaran.</Muted>}
        {types?.map((t) => (
          <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ selected: type === t.id }} onPress={() => setType(t.id)} style={option(type === t.id)}>
            <Text style={{ fontSize: 16, color: colors.ink, fontWeight: type === t.id ? "700" : "500" }}>
              {t.name} ({t.points} poin)
            </Text>
          </Pressable>
        ))}
      </Card>
      <Field label="Catatan" value={note} onChangeText={setNote} multiline />
      <PhotoPicker uri={photo} onChange={setPhoto} label="Tambah foto" />
      <Btn label="Kirim laporan" onPress={submit} busy={busy} disabled={!student || !type} />
    </Screen>
  );
}
