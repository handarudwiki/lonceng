import { useRouter } from "expo-router";
import { useState } from "react";
import { Btn, Card, Field, H2, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { useSession, type Mode } from "@/lib/session";
import { type Tone } from "@/lib/theme";
import { useApi } from "@/lib/use-api";
import type { ChildDetail } from "./index";

export default function Account() {
  const router = useRouter();
  const { profile, school, mode, child, setMode, selectSchool, signOut } = useSession();
  const { data } = useApi<ChildDetail>(mode === "guardian" && child ? `/children/${child.id}` : null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);

  const changePassword = async () => {
    try {
      await api("/me/password", { body: { current, next } });
      await signOut();
      router.replace("/login");
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof ApiFailure ? e.message : "Gagal mengubah kata sandi" });
    }
  };

  return (
    <Screen title="Akun">
      {message && <Notice tone={message.tone} text={message.text} />}
      <Card>
        <H2>{profile?.user.name}</H2>
        <Muted>{profile?.user.email ?? profile?.user.phone ?? ""}</Muted>
        <Muted>{school?.roleLabels.join(", ")}</Muted>
      </Card>
      {school?.isGuardian && school.isStaff && (
        <Segmented<Mode>
          value={mode ?? "teacher"}
          onChange={setMode}
          options={[
            { value: "teacher", label: "Mode guru" },
            { value: "guardian", label: "Mode wali murid" },
          ]}
        />
      )}
      {(profile?.schools.length ?? 0) > 1 && (
        <Card>
          <H2>Sekolah</H2>
          {profile?.schools.map((s) => (
            <Btn key={s.id} tone={s.id === school?.id ? "primary" : "secondary"} label={s.name} onPress={() => selectSchool(s.id)} />
          ))}
        </Card>
      )}
      {data && (
        <Card>
          <H2>Data anak</H2>
          <Row label="Nama" value={data.child.name} />
          <Row label="NIS" value={data.child.identifier ?? "-"} />
          <Row label="Rombel" value={data.child.classGroup ?? "-"} />
          <Row label="Wali kelas" value={data.child.homeroom ?? "-"} />
          <Row label="Kartu presensi" value={data.child.cardUid ?? "-"} />
        </Card>
      )}
      <Card>
        <H2>Ubah kata sandi</H2>
        <Field label="Kata sandi lama" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label="Kata sandi baru" value={next} onChangeText={setNext} secureTextEntry />
        <Btn tone="secondary" label="Simpan" onPress={changePassword} disabled={!current || next.length < 8} />
      </Card>
      <Btn
        tone="danger"
        label="Keluar"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
    </Screen>
  );
}
