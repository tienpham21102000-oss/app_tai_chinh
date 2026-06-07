import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useAuthStore } from "../stores/auth";

type Mode = "sign-in" | "sign-up";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loading = useAuthStore((s) => s.loading);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const googleAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === "1";

  const copy = useMemo(
    () => ({
      title: "Sign in to SpendSnap",
      subtitle: "Sync expenses, protect your data, and use AI securely with your account.",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      signUp: "Create account",
      google: "Continue with Google",
      switchToSignUp: "No account yet? Create one",
      switchToSignIn: "Already have an account? Sign in",
      hint: "Minimum 6 characters. If Supabase email confirmation is enabled, check your inbox after signing up.",
      invalid: "Enter a valid email and a password with at least 6 characters.",
      done: "Done",
      signupDone: "Account created. Confirm your email if Supabase requires it.",
    }),
    []
  );

  const canSubmit = email.includes("@") && password.length >= 6 && !loading;

  async function submit() {
    if (!canSubmit) {
      Alert.alert(copy.invalid);
      return;
    }

    try {
      if (mode === "sign-in") {
        await signInWithEmail(email, password);
        router.replace("/");
      } else {
        await signUpWithEmail(email, password);
        Alert.alert(copy.done, copy.signupDone);
        router.replace("/");
      }
    } catch (e) {
      Alert.alert(mode === "sign-in" ? copy.signIn : copy.signUp, e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function google() {
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e) {
      Alert.alert(copy.google, e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-[#f8fafc]" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
        <View className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
          <View className="w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center mb-5">
            <Ionicons name="wallet-outline" size={28} color="white" />
          </View>

          <Text className="text-2xl font-black text-slate-900">{copy.title}</Text>
          <Text className="text-sm text-slate-500 leading-5 mt-2 mb-6">{copy.subtitle}</Text>

          <Text className="text-[10px] font-black text-slate-400 uppercase mb-1">{copy.email}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 mb-4"
          />

          <Text className="text-[10px] font-black text-slate-400 uppercase mb-1">{copy.password}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="********"
            placeholderTextColor="#94a3b8"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
          />
          <Text className="text-[10px] text-slate-400 font-semibold mt-2 mb-5">{copy.hint}</Text>

          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit}
            className="rounded-2xl bg-indigo-600 py-4 items-center active:opacity-75 disabled:opacity-40"
          >
            <Text className="text-sm font-black text-white">{mode === "sign-in" ? copy.signIn : copy.signUp}</Text>
          </Pressable>

          {googleAuthEnabled ? (
            <Pressable
              onPress={() => void google()}
              disabled={loading}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 active:opacity-75 disabled:opacity-40"
            >
              <Ionicons name="logo-google" size={17} color="white" />
              <Text className="text-sm font-black text-white">{copy.google}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}
            className="mt-5 items-center py-2"
          >
            <Text className="text-xs font-black text-indigo-600">
              {mode === "sign-in" ? copy.switchToSignUp : copy.switchToSignIn}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
