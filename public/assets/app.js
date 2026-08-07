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
    status.textContent = "Service online";
    dot.classList.add("ok");
  } catch (error) {
    console.error("Health check failed:", error);
    status.textContent = "Service unavailable";
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
      organization.textContent = subject.organization ?? "Організацію не вказано";

      const position = document.createElement("div");
      position.textContent = subject.position ?? "Посаду не вказано";

      const city = document.createElement("div");
      city.className = "label";
      city.style.marginTop = "8px";
      city.textContent = subject.city ?? "";

      const count = document.createElement("div");
      count.className = "label";
      count.style.marginTop = "10px";
      count.textContent = `Згадок: ${subject.mention_count ?? 0}`;

      card.append(name, organization, position, city, count);

      card.addEventListener("click", () => {
        loadMentions(subject.id, subject.full_name);
      });

      container.append(card);
    }
  } catch (error) {
    console.error("Subjects loading failed:", error);
    container.textContent = "Не вдалося завантажити суб’єктів.";
  }
}

async function loadMentions(subjectId, fullName) {
  const section = document.getElementById("mentions-section");
  const title = document.getElementById("mentions-title");
  const container = document.getElementById("mentions-list");

  section.style.display = "block";
  title.textContent = `Згадки: ${fullName}`;
  container.textContent = "Завантаження...";

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

    container.replaceChildren();

    if (!data.mentions?.length) {
      container.textContent = "Згадок поки не знайдено.";
      return;
    }

    for (const mention of data.mentions) {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "16px";

      const source = document.createElement("div");
      source.className = "label";
      source.textContent = mention.source || mention.provider || "Джерело";

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
      link.textContent = mention.title || mention.url;
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
        const parsedDate = new Date(mention.published_at);

        const formattedDate = Number.isNaN(parsedDate.getTime())
          ? mention.published_at
          : parsedDate.toLocaleDateString("uk-UA", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });

        parts.push(`Дата: ${formattedDate}`);
      }

      meta.textContent = parts.join(" · ");
      card.append(meta);

      container.append(card);
    }

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Mentions loading failed:", error);
    container.textContent = "Не вдалося завантажити згадки.";
  }
}

loadHealth();
loadSubjects();
