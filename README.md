# BFLFP Maintenance Portal

Power Pages website for **BFLFP — Bluefalo Food Products** Maintenance Control Center.
Real-time maintenance visibility for production facilities, powered by SharePoint and Power Automate.

> ระบบบำรุงรักษา BFLFP — ติดตามการบำรุงรักษาแบบเรียลไทม์สำหรับโรงงาน BFLFP

---

## Architecture

```
SharePoint list (Maintenance Jobs)
        │
        ▼
Power Automate flow (HTTP trigger → Get items → Response)
        │
        ▼
Power Pages site (this repo)
   ├── Home          → live stats, KPIs, machine status, recent jobs
   ├── Dashboard     → filters, charts, KPI tiles, full log, PM KPI matrix
   ├── Reports       → (not yet built)
   └── About         → (not yet built)
```

## Folder structure

| Folder | Purpose |
|---|---|
| `web-pages/` | One folder per page; each contains `*.webpage.copy.html`, `*.customcss.css`, `*.customjs.js` |
| `web-templates/` | Site-wide templates including the master Default Studio Template |
| `web-files/` | Static assets (logo, images, theme.css, bootstrap) |
| `content-snippets/` | Reusable HTML fragments (announcement banner, site name, footer text) |
| `basic-forms/` `advanced-forms/` `lists/` | Power Pages form and list definitions |

## Pages built

- **Home** (`web-pages/Home/`) — Hero, stats strip, KPI cards, How It Works, Machine Status grid, Recent Jobs table, CTA banner. All dynamic sections read live data from the Power Automate flow.
- **Dashboard** (`web-pages/Dashboard/`) — Filter bar (status, type, priority, machine, technician, date, search), 8 KPI tiles (MTTR, MTBF, PM Compliance, FTFR, Total, Open, Overdue, Avg Response), Chart.js charts (daily trend, status/jobtype/priority donuts, top machines/downtime/technician workload bars), Open/Overdue/Full Log tables, **PM KPI Dashboard** (12-month KPI matrix with color-coded targets).
- **Master template** (`web-templates/Default Studio Template/`) — Sticky nav with Bluefalo logo (40px), bilingual links, footer with company info.
- **Announcement Banner** (`content-snippets/Announcement Banner/`) — Slim orange top bar with today's date.

## Theme

- **White** `#FFFFFF` base
- **Orange** `#F97316` primary, **Dark orange** `#EA580C`
- **Navy** `#1E293B` accent
- **Light grey** `#F8FAFC`, **Border** `#E2E8F0`
- **Fonts**: Prompt (Thai + Latin) for headings, Inter for body
- Bilingual: English primary, Thai subtitle below

## Data source

Live data is fetched from a Power Automate HTTP-trigger flow returning the SharePoint Maintenance Jobs list. The flow URL is hardcoded in:

- `web-pages/Home/Home.en-US.customjs.js`
- `web-pages/Dashboard/Dashboard.en-US.customjs.js`

Both files reference a `DATA_URL` constant near the top. To rotate or replace the flow URL, update both files.

### Job record schema (from the flow)

| Field | Type | Notes |
|---|---|---|
| `ID` | number | SharePoint internal ID |
| `JobID` | string | e.g. `PRD-2604-001` |
| `Machine` | string | e.g. `ห้องบรรจุกระป๋อง` |
| `Problem` | string \| null | |
| `RootCause` | string | |
| `Solution` | string | |
| `Status` | string | `Done`, `Open`, `In Progress`, etc. |
| `JobType` | string | `Repair`, `Preventive`, `Breakdown`, `Inspection` |
| `Priority` | string | `Low`, `Medium`, `High` |
| `AssignedTo` | string | Comma- or semicolon-separated names |
| `ActionBy` | string | Single name |
| `DueDate` | date | `YYYY-MM-DD` |
| `StartTime` | datetime | ISO 8601 |
| `EndTime` | datetime | ISO 8601 |
| `JobSource` | string | e.g. `OperatorReport` |
| `BeforeImage` `AfterImage` | url \| null | |
| `Created` `Modified` | datetime | SharePoint timestamps |

### Power Automate flow response shape

The flow returns the items as a stringified JSON array wrapped in a `response` property:

```json
{
  "response": "[{\"ID\":251,\"JobID\":\"PRD-2604-001\", ... }]"
}
```

The site's payload normalizer handles this and several other common wrappers.

## KPI definitions

| KPI | Formula | Target |
|---|---|---|
| **MTTR** | avg(`EndTime` − `StartTime`) for jobs where Status = Done | YoY decrease |
| **MTBF** | avg gap between failure events per machine | YoY increase |
| **PM Compliance** | % of Preventive jobs closed on or before `DueDate` | ≥ 95% |
| **FTFR** | % of Done jobs with a single `ActionBy` (first-time fix proxy) | high |
| **Breakdown Rate** | count of Repair / Breakdown / Corrective jobs | YoY decrease |
| **Overdue PM** | count of Preventive jobs past `DueDate` and not Done | 0 |
| **Avg Response Time** | avg(`StartTime` − `Created`) | low |

## Local preview

These files are designed for Power Pages, but the HTML/CSS/JS can be previewed locally:

```bash
# from the repo root
python -m http.server 8000
# open http://localhost:8000/web-pages/Dashboard/Dashboard.en-US.webpage.copy.html
```

Note: Power Pages-specific Liquid tags like `{{ content }}` will render literally in a local preview.

## Deploying to Power Pages

1. Open your site in Power Pages Studio.
2. Import this folder via the Power Platform CLI:

   ```bash
   pac paportal upload --path . --modelVersion 2
   ```

3. Or copy files into the corresponding records in Power Pages Studio manually.

## Security notes

- The `DATA_URL` in the JS contains a Power Automate access signature (`sig=…`). Anyone with the file can call the flow. Keep this repo private, or rotate the URL before going public.
- To rotate: Power Automate → open the flow → click the HTTP trigger → three-dot menu → **Regenerate access key**. Paste the new URL into both JS files.

## License

Internal — Bluefalo Food Products. Not for redistribution.
