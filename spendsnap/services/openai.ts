import Constants from "expo-constants";

export function getOpenAiKey(): string | null {
  const fromExtra = (Constants.expoConfig as any)?.extra?.openaiApiKey as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  return fromEnv ?? fromExtra ?? null;
}

export function requireOpenAiKey(): string {
  const key = getOpenAiKey();
  if (!key) {
    throw new Error("Missing OpenAI API key. Set EXPO_PUBLIC_OPENAI_API_KEY in .env");
  }
  return key;
}

