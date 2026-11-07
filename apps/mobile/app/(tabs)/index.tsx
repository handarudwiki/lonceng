import { useRouter } from "expo-router";
import { Megaphone, QrCode, ShieldAlert } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Badge, Card, Empty, H2, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { useSession, type Child } from "@/lib/session";
import { colors, STATUS_TONE } from "@/lib/theme";
import { useApi } from "@/lib/use-api";

export default function Home() {
  const { mode } = useSession();
  return mode === "teacher" ? <TeacherHome /> : <GuardianHome />;
}

type Lesson = { entryId: string; classGroup: string; subject: string; startTime: string; endTime: string; canOpen: boolean; submitted: boolean };
type TeacherToday = { person: { name: string }; attendance: { status: string; checkIn: string; checkOut: string } | null; schedule: Lesson[] };

function Shortcut({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, minHeight: 84, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6, padding: 8 }}>
      {icon}
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function TeacherHome() {
  const router = useRouter();
  const { school } = useSession();
  const { data, error, loading, reload } = useApi<TeacherToday>(school ? `/teacher/today?school=${school.id}` : null);
  return (
    <Screen title={data ? `Halo, ${data.person.name.split(" ")[0]}` : "Beranda"} subtitle={school?.name} onRefresh={reload} refreshing={loading}>
      {error && <Notice text={error} />}
      <Card>
        <H2>Kehadiran hari ini</H2>
        {data?.attendance ? (
          <>
            <Badge tone={STATUS_TONE[data.attendance.status]} label={data.attendance.status} />
            <Row label="Masuk" value={data.attendance.checkIn} />
            <Row label="Pulang" value={data.attendance.checkOut} />
          </>
        ) : (
          <Muted>Belum presensi. Tunjukkan QR ke scanner sekolah.</Muted>
        )}
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Shortcut label="QR saya" icon={<QrCode size={24} color={colors.brand} />} onPress={() => router.push("/qr")} />
        <Shortcut label="Lapor pelanggaran" icon={<ShieldAlert size={24} color={colors.brand} />} onPress={() => router.push("/lapor")} />
        <Shortcut label="Pengumuman" icon={<Megaphone size={24} color={colors.brand} />} onPress={() => router.push("/pengumuman")} />
      </View>
      <H2>Jadwal mengajar hari ini</H2>
      {data && data.schedule.length === 0 && <Empty text="Tidak ada jadwal hari ini." />}
      {data?.schedule.map((s) => (
        <Pressable key={s.entryId} disabled={!s.canOpen} accessibilityRole="button" accessibilityState={{ disabled: !s.canOpen }} onPress={() => router.push({ pathname: "/sesi", params: { entryId: s.entryId } })}>
          <Card style={s.canOpen ? { borderColor: colors.brand, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, flex: 1 }}>{s.subject}</Text>
              {s.submitted ? <Badge tone="good" label="Sudah diisi" /> : s.canOpen ? <Badge tone="info" label="Ketuk untuk presensi" /> : null}
            </View>
            <Muted>
              {s.classGroup}, {s.startTime}-{s.endTime}
            </Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

export type ChildDetail = {
  child: { id: string; name: string; identifier: string | null; classGroup: string | null; homeroom: string | null; cardUid: string | null };
  today: { status: string; checkIn: string; checkOut: string; lateMinutes: number } | null;
  schedule: { subject: string; teacher: string; startTime: string; endTime: string; status: string | null }[];
  points: number;
  violations: { id: string; name: string; points: number; date: string; note: string | null }[];
};

const LESSON = { present: "Hadir", permit: "Izin", sick: "Sakit", absent: "Alpha" } as const;

export function ChildPicker() {
  const { children, child, selectChild } = useSession();
  if (children.length < 2) return null;
  return <Segmented<string> value={child?.id ?? ""} onChange={(id) => selectChild(children.find((c: Child) => c.id === id)!)} options={children.map((c) => ({ value: c.id, label: c.name.split(" ")[0]! }))} />;
}

function GuardianHome() {
  const router = useRouter();
  const { child, school } = useSession();
  const { data, error, loading, reload } = useApi<ChildDetail>(child ? `/children/${child.id}` : null);
  if (!child) {
    return (
      <Screen title="Beranda" subtitle={school?.name}>
        <Empty text="Belum ada anak yang terhubung. Hubungi sekolah." />
      </Screen>
    );
  }
  return (
    <Screen title={child.name} subtitle={`${child.classGroup ?? "-"}, ${school?.name ?? ""}`} onRefresh={reload} refreshing={loading}>
      <ChildPicker />
      {error && <Notice text={error} />}
      <Card>
        <H2>Hari ini</H2>
        {data?.today ? (
          <>
            <Badge tone={STATUS_TONE[data.today.status]} label={data.today.lateMinutes > 0 ? `Terlambat ${data.today.lateMinutes} menit` : data.today.status} />
            <Row label="Masuk" value={data.today.checkIn} />
            <Row label="Pulang" value={data.today.checkOut} />
          </>
        ) : (
          <Muted>Belum ada presensi hari ini.</Muted>
        )}
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Shortcut label={`Pelanggaran (${data?.points ?? 0} poin)`} icon={<ShieldAlert size={24} color={colors.brand} />} onPress={() => router.push("/pelanggaran")} />
        <Shortcut label="Pengumuman" icon={<Megaphone size={24} color={colors.brand} />} onPress={() => router.push("/pengumuman")} />
      </View>
      <H2>Jadwal hari ini</H2>
      {data && data.schedule.length === 0 && <Empty text="Tidak ada jadwal hari ini." />}
      {data?.schedule.map((s, i) => (
        <Card key={i}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, flex: 1 }}>{s.subject}</Text>
            {s.status && <Badge tone={STATUS_TONE[LESSON[s.status as keyof typeof LESSON]]} label={LESSON[s.status as keyof typeof LESSON]} />}
          </View>
          <Muted>
            {s.startTime}-{s.endTime}, {s.teacher}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}
