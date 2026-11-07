import { Redirect, Tabs } from "expo-router";
import { Bell, CalendarCheck, FileText, Home, User } from "lucide-react-native";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const { profile, loading } = useSession();
  if (!loading && !profile) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.ink3, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: "Beranda", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="rekap" options={{ title: "Rekap", tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} /> }} />
      <Tabs.Screen name="izin" options={{ title: "Izin", tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
      <Tabs.Screen name="notifikasi" options={{ title: "Notifikasi", tabBarIcon: ({ color, size }) => <Bell color={color} size={size} /> }} />
      <Tabs.Screen name="akun" options={{ title: "Akun", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
