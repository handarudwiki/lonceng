import { useState } from "react";
import { Linking, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { MonthPicker, RecapTiles } from "@/components/month-recap";
import { Badge, Btn, Card, Empty, H2, Muted, Notice, Row, Screen } from "@/components/ui";
import { API_URL, authHeaders } from "@/lib/api";
import { useSession } from "@/lib/session";
import { dateLabel, localDate, STATUS_TONE } from "@/lib/theme";
import { useApi } from "@/lib/use-api";
import { ChildPicker } from "./index";

type Counts = { present: number; late: number; permit: number; sick: number; absent: number };
type Day = { date: string; status: string; checkIn?: string; checkOut?: string };

const currentMonth = () => localDate().slice(0, 7);

export default function Recap() {
  const { mode } = useSession();
  return mode === "teacher" ? <TeacherRecap /> : <GuardianRecap />;
}

function Days({ days }: { days: Day[] }) {
  if (days.length === 0) return <Empty text="Belum ada data di bulan ini." />;
  return (
    <Card>
      {days.map((d) => (
        <View key={d.date} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
          <Muted>{dateLabel(d.date)}</Muted>
          <Badge tone={STATUS_TONE[d.status]} label={d.status} />
        </View>
      ))}
    </Card>
  );
}

function TeacherRecap() {
  const [month, setMonth] = useState(currentMonth);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error } = useApi<Counts & { days: Day[] }>(`/teacher/recap?month=${month}`);
  const { data: lessons } = useApi<{ date: string; group: string; subject: string; present: number; absent: number }[]>(`/teacher/lesson-report?month=${month}`);

  const download = async () => {
    setBusy(true);
    setDownloadError(null);
    try {
      const target = new File(Paths.cache, `presensi-pelajaran-${month}.pdf`);
      if (target.exists) target.delete();
      const file = await File.downloadFileAsync(`${API_URL}/api/v1/teacher/lesson-report?format=pdf&month=${month}`, target, { headers: authHeaders() });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
      else await Linking.openURL(file.uri);
    } catch {
      setDownloadError("PDF gagal diunduh. Periksa koneksi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Rekap saya">
      <MonthPicker month={month} onChange={setMonth} />
      {error && <Notice text={error} />}
      {data && <RecapTiles {...data} />}
      {data && <Days days={data.days} />}
      <H2>Presensi pelajaran</H2>
      {downloadError && <Notice text={downloadError} />}
      {lessons?.length === 0 && <Empty text="Belum ada sesi di bulan ini." />}
      {!!lessons?.length && (
        <Card>
          {lessons.map((l, i) => (
            <Row key={i} label={`${dateLabel(l.date)}, ${l.group}`} value={`${l.subject}: ${l.present} hadir, ${l.absent} alpha`} />
          ))}
        </Card>
      )}
      <Btn tone="secondary" label="Unduh PDF" onPress={download} busy={busy} />
    </Screen>
  );
}

function GuardianRecap() {
  const { child } = useSession();
  const [month, setMonth] = useState(currentMonth);
  const { data, error } = useApi<{ recap: Counts; days: Day[]; subjects: { subject: string; present: number; missed: number }[] }>(child ? `/children/${child.id}?month=${month}` : null);
  return (
    <Screen title="Rekap kehadiran" subtitle={child?.name}>
      <ChildPicker />
      <MonthPicker month={month} onChange={setMonth} />
      {error && <Notice text={error} />}
      {data && <RecapTiles {...data.recap} />}
      {!!data?.subjects.length && (
        <>
          <H2>Per mata pelajaran</H2>
          <Card>
            {data.subjects.map((s) => (
              <Row key={s.subject} label={s.subject} value={`${s.present} hadir, ${s.missed} tidak`} />
            ))}
          </Card>
        </>
      )}
      {data && <Days days={data.days} />}
    </Screen>
  );
}
