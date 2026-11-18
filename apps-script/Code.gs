/**
 * Villa Board — Google Sheets backend for the GitHub Pages site.
 * Paste into the spreadsheet: Extensions → Apps Script, then Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). Copy the Web app URL into the site.
 *
 * Reads are open (the sheet is already public). Every write needs the PIN below.
 */
const PIN = "CHANGE-ME";                       // ← ตั้ง PIN ของคุณที่นี่ (อย่าน้อย 4 ตัว)
const READ_SHEETS = ["Reservation", "OTA Villa Matching"];
const WRITE_SHEETS = ["Reservation"];

function doGet() {
  return out_({ ok: true, app: "villa-board" });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const tool = String(req.tool || "");
    const args = req.args || {};
    const range = String(args.range || "");
    const sheetName = range.split("!")[0].replace(/^'(.*)'$/, "$1");
    const ss = SpreadsheetApp.getActive();

    if (tool === "check_pin") return out_({ ok: pinOk_(req.pin) });

    if (tool === "get_values") {
      if (READ_SHEETS.indexOf(sheetName) < 0) return out_({ ok: false, code: "bad_range" });
      const rows = ss.getRange(range).getDisplayValues().map(r => {
        const a = r.slice(); while (a.length && a[a.length - 1] === "") a.pop(); return a;
      });
      while (rows.length && !rows[rows.length - 1].length) rows.pop();
      return out_({ ok: true, values: rows });
    }

    if (tool !== "append_values" && tool !== "update_values") return out_({ ok: false, code: "bad_tool" });
    if (!pinOk_(req.pin)) return out_({ ok: false, code: "bad_pin" });
    if (WRITE_SHEETS.indexOf(sheetName) < 0) return out_({ ok: false, code: "bad_range" });
    const values = args.values;
    if (!Array.isArray(values) || values.length !== 1 || !Array.isArray(values[0]) || values[0].length > 11)
      return out_({ ok: false, code: "bad_values" });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = ss.getSheetByName(sheetName);
      if (tool === "append_values") {
        sh.appendRow(values[0]);
        return out_({ ok: true, row: sh.getLastRow() });
      }
      const m = range.match(/!A(\d+):K(\d+)$/);
      if (!m || m[1] !== m[2] || +m[1] < 2) return out_({ ok: false, code: "bad_range" });
      const row = values[0].slice(); while (row.length < 11) row.push("");
      sh.getRange(+m[1], 1, 1, 11).setValues([row]);
      return out_({ ok: true, row: +m[1] });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, code: "tool_error", message: String(err && err.message || err) });
  }
}

function pinOk_(pin) {
  return PIN !== "CHANGE-ME" && String(pin || "") === PIN;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
