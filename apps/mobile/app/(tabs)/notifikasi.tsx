import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text } from "react-native";
import { Card, Empty, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { colors, dateLabel } from "@/lib/theme";
import { useApi } from "@/lib/use-api";

type Item = { id: string; title: string; body: string; read: boolean; createdAt: string; school: string };

export default function Notifications() {
  const { data, error, loading, reload } = useApi<Item[]>("/notifications");
  useFocusEffect(
    useCallback(() => {
      void api("/notifications/read", { body: {} }).catch(() => undefined);
    }, []),
  );
  return (
    <Screen title="Notifikasi" onRefresh={reload} refreshing={loading}>
      {error && <Notice text={error} />}
      {data?.length === 0 && <Empty text="Belum ada notifikasi." />}
      {data?.map((n) => (
        <Card key={n.id} style={!n.read ? { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft } : undefined}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{n.title}</Text>
          <Muted>{n.body}</Muted>
          <Text style={{ fontSize: 13, color: colors.ink3 }}>
            {dateLabel(n.createdAt)}, {n.school}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
