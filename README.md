# Client Portal – front-end demo

A front-end-only demo (HTML, CSS, JavaScript) of a client portal with an admin side.
All data is dummy data, stored in the visitor's browser (localStorage). No server or database.

- `index.html` – client portal · `admin.html` – admin portal · `signin.html` – sign-in page
- Switch between Client and Admin with the bar at the top. "Reset demo data" starts over.
- `static/demo/mock-api.js` acts as the server: it answers every `/api/...` call in the browser.
- Liquid glass effect: [liquid-glass-js](https://github.com/eamonliu/liquid-glass-js) (MIT).

Run locally: open `index.html`, or run `python -m http.server 8080` and visit http://localhost:8080
