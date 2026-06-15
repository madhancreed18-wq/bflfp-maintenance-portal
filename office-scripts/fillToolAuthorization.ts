/**
 * Office Script — fillToolAuthorization
 * --------------------------------------
 * Form: F-SP-ENG02-04 Rev.00  ใบขออนุญาตนำเครื่องมือและอุปกรณ์
 * Template: F-SP-ENG02-04 R.00.xlsx (sheet "00")
 *
 * Called by Power Automate after the user fills the tool log in Power Apps.
 * Fills the template in-place, then the flow converts to PDF.
 *
 * Conventions follow the existing two scripts:
 *   PEN_BLUE entered text, normalizeText() everywhere, checkboxes via writeCheckbox().
 *   Single-page form (no multi-page copy — Tool Auth is one visit = one page).
 */

function main(
  workbook: ExcelScript.Workbook,
  header: {
    Area: string;
    DateText: string;          // pre-formatted DD/MM/YYYY or Thai date
    ApproverName: string;
    ApproverDate: string;      // ISO or DD/MM/YYYY
    ApproverSignBase64: string;
  },
  tools: {
    Importer: string;
    Department: string;
    ToolName: string;
    QtyIn: string;
    CondIn: string;            // "P" or "X" or "" — Bring In condition
    QtyOut: string;
    CondOut: string;           // "P" or "X" or "" — Take Out condition
    Notes: string;
  }[]
) {
  const TEMPLATE_SHEET_NAME = "00";
  const PEN_BLUE = "#00468C";

  // Tool rows start at row 7 in the official form (row 7 = first tool, no. 1)
  // Form template has 8 pre-printed tools (rows 7-14) + 3 blank rows for adds (15-17)
  const ROW_START = 7;
  const MAX_ROWS = 11;          // 8 pre-printed + 3 extra blanks

  const sheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
  if (!sheet) {
    throw new Error("Template sheet not found: " + TEMPLATE_SHEET_NAME);
  }

  // -------- HEADER --------
  // Area in A4 (merged A4:G4)
  writeCell(sheet, "A4", "พื้นที่ : " + normalizeText(header.Area || ""), PEN_BLUE);
  // Date in M4 (merged M4:O4)
  writeCell(sheet, "M4", "วันที่ : " + normalizeText(header.DateText || ""), PEN_BLUE);

  // -------- TOOL ROWS --------
  const allTools = tools ? tools.slice(0, MAX_ROWS) : [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const r = ROW_START + i;
    const tool = allTools[i] || null;

    if (tool) {
      // Column B-D merged = Importer (ผู้นำเข้า)
      writeCell(sheet, "B" + r, normalizeText(tool.Importer || ""), PEN_BLUE);
      // Column E-F merged = Department (แผนก/หน่วยงาน)
      writeCell(sheet, "E" + r, normalizeText(tool.Department || ""), PEN_BLUE);
      // Column H-J merged = Tool name (รายการ)
      // We only override blank rows — pre-printed tools (rows 7-14) keep their original name
      // unless the user explicitly set a non-empty ToolName.
      const isPreprintedRow = r <= 14;
      if (!isPreprintedRow || (tool.ToolName && tool.ToolName.trim())) {
        writeCell(sheet, "H" + r, normalizeText(tool.ToolName || ""), PEN_BLUE);
      }
      // Column K = Qty In, L = Cond In
      writeCell(sheet, "K" + r, normalizeText(tool.QtyIn || ""), PEN_BLUE);
      writeConditionPill(sheet, "L" + r, tool.CondIn);
      // Column M = Qty Out, N = Cond Out
      writeCell(sheet, "M" + r, normalizeText(tool.QtyOut || ""), PEN_BLUE);
      writeConditionPill(sheet, "N" + r, tool.CondOut);
      // Column O = Notes (หมายเหตุ)
      writeCell(sheet, "O" + r, normalizeText(tool.Notes || ""), PEN_BLUE);
    }
  }

  // -------- APPROVER --------
  // Template layout (verified): M20 = "ผู้อนุมัติ" label (single cell — leave it),
  // N20:O20 = dotted signature line, N21:O21 = "( name )" placeholder,
  // N22:O22 = date dots. Write to the top-left cell of each merge.
  if (header.ApproverName && header.ApproverName.trim()) {
    writeCell(sheet, "N21", "( " + normalizeText(header.ApproverName) + " )", PEN_BLUE);
  }
  writeCell(sheet, "N22", formatDateOnly(header.ApproverDate || ""), PEN_BLUE);

  // Signature image centered over the dotted line N20:O20 (above the name row)
  insertImageInMergedRange(sheet, header.ApproverSignBase64 || "", "N20:O20", 110, 32);

  // -------- PAGE LAYOUT --------
  const pageLayout = sheet.getPageLayout();
  pageLayout.setOrientation(ExcelScript.PageOrientation.portrait);
  pageLayout.setPaperSize(ExcelScript.PaperType.a4);
  pageLayout.setPrintArea(sheet.getRange("A1:O23"));
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
    area: header.Area || "",
    date: header.DateText || "",
    toolsWritten: allTools.length,
    message: "Tool Authorization form filled successfully."
  };
}

// ============================================================
// SHARED HELPERS — same patterns as the existing two scripts
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
 * Condition pill: writes "P" (normal) in green, "X" (damaged) in red, or "" for empty.
 * Matches the paper-form legend at the bottom of F-SP-ENG02-04.
 */
function writeConditionPill(
  sheet: ExcelScript.Worksheet,
  cellAddress: string,
  rawValue: string
) {
  const value = normalizeText(String(rawValue || "")).toUpperCase();
  const cell = sheet.getRange(cellAddress);
  const format = cell.getFormat();
  const font = format.getFont();

  if (value === "P") {
    cell.setValue("P");
    font.setColor("#0F7B0F");      // green
    font.setBold(true);
  } else if (value === "X") {
    cell.setValue("X");
    font.setColor("#C00000");      // red
    font.setBold(true);
  } else {
    cell.setValue("");
  }
  format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.center);
  format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
}

function writeCheckbox(
  sheet: ExcelScript.Worksheet,
  cellAddress: string,
  checked: boolean
) {
  const cell = sheet.getRange(cellAddress);
  cell.setValue(checked ? "✓" : "");
  const format = cell.getFormat();
  format.setHorizontalAlignment(ExcelScript.HorizontalAlignment.center);
  format.setVerticalAlignment(ExcelScript.VerticalAlignment.center);
  format.getFont().setSize(12);
  format.getFont().setBold(true);
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
