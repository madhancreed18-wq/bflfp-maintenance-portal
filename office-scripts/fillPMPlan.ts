/**
 * Office Script — fillPMPlan
 * --------------------------
 * Form: SD-SP-ENG02-02 Rev.00  เรื่อง แผนการบำรุงรักษาเครื่องจักร/อุปกรณ์
 * Template: PMchecklist.xlsx — sheet "template"
 *
 * Fills the PM Plan / Schedule document (NOT the monthly report — that's a
 * separate form, F-SP-ENG02-01, see fillPMMonthly.ts).
 *
 * Template layout (verified):
 *
 *   Row 1-4   Header strip
 *     A1:B4       logo
 *     C1:E1       "บริษัท บลูฟาโล่ ฟู้ด โปรดักส์ จำกัด" (company title on top)
 *     F1:J1       "รหัสเอกสาร SD-SP-ENG02-02"
 *     C2:E2       "SUPPORTING DOCUMENT (เอกสารสนับสนุน)"
 *     F2:J2       "แก้ไขครั้งที่ 00"
 *     C3:E3       "เรื่อง แผนการบำรุงรักษาเครื่องจักร/อุปกรณ์"
 *     F3:J3       "ประกาศใช้เมื่อ 14 มิถุนายน 2564"
 *     C4:E4       "กลุ่มเครื่องจักร : <CLASS NAME>"   ← we fill this
 *     F4:J4       (empty, leave it)
 *
 *   Row 6-7   Table column headers (merged)
 *     A6:A7  ลำดับ
 *     B6:B7  รหัสเครื่องจักร
 *     C6:C7  ชื่อเครื่องจักร
 *     D6:D7  รายการตรวจสอบและบำรุงรักษา
 *     E6:I6  ความถี่ในการบำรุงรักษา  (sub-headers in row 7: สัปดาห์, 1 เดือน, 3 เดือน, 6 เดือน, 1 ปี)
 *     J6:J7  วิธีการบำรุงรักษา
 *
 *   Row 8+    Data rows (16 rows available before footer at row 24)
 *
 *   Row 24    Signature lines
 *     C24:H24  "ผู้จัดทำ" (Maker)  +  "ผู้อนุมัติ" (Approver)
 *     C25:H25  ( ... )    ( ... )    ← name placeholders
 *
 * IMPORTANT — parallel lists (verified against the historical filled sheets):
 * Columns B-C are a MACHINE ROSTER and columns D-J are the TASK LIST. They
 * run down the page independently — machine #1 on row 8, machine #2 on row 9,
 * while tasks 1..N occupy D8, D9, D10… So the script takes `machines` and
 * `tasks` as two separate arrays and weaves them row by row. The ลำดับ column
 * (A) numbers the MACHINES, matching the paper form.
 *
 * Frequencies use the ChecklistTasks `FrequenciesCSV` codes directly:
 *   W = สัปดาห์ (E) · M = 1 เดือน (F) · Q = 3 เดือน (G)
 *   S/6M = 6 เดือน (H) · A/Y = 1 ปี (I)
 * Multiple codes can be comma-separated ("W,A").
 *
 * Multi-page output: ONE sheet per page. If there are more than 16 rows for
 * the class, the template is copied and pages are numbered.
 */

