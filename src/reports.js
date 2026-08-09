import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const REPORT_GROUPS = [
  { key: "courts", title: "Судові справи", sheet: "Судові справи", providers: new Set(["court-open-data", "court-register"]), pdfLimit: 5 },
  { key: "corrupt-register", title: "Реєстр корупціонерів НАЗК", sheet: "Реєстр корупціонерів", providers: new Set(["nazk-corrupt-register"]), pdfLimit: 3 },
  { key: "declarations", title: "Декларації НАЗК", sheet: "Декларації НАЗК", providers: new Set(["nazk-declarations"]), pdfLimit: 4 },
  { key: "prozorro", title: "Prozorro", sheet: "Prozorro", providers: new Set(["prozorro"]), pdfLimit: 3 },
  { key: "official", title: "Офіційні сайти", sheet: "Офіційні сайти", providers: new Set(["official-sites"]), pdfLimit: 4 },
  { key: "news-web", title: "Новини та вебпошук", sheet: "Новини та вебпошук", providers: new Set(["google-news-rss", "google-serpapi", "google-serper"]), pdfLimit: 6 },
  { key: "other", title: "Інші джерела", sheet: "Інші джерела", providers: new Set(), pdfLimit: 3 },
];

const EXCEL_COLUMNS = [
  { header: "№", key: "number", width: 7 },
  { header: "Нове", key: "isNew", width: 10 },
  { header: "Рівень збігу", key: "level", width: 19 },
  { header: "Бал", key: "score", width: 9 },
  { header: "Джерело", key: "source", width: 30 },
  { header: "Провайдер", key: "provider", width: 23 },
  { header: "Дата публікації", key: "publishedAt", width: 18 },
  { header: "Перша фіксація", key: "firstSeenAt", width: 19 },
  { header: "Заголовок", key: "title", width: 48 },
  { header: "Опис", key: "snippet", width: 60 },
  { header: "Причини збігу", key: "reasons", width: 48 },
  { header: "Посилання", key: "url", width: 20 },
];

const COLORS = {
  navy: "17365D", blue: "2F75B5", paleBlue: "D9EAF7", paleGreen: "E2F0D9",
  paleYellow: "FFF2CC", paleRed: "FCE4D6", white: "FFFFFF", gray: "E7E6E6", darkGray: "595959",
};

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMention(mention, isNew) {
  return {
    isNew,
    provider: mention.provider ?? "unknown",
    title: mention.title ?? "Без заголовка",
    url: mention.url ?? "",
    source: mention.source ?? "",
    snippet: mention.snippet ?? "",
    publishedAt: parseDate(mention.publishedAt ?? mention.published_at),
    firstSeenAt: parseDate(mention.firstSeenAt ?? mention.first_seen_at),
    score: Number(mention.score ?? mention.match_score ?? 0),
    level: mention.level ?? mention.match_level ?? "possible",
    reasons: Array.isArray(mention.reasons) ? mention.reasons.filter(Boolean) : [],
  };
}

function prepareMentions(mentions, newMentions) {
  const newSet = new Set(newMentions);
  return mentions.map((mention) => normalizeMention(mention, newSet.has(mention))).sort((a, b) => {
    const scoreDifference = b.score - a.score;
    if (scoreDifference !== 0) return scoreDifference;
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });
}

function groupForProvider(provider) {
  return REPORT_GROUPS.find((group) => group.key !== "other" && group.providers.has(provider)) ?? REPORT_GROUPS.at(-1);
}

function groupMentions(mentions) {
  const grouped = new Map(REPORT_GROUPS.map((group) => [group.key, []]));
  for (const mention of mentions) grouped.get(groupForProvider(mention.provider).key).push(mention);
  return grouped;
}

function levelLabel(level) { return level === "confirmed" ? "Високий збіг" : "Ймовірний збіг"; }
function formatDate(date) { return date ? date.toLocaleDateString("uk-UA") : "Дата не зазначена"; }
function formatDateTime(date) { return date.toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }); }

function reportStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function safeFilePart(value) {
  return String(value ?? "report").normalize("NFKC").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 70).replaceAll(" ", "_") || "report";
}

function truncate(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function styleHeaderRow(row) {
  row.height = 28;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    const side = { style: "thin", color: { argb: COLORS.white } };
    cell.border = { top: side, left: side, bottom: side, right: side };
  });
}

function addExcelTitle(sheet, title, subtitle) {
  sheet.mergeCells("A1:L1");
  Object.assign(sheet.getCell("A1"), { value: title });
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: COLORS.white } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;
  sheet.mergeCells("A2:L2");
  sheet.getCell("A2").value = subtitle;
  sheet.getCell("A2").font = { italic: true, color: { argb: COLORS.darkGray } };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;
}

