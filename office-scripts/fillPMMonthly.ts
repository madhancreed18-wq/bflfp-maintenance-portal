/**
 * Office Script — fillPMMonthly
 * -----------------------------
 * Form: F-SP-ENG02-01 Rev.01  รายงาน PM ประจำเดือน (Monthly Consolidated PM Report)
 * Template: PM_Monthly_Template.xlsx (sheet "PM Monthly")
 *   — You'll need to create this template once, modeled after the portal's PM Report
 *     print layout (the A4 landscape page with the task table + signature rows).
 *
 * Called by Power Automate when Planner/Manager clicks "Generate PM Report" in
 * Power Apps for a specific (asset, year, month).
 *
 * Single-page form: ONE template per (asset, month). Tasks fill body rows;
 * weekly tick columns fill 1-5 (W1-W5) + 1M + 3M + 6M + 1Y columns; signatures
 * fill bottom block.
 */

function main(
  workbook: ExcelScript.Workbook,
  header: {
    AssetID: string;
    AssetName: string;
    Year: string;                  // "2026"
    MonthText: string;             // "พฤษภาคม / May"
    SheetName: string;             // Checklist sheet name used for this asset
  },
  tasks: {
    No: number;                    // 1, 2, 3...
    Description: string;           // task title
    Standard: string;              // acceptance criteria
    Method: string;                // เช็ค / ทำ
    FrequencyTag: string;          // W | M | Q | S | A | D
    // Per-week ticks (W1..W5) — value: "OK" | "NG" | "NA" | ""
    W1: string; W2: string; W3: string; W4: string; W5: string;
    // Per-frequency aggregate ticks
    M1: string; Q3: string; S6: string; A1: string;
    ImageBase64: string;           // optional task photo
  }[],
  signatures: {
    // Tech signatures per period (5 weekly + 1 monthly + 1 quarterly + 1 6m + 1 annual)
    TechW1Base64: string; TechW2Base64: string; TechW3Base64: string;
    TechW4Base64: string; TechW5Base64: string;
    TechM1Base64: string; TechQ3Base64: string; TechS6Base64: string; TechA1Base64: string;
    // Supervisor sigs per period
    SupW1Base64: string; SupW2Base64: string; SupW3Base64: string;
    SupW4Base64: string; SupW5Base64: string;
    SupM1Base64: string; SupQ3Base64: string; SupS6Base64: string; SupA1Base64: string;
    // Manager sigs (final monthly signoff) — one per frequency block
    MgrW1Base64: string; MgrW2Base64: string; MgrW3Base64: string;
    MgrW4Base64: string; MgrW5Base64: string;
    MgrM1Base64: string; MgrQ3Base64: string; MgrS6Base64: string; MgrA1Base64: string;
    // Date stamps per week
    DateW1: string; DateW2: string; DateW3: string; DateW4: string; DateW5: string;
    DateM1: string; DateQ3: string; DateS6: string; DateA1: string;
  }
) {
  const TEMPLATE_SHEET_NAME = "PM Monthly";
  const PEN_BLUE = "#00468C";

  const sheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
  if (!sheet) {
    throw new Error("Template sheet not found: " + TEMPLATE_SHEET_NAME);
  }

  // -------- HEADER STRIP --------
  // Asset info strip: PM | Year | Machine | Month
  writeCell(sheet, "A3", "PM", PEN_BLUE);
  writeCell(sheet, "B3", "Annual machine inspection record: " + (header.Year || ""), PEN_BLUE);
  writeCell(sheet, "F3",
    "Machine Name: " + normalizeText(header.AssetName || "") +
    "   Code: " + normalizeText(header.AssetID || ""),
    PEN_BLUE
  );
  writeCell(sheet, "K3", "Monthly/Yearly Date: " + normalizeText(header.MonthText || ""), PEN_BLUE);

  // -------- TASK TABLE --------
  // Tasks start at row 6 in the template (row 5 = column headers, row 6 = first task).
  // 13 columns per row: A=No, B=Photo, C=Checklist, D=Standard, E-I=W1-W5, J=1M, K=3M, L=6M, M=1Y, N=Method
  const TASK_ROW_START = 6;
  const MAX_TASKS = 20;

  const allTasks = tasks ? tasks.slice(0, MAX_TASKS) : [];

  for (let i = 0; i < allTasks.length; i++) {
    const t = allTasks[i];
    const r = TASK_ROW_START + i;

    writeCell(sheet, "A" + r, String(t.No || (i + 1)), PEN_BLUE);
    // Image cell (B) — optional photo per task
    if (t.ImageBase64) {
      insertImageInMergedRange(sheet, t.ImageBase64, "B" + r + ":B" + r, 56, 42);
    }
    writeCell(sheet, "C" + r, normalizeText(t.Description || ""), PEN_BLUE);
    writeCell(sheet, "D" + r, normalizeText(t.Standard || ""), PEN_BLUE);

    // Week ticks (W1-W5)
    writeCheck(sheet, "E" + r, t.W1);
    writeCheck(sheet, "F" + r, t.W2);
    writeCheck(sheet, "G" + r, t.W3);
    writeCheck(sheet, "H" + r, t.W4);
    writeCheck(sheet, "I" + r, t.W5);

    // Monthly aggregate ticks
    writeCheck(sheet, "J" + r, t.M1);
    writeCheck(sheet, "K" + r, t.Q3);
    writeCheck(sheet, "L" + r, t.S6);
    writeCheck(sheet, "M" + r, t.A1);

    // Method
    writeCell(sheet, "N" + r, normalizeText(t.Method || ""), PEN_BLUE);
  }

  // -------- SIGNATURE BLOCK --------
  // Bottom of the form. Three rows (Tech / Sup / Mgr) x nine columns (W1..W5 + 1M+3M+6M+1Y).
  // Template should already have empty merged cells for these signature thumbnails.
  // For each period, insert sig images centred in their merged cell ranges.

  const SIG_ROW_TECH = 28;        // adjust to your template
  const SIG_ROW_SUP  = 30;
  const SIG_ROW_MGR  = 32;
  const SIG_COLS     = ["E","F","G","H","I","J","K","L","M"];
  const SIG_KEYS     = ["W1","W2","W3","W4","W5","M1","Q3","S6","A1"];

  const techSigs: { [k: string]: string } = {
    W1: signatures.TechW1Base64, W2: signatures.TechW2Base64, W3: signatures.TechW3Base64,
    W4: signatures.TechW4Base64, W5: signatures.TechW5Base64,
    M1: signatures.TechM1Base64, Q3: signatures.TechQ3Base64,
    S6: signatures.TechS6Base64, A1: signatures.TechA1Base64
  };
  const supSigs: { [k: string]: string } = {
    W1: signatures.SupW1Base64, W2: signatures.SupW2Base64, W3: signatures.SupW3Base64,
    W4: signatures.SupW4Base64, W5: signatures.SupW5Base64,
    M1: signatures.SupM1Base64, Q3: signatures.SupQ3Base64,
    S6: signatures.SupS6Base64, A1: signatures.SupA1Base64
  };
  const mgrSigs: { [k: string]: string } = {
    W1: signatures.MgrW1Base64, W2: signatures.MgrW2Base64, W3: signatures.MgrW3Base64,
    W4: signatures.MgrW4Base64, W5: signatures.MgrW5Base64,
    M1: signatures.MgrM1Base64, Q3: signatures.MgrQ3Base64,
    S6: signatures.MgrS6Base64, A1: signatures.MgrA1Base64
  };

  for (let i = 0; i < SIG_COLS.length; i++) {
    const col = SIG_COLS[i];
    const key = SIG_KEYS[i];
    insertImageInMergedRange(sheet, techSigs[key], col + SIG_ROW_TECH + ":" + col + SIG_ROW_TECH, 50, 24);
    insertImageInMergedRange(sheet, supSigs[key],  col + SIG_ROW_SUP  + ":" + col + SIG_ROW_SUP,  50, 24);
    insertImageInMergedRange(sheet, mgrSigs[key],  col + SIG_ROW_MGR  + ":" + col + SIG_ROW_MGR,  50, 24);
  }

  // Date stamps row (above tech sigs)
  const DATE_ROW = 27;
  const dateMap: { [k: string]: string } = {
    W1: signatures.DateW1, W2: signatures.DateW2, W3: signatures.DateW3,
    W4: signatures.DateW4, W5: signatures.DateW5,
    M1: signatures.DateM1, Q3: signatures.DateQ3, S6: signatures.DateS6, A1: signatures.DateA1
  };
  for (let i = 0; i < SIG_COLS.length; i++) {
    writeCell(sheet, SIG_COLS[i] + DATE_ROW, formatDateOnly(dateMap[SIG_KEYS[i]] || ""), PEN_BLUE);
  }

  // -------- PAGE LAYOUT --------
  const pageLayout = sheet.getPageLayout();
  pageLayout.setOrientation(ExcelScript.PageOrientation.landscape);
  pageLayout.setPaperSize(ExcelScript.PaperType.a4);
  pageLayout.setPrintArea(sheet.getRange("A1:N34"));
  pageLayout.setTopMargin(0);
  pageLayout.setBottomMargin(0);
  pageLayout.setLeftMargin(0);
  pageLayout.setRightMargin(0);
  pageLayout.setHeaderMargin(0);
  pageLayout.setFooterMargin(0);
  pageLayout.setCenterHorizontally(true);
  pageLayout.setCenterVertically(true);

  sheet.activate();

  return {
    status: "success",
    assetId: header.AssetID || "",
    period: (header.Year || "") + " " + (header.MonthText || ""),
    tasksWritten: allTasks.length,
    message: "PM Monthly Report filled successfully."
  };
}

