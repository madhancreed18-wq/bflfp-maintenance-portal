# BFLFP Wet Food Maintenance Portal — Session Handover

Last updated: 2026-06-12

This document captures everything a new Claude session needs to pick up this project where the previous session left off.

---

## 1. The Project

A maintenance management system for **Blue Buffalo Food Products Co., Ltd. (BFLFP) Wet Food plant** — Thai cat/pet food production. Owner: Production_BFL (`Production@bluefalo-group.com`).

**Goal:** Replace paper PM workflows with a CMMS-grade digital system covering:
- 152 assets (machines, utilities, IT)
- 80 PM templates with 685 individual tasks
- Daily maintenance reports + repair forms + machine history + tool authorization
- Full audit trail (signatures, photos, approval chain)

---

## 2. Architecture (THE FUNDAMENTAL DESIGN)

```
┌─────────────────────┐   Power Apps Patch()   ┌──────────────────┐
│ Tech in production  │ ───────────────────────►│ SharePoint List  │
│ uses Power Apps     │                         │ "Maintancelogs"  │
│ on phone            │ ◄───────────────────────│ GUID 5972178c-…  │
└─────────────────────┘                         └──────┬───────────┘
                                                       │
       Power Apps "Generate report" button             │
       triggers Power Automate flow:                   │
                                                       ▼
                              ┌──────────────────────────────────┐
                              │ Power_apps_flow                  │
                              │ - Get item + attachments         │
                              │ - Run script (Office Script)     │
                              │ - Convert XLSX → PDF             │
                              │ - Save to OneDrive BFLFP Report  │
                              └──────────────┬───────────────────┘
                                             │
                          OneDrive "BFLFP Report" inbox
                                             │
                              python run.py (sweeper script)
                                             ▼
                              ┌─────────────────────────────────┐
                              │ MaintanceBFLFP/Report/YYYY/MM/DD│
                              │ - MaintenanceReport_*.pdf       │
                              │ - repairform_*.pdf              │
                              │ - <Machine>_beforeimage_*.jpeg  │
                              │ - <Machine>_afterimage_*.jpeg   │
                              └─────────────┬───────────────────┘
                                            │
                       Caddy serves at /reports/* (port 8080)
                                            ▼
                              ┌────────────────────────────┐
                              │ Portal at localhost:8080   │
                              │ - Views existing PDFs       │
                              │ - Reads assets/checklists   │
                              │   from SharePoint flows    │
                              └────────────────────────────┘
```

**Key principle:** Power Apps generates data + Office Script generates reports + Python files them + Portal views them. Portal is mostly a VIEWER, not an editor.

---

## 3. Folder Layout

```
E:\onedrive\OneDrive - Bluefalo Co.,Ltd\Automation\BFLFP WETFOOD\Maintnace\
├─ caddy_windows_amd64.exe                Caddy web server binary
├─ Caddyfile                              Routes / and /reports/*
├─ Start BFLFP Portal.bat                 Double-click to run
├─ python run.py                          Sweeps OneDrive inbox → dated archive
├─ MaintanceBFLFP\
│  ├─ docs\                               Portal web root (Caddy serves this at /)
│  │  ├─ index.html                       App shell — sidebar + topbar
│  │  ├─ assets\                          CSS + JS for the portal
│  │  ├─ pages\                           SPA page fragments
│  │  ├─ data\                            JSON data + sample MaintenanceLog
│  │  ├─ img\checklist\                   518 PM task reference photos in 80 class folders
│  │  ├─ print\                           Standalone print/checklist.html (PM print)
│  │  └─ Bluefalo.png                     BFL logo
│  ├─ Report\                             ALL Python-generated reports + photos
│  │  ├─ YYYY\MM\DD\                      Dated archive (Caddy /reports/*)
│  │  ├─ TemplateRepairform.xlsx          Repair form (F-SP-ENG02-03)
│  │  ├─ Maintenance_Daily_Template.xlsx  Daily report (F-SP-ENG02-06)
│  │  ├─ Machine history.xlsx             History (F-SP-ENG02-02, has TEMPLATE1 sheet)
│  │  └─ PMchecklist.xlsx                 PM Plan (SD-SP-ENG02-02, has 'template' sheet)
│  ├─ office-scripts\                     NEW: TypeScript files to paste into Excel Online
│  │  ├─ fillToolAuthorization.ts         F-SP-ENG02-04
│  │  ├─ fillMachineHistory.ts            F-SP-ENG02-02 (matches TEMPLATE1)
│  │  ├─ fillPMPlan.ts                    SD-SP-ENG02-02 (matches PMchecklist 'template')
│  │  ├─ fillPMMonthly.ts                 F-SP-ENG02-01 (needs template, not built yet)
│  │  └─ README.md                        How to install + wire flows
│  ├─ MaintaneBFLFP_20260526063509\       Existing Power Apps export package
│  └─ sharepoint-migration\imports\       CSV files ready to import into SP lists
└─ Test\new project\                      ORIGINAL source Excel files (legacy)
    ├─ PMchecklist.xlsx                   OLD master (Wingdings symbols, 85 sheets)
    ├─ (PM) Blue falo FPD _R1.xlsx        NEW master R1 (used by portal; embedded photos)
    ├─ Machine history.xlsx               Older copy (no TEMPLATE1 yet)
    ├─ Stock.xlsx                         Spare parts master (270 items)
    ├─ KPI-Wet food 2025.xlsx             KPI dashboard
    ├─ PM_Template_Complete*.xlsx         Older PM templates
    └─ F-SP-ENG02-04 R.00.xlsx            Tool Authorization form
```

