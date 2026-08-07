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
          loadSubjectGraph(subject.id, subject.full_name),
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


const GRAPH_NODE_COLORS = {
  person: "#60a5fa",
  asset: "#f59e0b",
  organization: "#34d399",
  person_observation: "#c084fc",
  organization_observation: "#fb7185",
};

let activeGraphSubjectId = null;
let activeGraphSubjectName = "";
let activeSubjectGraph = null;

function graphNodeColor(type) {
  return GRAPH_NODE_COLORS[type] ?? "#94a3b8";
}

function graphVisibleData(graph, relationType) {
  const allNodes = graph.nodes ?? [];
  const allEdges = graph.edges ?? [];

  if (!relationType) {
    return {
      nodes: allNodes,
      edges: allEdges,
    };
  }

  let edges =
    allEdges.filter(
      (edge) =>
        edge.type === relationType
    );

  if (
    relationType ===
      "third_party_rightsholder"
  ) {
    const sourceIds =
      new Set(
        edges.map(
          (edge) =>
            String(edge.source)
        )
      );

    const pathEdges =
      allEdges.filter(
        (edge) =>
          sourceIds.has(
            String(edge.target)
          ) &&
          String(edge.source) ===
            String(
              graph.subject?.entity_id
            )
      );

    const seen =
      new Set(
        edges.map(
          (edge) =>
            String(edge.id)
        )
      );

    for (const edge of pathEdges) {
      if (
        !seen.has(
          String(edge.id)
        )
      ) {
        edges.push(edge);
      }
    }
  }

  const nodeIds =
    new Set([
      String(
        graph.subject?.entity_id ?? ""
      ),
    ]);

  for (const edge of edges) {
    nodeIds.add(
      String(edge.source)
    );
    nodeIds.add(
      String(edge.target)
    );
  }

  return {
    nodes:
      allNodes.filter(
        (node) =>
          nodeIds.has(
            String(node.id)
          )
      ),
    edges,
  };
}

function graphNodePositions(nodes) {
  const width = 720;
  const height = 460;
  const positions = new Map();

  const byDepth = new Map();

  for (const node of nodes) {
    const depth =
      Number(node.depth ?? 0);

    if (!byDepth.has(depth)) {
      byDepth.set(depth, []);
    }

    byDepth.get(depth).push(node);
  }

  const depths =
    [...byDepth.keys()]
      .sort((a, b) => a - b);

  for (const depth of depths) {
    const items =
      byDepth.get(depth);

    const x =
      depths.length <= 1
        ? width / 2
        : 90 +
          (
            depth /
            Math.max(
              ...depths,
              1
            )
          ) *
            (width - 180);

    items.forEach(
      (node, index) => {
        const gap =
          height /
          (items.length + 1);

        positions.set(
          String(node.id),
          {
            x,
            y:
              gap *
              (index + 1),
          }
        );
      }
    );
  }

  return positions;
}

function showGraphNodeDetails(node) {
  const container =
    document.getElementById(
      "subject-graph-details-content"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  const title =
    document.createElement("div");

  title.style.fontSize = "20px";
  title.style.fontWeight = "700";
  title.textContent =
    node.label ?? "Без назви";

  const meta =
    document.createElement("div");

  meta.className = "label";
  meta.style.marginTop = "8px";
  meta.textContent =
    `${node.entity_type ?? "entity"}` +
    ` · depth ${node.depth ?? 0}`;

  container.append(
    title,
    meta
  );

  const entries =
    Object.entries(
      node.metadata ?? {}
    ).filter(
      ([, value]) =>
        value !== null &&
        value !== "" &&
        value !== undefined
    );

  for (
    const [key, value]
    of entries
  ) {
    const row =
      document.createElement("div");

    row.style.marginTop = "8px";

    const strong =
      document.createElement("strong");

    strong.textContent =
      `${key}: `;

    row.append(
      strong,
      document.createTextNode(
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value)
      )
    );

    container.append(row);
  }
}

