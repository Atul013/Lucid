/* Backend connection settings, entered once on-device and kept in the
 * platform keychain — never bundled into the app binary.
 *
 * The Electron client and the old secure_os_layer review both hit the same
 * mistake: baking a credential into client code makes it extractable from
 * the shipped app. expo-secure-store (iOS Keychain / Android Keystore)
 * avoids that; EXPO_PUBLIC_* env vars would not, since those get inlined
 * into the JS bundle at build time.
 *
 * expo-secure-store's web target is a stub (no keychain equivalent in a
 * browser) — calling it there throws "getValueWithKeyAsync is not a
 * function". Fall back to localStorage on web; it's not secure-store-grade,
 * but `expo start --web` is a dev-preview convenience (this repo already
 * has a real web app in frontend/), not where a production key belongs.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const URL_KEY = "lucid_api_url";
const API_KEY_KEY = "lucid_api_key";

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getApiUrl(): Promise<string | null> {
  return getItem(URL_KEY);
}

export async function setApiUrl(url: string): Promise<void> {
  await setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
}

export async function getApiKey(): Promise<string | null> {
  return getItem(API_KEY_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await setItem(API_KEY_KEY, key.trim());
}

export async function isConfigured(): Promise<boolean> {
  const url = await getApiUrl();
  return Boolean(url);
  // API key is optional — the backend only requires it when LUCID_API_KEY
  // is set server-side (see backend/app/security.py), same as the web app.
}
