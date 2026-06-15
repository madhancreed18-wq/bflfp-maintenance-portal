/**
 * Office Script — fillMachineHistory
 * ----------------------------------
 * Form: F-SP-ENG02-02 Rev.02  ประวัติการซ่อมบำรุงเครื่องจักร/อุปกรณ์
 * Template: Report/MachineHistory_Template.xlsx — sheet "TEMPLATE1"
 *   (clean single-sheet extract; the full Machine history.xlsx has ~150
 *    legacy per-asset sheets which would all render in the PDF conversion)
 *
 * Template layout (verified against the actual TEMPLATE1 sheet):
 *
 *   Row 1:    A1 (merged A1:A2) = logo placeholder
 *             E1                = "F-SP-ENG02-02 Rev.02"
 *   Row 2:    B2 (merged B2:D2) = "ประวัติการซ่อมบำรุงเครื่องจักร/อุปกรณ์"
 *   Row 3:    A3 (merged A3:E3) = "รหัส :    ชื่อ :    สถานที่ตั้ง :    ชั้น :"
 *                                  ↑ ONE merged cell. We write the full filled string here.
 *   Row 4:    A4=เลขที่ใบแจ้งซ่อม | B4=วันที่ซ่อมบำรุง | C4=ปัญหา |
 *             D4=รายละเอียดการซ่อมบำรุง | E4=ผู้บันทึก
 *   Row 5+:   data rows (5 columns: JobID, Date, Problem, Solution, Recorder)
 *
 * Merged cell rule used here:
 *   When we want to fill the merged A3:E3 with asset info, we set the value of
 *   ONLY the top-left cell of the merge (A3). Excel automatically displays the
 *   value across the merged area. Trying to setValue on any other cell in the
 *   merge throws an error.
 *
 * Multi-page output: ONE sheet per page. If the asset has more events than
 * fit on one page, the template sheet is copied and pages are numbered.
 */

function main(
  workbook: ExcelScript.Workbook,
  asset: {
    AssetID: string;       // e.g. "W01AC01"
    AssetName: string;     // e.g. "ปั๊มลมสกรู #1"
    Location: string;      // e.g. "Wet Food"
    Floor: string;         // e.g. "1"
  },
  rows: {
    StartTimeISO: string;  // ISO datetime — used for sorting
    JobID: string;         // เลขที่ใบแจ้งซ่อม
    DateText: string;      // วันที่ซ่อมบำรุง (will be re-formatted to DD/MM/YYYY)
    Problem: string;       // ปัญหา
    Solution: string;      // รายละเอียดการซ่อมบำรุง
    Recorder: string;      // ผู้บันทึก
  }[]
) {
  // ============================================================
  // CONFIG — matches the TEMPLATE1 sheet you created
  // ============================================================
  const TEMPLATE_SHEET_NAME = "TEMPLATE1";
  const OUTPUT_PREFIX = "Hist_";

  // The merged cell that holds the asset-info header row
  const ASSET_HEADER_CELL = "A3";          // merged A3:E3

  // Data table
  const DATA_START_CELL = "A5";            // first data row (just below headers in row 4)
  const DATA_COLS = 5;                     // A..E
  const ROWS_PER_SHEET = 30;               // ~30 rows fit per page on portrait A4

  const PRINT_AREA = "A1:E35";

  const PEN_BLUE = "#00468C";

  // ============================================================
  // PREP
  // ============================================================
  const allRows = rows ? [...rows] : [];

  // Sort by StartTimeISO ascending — oldest first (chronological history)
  allRows.sort((a, b) => {
    const ta = Date.parse(a.StartTimeISO || "");
    const tb = Date.parse(b.StartTimeISO || "");
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta - tb;
  });

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
  // BUILD THE ASSET HEADER STRING
  // (one fully-formatted string written into the merged A3:E3 cell)
  // ============================================================
  const assetHeader = buildAssetHeader(asset);

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

    // ---- Page layout (portrait A4 — Machine history form is portrait) ----
    const pageLayout = output.getPageLayout();
    pageLayout.setOrientation(ExcelScript.PageOrientation.portrait);
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

    // ---- Write asset header into the merged A3:E3 cell ----
    // IMPORTANT: setValue on the TOP-LEFT cell of the merge (A3).
    //            Excel handles the display across the merged range automatically.
    writeMergedCell(output, ASSET_HEADER_CELL, assetHeader, PEN_BLUE);

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

    // ---- Write history rows ----
    const writeCount = Math.min(pageRows.length, ROWS_PER_SHEET);

    for (let i = 0; i < writeCount; i++) {
      const r = pageRows[i];

      const vals: string[] = [
        normalizeText(r.JobID || ""),
        formatDateOnly(r.DateText || r.StartTimeISO || ""),
        normalizeText(r.Problem || ""),
        normalizeText(r.Solution || ""),
        normalizeText(r.Recorder || "")
      ];

      for (let c = 0; c < DATA_COLS; c++) {
        const cell = output.getCell(startRow + i, startCol + c);
        const format = cell.getFormat();
        const font = format.getFont();

        format.setWrapText(true);
        format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
        font.setColor(PEN_BLUE);

        const fittedText = fitTextToCellByLayout(cell, vals[c] || "");
        cell.setValue(fittedText);
      }
    }
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
    assetId: asset.AssetID || "",
    rowsWritten: allRows.length,
    pages: pageCount,
    message: "Machine History filled successfully."
  };
}

// ============================================================
// ASSET HEADER BUILDER
// Produces the formatted string for the merged A3:E3 cell.
// Spacing is tuned so labels and values line up visually under
// each column when printed.
// ============================================================
function buildAssetHeader(asset: {
  AssetID: string;
  AssetName: string;
  Location: string;
  Floor: string;
}): string {
  const id   = normalizeText(asset.AssetID   || "");
  const name = normalizeText(asset.AssetName || "");
  const loc  = normalizeText(asset.Location  || "");
  const flr  = normalizeText(asset.Floor     || "");

  // Match the original template's spacing pattern:
  //   "รหัส : <id>      ชื่อ : <name>        สถานที่ตั้ง : <loc>        ชั้น : <flr>"
  // The merged width comfortably fits this on one line at the template's font size.
  return (
    "รหัส : " + id +
    "        ชื่อ : " + name +
    "        สถานที่ตั้ง : " + loc +
    "        ชั้น : " + flr
  );
}

// ============================================================
// MERGED-CELL WRITER
// Always sets the value on the top-left cell of the merge.
// Excel will paint the value across the entire merged range.
// If you ever pass an address that isn't the top-left of a merge,
// Excel throws an error; this helper logs and skips.
// ============================================================
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

// ============================================================
// SHARED HELPERS — same as fillDaily / fillmaintance
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
