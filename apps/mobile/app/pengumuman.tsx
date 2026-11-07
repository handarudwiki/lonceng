import { Card, Empty, H2, Muted, Notice, Screen } from "@/components/ui";
import { dateLabel } from "@/lib/theme";
import { useApi } from "@/lib/use-api";

type Item = { id: string; title: string; body: string; createdAt: string };

export default function Announcements() {
  const { data, error, loading, reload } = useApi<Item[]>("/announcements");
  return (
    <Screen back title="Pengumuman" onRefresh={reload} refreshing={loading}>
      {error && <Notice text={error} />}
      {data?.length === 0 && <Empty text="Belum ada pengumuman." />}
      {data?.map((a) => (
        <Card key={a.id}>
          <H2>{a.title}</H2>
          <Muted>{a.body}</Muted>
          <Muted>{dateLabel(a.createdAt)}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
