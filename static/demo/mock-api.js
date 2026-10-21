/* Client Portal - FRONT-END DEMO.
   The real portal talks to a Python server, SharePoint and DocHub. Here every "/api/..." call is answered in the
   browser from demo data kept in localStorage, so the exact same pages (portal.js / admin.js) work with no server.
   Client and admin share the same data: a request sent on the client side shows up on the admin side. */
(function () {
  "use strict";
  const KEY = "tw-portal-demo-v1";
  const ME = { email: "sameer@greenleafbakery.com", name: "Sameer Khan" };          // the signed-in client
  const ADMIN = { email: "admin@northwind-demo.com", name: "Portal Admin" };
  const SVC = [
    { id: "tax", title: "Tax", folder: "Tax", upload: true },
    { id: "cas", title: "CAS", folder: "CAS", upload: false },
    { id: "audit", title: "Audit", folder: "Audit", upload: true },
    { id: "iwm", title: "Insurance & Wealth Management", folder: "Insurance & Wealth Management", upload: true },
    { id: "sut", title: "Sales & Use Tax", folder: "Sales & Use Tax", upload: true }
  ];
  const svc = id => SVC.find(s => s.id === id);
  const svcByTitle = t => SVC.find(s => s.title.toLowerCase() === String(t).toLowerCase());
  const pad = n => String(n).padStart(2, "0");
  const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const daysAgo = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 15); return d; };
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------------- demo data ---------------- */
  function seed() {
    return {
      karbon: {
        A: ["Atlas Builders", "Avery & Sons"],
        B: ["Bluewater Marine", "Brightline Media"],
        G: ["Greenleaf Bakery", "Golden Gate Florist"],
        K: ["Keller Bakery", "Kim Holdings"],
        M: ["Maple Street Dental", "Marco Logistics"],
        S: ["Summit Dental", "Sunrise Farms"],
        T: ["Thompson & Co", "Twin Rivers Cafe"]
      },
      extra: {},
      clients: [
        { path: "G/Greenleaf Bakery", name: "Greenleaf Bakery", company: "Greenleaf Bakery LLC", layout: "standard", services: ["tax", "cas", "audit"], off: [], uploads: {} },
        { path: "K/Kim Holdings", name: "Kim Holdings", company: "Kim Holdings Inc.", layout: "existing", services: ["tax", "sut"], off: [],
          uploads: { tax: { id: "f-kim-bk1", path: "Bookkeeping/01. Client Upload Folder" }, sut: { id: "new-kim-sut", path: "Sales & Use Tax/Upload" } } },
        { path: "S/Summit Dental", name: "Summit Dental", company: "Summit Dental PC", layout: "standard", services: ["tax", "iwm"], off: ["iwm"], uploads: {} },
        { path: "M/Marco Logistics", name: "Marco Logistics", company: "Marco Logistics Ltd", layout: "standard", services: ["cas", "audit"], off: [], uploads: {} }
      ],
      people: [
        { email: ME.email, name: ME.name, client: "G/Greenleaf Bakery", only: [] },
        { email: "ayesha@greenleafbakery.com", name: "Ayesha Malik", client: "G/Greenleaf Bakery", only: ["tax"] },
        { email: "daniel@kimholdings.com", name: "Daniel Kim", client: "K/Kim Holdings", only: [] },
        { email: "laura@summitdental.com", name: "Laura Chen", client: "S/Summit Dental", only: [] },
        { email: "marco@marcologistics.com", name: "Marco Rossi", client: "M/Marco Logistics", only: [] }
      ],
      requests: [
        { id: uid(), kind: "add", name: "Grace Kim", email: "grace@kimholdings.com", requester: "daniel@kimholdings.com", requesterName: "Daniel Kim",
          company: "Kim Holdings Inc.", status: "Pending", created: stamp(daysAgo(0, 9)), picks: [{ folder: "K/Kim Holdings", name: "Kim Holdings", services: ["Tax"] }] },
        { id: uid(), kind: "remove", name: "Marco Rossi", email: "marco@marcologistics.com", requester: "marco@marcologistics.com", requesterName: "Marco Rossi",
          company: "Marco Logistics Ltd", status: "Approved", decidedBy: ADMIN.email, decidedAt: stamp(daysAgo(3)), created: stamp(daysAgo(4)),
          clients: [{ folder: "M/Marco Logistics", name: "Marco Logistics" }], reason: "Duplicate account", undo: true }
      ],
      letters: [
        { id: "0~ltr1", title: "2026 Tax Engagement Letter.pdf", account: "Northwind Advisory Group", sent: stamp(daysAgo(2)).slice(0, 10), state: "open",
          signers: [{ id: "s1", email: ME.email, name: ME.name, status: "PENDING" }, { id: "s2", email: "partner@outsidecpa.com", name: "", status: "PENDING" }] },
        { id: "1~ltr2", title: "Audit Engagement Letter.pdf", account: "Northwind Tax", sent: stamp(daysAgo(5)).slice(0, 10), state: "open",
          signers: [{ id: "s3", email: "daniel@kimholdings.com", name: "Daniel Kim", status: "PENDING" }] },
        { id: "2~ltr3", title: "Bookkeeping Agreement.pdf", account: "Northwind Accounting", sent: stamp(daysAgo(12)).slice(0, 10), state: "closed", closed: "Signed",
          signers: [{ id: "s4", email: "laura@summitdental.com", name: "Laura Chen", status: "FINALIZED" }] },
        { id: "0~ltr4", title: "Offer Letter - Internal.pdf", account: "Northwind Advisory Group", sent: stamp(daysAgo(1)).slice(0, 10), state: "open",
          signers: [{ id: "s5", email: "newhire@gmail.com", name: "", status: "PENDING" }] }
      ],
      vault: {},
      activity: [
        { when: stamp(daysAgo(0, 9)), action: "access_requested", who: "daniel@kimholdings.com", detail: "Grace Kim <grace@kimholdings.com> | Kim Holdings: Tax" },
        { when: stamp(daysAgo(1)), action: "admin_existing_client", who: ADMIN.email, detail: "daniel@kimholdings.com | K/Kim Holdings" },
        { when: stamp(daysAgo(3)), action: "removal_request_approved", who: ADMIN.email, detail: "Marco Rossi <marco@marcologistics.com>" },
        { when: stamp(daysAgo(6)), action: "admin_add_client", who: ADMIN.email, detail: "sameer@greenleafbakery.com | G/Greenleaf Bakery" }
      ]
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.clients) S = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  save();
  const log = (action, who, detail) => { S.activity.unshift({ when: stamp(), action, who, detail }); S.activity = S.activity.slice(0, 150); };

  /* ---------------- helpers ---------------- */
  const client = path => S.clients.find(c => c.path.toLowerCase() === String(path).toLowerCase());
  const active = c => c.services.filter(s => !c.off.includes(s));
  const peopleOf = path => S.people.filter(p => p.client.toLowerCase() === path.toLowerCase());
  const servicesFor = p => { const c = client(p.client); return c ? active(c).filter(s => !p.only.length || p.only.includes(s)) : []; };
  const folderLink = p => "folder.html?p=" + encodeURIComponent(p);
  const portalEmails = () => new Set(S.people.map(p => p.email));

  // The client's folders in "the document library": the same simple layout for every client, plus anything created in the demo.
  function tree(path) {
    const base = ["Tax", "Tax/2024", "Tax/2025", "Bookkeeping", "Bookkeeping/01. Client Upload Folder", "Bookkeeping/02. Bank Statements",
      "Bookkeeping/03. Payroll", "Audit", "Audit/Working Papers", "Correspondence"];
    const files = { "Bookkeeping/02. Bank Statements": 3, "Audit/Working Papers": 5, "Correspondence": 2, "Tax/2024": 4 };
    const c = client(path);
    const extra = (S.extra[path] || []).concat(c ? Object.values(c.uploads).map(u => u.path) : []);
    const all = [...new Set(base.concat(extra).flatMap(p => p.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"))))].sort((a, b) => a.localeCompare(b));
    const slug = path.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return all.map(p => {
      const kids = all.filter(x => x.startsWith(p + "/") && !x.slice(p.length + 1).includes("/")).length;
      const f = files[p] || 0;
      return { id: (p === "Bookkeeping/01. Client Upload Folder" && slug === "kkimholdings") ? "f-kim-bk1" : "f-" + slug + "-" + p.replace(/[^a-z0-9]/gi, "").toLowerCase(),
               path: p, depth: p.split("/").length, count: kids + f, files: f, size: f ? f * 120000 : 0 };
    });
  }
  function pickFolder(path, value) {     // "new:Tax/Upload" or a folder id -> {id, path}
    if (String(value).startsWith("new:")) {
      const p = value.slice(4).split("/").map(x => x.trim()).filter(Boolean).join("/");
      (S.extra[path] = S.extra[path] || []).push(p);
      return { id: "new-" + uid(), path: p };
    }
    const f = tree(path).find(x => x.id === value);
    if (!f) throw new Error("That folder isn't inside this client's folder.");
    return { id: f.id, path: f.path };
  }
  function addPerson(email, name, path, only) {
    email = email.toLowerCase();
    if (S.people.some(p => p.email === email && p.client === path)) return false;
    S.people.push({ email, name, client: path, only: only || [] });
    return true;
  }

  /* ---------------- client side ---------------- */
  function clientConfig(cfg) {
    const mine = S.people.filter(p => p.email === ME.email);
    cfg.myServices = [...new Set(mine.flatMap(servicesFor))];
    cfg.myClients = mine.map(p => ({ folder: p.client, name: client(p.client).name, services: servicesFor(p).map(s => svc(s).title) }));
    const myPaths = mine.map(p => p.client);
    const team = {};
    S.people.filter(p => p.email !== ME.email && myPaths.includes(p.client)).forEach(p => {
      const t = team[p.email] = team[p.email] || { email: p.email, name: p.name, clients: [] };
      t.clients.push({ folder: p.client, name: client(p.client).name });
    });
    cfg.myTeam = Object.values(team);
    cfg.user = { name: ME.name, email: ME.email };
    return cfg;
  }

  /* ---------------- the "server" ---------------- */
  const routes = [
    // ----- client
    ["GET", /^\/api\/folders/, (q) => {
      const out = [];
      S.people.filter(p => p.email === ME.email).forEach(p => {
        const c = client(p.client); if (!c) return;
        servicesFor(p).forEach(s => {
          const x = svc(s), u = c.uploads[s];
          out.push({ id: s + "~" + c.name, name: c.name, service: s, hasUpload: x.upload, hasDownload: true,
            uploadUrl: folderLink(`${c.path}/${u ? u.path : x.folder + "/Upload"}`), downloadUrl: folderLink(c.path) });
        });
      });
      return { folders: q.service ? out.filter(f => f.service === q.service) : out };
    }],
    ["GET", /^\/api\/agreements$/, () => ({ items: S.letters.filter(l => l.state === "open").flatMap(l =>
      l.signers.filter(s => s.email === ME.email && s.status === "PENDING").map(() => ({ id: l.id, title: l.title, sent: l.sent, hasLink: true, email: ME.email }))) })],
    ["GET", /^\/api\/vault$/, () => ({ apps: [["safesend", "Secure tax portal"], ["double", "Accounting portal"]].map(([key, name]) => {
      const v = (S.vault[ME.email] || {})[key]; return { key, name, saved: !!v, username: v ? v.username : "" }; }) })],
    ["PUT", /^\/api\/vault\/(\w+)$/, (q, b, m) => {
      if (!b.username || !b.password) throw [400, "Enter your username and password."];
      (S.vault[ME.email] = S.vault[ME.email] || {})[m[1]] = { username: b.username, password: b.password };
      return { ok: true, username: b.username };
    }],
    ["POST", /^\/api\/vault\/(\w+)\/reveal$/, (q, b, m) => ({ password: ((S.vault[ME.email] || {})[m[1]] || {}).password || "" })],
    ["DELETE", /^\/api\/vault\/(\w+)$/, (q, b, m) => { delete (S.vault[ME.email] || {})[m[1]]; return { ok: true }; }],
    ["POST", /^\/api\/interest$/, (q, b) => { log("service_interest", ME.email, (svc(b.service) || {}).title + (b.message ? " | " + b.message : "")); return { ok: true, emailed: true }; }],
    ["POST", /^\/api\/opened$/, () => ({ ok: true })],
    ["POST", /^\/api\/access-requests$/, (q, b) => {
      const email = String(b.email || "").trim().toLowerCase(), name = String(b.name || "").trim();
      if (!name) throw [400, "Enter the person's name."];
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw [400, "Enter a valid email address."];
      if (email === ME.email) throw [400, "That's your own email address."];
      if (S.requests.some(r => r.status === "Pending" && r.email === email)) throw [400, "You've already asked for this person. We'll review it shortly."];
      const mine = clientConfig({}).myClients;
      const picks = mine.map(c => ({ ...c, services: c.services.filter(t => (b.picks && b.picks[c.folder] || []).includes(t)) })).filter(c => c.services.length);
      if (!picks.length) throw [400, "Tick at least one service for this person."];
      S.requests.push({ id: uid(), kind: "add", name, email, requester: ME.email, requesterName: ME.name, company: client(mine[0].folder).company,
                        status: "Pending", created: stamp(), picks });
      log("access_requested", ME.email, `${name} <${email}>`);
      return { ok: true };
    }],
    ["POST", /^\/api\/removal-requests$/, (q, b) => {
      const p = clientConfig({}).myTeam.find(t => t.email === b.email);
      if (!p) throw [400, "Choose someone from your team."];
      if (S.requests.some(r => r.status === "Pending" && r.kind === "remove" && r.email === p.email)) throw [400, "We already have a request to remove this person. We'll review it shortly."];
      S.requests.push({ id: uid(), kind: "remove", name: p.name || p.email, email: p.email, requester: ME.email, requesterName: ME.name,
                        company: client(p.clients[0].folder).company, status: "Pending", created: stamp(), clients: p.clients, reason: String(b.reason || "") });
      log("removal_requested", ME.email, `${p.name} <${p.email}>`);
      return { ok: true };
    }],

    // ----- admin
    ["GET", /^\/api\/admin\/client-services$/, () => ({ clients: S.clients.map(c => {
      const ppl = peopleOf(c.path);
      return { path: c.path, name: c.name, company: c.company, layout: c.layout, people: ppl.map(p => p.email),
        names: Object.fromEntries(ppl.map(p => [p.email, p.name])),
        only: Object.fromEntries(ppl.filter(p => p.only.length).map(p => [p.email, p.only.map(s => svc(s).title)])),
        services: c.services.map(s => { const u = c.uploads[s]; return { id: s, title: svc(s).title, path: `${c.path}/${svc(s).folder}`,
          upload: u ? u.path : "", uploadSet: !!u, uploadId: u ? u.id : "", active: !c.off.includes(s) }; }) };
    }).sort((a, b) => a.name.localeCompare(b.name)) })],
    ["POST", /^\/api\/admin\/client-services$/, (q, b) => {
      const c = client(b.client), x = svc(b.service); if (!c || !x) throw [404, "Client or service not found."];
      c.off = c.off.filter(s => s !== x.id).concat(b.on ? [] : [x.id]);
      log(b.on ? "admin_service_on" : "admin_service_off", ADMIN.email, `${c.path} ${x.title}`);
      const n = peopleOf(c.path).length;
      return { ok: true, message: `${x.title} ${b.on ? "added back" : "opted out"} for ${c.name} (${n} ${n === 1 ? "person" : "people"}).`, warning: "" };
    }],
    ["POST", /^\/api\/admin\/client-services\/add$/, (q, b) => {
      const c = client(b.client), x = svc(b.service); if (!c || !x) throw [404, "Client or service not found."];
      if (c.layout === "existing" && x.upload) { if (!b.upload) throw [400, "Choose where its uploads go."]; c.uploads[x.id] = pickFolder(c.path, b.upload); }
      if (!c.services.includes(x.id)) c.services.push(x.id);
      c.off = c.off.filter(s => s !== x.id);
      log("admin_service_added", ADMIN.email, `${c.path} ${x.title}`);
      const n = peopleOf(c.path).filter(p => !p.only.length).length;
      return { ok: true, warning: "", message: `${x.title} added for ${c.name} (${n} ${n === 1 ? "person" : "people"}).` };
    }],
    ["POST", /^\/api\/admin\/client-services\/upload$/, (q, b) => {
      const c = client(b.client), x = svc(b.service); if (!c || !x) throw [404, "Client or service not found."];
      c.uploads[x.id] = pickFolder(c.path, b.upload);
      log("admin_upload_folder", ADMIN.email, `${c.path} ${x.title} -> ${c.uploads[x.id].path}`);
      return { ok: true, warning: "", message: `${x.title} uploads now go to ${c.uploads[x.id].path}.` };
    }],
    ["POST", /^\/api\/admin\/client-person$/, (q, b) => {
      const c = client(b.client); if (!c) throw [404, "Client not found."];
      const email = String(b.email || "").trim().toLowerCase();
      if (!b.name || String(b.name).includes("@")) throw [400, "Enter the person's name."];
      if (!addPerson(email, String(b.name).trim(), c.path)) throw [400, `${email} already has access to ${c.name}.`];
      log("admin_add_person", ADMIN.email, `${email} | ${c.path}`);
      return { ok: true, warning: "", message: `${b.name} added to ${c.name}.` };
    }],
    ["POST", /^\/api\/admin\/member-name$/, (q, b) => {
      const p = S.people.find(x => x.email === b.email && x.client === b.client); if (!p) throw [404, "Person not found."];
      p.name = String(b.name).trim(); return { ok: true };
    }],
    ["GET", /^\/api\/admin\/person$/, (q) => {
      const email = String(q.email || "").toLowerCase();
      return { email, clients: S.people.filter(p => p.email === email).map(p => ({ client: p.client, name: client(p.client).name, company: client(p.client).company, person: p.name })) };
    }],
    ["POST", /^\/api\/admin\/remove-person$/, (q, b) => {
      const email = String(b.email || "").toLowerCase();
      const hits = S.people.filter(p => p.email === email && (!b.client || p.client === b.client));
      if (!hits.length && b.client) throw [404, `${email} doesn't have access to that client.`];
      S.people = S.people.filter(p => !hits.includes(p));
      log("admin_remove_person", ADMIN.email, `${email} | ${hits.map(h => h.client).join(", ") || "(SharePoint only)"}`);
      const n = hits.length, portal = n ? `Removed from ${n} client${n === 1 ? "" : "s"} on the portal and signed out.` : "They weren't on the portal.";
      return { ok: true, message: `${email}: ${portal}`, portal, warning: "",
               sharepoint: { ok: true, message: b.client ? "Removed from this client's folders in SharePoint." : "Removed from the document site (all folders and sharing links)." } };
    }],
    ["GET", /^\/api\/admin\/requests$/, () => {
      const rows = S.requests.map(r => ({ picks: [], clients: [], reason: "", decidedBy: "", decidedAt: "", ...r }));
      return { pending: rows.filter(r => r.status === "Pending").sort((a, b) => b.created.localeCompare(a.created)),
               decided: rows.filter(r => r.status !== "Pending").sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)).slice(0, 25) };
    }],
    ["POST", /^\/api\/admin\/requests\/(\w+)\/(approve|reject)$/, (q, b, m) => {
      const r = S.requests.find(x => x.id === m[1]); if (!r) throw [404, "Request not found."];
      if (r.status !== "Pending") throw [400, `This request was already ${r.status.toLowerCase()}.`];
      r.decidedBy = ADMIN.email; r.decidedAt = stamp();
      if (m[2] === "reject") { r.status = "Rejected"; log("access_request_rejected", ADMIN.email, `${r.name} <${r.email}>`); return { ok: true, message: "Request rejected." }; }
      r.status = "Approved";
      if (r.kind === "remove") {
        const before = S.people.length;
        S.people = S.people.filter(p => !(p.email === r.email && r.clients.some(c => c.folder === p.client)));
        const still = S.people.some(p => p.email === r.email), where = r.clients.map(c => c.name).join(", ");
        log("removal_request_approved", ADMIN.email, `${r.name} <${r.email}> | ${where}`);
        return { ok: true, warning: "", message: before !== S.people.length
          ? `Approved. ${r.name} was removed from ${where}${still ? "" : " and can no longer sign in to the portal"}.` : `${r.name} was already off ${where}.` };
      }
      r.picks.forEach(p => {
        const c = client(p.folder); if (!c) return;
        const ids = p.services.map(t => (svcByTitle(t) || {}).id).filter(Boolean);
        addPerson(r.email, r.name, c.path, active(c).every(s => ids.includes(s)) ? [] : ids);
      });
      const what = r.picks.map(p => `${p.name}: ${p.services.join(", ")}`).join("; ");
      log("access_request_approved", ADMIN.email, `${r.name} <${r.email}> | ${what}`);
      return { ok: true, warning: "", message: `Approved. ${r.name} now has ${what}.` };
    }],
    ["GET", /^\/api\/admin\/agreements$/, () => {
      const inPortal = portalEmails(), letters = [];
      let hidden = 0;
      S.letters.forEach(l => l.signers.forEach(s => {
        if (!inPortal.has(s.email)) { hidden++; return; }
        const st = l.state === "open" ? (s.status === "FINALIZED" ? "Signed" : "Waiting") : l.closed;
        letters.push({ id: l.id, signerId: s.id, title: l.title, email: s.email, account: l.account, name: s.name, sent: l.sent, status: st, open: l.state === "open", inPortal: true });
      }));
      const order = { Waiting: 0, Declined: 1, Signed: 2 };
      letters.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.sent.localeCompare(b.sent));
      const accounts = ["Northwind Advisory Group", "Northwind Tax", "Northwind Accounting"];
      return { enabled: true, letters, hidden, error: "", synced: stamp().slice(11), accounts,
        accountStatus: accounts.map(a => ({ label: a, ok: true, error: "", open: S.letters.filter(l => l.account === a && l.state === "open").length })) };
    }],
    ["POST", /^\/api\/admin\/agreements\/([^/]+)\/(resend|cancel)$/, (q, b, m) => {
      const l = S.letters.find(x => x.id === decodeURIComponent(m[1])); if (!l) throw [404, "Letter not found."];
      if (m[2] === "cancel") { l.state = "closed"; l.closed = "Cancelled"; }
      log("admin_letter_" + m[2], ADMIN.email, l.title);
      return { ok: true };
    }],
    ["GET", /^\/api\/admin\/activity$/, () => ({ activity: S.activity })],
    ["GET", /^\/api\/admin\/storage$/, () => ({ legacy: 0, pending: 0, clients: S.clients.length, members: S.people.length, job: { state: "idle", done: 0, total: 0, message: "" } })],
    ["POST", /^\/api\/admin\/storage\/migrate$/, () => ({ ok: true, job: { state: "done", done: 0, total: 0, message: "Nothing to move." } })],
    ["GET", /^\/api\/admin\/folders$/, (q) => ({ folders: q.parent ? (S.karbon[q.parent] || []).slice().sort() : Object.keys(S.karbon).sort() })],
    ["GET", /^\/api\/admin\/folder-tree$/, (q) => ({ path: q.path, id: "root", files: 0, folders: tree(q.path) })],
    ["POST", /^\/api\/admin\/clients$/, (q, b) => {
      const top = b.top, name = String(b.client || "").trim(), path = `${top}/${name}`;
      if ((S.karbon[top] || []).some(n => n.toLowerCase() === name.toLowerCase()))
        return { steps: [{ step: "Portal access", ok: false, message: "That client folder already exists. Use the Existing Client tab." }] };
      (S.karbon[top] = S.karbon[top] || []).push(name);
      const ids = (b.services || []).filter(svc);
      S.clients.push({ path, name, company: b.company || "", layout: "standard", services: ids, off: [], uploads: {} });
      addPerson(b.email, b.name, path);
      log("admin_add_client", ADMIN.email, `${b.email} | ${path}`);
      return { steps: [{ step: "Folders", ok: true, message: "created" }, { step: "Portal access", ok: true, message: "person added" },
                       { step: "SharePoint access", ok: true, message: "shared" }] };
    }],
    ["POST", /^\/api\/admin\/existing-client$/, (q, b) => {
      const path = `${b.top}/${b.client}`, ids = (b.services || []).filter(svc);
      if (!b.name) throw [400, "Enter the client's name."];
      if (!ids.length) throw [400, "Choose at least one service."];
      let c = client(path);
      if (!c) { c = { path, name: b.client, company: b.company || "", layout: "existing", services: [], off: [], uploads: {} }; S.clients.push(c); }
      ids.forEach(s => { if (!c.services.includes(s)) c.services.push(s); if (svc(s).upload && b.uploads && b.uploads[s]) c.uploads[s] = pickFolder(path, b.uploads[s]); });
      c.layout = "existing";
      const added = addPerson(b.email, b.name, path);
      log("admin_existing_client", ADMIN.email, `${b.email} | ${path}`);
      return { steps: [{ step: "Portal access", ok: true, message: added ? "person added" : "already had access" }, { step: "SharePoint access", ok: true, message: "shared" }] };
    }]
  ];

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, opts = {}) {
    const raw = typeof input === "string" ? input : input.url;
    const u = new URL(raw, "http://demo.local");
    if (!u.pathname.startsWith("/api/")) return realFetch(input, opts);
    const method = (opts.method || "GET").toUpperCase();
    const q = Object.fromEntries(u.searchParams.entries());
    let body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}
    await new Promise(r => setTimeout(r, 120 + Math.random() * 200));    // feels like a real server
    S = JSON.parse(localStorage.getItem(KEY) || "null") || S;              // pick up changes made in the other tab
    for (const [m, re, fn] of routes) {
      const match = u.pathname.match(re);
      if (m === method && match) {
        try {
          const out = fn(q, body, match); save();
          return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e) {
          const [status, msg] = Array.isArray(e) ? e : [400, e.message];
          return new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } });
        }
      }
    }
    return new Response(JSON.stringify({ error: "Not available in the demo." }), { status: 404 });
  };

  // Fill the page-specific bits before portal.js / admin.js start.
  window.TWDemo = {
    ME, ADMIN, reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); },
    state: () => S, save, client, tree,
    prepareClient() {
      const el = document.getElementById("portal-config");
      if (el) el.textContent = JSON.stringify(clientConfig(JSON.parse(el.textContent)));
      const mine = S.people.find(p => p.email === ME.email), c = mine && client(mine.client);
      document.querySelectorAll("[data-demo=name]").forEach(e => e.textContent = ME.name);
      document.querySelectorAll("[data-demo=company]").forEach(e => e.textContent = c ? c.company : "Client Portal");
    }
  };
  document.addEventListener("click", e => { if (e.target.closest("#demoReset")) { if (confirm("Reset all demo data to the starting point?")) TWDemo.reset(); } });
})();
