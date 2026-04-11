# 🔧 Service Scene – Claude Handoff Notes

This file is written for a Claude instance picking up this project fresh. Read all of it before touching anything.

---

## What This Project Is

A modern website for **Service Scene** — an electronics repair shop in the **Eastern Suburbs of Melbourne, Australia**.
- Fixes **brown goods** (TVs, audio, remotes) and **white goods** (appliances)
- Website URL: https://servicescene.com.au/ (old site, this is the replacement)
- ACN: 087 486 995
- The old site was ~15 years out of date; this is a full revamp

---

## What Has Already Been Built

### Public Website (`index.html` + `style.css` + `script.js`)
- Modern dark navy + orange brand theme
- Hero section with tagline and CTA buttons
- Services section (TV repair, audio, white goods, etc.)
- "For Sale" section — shows second-hand items fetched live from the backend API
- Contact section
- Mobile responsive with hamburger nav

### Admin Panel (`admin.html`)
- Password-protected login (calls `/api/auth/login` → gets a token)
- Add new items for sale (photo upload with camera support, title, price, condition, category, description)
- Edit and delete existing listings
- Change password (invalidates all sessions on change)
- All data persisted server-side — visible to everyone instantly

### Backend (`server.js`)
- **Node.js + Express** — runs on port `3456` (or `PORT` env var)
- Serves static files from the project root
- REST API for items and auth
- **No external database needed** — uses flat JSON files in `db/`

### Database (flat JSON files in `db/`)
| File | Purpose |
|---|---|
| `db/items.json` | All for-sale listings (committed to repo) |
| `db/config.json` | Admin password + active session tokens (**NOT in git** — gitignored) |

---

## How to Run Locally

```bash
git clone https://github.com/jay-nginx/servicescene
cd servicescene
npm install
node server.js
```

Then open: http://localhost:3456

Admin panel: http://localhost:3456/admin.html

**Default admin password:** `servicescene2024`
(If `db/config.json` doesn't exist yet, the server creates it with the default password on first run.)

---

## API Endpoints

| Method | Route | Auth? | Purpose |
|---|---|---|---|
| `GET` | `/api/items` | No | Public item list (listed only) |
| `GET` | `/api/items/all` | ✅ Yes | All items including unlisted |
| `POST` | `/api/items` | ✅ Yes | Create new item |
| `PUT` | `/api/items/:id` | ✅ Yes | Update item |
| `DELETE` | `/api/items/:id` | ✅ Yes | Delete item |
| `POST` | `/api/auth/login` | No | Login → returns `{ token }` |
| `POST` | `/api/auth/logout` | ✅ Yes | Invalidate current token |
| `POST` | `/api/auth/change-password` | ✅ Yes | Change password + clear all tokens |

Auth is via `Authorization: Bearer <token>` header.

---

## Logo

- The logo is an **SVG** at `images/logo.svg` — a custom-designed version
- There is also the original logo PNG at `images/ss-logo.png` (uploaded by the owner)
- The SVG logo features: orange rounded-square brand mark with "SS", bold navy "SERVICE / SCENE" text, fading orange underline, and "ELECTRONIC SERVICING" + ACN in a right panel
- The owner may still want further logo tweaks — they asked for a redesign and this was one iteration

---

## File Structure

```
ServiceScene/
├── index.html          ← Public website
├── admin.html          ← Admin panel (password protected)
├── script.js           ← Public site JS (fetches items from API)
├── style.css           ← All styles (public + admin)
├── server.js           ← Express backend + API
├── package.json        ← npm config (just express)
├── CLAUDE.md           ← This file
├── .gitignore          ← Excludes node_modules, db/config.json, .DS_Store
├── db/
│   ├── items.json      ← Items database (in git)
│   └── config.json     ← Password + tokens (NOT in git)
├── images/
│   ├── logo.svg        ← Redesigned SVG logo
│   ├── ss-logo.png     ← Original logo from owner
│   ├── logo.jpg        ← Earlier logo test
│   └── logo_test1.jpg  ← Earlier logo test
└── .claude/
    └── launch.json     ← Claude Code launch config (node server.js, port 3456)
```

---

## GitHub

- **Repo:** https://github.com/jay-nginx/servicescene
- **Account:** `jay-nginx` (owner's active GitHub account)
- **Branch:** `main`

---

## Things That Could Be Done Next

- [ ] Replace demo items in `db/items.json` with real inventory
- [ ] Hook up the contact form to actually send emails (currently just shows a success message)
- [ ] Add the real business phone number, address, and trading hours to the website
- [ ] Consider hosting — the site needs a Node.js host (e.g. Railway, Render, DigitalOcean, VPS) since it's not a static site anymore
- [ ] The owner may want more logo design iterations
- [ ] Add a "Sold" toggle so items can be marked sold without deleting them
- [ ] Image storage: currently photos are stored as base64 in `items.json` — fine for now, but for large inventories consider saving to disk or a CDN
- [ ] Add enquiry / contact button directly on each listing card

---

## Owner Context

- The owner's name is Jay (GitHub: `jay-nginx`)
- They are non-technical — keep explanations plain and simple
- They want a clean, modern look — the existing dark navy + orange theme was approved
- The admin interface is designed to be used on a phone (tap to take photo → fill in a few fields → submit)
