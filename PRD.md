# Product Requirements Document (PRD) - DOKUTRA
**Internal Document Tracking Web Application for Kantor Kementerian Agama Kota Metro**

---

## 1. Background & Objectives
In the Kantor Kementerian Agama (Kemenag) Kota Metro office, physical documents (incoming letters, outgoing letters, proposals, dispositions, and employee files) frequently move between different sections/divisions for review, initialing/signing (*paraf*), approval, and follow-ups. Documents sometimes go missing or section staff are unaware of their current physical location.

**DOKUTRA (Document Tracker)** is a web-based document tracking application optimized for **mobile/phone webview** and desktop browsers. It allows Person-in-Charge (PIC) users from each section to track document movements in real time using interactive diagrams, register new document movements, receive prominent incoming document alerts, and update document status (*Diterima*, *Diproses*, *Diteruskan*).

---

## 2. Target Users & Office Sections
The system is used by PIC staff across **11 Sections / Units** in Kantor Kementerian Agama Kota Metro:

| No | Section Code | Section Name (Indonesian) | Role & Primary Interaction |
| :--- | :--- | :--- | :--- |
| 1 | `PTSP` | Pelayanan Terpadu Satu Pintu | One-Stop Integrated Services; primary gateway where external "Surat Masuk" enters. |
| 2 | `KEPEGAWAIAN` | Kepegawaian | Staffing/HR section; primary originator of "Surat Keluar" and personnel reviews. |
| 3 | `PENMAD` | Pendidikan Madrasah | Madrasah Education; interfaces with madrasah schools and teachers. |
| 4 | `BIMAS_ISLAM` | Bimbingan Masyarakat Islam | Islamic Community Guidance; interacts with religious instructors and KUA across Kota Metro sub-districts. |
| 5 | `PAPKI` | PAPKI (Pendidikan Agama dan Keagamaan Islam) | Interacts with Islamic boarding schools (*pondok pesantren*) and Islamic religious education teachers in regular schools. |
| 6 | `KATOLIK` | Penyelenggara Katolik | Catholic organizer; interfaces with non-Muslim religious and educational affairs. |
| 7 | `ZAKAT_WAKAF` | Penyelenggara Zakat Wakaf | Zakat & Wakaf; interacts with zakat, wakaf, infaq, and sedekah matters. |
| 8 | `KEUANGAN` | Perencana Keuangan | Financial planning, accounting, and treasury. |
| 9 | `KASUBBAG` | Kasubbag Tata Usaha | Head of Administration subdivision; administrative approval before documents reach Kepala Kantor. |
| 10 | `KEPALA` | Kepala Kantor | Head of the Office; final institutional authority and disposition. |
| 11 | `HUMAS` | Humas Protokol | Public Relations & Protocol; administrative bridge between lower sections, Kasubbag TU, and Kepala Kantor. |

---

## 3. Functional Requirements

### 3.1. Authentication & Session Management
- **Multi-User PIC Accounts:** Each section has dedicated PIC credentials.
- **Save Credentials on Device:** Clean, simple login form supporting device-level credential storage (`autocomplete` attributes and "Ingat Saya" / Remember Me checkbox) for easy access in mobile webviews.
- **6-Hour Persistent Cookie Session:** User sessions last **6 hours** (`maxAge: 21600000` ms) via secure, HTTP-only session cookies. Users stay logged in throughout their work shift.
- **Theme Configuration (Light/Dark Mode):**
  - Primary color palette: **Kemenag Green** (`#006837` / `#007A3D` in Light Mode, `#10B981` in Dark Mode).
  - User can toggle between Light and Dark mode.
  - Theme preference is stored in the database (`users.theme_mode`) and cached locally.

### 3.2. Dashboard & Interactive Diagrams
- **Big Notification Banner for Incoming Documents:**
  - If a document is addressed/forwarded to the current logged-in user's section with status `DITERUSKAN` (pending acceptance), a prominent notification card/banner appears at the top of the Home Dashboard.
  - Clicking this banner opens the Incoming Document Review modal/view.
