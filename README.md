# DOKUTRA - Document Tracking System
**Kantor Kementerian Agama Kota Metro**

DOKUTRA is an internal document tracking web application specifically crafted for **Kantor Kementerian Agama (Kemenag) Kota Metro**. It solves the problem of misplaced or untracked physical paperwork (incoming letters, outgoing letters, proposals, and dispositions) moving across different administrative sections.

The application features a responsive, mobile-first design tailored for **phone webviews** (Android & iOS) and desktop browsers, styled with the official **Kemenag Green** identity, complete with light/dark mode support and an interactive flow diagram.

---

## Key Features

1. **Multi-User PIC Access & Persistent Sessions:**
   - Dedicated PIC accounts for each of the 11 office sections.
   - Simplified login interface with support for device credential saving (`autocomplete` & "Remember Me").
   - 6-hour persistent HTTP-only cookie sessions so staff can work an entire shift without re-authenticating.

2. **Indonesian UI & Office Conventions:**
   - The user-facing interface, status labels, and database records use standard Indonesian terminology (`Diterima`, `Menunggu`, `Ditolak`, `Diteruskan`, `Biasa`, `Penting`, `Rahasia`).
   - The backend codebase, API architecture, and developer documentation are written in clean English.

3. **Smart Routing Engine:**
   - Documents bound for **Kasubbag Tata Usaha** automatically route through **Humas Protokol** as a transit bridge (`Origin -> Humas Protokol -> Kasubbag TU`).
   - Documents bound for **Kepala Kantor** automatically route through **Humas Protokol** and require review by **Kasubbag Tata Usaha** before reaching Kepala Kantor (`Origin -> Humas Protokol -> Kasubbag TU -> Kepala Kantor`).
   - **Humas Protokol** is hidden from the manual target dropdown to prevent confusion, acting automatically as the system-controlled intermediary.

4. **Interactive Location Diagrams:**
   - **Focused View (Default):** Displays only the sections involved in the active document's path (origin, past stops, current location, and scheduled destinations), keeping mobile screens uncluttered.
   - **All Sections View (Read-Only):** A one-click toggle to inspect all 11 sections and view all documents across the entire office.

5. **Auto-Receive & Big Incoming Document Notification:**
   - Documents forwarded to a section are automatically received (`Diterima`) at the destination section.
   - A prominent notification card appears at the top of the dashboard whenever incoming documents are awaiting review at the logged-in section.
   - One-click review with a slim single-line `Riwayat Perjalanan Dokumen` log list and options to set notes and update status to **Ditolak**, **Menunggu**, or **Teruskan**.

---

## Office Sections (11 Units)

| Code | Section Name | Role |
| :--- | :--- | :--- |
| `PTSP` | Pelayanan Terpadu Satu Pintu | Primary gateway for external incoming letters |
| `KEPEGAWAIAN` | Kepegawaian | Staffing/HR section; primary originator of outgoing letters |
| `PENMAD` | Pendidikan Madrasah | Madrasah school and teacher administration |
| `BIMAS_ISLAM` | Bimbingan Masyarakat Islam | Guidance for Islamic communities, instructors, and KUA |
| `PAPKI` | PAPKI | Islamic boarding schools (*ponpes*) & non-madrasah PAI |
| `KATOLIK` | Penyelenggara Katolik | Catholic and non-Muslim community services |
| `ZAKAT_WAKAF` | Penyelenggara Zakat Wakaf | Zakat, wakaf, infaq, and sedekah administration |
| `KEUANGAN` | Perencana Keuangan | Budget planning, accounting, and treasury |
| `KASUBBAG` | Kasubbag Tata Usaha | Administrative approval and supervision |
| `KEPALA` | Kepala Kantor | Head of Office; final approval and disposition |
| `HUMAS` | Humas Protokol | Public relations & administrative transit bridge |

---

## Tech Stack

- **Backend:** Node.js, Express.js (English codebase)
- **Database:** Local SQLite3 (`dokutra.sqlite`) with WAL mode
- **Session:** `express-session` with 6-hour expiration and cookie persistence
- **Frontend:** Responsive HTML5, CSS Variables (Kemenag Green `#006837`, Dark/Light Mode), Vanilla JavaScript
- **Deployment Target:** Phone Webview (Android/iOS) and Modern Web Browsers

---

## Getting Started

### Prerequisites
- Node.js (v18.x or newer recommended)
- npm (v9.x or newer)

### Installation
1. Clone or navigate to the project directory:
   ```bash
   cd /Users/emenace/Documents/Apps/dokutra
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. Open your browser or phone webview at:
   ```
   http://localhost:3000
   ```

---

## Documentation Index

- [PRD.md](PRD.md) - Product Requirements Document.
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture and routing engine specifications.
- [DATABASE_MODEL.md](DATABASE_MODEL.md) - SQLite schema, tables, and Indonesian entity relationships.
- [AGENT.md](AGENT.md) - Guidelines and business rules for AI agents and developers.
- [part.md](part.md) - Phased development plan divided into 5 partitions for progressive monitoring.
