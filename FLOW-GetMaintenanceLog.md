# Flow Spec — GetMaintenanceLog (Sprint 17 / Phase 1D)

> **STATUS: ALREADY WIRED (2026-06-12).** The flow already existed
> (workflow `761fb564…`, the same one `maintenance-log.js` / `dashboard.js` /
> `reports.js` call) — its URL is now registered in `data-service.js`
> `URLS.maintenanceLog`, with Machine↔MachineID field aliasing and a
> GET→POST retry. This spec is kept as reference for the response shape.
>
> **Verify:** open the portal → DevTools console → `#history` or
> `#repair-reports` should log `maintenanceLog loaded from flow` in green.
> If repair reports show blank requester fields, the flow's Select is
> missing `RequesterPosition` / `RequesterDepartment` — add them per the
> table below.

## Build (mirror the existing read flows like GetAssets)

### 1. Trigger — "When an HTTP request is received"
- Who can trigger: Anyone
- Method: **GET**

### 2. Get items (SharePoint)
- Site: `https://bluefalofamily.sharepoint.com/sites/MaintanceDatabase/`
- List: **Maintancelogs**
- Top Count: `5000`
- Settings → Pagination: On, threshold 5000
- (No filter — portal filters client-side by JobType/date)

### 3. Select — map to the shape the portal expects
From: `@outputs('Get_items')?['body/value']`

| Key | Value (dynamic content / expression) |
|---|---|
| ID | `@item()?['ID']` |
| Title | `@item()?['Title']` |
| JobID | `@item()?['JobID']` |
| MachineID | `@item()?['MachineID']` *(verify internal name — may be Title or a lookup)* |
| JobType | `@item()?['JobType/Value']` |
| JobSource | `@item()?['JobSource/Value']` *(if choice; else plain)* |
| Status | `@item()?['Status/Value']` |
| Priority | `@item()?['Priority/Value']` *(if choice; else plain)* |
| StartTime | `@item()?['StartTime']` |
| EndTime | `@item()?['EndTime']` |
| PlannedDate | `@item()?['PlannedDate']` |
| DueDate | `@item()?['DueDate']` |
| Problem | `@item()?['CauseOfProblem']` *(repair flow uses CauseOfProblem for Problem)* |
| RootCause | `@item()?['RootCause']` |
| Solution | `@item()?['Solution']` |
| ActionBy | `@item()?['ActionBy']` |
| AssignedTo | `@item()?['AssignedTo']` |
| AssignedBy | `@item()?['AssignedBy']` |
| RequesterPosition | `@item()?['RequesterPosition']` |
| RequesterDepartment | `@item()?['RequesterDepartment/Value']` |
| ClearedWorkSite | `@item()?['ClearedWorkSite']` |
| ApprovalStatus | `@item()?['ApprovalStatus']` |
| VerificationResult | `@item()?['VerificationResult']` |
| NeedApproval | `@item()?['NeedApproval']` |
| Created | `@item()?['Created']` |
| Modified | `@item()?['Modified']` |

> Choice columns need `/Value`; plain text columns don't. If the designer
> errors on a `/Value`, the column is plain text — drop the suffix.
> Reference shape: `docs/data/maintenance-log-sample.json`.

### 4. Response
- Status: 200
- Headers: `Content-Type: application/json`
- Body: `@body('Select')`

## Wire it

1. Save flow → copy the HTTP GET URL.
2. Paste into `docs/assets/data-service.js` → `URLS.maintenanceLog` (line ~36).
3. Hard-refresh the portal; console should show
   `[BFLFP.data] maintenanceLog loaded from flow` in green.

## Notes

- **Do NOT include signature/photo thumbnail columns** (penRequester etc.) —
  they bloat the payload; report PDFs already carry them.
- ~400 rows today; Top Count 5000 gives headroom. Revisit with a date filter
  (`Created ge '...'`) if the list passes a few thousand rows.
- This same flow feeds the future KPI dashboard (Sprint 14) — MTTR/MTBF
  computed client-side from StartTime/EndTime/JobType.

## Verify the other flows while you're in there (#73)

Open the portal with DevTools console: every dataset should log
`loaded from flow` (green). Anything orange (`local fallback`) means that
flow is broken or its URL changed.
