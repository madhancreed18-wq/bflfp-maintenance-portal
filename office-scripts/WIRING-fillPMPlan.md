# Wiring Guide — fillPMPlan (SD-SP-ENG02-02 PM Plan)

Build this as a **NEW flow** (`PMPlan_flow`) — do not restructure the production
`Power_apps_flow` ELSE branch. Same connections, same patterns.

## Prerequisites (already done)

- ✅ `Report/PMPlan_Template.xlsx` — clean single-sheet template extracted from
  PMchecklist.xlsx. **Use this, NOT PMchecklist.xlsx** — converting the full
  PMchecklist to PDF would render all 85 legacy sheets.
- ✅ `fillPMPlan.ts` updated: takes `machines[]` + `tasks[]` as separate parallel
  lists (matches the paper form) and maps `FrequenciesCSV` codes (W/M/Q/S/A) itself.

## Install the script

Excel Online → Automate → New script → paste `fillPMPlan.ts` → Save as `fillPMPlan`.

## Flow: PMPlan_flow

### 1. Trigger — PowerApps (V2)
| Input | Type | Meaning |
|---|---|---|
| `SheetName` | Text | ChecklistSheets Title, e.g. `ปั๊มลมสกรู Air Compressure` |
| `ClassName` | Text | Printed in C4, e.g. `AIR COMPRESSOR` |
| `MakerName` | Text | ผู้จัดทำ |
| `ApproverName` | Text | ผู้อนุมัติ |

### 2. Get file content (OneDrive for Business)
File: `/Automation/BFLFP WETFOOD/Maintnace/MaintanceBFLFP/Report/PMPlan_Template.xlsx`
(pick via file picker so it stores the file ID, same as `Get_file_content_1` in the repair branch)

### 3. Create file (OneDrive for Business)
- Folder: `/BFLFP Report`
- Name:
```
@{concat('pmplan_', formatDateTime(utcNow(), 'dd-MM-yyyy'), '_', replace(triggerBody()?['text_1'], ' ', '-'), '.xlsx')}
```
  (`text_1` = ClassName; the `dd-MM-yyyy` date is what `python run.py` keys on)
- File content: `@body('Get_file_content')`

### 4. Get items — ChecklistTasks (SharePoint)
- Site: `https://bluefalofamily.sharepoint.com/sites/MaintanceDatabase/`
- List: ChecklistTasks
- Filter Query: `Sheet eq '@{triggerBody()?['text']}'`  (text = SheetName)
- Order By: `TaskNo asc`

### 5. Get items — AssetSheetMap (SharePoint)
- List: AssetSheetMap
- Filter Query: `Sheet eq '@{triggerBody()?['text']}'`

### 6. Select — `Select_Tasks`
From: `@outputs('Get_items')?['body/value']`
| Key | Value |
|---|---|
| TaskNo | `@item()?['TaskNo']` |
| TaskName | `@item()?['Title']` |
| Standard | `@item()?['Standard']` |
| Frequencies | `@item()?['FrequenciesCSV']` |
| Method | `@item()?['Method']` |

### 7. Select — `Select_Machines`
From: `@outputs('Get_items_1')?['body/value']`
| Key | Value |
|---|---|
| MachineCode | `@item()?['AssetID']` |
| MachineName | `@{trim(replace(item()?['Title'], concat(item()?['AssetID'], ' - '), ''))}` |

(AssetSheetMap Title is `W01AC01 - ปั๊มลมสกรู Air Compressure`; this strips the code prefix.)

### 8. Run script (Excel Online Business)
- File: `@outputs('Create_file')?['body/Id']`
- Script: `fillPMPlan`
- Parameters:
  - header/ClassName: `@triggerBody()?['text_1']`
  - header/MakerName: `@triggerBody()?['text_2']`
  - header/ApproverName: `@triggerBody()?['text_3']`
  - header/MakerSignBase64: *(empty for v1)*
  - header/ApproverSignBase64: *(empty for v1)*
  - machines: `@body('Select_Machines')`
  - tasks: `@body('Select_Tasks')`

> If the designer renders machines/tasks as item-by-item fields, switch the
> array parameter to "input entire array" mode and paste the Select body
> expressions above.

### 9. Convert file (OneDrive) — `@outputs('Create_file')?['body/Id']`, type PDF
### 10. Create file — `/BFLFP Report`, same name as step 3 with `.pdf`, body `@body('Convert_file')`
### 11. Create share link (V2) — PDF file ID, View, Anonymous
### 12. Respond to Power App — `status`, `message`, `filelink` (same schema as repair branch)

## Sweeper

No `run.py` change needed — it extracts any `dd-MM-yyyy` date from the filename,
so `pmplan_12-06-2026_AIR-COMPRESSOR.pdf` files into `Report/2026/06/12/` automatically.

## Trigger inputs note

PowerApps V2 trigger names inputs `text`, `text_1`, `text_2`, `text_3` in creation
order. Create them in the order of the table in step 1 so the expressions above
line up: text=SheetName, text_1=ClassName, text_2=MakerName, text_3=ApproverName.

## Test case

SheetName `ปั๊มลมสกรู Air Compressure` / ClassName `AIR COMPRESSOR` →
2 machines (W01AC01, W01AC03), 8 tasks, 1 page. Compare output against the
historical sheet ` ปั๊มลมสกรู Air Compressure` in PMchecklist.xlsx.
