const searchPanel = document.getElementById("search-panel");
const resultsPanel = document.getElementById("results-panel");
const reportPanel = document.getElementById("report-panel");
const searchForm = document.getElementById("search-form");
const resultsError = document.getElementById("results-error");
const resultsList = document.getElementById("results-list");
const resultsTitle = document.getElementById("results-title");
const resultsChips = document.getElementById("results-chips");
const reportFrame = document.getElementById("report-frame");
const reportTitle = document.getElementById("report-title");
const reportMeta = document.getElementById("report-meta");

function showPanel(panel) {
  searchPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  reportPanel.classList.add("hidden");
  panel.classList.remove("hidden");
}

function showFailure(message) {
  resultsList.innerHTML = "";
  resultsChips.innerHTML = "";
  resultsError.textContent = message;
  resultsError.classList.remove("hidden");
  showPanel(resultsPanel);
}

function makeChip(label, value) {
  const chip = document.createElement("span");
  chip.className = "chip";
  const strong = document.createElement("strong");
  strong.textContent = label;
  const span = document.createElement("span");
  span.textContent = value;
  chip.append(strong, document.createTextNode(" "), span);
  return chip;
}

function makeLabeledLine(label, value, className) {
  const line = document.createElement("p");
  if (className) {
    line.className = className;
  }
  const strong = document.createElement("strong");
  strong.textContent = `${label}:`;
  line.append(strong, document.createTextNode(` ${value}`));
  return line;
}

function renderResults(result, { listMode = false } = {}) {
  resultsList.innerHTML = "";
  resultsChips.innerHTML = "";

  if (result.error) {
    resultsError.textContent = result.error;
    resultsError.classList.remove("hidden");
  } else {
    resultsError.classList.add("hidden");
  }

  const matches = result.matches || [];

  if (listMode) {
    resultsTitle.textContent = "All Reports";
    if (matches.length > 0) {
      const reportCount = matches.reduce(
        (total, match) => total + match.reports.length,
        0
      );
      resultsChips.appendChild(makeChip("Folders", String(matches.length)));
      resultsChips.appendChild(makeChip("Reports", String(reportCount)));
    }
  } else {
    resultsTitle.textContent = "Search Results";
    resultsChips.appendChild(makeChip("Patient", result.patientId));
    resultsChips.appendChild(makeChip("DOB", result.dob));
  }

  if (matches.length === 0) {
    if (!result.error) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>No reports found.</p>`;
      resultsList.appendChild(empty);
    }
    showPanel(resultsPanel);
    return;
  }

  for (const match of matches) {
    resultsList.appendChild(buildMatchCard(match, listMode));
  }

  showPanel(resultsPanel);
}

function buildMatchCard(match, listMode) {
  const card = document.createElement("article");
  card.className = "match-card";

  const sourceBadge = document.createElement("span");
  sourceBadge.className = "source-badge";
  sourceBadge.textContent = match.sourceName;
  card.appendChild(sourceBadge);

  if (listMode) {
    const patientLine = document.createElement("p");
    const patientLabel = document.createElement("strong");
    patientLabel.textContent = "Patient:";
    const dobLabel = document.createElement("strong");
    dobLabel.textContent = "DOB:";
    patientLine.append(
      patientLabel,
      document.createTextNode(` ${match.patientId} · `),
      dobLabel,
      document.createTextNode(` ${match.dob}`)
    );
    card.appendChild(patientLine);
  }

  card.appendChild(
    makeLabeledLine("Scan / Processing Date", match.scanDate)
  );
  card.appendChild(
    makeLabeledLine("Matched Folder", match.folderPath, "match-meta")
  );

  if (match.reports.length === 0) {
    const empty = document.createElement("p");
    empty.className = "match-meta";
    empty.textContent = "No report files found in this matched folder.";
    card.appendChild(empty);
    return card;
  }

  const links = document.createElement("div");
  links.className = "report-links";

  for (const report of match.reports) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span></span>`;
    button.querySelector("span").textContent = `${report.label} Report`;
    button.addEventListener("click", () => openReport(match, report));
    links.appendChild(button);
  }

  card.appendChild(links);
  return card;
}

async function openReport(match, report) {
  const payload = {
    sourceId: report.sourceId,
    patientId: match.patientId,
    scanDate: match.scanDate,
    dob: match.dob,
    reportKey: report.reportKey,
  };

  const content = await window.weplViewer.getReport(payload);
  if (!content?.id) {
    resultsError.textContent = "Could not load the selected report.";
    resultsError.classList.remove("hidden");
    showPanel(resultsPanel);
    return;
  }

  reportTitle.textContent = `${report.label} Report`;
  reportMeta.textContent = `${content.sourceName} · Patient ${match.patientId} · Scan ${match.scanDate}`;
  reportFrame.src = `wepl-report://${content.id}`;
  showPanel(reportPanel);
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const patientId = document.getElementById("patient_id").value.trim();
  const dob = document.getElementById("dob").value.trim();

  try {
    const result = await window.weplViewer.searchReports(patientId, dob);
    renderResults(result, { listMode: false });
  } catch (error) {
    showFailure(`Search failed: ${error?.message ?? error}`);
  }
});

document.getElementById("browse-all").addEventListener("click", async () => {
  if (!window.weplViewer || typeof window.weplViewer.listAllReports !== "function") {
    showFailure("Browse is unavailable. Please restart the application.");
    return;
  }

  try {
    const result = await window.weplViewer.listAllReports();
    renderResults(result, { listMode: true });
  } catch (error) {
    showFailure(`Could not list reports: ${error?.message ?? error}`);
  }
});

document.getElementById("back-to-search").addEventListener("click", () => {
  showPanel(searchPanel);
});

document.getElementById("back-to-results").addEventListener("click", () => {
  reportFrame.src = "about:blank";
  showPanel(resultsPanel);
});
