// Builds a standalone index.html (for GitHub Pages) from villa-board.html.
// Usage: node build-pages.js villa-board.html <outDir> [appsScriptUrl]
// With an Apps Script URL, bookings can be added/edited (PIN-protected); without one the page is read-only.
const fs = require("fs"), path = require("path");
const [src, outDir, urlArg] = process.argv.slice(2);
const cfgFile = path.join(outDir, "backend.json");
const url = (urlArg !== undefined ? urlArg : (fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")).url : "")) || "";
let body = fs.readFileSync(src, "utf8");
const rep = (a, b) => { if (!body.includes(a)) throw new Error("not found: " + a.slice(0, 60)); body = body.replace(a, b); };

rep("Read-only view: the shared villa database isn't available here, so villas are shown straight from the Google Sheet and can't be edited. Open this page on claude.ai to manage villas.",
  url ? "ข้อมูลดึงจาก Google Sheet โดยตรง · เพิ่ม/แก้ไขการจองได้ (ต้องใส่ PIN) · แก้ข้อมูลวิลล่าได้บน claude.ai"
      : "อ่านอย่างเดียว: ข้อมูลดึงจาก Google Sheet โดยตรง ถ้าต้องการเพิ่ม/แก้ไขการจองหรือวิลล่า ให้เปิดเวอร์ชันบน claude.ai");
rep(`moved:"This booking's row moved`, `bad_pin:"รหัส PIN ไม่ถูกต้อง กด Save อีกครั้งแล้วใส่ PIN ใหม่", no_pin:"ต้องใส่ PIN ก่อนบันทึก กด Save อีกครั้ง", net:"ติดต่อ Google Sheet ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง", moved:"This booking's row moved`);

// Stand-in for the claude.ai Google Sheets connector, backed by the Apps Script web app.
const shim = url ? `<script>
(function(){
  var URL_ = ${JSON.stringify(url)}, KEY = "vb_pin";
  function getPin(){ try { return localStorage.getItem(KEY) || ""; } catch(e){ return ""; } }
  function setPin(p){ try { p ? localStorage.setItem(KEY, p) : localStorage.removeItem(KEY); } catch(e){} }
  async function call(tool, args){
    var write = tool !== "get_values", pin = "";
    if (write) {
      pin = getPin();
      if (!pin) { pin = (window.prompt("ใส่รหัส PIN สำหรับบันทึกการจอง") || "").trim(); if (!pin) throw { code:"no_pin" }; }
    }
    var r;
    try { r = await fetch(URL_, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body: JSON.stringify({ tool: tool, args: args, pin: pin }) }); }
    catch(e){ throw { code:"net" }; }
    var j; try { j = await r.json(); } catch(e){ throw { code:"net" }; }
    if (!j.ok) { if (j.code === "bad_pin") setPin(""); throw { code: j.code === "bad_pin" ? "bad_pin" : "tool_error", message: j.message || j.code }; }
    if (write) setPin(pin);
    return { payload: { values: j.values || [], range: args.range } };
  }
  var mcp = { callTool: function(server, tool, args){ return call(tool, args || {}); } };
  window.claude = { use: function(name){ return name === "mcp" ? Promise.resolve(mcp) : Promise.reject(new Error("not available")); } };
})();
</script>` : "";
const hide = url ? `[data-act="nmark"]` : `[data-act="badd"],[data-bedit],[data-act="nmark"]`;

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}
/* GitHub Pages build: hide controls that need the claude.ai shared database${url ? "" : " or write access to the sheet"} */
${hide}{display:none!important}</style>
${shim}
</head><body>
${body}
</body></html>
`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
console.log("wrote", path.join(outDir, "index.html"), html.length, "bytes", url ? "(bookings writable via Apps Script)" : "(read-only)");
