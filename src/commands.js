import { isChatAllowed } from "./config.js";
import { monitorSubject } from "./monitor.js";
import { buildReports } from "./reports.js";
import {
  addAlias,
  addExcludedTerm,
  createSubject,
  deleteSubject,
  getSubject,
  listMentions,
  listSubjects,
  updateSubject,
  upsertUser,
} from "./store.js";
import { sendTelegramDocument, sendTelegramMessage } from "./telegram.js";
import { htmlEscape } from "./utils.js";

const HELP = `
<b>\u{1F50E} \u0411\u043e\u0442 \u043c\u043e\u043d\u0456\u0442\u043e\u0440\u0438\u043d\u0433\u0443 \u043f\u0443\u0431\u043b\u0456\u0447\u043d\u0438\u0445 \u0437\u0433\u0430\u0434\u043e\u043a</b>

\u041e\u0441\u043d\u043e\u0432\u043d\u0430 \u0440\u043e\u0431\u043e\u0442\u0430 \u0437 \u0431\u043e\u0442\u043e\u043c \u0432\u0438\u043a\u043e\u043d\u0443\u0454\u0442\u044c\u0441\u044f \u0447\u0435\u0440\u0435\u0437 \u043a\u043d\u043e\u043f\u043a\u0438 \u043c\u0435\u043d\u044e.

\u{1F465} <b>\u0421\u0443\u0431\u2019\u0454\u043a\u0442\u0438</b>
\u041f\u0435\u0440\u0435\u0433\u043b\u044f\u0434, \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043d\u043d\u044f, \u043f\u0435\u0440\u0435\u0432\u0456\u0440\u043a\u0430, \u0444\u043e\u0440\u043c\u0443\u0432\u0430\u043d\u043d\u044f \u0437\u0432\u0456\u0442\u0443 \u0442\u0430 \u0432\u0438\u0434\u0430\u043b\u0435\u043d\u043d\u044f \u043e\u0441\u043e\u0431\u0438.

\u{1F50E} <b>\u041f\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438</b>
\u0417\u0430\u043f\u0443\u0441\u043a \u043d\u043e\u0432\u043e\u0433\u043e \u043f\u043e\u0448\u0443\u043a\u0443 \u043f\u0443\u0431\u043b\u0456\u0447\u043d\u0438\u0445 \u0437\u0433\u0430\u0434\u043e\u043a \u043f\u0440\u043e \u043e\u0431\u0440\u0430\u043d\u0443 \u043e\u0441\u043e\u0431\u0443.

\u{1F4CA} <b>\u0417\u0432\u0456\u0442\u0438</b>
\u0424\u043e\u0440\u043c\u0443\u0432\u0430\u043d\u043d\u044f Excel \u0442\u0430 PDF \u0437 \u0443\u0436\u0435 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u0438\u0445 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0456\u0432 \u0431\u0435\u0437 \u043d\u043e\u0432\u043e\u0433\u043e \u043f\u043e\u0448\u0443\u043a\u0443.

\u2795 <b>\u0414\u043e\u0434\u0430\u0442\u0438 \u043e\u0441\u043e\u0431\u0443</b>
\u041f\u043e\u043a\u0440\u043e\u043a\u043e\u0432\u0435 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f \u041f\u0406\u0411, \u043e\u0440\u0433\u0430\u043d\u0456\u0437\u0430\u0446\u0456\u0457, \u043f\u043e\u0441\u0430\u0434\u0438, \u043c\u0456\u0441\u0442\u0430 \u0442\u0430 \u0430\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0438\u0445 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u044c.

\u2699\ufe0f <b>\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f</b>
\u2022 \u0430\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0456 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f;
\u2022 \u0441\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f;
\u2022 \u043f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443;
\u2022 \u0441\u0442\u0430\u0442\u0443\u0441 \u0434\u0436\u0435\u0440\u0435\u043b \u043f\u043e\u0448\u0443\u043a\u0443.

<b>\u0412\u0430\u0436\u043b\u0438\u0432\u043e:</b>
\u0411\u043e\u0442 \u043d\u0435 \u0432\u0438\u043a\u043e\u043d\u0443\u0454 \u043f\u043e\u0448\u0443\u043a \u0443 \u0444\u043e\u043d\u043e\u0432\u043e\u043c\u0443 \u0440\u0435\u0436\u0438\u043c\u0456. \u041f\u0435\u0440\u0435\u0432\u0456\u0440\u043a\u0430 \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0454\u0442\u044c\u0441\u044f \u0432\u0440\u0443\u0447\u043d\u0443, \u043a\u043e\u043b\u0438 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u0430 \u043f\u0440\u0430\u0446\u044e\u0454 \u043d\u0430 \u043a\u043e\u043c\u043f\u2019\u044e\u0442\u0435\u0440\u0456.

\u0414\u043b\u044f \u0434\u043e\u0441\u0432\u0456\u0434\u0447\u0435\u043d\u043e\u0433\u043e \u0432\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043d\u043d\u044f \u0442\u0430\u043a\u043e\u0436 \u0437\u0430\u043b\u0438\u0448\u0430\u044e\u0442\u044c\u0441\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u043c\u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u0438 /check, /checkall, /add, /list, /alias, /exclude, /delete \u0442\u0430 /help.
`.trim();