function main(
  workbook: ExcelScript.Workbook,
  header: {
    ClassName: string;          // "AIR COMPRESSOR" or "ปั๊มลมสกรู"
    MakerName: string;          // ผู้จัดทำ (signature name)
    ApproverName: string;       // ผู้อนุมัติ (signature name)
    MakerSignBase64: string;    // signature image ("" = leave blank)
    ApproverSignBase64: string; // signature image ("" = leave blank)
  },
  machines: {
    MachineCode: string;        // รหัสเครื่องจักร — e.g. "W01AC01" (from AssetSheetMap.AssetID)
    MachineName: string;        // ชื่อเครื่องจักร — e.g. "ปั๊มลมสกรู #1"
  }[],
  tasks: {
    TaskNo: number;             // from ChecklistTasks.TaskNo
    TaskName: string;           // from ChecklistTasks.Title — e.g. "ใบมีด"
    Standard: string;           // from ChecklistTasks.Standard — e.g. "ไม่แตกหักและไม่เป็นสนิม"
    Frequencies: string;        // from ChecklistTasks.FrequenciesCSV — "W", "M", "Q", "A", "W,A"…
    Method: string;             // from ChecklistTasks.Method — เช็ค / ทำ / etc.
  }[]
) {
  // ============================================================
  // CONFIG — matches the "template" sheet in PMchecklist.xlsx
  // ============================================================
  const TEMPLATE_SHEET_NAME = "template";
  const OUTPUT_PREFIX = "Plan_";

  // Header cells
  const CLASS_HEADER_CELL = "C4";            // merged C4:E4
  const CLASS_HEADER_LABEL = "กลุ่มเครื่องจักร : ";

  // Data table
  const DATA_START_CELL = "A8";              // first data row (just below sub-header row 7)
  const DATA_COLS = 10;                      // A..J
  const ROWS_PER_SHEET = 16;                 // rows 8..23 = 16 rows before footer at row 24

  // Signature block
  const MAKER_NAME_CELL = "C25";             // merged C25:D25 → "( <name> )"
  const APPROVER_NAME_CELL = "E25";          // merged E25:H25 → "( <name> )"
  // Signature image ranges (above the lines at row 24)
  const MAKER_SIG_RANGE = "C23:D24";
  const APPROVER_SIG_RANGE = "E23:H24";

  const PRINT_AREA = "A1:J26";
  const PEN_BLUE = "#00468C";

  // ============================================================
  // PREP — weave the two parallel lists into printable rows
  // ============================================================
  const machineList = machines ? [...machines] : [];
  const taskList = tasks ? [...tasks] : [];
  const totalRows = Math.max(machineList.length, taskList.length);

  const allRows: WovenRow[] = [];
  for (let i = 0; i < totalRows; i++) {
    const m = i < machineList.length ? machineList[i] : null;
    const t = i < taskList.length ? taskList[i] : null;
    allRows.push({
      No: m ? String(i + 1) : "",                       // ลำดับ numbers the machines
      MachineCode: m ? m.MachineCode || "" : "",
      MachineName: m ? m.MachineName || "" : "",
      TaskDescription: t ? buildTaskDescription(t) : "",
      Freq: t ? parseFrequencies(t.Frequencies) : emptyFreq(),
      Method: t ? t.Method || "" : ""
    });
  }

  const template = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
  if (!template) {
    throw new Error("Template sheet not found: " + TEMPLATE_SHEET_NAME);
  }

  // Delete any old generated pages from a previous run
  const wsList = workbook.getWorksheets();
  for (let i = wsList.length - 1; i >= 0; i--) {
    const ws = wsList[i];
    if (ws.getName().startsWith(OUTPUT_PREFIX)) ws.delete();
  }

  // Capture template row heights so each copied page preserves them
  const start = template.getRange(DATA_START_CELL);
  const startRow = start.getRowIndex();
  const startCol = start.getColumnIndex();

  const templateRowHeights: number[] = [];
  for (let r = 0; r < ROWS_PER_SHEET; r++) {
    const rowRange = template.getRangeByIndexes(startRow + r, startCol, 1, DATA_COLS);
    templateRowHeights.push(rowRange.getFormat().getRowHeight());
  }

  // ============================================================
  // PAGINATE & FILL
  // ============================================================
  const pageCount = Math.max(1, Math.ceil(allRows.length / ROWS_PER_SHEET));

  for (let page = 0; page < pageCount; page++) {
    const pageRows = allRows.slice(
      page * ROWS_PER_SHEET,
      (page + 1) * ROWS_PER_SHEET
    );

    const sheetsNow = workbook.getWorksheets();
    const lastSheet = sheetsNow[sheetsNow.length - 1];

    const output = template.copy(
      ExcelScript.WorksheetPositionType.after,
      lastSheet
    );
    output.setName(OUTPUT_PREFIX + String(page + 1));

    // ---- Page layout (landscape A4 — table is wide with 10 cols) ----
    const pageLayout = output.getPageLayout();
    pageLayout.setOrientation(ExcelScript.PageOrientation.landscape);
    pageLayout.setPaperSize(ExcelScript.PaperType.a4);
    pageLayout.setPrintArea(output.getRange(PRINT_AREA));
    pageLayout.setTopMargin(0);
    pageLayout.setBottomMargin(0);
    pageLayout.setLeftMargin(0);
    pageLayout.setRightMargin(0);
    pageLayout.setHeaderMargin(0);
    pageLayout.setFooterMargin(0);
    pageLayout.setCenterHorizontally(true);
    pageLayout.setCenterVertically(true);

    // ---- Class header ----
    // C4:E4 is merged — write to top-left (C4) only.
    writeMergedCell(
      output,
      CLASS_HEADER_CELL,
      CLASS_HEADER_LABEL + normalizeText(header.ClassName || ""),
      PEN_BLUE
    );

    // ---- Clear & restore body grid ----
    const dataGrid = output.getRangeByIndexes(
      startRow,
      startCol,
      ROWS_PER_SHEET,
      DATA_COLS
    );
    dataGrid.clear(ExcelScript.ClearApplyTo.contents);

    for (let r = 0; r < ROWS_PER_SHEET; r++) {
      const rowRange = output.getRangeByIndexes(startRow + r, startCol, 1, DATA_COLS);
      rowRange.getFormat().setRowHeight(templateRowHeights[r]);
    }

    // ---- Write task rows ----
    const writeCount = Math.min(pageRows.length, ROWS_PER_SHEET);

    for (let i = 0; i < writeCount; i++) {
      const t = pageRows[i];
      const r = startRow + i;

      // A column — machine sequence number (blank on task-only rows)
      if (t.No) writeRowCell(output, r, startCol + 0, t.No, PEN_BLUE, "center");

      // B-C — machine code + machine name
      writeRowCell(output, r, startCol + 1, normalizeText(t.MachineCode), PEN_BLUE, "center");
      writeRowCell(output, r, startCol + 2, normalizeText(t.MachineName), PEN_BLUE, "left");

      // D — task description
      writeRowCell(output, r, startCol + 3, normalizeText(t.TaskDescription), PEN_BLUE, "left");

      // E-I — frequency tick marks (5 columns)
      writeTick(output, r, startCol + 4, t.Freq.weekly);
      writeTick(output, r, startCol + 5, t.Freq.monthly);
      writeTick(output, r, startCol + 6, t.Freq.quarterly);
      writeTick(output, r, startCol + 7, t.Freq.biAnnual);
      writeTick(output, r, startCol + 8, t.Freq.annual);

      // J — method
      writeRowCell(output, r, startCol + 9, normalizeText(t.Method), PEN_BLUE, "center");
    }

    // ---- Footer: maker + approver signatures ----
    // Names in row 25, signature images centered above (in rows 23-24).
    writeMergedCell(output, MAKER_NAME_CELL,
      "( " + normalizeText(header.MakerName || "                          ") + " )", PEN_BLUE);
    writeMergedCell(output, APPROVER_NAME_CELL,
      "( " + normalizeText(header.ApproverName || "                          ") + " )", PEN_BLUE);

    // Insert signature images centered in the available space above the lines
    insertImageInMergedRange(output, header.MakerSignBase64    || "", MAKER_SIG_RANGE,    120, 38);
    insertImageInMergedRange(output, header.ApproverSignBase64 || "", APPROVER_SIG_RANGE, 120, 38);
  }

  // Activate the first output page, delete the now-empty template copy
  const firstOut = workbook.getWorksheet(OUTPUT_PREFIX + "1");
  if (firstOut) {
    firstOut.activate();
    template.delete();
  } else {
    template.activate();
  }

  return {
    status: "success",
    className: header.ClassName || "",
    machines: machineList.length,
    tasks: taskList.length,
    rowsWritten: allRows.length,
    pages: pageCount,
    message: "PM Plan filled successfully."
  };
}