---

## 4. The Five Forms (F-SP-ENG02 Series)

| Code | Name (TH) | Name (EN) | Template | Office Script | Portal page | Status |
|---|---|---|---|---|---|---|
| F-SP-ENG02-01 | รายงาน PM ประจำเดือน | Monthly PM Report | Needs creating | `fillPMMonthly.ts` (placeholder) | `pm-reports.html` ✅ | Portal works, no Excel template yet |
| F-SP-ENG02-02 | ประวัติการซ่อมบำรุงเครื่อง | Machine History | `Machine history.xlsx` → `TEMPLATE1` | `fillMachineHistory.ts` ✅ | `history.html` ✅ (renders from JSON) | Script done, portal renders sample data |
| F-SP-ENG02-03 | ใบแจ้งซ่อม | Repair Request | `TemplateRepairform.xlsx` | **`fillmaintance`** (in Excel Online) ✅ | `repair-reports.html` ✅ | Production — flow + script live |
| F-SP-ENG02-04 | ใบขออนุญาตนำเครื่องมือ | Tool Authorization | `F-SP-ENG02-04 R.00.xlsx` | `fillToolAuthorization.ts` ✅ | `tools-used.html` (FILLABLE — needs refactor to viewer) | Script written, portal page needs refactor |
| F-SP-ENG02-06 | รายงานการซ่อมบำรุงประจำวัน | Daily Maintenance Report | `Maintenance_Daily_Template.xlsx` | (in Excel Online) ✅ | `daily-report.html` ✅ | Production — fully working viewer |

**Supporting document:**
| SD-SP-ENG02-02 | แผนการบำรุงรักษา | PM Plan | `PMchecklist.xlsx` → `template` sheet | `fillPMPlan.ts` ✅ | Not yet | Script written, not wired |

---

## 5. Office Scripts — The Proven Pattern

All scripts follow the conventions of the two production scripts (daily + `fillmaintance`):

- **Pen color**: `#00468C` blue (mimics ink on paper)
- **`normalizeText()`**: strips `\r\n`, collapses whitespace
- **`formatDateOnly()`**: ISO → DD/MM/YYYY
- **`fitTextToCellByLayout()`**: smart-truncate with Thai-aware character widths
- **`insertImageInMergedRange()`**: drops base64 PNG centered in merged ranges
- **`writeMergedCell()`**: writes to top-left cell only (Excel handles the merge)
- **`writeCheckbox()`** / **`writeTick()`**: ✓ in green or empty
- **Page layout**: A4, zero margins, `setCenterHorizontally(true) + setCenterVertically(true)`
- **Multi-page scripts**: copy template per page, preserve template row heights, delete output prefix sheets from previous runs

**Script IDs (in Power_apps_flow):**
- Daily report filler: `01WFBGKTBPUTPMX6VCFBDLIHAEN2HRARRO`
- `fillmaintance` (repair form): `01WFBGKTF5VG23D6QYYBCI6Q5LF43Y3GT4`

---

## 6. SharePoint Lists

Site: `https://bluefalofamily.sharepoint.com/sites/MaintanceDatabase/`

| List | Items | Status |
|---|---|---|
| Machines (Assets) | 152 ✓ | Live, used by portal |
| ChecklistSheets | 80 ✓ | Live (was empty, populated) |
| ChecklistTasks | 685 ✓ | Live |
| AssetSheetMap | 152 ✓ | Live |
| AssetAliases | 50 ✓ | Live |
| **Maintancelogs** | ~400 ✓ | Live — JobType field discriminates PM/Corrective/Breakdown/Repair/Improvement/Project/Inspection |
| UserRole | 6 ✓ | Live |
| ActionBy (legacy) | 6 ✓ | Legacy |
| PMTaskResults | NEW (not created yet) | For Sprint 7 step B — per-task ✓/✗ results from PM submissions |

