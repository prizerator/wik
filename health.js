"use strict";
/* Раздел «Здоровье»: документы и файлы лежат на твоём Google Диске (wikivazr/Здоровье).
   В репозитории только этот код, никаких данных. */
(function(){
const HK = "wiki-health", HGK = "wiki-health-g", DB_NAME = "health-db.json", DIR = "Здоровье";
const CATS0 = ["Анализы", "Исследования", "Справки", "Прочее"];
const DRV = "drive/v3/files";
const q$ = s => document.querySelector(s);
const GICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" fill="var(--accent)"/></svg>';
const hesc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hfmt = d => d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "";
const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е");
const safe = s => String(s).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

let H = {docs:[], cats:CATS0, patient:""};
try { const v = JSON.parse(localStorage.getItem(HK)); if (v && Array.isArray(v.docs)) H = {docs:v.docs, cats:v.cats || CATS0, patient:v.patient || ""}; } catch(e) {}
let hg = {rootId:"", fileId:"", subs:{}};
try { const v = JSON.parse(localStorage.getItem(HGK)); if (v) hg = {rootId:v.rootId || "", fileId:v.fileId || "", subs:v.subs || {}}; } catch(e) {}
const hsave = () => { try { localStorage.setItem(HK, JSON.stringify(H)); } catch(e) { toast("Не хватило места в браузере"); } };
const hsaveG = () => { try { localStorage.setItem(HGK, JSON.stringify(hg)); } catch(e) {} };
const hs = {cat:"Все", country:"Все", flags:false, status:""};
let editing = null, docOpen = null, pending = [], gem = null, viewing = null;
const urlCache = new Map();

/* ---------- стили ---------- */
const css = document.createElement("style");
css.textContent = `
#health{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 24px;-webkit-overflow-scrolling:touch}
#health .htop{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 10px}
#health .hst{color:var(--muted);font-size:13px;margin:2px 0 8px}
.hbtn{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:7px 12px;font-weight:600;font-size:14px}
.hbtn,.hf,#health .chip{border-width:2px}
.hbtn.pri,#health .chip[aria-pressed="true"],.hptabs .on{background:linear-gradient(var(--surface),var(--surface)) padding-box,var(--stroke) border-box;border-color:transparent;color:var(--ink);font-weight:700}
.hbtn{box-shadow:0 1px 0 rgba(0,0,0,.03)}
.hbtn.sm{padding:4px 9px;font-size:13px}
.hbtn.sq{padding:0;width:38px;height:36px;display:inline-flex;align-items:center;justify-content:center}.hbtn.sq.sm{width:34px;height:30px}
.hbtn.del{color:var(--danger);border-color:var(--danger)}
.hyear{font-weight:700;color:var(--muted);margin:16px 0 6px;font-size:14px}
.hcard{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:11px 12px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px}
.hrow{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.hdate{color:var(--muted);font-variant-numeric:tabular-nums;font-size:13px}
.htitle{font-weight:700;background:none;border:0;padding:0;color:var(--ink);text-align:left;font-size:16px}
.hb{display:inline-block;background:var(--bg);border-radius:999px;padding:1px 8px;font-size:12px;color:var(--muted)}
.hb.flag{background:var(--want-bg);color:var(--want)}
.horg{color:var(--muted);font-size:13px}
.hnote{font-size:14px}
.hatt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px dashed var(--line);border-radius:10px;padding:6px 8px}
.hatt .lbl{font-size:12px;color:var(--muted)}
.hf{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:8px;padding:4px 9px;font-size:13px}
.hf small{color:var(--muted);margin-left:4px}
.htools{display:flex;flex-wrap:wrap;gap:6px}
.hv{border-collapse:collapse;width:100%;font-size:13px}
.hv th,.hv td{border:1px solid var(--line);padding:3px 7px;text-align:left}
.hv th{background:var(--bg)}
.hv tr.H td{background:var(--want-bg)}
.hv tr.L td{background:var(--low-bg,#e6eeff)}
.hv tr.match td{outline:2px solid var(--accent);outline-offset:-2px}
.htrend{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.htrend h3{margin:0 0 6px;font-size:14px}
.htrend .ln{display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0}
.htrend .nm{font-weight:700;margin-right:6px}
.htrend .pt{background:var(--bg);border-radius:8px;padding:1px 7px}
.htrend .pt.H{color:var(--want)}.htrend .pt.L{color:#8fb0ff}
mark{background:#e9d58a;color:#2a2147;border-radius:3px}
.hmodal{position:fixed;inset:0;z-index:40;background:rgba(8,10,14,.6);display:none;align-items:center;justify-content:center}
.hpanel{background:var(--bg);display:flex;flex-direction:column;width:100%;height:100%;min-height:0}
#hview .hmh,#hview .hmb{width:100%}#hview{background:var(--bg);flex-direction:column;align-items:stretch;justify-content:flex-start}
@media (min-width:700px){.hpanel{max-width:780px;height:auto;max-height:92vh;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);border:1px solid var(--line)}}
.hmodal.on{display:flex;animation:fadein .16s ease}
.hmodal.on .hpanel{animation:rise .24s cubic-bezier(.2,.7,.3,1)}
.hbtn,.hf{transition:background-color .18s,border-color .18s,transform .1s}.hbtn:active,.hf:active{transform:scale(.95)}
.hmh{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--surface)}
.hmh .t{flex:1;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis}
.hmb{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 14px calc(14px + env(safe-area-inset-bottom))}
.hgrid{display:flex;flex-direction:column;gap:14px}
.hmeta{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:14px;margin-bottom:8px}
.hmeta .k{color:var(--muted)}
.hptabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}

.hpv{border:1px solid var(--line);border-radius:12px;background:var(--surface);min-height:30vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hpv iframe{width:100%;height:62vh;border:0;background:#f1edf8}
.hpv img{max-width:100%;max-height:72vh;cursor:zoom-in}
.hform{display:flex;flex-direction:column;gap:10px;max-width:640px;margin:0 auto}
.hform label{font-size:13px;color:var(--muted);display:block;margin-bottom:3px}
.hform input,.hform select,.hform textarea{width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.hform textarea{min-height:70px}
.hform .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hform .st{font-size:13px;margin-top:4px}.hform .st.ok{color:var(--done)}.hform .st.err{color:var(--danger)}
.hfi{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:var(--surface)}
.hfi .th{width:46px;height:46px;object-fit:cover;border-radius:6px}
.hfi .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.hfi select{width:auto}
.hdrop{border:2px dashed var(--line);border-radius:12px;padding:14px;text-align:center;color:var(--muted)}
.hprog{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#221b3d;color:#fff;padding:10px 16px;border-radius:12px;z-index:60;max-width:92%;font-size:14px;display:none}
`;
document.head.appendChild(css);
const hroot = document.createElement("div");
hroot.innerHTML = `<div class="hmodal" id="hdoc"></div><div class="hmodal" id="hedit"></div><div class="hmodal" id="hview"></div><div class="hprog" id="hprog"></div>`;
while (hroot.firstChild) document.body.appendChild(hroot.firstChild);
const progress = (t) => { const e = q$("#hprog"); if (!t){ e.style.display = "none"; return; } e.textContent = t; e.style.display = "block"; };

/* ---------- Google Диск ---------- */
const jget = async (path, tk) => (await drive(path, {}, tk)).json();
async function ensureRoot(tk){
  if (hg.rootId) return hg.rootId;
  const fid = await ensureFile(tk);
  const r = await jget(`${DRV}/${fid}?fields=parents`, tk);
  hg.rootId = r.parents && r.parents[0]; hsaveG();
  if (!hg.rootId) throw new Error("Не нашёл папку wikivazr на Диске");
  return hg.rootId;
}
async function ensureFolder(tk, name, parent){
  const key = parent + "/" + name;
  if (hg.subs[key]) return hg.subs[key];
  let id = await findOldest(`mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and trashed=false`, tk);
  if (!id){
    const r = await (await drive(`${DRV}?fields=id`, {method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name, mimeType:"application/vnd.google-apps.folder", parents:[parent]})}, tk)).json();
    id = r.id;
  }
  hg.subs[key] = id; hsaveG(); return id;
}
const healthDir = async tk => ensureFolder(tk, DIR, await ensureRoot(tk));
const catDir = async (tk, cat) => ensureFolder(tk, cat, await healthDir(tk));
async function uploadFile(tk, folderId, name, blob, mime){
  const b = "wv" + Math.random().toString(36).slice(2);
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name, parents:[folderId]})}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${b}--`]);
  return (await drive("upload/drive/v3/files?uploadType=multipart&fields=id,name", {method:"POST", headers:{"Content-Type":"multipart/related; boundary=" + b}, body}, tk)).json();
}
const replaceFile = (tk, id, blob, mime) => drive(`upload/drive/v3/files/${id}?uploadType=media`, {method:"PATCH", headers:{"Content-Type":mime}, body:blob}, tk);
const trashFile = (tk, id) => drive(`${DRV}/${id}`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({trashed:true})}, tk);
const mimeOf = n => { const e = (String(n).match(/\.([^.]+)$/) || [])[1]; return ({pdf:"application/pdf", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", html:"text/html", htm:"text/html"}[(e || "").toLowerCase()]) || "application/octet-stream"; };

async function ensureDb(tk){
  if (hg.fileId){
    try { const r = await jget(`${DRV}/${hg.fileId}?fields=id,trashed`, tk); if (!r.trashed) return hg.fileId; }
    catch(e) { if (e.status !== 404) throw e; }
    hg.fileId = "";
  }
  const folder = await healthDir(tk);
  let f = await findOldest(`name='${DB_NAME}' and '${folder}' in parents and trashed=false`, tk);
  if (!f){
    const mp = multipart({name:DB_NAME, parents:[folder], mimeType:"application/json"}, JSON.stringify({docs:[], cats:CATS0, patient:""}));
    f = (await (await drive("upload/drive/v3/files?uploadType=multipart&fields=id", {method:"POST", headers:{"Content-Type":mp.type}, body:mp.body}, tk)).json()).id;
  }
  hg.fileId = f; hsaveG(); return f;
}
const byId = a => [...a].sort((x, y) => String(x.id).localeCompare(String(y.id)));
let syncing = false, again = false;
async function hSync(interactive){
  if (syncing){ again = true; return; }
  if (!navigator.onLine){ hs.status = "Нет сети, документы сохранены на устройстве"; render(); return; }
  syncing = true; hs.status = "Синхронизирую…"; render();
  try {
    const tk = await getToken(interactive);
    const id = await ensureDb(tk);
    let remote = {docs:[]};
    try { remote = await jget(`${DRV}/${id}?alt=media`, tk); } catch(e) { if (e.status) throw e; }
    const rdocs = Array.isArray(remote.docs) ? remote.docs : [];
    const docs = mergeItems(H.docs, rdocs);
    H = {docs, cats:[...new Set([...(remote.cats || []), ...H.cats])], patient:H.patient || remote.patient || ""};
    hsave();
    if (JSON.stringify(byId(docs)) !== JSON.stringify(byId(rdocs)) || H.patient !== (remote.patient || "")){
      await drive(`upload/drive/v3/files/${id}?uploadType=media`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(H)}, tk);
    }
    hs.status = "Синхронизировано в " + new Date().toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
  } catch(e) {
    hs.status = e.message === "auth" ? "Нужно войти: нажми на кружок сверху" : e.message === "Failed to fetch" ? "Не удалось связаться с Google" : "Ошибка: " + e.message;
  } finally {
    syncing = false;
    if (again){ again = false; setTimeout(() => hSync(false), 300); }
  }
  render();
}
let tm = null;
const later = () => { clearTimeout(tm); tm = setTimeout(() => { if (tokenValid()) hSync(false); }, 1200); };
const commit = () => { hsave(); later(); };

/* ---------- список ---------- */
const docs = () => H.docs.filter(d => !d.deleted);
const terms = () => norm(ui.q).split(/\s+/).filter(Boolean);
function hl(text){
  let t = hesc(text); const ts = terms(); if (!ts.length) return t;
  ts.forEach(w => { try { t = t.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); } catch(e) {} });
  return t;
}
const hay = d => norm([d.title, d.title_pl, d.org, d.doctor, d.tags, d.note, d.cat, d.country, d.date, hfmt(d.date), (d.values || []).map(x => x[0]).join(" "), (d.files || []).map(f => f.name || f.path || "").join(" ")].join(" "));
const hasFlag = d => (d.values || []).some(x => x[4]);
function filtered(){
  const ts = terms();
  return docs().filter(d => {
    if (hs.cat !== "Все" && d.cat !== hs.cat) return false;
    if (hs.country !== "Все" && d.country !== hs.country) return false;
    if (hs.flags && !hasFlag(d)) return false;
    if (ts.length){ const h = hay(d); return ts.every(w => h.includes(w)); }
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
function trend(list){
  const ts = terms(); if (!ts.length) return "";
  const map = {};
  list.forEach(d => (d.values || []).forEach(v => {
    const n = norm(v[0]); if (!ts.every(w => n.includes(w))) return;
    const key = v[0].replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+–.*$/, "").trim();
    (map[key] = map[key] || []).push({date:d.date, res:v[1], unit:v[2], flag:v[4]});
  }));
  const keys = Object.keys(map); if (!keys.length) return "";
  return `<div class="htrend"><h3>Значения по датам</h3>` + keys.slice(0, 8).map(k => {
    const pts = map[k].sort((a, b) => a.date.localeCompare(b.date));
    return `<div class="ln"><span class="nm">${hesc(k)}</span>` + pts.map(p => `<span class="pt ${p.flag || ""}">${hfmt(p.date)}: <b>${hesc(p.res)}</b> ${hesc(p.unit)}${p.flag === "H" ? " ↑" : p.flag === "L" ? " ↓" : ""}</span>`).join("") + `</div>`;
  }).join("") + `</div>`;
}
const isImgPath = p => !/\.(pdf|html?)$/i.test(p || "");
const nImgs = d => (d.files || []).filter(f => f.kind === "orig" && f.fid && isImgPath(f.name || f.path)).length;
function fileBtns(d){
  return (d.files || []).map((f, i) => {
    const icon = f.kind === "dicom" ? "🗂" : f.kind === "extra" ? "🖼" : /\.(pdf|html?)$/i.test(f.name || f.path || "") ? "📄" : "📷";
    const num = (f.label || "").match(/\d+$/), pg = (f.label || "").match(/\((\d+) стр\.\)/);
    const label = f.kind === "orig" ? "Оригинал" + (num ? " " + num[0] : "") + (pg ? " · " + pg[1] + " стр." : "") : f.kind === "tr" ? "Перевод" : f.kind === "dicom" ? "Снимки (ZIP)" : (f.label || "Файл");
    return `<button type="button" class="hf" data-f="${i}">${icon} ${hesc(label)}${f.lang && f.kind !== "extra" ? `<small>${hesc(f.lang)}</small>` : ""}</button>`;
  }).join("");
}
function valTable(d, onlyMatch){
  if (!d.values || !d.values.length) return "";
  const ts = terms();
  const rows = d.values.filter(v => !onlyMatch || (ts.length && ts.every(w => norm(v[0]).includes(w))));
  if (!rows.length) return "";
  return `<table class="hv"><tr><th>Показатель</th><th>Результат</th><th>Ед.</th><th>Норма</th></tr>` + rows.map(v => {
    const m = ts.length && ts.every(w => norm(v[0]).includes(w));
    return `<tr class="${v[4] || ""}${m ? " match" : ""}"><td>${hl(v[0])}</td><td><b>${hesc(v[1])}${v[4] === "H" ? " ↑" : v[4] === "L" ? " ↓" : ""}</b></td><td>${hesc(v[2])}</td><td>${hesc(v[3])}</td></tr>`;
  }).join("") + `</table>`;
}
const badges = d => {
  const fl = (d.values || []).filter(v => v[4]).length;
  return [d.cat, d.lang && d.lang !== "—" ? "ориг. " + d.lang : null].filter(Boolean).map(b => `<span class="hb">${hesc(b)}</span>`).join("") + (fl ? `<span class="hb flag">отклонений: ${fl}</span>` : "");
};
function toolBtns(d, inCard){
  const n = nImgs(d);
  return (inCard ? `<button type="button" class="hbtn sm" data-open="${d.id}">👁 Открыть карточку</button>` : "") +
    `<button type="button" class="hbtn sm" data-edit="${d.id}">✎ Изменить</button>` +
    (n > 1 ? `<button type="button" class="hbtn sm" data-merge="${d.id}">📑 Склеить ${n} фото в PDF</button>` : "");
}
function chips(){
  const all = docs();
  const cats = ["Все", ...H.cats.filter(k => all.some(d => d.cat === k))];
  const countries = ["Все", ...new Set(all.map(d => d.country).filter(Boolean))];
  const chip = (on, attr, label, n, vn) => `<button type="button" class="chip" ${attr} aria-pressed="${on}"${on && vn ? ` style="view-transition-name:${vn}"` : ""}>${hesc(label)}${n != null ? ` <small>${n}</small>` : ""}</button>`;
  return `<div class="htop">${cats.map(k => chip(hs.cat === k, `data-cat="${hesc(k)}"`, k === "Все" ? "Все разделы" : k, k === "Все" ? all.length : all.filter(d => d.cat === k).length, "selcat")).join("")}</div>` +
    `<div class="htop">${countries.length > 2 ? countries.map(k => chip(hs.country === k, `data-country="${hesc(k)}"`, k === "Все" ? "Все страны" : k, null, "selcountry")).join("") : ""}${chip(hs.flags, "data-flags", "↑↓ только с отклонениями", null, "selflag")}</div>`;
}
function render(){
  const box = q$("#health"); if (!box || box.hidden) return;
  const list = filtered();
  let html = `<div class="htop"><button type="button" class="hbtn pri" data-act="add">+ Добавить документ</button><button type="button" class="hbtn sq" data-act="copy" title="Скопировать запрос для Gemini" aria-label="Скопировать запрос для Gemini">${GICON}</button><button type="button" class="hbtn" data-act="import">📁 Подключить старую Медкарту</button><button type="button" class="hbtn" data-act="verify">✔ Проверить перенос</button><button type="button" class="hbtn" data-act="sync">⟳</button></div>`;
  html += `<div class="hst">${hesc(hs.status || "")}</div>` + chips() + trend(list);
  if (!list.length) html += `<div class="empty" style="color:var(--muted);text-align:center;padding:30px 10px">${docs().length ? "Ничего не нашлось" : "Пока пусто. Нажми «Добавить документ» или перенеси старую Медкарту."}</div>`;
  let year = "";
  list.forEach(d => {
    const y = (d.date || "").slice(0, 4);
    if (y !== year){ year = y; html += `<div class="hyear">${y}</div>`; }
    const m = valTable(d, true);
    html += `<div class="hcard"><div class="hrow"><span class="hdate">${hfmt(d.date)}</span><button type="button" class="htitle" data-open="${d.id}">${hl(d.title)}</button><span>${badges(d)}</span></div>` +
      (d.org ? `<div class="horg">${hl(d.org)}</div>` : "") + (d.note ? `<div class="hnote">${hl(d.note)}</div>` : "") + (m ? `<div>${m}</div>` : "") +
      `<div class="hatt"><span class="lbl">Вложения</span>${fileBtns(d)}</div><div class="htools" data-doc="${d.id}">${toolBtns(d, false)}</div></div>`.replace(/data-doc="[^"]*"/, `data-doc="${d.id}"`);
  });
  box.innerHTML = html;
}
// файлы на карточке: определяем документ по ближайшему блоку
function docOfEl(el){
  const card = el.closest(".hcard"); if (!card) return docOpen;
  const t = card.querySelector("[data-edit]"); return t ? H.docs.find(d => d.id === t.dataset.edit) : null;
}

/* ---------- просмотр ---------- */
const needAuthMsg = "Чтобы открыть файл, нужно войти в Google: нажми на кружок сверху и повтори";
async function fileUrl(f){
  if (urlCache.has(f.fid)) return urlCache.get(f.fid);
  const tk = await getToken(true);
  const blob = await (await drive(`${DRV}/${f.fid}?alt=media`, {}, tk)).blob();
  const u = URL.createObjectURL(new Blob([blob], {type:f.mime || mimeOf(f.name || f.path)}));
  urlCache.set(f.fid, u); return u;
}
const rank = f => f.kind === "tr" ? (f.lang === "RU" ? 0 : 1) : f.kind === "orig" ? 2 : 3;
const fileTitle = f => f.kind === "orig" ? "Оригинал" + ((f.label || "").match(/\d+$/) ? " " + f.label.match(/\d+$/)[0] : "") : f.kind === "tr" ? "Перевод " + f.lang : (f.label || "Файл");
function viewerHtml(f, u, big){
  const name = f.name || f.path || "";
  if (/\.pdf$/i.test(name)){
    if (navigator.pdfViewerEnabled === false) return `<div style="padding:20px;text-align:center"><a class="hbtn pri" href="${u}" target="_blank" rel="noopener">📄 Открыть PDF</a></div>`;
    return `<iframe src="${u}#navpanes=0&view=FitH"></iframe>`;
  }
  if (/\.html?$/i.test(name)) return `<iframe sandbox src="${u}"></iframe>`;
  return `<img src="${u}" alt="" ${big ? "" : `data-big="1"`}>`;
}
function closeM(id){ q$(id).classList.remove("on"); q$(id).innerHTML = ""; }
async function showPreview(d, prev, k){
  const f = prev[k].f, pv = q$("#hpv");
  q$("#hptabs").querySelectorAll("button").forEach((b, j) => b.classList.toggle("on", j === k));
  if (!f.fid){ pv.innerHTML = `<div style="padding:20px;color:var(--muted)">Этот файл не на Диске</div>`; return; }
  if (!urlCache.has(f.fid) && !tokenValid()){
    pv.innerHTML = `<div style="padding:20px;text-align:center"><button type="button" class="hbtn pri" id="hlogin">Войти в Google и открыть</button></div>`;
    q$("#hlogin").onclick = () => showPreview(d, prev, k); return;
  }
  pv.innerHTML = `<div style="padding:20px;color:var(--muted)">Загружаю…</div>`;
  try {
    const u = await fileUrl(f);
    pv.innerHTML = viewerHtml(f, u, false);
    const im = pv.querySelector("img"); if (im) im.onclick = () => openViewer(d, f);
  } catch(e) { pv.innerHTML = `<div style="padding:20px;color:var(--danger)">${hesc(e.message === "auth" ? needAuthMsg : "Не получилось открыть: " + e.message)}</div>`; }
}
function openDoc(d){
  docOpen = d;
  const meta = [["Дата", hfmt(d.date)], ["Раздел", d.cat], ["Клиника", d.org], ["Врач", d.doctor], ["Страна", d.country], ["Язык оригинала", d.lang && d.lang !== "—" ? d.lang : ""], ["Метки", d.tags]].filter(x => x[1]).map(x => `<div class="k">${x[0]}</div><div>${hesc(x[1])}</div>`).join("");
  const m = q$("#hdoc");
  m.innerHTML = `<div class="hpanel"><div class="hmh"><div class="t">${hesc(d.title)}</div><button type="button" class="hbtn sm" id="hdx">✕</button></div><div class="hmb"><div class="hgrid">
    <div><div class="hmeta">${meta}</div>${d.note ? `<div class="hnote" style="margin-bottom:8px">${hesc(d.note)}</div>` : ""}${valTable(d, false)}</div>
    <div><div class="hatt"><span class="lbl">Вложения</span>${fileBtns(d)}</div><div class="htools" style="margin-top:8px">${toolBtns(d, false)}</div></div>
    <div><div class="hptabs" id="hptabs"></div><div class="hpv" id="hpv"></div></div></div></div></div>`;
  m.classList.add("on");
  q$("#hdx").onclick = () => { closeM("#hdoc"); docOpen = null; };
  const prev = (d.files || []).map((f, i) => ({f, i})).filter(x => x.f.kind !== "dicom").sort((a, b) => rank(a.f) - rank(b.f));
  q$("#hptabs").innerHTML = prev.map((x, k) => `<button type="button" class="hf" data-k="${k}">${hesc(fileTitle(x.f))}</button>`).join("");
  q$("#hptabs").onclick = e => { const b = e.target.closest("[data-k]"); if (b) showPreview(d, prev, +b.dataset.k); };
  if (prev.length) showPreview(d, prev, 0); else q$("#hpv").innerHTML = `<div style="padding:20px;color:var(--muted)">Нет файлов для просмотра</div>`;
}
async function openViewer(d, f){
  if (f.kind === "dicom" && f.fid){
    try { const u = await fileUrl(f), a = document.createElement("a"); a.href = u; a.download = f.name || "dicom.zip"; document.body.appendChild(a); a.click(); a.remove(); toast("Скачиваю архив со снимками: распакуй и открой в RadiAnt или MicroDicom"); }
    catch(e) { toast(e.message === "auth" ? needAuthMsg : "Не получилось: " + e.message); }
    return;
  }
  if (!f.fid){ toast("Этот файл не загружен на Диск"); return; }
  viewing = {d, f};
  const v = q$("#hview"); const img = isImgPath(f.name || f.path);
  v.innerHTML = `<div class="hmh"><div class="t">${hesc(d.title)} — ${hesc(fileTitle(f))}</div>${img ? `<button type="button" class="hbtn sm" data-rot="-90">⟲</button><button type="button" class="hbtn sm" data-rot="90">⟳</button>` : ""}<button type="button" class="hbtn sm" id="hvx">✕</button></div><div class="hmb" id="hvb" style="display:flex;align-items:center;justify-content:center;padding:6px">Загружаю…</div>`;
  v.classList.add("on");
  q$("#hvx").onclick = () => { closeM("#hview"); viewing = null; };
  v.querySelectorAll("[data-rot]").forEach(b => b.onclick = () => rotateSaved(+b.dataset.rot));
  try {
    const u = await fileUrl(f);
    q$("#hvb").innerHTML = viewerHtml(f, u, true).replace("<iframe", `<iframe style="width:100%;height:100%"`).replace("<img", `<img style="max-width:100%;max-height:100%"`);
  } catch(e) { q$("#hvb").textContent = e.message === "auth" ? needAuthMsg : "Не получилось открыть: " + e.message; }
}
async function rotateSaved(deg){
  if (!viewing) return;
  const {d, f} = viewing;
  try {
    progress("Поворачиваю и сохраняю на Диск…");
    const tk = await getToken(true);
    const src = await (await drive(`${DRV}/${f.fid}?alt=media`, {}, tk)).blob();
    const j = await toJpeg(src, (deg + 360) % 360);
    await replaceFile(tk, f.fid, j.blob, "image/jpeg");
    if (urlCache.has(f.fid)){ URL.revokeObjectURL(urlCache.get(f.fid)); urlCache.delete(f.fid); }
    d.updated = Date.now(); commit();
    progress("");
    openViewer(d, f);
    if (docOpen) openDoc(docOpen);
  } catch(e) { progress(""); toast("Не получилось: " + (e.message === "auth" ? "нужно войти в Google" : e.message)); }
}

/* ---------- картинки и PDF ---------- */
async function toJpeg(blob, rot){
  const bmp = await createImageBitmap(blob, {imageOrientation:"from-image"});
  let w = bmp.width, h = bmp.height; const k = Math.min(1, 2800 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const side = rot === 90 || rot === 270;
  const c = document.createElement("canvas"); c.width = side ? h : w; c.height = side ? w : h;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(bmp, -w / 2, -h / 2, w, h);
  const out = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.9));
  return {blob:out, data:new Uint8Array(await out.arrayBuffer()), w:c.width, h:c.height};
}
function pdfFromJpegs(pages){
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = x => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  push("%PDF-1.4\n"); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
  const obj = (id, body) => { offs[id] = len; push(id + " 0 obj\n" + body + "\nendobj\n"); };
  const n = pages.length, kids = pages.map((_, i) => (3 + i * 3) + " 0 R").join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [" + kids + "] /Count " + n + " >>");
  pages.forEach((p, i) => {
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2, W = 595, Hh = Math.round(595 * p.h / p.w);
    obj(pid, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + Hh + "] /Resources << /XObject << /Im0 " + iid + " 0 R >> >> /Contents " + cid + " 0 R >>");
    const cs = "q " + W + " 0 0 " + Hh + " 0 0 cm /Im0 Do Q";
    obj(cid, "<< /Length " + cs.length + " >>\nstream\n" + cs + "\nendstream");
    offs[iid] = len;
    push(iid + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.data.length + " >>\nstream\n");
    push(p.data); push("\nendstream\nendobj\n");
  });
  const tot = 2 + n * 3, x = len;
  let xr = "xref\n0 " + (tot + 1) + "\n0000000000 65535 f \n";
  for (let id = 1; id <= tot; id++) xr += String(offs[id]).padStart(10, "0") + " 00000 n \n";
  push(xr + "trailer\n<< /Size " + (tot + 1) + " /Root 1 0 R >>\nstartxref\n" + x + "\n%%EOF\n");
  return new Blob(parts, {type:"application/pdf"});
}
async function mergeExisting(d){
  const imgs = (d.files || []).filter(f => f.kind === "orig" && f.fid && isImgPath(f.name || f.path));
  if (imgs.length < 2) return;
  if (!confirm("Склеить " + imgs.length + " фото в один PDF? Отдельные фото переедут в корзину Диска, останется PDF.")) return;
  try {
    progress("Склеиваю " + imgs.length + " фото…");
    const tk = await getToken(true);
    const pages = [];
    for (const f of imgs) pages.push(await toJpeg(await (await drive(`${DRV}/${f.fid}?alt=media`, {}, tk)).blob(), 0));
    const pdf = pdfFromJpegs(pages);
    const olang = d.lang && d.lang !== "—" ? d.lang : "ОРИГ";
    const name = safe(d.date + " " + d.title) + " [" + olang + "].pdf";
    const up = await uploadFile(tk, await catDir(tk, d.cat), name, pdf, "application/pdf");
    const first = d.files.indexOf(imgs[0]);
    d.files = d.files.filter(f => !imgs.includes(f));
    d.files.splice(Math.min(first, d.files.length), 0, {fid:up.id, name:up.name, kind:"orig", lang:olang === "ОРИГ" ? "" : olang, label:"Оригинал (" + pages.length + " стр.)", mime:"application/pdf"});
    for (const f of imgs){ try { await trashFile(tk, f.fid); } catch(e) {} }
    d.updated = Date.now(); commit(); progress("");
    toast("Склеено в один PDF: " + pages.length + " стр."); render(); if (docOpen === d) openDoc(d);
  } catch(e) { progress(""); toast("Не получилось: " + (e.message === "auth" ? "нужно войти в Google" : e.message)); }
}

/* ---------- запрос для Gemini и разбор ответа ---------- */
const PROMPT = `Ты помогаешь вести мой личный медицинский архив. Я прикрепляю фото или PDF медицинского документа (анализ, УЗИ, МРТ, справка, выписка и т.п.).

