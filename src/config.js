import path from "node:path";

function numberEnv(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} має бути цілим числом від ${min} до ${max}`);
  }
  return value;
}

export function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Не заповнено TELEGRAM_BOT_TOKEN у файлі .env");

  return {
    telegramToken: token,
    allowedChatIds: new Set(
      (process.env.ALLOWED_TELEGRAM_CHAT_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
    dataFile: path.resolve(process.env.DATA_FILE?.trim() || "./data/data.json"),
    courtIndexFile: path.resolve("./data/court-open-data/index.json"),
    lookbackDays: numberEnv("MONITOR_LOOKBACK_DAYS", 7, 1, 30),
    maxResultsPerProvider: numberEnv("MONITOR_MAX_RESULTS_PER_PROVIDER", 30, 5, 100),
    defaultMatchThreshold: numberEnv("DEFAULT_MATCH_THRESHOLD", 75, 50, 95),
    serpApiKey: process.env.SERPAPI_API_KEY?.trim() || null,
    serperApiKey: process.env.SERPER_API_KEY?.trim() || null,
  };
}

export function isChatAllowed(chatId, settings = config()) {
  return settings.allowedChatIds.size === 0 || settings.allowedChatIds.has(String(chatId));
}
