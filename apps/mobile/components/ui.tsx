import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, type Tone } from "@/lib/theme";

export function Screen({ title, subtitle, back, children, onRefresh, refreshing, right }: { title?: string; subtitle?: string; back?: boolean; children: ReactNode; onRefresh?: () => void; refreshing?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 32, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
    >
      {back && (
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeft size={22} color={colors.ink} />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>
      )}
      {title && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Btn({ label, onPress, tone = "primary", disabled, busy }: { label: string; onPress: () => void; tone?: "primary" | "secondary" | "danger"; disabled?: boolean; busy?: boolean }) {
  const fg = tone === "primary" ? "#fff" : tone === "danger" ? colors.bad : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.btn, tone === "primary" && { backgroundColor: colors.brand }, tone === "secondary" && styles.btnSecondary, tone === "danger" && { backgroundColor: colors.badSoft }, (pressed || disabled) && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.ink3} style={[styles.input, props.multiline && { height: 96, textAlignVertical: "top", paddingTop: 12 }]} {...props} />
    </View>
  );
}

const TONES: Record<Tone, [string, string]> = {
  neutral: [colors.surface2, colors.ink2],
  good: [colors.goodSoft, colors.good],
  warn: [colors.warnSoft, colors.warn],
  bad: [colors.badSoft, colors.bad],
  info: [colors.infoSoft, colors.info],
};

export function Badge({ tone = "neutral", label }: { tone?: Tone; label: string }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Notice({ tone = "bad", text }: { tone?: Tone; text: string }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{text}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)} style={[styles.segmentItem, o.value === value && { backgroundColor: colors.brand }]}>
          <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 14, color: o.value === value ? "#fff" : colors.ink2 }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  backText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, color: colors.ink2, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  h2: { fontSize: 18, fontWeight: "800", color: colors.ink },
  muted: { fontSize: 15, color: colors.ink2 },
  btn: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.surface },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 13, fontWeight: "700" },
  notice: { borderRadius: 12, padding: 12 },
  empty: { textAlign: "center", color: colors.ink3, fontSize: 15, paddingVertical: 20 },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 15, color: colors.ink2 },
  rowValue: { fontSize: 15, fontWeight: "700", color: colors.ink, flexShrink: 1, textAlign: "right" },
});
