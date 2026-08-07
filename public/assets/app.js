async function loadHealth() {
  const status = document.getElementById("status");
  const dot = document.getElementById("dot");
  const subjects = document.getElementById("subjects");
  const mentions = document.getElementById("mentions");

  try {
    const response = await fetch("/api/health", {
      headers: {
        Accept: "application/json",
      },
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

loadHealth();
