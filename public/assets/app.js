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

      card.append(name, organization, position, city);
      container.append(card);
    }
  } catch (error) {
    console.error("Subjects loading failed:", error);
    container.textContent = "Не вдалося завантажити суб’єктів.";
  }
}

loadHealth();
loadSubjects();
