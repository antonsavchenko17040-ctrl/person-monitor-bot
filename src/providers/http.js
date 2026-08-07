export async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = Number(options.timeoutMs ?? 20_000);
  const timer = setTimeout(() => controller.abort(), timeout);
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "user-agent": "PersonMonitorBotLocal/1.1 (public-information-monitoring)",
        ...(fetchOptions.headers ?? {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Відповідь джерела не є коректним JSON");
  }
}