function styleMentionRow(row, mention) {
  row.height = 54;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    const side = { style: "thin", color: { argb: COLORS.gray } };
    cell.border = { top: side, left: side, bottom: side, right: side };
  });
  if (mention.isNew) {
    row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.paleGreen } }; });
  } else if (mention.level !== "confirmed") {
    row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.paleYellow } }; });
  }
}

function addMentionSheet(workbook, name, title, mentions, generatedAt) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.columns = EXCEL_COLUMNS.map(({ header: _header, ...column }) => column);
  addExcelTitle(sheet, title, `Сформовано: ${formatDateTime(generatedAt)}. Результатів: ${mentions.length}.`);
  const headerRow = sheet.getRow(3);
  EXCEL_COLUMNS.forEach((column, index) => { headerRow.getCell(index + 1).value = column.header; });
  styleHeaderRow(headerRow);

  mentions.forEach((mention, index) => {
    const row = sheet.addRow({
      number: index + 1, isNew: mention.isNew ? "Так" : "Ні", level: levelLabel(mention.level), score: mention.score,
      source: mention.source, provider: mention.provider, publishedAt: mention.publishedAt, firstSeenAt: mention.firstSeenAt,
      title: mention.title, snippet: mention.snippet, reasons: mention.reasons.join("; "),
      url: mention.url ? { text: "Відкрити джерело", hyperlink: mention.url } : "",
    });
    styleMentionRow(row, mention);
    row.getCell("score").numFmt = "0";
    row.getCell("publishedAt").numFmt = "dd.mm.yyyy";
    row.getCell("firstSeenAt").numFmt = "dd.mm.yyyy hh:mm";
    for (const key of ["number", "isNew", "score"]) row.getCell(key).alignment = { horizontal: "center", vertical: "top" };
    if (mention.url) row.getCell("url").font = { color: { argb: "0563C1" }, underline: true };
  });

  sheet.autoFilter = { from: "A3", to: `L${Math.max(3, sheet.rowCount)}` };
  return sheet;
}

function addSummarySheet(workbook, subject, mentions, grouped, scanned, errors, generatedAt) {
  const sheet = workbook.addWorksheet("Зведення", { views: [{ state: "frozen", ySplit: 2 }] });
  sheet.columns = [
    { key: "a", width: 30 }, { key: "b", width: 34 }, { key: "c", width: 18 },
    { key: "d", width: 18 }, { key: "e", width: 18 }, { key: "f", width: 18 },
  ];
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "Звіт моніторингу публічних згадок";
  sheet.getCell("A1").font = { bold: true, size: 20, color: { argb: COLORS.white } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 34;

  const details = [
    ["ПІБ", subject.full_name], ["Посада", subject.position ?? "Не зазначено"],
    ["Організація", subject.organization ?? "Не зазначено"], ["Місто", subject.city ?? "Не зазначено"],
    ["ID суб'єкта", subject.id], ["Дата формування", formatDateTime(generatedAt)],
  ];
  details.forEach(([label, value], index) => {
    const rowNumber = index + 3;
    sheet.getCell(`A${rowNumber}`).value = label;
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    sheet.mergeCells(`B${rowNumber}:F${rowNumber}`);
    sheet.getCell(`B${rowNumber}`).value = value;
    sheet.getCell(`B${rowNumber}`).alignment = { wrapText: true, vertical: "top" };
  });

  // Після погодження користувача: верхній KPI "Нових" прибрано.
  const kpis = [
    ["Усього збігів", mentions.length, COLORS.paleBlue],
    ["Перевірено кандидатів", scanned, COLORS.paleYellow],
  ];
  kpis.forEach(([label, value, color], index) => {
    const start = 1 + index * 3;
    sheet.mergeCells(10, start, 10, start + 2);
    sheet.mergeCells(11, start, 11, start + 2);
    const labelCell = sheet.getCell(10, start);
    const valueCell = sheet.getCell(11, start);
    labelCell.value = label; valueCell.value = value;
    labelCell.font = { bold: true }; valueCell.font = { bold: true, size: 20 };
    labelCell.alignment = valueCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  });
  sheet.getRow(10).height = 24; sheet.getRow(11).height = 34;

  sheet.getCell("A13").value = "Розподіл за категоріями";
  sheet.getCell("A13").font = { bold: true, size: 14 };
  const summaryHeader = sheet.getRow(14);
  // Після погодження користувача: колонку "Нових" у розподілі прибрано.
  summaryHeader.values = ["Категорія", "Кількість"];
  styleHeaderRow(summaryHeader);

  REPORT_GROUPS.forEach((group) => {
    const items = grouped.get(group.key);
    const row = sheet.addRow([group.title, items.length]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      const side = { style: "thin", color: { argb: COLORS.gray } };
      cell.border = { top: side, left: side, bottom: side, right: side };
    });
  });

  const warningRow = 16 + REPORT_GROUPS.length;
  sheet.mergeCells(`A${warningRow}:F${warningRow}`);
  sheet.getCell(`A${warningRow}`).value = errors.length
    ? `Недоступні джерела або помилки: ${errors.join("; ")}`
    : "Усі підключені джерела відпрацювали без повідомлених помилок.";
  sheet.getCell(`A${warningRow}`).alignment = { wrapText: true };
  sheet.getCell(`A${warningRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: errors.length ? COLORS.paleRed : COLORS.paleGreen } };

  const noteRow = warningRow + 2;
  sheet.mergeCells(`A${noteRow}:F${noteRow + 2}`);
  sheet.getCell(`A${noteRow}`).value =
    "Примітка: звіт сформовано автоматично за результатами пошуку у відкритих джерелах. " +
    "Наявність збігу не є остаточним підтвердженням належності інформації конкретній особі та потребує перевірки першоджерела.";
  sheet.getCell(`A${noteRow}`).alignment = { wrapText: true, vertical: "top" };
  sheet.getCell(`A${noteRow}`).font = { italic: true };
  sheet.getCell(`A${noteRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.gray } };
}

