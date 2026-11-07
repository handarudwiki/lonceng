import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function Index() {
  const { loading, profile } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }
  return <Redirect href={profile ? "/(tabs)" : "/login"} />;
}
