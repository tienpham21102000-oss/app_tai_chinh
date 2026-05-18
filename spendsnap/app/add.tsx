import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import { Ionicons } from "@expo/vector-icons";

import { extractTransactionFromText } from "../services/ai";
import { extractTransactionFromReceiptImage } from "../services/ocr";
import { transcribeAudio, transcribeAudioWeb } from "../services/stt";
import { useTransactionsStore } from "../stores/transactions";
import { formatMoneyVnd, parseMoneyToVnd } from "../utils/money";

export default function AddModal() {
  const add = useTransactionsStore((s) => s.addFromDraft);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<BlobPart[]>([]);
  const webMimeTypeRef = useRef<string>("audio/webm");
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);

  const canSave = useMemo(() => !!draft && draft.amount > 0, [draft]);

  async function onExtract() {
    setLoading(true);
    setError(null);
    try {
      const result = await extractTransactionFromText(raw);
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

  async function onStartRecording() {
    setError(null);
    try {
      if (Platform.OS === "web") {
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
        setIsRecording(true);
        return;
      }

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error("Microphone permission denied.");

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start recording.");
      setIsRecording(false);
      recordingRef.current = null;
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
        setIsRecording(false);
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

    const recording = recordingRef.current;
    if (!recording) return;

    setVoiceLoading(true);
    setError(null);
    try {
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      const uri = recording.getURI();
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
      recordingRef.current = null;
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
    setIsRecording(false);
    if (Platform.OS === "web") {
      try {
        webRecorderRef.current?.stop();
      } catch {}
      webRecorderRef.current = null;
      webChunksRef.current = [];
      return;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      void rec.stopAndUnloadAsync().catch(() => {});
    }
  }

  async function onSave() {
    if (!draft) return;
    await add({
      amount: draft.amount,
      merchant: draft.merchant ?? undefined,
      category: draft.category ?? undefined,
      date: draft.date ?? undefined,
      note: draft.note ?? undefined,
      raw_text: raw,
    });
    router.back();
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-6" showsVerticalScrollIndicator={false}>
      {/* Title */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-2xl font-black text-slate-900">Quick Add AI</Text>
        <Pressable onPress={() => router.back()} className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
          <Ionicons name="close" size={18} color="#64748b" />
        </Pressable>
      </View>
      <Text className="text-xs text-slate-400 font-semibold mb-4 leading-relaxed">
        Speak, snap a receipt, or type natively. We'll automatically identify merchant, category, and total!
      </Text>

      {/* Input Action Panel */}
      <View className="gap-3 mb-3">
        {/* Voice Trigger - Full width */}
        {(() => {
          const voiceButtonClass = isRecording
            ? "w-full flex-row items-center justify-center gap-1.5 rounded-2xl py-4 shadow-sm active:scale-95 bg-rose-500"
            : "w-full flex-row items-center justify-center gap-1.5 rounded-2xl py-4 shadow-sm active:scale-95 bg-indigo-500";
          return (
            <Pressable
              onPress={isRecording ? onStopAndTranscribe : onStartRecording}
              disabled={voiceLoading}
              className={voiceButtonClass}
            >
          {voiceLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name={isRecording ? "stop" : "mic-outline"} size={18} color="white" />
          )}
          <Text className="text-white font-extrabold text-xs">
            {voiceLoading ? "Transcribing…" : isRecording ? "Stop & Transcribe" : "Record Voice"}
          </Text>
            </Pressable>
          );
        })()}

        {/* OCR Action row (Camera vs Pick Image) */}
        <View className="flex-row gap-3">
          {/* Camera OCR Trigger */}
          <Pressable
            onPress={onScanCameraAndOcr}
            disabled={ocrLoading}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3.5 shadow-sm active:scale-95"
          >
            {ocrLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="camera-outline" size={18} color="white" />
            )}
            <Text className="text-white font-extrabold text-xs">
              {ocrLoading ? "Scanning…" : "Camera Scan"}
            </Text>
          </Pressable>

          {/* Gallery Pick OCR Trigger */}
          <Pressable
            onPress={onPickReceiptAndOcr}
            disabled={ocrLoading}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-violet-600 py-3.5 shadow-sm active:scale-95"
          >
            {ocrLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="image-outline" size={18} color="white" />
            )}
            <Text className="text-white font-extrabold text-xs">
              {ocrLoading ? "Analyzing…" : "Upload Receipt"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-3 mb-4">
        {/* Cancel Recording */}
        {isRecording && (
          <Pressable
            onPress={onCancelRecording}
            className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 active:scale-95"
          >
            <Ionicons name="trash-outline" size={14} color="#f43f5e" />
            <Text className="text-rose-600 font-bold text-xs">Cancel Recording</Text>
          </Pressable>
        )}

        {/* Test Image Trigger */}
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
          placeholder="Grab 85k, Highlands cf 45k, Lương 15M..."
          placeholderTextColor="#94a3b8"
          multiline
          className="text-sm font-semibold text-slate-800 outline-none min-h-[90px] text-left"
        />
        
        <Pressable
          onPress={onExtract}
          disabled={!raw.trim() || loading}
          className="mt-3 flex-row items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-3 shadow-md active:scale-95 disabled:opacity-40"
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="sparkles" size={16} color="white" />
          )}
          <Text className="text-white font-extrabold text-xs">
            {loading ? "Extracting..." : "Process with AI"}
          </Text>
        </Pressable>
      </View>

      {/* Error Feedback */}
      {error ? (
        <View className="flex-row items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4">
          <Ionicons name="alert-circle" size={20} color="#e11d48" />
          <Text className="text-xs text-rose-600 font-bold flex-1">{error}</Text>
        </View>
      ) : null}

      {/* Last voice transcribed raw output */}
      {lastVoiceText ? (
        <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voice Transcript</Text>
          <Text className="text-xs text-slate-600 font-semibold mt-1">"{lastVoiceText}"</Text>
        </View>
      ) : null}

      {/* Confirmation Draft Sheet */}
      {draft ? (
        <View className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg mb-12">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-sm font-extrabold text-slate-800">Confirm Extract</Text>
            <View className="bg-emerald-50 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-emerald-600">Ready</Text>
            </View>
          </View>

          {/* Amount input */}
          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Expense Amount</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={String(draft.amount)}
                onChangeText={(v) => setDraft({ ...draft, amount: parseMoneyToVnd(v) })}
                keyboardType="numeric"
                className="flex-1 text-sm font-bold text-slate-800"
              />
              <Text className="text-xs text-slate-400 font-bold">VND</Text>
            </View>
            <Text className="text-[10px] text-indigo-500 font-semibold mt-1 px-1">{formatMoneyVnd(draft.amount)}</Text>
          </View>

          {/* Merchant */}
          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merchant / Store Name</Text>
            <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={draft.merchant ?? ""}
                onChangeText={(v) => setDraft({ ...draft, merchant: v })}
                placeholder="Highlands, Grab, Phở..."
                placeholderTextColor="#94a3b8"
                className="text-sm font-bold text-slate-800"
              />
            </View>
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category / Label</Text>
            <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
              <TextInput
                value={draft.category ?? ""}
                onChangeText={(v) => setDraft({ ...draft, category: v })}
                placeholder="Food, Coffee, Transport..."
                placeholderTextColor="#94a3b8"
                className="text-sm font-bold text-slate-800"
              />
            </View>
          </View>

          {/* Note */}
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

          {/* Save Action */}
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            className="w-full flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 py-4 shadow-md active:scale-95 disabled:opacity-40"
          >
            <Ionicons name="checkmark-circle" size={18} color="white" />
            <Text className="text-white font-extrabold text-sm">Save Log</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
