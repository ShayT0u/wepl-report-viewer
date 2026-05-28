function resolveTheme(theme) {
  if (theme === "dark" || theme === "light") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

async function initTheme() {
  if (!window.weplViewer) {
    applyTheme("system");
    return;
  }

  const settings = await window.weplViewer.getSettings();
  applyTheme(settings.theme);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    window.weplViewer.getSettings().then((latest) => applyTheme(latest.theme));
  });
}

initTheme();
