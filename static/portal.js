/* Client Portal - guided flow + SharePoint upload/download */
(function () {
  "use strict";
  const CFG = JSON.parse(document.getElementById("portal-config").textContent);

  /* ---------------- icons ---------------- */
  const I = {
    receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    chart:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
    shield:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
    download:'<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
    building:'<path d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16"/><path d="M14 9h5a1 1 0 011 1v11"/><path d="M8 8h2M8 12h2M8 16h2"/><path d="M3 21h18"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    folder:'<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
    file:'<path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8l-5-5z"/><path d="M14 3v5h5"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    ext:'<path d="M7 17L17 7M9 7h8v8"/>',
    back:'<path d="M15 6l-6 6 6 6"/>',
    check:'<path d="M5 12l5 5 9-10"/>',
    home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    heart:'<path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"/>',
    calc:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v4"/>',
    app:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6M12 9v6"/>'
  };
  const nameOf = o => (o && (o.display || o.title)) || "";
  const svg = (n, s = 22, w = 1.8) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || I.app}</svg>`;
  const tc = s => String(s || "").replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---------------- API ---------------- */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...opts,
      headers: { "Content-Type": "application/json", "X-Portal": "1", ...(opts.headers || {}) }
    });
    if (res.status === 401) { location.href = "/login"; throw new Error("signed_out"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }
  // All of the user's folders are fetched once; each service shows its own (rows with no service apply to all).
  let foldersPromise = null;
  const getFolders = (service = "", refresh) => {
    if (!foldersPromise || refresh) {
      foldersPromise = api("/api/folders" + (refresh ? "?refresh=1" : "")).then(d => d.folders);
      foldersPromise.catch(() => { foldersPromise = null; });
    }
    return service ? foldersPromise.then(l => l.filter(f => f.service === service || !f.service)) : foldersPromise;
  };
  const MY = CFG.myServices || [];
  const hasService = id => MY.includes("*") || MY.includes(id);

  /* ---------------- router ---------------- */
  const parsePath = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const go = parts => { location.hash = "/" + parts.join("/"); };

  function resolve(parts) {
    let node = CFG.flow, trail = [];
    for (const id of parts) {
      const opt = node && node.options && node.options.find(o => o.id === id);
      if (!opt) break;
      trail.push({ node, choice: opt });
      if (trail.length === 1 && !hasService(opt.id)) return { trail, node: null, dest: null, locked: opt };
      if (opt.dest) return { trail, node: null, dest: CFG.destinations[opt.dest] };
      node = opt.next;
    }
    return { trail, node, dest: null };
  }

  const $view = document.getElementById("view");
  let CURRENT_SERVICE = null;
  const $stepper = document.getElementById("stepper");

  function render() {
    if (location.hash === "#help") return;
    const parts = parsePath();
    const { trail, node, dest, locked } = resolve(parts);
    const valid = trail.map(t => t.choice.id);
    if (valid.length !== parts.length) return go(valid);

    renderStepper(trail, node, dest);
    $view.classList.remove("view"); void $view.offsetWidth; $view.classList.add("view");

    const service = trail.length ? trail[0].choice.id : "";
    CURRENT_SERVICE = trail.length ? trail[0].choice : null;
    if (locked) renderPromo(locked);
    else if (dest) renderDest(dest, service);
    else {
      $view.innerHTML = questionHTML(node);
      $view.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => go([...valid, b.dataset.opt])));
    }
    const h = $view.querySelector("h2");
    if (h && trail.length) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    document.title = (dest ? dest.title : trail.length ? nameOf(trail[trail.length - 1].choice) : "Home") + " · Client Portal";
  }

  // Top bar of the panel: only Back / Home buttons (no step indicators).
  function renderStepper(trail, node, dest) {
    if (!(trail.length || dest)) { $stepper.innerHTML = ""; $stepper.style.display = "none"; return; }
    $stepper.style.display = "";
    $stepper.innerHTML = `<span class="spacer"></span><button class="navbtn" id="backBtn">${svg("back", 16, 2.2)}Back</button><button class="navbtn" id="restartBtn">${svg("home", 16, 2)}Home</button>`;
    document.getElementById("backBtn").onclick = () => go(trail.slice(0, -1).map(t => t.choice.id));
    document.getElementById("restartBtn").onclick = () => go([]);
  }

  function questionHTML(node) {
    const n = node.options.length;
    const top = node === CFG.flow;
    // Services the client has come first; the others are greyed out with a short invitation.
    const opts = top ? [...node.options].sort((a, b) => hasService(b.id) - hasService(a.id)) : node.options;
    const svcName = !top && CURRENT_SERVICE ? `<span class="q-k">${svg(CURRENT_SERVICE.icon, 15, 2)}${esc(nameOf(CURRENT_SERVICE))}</span>` : "";
    return `<div class="q">${svcName}<h2>${esc(node.question)}</h2>${node.sub ? `<p>${esc(node.sub)}</p>` : ""}</div>
      <div class="cards ${n >= 3 ? "c3" : "c2"}">${opts.map(o => {
        const locked = top && !hasService(o.id);
        return locked ? `
        <button class="card locked" data-opt="${esc(o.id)}"><span class="ic">${svg(o.icon, 24)}</span>
          <h3>${esc(nameOf(o))}</h3><span class="d">${esc(o.promo_short || o.desc || "")}</span>
          <span class="more">Learn more ${svg("arrow", 15, 2)}</span></button>` : `
        <button class="card" data-opt="${esc(o.id)}"><span class="ic">${svg(o.icon, 24)}</span><span class="go">${svg("ext", 18, 2.2)}</span>
          <h3>${esc(nameOf(o))}</h3><span class="d">${esc(o.desc || "")}</span></button>`;
      }).join("")}</div>`;
  }

  // Page for a service the client doesn't have yet.
  function renderPromo(o) {
    const pts = o.promo_points || [];
    $view.innerHTML = `<div class="dest"><div>
      <span class="eyebrow"><span class="pl">${svg(o.icon, 16, 2)}</span>${esc(nameOf(o))}</span>
      <h2>${esc(o.promo_title || "Interested in " + nameOf(o) + "?")}</h2>
      <p class="lead">${esc(o.promo || o.desc || "")}</p>
      ${pts.length ? `<ul class="check promo-pts">${pts.map(x => `<li>${svg("check", 18, 2.4)}<span>${esc(x)}</span></li>`).join("")}</ul>` : ""}
      <label class="int-note"><span>Anything you'd like us to know? <span class="muted">(optional)</span></span>
        <textarea id="intText" rows="3" maxlength="1500" placeholder="For example, the best time to reach you"></textarea></label>
      <div class="actions"><button class="cta" id="interest">${svg("mail", 18, 2.2)} I'm interested</button></div>
      <div id="intMsg"></div></div></div>`;
    const btn = document.getElementById("interest");
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api("/api/interest", { method: "POST", body: JSON.stringify({ service: o.id, message: (document.getElementById("intText") || {}).value || "" }) });
        const t = document.getElementById("intText"); if (t) t.disabled = true;
        btn.innerHTML = `${svg("check", 18, 2.4)} Request sent`;
        thanksPopup(nameOf(o));
      } catch (e) { btn.disabled = false; if (e.message !== "signed_out") document.getElementById("intMsg").innerHTML = errHTML(e.message); }
    };
  }

  // "Thank you" pop-up after "I'm interested", closed with OK.
  function thanksPopup(service) {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal ty" role="dialog" aria-modal="true" aria-labelledby="tyT">
      <span class="ty-ic" aria-hidden="true">${svg("check", 30, 2.4)}</span>
      <h2 id="tyT">Thank You for Your Interest</h2>
      <p>We've received your request for <b>${esc(service)}</b>. A member of our team will be in touch with you shortly to talk through how we can help.</p>
      <div class="actions"><button class="cta" type="button" data-ok>OK</button></div></div>`;
    document.body.appendChild(back);
    document.body.classList.add("modal-open");
    const ok = back.querySelector("[data-ok]");
    const close = () => { back.remove(); document.body.classList.remove("modal-open"); };
    ok.onclick = close;
    back.addEventListener("keydown", e => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); close(); } });
    ok.focus();
  }

  /* ---------------- destination pages ---------------- */
  function headHTML(d) {
    const icon = d.type === "external" ? (d.icon || "app") : "folder";
    return `<span class="eyebrow"><span class="pl">${svg(icon, 16, 2)}</span>${esc(d.platform)}</span>
      <h2>${esc(d.title)}</h2>${d.lead ? `<p class="lead">${esc(d.lead)}</p>` : ""}`;
  }
  // Optional short list of what an external app is used for (portal.yaml: about).
  const aboutHTML = d => d.about && d.about.length
    ? `<ul class="check about">${d.about.map(x => `<li>${svg("check", 18, 2.4)}<span>${esc(x)}</span></li>`).join("")}</ul>` : "";
  // Side card: simple numbered steps for the folder pages (plus any tips: in portal.yaml).
  const STEPS = {
    sharepoint_upload: { h: "How to Upload", steps: [
      "Click <b>Open My Upload Folder</b>. It opens in a new tab.",
      "Drag your files onto that page. Or click <b>Upload</b> at the top, then <b>Files</b>, and pick your files.",
      "That's it. Our team can see your files straight away. You can close the tab."],
      tip: "Give your files clear names, like <i>2025 Bank Statement - Chase</i>." },
    sharepoint_download: { h: "How to Download", steps: [
      "Click <b>Open My Deliverables</b>. It opens in a new tab.",
      "Click a folder to look inside it, and click a document to open it.",
      "To save a copy, tick the circle next to the document and click <b>Download</b> at the top."] }
  };
  const tipsFor = d => STEPS[d.type] || null;
  function sideHTML(d) {
    const g = STEPS[d.type];
    if (!g) return "";
    const tips = d.tips && d.tips.length ? d.tips.map(esc) : (g.tip ? [g.tip] : []);
    return `<aside class="side"><h3>${g.h}</h3>
      <ol class="howto">${g.steps.map((x, i) => `<li><span class="n">${i + 1}</span><span>${x}</span></li>`).join("")}</ol>
      ${tips.map(t => `<p class="howtip">${svg("info", 16, 2)}<span>${t}</span></p>`).join("")}
</aside>`;
  }

  const noFoldersHTML = () => `<div class="empty">We're still setting up your folder. Please check back soon.</div>`;
  // Gentle fade-in for content that arrives after loading (folders, saved logins).
  const reveal = el => { if (!el) return; el.classList.remove("reveal"); void el.offsetWidth; el.classList.add("reveal"); };
  const errHTML = msg => `<div class="banner err">${svg("info", 20)}<span>${esc(msg)}</span></div>`;

  function renderDest(d, service) {
    if (d.type === "external") return renderExternal(d);
    return renderFolder(d, service, d.type === "sharepoint_upload" ? "upload" : "download");
  }

  // Per-browser memory of "I've set up automatic sign-in" (safe if storage is blocked).
  const seen = {
    get: k => { try { return localStorage.getItem("tw_as_" + k) === "1"; } catch (e) { return false; } },
    set: (k, v) => { try { v ? localStorage.setItem("tw_as_" + k, "1") : localStorage.removeItem("tw_as_" + k); } catch (e) {} }
  };
  const browserName = () => /Edg\//.test(navigator.userAgent) ? "edge" : /Chrome\//.test(navigator.userAgent) ? "chrome" : "other";

  function renderExternal(d) {
    const auto = !!(d.auto_signin && d.launcher_url);
    const href = auto ? d.launcher_url : d.url;
    const key = (d.platform || "app").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = CFG.extension || {};
    const b = browserName();
    const extLink = b === "edge" ? ext.edge : b === "chrome" ? ext.chrome : (ext.chrome || ext.edge);

    const guide = auto ? `
      <div class="setup ${seen.get(key) ? "collapsed" : ""}" id="setup">
        <button class="setup-head" id="setupToggle" aria-expanded="${seen.get(key) ? "false" : "true"}">
          <span class="badge">${svg("lock", 16, 2)}</span>
          <span><b>First time? Turn on automatic sign-in</b><span>One-time setup, about 2 minutes</span></span>
          <span class="chev">${svg("arrow", 16, 2)}</span>
        </button>
        <div class="setup-body">
          <ol class="steps">
            <li><b>Install the Microsoft sign-in extension</b>${b === "other" ? " (use Microsoft Edge or Google Chrome)" : ""}.
              ${extLink ? `<a href="${esc(extLink)}" target="_blank" rel="noopener">Get it for ${b === "edge" ? "Edge" : "Chrome"} ${svg("ext", 13, 2)}</a>` : ""}
              <span class="muted">Microsoft may also prompt you for this automatically.</span></li>
            <li><b>Click "${esc(d.cta || "Open")}"</b> below. Microsoft asks for your ${esc(d.platform)} username and password <b>once</b> and stores them securely. Northwind never sees them.</li>
            <li><b>That's it.</b> From now on, ${esc(d.platform)} opens and signs you in automatically.</li>
          </ol>
          <button class="linkbtn" id="setupDone">${svg("check", 15, 2.4)} I've done this, hide these steps</button>
        </div>
      </div>` : "";

    const useVault = !auto && d.vaultKey && CFG.vaultEnabled;
    if (useVault) {
      $view.innerHTML = `<div class="dest ext"><div class="ext-top"><div>${headHTML(d)}</div><div class="vb-wrap" id="vbWrap"></div></div>
        ${aboutHTML(d)}<div id="vaultBox"><div class="skel"></div></div></div>`;
      loginArea(document.getElementById("vaultBox"), document.getElementById("vbWrap"),
        { key: d.vaultKey, name: tc(d.login_name || d.platform), url: d.url });
      return;
    }

    $view.innerHTML = `<div class="dest"><div>${headHTML(d)}${aboutHTML(d)}${guide}
      <a class="cta" href="${esc(href)}" target="_blank" rel="noopener">${esc(d.cta || "Open")} ${svg("ext", 18, 2.2)}</a>
      <div class="cta-note">
        ${auto && d.url ? ` Problems? <a href="${esc(d.url)}" target="_blank" rel="noopener">Open ${esc(d.platform)} without automatic sign-in</a>.` : ""}</div>
      </div>${sideHTML(d)}</div>`;

    if (auto) {
      const box = document.getElementById("setup");
      const tog = document.getElementById("setupToggle");
      tog.onclick = () => { const c = box.classList.toggle("collapsed"); tog.setAttribute("aria-expanded", String(!c)); };
      document.getElementById("setupDone").onclick = () => { seen.set(key, true); box.classList.add("collapsed"); tog.setAttribute("aria-expanded", "false"); };
    }
  }

  /* ---------------- saved logins (vault) ---------------- */
  let vaultList = null;
  const loadVault = async (refresh) => {
    if (!vaultList || refresh) vaultList = api("/api/vault").then(r => r.apps);
    return vaultList;
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      // Fallback for browsers that block the clipboard API
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (e2) {}
      ta.remove(); return ok;
    }
  }

  // Main button (left) + "Saved Login" button with a small panel (top right) for an external app.
  async function loginArea(main, wrap, app) {
    let info;
    try { info = (await loadVault()).find(a => a.key === app.key) || { saved: false, username: "" }; }
    catch (e) { if (e.message !== "signed_out") main.innerHTML = errHTML(e.message); return; }
    const getPass = async () => (await api(`/api/vault/${app.key}/reveal`, { method: "POST" })).password;
    const note = (html, kind) => { const m = document.getElementById("vMsg"); if (m) m.innerHTML = html ? `<div class="banner ${kind || "ok"}">${html}</div>` : ""; };

    function drawMain() {
      main.innerHTML = info.saved
        ? `<button class="cta" id="vGo">${svg("lock", 18, 2.2)} Copy Password &amp; Open ${esc(app.name)} ${svg("ext", 16, 2.2)}</button>
           <p class="v-hint">Signing in as <b>${esc(info.username)}</b>. Your password is copied, so just paste it on the sign-in page.</p><div id="vMsg"></div>`
        : `<a class="cta" href="${esc(app.url)}" target="_blank" rel="noopener">Open ${esc(app.name)} ${svg("ext", 16, 2.2)}</a>
           <p class="v-hint">Tip: use <b>Save My Login</b> (top right) to keep your ${esc(app.name)} login here. Next time, one click copies your password and opens the page.</p><div id="vMsg"></div>`;
      const go = document.getElementById("vGo");
      if (go) go.onclick = async () => {
        try {
          const ok = await copyText(await getPass());
          const w = window.open(app.url, "_blank"); if (w) { try { w.opener = null; } catch (e) {} }
          note(`${svg("check", 18, 2.4)}<span>${ok ? "Password copied. Paste it on the sign-in page." : "Couldn't copy the password."}${w === null ? ` <a href="${esc(app.url)}" target="_blank" rel="noopener">Open ${esc(app.name)}</a>` : ""}</span>`, ok ? "ok" : "err");
        } catch (e) { if (e.message !== "signed_out") note(esc(e.message), "err"); }
      };
      wrap.innerHTML = `<button class="vbtn ${info.saved ? "on" : ""}" id="vBtn" aria-expanded="false" aria-controls="vPanel">
          ${svg(info.saved ? "check" : "key", 16, 2.2)} ${info.saved ? "Login Saved" : "Save My Login"} ${svg("back", 14, 2.2)}${info.saved ? "" : `<span class="vdot" aria-hidden="true"></span>`}</button>
        <div class="vpanel" id="vPanel" hidden></div>`;
      const btn = document.getElementById("vBtn"), panel = document.getElementById("vPanel");
      const toggle = open => { panel.hidden = !open; btn.setAttribute("aria-expanded", String(open)); if (open) drawPanel(); };
      btn.onclick = e => { e.stopPropagation(); toggle(panel.hidden); };
      document.addEventListener("click", e => { if (!panel.hidden && !wrap.contains(e.target)) toggle(false); });
      wrap.addEventListener("keydown", e => { if (e.key === "Escape") { toggle(false); btn.focus(); } });
    }

    function drawPanel(editing) {
      const panel = document.getElementById("vPanel");
      if (info.saved && !editing) {
        panel.innerHTML = `<h4>${esc(app.name)} Login</h4>
          <div class="vp-row"><span>Username</span><b>${esc(info.username)}</b><button class="chipbtn" data-a="cu">Copy</button></div>
          <div class="vp-row"><span>Password</span><b>••••••••</b><button class="chipbtn" data-a="cp">Copy</button></div>
          <div class="vp-acts"><button class="btn2 sm" data-a="edit">Change</button><button class="linkbtn danger" data-a="del">Remove</button></div>
          <p class="vp-msg" aria-live="polite"></p>`;
        const m = t => { panel.querySelector(".vp-msg").textContent = t; };
        panel.querySelector('[data-a="cu"]').onclick = async () => m(await copyText(info.username) ? "Username copied." : "Couldn't copy.");
        panel.querySelector('[data-a="cp"]').onclick = async () => { try { m(await copyText(await getPass()) ? "Password copied." : "Couldn't copy."); } catch (e) { m(e.message); } };
        panel.querySelector('[data-a="edit"]').onclick = () => drawPanel(true);
        const del = panel.querySelector('[data-a="del"]');
        del.onclick = async () => {
          if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Click again to remove"; return; }
          try { await api(`/api/vault/${app.key}`, { method: "DELETE" }); info = { saved: false, username: "" }; await loadVault(true); drawMain(); }
          catch (e) { m(e.message); }
        };
        return;
      }
      panel.innerHTML = `<h4>${info.saved ? "Change" : "Save"} Your ${esc(app.name)} Login</h4>
        <p class="vp-sub">Stored encrypted. Only you can use it.</p>
        <form autocomplete="off">
          <label>Username or email<input name="u" required maxlength="256" value="${esc(info.username || "")}" autocomplete="off"></label>
          <label>Password<span class="pw"><input name="p" type="password" required maxlength="512" autocomplete="new-password"><button type="button" class="linkbtn" data-a="show">Show</button></span></label>
          <div class="vp-acts"><button class="cta sm" type="submit">Save</button>${info.saved ? `<button type="button" class="btn2 sm" data-a="cancel">Cancel</button>` : ""}</div>
          <p class="vp-msg" aria-live="polite"></p>
        </form>`;
      const f = panel.querySelector("form");
      f.u.focus();
      panel.querySelector('[data-a="show"]').onclick = e => { f.p.type = f.p.type === "password" ? "text" : "password"; e.target.textContent = f.p.type === "password" ? "Show" : "Hide"; };
      const c = panel.querySelector('[data-a="cancel"]'); if (c) c.onclick = () => drawPanel(false);
      f.onsubmit = async e => {
        e.preventDefault();
        if (!f.u.value.trim() || !f.p.value) { panel.querySelector(".vp-msg").textContent = "Enter your username and password."; return; }
        const b = f.querySelector('button[type="submit"]'); b.disabled = true;
        try {
          const r = await api(`/api/vault/${app.key}`, { method: "PUT", body: JSON.stringify({ username: f.u.value, password: f.p.value }) });
          info = { saved: true, username: r.username }; await loadVault(true); drawMain();
          note(`${svg("check", 18, 2.4)}<span>Login saved. Next time, one click copies your password and opens ${esc(app.name)}.</span>`, "ok");
        } catch (err) { b.disabled = false; if (err.message !== "signed_out") panel.querySelector(".vp-msg").textContent = err.message; }
      };
    }
    drawMain();
    reveal(main);
  }

  // Renders the "Your <App> login" card into `el` for app {key, name, url, cta}.
  async function vaultCard(el, app, compact) {
    let info;
    try { info = (await loadVault()).find(a => a.key === app.key); }
    catch (e) { if (e.message !== "signed_out") el.innerHTML = errHTML(e.message); return; }
    if (!info) { el.innerHTML = `<a class="cta" href="${esc(app.url)}" target="_blank" rel="noopener">${esc(app.cta || "Open " + app.name)} ${svg("ext", 18, 2.2)}</a>`; return; }

    const msg = (html, kind) => { const m = el.querySelector(".vmsg"); if (m) m.innerHTML = html ? `<div class="banner ${kind || "ok"}">${html}</div>` : ""; };

    const drawSaved = () => {
      el.innerHTML = `
        <div class="vault">
          <div class="vhead"><span class="badge">${svg("lock", 16, 2)}</span>
            <span><b>Your ${esc(tc(app.name))} Login</b></span></div>
          <div class="vrow"><span class="vlabel">Username</span><span class="vval">${esc(info.username)}</span>
            <button class="chipbtn" data-act="copyUser">${svg("file", 14)}Copy</button></div>
          <div class="vrow"><span class="vlabel">Password</span><span class="vval dots">••••••••••</span>
            <button class="chipbtn" data-act="copyPass">${svg("file", 14)}Copy</button></div>
          <div class="actions" style="margin-top:14px">
            <button class="cta" data-act="go">${svg("lock", 18, 2.2)} Copy password &amp; open ${esc(app.name)}</button>
          </div>
          <div class="vlinks"><button class="linkbtn" data-act="edit">Change saved login</button><button class="linkbtn" data-act="del">Remove</button></div>
          <div class="vmsg"></div>
        </div>`;
      el.querySelector('[data-act="copyUser"]').onclick = async () => {
        msg(await copyText(info.username) ? `${svg("check", 18, 2.4)}<span>Username copied</span>` : "Couldn't copy to the clipboard.", "ok");
      };
      const getPass = async () => (await api(`/api/vault/${app.key}/reveal`, { method: "POST" })).password;
      el.querySelector('[data-act="copyPass"]').onclick = async () => {
        try { const ok = await copyText(await getPass()); msg(ok ? `${svg("check", 18, 2.4)}<span>Password copied</span>` : "Couldn't copy to the clipboard.", ok ? "ok" : "err"); }
        catch (e) { if (e.message !== "signed_out") msg(esc(e.message), "err"); }
      };
      el.querySelector('[data-act="go"]').onclick = async () => {
        try {
          const ok = await copyText(await getPass());
          const w = window.open(app.url, "_blank"); if (w) { try { w.opener = null; } catch (e) {} }
          msg(`${svg("check", 18, 2.4)}<span>${ok ? "Password copied" : "Couldn't copy the password"}${w === null ? ` · <a href="${esc(app.url)}" target="_blank" rel="noopener">Open ${esc(app.name)}</a>` : ""}</span>`, ok ? "ok" : "err");
        } catch (e) { if (e.message !== "signed_out") msg(esc(e.message), "err"); }
      };
      el.querySelector('[data-act="edit"]').onclick = () => drawForm(true);
      el.querySelector('[data-act="del"]').onclick = async () => {
        if (!confirm(`Remove your saved ${app.name} login from the portal?`)) return;
        try { await api(`/api/vault/${app.key}`, { method: "DELETE" }); info.saved = false; info.username = ""; await loadVault(true); drawForm(false); }
        catch (e) { if (e.message !== "signed_out") msg(esc(e.message), "err"); }
      };
    };

    const drawForm = (editing) => {
      el.innerHTML = `
        <div class="vault">
          <div class="vhead"><span class="badge">${svg("lock", 16, 2)}</span>
            <span><b>${editing ? "Update" : "Save"} Your ${esc(tc(app.name))} Login</b></span></div>
          <form class="vform" autocomplete="off">
            <label>Username or email<input name="u" required maxlength="256" value="${esc(info.username || "")}" autocomplete="off"></label>
            <label>Password<span class="pw"><input name="p" type="password" required maxlength="512" autocomplete="new-password">
              <button type="button" class="linkbtn" data-act="show">Show</button></span></label>
            <div class="actions" style="margin-top:4px">
              <button class="cta" type="submit">${svg("lock", 18, 2.2)} Save login</button>
              ${editing ? '<button type="button" class="btn2" data-act="cancel">Cancel</button>' : `<a class="btn2" href="${esc(app.url)}" target="_blank" rel="noopener">Open ${esc(app.name)} ${svg("ext", 15, 2)}</a>`}
            </div>
          </form>
          <div class="vmsg"></div>
        </div>`;
      const f = el.querySelector("form");
      el.querySelector('[data-act="show"]').onclick = (e) => { const p = f.p; p.type = p.type === "password" ? "text" : "password"; e.target.textContent = p.type === "password" ? "Show" : "Hide"; };
      const cancel = el.querySelector('[data-act="cancel"]'); if (cancel) cancel.onclick = drawSaved;
      f.onsubmit = async (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
        try {
          const r = await api(`/api/vault/${app.key}`, { method: "PUT", body: JSON.stringify({ username: f.u.value, password: f.p.value }) });
          f.p.value = ""; info.saved = true; info.username = r.username; await loadVault(true);
          drawSaved(); msg(`${svg("check", 18, 2.4)}<span>Login saved</span>`, "ok");
        } catch (err) { btn.disabled = false; if (err.message !== "signed_out") msg(esc(err.message), "err"); }
      };
    };

    info.saved ? drawSaved() : drawForm(false);
    reveal(el);
  }

  /* ---------------- Upload / Download: open the right folder in SharePoint ---------------- */
  async function renderFolder(d, service, kind) {
    $view.innerHTML = `<div class="dest ${tipsFor(d) ? "has-side" : ""}"><div>${headHTML(d)}<div id="fb"><div class="skel"></div></div></div>${sideHTML(d)}</div>`;
    const box = document.getElementById("fb");
    const has = kind === "upload" ? "hasUpload" : "hasDownload";
    // Direct SharePoint link to the service's Upload or Download folder (hover the button to see it).
    const link = f => kind === "upload" ? f.uploadUrl : f.downloadUrl;
    const cta = d.cta || (kind === "upload" ? "Open My Upload Folder" : "Open My Deliverables");
    try {
      // Download opens the client's main folder; several service rows can share it, so list each folder once.
      const seenUrl = new Set();
      const list = (await getFolders(service)).filter(f => f[has] && !seenUrl.has(link(f)) && seenUrl.add(link(f)));
      if (!list.length) { box.innerHTML = noFoldersHTML(); return; }
      if (list.length === 1) {
        box.innerHTML = `<a class="cta" href="${link(list[0])}" target="_blank" rel="noopener">${svg(kind, 18, 2.2)} ${esc(cta)} ${svg("ext", 16, 2.2)}</a>`;
        return;
      }
      box.innerHTML = `<div class="block"><p class="block-title"><label for="rootSel">Which account is this for?</label></p>
          <span class="selwrap">${svg("folder", 18)}<select id="rootSel">
            ${list.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></span></div>
        <a class="cta" id="openBtn" href="${link(list[0])}" target="_blank" rel="noopener">${svg(kind, 18, 2.2)} ${esc(cta)} ${svg("ext", 16, 2.2)}</a>`;
      const sel = document.getElementById("rootSel"), btn = document.getElementById("openBtn");
      sel.onchange = () => { btn.href = link(list.find(f => f.id === sel.value)); };
      box._sel = () => list.find(f => f.id === sel.value);
    } catch (e) { if (e.message !== "signed_out") box.innerHTML = errHTML(e.message); }
    finally {
      reveal(box);
      // Audit log only; the link itself opens SharePoint directly.
      const a = box.querySelector("a.cta");
      if (a) a.addEventListener("click", () => {
        const f = box._sel ? box._sel() : null;
        getFolders(service).then(l => {
          const target = f || l.filter(x => x[has])[0];
          if (target) fetch("/api/opened", { method: "POST", keepalive: true, credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-Portal": "1" }, body: JSON.stringify({ root_id: target.id, kind }) });
        });
      });
    }
  }

  /* ---------------- documents to sign: glowing bulb (top right) ---------------- */
  const BULB = '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>';
  const fmtDate = d => { const t = new Date(d + "T00:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
  let lastKey = null, cur = null;
  // Bound once (not on every refresh), so polling doesn't pile up listeners.
  document.addEventListener("click", e => { if (cur && !cur.panel.hidden && !cur.panel.contains(e.target) && !cur.btn.contains(e.target)) cur.toggle(false); });
  document.addEventListener("keydown", e => { if (cur && e.key === "Escape" && !cur.panel.hidden) { cur.toggle(false); cur.btn.focus(); } });
  window.addEventListener("resize", () => { if (cur && !cur.panel.hidden) cur.place(); });
  async function checkAgreements() {
    let r;
    try { r = await api("/api/agreements"); } catch (e) { return; }
    const host = document.getElementById("signAlert");
    if (!host) return;
    const key = JSON.stringify(r.items || []);
    if (key === lastKey) return;            // nothing changed: leave the bulb (and an open panel) alone
    lastKey = key;
    const old = document.getElementById("bulbPanel");
    if (!r.items || !r.items.length) { host.innerHTML = ""; host.hidden = true; if (old) old.remove(); cur = null; return; }
    const n = r.items.length;
    host.hidden = false;
    host.innerHTML = `<button class="bulb" id="bulbBtn" aria-expanded="false" aria-controls="bulbPanel">
        <span class="glow" aria-hidden="true"><i></i><i></i></span>
        <span class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BULB}</svg></span>
        <span class="tx"><b>Signature Needed</b><small>${n === 1 ? "1 document to sign" : n + " documents to sign"}</small></span>
        <span class="count" aria-hidden="true">${n}</span>
      </button>`;
    let panel = document.getElementById("bulbPanel");
    if (panel) panel.remove();
    panel = document.createElement("div");
    panel.id = "bulbPanel"; panel.className = "bulb-panel"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Documents to sign");
    panel.innerHTML = `<h3>${n === 1 ? "You Have a Document to Sign" : "You Have " + n + " Documents to Sign"}</h3>
      <p>Please review and sign so we can get started. It only takes a few minutes.</p>
      ${r.items.map((i, idx) => `<div class="brow">
        <span class="bt"><b>${esc(i.title || (n === 1 ? "Document" : "Document " + (idx + 1)))}</b>${i.sent ? `<small>Sent ${esc(fmtDate(i.sent))}</small>` : ""}</span>
        <span class="ba">
          ${i.hasLink ? `<a class="cta sm" href="sign.html?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener">Sign now ${svg("ext", 15, 2.2)}</a>` : ""}
          ${!i.hasLink ? `<span class="muted">Please use the signing link in your email.</span>` : ""}
        </span></div>`).join("")}
      ${r.items.some(i => i.emailed) ? `<p class="bnote">We've also emailed it to <b>${esc(r.items[0].email)}</b>.</p>` : ""}
      <div class="bmsg" aria-live="polite"></div>`;
    document.body.appendChild(panel);
    const btn = document.getElementById("bulbBtn");
    const place = () => {
      const b = btn.getBoundingClientRect();
      const w = Math.min(400, window.innerWidth - 32);
      panel.style.width = w + "px";
      panel.style.top = (window.scrollY + b.bottom + 10) + "px";
      panel.style.left = Math.max(16, Math.min(window.scrollX + b.right - w, window.innerWidth - w - 16)) + "px";
    };
    const toggle = open => {
      open = open === undefined ? panel.hidden : open;
      panel.hidden = !open; btn.setAttribute("aria-expanded", String(open)); host.classList.toggle("open", open);
      if (open) { place(); reveal(panel); }
    };
    btn.onclick = e => { e.stopPropagation(); toggle(); };
    cur = { panel, btn, toggle, place };
  }

  /* ---------------- request access for a team member ---------------- */
  (function () {
    const btn = document.getElementById("reqAccessBtn");
    if (!btn || !MY.length) return;
    btn.hidden = false;
    const CLIENTS = CFG.myClients || [];
    let modal = null, lastFocus = null;
    const close = () => { if (!modal) return; modal.remove(); modal = null; document.body.classList.remove("modal-open"); if (lastFocus) lastFocus.focus(); };
    btn.onclick = () => {
      lastFocus = document.activeElement;
      modal = document.createElement("div");
      modal.className = "modal-back";
      modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="raTitle">
        <button type="button" class="modal-x" aria-label="Close">${svg("x", 20, 2)}</button>
        <h2 id="raTitle">Request Member Access</h2>
        <p class="muted">Choose what they should see. Our team reviews every request before access is given.</p>
        <form id="raForm" novalidate>
          <label>Full name<input id="raName" required maxlength="120" autocomplete="off"></label>
          <label>Email address<input id="raEmail" type="email" required maxlength="200" autocomplete="off" placeholder="The email they will sign in with"></label>
          ${CLIENTS.length ? `<fieldset class="ra-pick"><legend>Access to give</legend>
            ${CLIENTS.map((c, i) => `<div class="ra-client">
              ${CLIENTS.length > 1 ? `<div class="ra-cname">${svg("folder", 16, 2)}${esc(c.name)}</div>` : ""}
              <div class="ra-svcs">${c.services.map(s => `<label class="ra-chip"><input type="checkbox" checked data-c="${i}" value="${esc(s)}"><span>${svg("check", 14, 2.6)}${esc(s)}</span></label>`).join("")}</div>
            </div>`).join("")}</fieldset>` : ""}
          <div class="ramsg" aria-live="polite"></div>
          <div class="actions"><button class="cta" type="submit">Request Access</button><button class="btn2" type="button" data-close>Cancel</button></div>
        </form></div>`;
      document.body.appendChild(modal);
      document.body.classList.add("modal-open");
      const f = modal.querySelector("#raForm"), msg = modal.querySelector(".ramsg");
      modal.querySelector(".modal-x").onclick = close;
      modal.querySelector("[data-close]").onclick = close;
      modal.addEventListener("click", e => { if (e.target === modal) close(); });
      modal.addEventListener("keydown", e => {
        if (e.key === "Escape") close();
        if (e.key === "Tab") {   // keep focus inside the dialog
          const els = Array.from(modal.querySelectorAll("button, input")).filter(x => !x.disabled);
          const first = els[0], last = els[els.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      modal.querySelector("#raName").focus();
      f.onsubmit = async e => {
        e.preventDefault();
        const name = modal.querySelector("#raName").value.trim(), email = modal.querySelector("#raEmail").value.trim();
        if (!name) { msg.innerHTML = errHTML("Enter their full name."); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.innerHTML = errHTML("Enter a valid email address."); return; }
        let picks;
        if (CLIENTS.length) {
          picks = {};
          modal.querySelectorAll(".ra-chip input:checked").forEach(x => { const c = CLIENTS[+x.dataset.c].folder; (picks[c] = picks[c] || []).push(x.value); });
          if (!Object.keys(picks).length) { msg.innerHTML = errHTML("Tick at least one service for them."); return; }
        }
        const sb = f.querySelector('button[type="submit"]'); sb.disabled = true; msg.innerHTML = `<p class="muted">Sending…</p>`;
        try {
          await api("/api/access-requests", { method: "POST", body: JSON.stringify({ name, email, picks }) });
          modal.querySelector(".modal").innerHTML = `<button type="button" class="modal-x" aria-label="Close">${svg("x", 20, 2)}</button>
            <div class="ra-done">${svg("check", 34, 2.2)}<h2>Request Sent</h2>
            <p>We'll review it shortly. Once approved, <b>${esc(name)}</b> will get an email with how to sign in.</p>
            <div class="actions"><button class="cta" type="button" data-close>Done</button></div></div>`;
          modal.querySelector(".modal-x").onclick = close; modal.querySelector("[data-close]").onclick = close;
          modal.querySelector("[data-close]").focus();
        } catch (err) { sb.disabled = false; if (err.message !== "signed_out") msg.innerHTML = errHTML(err.message); }
      };
    };
  })();

  /* ---------------- ask us to remove a team member ---------------- */
  (function () {
    const btn = document.getElementById("reqRemoveBtn"), TEAM = CFG.myTeam || [];
    if (!btn || !TEAM.length) return;
    btn.hidden = false;
    let modal = null, lastFocus = null;
    const close = () => { if (!modal) return; modal.remove(); modal = null; document.body.classList.remove("modal-open"); if (lastFocus) lastFocus.focus(); };
    btn.onclick = () => {
      lastFocus = document.activeElement;
      modal = document.createElement("div");
      modal.className = "modal-back";
      modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rmTitle">
        <button type="button" class="modal-x" aria-label="Close">${svg("x", 20, 2)}</button>
        <h2 id="rmTitle">Remove Member Access</h2>
        <p class="muted">Choose who should no longer use the portal. Our team will review your request and remove them.</p>
        <form id="rmForm" novalidate>
          <fieldset class="rm-list"><legend>Who should we remove?</legend>
            ${TEAM.map((p, i) => `<label class="rm-person"><input type="radio" name="rmWho" value="${esc(p.email)}" ${TEAM.length === 1 ? "checked" : ""}>
              <span class="rm-av" aria-hidden="true">${esc((p.name || p.email)[0].toUpperCase())}</span>
              <span class="rm-txt"><b>${esc(p.name || p.email)}</b><small>${esc(p.email)}</small></span>
              <span class="rm-dot" aria-hidden="true"></span></label>`).join("")}
          </fieldset>
          <label><span>Reason <span class="muted">(optional)</span></span><input id="rmWhy" maxlength="300" autocomplete="off" placeholder="For example, they left the company"></label>
          <div class="ramsg" aria-live="polite"></div>
          <div class="actions"><button class="cta danger" type="submit">Send Removal Request</button><button class="btn2" type="button" data-close>Cancel</button></div>
        </form></div>`;
      document.body.appendChild(modal);
      document.body.classList.add("modal-open");
      const f = modal.querySelector("#rmForm"), msg = modal.querySelector(".ramsg");
      modal.querySelector(".modal-x").onclick = close;
      modal.querySelector("[data-close]").onclick = close;
      modal.addEventListener("click", e => { if (e.target === modal) close(); });
      modal.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
      const first = modal.querySelector('input[name="rmWho"]'); if (first) first.focus();
      f.onsubmit = async e => {
        e.preventDefault();
        const who = modal.querySelector('input[name="rmWho"]:checked');
        if (!who) { msg.innerHTML = errHTML("Choose the person to remove."); return; }
        const p = TEAM.find(x => x.email === who.value);
        const sb = f.querySelector('button[type="submit"]'); sb.disabled = true; msg.innerHTML = `<p class="muted">Sending…</p>`;
        try {
          await api("/api/removal-requests", { method: "POST", body: JSON.stringify({ email: p.email, reason: modal.querySelector("#rmWhy").value }) });
          modal.querySelector(".modal").innerHTML = `<button type="button" class="modal-x" aria-label="Close">${svg("x", 20, 2)}</button>
            <div class="ra-done">${svg("check", 34, 2.2)}<h2>Request Sent</h2>
            <p>We'll review it shortly. Once approved, <b>${esc(p.name || p.email)}</b> won't be able to sign in to your portal any more.</p>
            <div class="actions"><button class="cta" type="button" data-close>Done</button></div></div>`;
          modal.querySelector(".modal-x").onclick = close; modal.querySelector("[data-close]").onclick = close;
          modal.querySelector("[data-close]").focus();
        } catch (err) { sb.disabled = false; if (err.message !== "signed_out") msg.innerHTML = errHTML(err.message); }
      };
    };
  })();

  window.addEventListener("hashchange", render);
  render();
  // Warm up in the background so Upload / Download / saved logins open instantly.
  getFolders().catch(() => {});
  if (CFG.vaultEnabled) loadVault().catch(() => {});
  checkAgreements();
  // Check for new documents to sign every 10 seconds; only the bulb updates, the page never reloads.
  setInterval(() => { if (!document.hidden) checkAgreements(); }, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkAgreements(); });
})();