Ответь ТОЛЬКО одним блоком JSON — без текста до и после — строго по схеме:
{
  "date": "ГГГГ-ММ-ДД — дата сдачи анализа / проведения исследования",
  "title": "короткое название по-русски, например «Общий анализ крови», «УЗИ почек», «Липидограмма»",
  "cat": "одно из: Анализы | Исследования | Справки | Прочее",
  "lang": "язык оригинала: RU | PL | KA | EN | другое",
  "country": "одно из: Польша | Грузия | Беларусь | другая",
  "org": "клиника или лаборатория и город, по-русски",
  "doctor": "врач, если указан",
  "tags": "5–10 слов по-русски для поиска (органы, показатели, тип исследования)",
  "note": "1–2 предложения по-русски: главный вывод/заключение и что вне нормы",
  "values": [["показатель по-русски", "значение", "единицы", "норма", "H если выше нормы, L если ниже, иначе пусто"]],
  "translation_ru": "полный перевод документа на русский, если оригинал НЕ на русском; иначе пустая строка",
  "translation_pl": "полный перевод документа на польский, если оригинал НЕ на польском и НЕ на русском; иначе пустая строка",
  "pages": [{"rotate": 0}]
}

"pages" — по одному элементу на КАЖДОЕ прикреплённое изображение, в том же порядке, в каком я их прикрепил. "rotate" — на сколько градусов повернуть картинку ПО ЧАСОВОЙ СТРЕЛКЕ, чтобы текст стал ровным: 0, 90, 180 или 270.

