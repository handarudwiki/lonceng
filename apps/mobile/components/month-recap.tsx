import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors, dateLabel, monthLabel, shiftDate, shiftMonth } from "@/lib/theme";
import { Card } from "./ui";

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Bulan sebelumnya" hitSlop={12} onPress={() => onChange(shiftMonth(month, -1))} style={{ padding: 8 }}>
        <ChevronLeft size={24} color={colors.ink} />
      </Pressable>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.ink }}>{monthLabel(month)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Bulan berikutnya" hitSlop={12} onPress={() => onChange(shiftMonth(month, 1))} style={{ padding: 8 }}>
        <ChevronRight size={24} color={colors.ink} />
      </Pressable>
    </View>
  );
}

export function DateStepper({ label, date, min, onChange }: { label: string; date: string; min?: string; onChange: (d: string) => void }) {
  const atMin = !!min && date <= min;
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 50 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, hari sebelumnya`} disabled={atMin} hitSlop={8} onPress={() => onChange(shiftDate(date, -1))} style={{ padding: 12, opacity: atMin ? 0.3 : 1 }}>
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{dateLabel(date)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, hari berikutnya`} hitSlop={8} onPress={() => onChange(shiftDate(date, 1))} style={{ padding: 12 }}>
          <ChevronRight size={22} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export function RecapTiles({ present, late, permit, sick, absent }: { present: number; late: number; permit: number; sick: number; absent: number }) {
  const tiles = [
    ["Hadir", present + late],
    ["Izin", permit + sick],
    ["Alpha", absent],
  ] as const;
  return (
    <Card style={{ flexDirection: "row" }}>
      {tiles.map(([label, value]) => (
        <View key={label} style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.ink }}>{value}</Text>
          <Text style={{ fontSize: 15, color: colors.ink2 }}>{label}</Text>
        </View>
      ))}
    </Card>
  );
}
