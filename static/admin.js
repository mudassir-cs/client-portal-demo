/* Client Portal - admin portal (v8) */
(function () {
  "use strict";
  const A = JSON.parse(document.getElementById("admin-config").textContent);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const ICON = {
    check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v5h-5"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/><path d="M16 4.5a4 4 0 010 7M22 21c-.6-2-1.8-3.6-3.4-4.6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>'
  };
  const svg = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const banner = (kind, html) => `<div class="banner ${kind}" role="status">${html}</div>`;
  const okBanner = msg => banner("ok", `${svg("check", 18)}<span>${msg}</span>`);
  const errBanner = msg => banner("err", `${svg("info", 18)}<span>${esc(msg)}</span>`);
  const fmtWhen = s => {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T") + (/[zZ+]/.test(s) ? "" : "Z"));
    return isNaN(d) ? s : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...opts,
      headers: { "Content-Type": "application/json", "X-Portal": "1", ...(opts.headers || {}) } });
    if (res.status === 401) { location.href = "/login"; throw new Error("signed_out"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }
  const post = (p, body) => api(p, { method: "POST", body: JSON.stringify(body || {}) });
  const quiet = e => e.message === "signed_out";

  /* ---------------- tabs ---------------- */
  const tabs = { clients: loadClients, existing: loadExisting, services: loadServices, requests: () => loadRequests(), remove: loadRemove, docs: loadDocs, activity: loadActivity };
  function show(name) {
    Object.keys(tabs).forEach(k => {
      $("#tab-" + k).setAttribute("aria-selected", String(k === name));
      $("#pane-" + k).hidden = k !== name;
    });
    try { sessionStorage.setItem("tw_admin_tab", name); } catch (e) {}
    tabs[name]();
  }
  Object.keys(tabs).forEach(k => $("#tab-" + k).onclick = () => show(k));

  /* ================= Add Client ================= */
  function loadClients() {
    const pane = $("#pane-clients");
    pane.innerHTML = `<form class="a-card" id="cf" autocomplete="off" novalidate>
      <div class="a-sec"><div class="a-num">1</div><div class="a-body">
        <h3>Client</h3>
        <div class="grid2">
          <label>Name<input id="fName" required maxlength="120" placeholder="Full name"></label>
          <label>Email<input id="fEmail" type="email" required placeholder="The email they sign in with"></label>
          <label><span>Company <span class="opt">optional</span></span><input id="fCompany" maxlength="120" placeholder="For example Greenleaf Bakery LLC"></label>
        </div></div></div>
      <div class="a-sec"><div class="a-num">2</div><div class="a-body">
        <h3>Folder</h3>
        <div class="grid2">
          <label>Main folder<select id="fTop"><option value="">Loading…</option></select></label>
          <label>New client folder name<input id="fClient" required autocomplete="off" placeholder="For example Greenleaf Bakery LLC"></label>
        </div><p class="a-hint" id="fDup"></p></div></div>
      <div class="a-sec"><div class="a-num">3</div><div class="a-body">
        <h3>Services</h3>
        <div class="svc-pills">${A.services.map(x =>
          `<label class="svc-pill"><input type="checkbox" name="svc" value="${esc(x.id)}"><span>${svg("check", 14)}${esc(x.title)}</span></label>`).join("")}</div>
        <p class="a-hint" id="fPreview"></p></div></div>
      <div class="a-foot">
        <label class="switch"><input type="checkbox" id="oNotify"><span class="sw" aria-hidden="true"></span>Email the client their sign-in link</label>
        <div class="a-btns"><button class="btn2" type="button" id="fClear">Clear</button><button class="cta" type="submit">Add Client</button></div>
      </div>
      <div id="fResult"></div>
    </form>`;
    const top = $("#fTop"), cl = $("#fClient");
    let taken = [];                                     // folders already in the chosen main folder
    const ticked = () => $$('input[name="svc"]:checked').map(i => i.value);
    const preview = () => {
      const t = top.value, c = cl.value.trim(), sv = A.services.filter(x => ticked().includes(x.id));
      const dup = c && taken.find(n => n.toLowerCase() === c.toLowerCase());
      $("#fDup").innerHTML = dup
        ? `<span class="bad">${svg("info", 15)} <b>${esc(t)} / ${esc(dup)}</b> already exists. For a client that's already in the document library, use the <b>Existing Client</b> tab.</span>` : "";
      $("#fPreview").innerHTML = dup ? "" : t && c && sv.length
        ? `${svg("folder", 15)} Creates <b>${esc(t)} / ${esc(c)}</b>` + (sv.some(x => x.upload) ? ` with ${sv.filter(x => x.upload).map(x => `<b>${esc(x.folder)} / ${esc(A.uploadName)}</b>`).join(", ")}` : "") + `. Download opens the client folder.`
        : "";
    };
    api("/api/admin/folders").then(r => {
      top.innerHTML = `<option value="">Choose…</option>` + r.folders.map(n => `<option>${esc(n)}</option>`).join("");
    }).catch(e => { top.innerHTML = `<option value="">${esc(e.message)}</option>`; });
    top.onchange = async () => {
      taken = []; preview();
      if (!top.value) return;
      try {
        const r = await api("/api/admin/folders?parent=" + encodeURIComponent(top.value));
        taken = r.folders; preview();
      } catch (e) {}
    };
    cl.oninput = preview;
    $$('input[name="svc"]').forEach(i => i.onchange = preview);
    $("#fClear").onclick = loadClients;
    $("#fName").focus();
    $("#cf").onsubmit = async e => {
      e.preventDefault();
      const btn = $('#cf button[type="submit"]'), res = $("#fResult");
      const need = [[!$("#fName").value.trim(), "Enter the client's name."], [!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($("#fEmail").value.trim()), "Enter a valid email address."],
        [!top.value, "Choose the main folder."], [!cl.value.trim(), "Enter the client folder name."], [!ticked().length, "Choose at least one service."],
        [taken.some(n => n.toLowerCase() === cl.value.trim().toLowerCase()), "That client folder already exists. Use the Existing Client tab for clients already in the document library."]].find(x => x[0]);
      if (need) { res.innerHTML = errBanner(need[1]); return; }
      btn.disabled = true; res.innerHTML = `<p class="a-wait"><span class="spin"></span>Setting up the client… this can take up to a minute.</p>`;
      try {
        const r = await post("/api/admin/clients", { name: $("#fName").value, email: $("#fEmail").value, company: $("#fCompany").value,
          top: top.value, client: cl.value, services: ticked(), share: true, notify: $("#oNotify").checked });
        const failed = r.steps.filter(s => !s.ok), accessOk = r.steps.some(s => s.step === "Portal access" && s.ok);
        res.innerHTML = !failed.length ? okBanner(`<b>${esc($("#fName").value)}</b> can now use the portal.`)
          : banner(accessOk ? "warn" : "err", `${svg("info", 18)}<span><b>${accessOk ? "Client added, but one thing didn't finish:" : "Client not added:"}</b> ${failed.map(s => esc(s.message)).join(" ")}</span>`);
      } catch (err) { if (!quiet(err)) res.innerHTML = errBanner(err.message); }
      btn.disabled = false;
    };
  }

  /* ================= Upload folder dropdown (existing clients) ================= */
  // One dropdown per service: "New folder: Tax / Upload" or any folder already inside the client's folder.
  const trees = {};
  function folderTree(path, fresh) {
    if (fresh || !trees[path]) trees[path] = api("/api/admin/folder-tree?path=" + encodeURIComponent(path)).catch(e => { delete trees[path]; throw e; });
    return trees[path];
  }
  const nice = p => p.split("/").join(" › ");
  let ufN = 0;
  // Two big choices: "Make a new folder" (default) or "Use a folder they already have" (a folder tree you click).
  function uploadField(sid, tree, currentId) {
    const x = A.services.find(s => s.id === sid), def = `${x.folder}/${A.uploadName}`, n = ++ufN;
    const client = tree.path.split("/").pop();
    const exact = tree.folders.find(f => f.path.toLowerCase() === def.toLowerCase());
    const pre = currentId || (exact && exact.id) || "";
    return `<div class="uf" data-sid="${esc(sid)}" data-pre="${esc(pre)}" data-def="${esc(def)}">
      <label class="uf-opt"><input type="radio" name="uf${n}" value="new" ${pre ? "" : "checked"}>
        <span class="uf-dot" aria-hidden="true"></span>
        <span class="uf-txt"><b>Make a new folder for their uploads <span class="uf-rec">Recommended</span></b>
          <small>We'll create an empty folder for you:</small>
          <span class="uf-crumb">${svg("folder", 14)}${esc(client)}<i>›</i>${svg("folder", 14)}${esc(x.folder)}<i>›</i>${svg("folder", 14)}<b>${esc(A.uploadName)}</b></span></span></label>
      <label class="uf-opt"><input type="radio" name="uf${n}" value="pick" ${pre ? "checked" : ""}>
        <span class="uf-dot" aria-hidden="true"></span>
        <span class="uf-txt"><b>Use a folder they already have</b><small>Click a folder in the list. Click the arrow to look inside a folder.</small></span></label>
      <div class="uf-pick" hidden>
        <label class="uf-find">${svg("search", 15)}<input type="search" placeholder="Type to find a folder…" aria-label="Find a folder"></label>
        <div class="uf-tree" role="tree" aria-label="Folders in ${esc(client)}"></div>
      </div>
      <div class="uf-sum" aria-live="polite"></div></div>`;
  }
  function wireUpload(box) {
    const tree = box._tree, client = tree.path.split("/").pop();
    const kids = {};                                    // parent path -> folders
    tree.folders.forEach(f => { const par = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ""; (kids[par] = kids[par] || []).push(f); });
    const byId = Object.fromEntries(tree.folders.map(f => [f.id, f]));
    const st = { sel: box.dataset.pre || "", open: new Set(), q: "" };
    if (st.sel && byId[st.sel]) { const parts = byId[st.sel].path.split("/"); for (let i = 1; i < parts.length; i++) st.open.add(parts.slice(0, i).join("/")); }
    box._st = st;
    // "Empty" only when there are no files anywhere inside (size counts every level, not just this folder).
    const hasFiles = f => f.size != null ? f.size > 0 : f.files == null ? f.count > 0 : f.files > 0;
    const badge = () => "";                              // no tags in the list: keep it simple
    const row = (f, depth, crumb) => {
      const has = (kids[f.path] || []).length, open = st.open.has(f.path);
      return `<div class="uf-row ${st.sel === f.id ? "sel" : ""}" role="treeitem" aria-selected="${st.sel === f.id}" ${has ? `aria-expanded="${open}"` : ""} style="--d:${depth}">
        ${has && !crumb ? `<button type="button" class="uf-arrow" data-tog="${esc(f.path)}" aria-label="${open ? "Close" : "Open"} ${esc(f.path.split("/").pop())}">${svg("chev", 16)}</button>` : `<span class="uf-arrow sp"></span>`}
        <button type="button" class="uf-name" data-id="${esc(f.id)}">${svg("folder", 18)}<span><b>${esc(f.path.split("/").pop())}</b>${crumb ? `<small>in ${esc(nice(client + "/" + f.path.split("/").slice(0, -1).join("/")).replace(/ › $/, ""))}</small>` : ""}</span>${badge(f)}
          ${st.sel === f.id ? `<span class="uf-tick">${svg("check", 16)}</span>` : ""}</button></div>`;
    };
    const branch = (par, depth) => (kids[par] || []).map(f => row(f, depth) + (st.open.has(f.path) ? branch(f.path, depth + 1) : "")).join("");
    function draw() {
      const mode = $('input[type="radio"]:checked', box).value;
      $(".uf-pick", box).hidden = mode !== "pick";
      box.querySelectorAll(".uf-opt").forEach(o => o.classList.toggle("on", $("input", o).checked));
      const t = $(".uf-tree", box);
      if (mode === "pick") {
        const q = st.q.toLowerCase();
        const hits = q ? tree.folders.filter(f => f.path.split("/").pop().toLowerCase().includes(q)) : null;
        t.innerHTML = q ? (hits.length ? hits.map(f => row(f, 0, true)).join("") : `<p class="uf-none">No folder called “${esc(st.q)}”.</p>`)
          : (tree.folders.length ? `<div class="uf-row root" style="--d:0"><span class="uf-arrow sp"></span><span class="uf-name static">${svg("folder", 18)}<span><b>${esc(client)}</b><small>Their main folder</small></span></span></div>` + branch("", 1)
                                 : `<p class="uf-none">This client has no folders yet. Use “Make a new folder” above.</p>`);
        $$("[data-tog]", t).forEach(b => b.onclick = () => { const p = b.dataset.tog; st.open.has(p) ? st.open.delete(p) : st.open.add(p); draw(); });
        $$("[data-id]", t).forEach(b => b.onclick = () => {
          st.sel = b.dataset.id; const f = byId[st.sel];
          if ((kids[f.path] || []).length) st.open.add(f.path);
          if (st.q) { const parts = f.path.split("/"); for (let i = 1; i < parts.length; i++) st.open.add(parts.slice(0, i).join("/")); st.q = ""; $(".uf-find input", box).value = ""; }
          draw();
        });
      }
      const sum = $(".uf-sum", box), f = byId[st.sel];
      if (mode === "new") { sum.className = "uf-sum ok"; sum.innerHTML = `${svg("check", 16)}<span>Their uploads will go into a <b>new, empty folder</b>.</span>`; }
      else if (!f) { sum.className = "uf-sum need"; sum.innerHTML = `${svg("info", 16)}<span>Click a folder in the list above.</span>`; }
      else {
        const full = `<span class="uf-crumb">${[client, ...f.path.split("/")].map((p, i, a) => `${svg("folder", 14)}${i === a.length - 1 ? `<b>${esc(p)}</b>` : esc(p)}`).join("<i>›</i>")}</span>`;
        const many = hasFiles(f);
        sum.className = "uf-sum " + (many ? "warn" : "ok");
        sum.innerHTML = many ? `${svg("info", 16)}<span>Their uploads will go to: ${full}<br>Note: this folder already has files in it. The client will be able to see and change them.</span>`
                              : `${svg("check", 16)}<span>Their uploads will go to: ${full}</span>`;
      }
    }
    box.querySelectorAll('input[type="radio"]').forEach(r => r.onchange = draw);
    $(".uf-find input", box).oninput = e => { st.q = e.target.value.trim(); draw(); };
    draw();
    const t0 = $(".uf-tree", box), s0 = $(".uf-row.sel", box);          // show the folder already in use
    if (t0 && s0) setTimeout(() => { t0.scrollTop = s0.offsetTop - t0.offsetTop - 60; }, 0);
  }
  function uploadValue(box) {
    const mode = $('input[type="radio"]:checked', box).value;
    return mode === "new" ? "new:" + box.dataset.def : (box._st && box._st.sel) || "";
  }
  // One-line summary of a chooser, shown when its service is folded up.
  function ufSummary(box) {
    const tree = box._tree, client = tree.path.split("/").pop(), mode = $('input[type="radio"]:checked', box).value;
    const crumb = parts => `<span class="uf-crumb">${parts.map((p, i, a) => `${svg("folder", 14)}${i === a.length - 1 ? `<b>${esc(p)}</b>` : esc(p)}`).join("<i>›</i>")}</span>`;
    if (mode === "new") return `<span class="ex2-sl">Uploads go to</span>${crumb([client, ...box.dataset.def.split("/")])}<span class="ex2-new">new folder</span>`;
    const f = tree.folders.find(x => x.id === (box._st || {}).sel);
    return f ? `<span class="ex2-sl">Uploads go to</span>${crumb([client, ...f.path.split("/")])}`
             : `<span class="ex2-sl bad">${svg("info", 14)} No folder chosen yet</span>`;
  }
  function mountUpload(el, sid, tree, currentId) {
    el.innerHTML = uploadField(sid, tree, currentId);
    const box = $(".uf", el); box._tree = tree; wireUpload(box);
  }
  // Client Services: change or choose a service's upload folder in a small pop-up.
  function chooseUpload(c, sid, currentId, yes) {
    const x = A.services.find(s => s.id === sid);
    return new Promise(resolve => {
      const back = document.createElement("div");
      back.className = "am-back";
      back.innerHTML = `<div class="am" role="dialog" aria-modal="true" aria-labelledby="ucT">
        <h3 id="ucT">${esc(x.title)} Uploads for ${esc(c.name)}</h3>
        <p>Where should files go when they click <b>Upload</b> on the ${esc(x.title)} tile?</p>
        <div class="uc-body"><p class="a-wait"><span class="spin"></span>Loading their folders…</p></div>
        <div class="am-err" aria-live="polite"></div>
        <div class="am-btns"><button class="btn2 sm" data-no>Cancel</button><button class="cta sm" data-yes disabled>${esc(yes || "Save")}</button></div></div>`;
      document.body.appendChild(back);
      const close = v => { back.remove(); resolve(v); };
      $("[data-no]", back).onclick = () => close(null);
      back.addEventListener("click", e => { if (e.target === back) close(null); });
      back.addEventListener("keydown", e => { if (e.key === "Escape") close(null); });
      folderTree(c.path, true).then(tree => {
        mountUpload($(".uc-body", back), sid, tree, currentId);
        $("[data-yes]", back).disabled = false; $('.uf input[type="radio"]:checked', back).focus();
      }).catch(e => { $(".uc-body", back).innerHTML = errBanner(e.message); });
      $("[data-yes]", back).onclick = () => {
        const v = uploadValue($(".uf", back));
        if (!v) { $(".am-err", back).textContent = "Click a folder in the list first."; return; }
        close(v);
      };
    });
  }

  /* ================= Type-to-search list (used for the client folder) ================= */
  // input: the text box; items: array of names; onPick(name) when one is chosen.
  function comboBox(input, onPick) {
    const wrap = input.closest(".combo"), list = $(".combo-list", wrap);
    let items = [], shown = [], active = -1, picked = "";
    const mark = (n, q) => { if (!q) return esc(n); const i = n.toLowerCase().indexOf(q.toLowerCase());
      return i < 0 ? esc(n) : esc(n.slice(0, i)) + "<b>" + esc(n.slice(i, i + q.length)) + "</b>" + esc(n.slice(i + q.length)); };
    function draw() {
      const q = input.value.trim(), ql = q.toLowerCase();
      shown = (q && q !== picked) ? items.filter(n => n.toLowerCase().includes(ql)) : items.slice();
      shown.sort((a, b) => (b.toLowerCase().startsWith(ql) - a.toLowerCase().startsWith(ql)) || a.localeCompare(b));
      active = shown.length ? 0 : -1;
      list.innerHTML = shown.length ? shown.slice(0, 200).map((n, i) => `<li role="option" data-i="${i}" class="${i === active ? "on" : ""}">${svg("folder", 15)}<span>${mark(n, q !== picked ? q : "")}</span></li>`).join("")
        + (shown.length > 200 ? `<li class="more">Keep typing to see more…</li>` : "")
        : `<li class="none">No client folder called “${esc(q)}”</li>`;
      $$("li[data-i]", list).forEach(li => li.onmousedown = e => { e.preventDefault(); pick(shown[+li.dataset.i]); });
      open(true);
    }
    function open(on) { list.hidden = !on; input.setAttribute("aria-expanded", String(on)); wrap.classList.toggle("open", on); }
    function move(d) {
      if (list.hidden) return draw();
      const lis = $$("li[data-i]", list); if (!lis.length) return;
      active = (active + d + lis.length) % lis.length;
      lis.forEach((li, i) => li.classList.toggle("on", i === active)); lis[active].scrollIntoView({ block: "nearest" });
    }
    function pick(n) { picked = n || ""; input.value = picked; open(false); wrap.classList.toggle("has", !!picked); onPick(picked); }
    input.addEventListener("input", draw);
    input.addEventListener("focus", () => { if (!input.disabled) { input.select(); draw(); } });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); if (!list.hidden && shown[active]) pick(shown[active]); }
      else if (e.key === "Escape") { open(false); input.value = picked; }
    });
    input.addEventListener("blur", () => setTimeout(() => {
      open(false);
      const exact = items.find(n => n.toLowerCase() === input.value.trim().toLowerCase());
      if (exact && exact !== picked) pick(exact); else input.value = picked;
    }, 120));
    const clear = $(".combo-x", wrap); if (clear) clear.onmousedown = e => { e.preventDefault(); pick(""); input.focus(); };
    return {
      set(names, placeholder) { items = names || []; picked = ""; input.value = ""; wrap.classList.remove("has");
        input.disabled = !items.length; input.placeholder = placeholder || (items.length ? `Type to search ${items.length} folders…` : "No folders here"); open(false); },
      wait(text) { items = []; picked = ""; input.value = ""; input.disabled = true; input.placeholder = text; wrap.classList.remove("has"); open(false); },
      get value() { return picked; }
    };
  }

  /* ================= Existing Client: give portal access using the client's own folders ================= */
  function loadExisting() {
    const pane = $("#pane-existing");
    let tree = null, treeErr = "";
    pane.innerHTML = `<form class="a-card" id="ef" autocomplete="off" novalidate>
      <div class="a-sec"><div class="a-num">1</div><div class="a-body">
        <h3>Who Is Getting Access</h3>
        <div class="grid2">
          <label>Name<input id="eName" maxlength="120" placeholder="Full name"></label>
          <label>Email<input id="eEmail" type="email" placeholder="The email they sign in with"></label>
          <label><span>Company <span class="opt">optional</span></span><input id="eCompany" maxlength="120"></label>
        </div></div></div>
      <div class="a-sec"><div class="a-num">2</div><div class="a-body">
        <h3>Their Client Folder</h3>
        <div class="grid2">
          <label>Main folder<select id="eTop"><option value="">Loading…</option></select></label>
          <label>Client folder<span class="combo">${svg("search", 15)}<input id="eClient" disabled autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="eClientList" placeholder="Choose the main folder first"><button type="button" class="combo-x" aria-label="Clear" tabindex="-1">${svg("x", 14)}</button><ul class="combo-list" id="eClientList" role="listbox" hidden></ul></span></label>
        </div>
        <p class="a-hint" id="eFolderNote"></p></div></div>
      <div class="a-sec"><div class="a-num">3</div><div class="a-body">
        <h3>Services</h3>
        <p class="a-hint">Tick each service this client uses.</p>
        <div class="ex2">${A.services.map(x => `<div class="ex2-row" data-sid="${esc(x.id)}">
          <label class="ex2-tick"><input type="checkbox" name="esvc" value="${esc(x.id)}"><span class="ex2-box">${svg("check", 14)}</span><b>${esc(x.title)}</b></label>
          <div class="ex2-up"></div></div>`).join("")}</div></div></div>
      <div class="a-foot">
        <label class="switch"><input type="checkbox" id="eNotify"><span class="sw" aria-hidden="true"></span>Email the client their sign-in link</label>
        <div class="a-btns"><button class="btn2" type="button" id="eClear">Clear</button><button class="cta" type="submit">Give Portal Access</button></div>
      </div>
      <div id="eResult"></div>
    </form>`;
    const top = $("#eTop");
    const cl = comboBox($("#eClient"), () => onClient());
    const cpath = () => top.value && cl.value ? `${top.value}/${cl.value}` : "";
    let openSid = null;                       // only one service's chooser is open at a time
    function applyOpen() {
      $$(".ex2-row", pane).forEach(r => {
        const box = $(".uf", r), full = $(".ex2-full", r), sum = $(".ex2-sum", r);
        if (!box || !full) return;
        const open = r.dataset.sid === openSid;
        full.hidden = !open; sum.hidden = open;
        r.classList.toggle("folded", !open);
        if (!open) sum.innerHTML = `<span class="ex2-sumtxt">${ufSummary(box)}</span><span class="ex2-chg">${svg("chev", 14)} Change</span>`;
      });
    }
    function drawRows() {
      $$(".ex2-row", pane).forEach(r => {
        const sid = r.dataset.sid, x = A.services.find(s => s.id === sid), on = $("input", r).checked, box = $(".ex2-up", r);
        r.classList.toggle("on", on);
        if (!on) { box.innerHTML = ""; return; }
        if (!x.upload) { box.innerHTML = `<p class="ex2-note">${svg("info", 13)} Uploads go to the accounting portal. Nothing to choose.</p>`; return; }
        if ($(".uf", box)) return;                                        // keep what was already chosen
        if (!cpath()) { box.innerHTML = `<p class="ex2-note">Choose the client folder above first.</p>`; return; }
        if (treeErr) { box.innerHTML = errBanner(treeErr); return; }
        if (!tree) { box.innerHTML = `<p class="ex2-note"><span class="spin"></span> Loading their folders…</p>`; return; }
        box.innerHTML = `<div class="ex2-full"><p class="ex2-q">Where should their ${esc(x.title)} uploads go?</p><div class="ex2-mount"></div>
            <div class="ex2-done"><button type="button" class="cta sm" data-done>${svg("check", 14)} Done</button></div></div>
          <button type="button" class="ex2-sum" hidden aria-label="Change where ${esc(x.title)} uploads go"></button>`;
        mountUpload($(".ex2-mount", box), sid, tree);
        $("[data-done]", box).onclick = () => { openSid = null; applyOpen(); r.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
        $(".ex2-sum", box).onclick = () => { openSid = sid; applyOpen(); };
      });
      applyOpen();
    }
    const clearUploads = () => $$(".ex2-up", pane).forEach(b => b.innerHTML = "");
    api("/api/admin/folders").then(r => { top.innerHTML = `<option value="">Choose…</option>` + r.folders.map(n => `<option>${esc(n)}</option>`).join(""); })
      .catch(e => { top.innerHTML = `<option value="">${esc(e.message)}</option>`; });
    top.onchange = async () => {
      cl.wait(top.value ? "Loading…" : "Choose the main folder first");
      tree = null; treeErr = ""; $("#eFolderNote").textContent = ""; clearUploads(); drawRows();
      if (!top.value) return;
      try {
        const r = await api("/api/admin/folders?parent=" + encodeURIComponent(top.value));
        cl.set(r.folders);
        $("#eClient").focus();
      } catch (e) { cl.wait(e.message); }
    };
    async function onClient() {
      tree = null; treeErr = ""; clearUploads(); drawRows();
      const p = cpath(); $("#eFolderNote").textContent = "";
      if (!p) return;
      try { const t = await folderTree(p, true); if (p !== cpath()) return; tree = t; $("#eFolderNote").innerHTML = `${svg("check", 14)} Found their folder.`; }
      catch (e) { treeErr = e.message; }
      drawRows();
    }
    $$('input[name="esvc"]', pane).forEach(i => i.onchange = () => {
      const x = A.services.find(s => s.id === i.value);
      if (i.checked && x.upload) openSid = i.value;              // open the one just ticked, fold the others
      else if (!i.checked && openSid === i.value) openSid = null;
      drawRows();
    });
    $("#eClear").onclick = loadExisting;
    $("#eName").focus();
    drawRows();
    $("#ef").onsubmit = async e => {
      e.preventDefault();
      const res = $("#eResult"), sel = $$('input[name="esvc"]:checked', pane).map(i => i.value);
      const uploads = {};
      sel.forEach(s => { const b = $(`.ex2-row[data-sid="${s}"] .uf`, pane); if (b) uploads[s] = uploadValue(b); });
      const needs = A.services.filter(x => sel.includes(x.id) && x.upload && !uploads[x.id]).map(x => x.title);
      const bad = [[!$("#eName").value.trim(), "Enter the client's name."], [!!isEmail($("#eEmail").value.trim()), "Enter a valid email address."],
        [!cpath(), "Choose the main folder and the client folder."], [!sel.length, "Tick at least one service."],
        [needs.length, "Click a folder for " + needs.join(", ") + " (or choose “Make a new folder”)."]].find(x => x[0]);
      if (bad) { res.innerHTML = errBanner(bad[1]); if (needs.length) { openSid = A.services.find(x => x.title === needs[0]).id; applyOpen(); } return; }
      const btn = $('#ef button[type="submit"]'); btn.disabled = true;
      res.innerHTML = `<p class="a-wait"><span class="spin"></span>Giving access… this can take up to a minute.</p>`;
      try {
        const r = await post("/api/admin/existing-client", { name: $("#eName").value, email: $("#eEmail").value, company: $("#eCompany").value,
          top: top.value, client: cl.value, services: sel, uploads, notify: $("#eNotify").checked });
        const failed = r.steps.filter(s => !s.ok);
        res.innerHTML = !failed.length ? okBanner(`<b>${esc($("#eName").value)}</b> can now use the portal.`)
          : banner("warn", `${svg("info", 18)}<span><b>Portal access given, but:</b> ${failed.map(s => esc(s.message)).join(" ")}</span>`);
        svcData = []; delete trees[cpath()];
      } catch (err) { if (!quiet(err)) res.innerHTML = errBanner(err.message); }
      btn.disabled = false;
    };
  }

  /* ================= Client Services: list on the left, the selected client on the right ================= */
  let svcData = [], openClient = null;
  const SVC_DESC = { tax: "Business and personal tax", cas: "Accounting workspace", audit: "Audit and assurance",
                     iwm: "Insurance and wealth planning", sut: "Sales and use tax" };

  // Small pop-up for confirmations (instead of squeezing them into the list).
  function modal({ title, body, yes, danger, fields }) {
    return new Promise(resolve => {
      const back = document.createElement("div");
      back.className = "am-back";
      back.innerHTML = `<div class="am" role="dialog" aria-modal="true" aria-labelledby="amT">
        <h3 id="amT">${title}</h3>${body ? `<p>${body}</p>` : ""}
        ${(fields || []).map((f, i) => `<label>${esc(f.label)}<input data-i="${i}" type="${f.type || "text"}" value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}"></label>`).join("")}
        <div class="am-err" aria-live="polite"></div>
        <div class="am-btns"><button class="btn2 sm" data-no>Cancel</button><button class="cta sm ${danger ? "danger" : ""}" data-yes>${yes}</button></div></div>`;
      document.body.appendChild(back);
      const close = v => { back.remove(); resolve(v); };
      const first = $("input", back) || $("[data-yes]", back); first.focus();
      $("[data-no]", back).onclick = () => close(null);
      back.addEventListener("click", e => { if (e.target === back) close(null); });
      back.addEventListener("keydown", e => { if (e.key === "Escape") close(null); if (e.key === "Enter" && e.target.tagName === "INPUT") $("[data-yes]", back).click(); });
      $("[data-yes]", back).onclick = async () => {
        const vals = $$("input", back).map(x => x.value.trim());
        const err = (fields || []).map((f, i) => f.check && f.check(vals[i])).find(Boolean);
        if (err) { $(".am-err", back).textContent = err; return; }
        $$("button", back).forEach(b => b.disabled = true);
        $(".am-err", back).innerHTML = `<span class="a-wait"><span class="spin"></span>Working…</span>`;
        try { await (fields ? resolve(vals) : resolve(true)); }
        finally { back.remove(); }
      };
    });
  }
  const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? "" : "Enter a valid email address.";
  const need = what => v => v ? "" : `Enter ${what}.`;

  async function loadServices() {
    const pane = $("#pane-services");
    pane.innerHTML = `<div id="sMove"></div>
      <div class="cs">
        <aside class="cs-list">
          <label class="search">${svg("search")}<input id="sSearch" type="search" placeholder="Search clients or people" aria-label="Search clients or people"></label>
          <p class="cs-count" id="sCount"></p>
          <div id="sList" role="list"><div class="skel"></div><div class="skel"></div></div>
        </aside>
        <section class="cs-detail" id="sDetail" aria-live="polite"></section>
      </div>`;
    $("#sSearch").oninput = drawList;
    checkStorage();
    try { svcData = (await api("/api/admin/client-services")).clients; drawServices(); }
    catch (e) { if (!quiet(e)) $("#sList").innerHTML = errBanner(e.message); }
  }
  function drawServices() { drawList(); drawDetail(); }
  function drawList() {
    const q = ($("#sSearch").value || "").toLowerCase();
    const people = svcData.reduce((n, c) => n + c.people.length, 0);
    $("#sCount").textContent = `${svcData.length} client${svcData.length === 1 ? "" : "s"} · ${people} ${people === 1 ? "person" : "people"}`;
    const list = svcData.filter(c => !q || [c.name, c.company, c.path, ...c.people, ...Object.values(c.names || {})].join(" ").toLowerCase().includes(q));
    if (!openClient && svcData.length && window.innerWidth > 860) openClient = svcData[0].path;
    if (!svcData.length) { $("#sList").innerHTML = `<div class="empty">No clients yet. Add one in the Add Client tab.</div>`; return; }
    $("#sList").innerHTML = list.length ? list.map(c => {
      const off = c.services.filter(s => !s.active).length;
      return `<button class="cs-item ${openClient === c.path ? "on" : ""}" role="listitem" data-path="${esc(c.path)}">
        <span class="cl-av" aria-hidden="true">${esc((c.name || "?")[0].toUpperCase())}</span>
        <span class="cs-txt"><b>${esc(c.name)}</b><small>${esc(c.company || c.path)}</small></span>
        <span class="cs-meta">${off ? `<span class="cs-off">${off} off</span>` : ""}<span>${svg("users", 14)} ${c.people.length}</span></span>
      </button>`; }).join("") : `<p class="cs-none">No clients match.</p>`;
    $$("#sList .cs-item").forEach(b => b.onclick = () => {
      openClient = b.dataset.path; drawServices();
      if (window.innerWidth <= 860) $("#sDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  function drawDetail() {
    const box = $("#sDetail"), c = svcData.find(x => x.path === openClient);
    if (!c) { box.innerHTML = `<div class="cs-empty">${svg("users", 28)}<p>Choose a client to see their services and people.</p></div>`; return; }
    const ex = c.layout === "existing";
    const tile = (x, used, was) => {
      const sv = c.services.find(y => y.id === x.id) || {};
      const where = used && ex && x.upload ? `<small class="st-up">${svg("folder", 12)} ${esc(sv.uploadSet ? (sv.upload || "Main folder") : "No upload folder")}
          <button class="linkbtn" data-change>${sv.uploadSet ? "Change" : "Choose"}</button></small>` : "";
      return `<div class="st ${used ? "st-on" : "st-none"}" data-sid="${esc(x.id)}">
        <b>${esc(x.title)}</b>${where}
        ${used ? `<button class="btn-optout" data-act="off">Opt Out</button>`
               : `<button class="cta sm" data-act="${was ? "on" : "add"}">${svg("plus", 14)} Add</button>`}
      </div>`; };
    const active = A.services.filter(x => c.services.some(s => s.id === x.id && s.active));
    const avail = A.services.filter(x => !active.includes(x));
    const tiles = `
      <div class="cd-h-row"><h4 class="cd-h">Active Services <span class="cd-n">${active.length}</span></h4></div>
      ${active.length ? `<div class="st-grid">${active.map(x => tile(x, true)).join("")}</div>`
                      : `<p class="cs-empty-line">No active services. Add one below.</p>`}
      <div class="cd-h-row"><h4 class="cd-h">Available to Add <span class="cd-n">${avail.length}</span></h4></div>
      ${avail.length ? `<div class="st-grid">${avail.map(x => tile(x, false, c.services.some(s => s.id === x.id))).join("")}</div>`
                     : `<p class="cs-empty-line">${svg("check", 14)} This client has every service.</p>`}`;
    box.innerHTML = `
      <header class="cd-head">
        <span class="cl-av lg" aria-hidden="true">${esc((c.name || "?")[0].toUpperCase())}</span>
        <div><h3>${esc(c.name)}${c.layout === "existing" ? ` <span class="tag lay">Existing layout</span>` : ""}</h3><small>${c.company ? esc(c.company) + " · " : ""}${svg("folder", 13)} ${esc(c.path)}</small></div>
      </header>
      <div id="sMsg"></div>
      ${tiles}
      <div class="cd-h-row"><h4 class="cd-h">People</h4><button class="btn2 sm" id="addPerson">${svg("plus", 14)} Add Person</button></div>
      <div class="pl">${c.people.map(e => {
        const nm = (c.names || {})[e] || "";
        return `<div class="pl-row" data-email="${esc(e)}">
          <span class="pp-av" aria-hidden="true">${esc((nm || e)[0].toUpperCase())}</span>
          <span class="pl-nm">${nm ? `<b>${esc(nm)}</b>` : `<b class="noname">No name yet</b>`}<small>${esc(e)}${(c.only || {})[e] ? ` · <span class="pl-only">${esc(c.only[e].join(", "))} only</span>` : ""}</small></span>
          <span class="pl-act"><button class="linkbtn" data-rename>${nm ? "Edit name" : "Add name"}</button><button class="linkbtn danger" data-remove>Remove</button></span>
        </div>`; }).join("") || `<p class="cs-none">Nobody yet.</p>`}</div>`;
    wireDetail(c);
  }
  async function done(r, fallback) {
    svcData = (await api("/api/admin/client-services")).clients; drawServices();
    const m = $("#sMsg"); if (!m) return;
    m.innerHTML = r.warning ? banner("warn", `${svg("info", 18)}<span>${esc(r.message || fallback)} ${esc(r.warning)}</span>`) : okBanner(esc(r.message || fallback));
  }
  async function attempt(fn) {
    const m = $("#sMsg"); if (m) m.innerHTML = `<p class="a-wait"><span class="spin"></span>Working… updating the portal and SharePoint.</p>`;
    try { await fn(); } catch (e) { if (!quiet(e)) { const m = $("#sMsg"); if (m) m.innerHTML = errBanner(e.message); } }
  }
  function wireDetail(c) {
    const n = c.people.length, ppl = `${n} ${n === 1 ? "person" : "people"}`;
    $$("#sDetail [data-act]").forEach(b => b.onclick = async () => {
      const sid = b.closest(".st").dataset.sid, t = A.services.find(x => x.id === sid).title, act = b.dataset.act;
      const ok = await modal(act === "off"
        ? { title: `Opt ${esc(c.name)} out of ${esc(t)}?`, body: `For all ${ppl} at <b>${esc(c.name)}</b>: the ${esc(t)} tile turns grey. Nothing changes in SharePoint. You can add it back any time.`, yes: "Opt Out", danger: true }
        : act === "on" ? { title: `Add ${esc(t)}?`, body: `All ${ppl} at <b>${esc(c.name)}</b> get the ${esc(t)} tile and folder again.`, yes: "Add Service" }
        : { title: `Add ${esc(t)}?`, yes: c.layout === "existing" && A.services.find(x => x.id === sid).upload ? "Next" : "Add Service",
            body: `Gives all ${ppl} at <b>${esc(c.name)}</b> the ${esc(t)} tile.` + (!A.services.find(x => x.id === sid).upload ? ""
              : c.layout === "existing" ? " Next, choose where its uploads go." : ` Creates <b>${esc(t)} / ${esc(A.uploadName)}</b> for their uploads.`) });
      if (!ok) return;
      let upload = "";
      if (act === "add" && c.layout === "existing" && A.services.find(x => x.id === sid).upload) {
        upload = await chooseUpload(c, sid, "", "Add Service");
        if (!upload) return;
      }
      await attempt(async () => done(act === "add" ? await post("/api/admin/client-services/add", { client: c.path, service: sid, upload })
                                                    : await post("/api/admin/client-services", { client: c.path, service: sid, on: act === "on" })));
    });
    $$("#sDetail [data-change]").forEach(b => b.onclick = async () => {
      const sid = b.closest(".st").dataset.sid, t = A.services.find(x => x.id === sid).title;
      const cur = (c.services.find(x => x.id === sid) || {}).uploadId || "";
      const upload = await chooseUpload(c, sid, cur);
      if (!upload) return;
      await attempt(async () => done(await post("/api/admin/client-services/upload", { client: c.path, service: sid, upload })));
    });
    $("#addPerson").onclick = async () => {
      const v = await modal({ title: `Add a Person to ${esc(c.name)}`, body: "They get the same services as everyone at this client.", yes: "Add Person",
        fields: [{ label: "Name", placeholder: "Full name", check: need("their name") }, { label: "Email", type: "email", placeholder: "The email they sign in with", check: isEmail }] });
      if (!v) return;
      await attempt(async () => done(await post("/api/admin/client-person", { client: c.path, name: v[0], email: v[1] })));
    };
    $$("#sDetail [data-rename]").forEach(b => b.onclick = async () => {
      const email = b.closest(".pl-row").dataset.email, now = (c.names || {})[email] || "";
      const v = await modal({ title: now ? "Edit Name" : "Add Name", body: `Shown as “Welcome, …” when <b>${esc(email)}</b> signs in.`, yes: "Save",
        fields: [{ label: "Name", value: now, placeholder: "Full name", check: v => !v ? "Enter their name." : v.includes("@") ? "Enter a name, not an email." : "" }] });
      if (!v) return;
      await attempt(async () => { await post("/api/admin/member-name", { email, client: c.path, name: v[0] }); await done({ message: `Saved. ${email} now sees “Welcome, ${v[0]}”.` }); });
    });
    $$("#sDetail [data-remove]").forEach(b => b.onclick = async () => {
      const email = b.closest(".pl-row").dataset.email, nm = (c.names || {})[email] || email;
      const ok = await modal({ title: `Remove ${esc(nm)}?`, body: `They lose access to <b>${esc(c.name)}</b> on the portal and its folders in SharePoint.`, yes: "Remove", danger: true });
      if (!ok) return;
      await attempt(async () => done(await post("/api/admin/remove-person", { email, client: c.path })));
    });
  }
  // Someone left a client company: find them by email and remove them everywhere.
  async function removeByEmail() {
    const v = await modal({ title: "Remove Someone by Email", body: "For a person who has left a client company. They lose portal access everywhere and are signed out.",
      yes: "Find", fields: [{ label: "Email", type: "email", placeholder: "Their email address", check: isEmail }] });
    if (!v) return;
    let r;
    try { r = await api("/api/admin/person?email=" + encodeURIComponent(v[0])); }
    catch (e) { if (!quiet(e)) flash(e.message, true); return; }
    if (!r.clients.length) { await modal({ title: "Nobody Found", body: `<b>${esc(r.email)}</b> doesn't have access to any client.`, yes: "OK" }); return; }
    const who = (r.clients.find(x => x.person) || {}).person || r.email;
    const ok = await modal({ title: `Remove ${esc(who)}?`, danger: true, yes: r.clients.length === 1 ? "Remove" : `Remove from all ${r.clients.length}`,
      body: `<b>${esc(r.email)}</b> can use: ${r.clients.map(x => `<span class="sp">${esc(x.name)}</span>`).join(" ")}<br>They'll be removed and signed out.` });
    if (!ok) return;
    try { const x = await post("/api/admin/remove-person", { email: r.email }); openClient = openClient || null; await done(x); flash(x.message); }
    catch (e) { if (!quiet(e)) flash(e.message, true); }
  }

  // One-time move of the old one-row-per-service list into Portal Clients + Portal Members.
  let movePoll = null;
  async function checkStorage() {
    const box = $("#sMove");
    if (!box) return;
    let st;
    try { st = await api("/api/admin/storage"); } catch (e) { return; }
    const j = st.job;
    if (j.state === "running") {
      const pct = j.total ? Math.round(100 * j.done / j.total) : 0;
      box.innerHTML = `<div class="move"><div><b>Moving clients to the new format…</b><small>${j.done} of ${j.total || "?"} rows saved. You can keep working.</small></div>
        <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`;
      clearTimeout(movePoll); movePoll = setTimeout(checkStorage, 2000);
      return;
    }
    if (j.state === "done" && movePoll) { movePoll = null; box.innerHTML = okBanner(esc(j.message)); loadServicesData(); return; }
    if (j.state === "error") { box.innerHTML = errBanner("Moving stopped: " + j.message + " Click Move Now to continue; finished rows are kept."); }
    if (st.pending > 0) {
      box.insertAdjacentHTML("beforeend", `<div class="move"><div><b>${st.pending} old record${st.pending === 1 ? "" : "s"} to move</b>
        <small>Clients added before the update are still in the old one-row-per-service list. Move them once to the new, smaller format. Nobody loses access.</small></div>
        <button class="cta sm" id="moveNow">Move Now</button></div>`);
      $("#moveNow").onclick = async () => {
        $("#moveNow").disabled = true;
        try { await post("/api/admin/storage/migrate"); movePoll = 1; box.innerHTML = ""; checkStorage(); }
        catch (e) { $("#moveNow").disabled = false; if (!quiet(e)) box.innerHTML = errBanner(e.message); }
      };
    } else if (j.state !== "error") box.innerHTML = "";
  }
  async function loadServicesData() {
    try { svcData = (await api("/api/admin/client-services")).clients; drawServices(); } catch (e) {}
  }

  /* ================= Remove Access: someone left a client company ================= */
  function loadRemove() {
    const pane = $("#pane-remove");
    pane.innerHTML = `<div class="ra-wrap"><form class="ra-card" id="raForm2" novalidate>
        <span class="ra-ic" aria-hidden="true">${svg("x", 22)}</span>
        <h3>Remove Access</h3>
        <p>For someone who has left a client company. Removing them takes them off the client portal <b>and</b> out of the document site, including every folder and sharing link. They're signed out straight away.</p>
        <label>Email address<input id="raEmail2" type="email" placeholder="name@company.com" autocomplete="off"></label>
        <div id="raOut"></div>
        <button class="cta danger" type="submit" id="raGo">Remove Access</button>
      </form></div>`;
    $("#raEmail2").focus();
    $("#raForm2").onsubmit = async e => {
      e.preventDefault();
      const email = $("#raEmail2").value.trim(), out = $("#raOut");
      if (isEmail(email)) { out.innerHTML = errBanner(isEmail(email)); return; }
      let r;
      try { r = await api("/api/admin/person?email=" + encodeURIComponent(email)); }
      catch (err) { if (!quiet(err)) out.innerHTML = errBanner(err.message); return; }
      const who = (r.clients.find(x => x.person) || {}).person || r.email;
      const ok = await modal({ title: `Remove ${esc(who)}?`, danger: true, yes: "Remove Access",
        body: (r.clients.length ? `On the portal they can use: ${r.clients.map(x => `<span class="sp">${esc(x.name)}</span>`).join(" ")}<br>` : `They aren't on the portal.<br>`)
              + `They'll also be removed from the document site.` });
      if (!ok) return;
      $("#raGo").disabled = true;
      out.innerHTML = `<p class="a-wait"><span class="spin"></span>Removing from the portal and SharePoint…</p>`;
      try {
        const x = await post("/api/admin/remove-person", { email: r.email });
        out.innerHTML = `<ul class="ra-res">
          <li class="ok">${svg("check", 16)}<span><b>Client portal:</b> ${esc(x.portal)}</span></li>
          <li class="${x.sharepoint.ok ? "ok" : "no"}">${svg(x.sharepoint.ok ? "check" : "x", 16)}<span><b>Document site:</b> ${esc(x.sharepoint.message)}</span></li></ul>`;
        $("#raEmail2").value = ""; svcData = [];
      } catch (err) { if (!quiet(err)) out.innerHTML = errBanner(err.message); }
      $("#raGo").disabled = false;
    };
  }

  /* ================= Requests (a client asks to add a team member) ================= */
  function setReqCount(n) { const c = $("#reqCount"); if (!c) return; c.hidden = !n; c.textContent = n || ""; }
  // New requests appear on their own: checked every 10 seconds, no page reload.
  let reqKey = null, reqBusy = false;
  const keyOf = d => d.pending.map(r => r.id).join(",");
  async function refreshReqCount() {
    let d;
    try { d = await api("/api/admin/requests"); } catch (e) { return; }
    const k = keyOf(d), isNew = reqKey !== null && d.pending.some(r => !reqKey.split(",").includes(r.id));
    setReqCount(d.pending.length);
    if (k === reqKey) return;
    if (isNew) flash(d.pending.length === 1 ? `New request from ${d.pending[0].requesterName || d.pending[0].requester}` : "New requests");
    reqKey = k;
    // Redraw the Requests tab if it's open and the admin isn't in the middle of approving or rejecting.
    if (!$("#pane-requests").hidden && !reqBusy) loadRequests(d);
  }
  async function loadRequests(pre) {
    const pane = $("#pane-requests");
    const keepMsg = pre && $("#rqMsg") ? $("#rqMsg").innerHTML : "";
    pane.innerHTML = `<div id="rqMsg">${keepMsg}</div><div id="rqList"><div class="skel"></div></div>`;
    let d;
    try { d = pre && pre.pending ? pre : await api("/api/admin/requests"); reqKey = keyOf(d); }
    catch (e) { if (!quiet(e)) $("#rqList").innerHTML = errBanner(e.message); return; }
    setReqCount(d.pending.length);
    const card = r => {
      if (r.kind === "remove") {
        const where = (r.clients || []).map(c => esc(c.name)).join(", ");
        return `<div class="rq rq-rm" data-id="${esc(r.id)}">
        <div class="rq-main">
          <span class="cl-av rm" aria-hidden="true">${esc((r.name || "?")[0].toUpperCase())}</span>
          <div class="rq-txt"><span class="rq-kind rm">${svg("x", 13)} Remove access</span><b>${esc(r.name)}</b><span>${esc(r.email)}</span>
            <small>Asked by ${esc(r.requesterName || r.requester)}${r.company ? ` · ${esc(r.company)}` : ""} · ${esc(fmtWhen(r.created))}</small>
            <div class="rq-picks"><span class="rq-lbl">Remove from</span><div class="rq-pick">${svg("folder", 14)}<b>${where}</b></div>
            ${r.reason ? `<span class="rq-lbl">Reason</span><div class="rq-pick">${esc(r.reason)}</div>` : ""}</div></div>
        </div>
        <div class="rq-acts">
          <button class="btn2 sm" data-reject>Reject</button>
          <button class="cta sm danger" data-approve>${svg("check")} Approve Removal</button>
        </div><div class="rmsg"></div></div>`;
      }
      const picks = r.picks || [], can = picks.length > 0;
      return `<div class="rq" data-id="${esc(r.id)}">
        <div class="rq-main">
          <span class="cl-av" aria-hidden="true">${esc((r.name || "?")[0].toUpperCase())}</span>
          <div class="rq-txt"><span class="rq-kind add">${svg("plus", 13)} New access</span><b>${esc(r.name)}</b><span>${esc(r.email)}</span>
            <small>Asked by ${esc(r.requesterName || r.requester)}${r.company ? ` · ${esc(r.company)}` : ""} · ${esc(fmtWhen(r.created))}</small>
            ${can ? `<div class="rq-picks"><span class="rq-lbl">Wants access to</span>${picks.map(p => `<div class="rq-pick">${svg("folder", 14)}<b>${esc(p.name)}</b>${p.services.map(s => `<span class="sp">${esc(s)}</span>`).join("")}</div>`).join("")}</div>`
                  : `<small class="rq-f">${svg("folder", 14)} The person who asked has no folders any more</small>`}</div>
        </div>
        <div class="rq-acts">
          <label class="switch sm"><input type="checkbox" data-notify><span class="sw" aria-hidden="true"></span>Email sign-in link</label>
          <button class="btn-reject" data-reject>Reject</button>
          <button class="cta sm" data-approve ${can ? "" : "disabled"}>${svg("check")} Approve</button>
        </div><div class="rmsg"></div></div>`;
    };
    $("#rqList").innerHTML = (d.pending.length ? d.pending.map(card).join("") : `<div class="empty">${svg("check", 18)} No requests waiting.</div>`) +
      (d.decided.length ? `<h3 class="a-h3">Recent Decisions</h3><div class="dec">${d.decided.map(r =>
        `<div class="dec-row"><span><b>${esc(r.name)}</b> <small>${esc(r.email)}${r.kind === "remove" ? " · removal" : ""}</small></span>
          <span class="tag ${r.status === "Approved" ? "ok" : "off"}">${esc(r.status)}</span>
          <small>${esc(fmtWhen(r.decidedAt))}</small></div>`).join("")}</div>` : "");
    $$("#rqList [data-approve], #rqList [data-reject]").forEach(b => b.onclick = async () => {
      const c = b.closest(".rq"), approve = b.hasAttribute("data-approve"), m = $(".rmsg", c);
      if (approve && c.classList.contains("rq-rm")) {
        const nm = $(".rq-txt b", c).textContent;
        const ok = await modal({ title: `Remove ${esc(nm)}?`, danger: true, yes: "Remove",
          body: `They lose access to <b>${$(".rq-pick b", c).innerHTML}</b> on the portal and in SharePoint. If that was their only client, they can't sign in any more.` });
        if (!ok) return;
      }
      reqBusy = true;
      $$("button", c).forEach(x => x.disabled = true);
      m.innerHTML = `<span class="a-wait"><span class="spin"></span>${approve ? "Giving access…" : "Rejecting…"}</span>`;
      try {
        const r = await post(`/api/admin/requests/${encodeURIComponent(c.dataset.id)}/${approve ? "approve" : "reject"}`, { notify: !!($("[data-notify]", c) || {}).checked });
        await loadRequests();
        $("#rqMsg").innerHTML = r.warning ? banner("warn", `${svg("info", 18)}<span>${esc(r.message)} ${esc(r.warning)}</span>`) : okBanner(esc(r.message));
      } catch (e) { $$("button", c).forEach(x => x.disabled = false); if (!quiet(e)) m.innerHTML = errBanner(e.message); }
      reqBusy = false;
    });
  }

  /* ================= Engagement letters (read from DocHub) ================= */
  let letters = [], multiAcct = false;
  async function loadDocs(refresh) {
    const pane = $("#pane-docs");
    if (!A.dochub) { pane.innerHTML = banner("warn", "DocHub isn't connected. Add <code>DOCHUB_API_KEY</code> to <code>.env</code> and restart the portal."); return; }
    pane.innerHTML = `<div class="a-top"><span class="a-hint">Letters sent to client portal users. They also show on that client's portal.</span>
        <button class="btn2 sm" id="dRefresh">${svg("refresh")} Refresh</button></div>
      <div id="dList"><div class="skel"></div></div>`;
    $("#dRefresh").onclick = () => loadDocs(true);
    try {
      const r = await api("/api/admin/agreements" + (refresh ? "?refresh=1" : ""));
      letters = r.letters; multiAcct = (r.accounts || []).length > 1;
      $("#pane-docs .a-hint").textContent = `Letters sent to client portal users${multiAcct ? ` from ${r.accounts.length} DocHub accounts` : ""}. They also show on that client's portal.`
        + (r.hidden ? ` ${r.hidden} letter${r.hidden === 1 ? "" : "s"} sent to people without a portal account ${r.hidden === 1 ? "is" : "are"} not shown.` : "");
      // One line per DocHub account: working or not (opens by itself when one has a problem).
      const st = r.accountStatus || [], bad = st.filter(x => x.ok === false), good = st.filter(x => x.ok);
      if (st.length > 1 || bad.length) {
        $("#dList").insertAdjacentHTML("beforebegin", `<details class="acct-st ${bad.length ? "has-bad" : ""}" ${bad.length ? "open" : ""}>
          <summary>${svg(bad.length ? "info" : "check", 15)} ${good.length} of ${st.length} DocHub account${st.length === 1 ? "" : "s"} working${bad.length ? ` · <b>${bad.length} need${bad.length === 1 ? "s" : ""} attention</b>` : ""}</summary>
          <ul>${st.map(x => `<li class="${x.ok === false ? "bad" : x.ok ? "ok" : ""}">${svg(x.ok === false ? "x" : "check", 14)}<b>${esc(x.label)}</b>
            <span>${x.ok === false ? esc(x.error || "Couldn't connect") + " Check this account's API key in .env." : x.ok ? `${x.open} open letter${x.open === 1 ? "" : "s"}` : "Not checked yet"}</span></li>`).join("")}</ul></details>`);
      } else if (r.error) $("#dList").insertAdjacentHTML("beforebegin", errBanner("DocHub: " + r.error));
      drawDocs();
    } catch (e) { if (!quiet(e)) $("#dList").innerHTML = errBanner(e.message); }
  }
  const pill = s => `<span class="tag ${s === "Signed" ? "ok" : s === "Waiting" ? "wait" : ""}">${esc(s === "Waiting" ? "Waiting" : s)}</span>`;
  function drawDocs() {
    if (!letters.length) { $("#dList").innerHTML = `<div class="empty">No letters sent to client portal users in the last 45 days.</div>`; return; }
    $("#dList").innerHTML = `<div class="table-wrap"><table class="a-table">
      <thead><tr><th>Client</th><th>Document</th>${multiAcct ? "<th>Sent From</th>" : ""}<th>Sent</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${letters.map((d, i) => `<tr data-i="${i}">
        <td class="email">${esc(d.email || "-")}</td><td>${esc(d.title)}</td>${multiAcct ? `<td>${esc(d.account || "")}</td>` : ""}<td class="num">${esc(d.sent || "-")}</td><td>${pill(d.status)}</td>
        <td class="acts">${d.open && d.status === "Waiting" ? `<button class="linkbtn" data-a="resend">Resend</button><button class="linkbtn danger" data-a="cancel">Cancel</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
    $$("#dList [data-a]").forEach(b => {
      const d = letters[+b.closest("tr").dataset.i], a = b.dataset.a;
      const run = async () => { await post(`/api/admin/agreements/${encodeURIComponent(d.id)}/${a}`, { signerId: d.signerId });
        if (a === "resend") flash("Signing email sent again."); loadDocs(true); };
      b.onclick = a === "cancel" ? () => confirmInline(b, "Cancel this letter in DocHub?", run)
        : async () => { b.disabled = true; try { await run(); } catch (e) { b.disabled = false; flash(e.message, true); } };
    });
  }
  function confirmInline(btn, question, run) {
    const cell = btn.parentElement, old = cell.innerHTML;
    cell.innerHTML = `<span class="confirm">${esc(question)} <button class="linkbtn danger" data-yes>Yes</button><button class="linkbtn" data-no>No</button></span>`;
    $("[data-no]", cell).onclick = () => { cell.innerHTML = old; drawDocs(); };
    $("[data-yes]", cell).onclick = async () => {
      cell.innerHTML = `<span class="muted">Working…</span>`;
      try { await run(); } catch (e) { cell.innerHTML = `<span class="bad">${esc(e.message)}</span>`; }
    };
  }
  function flash(msg, err) {
    const el = document.createElement("div"); el.className = "flash" + (err ? " err" : ""); el.setAttribute("role", "status"); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), 4000);
  }

  /* ================= Activity ================= */
  const ACT = { login: "Signed in", upload_start: "Started an upload", open_upload_folder: "Opened upload folder", open_download_folder: "Opened their documents",
    service_interest: "Interested in a service", agreement_opened: "Opened a letter to sign", admin_letter_resend: "Resent a letter", admin_letter_cancel: "Cancelled a letter",
    admin_add_client: "Added a client", admin_edit_client: "Edited a client", admin_remove_client: "Removed a client",
    admin_service_off: "Switched a service off", admin_service_on: "Switched a service on",
    access_requested: "Asked for access for someone", access_request_approved: "Approved a request", access_request_rejected: "Rejected a request",
    vault_save: "Saved a login", vault_reveal: "Used a saved login", vault_delete: "Removed a saved login" };
  async function loadActivity() {
    const pane = $("#pane-activity");
    pane.innerHTML = `<div class="a-top"><label class="search">${svg("search")}<input id="aSearch" type="search" placeholder="Search activity" aria-label="Search activity"></label></div><div id="aList"><div class="skel"></div></div>`;
    let rows = [];
    const draw = () => {
      const q = ($("#aSearch").value || "").toLowerCase();
      const list = rows.filter(r => !q || [r.who, r.detail, ACT[r.action] || r.action].join(" ").toLowerCase().includes(q)).slice(0, 150);
      $("#aList").innerHTML = list.length ? `<div class="table-wrap"><table class="a-table"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
        <tbody>${list.map(r => `<tr><td class="num">${esc(fmtWhen(r.when))}</td><td class="email">${esc(r.who)}</td>
          <td>${esc(ACT[r.action] || r.action.replace(/_/g, " "))}${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty">No activity${q ? " matches" : " yet"}.</div>`;
    };
    $("#aSearch").oninput = draw;
    try { rows = (await api("/api/admin/activity")).activity; draw(); }
    catch (e) { if (!quiet(e)) $("#aList").innerHTML = errBanner(e.message); }
  }

  refreshReqCount();
  setInterval(() => { if (!document.hidden) refreshReqCount(); }, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshReqCount(); });
  let start = "clients";
  try { start = sessionStorage.getItem("tw_admin_tab") || "clients"; } catch (e) {}
  const fromLink = location.hash.replace("#", "");          // e.g. the "Open the Requests tab" link in the admin email
  if (tabs[fromLink]) start = fromLink;
  show(tabs[start] ? start : "clients");
})();