**MaintenanceLog has all needed columns already**, including:
- `JobType`, `JobSource`, `Status`, `Priority`
- `Problem`, `RootCause`, `Solution`
- `penRequester / penInspector / penApprover` (3-stage signatures as Thumbnails)
- `BeforeImage / AfterImage` (Thumbnails)
- `AssignedTo / AssignedBy`, `PlannedDate / DueDate`, `StartTime / EndTime`
- `ApprovalStatus / VerificationResult / InspectionRemark`
- `SupplierName`, `ClearedWorkSite`, `NeedApproval`, `TechWorkable`

**Status state machine (already in Power Apps):** `Reported → Assigned → Rework → WaitingApproval → Done → Approved/Rejected`

---

## 7. Power Apps App

- Name: **Maintanance BFLFP ver 2**
- Embed URL: `https://apps.powerapps.com/play/e/default-e622a082-d0bb-441e-a364-13f5c6912159/a/bf74647d-a82a-4e13-bf88-2cd6d516fc05`
- Screens: `App`, `BrowseScreen1`, `DetailScreen1`, **`EditScreen1`** (main form), **`scrPlannerDashboard`** (planner view), **`scrTechnicianDahboard`** (tech view, typo in name)
- Data sources: Maintancelogs, Machines, UserRole, ActionBy (already connected)
- Connectors: SharePoint, PowerAppsNotificationV2, PowerAppsforMakers, Logic flows
- **The single Power_apps_flow** branches via `Condition_2` to handle daily report vs repair form generation

---

## 8. Portal — What's Built

