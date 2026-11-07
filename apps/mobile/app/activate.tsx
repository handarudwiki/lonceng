import { useRouter } from "expo-router";
import { useState } from "react";
import { Btn, Field, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

/** MW-01: the school creates the account; the parent proves the phone or email is theirs. */
export default function Activate() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="Aktifkan akun" subtitle="Gunakan nomor HP atau email yang didaftarkan di sekolah.">
      {error && <Notice text={error} />}
      {step === "request" && (
        <>
          <Field label="Nomor HP atau email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
          <Btn
            label="Kirim kode"
            busy={busy}
            disabled={identifier.length < 3}
            onPress={() =>
              run(async () => {
                await api("/auth/activate/request", { body: { identifier } });
                setStep("confirm");
              })
            }
          />
        </>
      )}
      {step === "confirm" && (
        <>
          <Muted>Bila nomor atau email terdaftar, kode 6 digit sudah dikirim.</Muted>
          <Field label="Kode" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Field label="Buat kata sandi" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Btn
            label="Aktifkan"
            busy={busy}
            disabled={code.length !== 6 || password.length < 8}
            onPress={() =>
              run(async () => {
                await api("/auth/activate/confirm", { body: { identifier, code, password } });
                setStep("done");
              })
            }
          />
        </>
      )}
      {step === "done" && (
        <>
          <Notice tone="good" text="Akun aktif. Silakan masuk." />
          <Btn label="Ke halaman masuk" onPress={() => router.replace("/login")} />
        </>
      )}
    </Screen>
  );
}
