// Logic trang duyệt từng ô — chép từ trang Artifact "Duyệt số thửa" của Claude (tools/danh_so/review_tung_o.html bên dự án
// Tool vẽ) để Phong dùng y như cũ, chỉ đổi chỗ lưu sang Firestore (lib/duyetSo.js). Viết thẳng DOM (không React) vì ô nhập
// phải giữ nguyên phần tử giữa các ô: thay phần tử đang gõ là iPhone đóng bàn phím và không cho mở lại bằng code.
// Thêm so với bản Claude: gộp L7 + L8 một trang, tải trước ảnh 10 ô kế, bỏ Enter giữ phím (từng bỏ nhầm 19 ô liền nhau
// 0,03 s/ô), nút Tải kết quả (JSON đúng định dạng collection kiem_tra cũ để Claude gom và đặt số).
import { saveResult, watchResults } from "./duyetSo.js";

const KIND = {
  sure: "Claude đọc chắc", unsure: "không chắc", merged: "ô gộp nhiều số", none: "không thấy số",
  far: "lệch xa thửa cạnh", arrow: "số ngoài ô, mũi tên chỉ vào", dup: "trùng số thửa cạnh: số đang đặt ở ô bên cạnh",
};
const GROUP = { doc: "Đọc rõ", bo: "Bỏ qua", duyet: "Đã duyệt" };
const PRELOAD = 10;  // số ô chưa duyệt kế tiếp tải sẵn ảnh
const PENDING_KEY = "duyetSo_cho_luu";

