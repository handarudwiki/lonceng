import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Badge, Btn, Card, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { colors, type Tone } from "@/lib/theme";

type Status = "present" | "permit" | "sick" | "absent";
type Student = { id: string; name: string; identifier: string | null; qrCode: string; status: Status | null; onLeave: boolean };
type Session = { sessionId: string; subject: string; classGroup: string; students: Student[] };

const LABEL: Record<Status, string> = { present: "Hadir", permit: "Izin", sick: "Sakit", absent: "Alpha" };
const TONE: Record<Status, Tone> = { present: "good", permit: "info", sick: "info", absent: "bad" };
const ORDER: Status[] = ["present", "absent", "permit", "sick"];

/** MG-06: everyone starts Hadir, so the teacher only taps the exceptions. */
export default function LessonSession() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const lastCode = useRef("");

  useEffect(() => {
    api<Session>("/teacher/sessions/open", { body: { rosterEntryId: entryId } })
      .then((s) => {
        setSession(s);
        setMarks(Object.fromEntries(s.students.map((x) => [x.id, x.status ?? "present"])));
      })
      .catch((e) => setError(e instanceof ApiFailure ? e.message : "Sesi gagal dibuka"));
  }, [entryId]);

  const byCode = useMemo(() => new Map(session?.students.map((s) => [s.qrCode, s])), [session]);

  const cycle = (student: Student) => {
    const next = ORDER[(ORDER.indexOf(marks[student.id] ?? "present") + 1) % ORDER.length]!;
    setMarks((m) => ({ ...m, [student.id]: next }));
  };

  const onScan = (code: string) => {
    if (code === lastCode.current) return;
    lastCode.current = code;
    const student = byCode.get(code);
    if (!student) {
      setError("QR bukan milik siswa di kelas ini");
      return;
    }
    setError(null);
    setMarks((m) => ({ ...m, [student.id]: "present" }));
    setScanned((s) => new Set(s).add(student.id));
  };

  const startScan = async () => {
    if (!permission?.granted && !(await requestPermission()).granted) {
      setError("Izin kamera ditolak. Pakai daftar di bawah.");
      return;
    }
    setScanning(!scanning);
  };

  const submit = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api("/teacher/sessions/submit", {
        body: { sessionId: session.sessionId, marks: session.students.map((s) => ({ studentId: s.id, status: marks[s.id] ?? "present", method: scanned.has(s.id) ? "qr" : "manual" })) },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  const present = session?.students.filter((s) => marks[s.id] === "present").length ?? 0;
  return (
    <Screen back title={session?.subject ?? "Presensi pelajaran"} subtitle={session ? `${session.classGroup}, ${present}/${session.students.length} hadir` : undefined}>
      {error && <Notice text={error} />}
      {session && (
        <>
          <Btn tone="secondary" label={scanning ? "Tutup kamera" : "Scan QR siswa"} onPress={startScan} />
          {scanning && (
            <View style={{ height: 240, borderRadius: 16, overflow: "hidden" }}>
              <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => onScan(data)} />
            </View>
          )}
          <Muted>Ketuk nama untuk mengganti status.</Muted>
          <Card>
            {session.students.map((s) => {
              const status = marks[s.id] ?? "present";
              return (
                <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.name}, ${LABEL[status]}`} onPress={() => cycle(s)} style={{ flexDirection: "row", alignItems: "center", minHeight: 48, gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 16, color: colors.ink, fontWeight: "600" }}>{s.name}</Text>
                  {s.onLeave && <Badge label="Izin aktif" />}
                  <Badge tone={TONE[status]} label={LABEL[status]} />
                </Pressable>
              );
            })}
          </Card>
          <Btn label="Simpan presensi" onPress={submit} busy={busy} />
        </>
      )}
    </Screen>
  );
}