Правила:
- Числа, единицы и нормы переписывай точно как в бланке, ничего не придумывай и не округляй.
- Если что-то не читается — пиши как есть и ставь «(?)».
- Если в документе нет таблицы показателей (УЗИ, МРТ, справка) — "values": [].
- В переводах сохраняй структуру документа: заголовки разделов с новой строки, абзацы через \\n.
- Это нужно для личного архива, медицинские советы не нужны.`;
async function copyPrompt(){
  try { await navigator.clipboard.writeText(PROMPT); }
  catch(e) { const t = document.createElement("textarea"); t.value = PROMPT; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
  toast("Запрос скопирован: вставь его в Gemini и прикрепи фото документа");
}
function parseGem(t){
  t = String(t || "").trim(); if (!t) return null;
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s){
    const j = t.slice(s, e + 1);
    for (const x of [j, j.replace(/[“”„]/g, '"').replace(/,\s*([}\]])/g, "$1")]){ try { return JSON.parse(x); } catch(_) {} }
  }
  const lines = t.split("\n").filter(l => l.split(";").length >= 3);
  if (lines.length) return {values:lines.map(l => l.split(";").map(s => s.trim()))};
  return false;
}
const LANGMAP = {ru:"RU", pl:"PL", ka:"KA", en:"EN", "рус":"RU", "пол":"PL", "груз":"KA", "англ":"EN"};
function trHtml(rec, lang, text){
  const ru = lang === "RU";
  const L = ru ? {tr:"Перевод", p:"Пациент", d:"Дата", o:"Учреждение", dr:"Врач", th:["Показатель", "Результат", "Ед.", "Норма"], foot:"Перевод сделан ИИ для личного архива и не проверен специалистом. Оригинал лежит рядом в архиве."}
    : {tr:"Tłumaczenie", p:"Pacjent", d:"Data", o:"Placówka", dr:"Lekarz", th:["Badanie", "Wynik", "Jedn.", "Norma"], foot:"Tłumaczenie wykonane przez AI na potrzeby prywatnego archiwum, niezweryfikowane. Oryginał znajduje się w archiwum."};
  const from = {KA:ru ? "с грузинского" : "z gruzińskiego", PL:ru ? "с польского" : "z polskiego", EN:ru ? "с английского" : "z angielskiego", RU:ru ? "с русского" : "z rosyjskiego"}[rec.lang] || "";
  let vt = "";
  if (ru && rec.values && rec.values.length) vt = "<table><tr>" + L.th.map(h => "<th>" + h + "</th>").join("") + "</tr>" + rec.values.map(v => '<tr class="' + (v[4] || "") + '"><td>' + hesc(v[0]) + "</td><td><b>" + hesc(v[1]) + (v[4] === "H" ? " ↑" : v[4] === "L" ? " ↓" : "") + "</b></td><td>" + hesc(v[2]) + "</td><td>" + hesc(v[3]) + "</td></tr>").join("") + "</table>";
  const body = hesc(text || "").split(/\n{2,}/).map(p => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");
  return '<!DOCTYPE html><html lang="' + (ru ? "ru" : "pl") + '"><head><meta charset="utf-8"><title>' + hesc(rec.title) + " — " + L.tr + "</title><style>" +
    "body{font:15px/1.5 system-ui,Segoe UI,sans-serif;max-width:800px;margin:0 auto;padding:30px 20px;color:#1d2430;background:#f1edf8}h1{font-size:22px;margin:0 0 4px}.s{color:#6b7380;font-size:13px;margin-bottom:14px}table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}td,th{border:1px solid #ccd;padding:4px 8px;text-align:left}th{background:#eef2f5}tr.H td{background:#fff1e6}tr.L td{background:#eaf0ff}.f{color:#6b7380;font-size:12px;margin-top:24px;border-top:1px solid #e3e6eb;padding-top:8px}@media print{body{margin:0}}</style></head><body>" +
    "<h1>" + hesc(rec.title) + '</h1><div class="s">' + L.tr + " " + from + "</div><div><b>" + L.p + ":</b> " + hesc(H.patient || "") + "</div><div><b>" + L.d + ":</b> " + hfmt(rec.date) + "</div>" +
    (rec.org ? "<div><b>" + L.o + ":</b> " + hesc(rec.org) + "</div>" : "") + (rec.doctor ? "<div><b>" + L.dr + ":</b> " + hesc(rec.doctor) + "</div>" : "") + vt + body + '<div class="f">' + L.foot + "</div></body></html>";
}
function num(s){ const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function autoFlag(res, ref){
  const v = num(res); if (v === null || !ref) return "";
  const r = String(ref).replace(/,/g, ".");
  let m = r.match(/^\s*(-?\d+(?:\.\d+)?)\s*[–-]\s*(-?\d+(?:\.\d+)?)\s*$/); if (m){ if (v < +m[1]) return "L"; if (v > +m[2]) return "H"; return ""; }
  m = r.match(/^\s*<\s*(\d+(?:\.\d+)?)/); if (m) return v >= +m[1] ? "H" : "";
  m = r.match(/^\s*>\s*(\d+(?:\.\d+)?)/); if (m) return v <= +m[1] ? "L" : "";
  return "";
}
function parseValues(txt){
  const rows = txt.split("\n").map(s => s.trim()).filter(Boolean).map(s => { const p = s.split(/\s*;\s*/); return [p[0] || "", p[1] || "", p[2] || "", p[3] || "", (p[4] || "").toUpperCase()]; });
  rows.forEach(r => { if (!/^(H|L)$/.test(r[4])) r[4] = autoFlag(r[1], r[3]); });
  return rows.length ? rows : null;
}

/* ---------- добавление и правка ---------- */
const KINDS = [["orig", "Оригинал"], ["RU", "Перевод RU"], ["PL", "Перевод PL"], ["extra", "Снимки / прочее"]];
const isImg = f => (f.type || "").startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name || "");
const extOf = f => { const m = (f.name || "").match(/\.[^.]+$/); if (m) return m[0].toLowerCase(); return f.type === "application/pdf" ? ".pdf" : "." + ((f.type.split("/")[1] || "jpg").replace("jpeg", "jpg")); };
function addFiles(list){
  [...list].forEach(f => {
    if (!f || !((f.type || "").startsWith("image/") || f.type === "application/pdf" || /\.(pdf|jpe?g|png|heic|webp|html?)$/i.test(f.name || ""))) return;
    pending.push({file:f, kind:"orig", rot:0, url:isImg(f) ? URL.createObjectURL(f) : ""});
  });
  applyRot(); drawFiles();
}
function applyRot(){
  if (!gem || !gem.pages || !gem.pages.length) return;
  pending.filter(p => isImg(p.file)).forEach((p, i) => { const r = gem.pages[i] && +gem.pages[i].rotate; if ([0, 90, 180, 270].includes(r)) p.rot = r; });
  drawFiles();
}
function drawFiles(){
  const box = q$("#hflist"); if (!box) return; box.innerHTML = "";
  pending.forEach((p, i) => {
    const el = document.createElement("div"); el.className = "hfi";
    el.innerHTML = (p.url ? `<img class="th" src="${p.url}" style="transform:rotate(${p.rot}deg)"><button type="button" class="hbtn sm" data-r="-90">⟲</button><button type="button" class="hbtn sm" data-r="90">⟳</button>` : "<span>📄</span>") +
      `<span class="nm">${hesc(p.file.name || "вставленное изображение")}</span>` + (i > 0 ? `<button type="button" class="hbtn sm" data-up>↑</button>` : "") +
      `<select>${KINDS.map(k => `<option value="${k[0]}"${k[0] === p.kind ? " selected" : ""}>${k[1]}</option>`).join("")}</select><button type="button" class="hbtn sm" data-x>✕</button>`;
    el.querySelector("select").onchange = e => { p.kind = e.target.value; drawFiles(); };
    el.querySelector("[data-x]").onclick = () => { pending.splice(i, 1); drawFiles(); };
    const up = el.querySelector("[data-up]"); if (up) up.onclick = () => { [pending[i - 1], pending[i]] = [pending[i], pending[i - 1]]; drawFiles(); };
    el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { p.rot = (p.rot + (+b.dataset.r) + 360) % 360; drawFiles(); });
    box.appendChild(el);
  });
  const n = pending.filter(p => p.kind === "orig" && isImg(p.file)).length;
  const mr = q$("#hmergeRow"); if (mr) mr.style.display = n > 1 ? "flex" : "none";
}
function applyGem(txt){
  const st = q$("#hgSt"), f = q$("#heForm"); if (!st || !f) return;
  const g = parseGem(txt);
  if (g === null){ st.textContent = ""; st.className = "st"; gem = null; updTrn(); return; }
  if (g === false){ st.textContent = "Не получилось разобрать ответ. Скопируй его целиком (вместе с { }) или попроси Gemini повторить строго в JSON."; st.className = "st err"; return; }
  const filled = [];
  if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(String(g.date).trim())){ f.date.value = String(g.date).trim(); filled.push("дата"); }
  if (g.title){ f.title.value = g.title; filled.push("название"); }
  if (g.cat && H.cats.includes(g.cat)) f.cat.value = g.cat;
  if (g.lang){ const k = String(g.lang).trim(); f.lang.value = ["RU", "PL", "KA", "EN"].includes(k.toUpperCase()) ? k.toUpperCase() : (LANGMAP[k.toLowerCase().slice(0, 4)] || "—"); }
  if (g.country){ const c = [...f.country.options].map(o => o.value).find(o => norm(o) === norm(g.country)); f.country.value = c || "другая"; }
  if (g.org) f.org.value = g.org;
  if (g.tags) f.tags.value = Array.isArray(g.tags) ? g.tags.join(" ") : g.tags;
  if (g.note) f.note.value = g.note;
  f.dataset.doctor = g.doctor || "";
  if (Array.isArray(g.values) && g.values.length){ f.values.value = g.values.map(v => Array.isArray(v) ? v.map(x => String(x ?? "").trim()).slice(0, 5).join(" ; ") : "").filter(Boolean).join("\n"); filled.push("показатели: " + g.values.length); }
  gem = {ru:(g.translation_ru || "").trim(), pl:(g.translation_pl || "").trim(), pages:Array.isArray(g.pages) ? g.pages : []};
  applyRot();
  if (gem.ru) filled.push("перевод RU"); if (gem.pl) filled.push("перевод PL");
  st.textContent = "✓ Заполнено: " + filled.join(", ") + ". Проверь дату и название и сохраняй."; st.className = "st ok";
  updTrn();
}
function updTrn(){
  const t = []; if (gem && gem.ru) t.push("RU"); if (gem && gem.pl) t.push("PL");
  const e = q$("#htrn"); if (e) e.textContent = t.length ? "📝 Из ответа Gemini будет сохранён перевод: " + t.join(" и ") : "";
}
function openEdit(d){
  editing = d || null; pending = []; gem = null;
  const m = q$("#hedit");
  const o = (arr, v) => arr.map(x => `<option${x === v ? " selected" : ""}>${hesc(x)}</option>`).join("");
  m.innerHTML = `<div class="hpanel"><div class="hmh"><div class="t">${d ? "Изменить: " + hesc(d.title) : "Новый документ"}</div><button type="button" class="hbtn sm" id="hex">✕</button></div>
  <div class="hmb"><form class="hform" id="heForm" autocomplete="off">
    <div class="hdrop"><div id="hflist" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;text-align:left"></div>
      <button type="button" class="hbtn pri" id="hpick">📷 Фото или PDF</button> <span style="font-size:13px">или перетащи файлы сюда, или Ctrl+V</span>
      <input type="file" id="hfile" multiple accept="image/*,application/pdf,.html,.htm" hidden>
      <label id="hmergeRow" style="display:none;margin-top:8px;align-items:center;gap:6px;justify-content:center;color:var(--ink)"><input type="checkbox" id="hmerge" checked style="width:auto"> склеить фото-оригиналы в один PDF</label></div>
    <div id="htrn" class="st"></div>
    <div><label>Ответ Gemini</label><div style="display:flex;gap:6px;margin-bottom:6px"><button type="button" class="hbtn sm sq" id="hgCopy" title="Скопировать запрос для Gemini" aria-label="Скопировать запрос для Gemini">${GICON}</button><button type="button" class="hbtn sm" id="hgPaste">📥 Вставить</button></div><textarea id="hgText" placeholder="Вставь сюда ответ Gemini: всё заполнится само"></textarea><div class="st" id="hgSt"></div></div>
    <div class="two"><div><label>Дата</label><input type="date" name="date" required></div><div><label>Раздел</label><select name="cat">${o(H.cats, d ? d.cat : "Анализы")}</select></div></div>
    <div><label>Название</label><input type="text" name="title" required></div>
    <div class="two"><div><label>Язык оригинала</label><select name="lang">${o(["RU", "PL", "KA", "EN", "—"], d ? (d.lang || "—") : "PL")}</select></div><div><label>Страна</label><select name="country">${o(["Польша", "Грузия", "Беларусь", "другая"], d ? (d.country || "Польша") : "Польша")}</select></div></div>
    <div><label>Клиника / лаборатория</label><input type="text" name="org"></div>
    <div><label>Метки для поиска</label><input type="text" name="tags"></div>
    <div><label>Заметка</label><textarea name="note"></textarea></div>
    <div><label>Показатели (по строке: название ; значение ; ед. ; норма ; H/L)</label><textarea name="values" style="min-height:110px;font-family:ui-monospace,monospace;font-size:13px"></textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${d ? `<button type="button" class="hbtn del" id="hdel">Удалить</button>` : ""}<span style="flex:1"></span><button type="button" class="hbtn" id="hcancel">Отмена</button><button type="submit" class="hbtn pri" id="hsubmit">Сохранить</button></div>
  </form></div></div>`;
  const f = q$("#heForm");
  f.date.value = d ? d.date : new Date().toISOString().slice(0, 10);
  f.title.value = d ? d.title : ""; f.org.value = d ? (d.org || "") : ""; f.tags.value = d ? (d.tags || "") : ""; f.note.value = d ? (d.note || "") : "";
  f.values.value = d && d.values ? d.values.map(v => [v[0], v[1], v[2], v[3], v[4] || ""].join(" ; ").replace(/ ; $/, "")).join("\n") : "";
  f.dataset.doctor = d && d.doctor || "";
  m.classList.add("on"); drawFiles();
  q$("#hex").onclick = q$("#hcancel").onclick = () => closeM("#hedit");
  q$("#hpick").onclick = () => q$("#hfile").click();
  q$("#hfile").onchange = e => { addFiles(e.target.files); e.target.value = ""; };
  q$("#hgCopy").onclick = copyPrompt;
  q$("#hgPaste").onclick = async () => { try { const t = await navigator.clipboard.readText(); q$("#hgText").value = t; applyGem(t); } catch(e) { q$("#hgText").focus(); toast("Браузер не дал прочитать буфер: вставь текст в поле вручную"); } };
  q$("#hgText").addEventListener("input", e => applyGem(e.target.value));
  const dr = m.querySelector(".hdrop");
  ["dragenter", "dragover"].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); }));
  dr.addEventListener("drop", e => { e.preventDefault(); if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  const del = q$("#hdel"); if (del) del.onclick = () => {
    if (del.dataset.armed !== "1"){ del.dataset.armed = "1"; del.textContent = "Точно удалить? (файлы на Диске останутся)"; return; }
    d.deleted = true; d.updated = Date.now(); commit(); closeM("#hedit"); closeM("#hdoc"); render();
  };
  f.onsubmit = saveDoc;
}
async function saveDoc(e){
  e.preventDefault();
  const f = q$("#heForm"), btn = q$("#hsubmit");
  const fd = new FormData(f);
  const rec = editing || {id:"", files:[]};
  const upd = {date:fd.get("date"), cat:fd.get("cat"), title:fd.get("title").trim(), lang:fd.get("lang"), country:fd.get("country"), org:fd.get("org").trim(), tags:fd.get("tags").trim(), note:fd.get("note").trim()};
  const isNew = !editing;
  const work = [];
  const merge = q$("#hmerge") && q$("#hmerge").checked && pending.filter(p => p.kind === "orig" && isImg(p.file)).length > 1;
  btn.disabled = true; btn.textContent = "Сохраняю…";
  try {
    const tk = await getToken(true);
    Object.assign(rec, upd);
    if (f.dataset.doctor) rec.doctor = f.dataset.doctor;
    rec.values = parseValues(fd.get("values"));
    if (!rec.title_pl) rec.title_pl = "";
    if (!rec.id) rec.id = rec.date + "-" + Date.now().toString(36);
    const stem = safe(rec.date + " " + rec.title), olang = rec.lang === "—" ? "ОРИГ" : rec.lang;
    const mergePages = [];
    for (const p of pending){
      if (isImg(p.file) && p.kind === "orig" && merge){ mergePages.push(await toJpeg(p.file, p.rot)); if (mergePages.length === 1) work.push({kind:"orig", merged:true}); continue; }
      if (isImg(p.file) && p.rot){ const j = await toJpeg(p.file, p.rot); work.push({kind:p.kind, file:j.blob, ext:".jpg", name:p.file.name}); continue; }
      work.push({kind:p.kind, file:p.file, ext:extOf(p.file), name:p.file.name});
    }
    if (merge){ const m = work.find(w => w.merged); m.file = pdfFromJpegs(mergePages); m.ext = ".pdf"; m.pages = mergePages.length; }
    const origs = work.filter(p => p.kind === "orig"), already = rec.files.filter(x => x.kind === "orig").length, total = already + origs.length;
    const jobs = []; let oi = already;
    for (const p of work){
      if (p.kind === "orig"){ oi++; jobs.push({stem:stem + " [" + olang + "]" + (total > 1 ? " (" + oi + ")" : ""), ext:p.ext, data:p.file, entry:{kind:"orig", lang:olang === "ОРИГ" ? "" : olang, label:"Оригинал" + (total > 1 ? " " + oi : "") + (p.pages ? " (" + p.pages + " стр.)" : "")}}); }
      else if (p.kind === "RU" || p.kind === "PL") jobs.push({stem:stem + " [" + p.kind + "]", ext:p.ext, data:p.file, entry:{kind:"tr", lang:p.kind, label:"Перевод " + p.kind}});
      else jobs.push({stem:stem + " — " + safe((p.name || "файл").replace(/\.[^.]+$/, "")), ext:p.ext, data:p.file, entry:{kind:"extra", lang:"", label:"Снимки / прочее"}});
    }
    if (gem){
      if (gem.ru) jobs.push({stem:stem + " [RU]", ext:".html", data:new Blob([trHtml(rec, "RU", gem.ru)], {type:"text/html"}), entry:{kind:"tr", lang:"RU", label:"Перевод RU"}});
      if (gem.pl) jobs.push({stem:stem + " [PL]", ext:".html", data:new Blob([trHtml(rec, "PL", gem.pl)], {type:"text/html"}), entry:{kind:"tr", lang:"PL", label:"Перевод PL"}});
    }
    if (jobs.length){
      const dir = await catDir(tk, rec.cat);
      let k = 0;
      for (const j of jobs){
        k++; progress("Загружаю на Диск: " + k + " из " + jobs.length);
        let name = j.stem + j.ext, n = 2;
        while (rec.files.some(x => x.name === name)){ name = j.stem + " (" + n + ")" + j.ext; n++; }
        const mime = mimeOf(name);
        const up = await uploadFile(tk, dir, name, j.data, mime);
        rec.files.push({fid:up.id, name:up.name || name, mime, ...j.entry});
      }
      progress("");
    }
    rec.updated = Date.now();
    if (isNew) H.docs.push(rec);
    commit();
    closeM("#hedit"); closeM("#hdoc");
    toast("Сохранено" + (jobs.length ? ", файлов на Диске: " + jobs.length : ""));
    render();
  } catch(err) {
    progress("");
    btn.disabled = false; btn.textContent = "Сохранить";
    toast(err.message === "auth" ? "Нужно войти в Google: нажми на кружок сверху и сохрани ещё раз" : "Не получилось сохранить: " + err.message);
  }
}

/* ---------- перенос старой Медкарты ---------- */
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = ~0; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
async function walk(h, prefix, out){ for await (const [n, e] of h.entries()){ if (e.kind === "directory") await walk(e, prefix + n + "/", out); else out.push({name:prefix + n, file:await e.getFile()}); } }
async function zipDir(h){
  const fs = []; await walk(h, "", fs);
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0, cl = 0;
  for (const f of fs){
    const data = new Uint8Array(await f.file.arrayBuffer()), nm = enc.encode(f.name), crc = crc32(data), n = data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true); lh.setUint16(26, nm.length, true);
    parts.push(lh.buffer, nm, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cen.push(ch.buffer, nm); cl += 46 + nm.length; off += 30 + nm.length + n;
  }
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, fs.length, true); e.setUint16(10, fs.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e.buffer], {type:"application/zip"});
}
async function importFolder(){
  if (!window.showDirectoryPicker){ toast("Перенос работает в Chrome или Edge на компьютере"); return; }
  try {
    const dir = await window.showDirectoryPicker({id:"medkarta", mode:"read"});
    let text;
    try { text = await (await (await dir.getFileHandle("db.js")).getFile()).text(); }
    catch(e) { toast("В этой папке нет db.js: выбери папку «Медкарта»"); return; }
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    const old = JSON.parse(text.slice(s, e + 1));
    if (!old || !Array.isArray(old.docs)) throw new Error("не понял формат db.js");
    const tk = await getToken(true);
    // документы в базу (с учётом уже перенесённых раньше)
    const have = new Map(H.docs.map(d => [d.id, d]));
    for (const od of old.docs){
      let d = have.get(od.id);
      if (!d){ d = {...od, files:(od.files || []).map(x => ({...x})), updated:Date.now()}; H.docs.push(d); have.set(d.id, d); }
    }
    if (old.patient && !H.patient) H.patient = old.patient;
    H.cats = [...new Set([...(old.cats || []), ...H.cats])];
    hsave();
    const total = H.docs.reduce((n, d) => n + (d.files || []).filter(x => !x.fid && x.path).length, 0);
    let done = 0, failed = 0, uploaded = 0, lastErr = "";
    for (const d of H.docs){
      let changed = false;
      for (const x of (d.files || [])){
        if (x.fid || !x.path) continue;
        done++; progress("Переношу на Диск: " + done + " из " + total);
        try {
          const seg = x.path.split("/"), base = seg[seg.length - 1];
          let file, mimeU = mimeOf(base), upName = base;
          let hh = dir;
          if (x.kind === "dicom"){
            for (const sdir of seg) hh = await hh.getDirectoryHandle(sdir);
            progress("Упаковываю снимки: " + base);
            file = await zipDir(hh); upName = base + ".zip"; mimeU = "application/zip";
          } else {
            for (const sdir of seg.slice(0, -1)) hh = await hh.getDirectoryHandle(sdir);
            file = await (await hh.getFileHandle(base)).getFile();
          }
          const folder = await catDir(tk, seg.length > 1 ? seg[0] : d.cat);
          progress("Загружаю на Диск: " + done + " из " + total);
          const up = await uploadFile(tk, folder, upName, file, mimeU);
          uploaded++; x.fid = up.id; x.name = up.name || upName; x.mime = mimeU; changed = true;
        } catch(err) {
          if (err.message === "auth"){ progress(""); hsave(); toast("Вход Google истёк: нажми на кружок и запусти перенос ещё раз, продолжу с того места"); render(); return; }
          failed++; lastErr = (err && err.message) || String(err);
        }
      }
      if (changed){ d.updated = Date.now(); hsave(); }
    }
    progress(""); commit(); render();
    toast((failed ? "Не получилось файлов: " + failed + " (" + lastErr.slice(0, 80) + "), запусти ещё раз. " : "Готово. ") + "Документов: " + docs().length + ", загружено файлов: " + uploaded);
  } catch(err) {
    progress("");
    if (err && err.name === "AbortError") return;
    toast("Не получилось: " + (err.message === "auth" ? "нужно войти в Google" : err.message));
  }
}


async function countDir(h){ let n = 0, sz = 0; for await (const [, e] of h.entries()){ if (e.kind === "directory"){ const r = await countDir(e); n += r.n; sz += r.sz; } else { n++; sz += (await e.getFile()).size; } } return {n, sz}; }
async function verifyImport(){
  if (!window.showDirectoryPicker){ toast("Проверка работает в Chrome или Edge на компьютере"); return; }
  try {
    const dir = await window.showDirectoryPicker({id:"medkarta", mode:"read"});
    let old; try { const t = await (await (await dir.getFileHandle("db.js")).getFile()).text(); old = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch(e) { toast("В этой папке нет db.js"); return; }
    const tk = await getToken(true);
    const refs = new Set(), problems = []; let ok = 0, total = 0;
    const mine = new Map(H.docs.map(d => [d.id, d]));
    for (const od of old.docs){
      const d = mine.get(od.id);
      if (!d || d.deleted){ problems.push("Документ не перенесён: " + od.date + " " + od.title); continue; }
      for (const of of (od.files || [])){
        total++; refs.add(of.path);
        const nf = (d.files || []).find(x => x.path === of.path || (x.name && of.path.endsWith("/" + x.name)) || x.label === of.label && x.kind === of.kind);
        const x = (d.files || []).find(y => y.path === of.path);
        progress("Проверяю: " + total);
        if (!x || !x.fid){ problems.push("Нет на Диске: " + of.path); continue; }
        try {
          const meta = await (await drive(DRV + "/" + x.fid + "?fields=size,trashed,name", {}, tk)).json();
          if (meta.trashed){ problems.push("В корзине: " + of.path); continue; }
          const seg = of.path.split("/"); let hh = dir;
          if (of.kind === "dicom"){
            for (const s of seg) hh = await hh.getDirectoryHandle(s);
            const c = await countDir(hh);
            if (+meta.size < c.sz) problems.push("Архив меньше исходных снимков (" + c.n + " файлов): " + of.path); else ok++;
          } else {
            for (const s of seg.slice(0, -1)) hh = await hh.getDirectoryHandle(s);
            const fl = await (await hh.getFileHandle(seg[seg.length - 1])).getFile();
            if (+meta.size !== fl.size) problems.push("Размер не совпал: " + of.path); else ok++;
          }
        } catch(e) { problems.push("Не удалось проверить: " + of.path + " (" + e.message + ")"); }
      }
    }
    // файлы в папке, на которые нет ссылок в базе
    const extra = [];
    async function scan(h, p){ for await (const [n, e] of h.entries()){ const path = p ? p + "/" + n : n; if (e.kind === "directory"){ if (![...refs].some(r => r === path || r.startsWith(path + "/") && false)) await scan(e, path); } else if (!refs.has(path) && !/^(db\.js|Медкарта\.html|Как добавлять)/.test(n)) extra.push(path); } }
    for (const c of (old.cats || [])){ try { await scan(await dir.getDirectoryHandle(c), c); } catch(e) {} }
    progress("");
    const m = q$("#hview");
    m.innerHTML = `<div class="hmh"><div class="t">Проверка переноса</div><button type="button" class="hbtn sm" id="hvx">✕</button></div><div class="hmb"><div class="hform"><div class="st ${problems.length ? "err" : "ok"}">Файлов в базе: ${total}, совпало с Диском: ${ok}. ${problems.length ? "Проблем: " + problems.length : "Всё на месте."}</div>${problems.length ? `<div>${problems.map(p => `<div class="hnote">• ${hesc(p)}</div>`).join("")}</div>` : ""}${extra.length ? `<div class="st">В папке есть файлы, которых нет в базе (${extra.length}):</div>${extra.map(p => `<div class="hnote">• ${hesc(p)}</div>`).join("")}` : `<div class="st ok">Лишних файлов в папке нет.</div>`}</div></div>`;
    m.classList.add("on"); q$("#hvx").onclick = () => closeM("#hview");
  } catch(err) { progress(""); if (err && err.name === "AbortError") return; toast("Не получилось: " + (err.message === "auth" ? "нужно войти в Google" : err.message)); }
}

/* ---------- события ---------- */
const box = q$("#health");
if (box){
  box.addEventListener("click", e => {
    const t = e.target;
    const c = t.closest("[data-cat]"); if (c){ hs.cat = c.dataset.cat; vt(() => { render(); enter(box); }); return; }
    const co = t.closest("[data-country]"); if (co){ hs.country = co.dataset.country; vt(() => { render(); enter(box); }); return; }
    if (t.closest("[data-flags]")){ hs.flags = !hs.flags; vt(() => { render(); enter(box); }); return; }
    const a = t.closest("[data-act]");
    if (a){
      const k = a.dataset.act;
      if (k === "add") openEdit(null); else if (k === "copy") copyPrompt(); else if (k === "import") importFolder();
      else if (k === "sync") hSync(true); else if (k === "verify") verifyImport();
      return;
    }
    const op = t.closest("[data-open]"); if (op){ const d = H.docs.find(x => x.id === op.dataset.open); if (d) openDoc(d); return; }
    const ed = t.closest("[data-edit]"); if (ed){ const d = H.docs.find(x => x.id === ed.dataset.edit); if (d) openEdit(d); return; }
    const mg = t.closest("[data-merge]"); if (mg){ const d = H.docs.find(x => x.id === mg.dataset.merge); if (d) mergeExisting(d); return; }
    const fb = t.closest("[data-f]"); if (fb){ const d = docOfEl(fb); if (d) openViewer(d, d.files[+fb.dataset.f]); }
  });
}
q$("#hdoc").addEventListener("click", e => {
  const t = e.target, d = docOpen; if (!d) return;
  if (t.id === "hdoc"){ closeM("#hdoc"); docOpen = null; return; }
  const ed = t.closest("[data-edit]"); if (ed){ closeM("#hdoc"); openEdit(d); return; }
  const mg = t.closest("[data-merge]"); if (mg){ mergeExisting(d); return; }
  const fb = t.closest(".hatt [data-f]"); if (fb) openViewer(d, d.files[+fb.dataset.f]);
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (q$("#hview").classList.contains("on")){ closeM("#hview"); viewing = null; }
  else if (q$("#hedit").classList.contains("on")) closeM("#hedit");
  else if (q$("#hdoc").classList.contains("on")){ closeM("#hdoc"); docOpen = null; }
});
// перетаскивание файлов и вставка из буфера, пока открыт раздел «Здоровье»
const active = () => ui.list === "health";
document.addEventListener("dragover", e => { if (active() && e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
document.addEventListener("drop", e => {
  if (!active() || !e.dataTransfer || !e.dataTransfer.files.length || e.target.closest(".hdrop")) return;
  e.preventDefault(); if (!q$("#hedit").classList.contains("on")) openEdit(null); addFiles(e.dataTransfer.files);
});
document.addEventListener("paste", e => {
  if (!active()) return;
  const cd = e.clipboardData; if (!cd) return;
  const files = [...cd.files];
  if (files.length){ e.preventDefault(); if (!q$("#hedit").classList.contains("on")) openEdit(null); addFiles(files.map((f, i) => f.name && f.name !== "image.png" ? f : new File([f], "вставка-" + (pending.length + i + 1) + "." + (f.type.split("/")[1] || "png"), {type:f.type}))); return; }
  const t = cd.getData("text"), inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "");
  if (t && t.includes("{") && t.includes('"title"') && !inField){ e.preventDefault(); if (!q$("#hedit").classList.contains("on")) openEdit(null); q$("#hgText").value = t; applyGem(t); }
});

window.Health = {
  render, zipDir,
  open(){ render(); if (tokenValid()) hSync(false); else { hs.status = docs().length ? "Нужно войти: нажми на кружок сверху, чтобы обновить с Диска" : hs.status; render(); } },
  sync(){ if (tokenValid()) hSync(false); }
};
if (typeof ui !== "undefined" && ui.list === "health"){ render(); if (tokenValid()) hSync(false); }
})();
