import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, archiveAsk, getHealth, type ArchiveAskResponse } from "./lib/api";
import { getApiKey, getApiUrl, isConfigured, setApiKey, setApiUrl } from "./lib/config";

export default function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<ArchiveAskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [url, key, ready] = await Promise.all([getApiUrl(), getApiKey(), isConfigured()]);
      setUrlInput(url ?? "");
      setKeyInput(key ?? "");
      setConfigured(ready);
    })();
  }, []);

  const saveSettings = useCallback(async () => {
    setSettingsError(null);
    const trimmed = urlInput.trim();
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setSettingsError("URL must start with http:// or https://");
      return;
    }
    await setApiUrl(trimmed);
    await setApiKey(keyInput);
    try {
      await getHealth();
      setConfigured(true);
    } catch (e) {
      setSettingsError(
        e instanceof ApiError
          ? `Saved, but the backend rejected the check: ${e.message}`
          : "Saved, but couldn't reach the backend — check the URL and that it's running."
      );
      setConfigured(true); // still let them proceed; /archive/ask will surface real errors
    }
  }, [urlInput, keyInput]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAskError(null);
    setResult(null);
    try {
      const res = await archiveAsk(q);
      setResult(res);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAsking(false);
    }
  }, [question]);

  if (configured === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Lucid</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.50:8000"
            autoCapitalize="none"
            autoCorrect={false}
            value={urlInput}
            onChangeText={setUrlInput}
          />
          <Text style={styles.label}>API key (optional — only if the server requires one)</Text>
          <TextInput
            style={styles.input}
            placeholder="LUCID_API_KEY value"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={keyInput}
            onChangeText={setKeyInput}
          />
          <Pressable style={styles.button} onPress={saveSettings}>
            <Text style={styles.buttonText}>Save & test connection</Text>
          </Pressable>
          {settingsError ? <Text style={styles.error}>{settingsError}</Text> : null}
        </View>

        {configured ? (
          <View style={styles.section}>
            <Text style={styles.label}>Ask your archive</Text>
            <TextInput
              style={styles.input}
              placeholder="What did I promise Priya last week?"
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={ask}
              returnKeyType="send"
            />
            <Pressable style={styles.button} onPress={ask} disabled={asking}>
              <Text style={styles.buttonText}>{asking ? "Asking…" : "Ask"}</Text>
            </Pressable>
            {askError ? <Text style={styles.error}>{askError}</Text> : null}
            {result ? (
              <View style={styles.answerBox}>
                <Text style={styles.answer}>{result.answer}</Text>
                {result.sources.length > 0 ? (
                  <Text style={styles.sourcesLabel}>
                    {result.sources.length} source{result.sources.length === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, paddingTop: 60, gap: 24 },
  title: { fontSize: 28, fontWeight: "700" },
  section: { gap: 8 },
  label: { fontSize: 13, color: "#555", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b00020", fontSize: 13 },
  answerBox: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  answer: { fontSize: 15, lineHeight: 21 },
  sourcesLabel: { fontSize: 12, color: "#777" },
});
