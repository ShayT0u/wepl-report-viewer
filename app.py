from datetime import datetime
from pathlib import Path
import re

from flask import Flask, abort, render_template, request, send_file, url_for

app = Flask(__name__)


def load_output_dir() -> Path:
    """
    Read report folder path from config.txt (same folder as app.py).

    On a new computer, the other person only edits config.txt — not this code.
    """
    config_file = Path(__file__).resolve().parent / "config.txt"
    if config_file.exists():
        line = config_file.read_text(encoding="utf-8").strip()
        if line:
            return Path(line)
    # Fallback if config.txt is missing or empty.
    return Path(r"E:\WEPLAnalyzer\output")


# Base folder where WEPL Analyzer writes reports.
# IMPORTANT ASSUMPTION:
# - patient folder (example: 25285) is patient ID
# - next folder (example: 2026-05-19) is scan/processing date
# - final folder (example: 2026-05-05) is patient DOB
# - report files are inside that final DOB folder
BASE_OUTPUT_DIR = load_output_dir()

# Only these exact report files are allowed.
ALLOWED_REPORTS = {
    "polar": "wepl_polar.html",
    "cdf": "wepl_cdf.html",
    "hist": "wepl_hist.html",
    "pdf": "wepl_pdf.html",
}

PATIENT_ID_RE = re.compile(r"^\d+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def is_valid_date(date_str: str) -> bool:
    """Return True if string is a real date in YYYY-MM-DD format."""
    if not DATE_RE.match(date_str):
        return False
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def safe_path_under_base(*parts: str) -> Path:
    """
    Build a path under BASE_OUTPUT_DIR and block path traversal.

    If the resolved path is not inside BASE_OUTPUT_DIR, abort.
    """
    base_resolved = BASE_OUTPUT_DIR.resolve()
    candidate = BASE_OUTPUT_DIR.joinpath(*parts).resolve()

    try:
        candidate.relative_to(base_resolved)
    except ValueError:
        abort(404, description="Invalid path requested.")

    return candidate


@app.route("/", methods=["GET"])
def index():
    """Show main search page."""
    return render_template("index.html")


@app.route("/search", methods=["POST"])
def search():
    """Search for matching patient + DOB folders and list report links."""
    patient_id = request.form.get("patient_id", "").strip()
    dob = request.form.get("dob", "").strip()

    # User-friendly input validation.
    if not patient_id or not dob:
        return render_template(
            "results.html",
            error="Missing input: please enter both Patient ID and DOB.",
            patient_id=patient_id,
            dob=dob,
            matches=[],
        )

    if not PATIENT_ID_RE.match(patient_id):
        return render_template(
            "results.html",
            error="Patient ID must contain digits only.",
            patient_id=patient_id,
            dob=dob,
            matches=[],
        )

    if not is_valid_date(dob):
        return render_template(
            "results.html",
            error="DOB must be a valid date in YYYY-MM-DD format.",
            patient_id=patient_id,
            dob=dob,
            matches=[],
        )

    patient_dir = safe_path_under_base(patient_id)

    if not patient_dir.exists() or not patient_dir.is_dir():
        return render_template(
            "results.html",
            error=f"Patient folder not found for ID {patient_id}.",
            patient_id=patient_id,
            dob=dob,
            matches=[],
        )

    matches = []
    dob_folder_found = False
    reports_found = 0

    # Search all scan/processing date folders for this patient.
    for scan_dir in sorted(patient_dir.iterdir()):
        if not scan_dir.is_dir():
            continue

        # Keep this strict so weird folders do not get treated as dates.
        if not is_valid_date(scan_dir.name):
            continue

        dob_dir = safe_path_under_base(patient_id, scan_dir.name, dob)
        if not dob_dir.exists() or not dob_dir.is_dir():
            continue

        dob_folder_found = True
        available_reports = []

        for report_key, filename in ALLOWED_REPORTS.items():
            report_path = dob_dir / filename
            if report_path.exists() and report_path.is_file():
                available_reports.append(
                    {
                        "label": report_key.upper(),
                        "url": url_for(
                            "serve_report",
                            patient_id=patient_id,
                            scan_date=scan_dir.name,
                            dob=dob,
                            report_key=report_key,
                        ),
                    }
                )

        reports_found += len(available_reports)
        matches.append(
            {
                "scan_date": scan_dir.name,
                "folder_path": str(dob_dir),
                "reports": available_reports,
            }
        )

    if not dob_folder_found:
        return render_template(
            "results.html",
            error=f"No matching DOB/report folders found for DOB {dob}.",
            patient_id=patient_id,
            dob=dob,
            matches=[],
        )

    if reports_found == 0:
        return render_template(
            "results.html",
            error="DOB folder(s) found, but no expected report files were found.",
            patient_id=patient_id,
            dob=dob,
            matches=matches,
        )

    return render_template(
        "results.html",
        error=None,
        patient_id=patient_id,
        dob=dob,
        matches=matches,
    )


@app.route("/report/<patient_id>/<scan_date>/<dob>/<report_key>", methods=["GET"])
def serve_report(patient_id: str, scan_date: str, dob: str, report_key: str):
    """Serve only whitelisted report files from validated paths."""
    if not PATIENT_ID_RE.match(patient_id):
        abort(404, description="Invalid patient ID.")
    if not is_valid_date(scan_date):
        abort(404, description="Invalid scan date.")
    if not is_valid_date(dob):
        abort(404, description="Invalid DOB.")
    if report_key not in ALLOWED_REPORTS:
        abort(404, description="Invalid report type.")

    filename = ALLOWED_REPORTS[report_key]
    report_path = safe_path_under_base(patient_id, scan_date, dob, filename)

    if not report_path.exists() or not report_path.is_file():
        abort(404, description="Report file not found.")

    # as_attachment=False opens HTML in browser tab.
    return send_file(report_path, as_attachment=False)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
