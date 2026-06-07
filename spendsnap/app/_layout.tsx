import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import "../global.css";
import { ensureDbReady, getSetting } from "../services/db";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";

const queryClient = new QueryClient();
const ONBOARDING_COMPLETE_PREFIX = "onboarding_complete_";

export default function RootLayout() {
  const loadLanguage = usePreferencesStore((s) => s.loadLanguage);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const pathname = usePathname();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    void ensureDbReady();
    void loadLanguage();
    void initializeAuth();
  }, [initializeAuth, loadLanguage]);

  useEffect(() => {
    if (!initialized) return;
    let active = true;
    if (!session?.user?.id) {
      setNeedsOnboarding(false);
      setOnboardingChecked(true);
      return;
    }

    setOnboardingChecked(false);
    (async () => {
      try {
        await ensureDbReady();
        const done = await getSetting(`${ONBOARDING_COMPLETE_PREFIX}${session.user.id}`);
        if (!active) return;
        setNeedsOnboarding(done !== "1");
      } catch {
        if (!active) return;
        setNeedsOnboarding(true);
      } finally {
        if (active) setOnboardingChecked(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [initialized, session?.user?.id]);

  useEffect(() => {
    if (!initialized) return;
    const onAuthScreen = pathname === "/auth";
    const onOnboardingScreen = pathname === "/onboarding";
    if (!session && !onAuthScreen) {
      router.replace("/auth");
    } else if (session && onboardingChecked && needsOnboarding && !onOnboardingScreen) {
      void (async () => {
        const done = await getSetting(`${ONBOARDING_COMPLETE_PREFIX}${session.user.id}`).catch(() => null);
        if (done === "1") {
          setNeedsOnboarding(false);
          return;
        }
        router.replace("/onboarding");
      })();
    } else if (session && onboardingChecked && !needsOnboarding && (onAuthScreen || onOnboardingScreen)) {
      router.replace("/");
    }
  }, [initialized, needsOnboarding, onboardingChecked, pathname, session]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: "modal", title: "Add" }} />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: "modal", title: "Transaction" }}
        />
        <Stack.Screen
          name="categories"
          options={{ presentation: "modal", title: "Categories" }}
        />
        <Stack.Screen
          name="budget"
          options={{ presentation: "modal", title: "Monthly Budget" }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ presentation: "modal", headerShown: false }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
