// xlsx.cjs — read an Excel file into { columns, rows }
const ExcelJS = require("exceljs");

// Reads the first worksheet. Row 1 is treated as the header (column names).
// Returns { columns: string[], rows: string[][], total }.
async function readExcel(path) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  if (!ws) return { columns: [], rows: [], total: 0 };

  const cellText = (cell) => {
    const v = cell && cell.value;
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
      if (v.text !== undefined) return String(v.text); // rich text / hyperlink
      if (v.result !== undefined) return String(v.result); // formula
      if (v instanceof Date) return v.toLocaleDateString("es-ES");
      return String(v);
    }
    return String(v);
  };

  const header = ws.getRow(1);
  const columns = [];
  header.eachCell({ includeEmpty: false }, (cell, col) => { columns[col - 1] = cellText(cell) || `Columna ${col}`; });
  const colCount = columns.length;

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const out = [];
    for (let c = 1; c <= colCount; c++) out.push(cellText(row.getCell(c)));
    if (out.some((x) => x !== "")) rows.push(out);
  });

  return { columns, rows, total: rows.length };
}

module.exports = { readExcel };