export async function buildExcelReport({ subject, mentions, newMentions = [], scanned = 0, errors = [], generatedAt = new Date() }) {
  const prepared = prepareMentions(mentions, newMentions);
  const grouped = groupMentions(prepared);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Person Monitor Bot"; workbook.created = generatedAt; workbook.modified = generatedAt;
  addSummarySheet(workbook, subject, prepared, grouped, scanned, errors, generatedAt);
  addMentionSheet(workbook, "Усі згадки", "Усі знайдені згадки", prepared, generatedAt);
  for (const group of REPORT_GROUPS) addMentionSheet(workbook, group.sheet, group.title, grouped.get(group.key), generatedAt);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, filename: `${safeFilePart(subject.full_name)}_${reportStamp(generatedAt)}.xlsx` };
}

function resolvePdfFonts() {
  const packagedRegular =
    fileURLToPath(
      new URL(
        "../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
        import.meta.url
      )
    );

  const packagedBold =
    fileURLToPath(
      new URL(
        "../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
        import.meta.url
      )
    );

  const regularCandidates = [
    packagedRegular,
    "/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/calibri.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
  ];
  const boldCandidates = [
    packagedBold,
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/calibrib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
  ];
  const regular = regularCandidates.find((candidate) => existsSync(candidate));
  const bold = boldCandidates.find((candidate) => existsSync(candidate));
  if (!regular) throw new Error("Не знайдено системний шрифт із підтримкою української мови для PDF");
  return { regular, bold: bold ?? regular };
}

function ensurePdfSpace(doc, height = 80) {
  const bottom = doc.page.height - doc.page.margins.bottom - 24;
  if (doc.y + height > bottom) doc.addPage();
}

function addPdfHeading(doc, text, fontSize = 14) {
  ensurePdfSpace(doc, 42);
  doc.moveDown(0.5).font("Bold").fontSize(fontSize).fillColor("#17365D").text(text, { paragraphGap: 4 });
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#B4C6E7").stroke();
  doc.moveDown(0.4);
}

function addPdfMention(doc, mention, number) {
  ensurePdfSpace(doc, 115);
  const prefix = mention.isNew ? "НОВЕ. " : "";
  doc.font("Bold").fontSize(10.5).fillColor("#000000").text(`${number}. ${prefix}${truncate(mention.title, 180)}`, { paragraphGap: 2 });
  doc.font("Regular").fontSize(9).fillColor("#404040").text(
    `${levelLabel(mention.level)} - ${mention.score}/100${mention.source ? ` - ${truncate(mention.source, 80)}` : ""} - ${formatDate(mention.publishedAt)}`,
    { paragraphGap: 2 },
  );
  if (mention.snippet) doc.fillColor("#404040").text(truncate(mention.snippet, 360), { paragraphGap: 2 });
  if (mention.reasons.length) doc.fillColor("#595959").text(`Підстави збігу: ${truncate(mention.reasons.slice(0, 3).join("; "), 260)}`, { paragraphGap: 2 });
  if (mention.url) doc.fillColor("#0563C1").text("Відкрити першоджерело", { link: mention.url, underline: true });
  doc.moveDown(0.65);
}