// ============================================================
// HELPERS
// ============================================================

interface FreqFlags {
  weekly: string;
  monthly: string;
  quarterly: string;
  biAnnual: string;
  annual: string;
}

interface WovenRow {
  No: string;
  MachineCode: string;
  MachineName: string;
  TaskDescription: string;
  Freq: FreqFlags;
  Method: string;
}

function emptyFreq(): FreqFlags {
  return { weekly: "", monthly: "", quarterly: "", biAnnual: "", annual: "" };
}

/**
 * Map ChecklistTasks.FrequenciesCSV codes to the 5 tick columns.
 * Accepts comma/slash/space-separated codes: "W", "M", "Q", "A", "W,A"…
 */
function parseFrequencies(freqCsv: string): FreqFlags {
  const f = emptyFreq();
  const codes = normalizeText(String(freqCsv || ""))
    .toUpperCase()
    .split(/[,\/\s]+/);
  for (const code of codes) {
    if (!code) continue;
    if (code === "W" || code === "WEEKLY" || code === "1W" || code === "7W") f.weekly = "✓";
    else if (code === "M" || code === "MONTHLY" || code === "1M") f.monthly = "✓";
    else if (code === "Q" || code === "QUARTERLY" || code === "3M") f.quarterly = "✓";
    else if (code === "S" || code === "6M" || code === "SEMIANNUAL" || code === "1S") f.biAnnual = "✓";
    else if (code === "A" || code === "Y" || code === "ANNUAL" || code === "1Y" || code === "12M") f.annual = "✓";
  }
  return f;
}

/** "1.ใบมีด : ไม่แตกหักและไม่เป็นสนิม" — TaskNo.TaskName : Standard (Standard optional) */
function buildTaskDescription(t: { TaskNo: number; TaskName: string; Standard: string }): string {
  const no = t.TaskNo ? String(t.TaskNo) + "." : "";
  const name = normalizeText(t.TaskName || "");
  const std = normalizeText(t.Standard || "");
  return no + name + (std ? " : " + std : "");
}

