export type SmsExtraction = {
  amount: number;
  merchant?: string;
  date?: string;
  raw: string;
};

export function extractFromSms(raw: string): SmsExtraction | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  return { amount: 0, raw: cleaned };
}

