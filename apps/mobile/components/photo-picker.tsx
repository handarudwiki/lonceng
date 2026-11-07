import * as ImagePicker from "expo-image-picker";
import { Image, View } from "react-native";
import { Btn } from "./ui";

export function PhotoPicker({ uri, onChange, label }: { uri: string | null; onChange: (uri: string | null) => void; label: string }) {
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!result.canceled) onChange(result.assets[0]?.uri ?? null);
  };
  return (
    <View style={{ gap: 8 }}>
      {uri && <Image source={{ uri }} style={{ width: "100%", height: 160, borderRadius: 12 }} resizeMode="cover" accessibilityLabel="Foto terpilih" />}
      <Btn tone="secondary" label={uri ? "Ganti foto" : label} onPress={pick} />
    </View>
  );
}