- **Focused Diagram View (Default View):**
  - Displays a flow diagram of document locations showing **only** the sections involved in the movement of the active/selected document.
  - *Example:* If a document starts from `PAPKI` $\rightarrow$ requires review/paraf at `KEPEGAWAIAN` $\rightarrow$ and is targeted to `KEPALA`, the diagram **only** displays nodes for `PAPKI`, `KEPEGAWAIAN`, `HUMAS`, `KASUBBAG`, and `KEPALA`. Irrelevant sections (such as `PENMAD`, `PTSP`, etc.) are hidden to keep mobile webview screens uncluttered.
- **All Sections View (Read-Only Mode):**
  - A toggle button on the main dashboard allows switching to "Tampilkan Semua Seksi".
  - Displays all 11 sections in a comprehensive grid/map showing all documents currently stationed at each section as read-only.

### 3.3. Create New Tracker Document
A dedicated menu and form to register a new document tracker:
1. **Tanggal Dokumen (Date):** Date picker, required, non-unique, automatically defaults to today's date (`YYYY-MM-DD`).
2. **Nomor Dokumen (Document Number):** Text string, optional, non-unique.
3. **Hal (Subject):** Text string, required, non-unique.
4. **Sifat (Classification):** Dropdown (`Biasa`, `Penting`, `Rahasia`), required, non-unique.
5. **Keterangan (Description/Note):** Text/textarea, optional, non-unique.
6. **ID Dokumen (Document Tracking ID):** Auto-generated, read-only/non-editable, unique. Format: `YYYYMMDD-HHMMSS-SECTIONCODE` (e.g. `20261029-154530-PAPKI`).
7. **Teruskan Dokumen Ke (Forward Document To):** Dropdown list of target sections:
   - Available options: `PTSP`, `Kepegawaian`, `PENMAD`, `BIMAS ISLAM`, `PAPKI`, `Penyelenggara Katolik`, `Penyelenggara Zakat Wakaf`, `Perencana Keuangan`, `Kasubbag Tata Usaha`, `Kepala Kantor`.
   - **Crucial Rule:** `Humas Protokol` is **NOT** included in this dropdown list. Because if the target is `Kasubbag Tata Usaha` or `Kepala Kantor`, Humas Protokol serves as a mandatory intermediate transit bridge and is handled automatically by the system.

### 3.4. Smart Routing Engine Rules
1. **Target = Kasubbag Tata Usaha (`KASUBBAG`):**
   - When any standard section forwards to `KASUBBAG`, the routing engine automatically sets the first transit destination to `HUMAS`.
   - Route path: `[Origin Section] -> HUMAS -> KASUBBAG`.
2. **Target = Kepala Kantor (`KEPALA`):**
   - Documents routed to `KEPALA` must pass through `HUMAS` first and must be reviewed by `KASUBBAG` before reaching `KEPALA`.
   - Route path: `[Origin Section] -> HUMAS -> KASUBBAG -> KEPALA`.
   - If the sender is already `KASUBBAG`, the document routes directly to `KEPALA`.
3. When `HUMAS` or `KASUBBAG` reviews and chooses "Diteruskan", the system auto-populates the next leg of the route.

### 3.5. Review & Status Update for Incoming Documents
When an incoming document arrives at a section, the section PIC reviews it and performs an action:
- **Keterangan (Review Note):** Free-text note or remark.
- **Action Status Selection:**
  1. **`Diterima` (Received):** Physical document has been received. On the diagram, the document's physical location node **moves to this receiving section**.
  2. **`Diproses` (In Process):** The document is currently being worked on / initialed / examined in this section. Location remains at this section with an "In Progress" badge.
  3. **`Diteruskan` (Forwarded):** Document is finished in this section and forwarded to another section. Choosing this displays the target section dropdown (or auto-targets the next section if on a pre-planned route to Kasubbag/Kepala).

---

## 4. Non-Functional Requirements
- **Language Policy:**
  - **User Interface (UI):** Indonesian language (clear, professional, easy-to-use).
  - **Database Model:** Indonesian entity names and values (`Diterima`, `Diproses`, `Diteruskan`, `Biasa`, `Penting`, `Rahasia`, section names).
  - **Codebase & Architecture:** English for variables, functions, routes, comments, and internal logic.
- **Responsive & Mobile Webview First:**
  - Designed for smooth interaction inside phone webviews (touch targets $\ge 44$px, bottom navigation bar on mobile, zero horizontal overflow).
- **Lightweight Architecture:**
  - Pure Node.js + Express backend, SQLite3 local database with WAL mode, and fast vanilla frontend components.
