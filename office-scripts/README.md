# BFLFP Office Scripts

Office Scripts that the Power Automate flow `Power_apps_flow` calls to fill the F-SP-ENG02 report templates. These are TypeScript files meant to be pasted into Excel Online's Automate panel.

## Existing scripts (already in production)

| Script ID | Name | Form | Template |
|---|---|---|---|
| `01WFBGKTBPUTPMX6VCFBDLIHAEN2HRARRO` | (Daily report filler) | F-SP-ENG02-06 | `Maintenance_Daily_Template.xlsx` |
| `01WFBGKTF5VG23D6QYYBCI6Q5LF43Y3GT4` | `fillmaintance` | F-SP-ENG02-03 | `TemplateRepairform.xlsx` |

## New scripts in this folder

| File | Form | Template | Status |
|---|---|---|---|
| `fillToolAuthorization.ts` | F-SP-ENG02-04 | `F-SP-ENG02-04 R.00.xlsx` | Ready to install |
| `fillMachineHistory.ts` | F-SP-ENG02-02 | `Report/MachineHistory_Template.xlsx` (clean single-sheet extract with BFL logo — do NOT use Machine history.xlsx, PDF convert renders all ~150 legacy sheets) | Ready to install |
| `fillPMMonthly.ts` | F-SP-ENG02-01 | `PM_Monthly_Template.xlsx` *(create using portal print as reference)* | Ready to install — template needs creating first |
| `fillPMPlan.ts` | SD-SP-ENG02-02 | `Report/PMPlan_Template.xlsx` (clean single-sheet extract — do NOT use PMchecklist.xlsx, PDF convert renders all 85 sheets) | Ready to install — see `WIRING-fillPMPlan.md` |

## Shared conventions (all 5 scripts)

- **Pen color** `#00468C` blue for all data the script writes (mimics ink on paper)
- **`normalizeText()`** strips `\r\n` and collapses whitespace — every field passes through it
- **`formatDateOnly()`** turns any ISO date into `DD/MM/YYYY`
- **`fitTextToCellByLayout()`** (multi-page scripts only) truncates with `...` based on cell width + font, with Thai-aware character widths
- **`insertImageInMergedRange()`** drops a base64 PNG centered inside a merged range — used for signatures + before/after photos
- **`writeCheckbox()`** writes `✓` or empty + center-aligned bold
- A4 layout, zero margins, `setCenterHorizontally(true) + setCenterVertically(true)`

## How to install each new script

1. Open **Excel Online** (any workbook works for installing scripts)
2. **Automate** tab in the ribbon → **New script**
3. Open the matching `.ts` file in this folder, copy the entire contents
4. Paste into the editor, replacing the default template
5. Click **Save script as** → name it (e.g. `fillToolAuthorization`)
6. The script is now in your OneDrive at `Documents/Office Scripts/`

## How to wire each script into the Power Automate flow

In `Power_apps_flow`, add a new condition branch (or a new flow):

1. **Trigger**: PowerApps (V2) button — receives form data from the Power Apps screen
2. **Get template file** from OneDrive (the template XLSX)
3. **Create file** — copy template to a unique name in `BFLFP Report` folder
4. **Run script** action:
   - File: the just-created copy
   - Script: pick from the dropdown (`fillToolAuthorization`, etc.)
   - Script parameters: map from the trigger inputs / SharePoint Get item
5. **Convert file** (XLSX → PDF) — `OneDriveForBusiness.ConvertFile`
6. **Create file** for the PDF in `BFLFP Report` folder
7. **Create share link** (V2) → response back to Power Apps with the URL

The naming pattern for output files should match `python run.py`'s regex so the sweeper can move them into the dated archive:

```
toolauth_DD-MM-YYYY_JOBID.xlsx     toolauth_DD-MM-YYYY_JOBID.pdf
history_DD-MM-YYYY_ASSETID.xlsx    history_DD-MM-YYYY_ASSETID.pdf
pmreport_YYYY-MM_ASSETID.xlsx      pmreport_YYYY-MM_ASSETID.pdf
pmplan_DD-MM-YYYY_CLASSNAME.xlsx   pmplan_DD-MM-YYYY_CLASSNAME.pdf
```

`python run.py` extracts the date from the filename and moves the file into `Report/YYYY/MM/DD/`.

## How to see existing scripts

To view the source of `fillmaintance` and the daily-report script:

1. Open Excel Online
2. **Automate** tab → **All scripts** (left panel)
3. Click on the script name
4. Editor opens with full TypeScript source

The IDs in the flow definition (e.g. `01WFBGKTF5VG23D6QYYBCI6Q5LF43Y3GT4`) match the order they appear in the All Scripts list, so the first one is at the top.