/** Write to a specific row+column index (more convenient than building "A8" strings). */
function writeRowCell(
  sheet: ExcelScript.Worksheet,
  rowIdx: number,
  colIdx: number,
  value: string,
  fontColor: string,
  align: "left" | "center" | "right"
) {
  const cell = sheet.getCell(rowIdx, colIdx);
  const text = normalizeText(value);
  const format = cell.getFormat();
  const font = format.getFont();

  format.setWrapText(true);
  format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
  if (align === "center") format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.center);
  else if (align === "right") format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.right);
  else format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.left);
  font.setColor(fontColor);

  const fittedText = fitTextToCellByLayout(cell, text);
  cell.setValue(fittedText);
}

/** Write a frequency tick (✓ if value is truthy, empty otherwise). */
function writeTick(
  sheet: ExcelScript.Worksheet,
  rowIdx: number,
  colIdx: number,
  value: string
) {
  const v = normalizeText(String(value || "")).toUpperCase();
  const checked = v === "✓" || v === "X" || v === "Y" || v === "YES" || v === "TRUE" || v === "1";

  const cell = sheet.getCell(rowIdx, colIdx);
  const format = cell.getFormat();
  const font = format.getFont();

  format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.center);
  format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
  font.setBold(true);
  font.setSize(13);

  if (checked) {
    cell.setValue("✓");
    font.setColor("#0F7B0F");
  } else {
    cell.setValue("");
  }
}

/**
 * Write to a merged cell. Sets value on the top-left cell only.
 * Excel renders it across the merged range automatically.
 */
function writeMergedCell(
  sheet: ExcelScript.Worksheet,
  cellAddress: string,
  value: string,
  fontColor: string
) {
  try {
    const cell = sheet.getRange(cellAddress);
    const text = normalizeText(String(value ?? ""));
    cell.setValue(text);
    const format = cell.getFormat();
    format.setWrapText(true);
    format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
    format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.left);
    format.getFont().setColor(fontColor);
  } catch (e) {
    console.log("writeMergedCell failed at " + cellAddress + ": " + e);
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

function fitTextToCellByLayout(cell: ExcelScript.Range, text: string): string {
  if (!text) return "";

  const format = cell.getFormat();
  const font = format.getFont();

  let colWidth = 8.43;
  let rowHeight = 15;
  let fontSize = 11;

  try { const w = format.getColumnWidth(); if (w && w > 0) colWidth = w; } catch (e) {}
  try { const h = format.getRowHeight(); if (h && h > 0) rowHeight = h; } catch (e) {}
  try { const fs = font.getSize(); if (fs && fs > 0) fontSize = fs; } catch (e) {}

  const maxLines = estimateMaxLines(rowHeight, fontSize);
  const maxUnitsPerLine = estimateUnitsPerLine(colWidth, fontSize);
  const maxUnitsTotal = maxLines * maxUnitsPerLine;

  if (measureTextUnits(text) <= maxUnitsTotal) return text;
  return trimTextByUnits(text, maxUnitsTotal);
}

function estimateMaxLines(rowHeight: number, fontSize: number): number {
  const lineHeight = fontSize * 1.25;
  const usableHeight = Math.max(0, rowHeight - 2);
  const lines = Math.floor(usableHeight / lineHeight);
  return Math.max(1, lines);
}

function estimateUnitsPerLine(colWidth: number, fontSize: number): number {
  const baseAt11 = colWidth * 1.55;
  const scaled = baseAt11 * (11 / Math.max(fontSize, 8));
  return Math.max(4, Math.floor(scaled));
}

function measureTextUnits(text: string): number {
  let units = 0;
  for (const ch of text) units += getCharUnits(ch);
  return units;
}

function trimTextByUnits(text: string, maxUnitsTotal: number): string {
  const ellipsis = "...";
  const ellipsisUnits = measureTextUnits(ellipsis);
  if (maxUnitsTotal <= ellipsisUnits) return ellipsis;
  let units = 0;
  let out = "";
  for (const ch of text) {
    const cu = getCharUnits(ch);
    if (units + cu + ellipsisUnits > maxUnitsTotal) break;
    out += ch;
    units += cu;
  }
  return out.replace(/\s+$/, "") + ellipsis;
}

function getCharUnits(ch: string): number {
  const code = ch.charCodeAt(0);
  if (ch === " ") return 0.45;
  if (code >= 48 && code <= 57) return 0.72;
  if (code >= 65 && code <= 90) return 0.82;
  if (code >= 97 && code <= 122) return 0.72;
  if (".,:;!'|".indexOf(ch) >= 0) return 0.38;
  if ("/\\-_()[]{}".indexOf(ch) >= 0) return 0.5;
  if (code >= 0x0E00 && code <= 0x0E7F) {
    if ((code >= 0x0E31 && code <= 0x0E3A) || (code >= 0x0E47 && code <= 0x0E4E)) {
      return 0.2;
    }
    return 1.0;
  }
  return 1.0;
}
