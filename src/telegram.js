import { config } from "./config.js";

function apiUrl(method) {
  return `https://api.telegram.org/bot${config().telegramToken}/${method}`;
}

export async function telegramCall(method, payload = {}) {
  const response = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(`Telegram ${method}: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.result;
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  for (const chunk of splitTelegramHtml(text)) {
    await telegramCall("sendMessage", {
      chat_id: chatId,
      text: chunk,
      parse_mode: "HTML",
      disable_web_page_preview: options.disablePreview ?? true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    });
  }
}

function splitTelegramHtml(text, maxLength = 3800) {
  if (text.length <= maxLength) return [text];
  const paragraphs = text.split("\n\n");
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = paragraph.length <= maxLength ? paragraph : `${paragraph.slice(0, maxLength - 1)}…`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendTelegramDocument(chatId, { buffer, filename, caption = "" }) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (caption) {
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
  }
  form.set("document", new Blob([buffer]), filename);

  const response = await fetch(apiUrl("sendDocument"), { method: "POST", body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(`Telegram sendDocument: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.result;
}
