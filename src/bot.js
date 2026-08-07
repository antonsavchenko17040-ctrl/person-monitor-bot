import { config } from "./config.js";
import { handleUpdate } from "./commands.js";
import { telegramCall } from "./telegram.js";
import { sleep } from "./utils.js";

async function main() {
  const settings = config();
  console.log(`Локальний Person Monitor Bot запущено.`);
  console.log(`Дані: ${settings.dataFile}`);
  console.log("\u041f\u043e\u0448\u0443\u043a \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0454\u0442\u044c\u0441\u044f \u0432\u0440\u0443\u0447\u043d\u0443 \u0447\u0435\u0440\u0435\u0437 \u043c\u0435\u043d\u044e Telegram \u0430\u0431\u043e \u043a\u043e\u043c\u0430\u043d\u0434\u0438 /check \u0456 /checkall.");

  // Якщо раніше був налаштований webhook, long polling не працюватиме, тому вимикаємо його.
  await telegramCall("deleteWebhook", { drop_pending_updates: false });
  const me = await telegramCall("getMe");
  console.log(`Telegram: @${me.username}`);

  let offset = 0;
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });

  while (!stopping) {
    try {
      const updates = await telegramCall("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message"],
      });
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}]`, error.message);
      await sleep(3000);
    }
  }

  console.log("Бота зупинено.");
}

main().catch((error) => {
  console.error("Критична помилка:", error.message);
  process.exitCode = 1;
});
