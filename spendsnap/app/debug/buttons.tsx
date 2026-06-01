import { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { buttonDebugger, type ButtonTestResult } from "../../services/buttonDebug";

export default function ButtonDebugScreen() {
  const [results, setResults] = useState<ButtonTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Test Voice Button
  const testVoiceButton = useCallback(async () => {
    setLoading(true);
    try {
      const result = await buttonDebugger.testVoiceButton(
        async () => {
          const perm = await requestRecordingPermissionsAsync();
          if (!perm.granted) throw new Error("Microphone permission denied");

          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
          });

          await audioRecorder.prepareToRecordAsync();
          audioRecorder.record();
        },
        async () => {
          await audioRecorder.stop();
        }
      );

      setResults((prev) => [...prev, result]);
      buttonDebugger.recordTest(result);
    } catch (error) {
      Alert.alert("Voice Test Error", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [audioRecorder, recorderState]);

  // Test Camera Button
  const testCameraButton = useCallback(async () => {
    setLoading(true);
    try {
      const result = await buttonDebugger.testCameraButton(async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) throw new Error("Camera permission denied");

        const picked = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        });

        if (picked.canceled) throw new Error("Photo capture canceled");
      });

      setResults((prev) => [...prev, result]);
      buttonDebugger.recordTest(result);
    } catch (error) {
      Alert.alert("Camera Test Error", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Test Quick Type Button
  const testQuickTypeButton = useCallback(async () => {
    setLoading(true);
    try {
      const result = await buttonDebugger.testTextInputButton(
        () => {}, // setText is already handled
        async () => {
          // Simulate text submission
          await new Promise((resolve) => setTimeout(resolve, 500));
        },
        "Phở 50k, Grab 85k"
      );

      setResults((prev) => [...prev, result]);
      buttonDebugger.recordTest(result);
    } catch (error) {
      Alert.alert("Quick Type Test Error", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Test Navigation Button
  const testNavigationButton = useCallback(
    (screenName: string, route: string) => async () => {
      setLoading(true);
      try {
        const result = await buttonDebugger.testNavigationButton(
          screenName,
          async () => {
            router.push(route as any);
            await new Promise((resolve) => setTimeout(resolve, 500));
          },
          route
        );

        setResults((prev) => [...prev, result]);
        buttonDebugger.recordTest(result);
      } catch (error) {
        Alert.alert(
          "Navigation Test Error",
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Test Tab Navigation
  const testTabNavigation = useCallback(async () => {
    setLoading(true);
    try {
      const tabResults = await buttonDebugger.testTabNavigation([
        {
          name: "Home",
          switchTo: () => router.push("/(tabs)"),
        },
        {
          name: "History",
          switchTo: () => router.push("/(tabs)/history"),
        },
        {
          name: "Analytics",
          switchTo: () => router.push("/(tabs)/analytics"),
        },
        {
          name: "Settings",
          switchTo: () => router.push("/(tabs)/settings"),
        },
      ]);

      setResults((prev) => [...prev, ...tabResults]);
      tabResults.forEach((result: ButtonTestResult) => buttonDebugger.recordTest(result));
    } catch (error) {
      Alert.alert("Tab Test Error", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear Results
  const clearResults = useCallback(() => {
    setResults([]);
    setSelectedTest(null);
  }, []);

  // Export Report
  const exportReport = useCallback(() => {
    const report = buttonDebugger.exportReport();
    const reportText = JSON.stringify(report, null, 2);
    
    Alert.alert(
      "Report Generated",
      `Tests: ${report.totalTests}\nPassed: ${report.passed}\nFailed: ${report.failed}\nPending: ${report.pending}`,
      [
        {
          text: "View Logs",
          onPress: () => {
            Alert.alert("Debug Logs", report.logs.join("\n").slice(-500));
          },
        },
        { text: "Close" },
      ]
    );

    console.log("Button Debug Report:", report);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "#10b981";
      case "fail":
        return "#ef4444";
      case "pending":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return "checkmark-circle";
      case "fail":
        return "close-circle";
      case "pending":
        return "time";
      default:
        return "help-circle";
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#f8fafc] px-4 pt-6" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-black text-slate-900">🧪 Button Debugger</Text>
          <Pressable
            onPress={() => router.back()}
            className="w-8 h-8 rounded-full bg-white border border-slate-100 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#64748b" />
          </Pressable>
        </View>
        <Text className="text-xs text-slate-400 font-semibold">
          Test all interactive buttons and view results in real-time
        </Text>
      </View>

      {/* Test Buttons */}
      <View className="gap-3 mb-6">
        <Text className="text-sm font-black text-slate-700 px-2">Quick Tests</Text>

        <Pressable
          onPress={testVoiceButton}
          disabled={loading}
          className="flex-row items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 active:scale-95"
        >
          {loading && selectedTest === "voice" ? (
            <ActivityIndicator color="#6366f1" />
          ) : (
            <Ionicons name="mic" size={20} color="#6366f1" />
          )}
          <Text className="text-sm font-bold text-slate-800 flex-1">Test AI Voice Button</Text>
          <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
        </Pressable>

        <Pressable
          onPress={testCameraButton}
          disabled={loading}
          className="flex-row items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 active:scale-95"
        >
          {loading && selectedTest === "camera" ? (
            <ActivityIndicator color="#059669" />
          ) : (
            <Ionicons name="camera" size={20} color="#059669" />
          )}
          <Text className="text-sm font-bold text-slate-800 flex-1">Test Scan Bill Button</Text>
          <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
        </Pressable>

        <Pressable
          onPress={testQuickTypeButton}
          disabled={loading}
          className="flex-row items-center gap-2 bg-purple-50 border border-purple-100 rounded-2xl p-4 active:scale-95"
        >
          {loading && selectedTest === "text" ? (
            <ActivityIndicator color="#7c3aed" />
          ) : (
            <Ionicons name="create" size={20} color="#7c3aed" />
          )}
          <Text className="text-sm font-bold text-slate-800 flex-1">Test Quick Type Button</Text>
          <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
        </Pressable>

        <Pressable
          onPress={testTabNavigation}
          disabled={loading}
          className="flex-row items-center gap-2 bg-orange-50 border border-orange-100 rounded-2xl p-4 active:scale-95"
        >
          {loading && selectedTest === "tabs" ? (
            <ActivityIndicator color="#ea580c" />
          ) : (
            <Ionicons name="swap-horizontal" size={20} color="#ea580c" />
          )}
          <Text className="text-sm font-bold text-slate-800 flex-1">Test Tab Navigation</Text>
          <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
        </Pressable>

        <Pressable
          onPress={testNavigationButton("Settings Button", "/(tabs)/settings")}
          disabled={loading}
          className="flex-row items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-4 active:scale-95"
        >
          {loading && selectedTest === "settings" ? (
            <ActivityIndicator color="#e11d48" />
          ) : (
            <Ionicons name="settings" size={20} color="#e11d48" />
          )}
          <Text className="text-sm font-bold text-slate-800 flex-1">Test Settings Button</Text>
          <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      {/* Results Summary */}
      {results.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3 px-2">
            <Text className="text-sm font-black text-slate-700">Test Results</Text>
            <Text className="text-xs text-slate-400 font-bold">
              {results.filter((r) => r.status === "pass").length}/{results.length} passed
            </Text>
          </View>

          {results.map((result, idx) => (
            <Pressable
              key={`${result.buttonName}-${idx}`}
              onPress={() =>
                setSelectedTest(
                  selectedTest === `${result.buttonName}-${idx}` ? null : `${result.buttonName}-${idx}`
                )
              }
              className="mb-2 bg-white border border-slate-100 rounded-2xl p-4 active:scale-95"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons
                  name={getStatusIcon(result.status) as any}
                  size={20}
                  color={getStatusColor(result.status)}
                />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-800">{result.buttonName}</Text>
                  {result.error && (
                    <Text className="text-xs text-rose-600 mt-0.5">{result.error}</Text>
                  )}
                  {result.details && (
                    <Text className="text-[10px] text-slate-400 mt-0.5">
                      {Object.entries(result.details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" • ")}
                    </Text>
                  )}
                </View>
                <View className="px-2 py-1 rounded-full" style={{ backgroundColor: getStatusColor(result.status) + "22" }}>
                  <Text
                    className="text-[10px] font-black uppercase"
                    style={{ color: getStatusColor(result.status) }}
                  >
                    {result.status}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2 mb-12">
        <Pressable
          onPress={exportReport}
          disabled={results.length === 0 || loading}
          className="flex-1 flex-row items-center justify-center gap-1.5 bg-slate-100 border border-slate-200 rounded-2xl py-3 active:scale-95 disabled:opacity-40"
        >
          <Ionicons name="download" size={16} color="#64748b" />
          <Text className="font-bold text-sm text-slate-600">Export Report</Text>
        </Pressable>

        <Pressable
          onPress={clearResults}
          disabled={results.length === 0 || loading}
          className="flex-1 flex-row items-center justify-center gap-1.5 bg-rose-50 border border-rose-100 rounded-2xl py-3 active:scale-95 disabled:opacity-40"
        >
          <Ionicons name="trash" size={16} color="#e11d48" />
          <Text className="font-bold text-sm text-rose-600">Clear</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
