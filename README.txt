WEPL Report Viewer - Quick Start
================================

Install and run (developers)
----------------------------
1) Install Node.js 22+ from https://nodejs.org/
2) Double-click START_VIEWER.bat
   - Or run: npm install && npm start
3) Open Settings to configure:
   - Local WEPL output directory
   - API data sources
   - Light / dark / system theme

Install for end users (Windows)
-------------------------------
Download the latest WEPL-Report-Viewer-Setup-*.exe from GitHub Releases
and run the installer. No Node.js or Python required.

Publishing a release
--------------------
Run the single GitHub Actions job "Release":
- Push a version tag like v1.0.0, or
- Manually dispatch the workflow from GitHub Actions

The workflow builds the Windows installer (.exe) and attaches it to a GitHub Release.

API data source contract
------------------------
Each API source uses a base URL and should expose:

GET /search?patient_id={id}&dob={YYYY-MM-DD}
  Returns JSON:
  {
    "matches": [
      {
        "scan_date": "2026-05-19",
        "folder_path": "optional/path/for/display",
        "reports": [
          { "label": "POLAR", "report_key": "polar" }
        ]
      }
    ],
    "error": "optional error message"
  }

GET /report/{patient_id}/{scan_date}/{dob}/{report_key}
  Returns HTML report content for report_key in:
  polar | cdf | hist | pdf