const MAIN_MENU = {
  keyboard: [
    [{ text: "👥 Суб’єкти" }, { text: "🔎 Перевірити" }],
    [{ text: "📊 Звіти" }, { text: "➕ Додати особу" }],
    [{ text: "⚙️ Налаштування" }, { text: "ℹ️ Допомога" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const ADD_SUBJECT_STATES = new Map();
const EDIT_SUBJECT_STATES = new Map();
const EXCLUDED_TERM_STATES = new Map();
const ALIAS_STATES = new Map();
const MATCH_THRESHOLD_STATES = new Map();

export async function handleUpdate(update) {
  const message = update.message;
  if (!message?.text) return;
  const chatId = String(message.chat.id);

  if (!isChatAllowed(chatId)) {
    await sendTelegramMessage(chatId, "⛔ Доступ до цього бота обмежено.");
    return;
  }

  await upsertUser({
    chatId,
    username: message.from?.username,
    firstName: message.from?.first_name,
  });

  try {
    await handleCommand(chatId, message.text.trim());
  } catch (error) {
    console.error(error);
    await sendTelegramMessage(chatId, `❌ Помилка: ${htmlEscape(error instanceof Error ? error.message : "невідома помилка")}`);
  }
}

async function handleCommand(chatId, text) {
  const [rawCommand] = text.split(/\s+/, 1);
  const command = rawCommand.toLowerCase().replace(/@[^\s]+$/, "");
  const payload = text.slice(rawCommand.length).trim();

  if (command === "/start" || command === "/help" || text === "ℹ️ Допомога") {
    await sendTelegramMessage(chatId, HELP, { replyMarkup: MAIN_MENU });
    return;
  }

  if (text === "⬅️ Головне меню") {
    ADD_SUBJECT_STATES.delete(chatId);
    EDIT_SUBJECT_STATES.delete(chatId);
    await sendTelegramMessage(chatId, "🏠 Головне меню", { replyMarkup: MAIN_MENU });
    return;
  }

  // На момент переходу на інший ПК цей розділ був наступним запланованим кроком, але ще не реалізованим.
  if (text === "\u2699\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f") {
    await sendTelegramMessage(
      chatId,
      "\u2699\ufe0f <b>\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f</b>\n\n\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0440\u043e\u0437\u0434\u0456\u043b:",
      {
        replyMarkup: {
          keyboard: [
            [
              {
                text: "\u{1F4DD} \u0410\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0456 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u{1F6AB} \u0421\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u{1F3AF} \u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443",
              },
            ],
            [
              {
                text: "\u{1F50C} \u0414\u0436\u0435\u0440\u0435\u043b\u0430 \u043f\u043e\u0448\u0443\u043a\u0443",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (text === "\u{1F50C} \u0414\u0436\u0435\u0440\u0435\u043b\u0430 \u043f\u043e\u0448\u0443\u043a\u0443") {
    const serpApiStatus =
      process.env.SERPAPI_API_KEY
        ? "\u2705 \u043d\u0430\u043b\u0430\u0448\u0442\u043e\u0432\u0430\u043d\u043e"
        : "\u26aa \u043d\u0435 \u043d\u0430\u043b\u0430\u0448\u0442\u043e\u0432\u0430\u043d\u043e";

    const serperStatus =
      process.env.SERPER_API_KEY
        ? "\u2705 \u043d\u0430\u043b\u0430\u0448\u0442\u043e\u0432\u0430\u043d\u043e"
        : "\u26aa \u043d\u0435 \u043d\u0430\u043b\u0430\u0448\u0442\u043e\u0432\u0430\u043d\u043e";

    const googleWebEnabled = Boolean(
      process.env.SERPAPI_API_KEY ||
      process.env.SERPER_API_KEY
    );

    const webBackedStatus = googleWebEnabled
      ? "\u2705 \u0430\u043a\u0442\u0438\u0432\u043d\u043e"
      : "\u26aa \u043f\u043e\u0442\u0440\u0456\u0431\u0435\u043d SerpApi \u0430\u0431\u043e Serper";

    await sendTelegramMessage(
      chatId,
      [
        "\u{1F50C} <b>\u0414\u0436\u0435\u0440\u0435\u043b\u0430 \u043f\u043e\u0448\u0443\u043a\u0443</b>",
        "",
        "\u2705 Google News RSS",
        "",
        `🌐 Google Web: ${webBackedStatus}`,
        `SerpApi: ${serpApiStatus}`,
        `Serper.dev: ${serperStatus}`,
        "",
        "\u2705 \u0414\u0435\u043a\u043b\u0430\u0440\u0430\u0446\u0456\u0457 \u041d\u0410\u0417\u041a",
        `${webBackedStatus} — Реєстр корупціонерів НАЗК`,
        `${webBackedStatus} — Офіційні сайти`,
        `${webBackedStatus} — Prozorro`,
        "\u2705 \u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0456 \u0441\u0443\u0434\u043e\u0432\u0456 \u0434\u0430\u043d\u0456",
        `${webBackedStatus} — Судовий реєстр / web-пошук`,
        "",
        "\u2139\ufe0f YouTube \u043f\u043e\u043a\u0438 \u043d\u0435 \u043f\u0456\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0439.",
      ].join("\n"),
      {
        replyMarkup: {
          keyboard: [
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (text === "\u{1F3AF} \u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443") {
    const subjects = await listSubjects(chatId);

    if (!subjects.length) {
      await sendTelegramMessage(
        chatId,
        "\u0423 \u0432\u0430\u0441 \u0449\u0435 \u043d\u0435\u043c\u0430\u0454 \u0434\u043e\u0434\u0430\u043d\u0438\u0445 \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0456\u0432.",
        {
          replyMarkup: MAIN_MENU,
        },
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      "\u{1F3AF} <b>\u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443</b>\n\n\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0430:",
      {
        replyMarkup: {
          keyboard: [
            ...subjects.map((subject) => [
              {
                text: `\u{1F3AF} ${subject.full_name} \u2014 ${subject.match_threshold ?? 75}`,
              },
            ]),
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (
    text.startsWith("\u{1F3AF} ") &&
    text !== "\u{1F3AF} \u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443"
  ) {
    const subjects = await listSubjects(chatId);

    const subject = subjects.find(
      (item) =>
        text ===
        `\u{1F3AF} ${item.full_name} \u2014 ${item.match_threshold ?? 75}`,
    );

    if (!subject) {
      await sendTelegramMessage(
        chatId,
        "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u043d\u0430\u0439\u0442\u0438 \u0446\u044e \u043e\u0441\u043e\u0431\u0443.",
        {
          replyMarkup: MAIN_MENU,
        },
      );
      return;
    }

    MATCH_THRESHOLD_STATES.set(
      chatId,
      {
        subjectId: subject.id,
      },
    );

    await sendTelegramMessage(
      chatId,
      [
        "\u{1F3AF} <b>\u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443</b>",
        "",
        `<b>${htmlEscape(subject.full_name)}</b>`,
        `\u041f\u043e\u0442\u043e\u0447\u043d\u0438\u0439 \u043f\u043e\u0440\u0456\u0433: <b>${subject.match_threshold ?? 75}</b>`,
        "",
        "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u043d\u043e\u0432\u0435 \u0446\u0456\u043b\u0435 \u0447\u0438\u0441\u043b\u043e \u0432\u0456\u0434 50 \u0434\u043e 95.",
        "\u0427\u0438\u043c \u0432\u0438\u0449\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u043d\u044f, \u0442\u0438\u043c \u0441\u0443\u0432\u043e\u0440\u0456\u0448\u0438\u0439 \u0432\u0456\u0434\u0431\u0456\u0440.",
      ].join("\n"),
      {
        replyMarkup: {
          keyboard: [
            [
              {
                text: "\u274c \u0421\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0437\u043c\u0456\u043d\u0443 \u043f\u043e\u0440\u043e\u0433\u0443",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (text.startsWith("\u{1F4DD} \u041d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f: ")) {
    const fullName = text
      .slice("\u{1F4DD} \u041d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f: ".length)
      .trim();

    const subjects = await listSubjects(chatId);

    const subject = subjects.find(
      (item) => item.full_name === fullName,
    );

    if (!subject) {
      await sendTelegramMessage(
        chatId,
        "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u043d\u0430\u0439\u0442\u0438 \u0446\u044e \u043e\u0441\u043e\u0431\u0443.",
        {
          replyMarkup: MAIN_MENU,
        },
      );
      return;
    }

    ALIAS_STATES.set(
      chatId,
      {
        subjectId: subject.id,
      },
    );

    const currentAliases =
      Array.isArray(subject.aliases) &&
      subject.aliases.length
        ? subject.aliases
            .map((alias) => `\u2022 ${htmlEscape(alias)}`)
            .join("\n")
        : "\u041f\u043e\u043a\u0438 \u043d\u0435\u043c\u0430\u0454.";

    await sendTelegramMessage(
      chatId,
      [
        "\u{1F4DD} <b>\u0410\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0456 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f</b>",
        "",
        `<b>${htmlEscape(subject.full_name)}</b>`,
        "",
        "<b>\u041f\u043e\u0442\u043e\u0447\u043d\u0456:</b>",
        currentAliases,
        "",
        "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u043d\u043e\u0432\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f \u041f\u0406\u0411.",
      ].join("\n"),
      {
        replyMarkup: {
          keyboard: [
            [
              {
                text: "\u274c \u0421\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (text === "\u{1F4DD} \u0410\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0456 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f") {
    const subjects = await listSubjects(chatId);

    if (!subjects.length) {
      await sendTelegramMessage(
        chatId,
        "\u0423 \u0432\u0430\u0441 \u0449\u0435 \u043d\u0435\u043c\u0430\u0454 \u0434\u043e\u0434\u0430\u043d\u0438\u0445 \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0456\u0432.",
        {
          replyMarkup: MAIN_MENU,
        },
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      "\u{1F4DD} <b>\u0410\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0456 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f</b>\n\n\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0430:",
      {
        replyMarkup: {
          keyboard: [
            ...subjects.map((subject) => [
              {
                text: `\u{1F4DD} \u041d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f: ${subject.full_name}`,
              },
            ]),
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (text.startsWith("\u{1F6AB} \u0412\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f: ")) {
    const fullName = text
      .slice("\u{1F6AB} \u0412\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f: ".length)
      .trim();

    const subjects = await listSubjects(chatId);

    const subject = subjects.find(
      (item) => item.full_name === fullName,
    );

    if (!subject) {
      await sendTelegramMessage(
        chatId,
        "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u043d\u0430\u0439\u0442\u0438 \u0446\u044e \u043e\u0441\u043e\u0431\u0443.",
        {
          replyMarkup: MAIN_MENU,
        },
      );
      return;
    }

    EXCLUDED_TERM_STATES.set(
      chatId,
      {
        subjectId: subject.id,
      },
    );

    const currentTerms =
      Array.isArray(subject.excluded_terms) &&
      subject.excluded_terms.length
        ? subject.excluded_terms
            .map((term) => `\u2022 ${htmlEscape(term)}`)
            .join("\n")
        : "\u041f\u043e\u043a\u0438 \u043d\u0435\u043c\u0430\u0454.";

    await sendTelegramMessage(
      chatId,
      [
        "\u{1F6AB} <b>\u0421\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f</b>",
        "",
        `<b>${htmlEscape(subject.full_name)}</b>`,
        "",
        "<b>\u041f\u043e\u0442\u043e\u0447\u043d\u0456:</b>",
        currentTerms,
        "",
        "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u043d\u043e\u0432\u0435 \u0441\u043b\u043e\u0432\u043e \u0430\u0431\u043e \u0444\u0440\u0430\u0437\u0443 \u0434\u043b\u044f \u0432\u0456\u0434\u0441\u0456\u044e\u0432\u0430\u043d\u043d\u044f \u043d\u0435\u0440\u0435\u043b\u0435\u0432\u0430\u043d\u0442\u043d\u0438\u0445 \u0437\u0431\u0456\u0433\u0456\u0432.",
      ].join("\n"),
      {
        replyMarkup: {
          keyboard: [
            [
              {
                text: "\u274c \u0421\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  if (text === "\u{1F6AB} \u0421\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f") {
    const subjects = await listSubjects(chatId);

    if (!subjects.length) {
      await sendTelegramMessage(
        chatId,
        "\u0423 \u0432\u0430\u0441 \u0449\u0435 \u043d\u0435\u043c\u0430\u0454 \u0434\u043e\u0434\u0430\u043d\u0438\u0445 \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0456\u0432.",
        {
          replyMarkup: MAIN_MENU,
        },
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      "\u{1F6AB} <b>\u0421\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f</b>\n\n\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0430:",
      {
        replyMarkup: {
          keyboard: [
            ...subjects.map((subject) => [
              {
                text: `\u{1F6AB} \u0412\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f: ${subject.full_name}`,
              },
            ]),
            [
              {
                text: "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
              },
            ],
            [
              {
                text: "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );

    return;
  }

  const thresholdState =
    MATCH_THRESHOLD_STATES.get(chatId);

  if (thresholdState) {
    if (
      text === "\u274c \u0421\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0437\u043c\u0456\u043d\u0443 \u043f\u043e\u0440\u043e\u0433\u0443"
    ) {
      MATCH_THRESHOLD_STATES.delete(chatId);

      await sendTelegramMessage(
        chatId,
        "\u0417\u043c\u0456\u043d\u0443 \u043f\u043e\u0440\u043e\u0433\u0443 \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e.",
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }

    if (
      text === "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f"
    ) {
      MATCH_THRESHOLD_STATES.delete(chatId);

      await sendTelegramMessage(
        chatId,
        "\u2699\ufe0f <b>\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f</b>\n\n\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0440\u043e\u0437\u0434\u0456\u043b:",
        {
          replyMarkup: {
            keyboard: [
              [
                {
                  text: "\u{1F4DD} \u0410\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0456 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f",
                },
              ],
              [
                {
                  text: "\u{1F6AB} \u0421\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f",
                },
              ],
              [
                {
                  text: "\u{1F3AF} \u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443",
                },
              ],
              [
                {
                  text: "\u{1F50C} \u0414\u0436\u0435\u0440\u0435\u043b\u0430 \u043f\u043e\u0448\u0443\u043a\u0443",
                },
              ],
              [
                {
                  text: "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e",
                },
              ],
            ],
            resize_keyboard: true,
            is_persistent: true,
          },
        },
      );

      return;
    }

    const rawValue = text.trim();

    if (!/^\d+$/.test(rawValue)) {
      await sendTelegramMessage(
        chatId,
        "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u0446\u0456\u043b\u0435 \u0447\u0438\u0441\u043b\u043e \u0432\u0456\u0434 50 \u0434\u043e 95.",
      );

      return;
    }

    const value = Number(rawValue);

    if (value < 50 || value > 95) {
      await sendTelegramMessage(
        chatId,
        "\u041f\u043e\u0440\u0456\u0433 \u043c\u0430\u0454 \u0431\u0443\u0442\u0438 \u0432\u0456\u0434 50 \u0434\u043e 95.",
      );

      return;
    }

    const subject = await getSubject(
      thresholdState.subjectId,
      chatId,
    );

    if (!subject) {
      MATCH_THRESHOLD_STATES.delete(chatId);

      await sendTelegramMessage(
        chatId,
        "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u043d\u0430\u0439\u0442\u0438 \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0430.",
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }

    const updated = await updateSubject(
      subject.id,
      chatId,
      {
        match_threshold: value,
      },
    );

    MATCH_THRESHOLD_STATES.delete(chatId);

    if (!updated) {
      await sendTelegramMessage(
        chatId,
        "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u043d\u043e\u0432\u0438\u0439 \u043f\u043e\u0440\u0456\u0433.",
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "\u2705 <b>\u041f\u043e\u0440\u0456\u0433 \u0437\u0431\u0456\u0433\u0443 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043e</b>",
        "",
        `<b>${htmlEscape(updated.full_name)}</b>`,
        `\u{1F3AF} ${updated.match_threshold}`,
      ].join("\n"),
      {
        replyMarkup: MAIN_MENU,
      },
    );

    return;
  }

  const aliasState =
    ALIAS_STATES.get(chatId);

  if (aliasState) {
    if (text === "\u274c \u0421\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f") {
      ALIAS_STATES.delete(chatId);

      await sendTelegramMessage(
        chatId,
        "\u0414\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f \u0430\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e.",
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }

    if (
      text === "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f" ||
      text === "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e"
    ) {
      ALIAS_STATES.delete(chatId);
    } else {
      const alias = text.trim();

      if (!alias) {
        await sendTelegramMessage(
          chatId,
          "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u043d\u0435\u043f\u043e\u0440\u043e\u0436\u043d\u0456\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f.",
        );
        return;
      }

      const subject = await getSubject(
        aliasState.subjectId,
        chatId,
      );

      if (!subject) {
        ALIAS_STATES.delete(chatId);

        await sendTelegramMessage(
          chatId,
          "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u043d\u0430\u0439\u0442\u0438 \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0430.",
          {
            replyMarkup: MAIN_MENU,
          },
        );

        return;
      }

      const updated = await addAlias(
        subject.id,
        chatId,
        alias,
      );

      ALIAS_STATES.delete(chatId);

      if (!updated) {
        await sendTelegramMessage(
          chatId,
          "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u0430\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0435 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f.",
          {
            replyMarkup: MAIN_MENU,
          },
        );

        return;
      }

      await sendTelegramMessage(
        chatId,
        [
          "\u2705 <b>\u0410\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u0435 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044f \u0434\u043e\u0434\u0430\u043d\u043e</b>",
          "",
          `<b>${htmlEscape(updated.full_name)}</b>`,
          `\u{1F4DD} ${htmlEscape(alias)}`,
        ].join("\n"),
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }
  }

  const excludedTermState =
    EXCLUDED_TERM_STATES.get(chatId);

  if (excludedTermState) {
    if (text === "\u274c \u0421\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f") {
      EXCLUDED_TERM_STATES.delete(chatId);

      await sendTelegramMessage(
        chatId,
        "\u0414\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f \u0441\u043b\u043e\u0432\u0430-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e.",
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }

    if (
      text === "\u2b05\ufe0f \u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f" ||
      text === "\u2b05\ufe0f \u0413\u043e\u043b\u043e\u0432\u043d\u0435 \u043c\u0435\u043d\u044e"
    ) {
      EXCLUDED_TERM_STATES.delete(chatId);
    } else {
      const term = text.trim();

      if (!term) {
        await sendTelegramMessage(
          chatId,
          "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u043d\u0435\u043f\u043e\u0440\u043e\u0436\u043d\u0454 \u0441\u043b\u043e\u0432\u043e \u0430\u0431\u043e \u0444\u0440\u0430\u0437\u0443.",
        );
        return;
      }

      const subject = await getSubject(
        excludedTermState.subjectId,
        chatId,
      );

      if (!subject) {
        EXCLUDED_TERM_STATES.delete(chatId);

        await sendTelegramMessage(
          chatId,
          "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u043d\u0430\u0439\u0442\u0438 \u0441\u0443\u0431\u2019\u0454\u043a\u0442\u0430.",
          {
            replyMarkup: MAIN_MENU,
          },
        );

        return;
      }

      const updated = await addExcludedTerm(
        subject.id,
        chatId,
        term,
      );

      EXCLUDED_TERM_STATES.delete(chatId);

      if (!updated) {
        await sendTelegramMessage(
          chatId,
          "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u0441\u043b\u043e\u0432\u043e-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f.",
          {
            replyMarkup: MAIN_MENU,
          },
        );

        return;
      }

      await sendTelegramMessage(
        chatId,
        [
          "\u2705 <b>\u0421\u043b\u043e\u0432\u043e-\u0432\u0438\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044f \u0434\u043e\u0434\u0430\u043d\u043e</b>",
          "",
          `<b>${htmlEscape(updated.full_name)}</b>`,
          `\u{1F6AB} ${htmlEscape(term)}`,
        ].join("\n"),
        {
          replyMarkup: MAIN_MENU,
        },
      );

      return;
    }
  }

  const editState = EDIT_SUBJECT_STATES.get(chatId);
  if (editState) {
    if (text === "❌ Скасувати редагування") {
      EDIT_SUBJECT_STATES.delete(chatId);
      await sendTelegramMessage(chatId, "Редагування скасовано.", { replyMarkup: MAIN_MENU });
      return;
    }

    const subject = await getSubject(editState.subjectId, chatId);
    if (!subject) {
      EDIT_SUBJECT_STATES.delete(chatId);
      await sendTelegramMessage(chatId, "Не вдалося знайти особу для редагування.", { replyMarkup: MAIN_MENU });
      return;
    }

    let value;
    if (editState.field === "aliases") {
      value = text.split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      value = text.trim();
      if (!value) {
        await sendTelegramMessage(chatId, "Значення не може бути порожнім.");
        return;
      }
      if (editState.field === "full_name" && value.split(/\s+/).length < 2) {
        await sendTelegramMessage(chatId, "Вкажіть щонайменше ім’я та прізвище.");
        return;
      }
    }

    const updated = await updateSubject(subject.id, chatId, { [editState.field]: value });
    EDIT_SUBJECT_STATES.delete(chatId);
    await sendTelegramMessage(
      chatId,
      updated ? `✅ <b>Дані оновлено</b>\n\n${subjectSummary(updated)}` : "Не вдалося зберегти зміни.",
      { replyMarkup: MAIN_MENU },
    );
    return;
  }

  // Майстер додавання особи.
  const addState = ADD_SUBJECT_STATES.get(chatId);
  if (addState?.step === "fullName" && text !== "➕ Додати особу") {
    const fullName = text.trim();
    if (fullName.split(/\s+/).length < 2) {
      await sendTelegramMessage(chatId, "Вкажіть щонайменше ім’я та прізвище.");
      return;
    }
    ADD_SUBJECT_STATES.set(chatId, { step: "organization", fullName });
    await sendTelegramMessage(
      chatId,
      `✅ ПІБ: <b>${htmlEscape(fullName)}</b>\n\nТепер введіть назву організації або пропустіть цей крок:`,
      { replyMarkup: skipKeyboard() },
    );
    return;
  }

  if (addState?.step === "organization") {
    const organization = text === "⏭ Пропустити" ? null : text.trim();
    ADD_SUBJECT_STATES.set(chatId, { ...addState, step: "position", organization });
    await sendTelegramMessage(
      chatId,
      organization
        ? `✅ Організація: <b>${htmlEscape(organization)}</b>\n\nТепер введіть посаду або пропустіть цей крок:`
        : "✅ Організацію пропущено.\n\nТепер введіть посаду або пропустіть цей крок:",
      { replyMarkup: skipKeyboard() },
    );
    return;
  }

  if (addState?.step === "position") {
    const position = text === "⏭ Пропустити" ? null : text.trim();
    ADD_SUBJECT_STATES.set(chatId, { ...addState, step: "city", position });
    await sendTelegramMessage(
      chatId,
      position
        ? `✅ Посада: <b>${htmlEscape(position)}</b>\n\nТепер введіть місто або пропустіть цей крок:`
        : "✅ Посаду пропущено.\n\nТепер введіть місто або пропустіть цей крок:",
      { replyMarkup: skipKeyboard() },
    );
    return;
  }

  if (addState?.step === "city") {
    const city = text === "⏭ Пропустити" ? null : text.trim();
    ADD_SUBJECT_STATES.set(chatId, { ...addState, step: "aliases", city });
    await sendTelegramMessage(
      chatId,
      city
        ? `✅ Місто: <b>${htmlEscape(city)}</b>\n\nТепер введіть альтернативні написання імені або псевдоніми через кому. Якщо їх немає — пропустіть цей крок.`
        : "✅ Місто пропущено.\n\nТепер введіть альтернативні написання імені або псевдоніми через кому. Якщо їх немає — пропустіть цей крок.",
      { replyMarkup: skipKeyboard() },
    );
    return;
  }

  if (addState?.step === "aliases") {
    const aliases = text === "⏭ Пропустити" ? [] : text.split(",").map((item) => item.trim()).filter(Boolean);
    const subject = await createSubject({
      chatId,
      fullName: addState.fullName,
      organization: addState.organization || undefined,
      position: addState.position || undefined,
      city: addState.city || undefined,
      aliases,
    });
    ADD_SUBJECT_STATES.delete(chatId);
    await sendTelegramMessage(
      chatId,
      `✅ <b>Особу додано</b>\n\n${subjectSummary(subject)}\n\nАльтернативних написань: ${aliases.length}`,
      { replyMarkup: MAIN_MENU },
    );
    return;
  }

  if (text === "➕ Додати особу") {
    ADD_SUBJECT_STATES.set(chatId, { step: "fullName" });
    await sendTelegramMessage(chatId, "Введіть ПІБ особи одним повідомленням:", {
      replyMarkup: { keyboard: [[{ text: "⬅️ Головне меню" }]], resize_keyboard: true, is_persistent: true },
    });
    return;
  }

  // Головна кнопка перевірки.
  if (text === "🔎 Перевірити") {
    const subjects = await listSubjects(chatId);
    if (!subjects.length) {
      await sendTelegramMessage(chatId, "Список порожній. Спочатку додайте особу.", { replyMarkup: MAIN_MENU });
      return;
    }
    const keyboard = subjects.map((subject) => [{ text: `🔎 ${subject.full_name}` }]);
    keyboard.push([{ text: "⬅️ Головне меню" }]);
    await sendTelegramMessage(chatId, "Оберіть особу для перевірки:", {
      replyMarkup: { keyboard, resize_keyboard: true, is_persistent: true },
    });
    return;
  }

  if (text.startsWith("🔎 Перевірити: ")) {
    const subject = await findSubjectByName(chatId, text.slice("🔎 Перевірити: ".length).trim());
    if (!subject) return sendMissingSubject(chatId);
    await runCheck(chatId, subject);
    return;
  }

  if (text.startsWith("🔎 ") && text !== "🔎 Перевірити") {
    const subject = await findSubjectByName(chatId, text.slice(3).trim());
    if (!subject) return sendMissingSubject(chatId);
    await runCheck(chatId, subject);
    return;
  }

  // Головна кнопка звітів — формує файли із вже збережених даних, без нового пошуку.
  if (text === "📊 Звіти") {
    const subjects = await listSubjects(chatId);
    if (!subjects.length) {
      await sendTelegramMessage(chatId, "Список суб’єктів порожній.", { replyMarkup: MAIN_MENU });
      return;
    }
    const keyboard = subjects.map((subject) => [{ text: `📊 ${subject.full_name}` }]);
    keyboard.push([{ text: "⬅️ Головне меню" }]);
    await sendTelegramMessage(chatId, "Оберіть особу для формування звіту:", {
      replyMarkup: { keyboard, resize_keyboard: true, is_persistent: true },
    });
    return;
  }

  if (text.startsWith("📊 Звіт: ")) {
    const subject = await findSubjectByName(chatId, text.slice("📊 Звіт: ".length).trim());
    if (!subject) return sendMissingSubject(chatId);
    await sendStoredReports(chatId, subject);
    return;
  }

  if (text.startsWith("📊 ") && text !== "📊 Звіти") {
    const subject = await findSubjectByName(chatId, text.slice(3).trim());
    if (!subject) return sendMissingSubject(chatId);
    await sendStoredReports(chatId, subject);
    return;
  }

  // Список суб'єктів і картка конкретної особи.
  if (text === "⬅️ До списку суб’єктів") {
    await showSubjectsMenu(chatId);
    return;
  }

  if (text.startsWith("👤 ")) {
    const subject = await findSubjectByName(chatId, text.slice(3).trim());
    if (!subject) return sendMissingSubject(chatId);
    await showSubjectCard(chatId, subject);
    return;
  }

  if (command === "/list" || text === "👥 Суб’єкти") {
    await showSubjectsMenu(chatId);
    return;
  }

  // Картка: видалення.
  if (text.startsWith("🗑 Видалити: ")) {
    const subject = await findSubjectByName(chatId, text.slice("🗑 Видалити: ".length).trim());
    if (!subject) return sendMissingSubject(chatId);
    await sendTelegramMessage(chatId, `⚠️ Ви впевнені, що хочете видалити <b>${htmlEscape(subject.full_name)}</b>?`, {
      replyMarkup: {
        keyboard: [[{ text: `✅ Так, видалити: ${subject.full_name}` }], [{ text: "⬅️ До списку суб’єктів" }]],
        resize_keyboard: true, is_persistent: true,
      },
    });
    return;
  }

  if (text.startsWith("✅ Так, видалити: ")) {
    const subject = await findSubjectByName(chatId, text.slice("✅ Так, видалити: ".length).trim());
    if (!subject) return sendMissingSubject(chatId);
    const deleted = await deleteSubject(subject.id, chatId);
    await sendTelegramMessage(chatId, deleted ? `🗑 <b>${htmlEscape(subject.full_name)}</b> видалено.` : "Не вдалося видалити особу.", { replyMarkup: MAIN_MENU });
    return;
  }

  // Картка: редагування.
  const editFields = [
    { prefix: "✏️ ПІБ: ", field: "full_name", label: "ПІБ" },
    { prefix: "✏️ Організація: ", field: "organization", label: "організацію" },
    { prefix: "✏️ Посада: ", field: "position", label: "посаду" },
    { prefix: "✏️ Місто: ", field: "city", label: "місто" },
    { prefix: "✏️ Псевдоніми: ", field: "aliases", label: "альтернативні написання" },
  ];
  const selectedEditField = editFields.find((item) => text.startsWith(item.prefix));
  if (selectedEditField) {
    const subject = await findSubjectByName(chatId, text.slice(selectedEditField.prefix.length).trim());
    if (!subject) return sendMissingSubject(chatId);
    EDIT_SUBJECT_STATES.set(chatId, { subjectId: subject.id, field: selectedEditField.field, label: selectedEditField.label });
    const hint = selectedEditField.field === "aliases" ? "\nВведіть значення через кому." : "";
    await sendTelegramMessage(chatId, `Введіть нове значення для поля <b>${htmlEscape(selectedEditField.label)}</b>.${hint}`, {
      replyMarkup: { keyboard: [[{ text: "❌ Скасувати редагування" }]], resize_keyboard: true, is_persistent: true },
    });
    return;
  }

  if (text.startsWith("✏️ Редагувати: ")) {
    const subject = await findSubjectByName(chatId, text.slice("✏️ Редагувати: ".length).trim());
    if (!subject) return sendMissingSubject(chatId);
    await sendTelegramMessage(chatId, `✏️ Що змінити для <b>${htmlEscape(subject.full_name)}</b>?`, {
      replyMarkup: {
        keyboard: [
          [{ text: `✏️ ПІБ: ${subject.full_name}` }],
          [{ text: `✏️ Організація: ${subject.full_name}` }],
          [{ text: `✏️ Посада: ${subject.full_name}` }],
          [{ text: `✏️ Місто: ${subject.full_name}` }],
          [{ text: `✏️ Псевдоніми: ${subject.full_name}` }],
          [{ text: "⬅️ До списку суб’єктів" }],
          [{ text: "⬅️ Головне меню" }],
        ],
        resize_keyboard: true, is_persistent: true,
      },
    });
    return;
  }

  // Старі текстові команди лишаються сумісними. /mentions навмисно видалено.
  if (command === "/add") {
    const [fullName, organization, position, city, aliasesRaw] = payload.split("|").map((part) => part.trim());
    if (!fullName || fullName.split(/\s+/).length < 2) throw new Error("вкажіть щонайменше ім’я і прізвище; формат наведено в /help");
    const subject = await createSubject({
      chatId, fullName,
      organization: organization || undefined, position: position || undefined, city: city || undefined,
      aliases: aliasesRaw ? aliasesRaw.split(",").map((item) => item.trim()).filter(Boolean) : [],
    });
    await sendTelegramMessage(chatId, `✅ Суб’єкта додано.\n\n${subjectSummary(subject)}`, { replyMarkup: MAIN_MENU });
    return;
  }

  if (command === "/check") {
    const id = requireUuid(payload);
    const subject = await getSubject(id, chatId);
    if (!subject) throw new Error("суб’єкта з таким ID не знайдено");
    await runCheck(chatId, subject);
    return;
  }

  if (command === "/checkall") {
    const subjects = await listSubjects(chatId);
    if (!subjects.length) {
      await sendTelegramMessage(chatId, "Список порожній. Додайте особу через меню.", { replyMarkup: MAIN_MENU });
      return;
    }
    await sendTelegramMessage(chatId, `🔎 Запускаю ручну перевірку: ${subjects.length} осіб.`);
    for (const subject of subjects) await runCheck(chatId, subject);
    return;
  }

  if (command === "/delete") {
    const deleted = await deleteSubject(requireUuid(payload), chatId);
    await sendTelegramMessage(chatId, deleted ? "🗑 Суб’єкта та його згадки видалено." : "Суб’єкта не знайдено.", { replyMarkup: MAIN_MENU });
    return;
  }

  if (command === "/alias") {
    const [idRaw, alias] = payload.split("|").map((part) => part.trim());
    if (!alias) throw new Error("потрібен формат: /alias ID | альтернативне написання");
    const subject = await addAlias(requireUuid(idRaw), chatId, alias);
    if (!subject) throw new Error("суб’єкта не знайдено");
    await sendTelegramMessage(chatId, `✅ Додано альтернативне написання: <b>${htmlEscape(alias)}</b>`);
    return;
  }

  if (command === "/exclude") {
    const [idRaw, term] = payload.split("|").map((part) => part.trim());
    if (!term) throw new Error("потрібен формат: /exclude ID | слово для відсіювання");
    const subject = await addExcludedTerm(requireUuid(idRaw), chatId, term);
    if (!subject) throw new Error("суб’єкта не знайдено");
    await sendTelegramMessage(chatId, `✅ Додано виключення: <b>${htmlEscape(term)}</b>`);
    return;
  }

  await sendTelegramMessage(chatId, HELP, { replyMarkup: MAIN_MENU });
}

function skipKeyboard() {
  return {
    keyboard: [[{ text: "⏭ Пропустити" }], [{ text: "⬅️ Головне меню" }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function findSubjectByName(chatId, fullName) {
  const subjects = await listSubjects(chatId);
  return subjects.find((item) => item.full_name === fullName) ?? null;
}

async function sendMissingSubject(chatId) {
  await sendTelegramMessage(chatId, "Не вдалося знайти цю особу у списку.", { replyMarkup: MAIN_MENU });
}

async function showSubjectsMenu(chatId) {
  const subjects = await listSubjects(chatId);
  if (!subjects.length) {
    await sendTelegramMessage(chatId, "Список суб’єктів порожній.", { replyMarkup: MAIN_MENU });
    return;
  }
  const keyboard = subjects.map((subject) => [{ text: `👤 ${subject.full_name}` }]);
  keyboard.push([{ text: "⬅️ Головне меню" }]);
  await sendTelegramMessage(chatId, "Оберіть особу:", {
    replyMarkup: { keyboard, resize_keyboard: true, is_persistent: true },
  });
}

async function showSubjectCard(chatId, subject) {
  await sendTelegramMessage(chatId, subjectSummary(subject), {
    replyMarkup: {
      keyboard: [
        [{ text: `🔎 Перевірити: ${subject.full_name}` }],
        [{ text: `📊 Звіт: ${subject.full_name}` }],
        [{ text: `✏️ Редагувати: ${subject.full_name}` }, { text: `🗑 Видалити: ${subject.full_name}` }],
        [{ text: "⬅️ До списку суб’єктів" }],
        [{ text: "⬅️ Головне меню" }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  });
}

const PROVIDER_GROUPS = new Map([
  ["court-open-data", { key: "courts", title: "⚖️ Судові справи" }],
  ["court-register", { key: "courts", title: "⚖️ Судові справи" }],
  ["nazk-declarations", { key: "declarations", title: "📄 Декларації НАЗК" }],
  ["nazk-corrupt-register", { key: "corrupt-register", title: "🚫 Реєстр корупціонерів НАЗК" }],
  ["prozorro", { key: "prozorro", title: "🛒 Prozorro" }],
  ["official-sites", { key: "official", title: "🏛 Офіційні сайти" }],
  ["google-news-rss", { key: "news", title: "📰 Новини" }],
  ["google-serpapi", { key: "web", title: "🌐 Пошук в інтернеті" }],
  ["google-serper", { key: "web", title: "🌐 Пошук в інтернеті" }],
]);

const GROUP_ORDER = ["courts", "corrupt-register", "declarations", "prozorro", "official", "news", "web", "other"];

function groupMentions(mentions) {
  const grouped = new Map();
  for (const mention of mentions) {
    const definition = PROVIDER_GROUPS.get(mention.provider) ?? { key: "other", title: "📎 Інші джерела" };
    if (!grouped.has(definition.key)) grouped.set(definition.key, { title: definition.title, items: [] });
    grouped.get(definition.key).items.push(mention);
  }
  for (const group of grouped.values()) {
    group.items.sort((a, b) => {
      const scoreDifference = Number(b.score ?? 0) - Number(a.score ?? 0);
      if (scoreDifference !== 0) return scoreDifference;
      return (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0);
    });
  }
  return GROUP_ORDER.filter((key) => grouped.has(key)).map((key) => grouped.get(key));
}

async function runCheck(chatId, subject) {
  await sendTelegramMessage(chatId, `🔎 Перевіряю: <b>${htmlEscape(subject.full_name)}</b>`);
  const result = await monitorSubject(subject);

  if (!result.mentions.length) {
    const errors = result.errors.length ? `\n⚠️ Частина джерел недоступна: ${htmlEscape(result.errors.join("; "))}` : "";
    await sendTelegramMessage(chatId, `Згадок із достатнім рівнем збігу не знайдено. Перевірено кандидатів: ${result.scanned}.${errors}`);
    return;
  }

  const newMentions = new Set(result.newMentions);
  const sections = groupMentions(result.mentions).map((group) => {
    const items = group.items.map((mention) => formatMention(mention, newMentions.has(mention))).join("\n\n");
    return `<b>${group.title} — ${group.items.length}</b>\n\n${items}`;
  });
  const errors = result.errors.length ? `\n⚠️ Частина джерел недоступна: ${htmlEscape(result.errors.join("; "))}` : "";
  const header = `📊 <b>Повний звіт: ${htmlEscape(subject.full_name)}</b>\n` +
    `Збігів: ${result.mentions.length}; нових: ${result.newMentions.length}; перевірено кандидатів: ${result.scanned}.${errors}`;

  await sendTelegramMessage(chatId, `${header}\n\n${sections.join("\n\n")}`);
  await sendTelegramMessage(chatId, "📁 Формую Excel та PDF-звіти...");

  const reports = await buildReports({
    subject, mentions: result.mentions, newMentions: result.newMentions, scanned: result.scanned, errors: result.errors,
  });
  await sendTelegramDocument(chatId, {
    buffer: reports.excel.buffer, filename: reports.excel.filename,
    caption: `📊 <b>Повний Excel-звіт</b>\n${htmlEscape(subject.full_name)}`,
  });
  await sendTelegramDocument(chatId, {
    buffer: reports.pdf.buffer, filename: reports.pdf.filename,
    caption: `📄 <b>Стислий PDF-звіт</b>\n${htmlEscape(subject.full_name)}`,
  });
}

async function sendStoredReports(chatId, subject) {
  const mentions = await listMentions(subject.id, Number.MAX_SAFE_INTEGER);
  if (!mentions.length) {
    await sendTelegramMessage(chatId, "Для цієї особи ще немає даних для формування звіту. Спочатку виконайте перевірку.", { replyMarkup: MAIN_MENU });
    return;
  }
  await sendTelegramMessage(chatId, "📁 Формую Excel та PDF-звіти...");
  const scanned = Number.isInteger(subject.last_scanned_count)
    ? subject.last_scanned_count
    : mentions.length;

  const reports = await buildReports({
    subject,
    mentions,
    newMentions: [],
    scanned,
    errors: [],
  });
  await sendTelegramDocument(chatId, {
    buffer: reports.excel.buffer, filename: reports.excel.filename,
    caption: `📊 <b>Повний Excel-звіт</b>\n${htmlEscape(subject.full_name)}`,
  });
  await sendTelegramDocument(chatId, {
    buffer: reports.pdf.buffer, filename: reports.pdf.filename,
    caption: `📄 <b>Стислий PDF-звіт</b>\n${htmlEscape(subject.full_name)}`,
  });
}

function requireUuid(value) {
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("вкажіть коректний ID суб’єкта з команди /list");
  }
  return id;
}

function subjectSummary(subject) {
  const context = [subject.position, subject.organization, subject.city].filter(Boolean).join(" · ");
  const checked = subject.last_checked_at ? `\nОстання перевірка: ${new Date(subject.last_checked_at).toLocaleString("uk-UA")}` : "";
  return `<b>${htmlEscape(subject.full_name)}</b>${context ? `\n${htmlEscape(context)}` : ""}\nID: <code>${subject.id}</code>${checked}`;
}

function formatMention(mention, isNew = false) {
  const freshness = isNew ? "🆕 " : "";
  const level = mention.level === "confirmed" ? "✅ високий збіг" : "⚠️ ймовірний збіг";
  const source = mention.source ? ` · ${htmlEscape(mention.source)}` : "";
  const date = mention.publishedAt ? ` · ${htmlEscape(new Date(mention.publishedAt).toLocaleDateString("uk-UA"))}` : "";
  const reasons = (mention.reasons ?? []).slice(0, 4).map(htmlEscape).join("; ");
  return `${freshness}${level} — <b>${mention.score}/100</b>${source}${date}\n` +
    `<a href="${htmlEscape(mention.url)}">${htmlEscape(mention.title)}</a>\n<i>${reasons}</i>`;
}
