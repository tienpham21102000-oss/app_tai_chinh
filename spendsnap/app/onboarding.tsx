import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Onboarding() {
  return (
    <View className="flex-1 bg-slate-950 items-center justify-center px-6 relative overflow-hidden">
      {/* Dynamic Glow Graphics */}
      <View className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl" />
      <View className="absolute -left-20 -bottom-20 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl" />

      {/* App Logo Indicator */}
      <View className="w-20 h-20 bg-indigo-500 rounded-3xl items-center justify-center shadow-2xl shadow-indigo-500/50 mb-6">
        <Ionicons name="wallet" size={42} color="white" />
      </View>

      {/* Brand Title */}
      <Text className="text-4xl font-black text-white tracking-tight">SpendSnap</Text>
      <Text className="text-sm font-semibold text-slate-400 mt-2 text-center max-w-[280px]">
        Track expenses in under 5 seconds using advanced AI.
      </Text>

      {/* Feature Bullet Cards */}
      <View className="w-full gap-4 mt-10 mb-10">
        {/* Feature 1 */}
        <View className="flex-row items-center gap-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
          <View className="w-10 h-10 rounded-xl bg-indigo-500/10 items-center justify-center">
            <Ionicons name="mic-outline" size={20} color="#818cf8" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-white">Smart Voice Input</Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">Simply say what you spent. We'll extract details.</Text>
          </View>
        </View>

        {/* Feature 2 */}
        <View className="flex-row items-center gap-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
          <View className="w-10 h-10 rounded-xl bg-violet-500/10 items-center justify-center">
            <Ionicons name="camera-outline" size={20} color="#a78bfa" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-white">Secure Receipt OCR</Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">Snap and extract invoices with total PII privacy protection.</Text>
          </View>
        </View>

        {/* Feature 3 */}
        <View className="flex-row items-center gap-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
          <View className="w-10 h-10 rounded-xl bg-emerald-500/10 items-center justify-center">
            <Ionicons name="pie-chart-outline" size={20} color="#34d399" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-white">Advanced Analytics</Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">View Category breakdown ratios and budget limits.</Text>
          </View>
        </View>
      </View>

      {/* Launch Trigger */}
      <Pressable
        onPress={() => router.replace("/")}
        className="w-full flex-row items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-4 shadow-xl active:scale-95"
      >
        <Text className="text-white font-extrabold text-sm">Get Started</Text>
        <Ionicons name="arrow-forward" size={16} color="white" />
      </Pressable>
    </View>
  );
}

