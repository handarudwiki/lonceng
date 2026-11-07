import { Text } from "react-native";
import { Card, Empty, H2, Muted, Notice, Screen } from "@/components/ui";
import { useSession } from "@/lib/session";
import { colors, dateLabel } from "@/lib/theme";
import { useApi } from "@/lib/use-api";
import type { ChildDetail } from "./(tabs)/index";

/** MW-08. */
export default function Violations() {
  const { child } = useSession();
  const { data, error } = useApi<ChildDetail>(child ? `/children/${child.id}` : null);
  return (
    <Screen back title="Pelanggaran" subtitle={child?.name}>
      {error && <Notice text={error} />}
      <Card style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 36, fontWeight: "800", color: colors.ink }}>{data?.points ?? 0}</Text>
        <Muted>poin terkumpul</Muted>
      </Card>
      {data?.violations.length === 0 && <Empty text="Tidak ada catatan pelanggaran." />}
      {data?.violations.map((v) => (
        <Card key={v.id}>
          <H2>{v.name}</H2>
          <Muted>
            {dateLabel(v.date)}, {v.points} poin
          </Muted>
          {v.note && <Muted>{v.note}</Muted>}
        </Card>
      ))}
    </Screen>
  );
}
