import { ExpoRoot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import "./global.css";
import { ensureDbReady } from "./services/db";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    void ensureDbReady();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <ExpoRoot />
    </QueryClientProvider>
  );
}