// root: phần tử chứa markup (DuyetSoPage.jsx). items: [mã ô (level*10000 + mã), loại, số đọc được, số thửa cạnh,
// tử số code tìm [[u, v]], file tif, đã đặt, ảnh, vị trí trong ảnh 0-19]. Trả về hàm dọn dẹp.
export function startReview(root, { items: allItems, auto, imgs, title }) {
  const ITEMS = allItems.filter(it => !it[6]);
  const AUTO = new Set(auto);
  const state = {};
  for (const it of ITEMS) if (AUTO.has(it[0])) state[it[0]] = { status: "ok", auto: true };
  const byCode = new Map(ITEMS.map(it => [it[0], it]));
  let rows = [], pts = [], a = 0, k = 0, started = false;
  let view = ITEMS.map((_, j) => j), vi = 0, pick = "doc", file = "all";
  const $ = id => root.querySelector("#ds-" + id);
  const split = t => (t || "").split(",").map(x => x.trim()).filter(Boolean);
  const url = img => imgs[img] || "";
  const cleanups = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); cleanups.push(() => el.removeEventListener(ev, fn, opt)); };

  $("title").textContent = title || "Duyệt số thửa";

  function nextOpen(from) {
    for (let j = from; j < view.length; j++) if (!state[ITEMS[view[j]][0]]) return j;
    return -1;
  }
  function groupOf(it) {
    const s = state[it[0]];
    if (s && s.status !== "skip") return "duyet";
    return s || !it[2] ? "bo" : "doc";
  }
  const fileOf = it => it[5] || "?";
  const okKind = (it, kd) => groupOf(it) === kd;
  const okFile = (it, f) => f === "all" || fileOf(it) === f;

  function fill(sel, values, label, count, cur) {
    sel.textContent = "";
    for (const v of values) {
      const all = ITEMS.filter(it => count(it, v));
      const left = all.filter(it => !state[it[0]]).length;
      const o = document.createElement("option");
      o.value = v; o.textContent = v === "duyet" ? `${label(v)} (${all.length})` : `${label(v)} (còn ${left}/${all.length})`;
      sel.append(o);
    }
    sel.value = cur;
  }
  function drawPick() {
    const files = [...new Set(ITEMS.map(fileOf))].sort((x, y) => (parseInt(x.replace(/\D+/, "")) || 0) - (parseInt(y.replace(/\D+/, "")) || 0) || x.localeCompare(y));
    fill($("loai"), Object.keys(GROUP), kd => GROUP[kd], (it, kd) => okKind(it, kd) && okFile(it, file), pick);
    fill($("tif"), ["all", ...files], f => f === "all" ? "Tất cả file" : f, (it, f) => okFile(it, f) && okKind(it, pick), file);
  }
  function choose(kd, f = file) {
    notice("");
    pick = kd; file = f;
    try { localStorage.setItem("duyetSo_loai", kd); localStorage.setItem("duyetSo_tif", f); } catch {}
    view = ITEMS.map((_, j) => j).filter(j => okKind(ITEMS[j], pick) && okFile(ITEMS[j], file));
    if (!view.length) { notice(`Nhóm ${GROUP[pick]} không còn ô nào ở file này.`); view = [k]; }
    const j = nextOpen(0);
    go(j >= 0 ? j : 0);
  }

  const loaded = {};  // ảnh đã tải sẵn, giữ tham chiếu để trình duyệt không bỏ khỏi bộ nhớ
  function preload() {
    for (let j = vi + 1, c = 0; j < view.length && c < PRELOAD; j++) {
      if (state[ITEMS[view[j]][0]]) continue;
      c++;
      const u = url(ITEMS[view[j]][7]);
      if (u && !loaded[u]) { loaded[u] = new Image(); loaded[u].src = u; }
    }
  }

  function show() {
    const [n, kind, read, near, , tif, , img, i] = ITEMS[k], s = state[n];
    $("tile").style.backgroundImage = `url("${url(img)}")`;
    $("tile").style.backgroundPosition = `${(i % 5) * 25}% ${Math.floor(i / 5) * 100 / 3}%`;
    $("tile").setAttribute("aria-label", "Ảnh ô " + n);
    $("code").textContent = `L${Math.floor(n / 10000)} · ô #${n % 10000} · ${tif}  ·  ${vi + 1}/${view.length}`;
    $("kind").className = "ds-kind k-" + kind;
    $("kind").textContent = KIND[kind] || kind;
    $("hint").textContent = near.length ? "Thửa cạnh: " + near.join(", ") : "";
    const nums = s ? (s.status === "skip" ? [] : split(s.so || read)) : split(read);
    const vt = (s && s.vt) || [];
    rows = (nums.length ? nums : [""]).map(so => ({ so }));
    pts = vt.length ? vt.filter(p => p && p.u != null).map(p => ({ u: p.u, v: p.v })) : autoPts();
    while (rows.length < pts.length) rows.push({ so: "" });
    a = 0;
    const d = $("done");
    d.hidden = !s;
    if (s) {
      d.className = "ds-done " + s.status;
      d.textContent = s.status === "skip" ? "Đã bỏ qua (không rõ)" : s.status === "ok" ? (s.auto ? "Tự duyệt: Claude đọc chắc, khớp thửa cạnh" : "Đã duyệt: đúng") : "Đã sửa: " + s.so;
    }
    drawRows(); drawPins(); drawCount(); preload();
  }
  function autoPts() { return (ITEMS[k][4] || []).map(([u, v]) => ({ u, v })); }

  function drawCount() {
    drawPick();
    const decided = ITEMS.filter(it => state[it[0]]).length;
    $("count").textContent = `Đã duyệt ${decided}/${ITEMS.length}`;
    $("bar").style.width = (decided / ITEMS.length * 100) + "%";
    const done = decided === ITEMS.length;
    $("export").classList.toggle("ready", done);
    $("finished").hidden = !done;
  }

  function drawRows() {
    const box = $("rows");
    while (box.children.length > rows.length) box.lastChild.remove();
    while (box.children.length < rows.length) box.append(makeRow(box.children.length));
    rows.forEach((r, j) => {
      const row = box.children[j], inp = row.querySelector("input"), at = row.querySelector(".ds-at");
      if (inp.value !== r.so) inp.value = r.so;
      at.className = "ds-at" + (pts[j] ? " set" : "");
      at.textContent = pts[j] ? "● điểm " + (j + 1) : "giữa ô";
    });
    focusRow(a);
  }
  function makeRow(j) {
    const row = document.createElement("div"); row.className = "ds-row";
    const no = document.createElement("span"); no.className = "ds-no"; no.textContent = j + 1;
    const inp = document.createElement("input");
    inp.inputMode = "numeric"; inp.enterKeyHint = "done"; inp.setAttribute("aria-label", "Số thửa thứ " + (j + 1));
    inp.addEventListener("focus", () => { a = j; });
    inp.addEventListener("input", () => { if (rows[j]) rows[j].so = inp.value.trim(); drawPins(); });
    inp.addEventListener("keydown", e => keyRow(e, j));
    const at = document.createElement("span"); at.className = "ds-at";
    row.append(no, inp, at);
    return row;
  }
  function focusRow(j) {
    const inp = $("rows").querySelectorAll("input")[j];
    if (inp) { inp.focus(); inp.select(); a = j; }
  }
  function keyRow(e, j) {
    if ((e.key === "Delete" || e.key === "Backspace") && (e.ctrlKey || e.shiftKey)) { e.preventDefault(); e.stopPropagation(); skipCell(e); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) { focusRow(Math.max(0, j - 1)); return; }
      if (j === rows.length - 1) { if (!rows[j].so) return; rows.push({ so: "" }); a = j + 1; drawRows(); drawPins(); return; }
      focusRow(j + 1);
    } else if (e.key === "Backspace" && !e.target.value && rows.length > 1) {
      e.preventDefault(); rows.splice(j, 1); a = Math.max(0, j - 1); drawRows(); drawPins();
    } else if (e.key === "Enter") {
      e.stopPropagation();
      submit(e);
    } else if (e.key === "Escape") {
      e.preventDefault(); pts = autoPts(); a = j; drawRows(); drawPins();
    }
  }

  function drawPins() {
    for (const el of $("tile").querySelectorAll(".ds-pin")) el.remove();
    pts.forEach((p, j) => {
      const so = rows[j] ? rows[j].so : "";
      const el = document.createElement("span");
      el.className = "ds-pin" + (so ? "" : " free");
      el.style.left = (p.u * 100) + "%"; el.style.top = (p.v * 100) + "%";
      const b = document.createElement("b"); b.textContent = String(j + 1);
      const t = document.createElement("i"); t.textContent = so;
      el.append(b, t);
      el.addEventListener("pointerdown", e => drag(e, j));
      el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); delPin(j); });
      $("tile").append(el);
    });
  }
  function where(e) {
    const r = $("tile").getBoundingClientRect();
    return { u: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }
  function delPin(j) {
    pts.splice(j, 1);
    rows.splice(j, 1);
    if (!rows.length) rows.push({ so: "" });
    a = Math.min(a, rows.length - 1); drawRows(); drawPins();
  }
  function drag(e, j) {
    if (e.button === 2) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const hold = setTimeout(() => { if (!moved) { cleanup(); delPin(j); } }, 550);  // nhấn giữ (điện thoại): xoá điểm
    const move = ev => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) moved = true;
      if (!moved) return;
      clearTimeout(hold);
      pts[j] = where(ev); el.style.left = (pts[j].u * 100) + "%"; el.style.top = (pts[j].v * 100) + "%";
    };
    const cleanup = () => { clearTimeout(hold); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    const up = () => { cleanup(); if (!moved) focusRow(j); else if (e.pointerType === "mouse") focusRow(a); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  function submit(e) {
    e.preventDefault();
    if (e.repeat) return;  // giữ phím Enter: bỏ, chỉ nhận từng lần bấm
    const [n, , read, , , , , img] = ITEMS[k];
    const keep = rows.filter(r => r.so);
    const v = keep.map(r => r.so).join(", ");
    const value = !v ? { status: "skip" } : v === split(read).join(", ") ? { status: "ok" } : { status: "bad", so: v };
    if (v) value.vt = rows.map((r, j) => [r, pts[j]]).filter(([r]) => r.so)
      .map(([, p]) => p ? { u: +p.u.toFixed(4), v: +p.v.toFixed(4) } : {});
    state[n] = value;
    const j = nextOpen(vi + 1);
    if (j >= 0) go(j);
    else if (vi < view.length - 1) go(vi + 1);
    else { show(); notice("Hết ô chưa duyệt trong nhóm này. Chọn nhóm / file khác ở trên."); }
    queueSave(n, img, value);
  }

  // Lưu bền: ghi vào hàng chờ trên máy trước, rồi gửi lên; lỗi (mạng...) thì thử lại, không bỏ ô
  let pending = {};
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}"); } catch {}
  const keepPending = () => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch {} };
  let flushing = false, stopped = false, retry = null;
  async function flush() {
    if (flushing || stopped) return;
    flushing = true;
    try {
      for (const n of Object.keys(pending)) {
        let ok = false;
        for (let t = 0; t < 4 && !ok && !stopped; t++) {
          try { await saveResult(pending[n].img, n, pending[n].value); ok = true; }
          catch { await new Promise(r => setTimeout(r, 800 * 2 ** t)); }
        }
        if (ok) { delete pending[n]; keepPending(); }
      }
    } finally { flushing = false; }
    const left = Object.keys(pending).length;
    notice(left ? `Còn ${left} ô chưa gửi lên được (đã giữ trên máy này, sẽ tự gửi lại).` : "");
    if (left && !stopped) retry = setTimeout(flush, 10000);
  }
  function queueSave(n, img, value) {
    pending[n] = { img, value: { ...value, luc: new Date().toISOString() } };
    keepPending(); flush();
  }

  function go(j) { vi = Math.max(0, Math.min(view.length - 1, j)); k = view[vi]; show(); }
  function notice(t) { $("notice").textContent = t; $("notice").hidden = !t; }
  function skipCell(e) { rows = [{ so: "" }]; pts = []; submit(e); }

  // Tải kết quả: { mã ô: { status, so?, vt?, luc } } như document trong collection kiem_tra của trang Claude
  function exportResults() {
    const kq = {};
    for (const it of ITEMS) { const s = state[it[0]]; if (s) kq[it[0]] = s; }
    const decided = Object.keys(kq).length;
    const out = { loai: "ket-qua-duyet-so", ten: title, luc: new Date().toISOString(), tong: ITEMS.length, da_duyet: decided, kiem_tra: kq };
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const d = new Date(), pad = x => String(x).padStart(2, "0");
    link.href = href; link.download = `ket-qua-duyet-so_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 5000);
  }

  on($("form"), "submit", submit);
  on($("loai"), "change", e => choose(e.target.value));
  on($("tif"), "change", e => choose(pick, e.target.value));
  try {
    const kd = localStorage.getItem("duyetSo_loai"), f = localStorage.getItem("duyetSo_tif");
    if (kd && GROUP[kd]) pick = kd;
    if (f && ITEMS.some(it => fileOf(it) === f)) file = f;
    view = ITEMS.map((_, j) => j).filter(j => okKind(ITEMS[j], pick) && okFile(ITEMS[j], file));
    if (!view.length) view = ITEMS.map((_, j) => j);
  } catch {}
  on($("tile"), "click", e => {
    if (e.target !== $("tile")) return;
    pts.push(where(e));
    while (rows.length < pts.length) rows.push({ so: "" });
    a = pts.length - 1;
    drawRows(); drawPins();
  });
  on($("tile"), "contextmenu", e => e.preventDefault());
  on($("save"), "click", e => submit(e));
  on($("skip"), "click", skipCell);
  on($("add"), "click", () => { if (rows[rows.length - 1].so || rows.length < pts.length) rows.push({ so: "" }); a = rows.length - 1; drawRows(); drawPins(); });
  on($("help"), "click", () => { const h = $("helpbox"); h.hidden = !h.hidden; $("help").setAttribute("aria-expanded", String(!h.hidden)); });
  on($("export"), "click", exportResults);
  on($("export2"), "click", exportResults);
  const peekOn = e => { e.preventDefault(); $("tile").classList.add("peek"); }, peekOff = () => $("tile").classList.remove("peek");
  on($("peek"), "pointerdown", peekOn);
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) on($("peek"), ev, peekOff);
  on($("prev"), "click", () => go(vi - 1));
  on(document, "keydown", e => { if (e.key === "Control") $("tile").classList.add("peek"); });
  on(document, "keyup", e => { if (e.key === "Control") $("tile").classList.remove("peek"); });
  on(window, "blur", () => $("tile").classList.remove("peek"));
  on(document, "keydown", e => {
    if ((e.key === "Delete" || e.key === "Backspace") && (e.ctrlKey || e.shiftKey)) { e.preventDefault(); skipCell(e); return; }
    if (e.key === "Enter" && !["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) { submit(e); return; }
    if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(vi - 1); }
  });

  k = view[0]; show();
  const unwatch = watchResults(all => {
    for (const [code, v] of Object.entries(all)) if (v && v.status && byCode.has(Number(code))) state[Number(code)] = { status: v.status, so: v.so, vt: v.vt };
    for (const n of Object.keys(pending)) { const v = pending[n].value; state[Number(n)] = { status: v.status, so: v.so, vt: v.vt }; }
    if (!started) { started = true; choose(pick); flush(); } else drawCount();
  }, () => notice("Mất kết nối nơi lưu kết quả. Kết quả vẫn giữ trên máy này và tự gửi lại khi có mạng."));

  return () => {
    stopped = true; clearTimeout(retry); unwatch();
    for (const c of cleanups) c();
  };
}