**App shell (sidebar layout):**
- Light cream sidebar / dark navy in dark mode
- Light/dark theme toggle (`Ctrl+B` collapses sidebar, `Ctrl+K` focuses search)
- BFL logo blue (#2563EB) primary + BFL green (#16A34A) secondary
- Collapsible nav groups (Overview, Planning, Operations, Reports, Analytics, System)
- Role switcher in sidebar footer (Public / Technician / Planner / Admin)

**Pages working:**
- `#home` — KPI tiles + asset breakdown bars (live from data-service)
- `#assets` — 152-asset registry with edit modal + checklist editor
- `#pm-schedule` — year matrix
- `#maintenance-log` — log viewer with alias resolver
- `#corrective` — **iframe-embedded Power Apps**
- `#pm-completions` — admin page
- `#pm-reports` — F-SP-ENG02-01 generator (sample data) with Mgr-only signing
- `#daily-report` — **viewer for Python-generated PDFs** + photo gallery
- `#history` — F-SP-ENG02-02 (renders from sample data)
- `#repair-reports` — F-SP-ENG02-03 (renders from sample data)
- `#tools-used` — F-SP-ENG02-04 (FILLABLE FORM — should be refactored to viewer)
- `#about`, `#reports` (legacy KPI page)

**Data service:** `docs/assets/data-service.js` exposes `window.BFLFP_Data` with `.assets()`, `.checklists()`, `.maintenanceLog()`, etc. — each tries Power Automate flow URL first, falls back to JSON file.

---

## 9. Photos — Three Tiers

1. **PM reference photos** (518 images, 80 class folders):
   `docs/img/checklist/<ClassName>/task01.png` (extracted from R1)
2. **Maintenance evidence photos** (237 archived):
   `Report/YYYY/MM/DD/<Machine>_beforeimage_DDMMYY_<JobID>.jpeg`
3. **Source SharePoint attachments**:
   On the Maintancelogs row's `BeforeImage`/`AfterImage` columns

---

## 10. Critical Decisions Made

- **Single source of truth**: All PM + Corrective data lives in **Maintancelogs** with `JobType` discrimination
- **`JobType` choice values already exist**: `Breakdown / Preventive / Corrective / Improvement / Project / Inspection / Repair`
- **PM uses value "Preventive"** (not "PM")
- **Signatures reuse** `penRequester / penInspector / penApprover` columns regardless of JobType
- **R1 file** = canonical PM source (NOT old PMchecklist.xlsx)
- **Tech uses Power Apps only** — portal Fill Mode was scrapped because tech doesn't want two apps
- **Power Apps form will be EXTENDED** for PM checklist (Sprint 7 Step A, not yet built)
- **Portal pages should be VIEWERS** of Python-generated PDFs, not editors (the proper pattern, demonstrated by `#daily-report`)

---

## 11. Pending / TODO (Sprint Backlog)

**Completed sprints: 1-21.2 (most of the foundation)**

Pending:
- #69 — Audit existing SharePoint Lists
- #72 — Optional SP site page linking to local portal
- #73 — Phase 1C: Confirm all 6 SP lists populated (need to verify ChecklistTasks fully populated — was empty)
- #74 — Phase 1D: build remaining 8 Power Automate flows (4 read + 4 write)
- #75 — Phase 1E: Refactor portal to use SP flows everywhere
- #92 — Sprint 7 Step A: **Add PM Checklist Screen to Power Apps EditScreen1** (branches on JobType=Preventive)
- #94 — Sprint 7 Step C: Wire portal PM Reports to read MaintenanceLog (JobType=Preventive)
- #96 — Sprint 7 Step B: Add ChecklistSheets/Tasks/AssetSheetMap as data sources in Power Apps + populate ChecklistTasks SharePoint list
- #99 — Sprint 8.1: Per-row Reports menu on Assets page (PM / Repair / History / Tool Auth links per asset)
- #101 — Optional: write unified 4-Report Spec docx
- #107 — Sprint 14: Rebuild Dashboard with live KPIs (currently has static data)
- #108 — Sprint 15: Rebuild Reports landing page
- **#109-#113 — Sprint 16: Spare Parts Inventory module** (CMMS Gap 1) — user's top priority after Phase 1 done
- **#119 — Sprint 19.1: REFACTOR `#tools-used` from fillable to viewer**
- Future: PM Monthly Excel template needs creating (`fillPMMonthly.ts` waits on this)
- Future: Power Automate flow branches for the 4 new scripts
- Future: Power Apps forms to trigger the new scripts

---

## 12. Gotchas / Things That Tripped Us Up

1. **OneDrive truncation** when writing large files via OneDrive sync — sometimes files get cut off mid-write. Solution: write to `/tmp` first then copy.
2. **Power Apps embed needs first-time Microsoft sign-in** inside the iframe. After once, it remembers.
3. **MaintenanceLog flow URL** doesn't exist yet — reports fall back to `maintenance-log-sample.json` (20 realistic rows). When live flow is built, paste URL into `data-service.js` line ~33.
4. **`BFLFP_Data` vs `BFLFP.data`** — Data service exposes `BFLFP.data` (dotted); some pages used `BFLFP_Data` (underscored). A backward-compat alias was added.
5. **Daily report uses `Wingdings Ö`** in old PMchecklist.xlsx — replaced with real `✓` in R1.
6. **Power Apps tech dashboard screen has a TYPO**: `scrTechnicianDahboard` (not Dashboard).
7. **Merged cells** in Office Scripts: only write to the top-left cell of the merge; trying any other cell throws.
8. **`python run.py` only files** — it doesn't generate anything. The actual generators are the two Office Scripts.
9. **TH Sarabun PSK** font for printed PM Report — installed on user's Windows. Falls back to web Sarabun on other devices.

---

## 13. Quick-Start for New Session

```bash
# To run the portal locally:
# Double-click: Start BFLFP Portal.bat
# It launches Caddy on http://localhost:8080

# To rebuild the workflow review deck (uses pptxgenjs):
cd /sessions/.../mnt/outputs
NODE_PATH=/usr/local/lib/node_modules_global/lib/node_modules node build_deck.js

# To inspect SharePoint list data via Power Automate flow:
# URLs are in docs/assets/data-service.js

# To regenerate sample MaintenanceLog data:
# Edit docs/data/maintenance-log-sample.json directly
```

---

## 14. Key Files to Read First in New Session

1. **`MaintanceBFLFP/HANDOVER.md`** (this file)
2. **`MaintanceBFLFP/office-scripts/README.md`** (Office Script reference)
3. **`MaintanceBFLFP/docs/assets/data-service.js`** (data layer + flow URLs)
4. **`MaintanceBFLFP/docs/index.html`** (app shell structure)
5. **`MaintanceBFLFP/Report/`** (look at any generated PDF to see the canonical output)
6. **`MaintanceBFLFP/MaintaneBFLFP_20260526063509/Microsoft.Flow/flows/.../definition.json`** (the existing Power Automate flow)

---

## 15. Style & Tone Preferences

- BFL palette: blue `#2563EB` + green `#16A34A` (from logo) — not the previous orange
- Cat / wet-food theme adopted (cat icon, paw print accent, "Wet Food Plant" tagline)
- Light/dark theme toggle works on all portal pages
- Internal BFL audit standards (not external ISO/BRC) is the current target

---

## 16. Where to Pick Up

The user's last question before requesting this handover was about the **difference between PMchecklist.xlsx and (PM) Blue falo FPD _R1.xlsx** — explained: PMchecklist is legacy, R1 is the current source of truth.

**Most likely next step:**
- User confirms whether they want to fill the PM Plan (SD-SP-ENG02-02) using the new `fillPMPlan.ts` OR create a separate template for the Monthly PM Report (F-SP-ENG02-01)
- Then wire Power Automate flow branches for the 4 new Office Scripts
- Then refactor `#tools-used` portal page from fillable to viewer (Sprint 19.1)
