"use strict";
/* Раздел «Чеки»: фото чеков и гарантия. Файлы и база лежат на твоём Google Диске (wikivazr/Чеки на технику).
   В репозитории только этот код, никаких данных. */
(function(){
const RK = "wiki-receipts", RGK = "wiki-receipts-g", DIR = "Чеки на технику", DB = "receipts-db.json", DRV = "drive/v3/files";
const q$ = s => document.querySelector(s);
const GICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" fill="var(--accent)"/></svg>';
const resc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rfmt = d => d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "";
const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е");
const safe = s => String(s).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
const isoToday = () => new Date().toISOString().slice(0, 10);

let R = {docs:[]};
try { const v = JSON.parse(localStorage.getItem(RK)); if (v && Array.isArray(v.docs)) R = {docs:v.docs}; } catch(e) {}
let rg = {fileId:"", folderId:""};
try { const v = JSON.parse(localStorage.getItem(RGK)); if (v) rg = {fileId:v.fileId || "", folderId:v.folderId || ""}; } catch(e) {}
const rsave = () => { try { localStorage.setItem(RK, JSON.stringify(R)); } catch(e) { toast("Не хватило места в браузере"); } };
const rsaveG = () => { try { localStorage.setItem(RGK, JSON.stringify(rg)); } catch(e) {} };
const rs = {f:"all", status:""};
let editing = null, pend = [], gone = [], opened = null, viewing = null;
const urlCache = new Map();

/* ---------- стили ---------- */
const css = document.createElement("style");
css.textContent = `
#receipts{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 24px;-webkit-overflow-scrolling:touch}
#receipts .rtop{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 10px}
#receipts .rst{color:var(--muted);font-size:13px;margin:2px 0 8px}
.rbtn{border:2px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:7px 12px;font-weight:600;font-size:14px;transition:background-color .18s,border-color .18s,transform .1s}
.rbtn:active{transform:scale(.95)}
.rbtn.pri,#receipts .chip[aria-pressed="true"]{background:linear-gradient(var(--surface),var(--surface)) padding-box,var(--stroke) border-box;border-color:transparent;color:var(--ink);font-weight:700}
#receipts .chip{border-width:2px}
.rbtn.sm{padding:4px 9px;font-size:13px}.rbtn.sq{padding:0;width:38px;height:36px;display:inline-flex;align-items:center;justify-content:center}.rbtn.sq.sm{width:34px;height:30px}
.rform .st{font-size:13px;margin-top:4px}.rform .st.ok{color:var(--done)}.rform .st.err{color:var(--danger)}.rbtn.del{color:var(--danger);border-color:var(--danger)}
.ryear{font-weight:700;color:var(--muted);margin:16px 0 6px;font-size:14px}
#receipts .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.ryear{grid-column:1/-1}
.rcard{position:relative;overflow:hidden;height:136px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;text-align:left;width:100%;color:var(--ink)}
.rcard .poster{position:absolute;top:0;bottom:0;left:0;right:0;width:auto;background-size:cover;background-position:center;-webkit-mask-image:none;mask-image:none;clip-path:none}
.rcard.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(14,10,30,.9) 0%,rgba(14,10,30,.62) 50%,rgba(14,10,30,.4) 100%)}
.rcard .bd{position:relative;z-index:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.rcard .tt{font-weight:700;font-size:14px;line-height:1.2;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rcard .mt{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcard.ph .tt{color:#fff}.rcard.ph .mt{color:#d9d1ea}
.rcard.ph .rb{background:rgba(255,255,255,.16);color:#efe9fb}.rcard.ph .rb.ok{background:rgba(95,207,147,.28);color:#aef0c8}.rcard.ph .rb.soon{background:rgba(242,169,59,.3);color:#ffd9a0}
.rb{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;background:var(--bg);color:var(--muted)}
.rb.ok{background:var(--done-bg);color:var(--done)}.rb.soon{background:var(--want-bg);color:var(--want)}.rb.end{background:var(--bg);color:var(--muted);text-decoration:line-through}
mark{background:#e9d58a;color:#2a2147;border-radius:3px}
.rmodal{position:fixed;inset:0;z-index:40;background:rgba(8,10,14,.6);display:none;align-items:center;justify-content:center}
.rmodal.on{display:flex;animation:fadein .16s ease}
.rmodal.on .rpanel{animation:rise .24s cubic-bezier(.2,.7,.3,1)}
.rpanel{background:var(--bg);display:flex;flex-direction:column;width:100%;height:100%;min-height:0}
@media (min-width:700px){.rpanel{max-width:640px;height:auto;max-height:92vh;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);border:1px solid var(--line)}}
#rview{background:var(--bg);flex-direction:column;align-items:stretch;justify-content:flex-start}
.rmh{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--surface)}
.rmh .t{flex:1;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis}
.rmb{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 14px calc(14px + env(safe-area-inset-bottom))}
.rmeta{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px;margin-bottom:10px}.rmeta .k{color:var(--muted)}
.rph{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin:10px 0}
.rph button{padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface);aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink)}
.rph img{width:100%;height:100%;object-fit:cover}
.rform{display:flex;flex-direction:column;gap:10px;max-width:560px;margin:0 auto}
.rform label{font-size:13px;color:var(--muted);display:block;margin-bottom:3px}
.rform input,.rform textarea,.rform select{width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.rform .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rfi{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:var(--surface)}
.rfi .th{width:46px;height:46px;object-fit:cover;border-radius:6px;background:var(--bg)}
.rfi .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.rprog{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#221b3d;color:#fff;padding:10px 16px;border-radius:12px;z-index:60;max-width:92%;font-size:14px;display:none}
.enter .rcard,.enter .ryear{animation:rise .3s cubic-bezier(.2,.7,.3,1) both;animation-delay:calc(var(--i,6) * 30ms)}
`;
document.head.appendChild(css);
const holder = document.createElement("div");
holder.innerHTML = `<div class="rmodal" id="rdoc"></div><div class="rmodal" id="redit"></div><div class="rmodal" id="rview"></div><div class="rprog" id="rprog"></div>`;
while (holder.firstChild) document.body.appendChild(holder.firstChild);
const progress = t => { const e = q$("#rprog"); if (!t){ e.style.display = "none"; return; } e.textContent = t; e.style.display = "block"; };
const closeM = id => { q$(id).classList.remove("on"); q$(id).innerHTML = ""; };

/* ---------- Диск ---------- */
async function ensureFolder(tk){
  if (rg.folderId){
    try { const r = await (await drive(`${DRV}/${rg.folderId}?fields=id,trashed`, {}, tk)).json(); if (!r.trashed) return rg.folderId; } catch(e) { if (e.status !== 404) throw e; }
    rg.folderId = ""; rg.fileId = "";
  }
  const fid = await ensureFile(tk);
  const parent = (await (await drive(`${DRV}/${fid}?fields=parents`, {}, tk)).json()).parents[0];
  let id = await findOldest(`mimeType='application/vnd.google-apps.folder' and name='${DIR}' and '${parent}' in parents and trashed=false`, tk);
  if (!id) id = (await (await drive(`${DRV}?fields=id`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:DIR, mimeType:"application/vnd.google-apps.folder", parents:[parent]})}, tk)).json()).id;
  rg.folderId = id; rsaveG(); return id;
}
async function uploadFile(tk, folder, name, blob, mime){
  const b = "wv" + Math.random().toString(36).slice(2);
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name, parents:[folder]})}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${b}--`]);
  return (await drive("upload/drive/v3/files?uploadType=multipart&fields=id,name", {method:"POST", headers:{"Content-Type":"multipart/related; boundary=" + b}, body}, tk)).json();
}
const replaceFile = (tk, id, blob, mime) => drive(`upload/drive/v3/files/${id}?uploadType=media`, {method:"PATCH", headers:{"Content-Type":mime}, body:blob}, tk);
const trashFile = (tk, id) => drive(`${DRV}/${id}`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({trashed:true})}, tk);
async function ensureDb(tk){
  const folder = await ensureFolder(tk);
  if (rg.fileId){
    try { const r = await (await drive(`${DRV}/${rg.fileId}?fields=id,trashed`, {}, tk)).json(); if (!r.trashed) return rg.fileId; } catch(e) { if (e.status !== 404) throw e; }
    rg.fileId = "";
  }
  let f = await findOldest(`name='${DB}' and '${folder}' in parents and trashed=false`, tk);
  if (!f){
    const mp = multipart({name:DB, parents:[folder], mimeType:"application/json"}, JSON.stringify({docs:[]}));
    f = (await (await drive("upload/drive/v3/files?uploadType=multipart&fields=id", {method:"POST", headers:{"Content-Type":mp.type}, body:mp.body}, tk)).json()).id;
  }
  rg.fileId = f; rsaveG(); return f;
}
const byId = a => [...a].sort((x, y) => String(x.id).localeCompare(String(y.id)));
let syncing = false, again = false;
async function rSync(interactive){
  if (syncing){ again = true; return; }
  if (!navigator.onLine){ rs.status = "Нет сети, чеки сохранены на устройстве"; render(); return; }
  syncing = true; rs.status = "Синхронизирую…"; render();
  try {
    const tk = await getToken(interactive);
    const id = await ensureDb(tk);
    let remote = {docs:[]};
    try { remote = await (await drive(`${DRV}/${id}?alt=media`, {}, tk)).json(); } catch(e) { if (e.status) throw e; }
    const rdocs = Array.isArray(remote.docs) ? remote.docs : [];
    R = {docs:mergeItems(R.docs, rdocs)}; rsave();
    if (JSON.stringify(byId(R.docs)) !== JSON.stringify(byId(rdocs))) await drive(`upload/drive/v3/files/${id}?uploadType=media`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(R)}, tk);
    rs.status = "Синхронизировано в " + new Date().toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
  } catch(e) {
    rs.status = e.message === "auth" ? "Нужно войти: нажми на кружок сверху" : e.message === "Failed to fetch" ? "Не удалось связаться с Google" : "Ошибка: " + e.message;
  } finally { syncing = false; if (again){ again = false; setTimeout(() => rSync(false), 300); } }
  render();
}
let tm = null;
const commit = () => { rsave(); clearTimeout(tm); tm = setTimeout(() => { if (tokenValid()) rSync(false); }, 1200); };

/* ---------- гарантия ---------- */
function warranty(d){
  if (!d.date || !(+d.months > 0)) return null;
  const dt = new Date(d.date + "T00:00:00"); dt.setMonth(dt.getMonth() + (+d.months));
  const until = dt.toISOString().slice(0, 10), days = Math.ceil((dt - new Date(isoToday() + "T00:00:00")) / 864e5);
  return {until, days, st:days < 0 ? "end" : days <= 60 ? "soon" : "ok"};
}
function leftText(days){
  if (days < 0) return "истекла";
  if (days < 31) return "ещё " + days + " дн.";
  const m = Math.round(days / 30.4); return m >= 12 ? "ещё " + (Math.floor(m / 12)) + " г." + (m % 12 ? " " + (m % 12) + " мес." : "") : "ещё " + m + " мес.";
}
const wShort = d => { const w = warranty(d); if (!w) return ""; const t = w.days < 0 ? "истекла" : w.days < 31 ? w.days + " дн." : w.days < 365 ? Math.round(w.days / 30.4) + " мес." : (Math.round(w.days / 36.5) / 10) + " г."; return `<span class="rb ${w.st}" style="white-space:nowrap">${w.days < 0 ? "истекла" : "ещё " + t}</span>`; };
const wBadge = d => { const w = warranty(d); return w ? `<span class="rb ${w.st}">гарантия до ${rfmt(w.until)} · ${leftText(w.days)}</span>` : ""; };

/* ---------- список ---------- */
const docs = () => R.docs.filter(d => !d.deleted);
const terms = () => norm(ui.q).split(/\s+/).filter(Boolean);
const hl = t => { let x = resc(t); terms().forEach(w => { try { x = x.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); } catch(e) {} }); return x; };
function filtered(){
  const ts = terms();
  return docs().filter(d => {
    const w = warranty(d);
    if (rs.f === "ok" && !(w && w.days >= 0)) return false;
    if (rs.f === "soon" && !(w && w.st === "soon")) return false;
    if (rs.f === "end" && !(w && w.st === "end")) return false;
    if (ts.length){ const h = norm([d.title, d.store, d.note, d.date, rfmt(d.date), d.price].join(" ")); return ts.every(x => h.includes(x)); }
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
function render(){
  const box = q$("#receipts"); if (!box || box.hidden) return;
  const all = docs(), list = filtered();
  const n = f => all.filter(d => { const w = warranty(d); return f === "ok" ? w && w.days >= 0 : f === "soon" ? w && w.st === "soon" : w && w.st === "end"; }).length;
  const chip = (k, label, c) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${rs.f === k}"${rs.f === k ? ' style="view-transition-name:selr"' : ""}>${label}${c != null ? ` <small>${c}</small>` : ""}</button>`;
  let html = `<div class="rtop"><button type="button" class="rbtn pri" data-act="add">+ Добавить чек</button><button type="button" class="rbtn sq" data-act="copy" title="Скопировать запрос для Gemini" aria-label="Скопировать запрос для Gemini">${GICON}</button><button type="button" class="rbtn" data-act="bulk">📥 Загрузить пачку фото</button><button type="button" class="rbtn" data-act="sync">⟳</button></div><input type="file" id="rbulk" multiple accept="image/*" hidden>`;
  html += `<div class="rst">${resc(rs.status || "")}</div><div class="rtop">${chip("all", "Все", all.length)}${chip("ok", "Гарантия идёт", n("ok"))}${chip("soon", "Скоро закончится", n("soon"))}${chip("end", "Истекла", n("end"))}</div>`;
  if (!list.length) html += `<div style="color:var(--muted);text-align:center;padding:30px 10px">${all.length ? "Ничего не нашлось" : "Пока пусто. Нажми «Добавить чек» или «Загрузить пачку фото»."}</div>`;
  let year = ""; html += `<div class="rgrid">`;
  list.forEach(d => {
    const y = (d.date || "").slice(0, 4); if (y !== year){ year = y; html += `<div class="ryear">${y}</div>`; }
    const th = d.files && d.files[0] && d.files[0].th;
    html += `<button type="button" class="rcard${th ? " ph" : ""}" data-open="${resc(d.id)}">${th ? `<span class="poster" style="background-image:url('${th}')"></span>` : ""}<span class="bd"><span class="tt">${hl(d.title)}</span><span class="mt">${rfmt(d.date)}${d.store ? " · " + hl(d.store) : ""}${d.price ? " · " + hl(d.price) : ""}</span><span>${wShort(d)}${d.files && d.files.length > 1 ? ` <span class="rb">📷 ${d.files.length}</span>` : ""}</span></span></button>`;
  });
  html += `</div>`;
  box.innerHTML = html;
  q$("#rbulk").onchange = e => { bulkImport([...e.target.files]); e.target.value = ""; };
}

