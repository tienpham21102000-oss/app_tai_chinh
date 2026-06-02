import { useMemo, useRef, useState, useEffect } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import { Ionicons } from "@expo/vector-icons";

import { extractTransactionFromText } from "../services/ai";
import { ensureDbReady, listCategories, type DbCategoryRow } from "../services/db";
import { extractTransactionFromReceiptImage } from "../services/ocr";
import { transcribeAudio, transcribeAudioWeb } from "../services/stt";
import { useAddIntentStore } from "../stores/addIntent";
import { useTransactionsStore } from "../stores/transactions";
import { useI18n } from "../utils/i18n";
import { formatMoneyVnd, parseMoneyToVnd } from "../utils/money";

export default function AddModal() {
  const add = useTransactionsStore((s) => s.addFromDraft);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [draft, setDraft] = useState<{
    amount: number;
    merchant?: string | null;
    category?: string | null;
    date?: string | null;
    note?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<BlobPart[]>([]);
  const webMimeTypeRef = useRef<string>("audio/webm");
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);
  const handledIntentRef = useRef(false);
  const [categories, setCategories] = useState<DbCategoryRow[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const { t } = useI18n();

  const pendingIntent = useAddIntentStore((s) => s.intent);
  const clearPendingIntent = useAddIntentStore((s) => s.clearIntent);
  const [activeIntent] = useState(pendingIntent);

  function closeScreen() {
    router.dismissTo("/");
  }

  useEffect(() => {
    clearPendingIntent();
  }, [clearPendingIntent]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await ensureDbReady();
        const rows = await listCategories();
        if (mounted) setCategories(rows);
      } catch {
        if (mounted) setCategories([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeIntent || handledIntentRef.current) return;
    handledIntentRef.current = true;
    if (activeIntent.mode === "text" && activeIntent.raw?.trim()) {
      const text = activeIntent.raw.trim();
      setRaw(text);
      void extractAndSetDraft(text);
    } else if (activeIntent.mode === "camera") {
      void onScanCameraAndOcr();
    }
  }, [activeIntent]);


  // â”€â”€â”€ Determine if we are in "focused" mode (no full Quick Add AI UI) â”€â”€â”€â”€â”€â”€â”€
  const isFocusedMode = !!activeIntent;

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function extractAndSetDraft(text: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await extractTransactionFromText(text);
      setDraft({
        amount: result.amount,
        merchant: result.merchant ?? null,
        category: result.category ?? null,
        date: result.date ?? null,
        note: result.note ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract.");
    } finally {
      setLoading(false);
    }
  }

  async function onExtract() {
    await extractAndSetDraft(raw);
  }

  async function onStartRecording() {
    if (recorderState.isRecording) return;
    setError(null);
    try {
      console.log("[add] voice:start", Platform.OS);
      if (Platform.OS === "web") {
        console.log("[add] voice:web:getUserMedia");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType =
          (typeof MediaRecorder !== "undefined" &&
            (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
              ? "audio/webm;codecs=opus"
              : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
              ? "audio/ogg;codecs=opus"
              : "")) ||
          "";
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        webChunksRef.current = [];
        webMimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) webChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        webRecorderRef.current = recorder;
        return;
      }

      console.log("[add] voice:native:requestPermissions");
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error("Microphone permission denied.");

      console.log("[add] voice:native:setAudioMode");
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      console.log("[add] voice:native:prepare");
      await audioRecorder.prepareToRecordAsync();
      console.log("[add] voice:native:start");
      await audioRecorder.record();
      console.log("[add] voice:started");
    } catch (e) {
      console.log("[add] voice:error", e);
      setError(e instanceof Error ? e.message : "Failed to start recording.");
    }
  }

  async function onStopAndTranscribe() {
    if (Platform.OS === "web") {
      const recorder = webRecorderRef.current;
      if (!recorder) return;
      setVoiceLoading(true);
      setError(null);
      try {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });
        const mimeType = webMimeTypeRef.current || "audio/webm";
        const blob = new Blob(webChunksRef.current, { type: mimeType });
        const text = await transcribeAudioWeb(blob, mimeType);
        setLastVoiceText(text);
        setRaw(text);
        const result = await extractTransactionFromText(text);
        setDraft({
          amount: result.amount,
          merchant: result.merchant ?? null,
          category: result.category ?? null,
          date: result.date ?? null,
          note: result.note ?? null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Voice transcription failed.");
      } finally {
        webRecorderRef.current = null;
        webChunksRef.current = [];
        setVoiceLoading(false);
      }
      return;
    }

    if (!recorderState.isRecording && !audioRecorder.uri) return;

    setVoiceLoading(true);
    setError(null);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("No audio file URI.");

      const text = await transcribeAudio(uri);
      setLastVoiceText(text);
      setRaw(text);
      const result = await extractTransactionFromText(text);
      setDraft({
        amount: result.amount,
        merchant: result.merchant ?? null,
        category: result.category ?? null,
        date: result.date ?? null,
        note: result.note ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice transcription failed.");
    } finally {
      setVoiceLoading(false);
    }
  }

  async function onScanCameraAndOcr() {
    setOcrLoading(true);
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error("Camera permission denied.");

      const picked = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });

      if (picked.canceled) return;
      const asset = picked.assets?.[0];
      if (!asset?.uri) throw new Error("No image captured.");

      const result = await extractTransactionFromReceiptImage(asset.uri);
      setDraft({
        amount: result.amount,
        merchant: result.merchant ?? null,
        category: result.category ?? null,
        date: result.date ?? null,
        note: result.note ?? null,
      });
      setRaw((prev) => prev || "Receipt OCR (Camera)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR from Camera failed.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function onPickReceiptAndOcr() {
    setOcrLoading(true);
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error("Media library permission denied.");

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });

      if (picked.canceled) return;
      const asset = picked.assets?.[0];
      if (!asset?.uri) throw new Error("No image selected.");

      const result = await extractTransactionFromReceiptImage(asset.uri);
      setDraft({
        amount: result.amount,
        merchant: result.merchant ?? null,
        category: result.category ?? null,
        date: result.date ?? null,
        note: result.note ?? null,
      });
      setRaw((prev) => prev || "Receipt OCR (Gallery)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function onOcrTestImage() {
    setOcrLoading(true);
    setError(null);
    try {
      const asset = Asset.fromModule(require("../assets/receipt-test.png"));
      if (!asset.localUri) await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const result = await extractTransactionFromReceiptImage(uri);
      setDraft({
        amount: result.amount,
        merchant: result.merchant ?? null,
        category: result.category ?? null,
        date: result.date ?? null,
        note: result.note ?? null,
      });
      setRaw("Receipt OCR (test image)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed.");
    } finally {
      setOcrLoading(false);
    }
  }

  function onCancelRecording() {
    setError(null);
    if (Platform.OS === "web") {
      try { webRecorderRef.current?.stop(); } catch {}
      webRecorderRef.current = null;
      webChunksRef.current = [];
      return;
    }
    void audioRecorder.stop().catch(() => {});
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      if (draft) {
        await add({
          amount: draft.amount,
          merchant: draft.merchant ?? undefined,
          category: draft.category ?? undefined,
          date: draft.date ?? undefined,
          note: draft.note ?? undefined,
          raw_text: raw,
          source: activeIntent?.mode === "camera" ? "camera_ocr" : activeIntent?.mode === "voice" ? "voice" : "manual_text",
        });
        closeScreen();
        return;
      }
      if (raw.trim()) {
      setLoading(true);
        const result = await extractTransactionFromText(raw);
        await add({
          amount: result.amount,
          merchant: result.merchant ?? undefined,
          category: result.category ?? undefined,
          date: result.date ?? undefined,
          note: result.note ?? undefined,
          raw_text: raw,
          source: "manual_text",
        });
        closeScreen();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save transaction.");
    } finally {
      setLoading(false);
      setSaving(false);
    }
  }

  function selectCategory(categoryName: string | null | undefined) {
    if (!draft) return;
    setDraft({ ...draft, category: categoryName ?? "" });
    setCategoryOpen(false);
  }

  function renderCategoryPicker() {
    if (!draft) return null;
    const selected = draft.category || t("chooseCategory");
    return (
      <View className="mb-4">
        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("category")}</Text>
        <Pressable
          onPress={() => setCategoryOpen((v) => !v)}
          className="flex-row items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3"
        >
          <Text className="text-sm font-bold text-slate-800">{selected}</Text>
          <Ionicons name={categoryOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
        </Pressable>
        {categoryOpen ? (
          <View className="bg-white border border-slate-100 rounded-2xl mt-2 overflow-hidden">
            {categories.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => selectCategory(item.name)}
                className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-50"
              >
                <Text className="text-base">{item.icon ?? "🏷️"}</Text>
                <Text className="text-sm font-bold text-slate-700">{item.name ?? "Unnamed"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // â”€â”€â”€ FOCUSED MODE: voice/camera/text â€” minimal UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isFocusedMode) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-[#f8fafc]"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
      <ScrollView
        className="flex-1 px-4 pt-10"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        {/* Compact Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Pressable
            onPress={closeScreen}
            className="w-9 h-9 rounded-full bg-white border border-slate-100 shadow-sm items-center justify-center active:scale-95"
          >
            <Ionicons name="arrow-back" size={18} color="#64748b" />
          </Pressable>
          <Text className="text-sm font-black text-slate-700">
            {activeIntent?.mode === "voice" ? t("aiVoice") : activeIntent?.mode === "camera" ? t("scanBill") : t("quickType")}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Voice mode: recording status */}
        {activeIntent?.mode === "voice" && (
          <View className="items-center mb-6">
            {recorderState.isRecording ? (
              <View style={{ alignItems: "center" }}>
                {/* Pulsing recording indicator */}
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: "#f43f5e",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="mic" size={40} color="white" />
                </View>
                <Text style={{ color: "#1e293b", fontSize: 14, fontWeight: "900", marginBottom: 4 }}>Recording...</Text>
                <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 24 }}>Say the merchant and amount</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    onPress={onStopAndTranscribe}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "#f43f5e",
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 16,
                    }}
                  >
                    <Ionicons name="stop" size={16} color="white" />
                    <Text style={{ color: "white", fontSize: 14, fontWeight: "900" }}>Stop & Analyze</Text>
                  </Pressable>
                  <Pressable
                    onPress={onCancelRecording}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "white",
                      borderColor: "#e2e8f0",
                      borderWidth: 1,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 16,
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#94a3b8" />
                    <Text style={{ color: "#94a3b8", fontSize: 14, fontWeight: "900" }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : voiceLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#6366f1" />
                <Text className="text-sm font-black text-slate-700 mt-4">Analyzing voice...</Text>
                <Text className="text-xs text-slate-400 mt-1">AI is extracting expense details</Text>
              </View>
            ) : !draft ? (
              <View className="items-center py-4">
                <View className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-200 items-center justify-center mb-3">
                  <Ionicons name="mic-outline" size={36} color="#6366f1" />
                </View>
                <Text className="text-sm font-black text-slate-700 mb-1">Ready to record</Text>
                <Pressable
                  onPress={onStartRecording}
                  style={{
                    backgroundColor: "#4f46e5",
                    borderRadius: 16,
                    marginTop: 12,
                    minWidth: 180,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text className="text-white font-black">Start recording</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        {/* Camera mode: OCR loading */}
        {activeIntent?.mode === "camera" && ocrLoading && (
          <View className="items-center py-10 mb-6">
            <ActivityIndicator size="large" color="#059669" />
            <Text className="text-sm font-black text-slate-700 mt-4">Scanning receipt...</Text>
            <Text className="text-xs text-slate-400 mt-1">AI is reading the image</Text>
          </View>
        )}

        {/* Camera mode: no draft yet, offer retry */}
        {activeIntent?.mode === "camera" && !ocrLoading && !draft && (
          <View className="items-center py-4 mb-6">
            <View className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 items-center justify-center mb-3">
              <Ionicons name="camera-outline" size={36} color="#059669" />
            </View>
            <Text className="text-sm font-black text-slate-700 mb-3">
              {error ? "Could not scan image" : "Ready to open camera"}
            </Text>
            <Pressable
              onPress={onScanCameraAndOcr}
              className="bg-emerald-600 px-6 py-3 rounded-2xl shadow-md active:scale-95"
            >
              <Text className="text-white font-black">Open camera</Text>
            </Pressable>
          </View>
        )}

        {/* Text mode: loading */}
        {activeIntent?.mode === "text" && loading && (
          <View className="items-center py-10 mb-6">
            <ActivityIndicator size="large" color="#6366f1" />
            <Text className="text-sm font-black text-slate-700 mt-4">Analyzing...</Text>
          </View>
        )}

        {activeIntent?.mode === "text" && !loading && !draft ? (
          <View className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {t("quickType")}
            </Text>
            <TextInput
              value={raw}
              onChangeText={setRaw}
              placeholder="Grab 85k, Highlands 45k, an pho 50k..."
              placeholderTextColor="#94a3b8"
              autoFocus
              multiline
              returnKeyType="send"
              onSubmitEditing={onExtract}
              className="text-sm font-semibold text-slate-800 min-h-[120px] text-left"
              textAlignVertical="top"
            />
            <Pressable
              onPress={onExtract}
              disabled={!raw.trim() || loading}
              className="mt-4 w-full flex-row items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-4 shadow-md active:scale-95 disabled:opacity-40"
            >
              <Ionicons name="sparkles" size={18} color="white" />
              <Text className="text-white font-extrabold text-sm">Extract & Preview</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Voice transcript preview */}
        {lastVoiceText ? (
          <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voice transcript</Text>
            <Text className="text-xs text-slate-600 font-semibold mt-1">"{lastVoiceText}"</Text>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View className="flex-row items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4">
            <Ionicons name="alert-circle" size={20} color="#e11d48" />
            <Text className="text-xs text-rose-600 font-bold flex-1">{error}</Text>
          </View>
        ) : null}

        {/* Draft confirm â€” shared across all focused modes */}
        {draft ? (
          <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg mb-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-sm font-extrabold text-slate-800">Confirm expense</Text>
              <View className="bg-emerald-50 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-bold text-emerald-600">Ready to save</Text>
              </View>
            </View>

            {/* Amount */}
            <View className="mb-4">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount (k)</Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
                <TextInput
                  value={String(Math.round(draft.amount / 1000))}
                  onChangeText={(v) => setDraft({ ...draft, amount: parseMoneyToVnd(v) })}
                  keyboardType="numeric"
                  className="flex-1 text-sm font-bold text-slate-800"
                />
                <Text className="text-xs text-slate-400 font-bold">k</Text>
              </View>
              <Text className="text-[10px] text-indigo-500 font-semibold mt-1 px-1">{formatMoneyVnd(draft.amount)}</Text>
            </View>

            {/* Merchant */}
            <View className="mb-4">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merchant / place</Text>
              <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
                <TextInput
                  value={draft.merchant ?? ""}
                  onChangeText={(v) => setDraft({ ...draft, merchant: v })}
                  placeholder="Highlands, Grab, Pho..."
                  placeholderTextColor="#94a3b8"
                  className="text-sm font-bold text-slate-800"
                />
              </View>
            </View>

            {renderCategoryPicker()}

            {/* Note */}
            <View className="mb-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Note</Text>
              <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
                <TextInput
                  value={draft.note ?? ""}
                  onChangeText={(v) => setDraft({ ...draft, note: v })}
                  placeholder="Lunch with colleagues..."
                  placeholderTextColor="#94a3b8"
                  className="text-sm font-bold text-slate-800"
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* Save Button */}
        <View className="mb-12">
          <Pressable
              onPress={onSave}
            disabled={(!draft && !raw.trim()) || loading || saving}
            className="w-full flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 py-4 shadow-md active:scale-95 disabled:opacity-40"
          >
            {loading || saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="checkmark-circle" size={18} color="white" />
            )}
            <Text className="text-white font-extrabold text-sm">Save expense</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // â”€â”€â”€ FULL MODE: no mode param â€” show complete Quick Add AI interface â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f8fafc]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
    <ScrollView
      className="flex-1 px-4 pt-6"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 36 }}
    >
      {/* Title */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-2xl font-black text-slate-900">Quick Add AI</Text>
        <Pressable onPress={closeScreen} className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
          <Ionicons name="close" size={18} color="#64748b" />
        </Pressable>
      </View>
      <Text className="text-xs text-slate-400 font-semibold mb-4 leading-relaxed">
        Speak, snap a receipt, or type natively. We'll automatically identify merchant, category, and total!
      </Text>

      {/* Input Action Panel */}
      <View className="gap-3 mb-3">
        {/* Voice Trigger */}
        {(() => {
          const voiceButtonClass = recorderState.isRecording
            ? "w-full flex-row items-center justify-center gap-1.5 rounded-2xl py-4 shadow-sm active:scale-95 bg-rose-500"
            : "w-full flex-row items-center justify-center gap-1.5 rounded-2xl py-4 shadow-sm active:scale-95 bg-indigo-500";
          return (
            <Pressable onPress={recorderState.isRecording ? onStopAndTranscribe : onStartRecording} disabled={voiceLoading} className={voiceButtonClass}>
              {voiceLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name={recorderState.isRecording ? "stop" : "mic-outline"} size={18} color="white" />
              )}
              <Text className="text-white font-extrabold text-xs">
                {voiceLoading ? "Transcribingâ€¦" : recorderState.isRecording ? "Stop & Transcribe" : "Record Voice"}
              </Text>
            </Pressable>
          );
        })()}

        {/* OCR Action row */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={onScanCameraAndOcr}
            disabled={ocrLoading}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3.5 shadow-sm active:scale-95"
          >
            {ocrLoading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="camera-outline" size={18} color="white" />}
            <Text className="text-white font-extrabold text-xs">{ocrLoading ? "Scanningâ€¦" : "Camera Scan"}</Text>
          </Pressable>

          <Pressable
            onPress={onPickReceiptAndOcr}
            disabled={ocrLoading}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-violet-600 py-3.5 shadow-sm active:scale-95"
          >
            {ocrLoading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="image-outline" size={18} color="white" />}
            <Text className="text-white font-extrabold text-xs">{ocrLoading ? "Analyzingâ€¦" : "Upload Receipt"}</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-3 mb-4">
        {recorderState.isRecording && (
          <Pressable
            onPress={onCancelRecording}
            className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 active:scale-95"
          >
            <Ionicons name="trash-outline" size={14} color="#f43f5e" />
            <Text className="text-rose-600 font-bold text-xs">Cancel Recording</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onOcrTestImage}
          disabled={ocrLoading}
          className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm active:scale-95"
        >
          <Ionicons name="flask-outline" size={14} color="#64748b" />
          <Text className="text-slate-500 font-bold text-xs">Use Demo Receipt</Text>
        </Pressable>
      </View>

      {/* Manual text input */}
      <View className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm mb-4">
        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Natural Text Description</Text>
        <TextInput
          value={raw}
          onChangeText={setRaw}
          placeholder="Grab 85k, Highlands cf 45k, LÆ°Æ¡ng 15M..."
          placeholderTextColor="#94a3b8"
          multiline
          className="text-sm font-semibold text-slate-800 outline-none min-h-[90px] text-left"
        />
      </View>

      {/* Error */}
      {error ? (
        <View className="flex-row items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4">
          <Ionicons name="alert-circle" size={20} color="#e11d48" />
          <Text className="text-xs text-rose-600 font-bold flex-1">{error}</Text>
        </View>
      ) : null}

      {/* Voice transcript */}
      {lastVoiceText ? (
        <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voice Transcript</Text>
          <Text className="text-xs text-slate-600 font-semibold mt-1">"{lastVoiceText}"</Text>
        </View>
      ) : null}

      {/* Draft confirm */}
      {draft ? (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg mb-12">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-sm font-extrabold text-slate-800">Confirm Extract</Text>
            <View className="bg-emerald-50 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-emerald-600">Ready</Text>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Expense Amount (k)</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={String(Math.round(draft.amount / 1000))}
                onChangeText={(v) => setDraft({ ...draft, amount: parseMoneyToVnd(v) })}
                keyboardType="numeric"
                className="flex-1 text-sm font-bold text-slate-800"
              />
              <Text className="text-xs text-slate-400 font-bold">k</Text>
            </View>
            <Text className="text-[10px] text-indigo-500 font-semibold mt-1 px-1">{formatMoneyVnd(draft.amount)}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merchant / Store Name</Text>
            <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={draft.merchant ?? ""}
                onChangeText={(v) => setDraft({ ...draft, merchant: v })}
                placeholder="Highlands, Grab, Phá»Ÿ..."
                placeholderTextColor="#94a3b8"
                className="text-sm font-bold text-slate-800"
              />
            </View>
          </View>

          {renderCategoryPicker()}

          <View className="mb-5">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Note / Extra details</Text>
            <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={draft.note ?? ""}
                onChangeText={(v) => setDraft({ ...draft, note: v })}
                placeholder="Buy lunch with colleagues..."
                placeholderTextColor="#94a3b8"
                className="text-sm font-bold text-slate-800"
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* Main Save Action */}
      <View className="mb-12">
        <Pressable
          onPress={draft ? onSave : onExtract}
          disabled={(!draft && !raw.trim()) || loading || saving}
          className="w-full flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 py-4 shadow-md active:scale-95 disabled:opacity-40"
        >
          {loading || saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name={draft ? "checkmark-circle" : "sparkles"} size={18} color="white" />
          )}
          <Text className="text-white font-extrabold text-sm">{draft ? "Save Log" : "Extract & Preview"}</Text>
        </Pressable>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