export async function buildPdfReport({ subject, mentions, newMentions = [], scanned = 0, errors = [], generatedAt = new Date() }) {
  const prepared = prepareMentions(mentions, newMentions);
  const grouped = groupMentions(prepared);
  const fonts = resolvePdfFonts();
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4", margins: { top: 48, right: 48, bottom: 48, left: 48 }, bufferPages: true,
      info: { Title: `Звіт моніторингу: ${subject.full_name}`, Author: "Person Monitor Bot", Subject: "Стислий звіт моніторингу публічних згадок" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    doc.registerFont("Regular", fonts.regular); doc.registerFont("Bold", fonts.bold);

    doc.font("Bold").fontSize(20).fillColor("#17365D").text("Звіт моніторингу публічних згадок", { align: "center" });
    doc.moveDown(0.4).font("Bold").fontSize(15).fillColor("#000000").text(subject.full_name, { align: "center" });
    doc.moveDown(0.7);
    const context = [subject.position, subject.organization, subject.city].filter(Boolean).join(" | ");
    if (context) { doc.font("Regular").fontSize(10).fillColor("#404040").text(context, { align: "center" }); doc.moveDown(0.5); }
    doc.font("Regular").fontSize(9.5).fillColor("#595959").text(`Дата формування: ${formatDateTime(generatedAt)} | ID: ${subject.id}`, { align: "center" });

    addPdfHeading(doc, "Зведені показники");
    for (const [label, value] of [["Знайдено збігів", prepared.length], ["Перевірено кандидатів", scanned]]) {
      doc.font("Bold").fontSize(10).fillColor("#17365D").text(`${label}: `, { continued: true }).font("Regular").fillColor("#000000").text(String(value));
    }
    doc.moveDown(0.4);
    for (const group of REPORT_GROUPS) {
      const items = grouped.get(group.key);
      const groupNewCount = items.filter((mention) => mention.isNew).length;
      doc.font("Regular").fontSize(9.5).fillColor("#000000").text(`${group.title}: ${items.length}${groupNewCount ? `, нових: ${groupNewCount}` : ""}`);
    }
    if (errors.length) {
      addPdfHeading(doc, "Недоступні джерела або помилки", 12);
      doc.font("Regular").fontSize(9.5).fillColor("#9C0006").text(errors.join("; "));
    }

    // Користувач повернув попередній макет: ключові результати починаються на цій же сторінці, без примусового page break.
    addPdfHeading(doc, "Ключові результати");
    for (const group of REPORT_GROUPS) {
      const items = grouped.get(group.key);
      addPdfHeading(doc, `${group.title} - ${items.length}`, 12);
      if (!items.length) {
        doc.font("Regular").fontSize(9.5).fillColor("#595959").text("Збігів не знайдено.");
        continue;
      }
      items.slice(0, group.pdfLimit).forEach((mention, index) => addPdfMention(doc, mention, index + 1));
      if (items.length > group.pdfLimit) {
        doc.font("Regular").fontSize(9).fillColor("#595959").text(`Ще ${items.length - group.pdfLimit} результатів наведено у повному Excel-звіті.`);
      }
    }

    addPdfHeading(doc, "Висновок", 12);
    doc.font("Regular").fontSize(9.5).fillColor("#000000").text(
      "Звіт сформовано автоматично за результатами пошуку у відкритих джерелах. " +
      "Оцінка збігу є технічною підказкою, а не юридичним або фактичним висновком. " +
      "Для підтвердження інформації потрібно перевіряти відповідне першоджерело.",
      { align: "justify" },
    );

    const pageRange = doc.bufferedPageRange();
    for (let index = 0; index < pageRange.count; index += 1) {
      doc.switchToPage(pageRange.start + index);
      doc.font("Regular").fontSize(8).fillColor("#808080").text(
        `Person Monitor Bot | Сторінка ${index + 1} з ${pageRange.count}`,
        doc.page.margins.left, doc.page.height - 32,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "center", lineBreak: false },
      );
    }
    doc.end();
  });
  return { buffer, filename: `${safeFilePart(subject.full_name)}_${reportStamp(generatedAt)}.pdf` };
}

export async function buildReports(input) {
  const generatedAt = input.generatedAt ?? new Date();
  const common = { ...input, generatedAt };
  const [excel, pdf] = await Promise.all([buildExcelReport(common), buildPdfReport(common)]);
  return { excel, pdf };
}