// ============================================================
// SHARED HELPERS — match the other 4 scripts exactly
// ============================================================

function writeCell(
  sheet: ExcelScript.Worksheet,
  cellAddress: string,
  value: string | number | boolean | null | undefined,
  fontColor: string
) {
  const cell = sheet.getRange(cellAddress);
  const text = normalizeText(String(value ?? ""));
  cell.setValue(text);
  const format = cell.getFormat();
  format.setWrapText(true);
  format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
  format.getFont().setColor(fontColor);
}

/**
 * Write OK / NG / N-A tick into a week column. Uses the standard symbols.
 * OK = ✓ (green), NG = ✗ (red), NA = – (grey), "" = empty.
 */
function writeCheck(
  sheet: ExcelScript.Worksheet,
  cellAddress: string,
  rawValue: string
) {
  const value = normalizeText(String(rawValue || "")).toUpperCase();
  const cell = sheet.getRange(cellAddress);
  const format = cell.getFormat();
  const font = format.getFont();

  format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.center);
  format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
  font.setBold(true);
  font.setSize(13);

  if (value === "OK" || value === "✓" || value === "TRUE") {
    cell.setValue("✓");
    font.setColor("#0F7B0F");
  } else if (value === "NG" || value === "X" || value === "✗" || value === "FALSE") {
    cell.setValue("✗");
    font.setColor("#C00000");
  } else if (value === "NA" || value === "N/A" || value === "–" || value === "-") {
    cell.setValue("–");
    font.setColor("#6B6B6B");
  } else {
    cell.setValue("");
  }
}

function normalizeText(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateOnly(dateValue: string): string {
  const raw = normalizeText(dateValue);
  if (!raw) return "";
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return day + "/" + month + "/" + year;
}

function cleanBase64(base64Image: string): string {
  const raw = String(base64Image || "").trim();
  if (!raw) return "";
  if (raw.includes(",")) return raw.split(",")[1];
  return raw;
}

function insertImageInMergedRange(
  sheet: ExcelScript.Worksheet,
  base64Image: string,
  rangeAddress: string,
  width: number,
  height: number
) {
  const cleaned = cleanBase64(base64Image);
  if (!cleaned) return;
  try {
    const range = sheet.getRange(rangeAddress);
    const image = sheet.addImage(cleaned);
    const left = range.getLeft() + (range.getWidth() - width) / 2;
    const top = range.getTop() + (range.getHeight() - height) / 2;
    image.setLeft(left);
    image.setTop(top);
    image.setWidth(width);
    image.setHeight(height);
  } catch (error) {
    console.log("Image insert failed in range " + rangeAddress);
  }
}
