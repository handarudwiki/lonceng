import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Card, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { colors } from "@/lib/theme";

type Qr = { token: string; expiresAt: number };

/** MG-02 / BR-10: refreshed before expiry, so a screenshot is useless within a minute. */
export default function PersonalQr() {
  const [qr, setQr] = useState<Qr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const load = async () => {
      try {
        const next = await api<Qr>("/teacher/qr");
        if (!alive) return;
        setQr(next);
        setError(null);
        timer = setTimeout(load, Math.max(5_000, next.expiresAt * 1000 - Date.now() - 10_000));
      } catch (e) {
        if (!alive) return;
        setError(e instanceof ApiFailure ? e.message : "Gagal memuat QR");
        timer = setTimeout(load, 5_000);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setLeft(qr ? Math.max(0, Math.round(qr.expiresAt - Date.now() / 1000)) : 0), 1000);
    return () => clearInterval(id);
  }, [qr]);

  return (
    <Screen back title="QR presensi" subtitle="Tunjukkan ke scanner sekolah saat masuk dan pulang.">
      {error && <Notice text={error} />}
      <Card style={{ alignItems: "center", paddingVertical: 28 }}>
        <View accessible accessibilityLabel="Kode QR presensi">{qr ? <QRCode value={qr.token} size={260} /> : <View style={{ height: 260 }} />}</View>
        <Text style={{ marginTop: 12, fontSize: 18, fontWeight: "800", color: colors.ink }}>{qr ? `Berganti dalam ${left} detik` : "Memuat..."}</Text>
        <Muted>Tangkapan layar tidak berlaku.</Muted>
      </Card>
    </Screen>
  );
}
