import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

let currentToken: string | null = null;

/** Best effort: without push, parents still have the in-app notification centre. */
export async function registerForPush() {
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Lonceng", importance: Notifications.AndroidImportance.HIGH });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    currentToken = data;
    await api("/me/push-token", { body: { token: data, platform: Platform.OS } });
  } catch (error) {
    console.warn("Push tidak aktif", error);
  }
}

export async function unregisterPush() {
  const token = currentToken;
  currentToken = null;
  return token ?? undefined;
}