function renderSubjectGraph() {
  const svg =
    document.getElementById(
      "subject-graph"
    );

  const status =
    document.getElementById(
      "subject-graph-status"
    );

  const relationSelect =
    document.getElementById(
      "graph-relation"
    );

  if (
    !svg ||
    !status ||
    !activeSubjectGraph
  ) {
    return;
  }

  const relationType =
    relationSelect?.value ?? "";

  const {
    nodes,
    edges,
  } =
    graphVisibleData(
      activeSubjectGraph,
      relationType
    );

  svg.replaceChildren();

  const positions =
    graphNodePositions(nodes);

  const namespace =
    "http://www.w3.org/2000/svg";

  for (const edge of edges) {
    const source =
      positions.get(
        String(edge.source)
      );

    const target =
      positions.get(
        String(edge.target)
      );

    if (!source || !target) {
      continue;
    }

    const line =
      document.createElementNS(
        namespace,
        "line"
      );

    line.setAttribute(
      "x1",
      source.x
    );
    line.setAttribute(
      "y1",
      source.y
    );
    line.setAttribute(
      "x2",
      target.x
    );
    line.setAttribute(
      "y2",
      target.y
    );
    line.setAttribute(
      "stroke",
      "#475569"
    );
    line.setAttribute(
      "stroke-width",
      "2"
    );

    const title =
      document.createElementNS(
        namespace,
        "title"
      );

    title.textContent =
      edge.label ??
      edge.type ??
      "Зв’язок";

    line.append(title);
    svg.append(line);
  }

  for (const node of nodes) {
    const point =
      positions.get(
        String(node.id)
      );

    if (!point) {
      continue;
    }

    const group =
      document.createElementNS(
        namespace,
        "g"
      );

    group.style.cursor = "pointer";

    const circle =
      document.createElementNS(
        namespace,
        "circle"
      );

    circle.setAttribute(
      "cx",
      point.x
    );
    circle.setAttribute(
      "cy",
      point.y
    );
    circle.setAttribute(
      "r",
      Number(node.depth) === 0
        ? "20"
        : "15"
    );
    circle.setAttribute(
      "fill",
      graphNodeColor(
        node.entity_type
      )
    );
    circle.setAttribute(
      "stroke",
      "#e2e8f0"
    );
    circle.setAttribute(
      "stroke-width",
      Number(node.depth) === 0
        ? "3"
        : "1.5"
    );

    const text =
      document.createElementNS(
        namespace,
        "text"
      );

    text.setAttribute(
      "x",
      point.x
    );
    text.setAttribute(
      "y",
      point.y + 34
    );
    text.setAttribute(
      "text-anchor",
      "middle"
    );
    text.setAttribute(
      "fill",
      "#e2e8f0"
    );
    text.setAttribute(
      "font-size",
      "11"
    );

    const label =
      String(
        node.label ?? "Без назви"
      );

    text.textContent =
      label.length > 26
        ? `${label.slice(0, 25)}…`
        : label;

    const title =
      document.createElementNS(
        namespace,
        "title"
      );

    title.textContent = label;

    group.append(
      circle,
      text,
      title
    );

    group.addEventListener(
      "click",
      () =>
        showGraphNodeDetails(node)
    );

    svg.append(group);
  }

  status.textContent =
    `Рік: ${activeSubjectGraph.year ?? "—"} · ` +
    `вузлів: ${nodes.length} · ` +
    `зв’язків: ${edges.length}`;
}

function populateGraphYears(graph) {
  const select =
    document.getElementById(
      "graph-year"
    );

  if (!select) {
    return;
  }

  select.replaceChildren();

  const years =
    graph.available_years ?? [];

  if (!years.length) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "Немає даних";
    select.append(option);
    return;
  }

  for (const year of years) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(year);

    option.textContent =
      String(year);

    if (
      Number(year) ===
      Number(graph.year)
    ) {
      option.selected = true;
    }

    select.append(option);
  }
}

async function loadSubjectGraph(
  subjectId,
  fullName,
  year = null
) {
  const section =
    document.getElementById(
      "subject-graph-section"
    );

  const title =
    document.getElementById(
      "subject-graph-title"
    );

  const status =
    document.getElementById(
      "subject-graph-status"
    );

  if (
    !section ||
    !title ||
    !status
  ) {
    return;
  }

  activeGraphSubjectId =
    subjectId;

  activeGraphSubjectName =
    fullName ?? "";

  section.style.display =
    "block";

  title.textContent =
    `Граф зв’язків: ${fullName}`;

  status.textContent =
    "Завантаження...";

  const params =
    new URLSearchParams({
      subjectId,
    });

  if (year != null && year !== "") {
    params.set(
      "year",
      String(year)
    );
  }

  try {
    const response =
      await fetch(
        `/api/subject-graph?${params.toString()}`,
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    activeSubjectGraph = data;

    populateGraphYears(data);

    const relationSelect =
      document.getElementById(
        "graph-relation"
      );

    if (relationSelect) {
      relationSelect.value = "";
    }

    const details =
      document.getElementById(
        "subject-graph-details-content"
      );

    if (details) {
      details.textContent =
        "Натисніть вузол";
    }

    renderSubjectGraph();
  } catch (error) {
    console.error(
      "Subject graph loading failed:",
      error
    );

    activeSubjectGraph = null;

    status.textContent =
      "Не вдалося завантажити граф.";
  }
}

document
  .getElementById("graph-year")
  ?.addEventListener(
    "change",
    (event) => {
      if (!activeGraphSubjectId) {
        return;
      }

      loadSubjectGraph(
        activeGraphSubjectId,
        activeGraphSubjectName,
        event.target.value
      );
    }
  );

document
  .getElementById("graph-relation")
  ?.addEventListener(
    "change",
    renderSubjectGraph
  );

loadHealth();
loadSubjects();
