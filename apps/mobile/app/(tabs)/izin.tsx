import { useState } from "react";
import { DateStepper } from "@/components/month-recap";
import { Badge, Btn, Card, Empty, Field, H2, Muted, Notice, Screen, Segmented } from "@/components/ui";
import { PhotoPicker } from "@/components/photo-picker";
import { api, ApiFailure, uploadPhoto } from "@/lib/api";
import { useSession } from "@/lib/session";
import { dateLabel, localDate, type Tone } from "@/lib/theme";
import { useApi } from "@/lib/use-api";
import { ChildPicker } from "./index";

type Leave = { id: string; name: string; type: "permit" | "sick" | "leave"; startDate: string; endDate: string; reason: string; status: "pending" | "approved" | "rejected" };

const TYPE_LABEL = { permit: "Izin", sick: "Sakit", leave: "Cuti" };
const STATUS: Record<Leave["status"], [string, Tone]> = { pending: ["Menunggu", "warn"], approved: ["Disetujui", "good"], rejected: ["Ditolak", "bad"] };

export default function LeaveScreen() {
  const { mode, child, school } = useSession();
  const { data: me } = useApi<{ person: { id: string; name: string } }>(mode === "teacher" ? "/teacher/today" : null);
  const { data, error, reload } = useApi<Leave[]>(school ? `/leaves?school=${school.id}` : null);
  const [type, setType] = useState<Leave["type"]>("sick");
  const [startDate, setStart] = useState(localDate);
  const [endDate, setEnd] = useState(localDate);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const personId = mode === "teacher" ? me?.person.id : child?.id;

  const submit = async () => {
    if (!personId) return;
    setBusy(true);
    setMessage(null);
    try {
      const attachmentPath = photo ? await uploadPhoto(photo) : null;
      await api("/leaves", { body: { personId, type, startDate, endDate, reason, attachmentPath } });
      setReason("");
      setPhoto(null);
      setMessage({ tone: "good", text: "Permohonan terkirim. Anda akan diberi tahu saat diproses." });
      await reload();
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof ApiFailure ? e.message : "Gagal mengirim" });
    } finally {
      setBusy(false);
    }
  };

  const options = mode === "teacher" ? (["sick", "leave", "permit"] as const) : (["sick", "permit"] as const);
  return (
    <Screen title="Izin" subtitle={mode === "teacher" ? me?.person.name : child?.name}>
      {mode === "guardian" && <ChildPicker />}
      {message && <Notice tone={message.tone} text={message.text} />}
      <Card>
        <H2>Ajukan izin</H2>
        <Segmented value={type} onChange={setType} options={options.map((value) => ({ value, label: TYPE_LABEL[value] }))} />
        <DateStepper
          label="Mulai"
          date={startDate}
          onChange={(d) => {
            setStart(d);
            if (d > endDate) setEnd(d);
          }}
        />
        <DateStepper label="Selesai" date={endDate} min={startDate} onChange={setEnd} />
        <Field label="Alasan" value={reason} onChangeText={setReason} multiline />
        <PhotoPicker uri={photo} onChange={setPhoto} label="Lampirkan foto surat" />
        <Btn label="Kirim" onPress={submit} busy={busy} disabled={reason.length < 3 || !personId} />
      </Card>
      <H2>Riwayat</H2>
      {error && <Notice text={error} />}
      {data?.length === 0 && <Empty text="Belum ada permohonan." />}
      {data?.map((l) => (
        <Card key={l.id}>
          <Badge tone={STATUS[l.status][1]} label={STATUS[l.status][0]} />
          <H2>
            {TYPE_LABEL[l.type]}, {l.name}
          </H2>
          <Muted>{l.startDate === l.endDate ? dateLabel(l.startDate) : `${dateLabel(l.startDate)} - ${dateLabel(l.endDate)}`}</Muted>
          <Muted>{l.reason}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