/* ---------- картинки ---------- */
async function toJpeg(blob, rot, maxSide, q){
  const bmp = await createImageBitmap(blob, {imageOrientation:"from-image"});
  let w = bmp.width, h = bmp.height; const k = Math.min(1, maxSide / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const side = rot === 90 || rot === 270;
  const c = document.createElement("canvas"); c.width = side ? h : w; c.height = side ? w : h;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(bmp, -w / 2, -h / 2, w, h);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", q));
}
const full = (b, rot) => toJpeg(b, rot || 0, 2800, 0.9);
async function thumbOf(b, rot){ const t = await toJpeg(b, rot || 0, 200, 0.55); return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(t); }); }
async function prepare(file, rot){
  try { return {blob:await full(file, rot), th:await thumbOf(file, rot), ext:".jpg", mime:"image/jpeg"}; }
  catch(e) { const ext = (file.name.match(/\.[^.]+$/) || [".jpg"])[0].toLowerCase(); return {blob:file, th:"", ext, mime:file.type || "application/octet-stream"}; }
}

/* ---------- просмотр ---------- */
async function fileUrl(f){
  if (urlCache.has(f.fid)) return urlCache.get(f.fid);
  const tk = await getToken(true);
  const blob = await (await drive(`${DRV}/${f.fid}?alt=media`, {}, tk)).blob();
  const u = URL.createObjectURL(new Blob([blob], {type:f.mime || "image/jpeg"})); urlCache.set(f.fid, u); return u;
}
function openDoc(d){
  opened = d;
  const w = warranty(d);
  const meta = [["Куплено", rfmt(d.date)], ["Магазин", d.store], ["Цена", d.price], ["Гарантия", w ? "до " + rfmt(w.until) + " (" + leftText(w.days) + "), " + d.months + " мес." : ""]].filter(x => x[1]).map(x => `<div class="k">${x[0]}</div><div>${resc(x[1])}</div>`).join("");
  const m = q$("#rdoc");
  m.innerHTML = `<div class="rpanel"><div class="rmh"><div class="t">${resc(d.title)}</div><button type="button" class="rbtn sm" id="rdx">✕</button></div><div class="rmb"><div class="rmeta">${meta}</div>${d.note ? `<div style="margin-bottom:8px">${resc(d.note)}</div>` : ""}
    <div class="rph">${(d.files || []).map((f, i) => `<button type="button" data-ph="${i}">${f.th ? `<img src="${f.th}" alt="">` : "📄"}</button>`).join("")}</div>
    <button type="button" class="rbtn sm" id="rdedit">✎ Изменить</button></div></div>`;
  m.classList.add("on");
  q$("#rdx").onclick = () => { closeM("#rdoc"); opened = null; };
  q$("#rdedit").onclick = () => { closeM("#rdoc"); openEdit(d); };
  m.querySelector(".rph").onclick = e => { const b = e.target.closest("[data-ph]"); if (b) openViewer(d, d.files[+b.dataset.ph]); };
}
async function openViewer(d, f){
  if (!f || !f.fid){ toast("Этот файл не на Диске"); return; }
  viewing = {d, f};
  const v = q$("#rview");
  v.innerHTML = `<div class="rmh"><div class="t">${resc(d.title)}</div><button type="button" class="rbtn sm" data-rot="-90">⟲</button><button type="button" class="rbtn sm" data-rot="90">⟳</button><button type="button" class="rbtn sm" id="rvx">✕</button></div><div class="rmb" id="rvb" style="display:flex;align-items:center;justify-content:center;padding:6px">Загружаю…</div>`;
  v.classList.add("on");
  q$("#rvx").onclick = () => { closeM("#rview"); viewing = null; };
  v.querySelectorAll("[data-rot]").forEach(b => b.onclick = () => rotateSaved(+b.dataset.rot));
  try { const u = await fileUrl(f); q$("#rvb").innerHTML = `<img src="${u}" style="max-width:100%;max-height:100%" alt="">`; }
  catch(e) { q$("#rvb").textContent = e.message === "auth" ? "Нужно войти в Google: нажми на кружок сверху и повтори" : "Не получилось открыть: " + e.message; }
}
async function rotateSaved(deg){
  if (!viewing) return; const {d, f} = viewing;
  try {
    progress("Поворачиваю и сохраняю на Диск…");
    const tk = await getToken(true);
    const src = await (await drive(`${DRV}/${f.fid}?alt=media`, {}, tk)).blob();
    await replaceFile(tk, f.fid, await full(src, (deg + 360) % 360), "image/jpeg");
    f.th = await thumbOf(src, (deg + 360) % 360);
    if (urlCache.has(f.fid)){ URL.revokeObjectURL(urlCache.get(f.fid)); urlCache.delete(f.fid); }
    d.updated = Date.now(); commit(); progress(""); openViewer(d, f); render(); if (opened === d) openDoc(d);
  } catch(e) { progress(""); toast("Не получилось: " + (e.message === "auth" ? "нужно войти в Google" : e.message)); }
}

