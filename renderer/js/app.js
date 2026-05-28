const searchPanel = document.getElementById("search-panel");
const resultsPanel = document.getElementById("results-panel");
const reportPanel = document.getElementById("report-panel");
const searchForm = document.getElementById("search-form");
const resultsError = document.getElementById("results-error");
const resultsList = document.getElementById("results-list");
const resultPatientId = document.getElementById("result-patient-id");
const resultDob = document.getElementById("result-dob");
const reportFrame = document.getElementById("report-frame");
const reportTitle = document.getElementById("report-title");
const reportMeta = document.getElementById("report-meta");

let lastSearch = { patientId: "", dob: "" };

function showPanel(panel) {
  searchPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  reportPanel.classList.add("hidden");
  panel.classList.remove("hidden");
}

function renderResults(result) {
  resultPatientId.textContent = result.patientId;
  resultDob.textContent = result.dob;
  resultsList.innerHTML = "";

  if (result.error) {
    resultsError.textContent = result.error;
    resultsError.classList.remove("hidden");
  } else {
    resultsError.classList.add("hidden");
  }

  if (!result.matches || result.matches.length === 0) {
    showPanel(resultsPanel);
    return;
  }

  for (const match of result.matches) {
    const card = document.createElement("article");
    card.className = "card match-card";

    const sourceBadge = document.createElement("span");
    sourceBadge.className = "source-badge";
    sourceBadge.textContent = match.sourceName;

    const heading = document.createElement("p");
    heading.innerHTML = `<strong>Scan/Processing Date:</strong> ${match.scanDate}`;

    const folder = document.createElement("p");
    folder.className = "match-meta";
    folder.innerHTML = `<strong>Matched Folder:</strong> ${match.folderPath}`;

    const links = document.createElement("div");
    links.className = "report-links";

    if (match.reports.length === 0) {
      const empty = document.createElement("p");
      empty.className = "match-meta";
      empty.textContent = "No report files found in this matched folder.";
      card.append(sourceBadge, heading, folder, empty);
    } else {
      for (const report of match.reports) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${report.label} Report`;
        button.addEventListener("click", () => openReport(match, report));
        links.appendChild(button);
      }
      card.append(sourceBadge, heading, folder, links);
    }

    resultsList.appendChild(card);
  }

  showPanel(resultsPanel);
}

async function openReport(match, report) {
  const payload = {
    sourceId: report.sourceId,
    patientId: lastSearch.patientId,
    scanDate: match.scanDate,
    dob: lastSearch.dob,
    reportKey: report.reportKey,
  };

  const content = await window.weplViewer.getReport(payload);
  if (!content) {
    resultsError.textContent = "Could not load the selected report.";
    resultsError.classList.remove("hidden");
    showPanel(resultsPanel);
    return;
  }

  reportTitle.textContent = `${report.label} Report`;
  reportMeta.textContent = `${report.sourceName} · Scan ${match.scanDate}`;
  reportFrame.srcdoc = content.content;
  showPanel(reportPanel);
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const patientId = document.getElementById("patient_id").value.trim();
  const dob = document.getElementById("dob").value.trim();
  lastSearch = { patientId, dob };

  const result = await window.weplViewer.searchReports(patientId, dob);
  renderResults(result);
});

document.getElementById("back-to-search").addEventListener("click", () => {
  showPanel(searchPanel);
});

document.getElementById("back-to-results").addEventListener("click", () => {
  reportFrame.srcdoc = "";
  showPanel(resultsPanel);
});
