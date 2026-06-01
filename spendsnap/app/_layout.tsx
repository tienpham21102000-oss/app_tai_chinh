import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import "../global.css";
import { ensureDbReady } from "../services/db";
import { usePreferencesStore } from "../stores/preferences";

const queryClient = new QueryClient();

export default function RootLayout() {
  const loadLanguage = usePreferencesStore((s) => s.loadLanguage);

  useEffect(() => {
    void ensureDbReady();
    void loadLanguage();
  }, [loadLanguage]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
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