/* ---------- запрос для Gemini ---------- */
const PROMPT = `Ты помогаешь вести мой личный архив чеков на технику. Я прикрепляю фото чека, гарантийного талона или упаковки.

Ответь ТОЛЬКО одним блоком JSON, без текста до и после, строго по схеме:
{
  "date": "ГГГГ-ММ-ДД, дата покупки",
  "title": "что куплено, коротко по-русски: тип и модель, например «Смартфон Samsung Galaxy A54»",
  "store": "магазин и город по-русски",
  "price": "итоговая сумма с валютой, например 1999 zł",
  "months": 24,
  "note": "серийный номер, IMEI или номер чека, если они есть; иначе пустая строка",
  "pages": [{"rotate": 0}]
}

"months" это гарантия в месяцах числом; если на чеке не указана, ставь 24.
"pages" это по одному элементу на каждое прикреплённое изображение, в том же порядке. "rotate" это на сколько градусов повернуть картинку ПО ЧАСОВОЙ СТРЕЛКЕ, чтобы текст стал ровным: 0, 90, 180 или 270.
Переписывай данные точно как в чеке, ничего не придумывай. Если что-то не читается, пиши «(?)» или оставляй пустую строку. Совет не нужен.`;
async function copyPrompt(){
  try { await navigator.clipboard.writeText(PROMPT); }
  catch(e) { const t = document.createElement("textarea"); t.value = PROMPT; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
  toast("Запрос скопирован: вставь его в Gemini и прикрепи фото чека");
}
function parseGem(t){
  t = String(t || "").trim(); if (!t) return null;
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s){ const j = t.slice(s, e + 1); for (const x of [j, j.replace(/[“”„]/g, '"').replace(/,\s*([}\]])/g, "$1")]){ try { return JSON.parse(x); } catch(_) {} } }
  return false;
}
function applyGem(txt){
  const st = q$("#rgSt"), f = q$("#rForm"); if (!st || !f) return;
  const g = parseGem(txt);
  if (g === null){ st.textContent = ""; st.className = "st"; return; }
  if (g === false){ st.textContent = "Не получилось разобрать ответ: скопируй его целиком, вместе с { }."; st.className = "st err"; return; }
  const got = [];
  if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(String(g.date).trim())){ f.date.value = String(g.date).trim(); got.push("дата"); }
  if (g.title){ f.title.value = g.title; got.push("что куплено"); }
  if (g.store){ f.store.value = g.store; got.push("магазин"); }
  if (g.price){ f.price.value = g.price; got.push("цена"); }
  if (+g.months > 0){ f.months.value = Math.min(120, Math.round(+g.months)); }
  if (g.note) f.note.value = g.note;
  if (Array.isArray(g.pages)) { pend.forEach((p, i) => { const k = g.pages[i] && +g.pages[i].rotate; if ([0, 90, 180, 270].includes(k)) p.rot = k; }); drawFiles(); }
  st.textContent = "✓ Заполнено: " + got.join(", ") + ". Проверь и сохраняй."; st.className = "st ok";
}

