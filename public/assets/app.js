const PROVIDER_LABELS = {
  "nazk-declarations": "Реєстр декларацій НАЗК",
  "nazk-corrupt-register": "Реєстр корупціонерів НАЗК",
  "court-open-data": "Судова влада України",
  "court-register": "Єдиний державний реєстр судових рішень",
  "google-news-rss": "Google News",
  "google-web": "Google",
  "official-sites": "Офіційні сайти",
  prozorro: "Prozorro",
};

const PAGE_SIZE = 20;

let activeMentions = [];
let visibleMentions = PAGE_SIZE;

function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? provider ?? "Інше джерело";
}

function parseMentionTimestamp(value) {
  if (!value) {
    return 0;
  }

  const ukrainianDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);

  if (ukrainianDate) {
    const [, day, month, year] = ukrainianDate;

    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatMentionDate(value) {
  if (!value) {
    return "";
  }

  const timestamp = parseMentionTimestamp(value);

  if (!timestamp) {
    return value;
  }

  return new Date(timestamp).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function loadHealth() {
  const status = document.getElementById("status");
  const dot = document.getElementById("dot");
  const subjects = document.getElementById("subjects");
  const mentions = document.getElementById("mentions");

  try {
    const response = await fetch("/api/health", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    subjects.textContent = String(data.subjects ?? 0);
    mentions.textContent = String(data.mentions ?? 0);
    status.textContent = "Сервіс працює";
    dot.classList.add("ok");
  } catch (error) {
    console.error("Health check failed:", error);
    status.textContent = "Сервіс недоступний";
    status.classList.add("error");
    dot.classList.remove("ok");
  }
}

async function loadSubjects() {
  const container = document.getElementById("subjects-list");

  try {
    const response = await fetch("/api/subjects", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    container.replaceChildren();

    for (const subject of data.subjects ?? []) {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "16px";
      card.style.cursor = "pointer";

      const name = document.createElement("div");
      name.className = "value";
      name.style.fontSize = "22px";
      name.textContent = subject.full_name ?? "Без ПІБ";

      const organization = document.createElement("div");
      organization.className = "label";
      organization.style.marginTop = "12px";
      organization.textContent =
        subject.organization ?? "Організацію не вказано";

      const position = document.createElement("div");
      position.textContent =
        subject.position ?? "Посаду не вказано";

      const city = document.createElement("div");
      city.className = "label";
      city.style.marginTop = "8px";
      city.textContent = subject.city ?? "";

      const count = document.createElement("div");
      count.className = "label";
      count.style.marginTop = "10px";
      count.textContent = `Згадок: ${subject.mention_count ?? 0}`;

      card.append(name, organization, position, city, count);

      card.addEventListener("click", async () => {
        await Promise.all([
          loadSubjectStats(subject.id, subject.full_name),
          loadMentions(subject.id, subject.full_name),
        ]);

        document
          .getElementById("subject-stats-section")
          .scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      });

      container.append(card);
    }
  } catch (error) {
    console.error("Subjects loading failed:", error);
    container.textContent = "Не вдалося завантажити суб’єктів.";
  }
}

function formatPortalDateTime(value) {
  if (!value) {
    return "Ще не перевірявся";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadSubjectStats(subjectId, fullName) {
  const section =
    document.getElementById("subject-stats-section");

  const title =
    document.getElementById("subject-stats-title");

  const lastChecked =
    document.getElementById("subject-last-checked");

  const scanned =
    document.getElementById("subject-scanned");

  const threshold =
    document.getElementById("subject-threshold");

  const confirmed =
    document.getElementById("subject-confirmed");

  const providers =
    document.getElementById("subject-provider-stats");

  section.style.display = "block";
  title.textContent = `Огляд: ${fullName}`;
  providers.textContent = "Завантаження...";

  try {
    const response = await fetch(
      `/api/subject-stats?subjectId=${encodeURIComponent(subjectId)}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    lastChecked.textContent =
      formatPortalDateTime(data.subject.last_checked_at);

    scanned.textContent =
      String(data.subject.last_scanned_count ?? 0);

    threshold.textContent =
      `${data.subject.match_threshold ?? 0}%`;

    confirmed.textContent =
      `${data.summary.confirmed ?? 0} із ${data.summary.mentions ?? 0}`;

    providers.replaceChildren();

    if (!data.providers?.length) {
      providers.textContent =
        "Збережених згадок поки немає.";
      return;
    }

    for (const item of data.providers) {
      const row = document.createElement("div");

      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.gap = "16px";
      row.style.padding = "10px 0";
      row.style.borderBottom = "1px solid #252b36";

      const name = document.createElement("span");
      name.textContent = providerLabel(item.provider);

      const value = document.createElement("strong");
      value.textContent =
        `${item.mentions} · підтверджено ${item.confirmed}`;

      row.append(name, value);
      providers.append(row);
    }
  } catch (error) {
    console.error("Subject statistics loading failed:", error);

    providers.textContent =
      "Не вдалося завантажити статистику.";
  }
}

function renderMentions() {
  const container = document.getElementById("mentions-list");
  const search = document
    .getElementById("mentions-search")
    .value.trim()
    .toLowerCase();

  const provider =
    document.getElementById("mentions-provider").value;

  const sort =
    document.getElementById("mentions-sort").value;

  const count =
    document.getElementById("mentions-count");

  const moreButton =
    document.getElementById("mentions-more");

  const filtered = activeMentions
    .filter((mention) => {
      const matchesProvider =
        !provider || mention.provider === provider;

      const haystack = [
        mention.title,
        mention.snippet,
        mention.source,
        providerLabel(mention.provider),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search || haystack.includes(search);

      return matchesProvider && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === "oldest") {
        return (
          parseMentionTimestamp(a.published_at) -
          parseMentionTimestamp(b.published_at)
        );
      }

      if (sort === "score") {
        return (
          Number(b.match_score ?? 0) -
          Number(a.match_score ?? 0)
        );
      }

      return (
        parseMentionTimestamp(b.published_at) -
        parseMentionTimestamp(a.published_at)
      );
    });

  const visible = filtered.slice(0, visibleMentions);

  count.textContent =
    `Показано: ${visible.length} із ${filtered.length}` +
    (filtered.length !== activeMentions.length
      ? ` · Усього: ${activeMentions.length}`
      : "");

  container.replaceChildren();

  if (!filtered.length) {
    container.textContent = activeMentions.length
      ? "За вибраними параметрами нічого не знайдено."
      : "Згадок поки не знайдено.";

    moreButton.style.display = "none";
    return;
  }

  for (const mention of visible) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "16px";

    const source = document.createElement("div");
    source.className = "label";
    source.textContent =
      mention.source ||
      providerLabel(mention.provider);

    const link = document.createElement("a");

    const publicUrl =
      mention.provider === "nazk-declarations"
        ? mention.url.replace(
            "https://public-api.nazk.gov.ua/v2/documents/",
            "https://public.nazk.gov.ua/documents/"
          )
        : mention.url;

    link.href = publicUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent =
      mention.title || mention.url;
    link.style.color = "inherit";
    link.style.fontSize = "18px";
    link.style.fontWeight = "700";

    card.append(source, link);

    if (mention.snippet) {
      const snippet = document.createElement("div");
      snippet.style.marginTop = "12px";
      snippet.textContent = mention.snippet;
      card.append(snippet);
    }

    const meta = document.createElement("div");
    meta.className = "label";
    meta.style.marginTop = "12px";

    const parts = [];

    if (mention.match_score != null) {
      parts.push(`Збіг: ${mention.match_score}%`);
    }

    if (mention.published_at) {
      parts.push(
        `Дата: ${formatMentionDate(mention.published_at)}`
      );
    }

    meta.textContent = parts.join(" · ");
    card.append(meta);

    container.append(card);
  }

  moreButton.style.display =
    visible.length < filtered.length
      ? "block"
      : "none";
}

function resetMentionPage() {
  visibleMentions = PAGE_SIZE;
  renderMentions();
}

async function loadMentions(subjectId, fullName) {
  const section =
    document.getElementById("mentions-section");

  const title =
    document.getElementById("mentions-title");

  const container =
    document.getElementById("mentions-list");

  const search =
    document.getElementById("mentions-search");

  const providerSelect =
    document.getElementById("mentions-provider");

  const sortSelect =
    document.getElementById("mentions-sort");

  const moreButton =
    document.getElementById("mentions-more");

  const excelReport =
    document.getElementById("excel-report");

  excelReport.href =
    `/api/report-excel?subjectId=${encodeURIComponent(subjectId)}`;

  excelReport.style.display = "inline-block";

  section.style.display = "block";
  title.textContent = `Згадки: ${fullName}`;
  container.textContent = "Завантаження...";

  search.value = "";
  sortSelect.value = "newest";
  visibleMentions = PAGE_SIZE;
  moreButton.style.display = "none";

  try {
    const response = await fetch(
      `/api/mentions?subjectId=${encodeURIComponent(subjectId)}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    activeMentions = data.mentions ?? [];

    const providers = [
      ...new Set(
        activeMentions
          .map((item) => item.provider)
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      providerLabel(a).localeCompare(
        providerLabel(b),
        "uk"
      )
    );

    providerSelect.replaceChildren();

    const allOption =
      document.createElement("option");

    allOption.value = "";
    allOption.textContent = "Усі джерела";
    providerSelect.append(allOption);

    for (const provider of providers) {
      const option =
        document.createElement("option");

      option.value = provider;
      option.textContent = providerLabel(provider);
      providerSelect.append(option);
    }

    renderMentions();

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Mentions loading failed:", error);
    activeMentions = [];
    container.textContent =
      "Не вдалося завантажити згадки.";
  }
}

document
  .getElementById("mentions-search")
  .addEventListener("input", resetMentionPage);

document
  .getElementById("mentions-provider")
  .addEventListener("change", resetMentionPage);

document
  .getElementById("mentions-sort")
  .addEventListener("change", resetMentionPage);

document
  .getElementById("mentions-more")
  .addEventListener("click", () => {
    visibleMentions += PAGE_SIZE;
    renderMentions();
  });

loadHealth();
loadSubjects();
