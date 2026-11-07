import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Btn, Field, Notice, Screen } from "@/components/ui";
import { ApiFailure } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function Login() {
  const { signIn } = useSession();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier, password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Lonceng Sekolah" subtitle="Sekolah terhubung, orang tua tenang">
      {error && <Notice text={error} />}
      <Field label="Email atau nomor HP" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="username" keyboardType="email-address" />
      <Field label="Kata sandi" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Btn label="Masuk" onPress={submit} busy={busy} disabled={!identifier || !password} />
      <View style={{ alignItems: "center", paddingTop: 12 }}>
        <Link href="/activate">
          <Text style={{ color: colors.brandText, fontSize: 16, fontWeight: "700" }}>Baru pertama kali? Aktifkan akun</Text>
        </Link>
      </View>
    </Screen>
  );
}