/* ---------- добавление и правка ---------- */
function drawFiles(){
  const box = q$("#rflist"); if (!box) return; box.innerHTML = "";
  const rows = [];
  ((editing && editing.files) || []).filter(f => !gone.includes(f)).forEach(f => rows.push({old:f}));
  pend.forEach(p => rows.push({p}));
  rows.forEach(r => {
    const el = document.createElement("div"); el.className = "rfi";
    if (r.old){
      el.innerHTML = `${r.old.th ? `<img class="th" src="${r.old.th}" alt="">` : `<span class="th">📄</span>`}<span class="nm">${resc(r.old.name || "фото")}</span><button type="button" class="rbtn sm" data-x>✕</button>`;
      el.querySelector("[data-x]").onclick = () => { gone.push(r.old); drawFiles(); };
    } else {
      const p = r.p;
      el.innerHTML = `<img class="th" src="${p.url}" style="transform:rotate(${p.rot}deg)" alt=""><button type="button" class="rbtn sm" data-r="-90">⟲</button><button type="button" class="rbtn sm" data-r="90">⟳</button><span class="nm">${resc(p.file.name || "фото")}</span><button type="button" class="rbtn sm" data-x>✕</button>`;
      el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { p.rot = (p.rot + (+b.dataset.r) + 360) % 360; drawFiles(); });
      el.querySelector("[data-x]").onclick = () => { pend.splice(pend.indexOf(p), 1); drawFiles(); };
    }
    box.appendChild(el);
  });
}
function addFiles(list){ [...list].forEach(f => { if (f && (/^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name || ""))) pend.push({file:f, rot:0, url:URL.createObjectURL(f)}); }); drawFiles(); }
function openEdit(d){
  editing = d || null; pend = []; gone = [];
  const m = q$("#redit");
  m.innerHTML = `<div class="rpanel"><div class="rmh"><div class="t">${d ? "Изменить: " + resc(d.title) : "Новый чек"}</div><button type="button" class="rbtn sm" id="rex">✕</button></div><div class="rmb"><form class="rform" id="rForm" autocomplete="off">
    <div><div id="rflist" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button type="button" class="rbtn pri" id="rpick">📷 Фото чека</button><button type="button" class="rbtn sq" id="rgCopy" title="Скопировать запрос для Gemini" aria-label="Скопировать запрос для Gemini">${GICON}</button><button type="button" class="rbtn" id="rgPaste">📥 Вставить ответ</button></div><input type="file" id="rfile" multiple accept="image/*" hidden><textarea id="rgText" style="min-height:44px;margin-top:6px" placeholder="Ответ Gemini: вставь сюда, всё заполнится само"></textarea><div class="st" id="rgSt"></div></div>
    <div><label>Что куплено</label><input type="text" name="title" required placeholder="Например, телефон"></div>
    <div class="two"><div><label>Дата покупки</label><input type="date" name="date" required></div><div><label>Гарантия, месяцев</label><input type="number" name="months" min="0" max="120" inputmode="numeric"></div></div>
    <div class="two"><div><label>Магазин</label><input type="text" name="store"></div><div><label>Цена</label><input type="text" name="price" placeholder="например 1999 zł"></div></div>
    <div><label>Заметка</label><textarea name="note" style="min-height:70px"></textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${d ? `<button type="button" class="rbtn del" id="rdel">Удалить</button>` : ""}<span style="flex:1"></span><button type="button" class="rbtn" id="rcancel">Отмена</button><button type="submit" class="rbtn pri" id="rsubmit">Сохранить</button></div>
  </form></div></div>`;
  const f = q$("#rForm");
  f.date.value = d ? d.date : isoToday(); f.months.value = d ? d.months : 24;
  f.title.value = d ? d.title : ""; f.store.value = d ? (d.store || "") : ""; f.price.value = d ? (d.price || "") : ""; f.note.value = d ? (d.note || "") : "";
  m.classList.add("on"); drawFiles();
  q$("#rex").onclick = q$("#rcancel").onclick = () => closeM("#redit");
  q$("#rpick").onclick = () => q$("#rfile").click();
  q$("#rfile").onchange = e => { addFiles(e.target.files); e.target.value = ""; };
  q$("#rgCopy").onclick = copyPrompt;
  q$("#rgPaste").onclick = async () => { try { const t = await navigator.clipboard.readText(); q$("#rgText").value = t; applyGem(t); } catch(e) { q$("#rgText").focus(); toast("Браузер не дал прочитать буфер: вставь текст в поле вручную"); } };
  q$("#rgText").addEventListener("input", e => applyGem(e.target.value));
  const del = q$("#rdel"); if (del) del.onclick = () => {
    if (del.dataset.armed !== "1"){ del.dataset.armed = "1"; del.textContent = "Точно удалить? (фото на Диске останутся)"; return; }
    d.deleted = true; d.updated = Date.now(); commit(); closeM("#redit"); closeM("#rdoc"); render();
  };
  f.onsubmit = saveDoc;
}
async function saveDoc(e){
  e.preventDefault();
  const f = q$("#rForm"), btn = q$("#rsubmit"), fd = new FormData(f);
  const rec = editing || {id:"", files:[]};
  btn.disabled = true; btn.textContent = "Сохраняю…";
  try {
    Object.assign(rec, {title:fd.get("title").trim(), date:fd.get("date"), months:Math.max(0, parseInt(fd.get("months"), 10) || 0), store:fd.get("store").trim(), price:fd.get("price").trim(), note:fd.get("note").trim()});
    if (!rec.id) rec.id = rec.date + "-" + Date.now().toString(36);
    if (pend.length || gone.length){
      const tk = await getToken(true), folder = await ensureFolder(tk);
      for (const g of gone){ try { await trashFile(tk, g.fid); } catch(err) { if (err.message === "auth") throw err; } }
      rec.files = rec.files.filter(x => !gone.includes(x));
      let k = 0;
      for (const p of pend){
        k++; progress("Загружаю на Диск: " + k + " из " + pend.length);
        const pr = await prepare(p.file, p.rot);
        let name = safe(rec.date + " " + rec.title) + " (" + (rec.files.length + 1) + ")" + pr.ext, n = 2;
        while (rec.files.some(x => x.name === name)){ name = safe(rec.date + " " + rec.title) + " (" + (rec.files.length + n++) + ")" + pr.ext; }
        const up = await uploadFile(tk, folder, name, pr.blob, pr.mime);
        rec.files.push({fid:up.id, name:up.name || name, mime:pr.mime, th:pr.th});
      }
      progress("");
    }
    rec.updated = Date.now();
    if (!editing) R.docs.push(rec);
    commit(); closeM("#redit"); closeM("#rdoc"); toast("Сохранено"); render();
  } catch(err) {
    progress(""); btn.disabled = false; btn.textContent = "Сохранить";
    toast(err.message === "auth" ? "Нужно войти в Google: нажми на кружок сверху и сохрани ещё раз" : "Не получилось сохранить: " + err.message);
  }
}

