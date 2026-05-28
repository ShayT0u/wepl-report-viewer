const themeSelect = document.getElementById("theme");
const localDirectoryInput = document.getElementById("local-directory");
const apiList = document.getElementById("api-list");
const apiNameInput = document.getElementById("api-name");
const apiUrlInput = document.getElementById("api-url");
const settingsStatus = document.getElementById("settings-status");

let currentSettings = null;

function setStatus(message, isError = false) {
  settingsStatus.textContent = message;
  settingsStatus.style.color = isError ? "var(--danger)" : "var(--success)";
}

function createField(labelText, fieldElement) {
  const wrapper = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = labelText;
  wrapper.append(label, fieldElement);
  return wrapper;
}

function buildApiItem(source) {
  const item = document.createElement("div");
  item.className = "api-item stack";
  item.dataset.id = source.id;

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.dataset.field = "name";
  nameInput.value = source.name;

  const enabledSelect = document.createElement("select");
  enabledSelect.dataset.field = "enabled";

  const enabledOption = document.createElement("option");
  enabledOption.value = "true";
  enabledOption.textContent = "Enabled";
  enabledOption.selected = source.enabled;

  const disabledOption = document.createElement("option");
  disabledOption.value = "false";
  disabledOption.textContent = "Disabled";
  disabledOption.selected = !source.enabled;

  enabledSelect.append(enabledOption, disabledOption);

  const nameRow = document.createElement("div");
  nameRow.className = "inline-fields two-col";
  nameRow.append(
    createField("Name", nameInput),
    createField("Enabled", enabledSelect)
  );

  const baseUrlInput = document.createElement("input");
  baseUrlInput.type = "url";
  baseUrlInput.dataset.field = "baseUrl";
  baseUrlInput.value = source.baseUrl;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "danger";
  removeButton.dataset.action = "remove";
  removeButton.textContent = "Remove";

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";
  buttonRow.appendChild(removeButton);

  item.append(
    nameRow,
    createField("Base URL", baseUrlInput),
    buttonRow
  );

  return item;
}

function renderApiSources(apiSources) {
  apiList.innerHTML = "";

  if (apiSources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No API sources configured yet.";
    apiList.appendChild(empty);
    return;
  }

  for (const source of apiSources) {
    apiList.appendChild(buildApiItem(source));
  }
}

async function loadSettings() {
  currentSettings = await window.weplViewer.getSettings();
  themeSelect.value = currentSettings.theme;
  localDirectoryInput.value = currentSettings.localDataDirectory;
  renderApiSources(currentSettings.apiSources);
  document.documentElement.dataset.theme =
    currentSettings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : currentSettings.theme;
}

document.getElementById("browse-directory").addEventListener("click", async () => {
  const selected = await window.weplViewer.pickDirectory();
  if (selected) {
    localDirectoryInput.value = selected;
  }
});

document.getElementById("add-api").addEventListener("click", async () => {
  const name = apiNameInput.value.trim();
  const baseUrl = apiUrlInput.value.trim();

  if (!name || !baseUrl) {
    setStatus("Enter both a name and base URL before adding an API source.", true);
    return;
  }

  currentSettings = await window.weplViewer.addApiSource({ name, baseUrl, enabled: true });
  apiNameInput.value = "";
  apiUrlInput.value = "";
  renderApiSources(currentSettings.apiSources);
  setStatus("API source added. Click Save Settings to persist all changes.");
});

apiList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='remove']");
  if (!button) {
    return;
  }

  const item = button.closest(".api-item");
  const id = item.dataset.id;
  currentSettings = await window.weplViewer.removeApiSource(id);
  renderApiSources(currentSettings.apiSources);
  setStatus("API source removed.");
});

document.getElementById("save-settings").addEventListener("click", async () => {
  const apiSources = [...apiList.querySelectorAll(".api-item")].map((item) => ({
    id: item.dataset.id,
    enabled: item.querySelector("[data-field='enabled']").value === "true",
    name: item.querySelector("[data-field='name']").value.trim(),
    baseUrl: item.querySelector("[data-field='baseUrl']").value.trim(),
  }));

  for (const source of apiSources) {
    await window.weplViewer.updateApiSource(source);
  }

  currentSettings = await window.weplViewer.updateSettings({
    theme: themeSelect.value,
    localDataDirectory: localDirectoryInput.value.trim(),
  });

  document.documentElement.dataset.theme =
    currentSettings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : currentSettings.theme;

  setStatus("Settings saved.");
});

loadSettings();
