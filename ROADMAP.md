# BFLFP CMMS — Master Roadmap

Last updated: 2026-06-12
Rule: work top to bottom. Don't start a step until the one above is done.
Items marked **YOU** need your hands (M365 portal/SharePoint/Power Apps). Items marked **CLAUDE** I do in the files.

---

## ✅ Phase 0 — Foundation (DONE)

- Architecture: Power Apps (entry) → SharePoint (data) → Flow + Office Script (reports) → OneDrive + run.py (archive) → Portal (viewer)
- 152 assets, 80 checklists, 685 tasks, ~400 job rows in SharePoint
- Repair form + Daily report generation LIVE in production
- Portal: 13 working pages, light/dark, role switcher
- 9 read/write flows live; maintenanceLog flow wired into data-service (2026-06-12)
- All 5 templates verified against scripts; Tool Auth script fixed; clean single-sheet templates extracted (PMPlan_Template, MachineHistory_Template)
- Daily report date-range printing added to portal (2026-06-12)
- Frequency audit done: 589 OK / 67 wrong → correction files ready (2026-06-12)

---

## 🔵 Phase 1 — DATA (in progress — current phase)

| # | Task | Who | Status |
|---|---|---|---|
| 1.1 | Audit ChecklistTasks frequencies vs old plan sheets | CLAUDE | ✅ Done — see `sharepoint-migration/imports/07_Frequency_Corrections.csv` |
| 1.2 | Review the 67 corrections, apply to ChecklistTasks list (SharePoint Quick Edit, ~20 min) | **YOU** | ☐ |
| 1.3 | Set frequencies for ตู้แช่ทำความเย็น (8 tasks — no old plan exists, ask supervisor) | **YOU** | ☐ |
| 1.4 | Open portal, check console: all datasets green "loaded from flow" | **YOU** | ☐ |

**Phase 1 done when:** ChecklistTasks frequencies are correct in SharePoint and the portal shows live data.

---

## ⚪ Phase 2 — FLOW (next)

| # | Task | Who | Status |
|---|---|---|---|
| 2.1 | Add error alerts to existing flows (Scope + email on failure) | **YOU** (I give exact steps) | ☐ |
| 2.2 | Check `fillmaintance` ticks the right box per JobType: Breakdown/Repair → แจ้งซ่อม, Corrective/Improvement → แจ้งปรับปรุง (paste script here, I review) | BOTH | ☐ |
| 2.3 | Install `fillPMPlan` script + build PMPlan_flow per `office-scripts/WIRING-fillPMPlan.md` | **YOU** | ☐ |
| 2.4 | (Recommended) Replace HTTP-trigger read flows with scheduled JSON export to docs/data/ — removes premium-license risk | BOTH | ☐ |

**Phase 2 done when:** reports branch correctly by JobType and flows fail loudly.

---

## ⚪ Phase 3 — REPORT

| # | Task | Who | Status |
|---|---|---|---|
| 3.1 | Create PM Monthly Excel template (F-SP-ENG02-01) — last missing template | CLAUDE | ☐ |
| 3.2 | Finish `fillPMMonthly.ts` against the new template | CLAUDE | ☐ |
| 3.3 | Add Preventive branch to report flow → PM report PDF | **YOU** (I give exact steps) | ☐ |
| 3.4 | Refactor `#tools-used` portal page from fillable form to PDF viewer (Sprint 19.1) | CLAUDE | ☐ |

**Phase 3 done when:** all 3 report types (operator service, planner service, PM) generate as PDF by JobType.

---

## ⚪ Phase 4 — PM AUTOMATION (Sprint 7 — this makes it a real CMMS)

| # | Task | Who | Status |
|---|---|---|---|
| 4.1 | Add ChecklistSheets/Tasks/AssetSheetMap as Power Apps data sources (#96) | **YOU** | ☐ |
| 4.2 | PM checklist screen in Power Apps — task gallery with OK/NG/NA when JobType=Preventive (#92) — I write the Power Fx | BOTH | ☐ |
| 4.3 | "Assign to me" button on technician dashboard + SelfAssigned column | BOTH | ☐ |
| 4.4 | Recurrence flow: auto-create Preventive jobs from asset frequencies | BOTH | ☐ |
| 4.5 | Wire portal PM Reports to read live Preventive rows (#94) | CLAUDE | ☐ |

**Phase 4 done when:** PM jobs appear on tech phones automatically and nobody tracks PM on paper.

---

## ⚪ Phase 5 — CMMS EXTRAS

| # | Task | Who | Status |
|---|---|---|---|
| 5.1 | Spare parts module: SharePoint list (from Stock.xlsx, 270 items) + Power Apps screen + parts-used per job (Sprint 16) | BOTH | ☐ |
| 5.2 | Live KPI dashboard: MTTR / MTBF / PM compliance from Maintancelogs (Sprint 14) | CLAUDE | ☐ |
| 5.3 | Yearly archive flow + indexed columns on Maintancelogs (5000-item protection) | **YOU** (I give steps) | ☐ |
| 5.4 | Rebuild Reports landing page (Sprint 15) | CLAUDE | ☐ |

---

## Parking lot (not scheduled)

- Portal Microsoft login (MSAL) if portal entry is ever wanted
- SP site page linking to portal (#72)
- Unified 4-report spec docx (#101)
- 21 unmatched task rows from frequency audit (kept current values — review someday)

## Key files

- This roadmap: `MaintanceBFLFP/ROADMAP.md`
- Session handover: `MaintanceBFLFP/HANDOVER.md`
- PM Plan flow guide: `MaintanceBFLFP/office-scripts/WIRING-fillPMPlan.md`
- MaintenanceLog flow spec: `MaintanceBFLFP/FLOW-GetMaintenanceLog.md`
- Frequency corrections: `MaintanceBFLFP/sharepoint-migration/imports/07_Frequency_Corrections.csv`