/* ---------- пачка фото (например, из старой папки с чеками) ---------- */
async function bulkImport(files){
  files = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
  if (!files.length) return;
  try {
    const tk = await getToken(true), folder = await ensureFolder(tk);
    let ok = 0, bad = 0, last = "";
    for (const file of files){
      progress("Загружаю: " + (ok + bad + 1) + " из " + files.length);
      try {
        const stem = file.name.replace(/\.[^.]+$/, "");
        const m = stem.match(/(20\d{2})[-._](\d{2})[-._](\d{2})/);
        const date = m ? m[1] + "-" + m[2] + "-" + m[3] : new Date(file.lastModified || Date.now()).toISOString().slice(0, 10);
        const title = stem.replace(/(20\d{2})[-._]\d{2}[-._]\d{2}/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || "Чек";
        const pr = await prepare(file, 0);
        const name = safe(date + " " + title) + pr.ext;
        const up = await uploadFile(tk, folder, name, pr.blob, pr.mime);
        R.docs.push({id:date + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title, date, months:24, store:"", price:"", note:"", files:[{fid:up.id, name:up.name || name, mime:pr.mime, th:pr.th}], updated:Date.now()});
        rsave(); ok++;
      } catch(err) { if (err.message === "auth"){ progress(""); toast("Вход Google истёк: войди и выбери оставшиеся фото снова"); render(); return; } bad++; last = err.message || ""; }
    }
    progress(""); commit(); render();
    toast("Загружено чеков: " + ok + (bad ? ", не получилось: " + bad + " (" + last.slice(0, 60) + ")" : "") + ". Название и магазин можно поправить в карточке");
  } catch(err) { progress(""); toast("Не получилось: " + (err.message === "auth" ? "нужно войти в Google" : err.message)); }
}

/* ---------- события ---------- */
const box = q$("#receipts");
if (box) box.addEventListener("click", e => {
  const t = e.target;
  const fb = t.closest("[data-f]"); if (fb){ rs.f = fb.dataset.f; vt(() => { render(); enter(box); }); return; }
  const a = t.closest("[data-act]");
  if (a){ const k = a.dataset.act; if (k === "add") openEdit(null); else if (k === "copy") copyPrompt(); else if (k === "bulk") q$("#rbulk").click(); else if (k === "sync") rSync(true); return; }
  const op = t.closest("[data-open]"); if (op){ const d = R.docs.find(x => x.id === op.dataset.open); if (d) openDoc(d); }
});
q$("#rdoc").addEventListener("click", e => { if (e.target.id === "rdoc"){ closeM("#rdoc"); opened = null; } });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (q$("#rview").classList.contains("on")){ closeM("#rview"); viewing = null; }
  else if (q$("#redit").classList.contains("on")) closeM("#redit");
  else if (q$("#rdoc").classList.contains("on")){ closeM("#rdoc"); opened = null; }
});
window.Receipts = {
  render,
  open(){ render(); if (tokenValid()) rSync(false); else { rs.status = docs().length ? "Нужно войти: нажми на кружок сверху, чтобы обновить с Диска" : rs.status; render(); } },
  sync(){ if (tokenValid()) rSync(false); }
};
if (typeof ui !== "undefined" && ui.list === "receipts"){ render(); if (tokenValid()) rSync(false); }
})();
