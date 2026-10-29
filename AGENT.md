# AGENT.md - Development Rules & Guidelines for DOKUTRA
**Kantor Kementerian Agama Kota Metro Document Tracking Application**

This document serves as the primary technical specification and operational instruction for AI coding agents and human developers building, testing, or maintaining the DOKUTRA application.

---

## 1. Core Principles & Language Conventions
1. **User Interface (UI):** **100% Indonesian Language**.
   - All labels, buttons, dialogs, status badges, notifications, error messages, and form placeholders displayed to end users must be in clear, polite, standard Indonesian.
2. **Database Models & Enums:** **Indonesian Domain Terms**.
   - Model table names, status enums (`DIBUAT`, `DITERUSKAN`, `DITERIMA`, `DIPROSES`), classifications (`Biasa`, `Penting`, `Rahasia`), and section names follow the official office vocabulary.
3. **Backend & Architecture Code:** **100% English**.
   - All code logic, variable names, function names, classes, internal comments, route names, controllers, and documentation markdown files must be written in English.
4. **Target Platform:** **Mobile-First / Phone Webview**.
   - Design all layouts, touch targets, and typography primarily for mobile screen dimensions (360px - 430px wide), while maintaining an attractive presentation on tablet and desktop screens.
5. **Brand Identity:**
   - **Primary Color:** **Kemenag Green** (`#006837` / `#007A3D` in Light Mode, `#10B981` in Dark Mode).
   - **Theme Engine:** Both Light and Dark modes must be supported, toggleable at any time, and saved directly to the database in `users.theme_mode` as well as synced via `localStorage`.

---

## 2. Master Office Sections & Target Dropdown Rules
The office consists of exactly **11 sections**:
1. `PTSP` (Pelayanan Terpadu Satu Pintu)
2. `KEPEGAWAIAN` (Kepegawaian)
3. `PENMAD` (Pendidikan Madrasah)
4. `BIMAS_ISLAM` (Bimbingan Masyarakat Islam)
5. `PAPKI` (Pendidikan Agama dan Keagamaan Islam)
6. `KATOLIK` (Penyelenggara Katolik)
7. `ZAKAT_WAKAF` (Penyelenggara Zakat Wakaf)
8. `KEUANGAN` (Perencana Keuangan)
9. `KASUBBAG` (Kasubbag Tata Usaha)
10. `KEPALA` (Kepala Kantor)
11. `HUMAS` (Humas Protokol)

### Strict Dropdown Filter Rule:
- In the "Teruskan Dokumen Ke" dropdown (both in the Create Document form and the Review modal), list all sections **EXCEPT `HUMAS` (Humas Protokol)**.
- **`HUMAS` must NEVER appear in the manual target dropdown**, because Humas Protokol is an automatic transit bridge when routing documents to `KASUBBAG` or `KEPALA`.

---

## 3. Smart Routing Engine Logic

The routing engine manages the path when forwarding documents to management (`KASUBBAG` and `KEPALA`):

### Case A: Standard Section Target
- If user selects any regular section (`PTSP`, `KEPEGAWAIAN`, `PENMAD`, `BIMAS_ISLAM`, `PAPKI`, `KATOLIK`, `ZAKAT_WAKAF`, `KEUANGAN`):
  - `pending_section_id = selected_section_id`
  - `planned_route_json = []`

### Case B: Target = Kasubbag Tata Usaha (`KASUBBAG`)
- Since standard sections submit to Kasubbag TU via Humas Protokol:
  - System automatically sets the initial recipient `pending_section_id = HUMAS_ID`.
  - System saves planned next step: `planned_route_json = ["KASUBBAG"]`.
  - When `HUMAS` receives the document and later clicks "Diteruskan", the target is automatically prefilled/set to `KASUBBAG`.

### Case C: Target = Kepala Kantor (`KEPALA`)
- Documents bound for the Head of Office must pass through Humas Protokol and must be reviewed by Kasubbag TU first:
  - System sets initial recipient `pending_section_id = HUMAS_ID`.
  - System saves planned route: `planned_route_json = ["KASUBBAG", "KEPALA"]`.
  - When `HUMAS` forwards the document, it advances to `KASUBBAG`.
  - When `KASUBBAG` reviews and forwards the document, it advances to `KEPALA`.

### Case D: Origin is `KASUBBAG` targeting `KEPALA`
- Direct transfer: `pending_section_id = KEPALA_ID`, no intermediate routing needed.

---

## 4. Diagram Visualization Rules
1. **Focused Diagram Mode (Default):**
   - Renders only the sections that have interacted or are scheduled to interact with the document (`origin_section` $\rightarrow$ past logged sections $\rightarrow$ `current_section` $\rightarrow$ planned route nodes).
   - Sections not involved in the document flow are omitted from the main diagram to preserve screen real estate on mobile devices.
2. **All Sections Mode (Read-Only Toggle):**
   - Clicking "Tampilkan Semua Seksi" displays a full view of all 11 sections with their currently stationed documents in read-only mode.
3. **Physical Location Updates:**
   - While a document is in transit (`status = 'DITERUSKAN'`), the recipient section sees the **Big Notification Banner**.
   - As soon as the recipient clicks Review and selects **`Diterima`** or **`Diproses`**, the document's physical node on the diagram **moves immediately to that section**.

---

## 5. Form Validation & Data Integrity Rules
- **Tanggal Dokumen:** Date, required, non-unique, automatically pre-populated with today's date in local time.
- **Nomor Dokumen:** Text string, optional, non-unique.
- **Hal:** Text string, required, non-unique.
- **Sifat:** Dropdown with exact options: `Biasa`, `Penting`, `Rahasia`. Required.
- **Keterangan:** Text string, optional.
- **ID Dokumen:** Read-only / disabled text field. Automatically generated using the exact format: `YYYYMMDD-HHMMSS-SECTIONCODE` (e.g. `20261029-154530-PAPKI`). Must be unique in the database.
- **Teruskan Dokumen Ke:** Dropdown with the 10 eligible target sections (excluding Humas).

---

## 6. Authentication & Session Specifications
- Each section has a designated PIC login account.
- Login screen must include standard HTML attributes (`autocomplete="username"`, `autocomplete="current-password"`) and a "Ingat akun di perangkat ini" checkbox to enable credential saving across webview sessions.
- Session cookie must have a duration of **6 hours** (`maxAge: 21600000` ms) to allow seamless full-shift operation without repeated logins.
