/* ═══════════════════════════════════════════════════
   SERVICE SCENE – Backend Server
   Serves static files + REST API for items & auth
   Database: flat JSON files in /db/
═══════════════════════════════════════════════════ */

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3456;

// ── Paths ──────────────────────────────────────────
const DB_DIR       = path.join(__dirname, 'db');
const ITEMS_PATH   = path.join(DB_DIR, 'items.json');
const CFG_PATH     = path.join(DB_DIR, 'config.json');
const ANNOUNCE_PATH = path.join(DB_DIR, 'announcement.json');

// Ensure db/ directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────
app.use(express.json({ limit: '25mb' }));   // accept base64 images
app.use(express.static(__dirname));          // serve HTML/CSS/JS/images

// ── DB helpers ─────────────────────────────────────
function readJSON(filePath, fallback) {
  try   { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getItems()       { return readJSON(ITEMS_PATH, []); }
function saveItems(items) { writeJSON(ITEMS_PATH, items); }

function getConfig() {
  const cfg = readJSON(CFG_PATH, null);
  if (!cfg) {
    const defaults = { password: 'servicescene2024', tokens: [] };
    writeJSON(CFG_PATH, defaults);
    return defaults;
  }
  return cfg;
}
function saveConfig(cfg) { writeJSON(CFG_PATH, cfg); }

function getAnnouncement()      { return readJSON(ANNOUNCE_PATH, null); }
function saveAnnouncement(data) { writeJSON(ANNOUNCE_PATH, data); }

// ── Business day helpers ────────────────────────────
const BUSINESS_DAYS = 5;

// Returns a Date that is `days` business days after `startDate`
function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++; // skip Sat(6) & Sun(0)
  }
  return result;
}

// Returns how many business days remain between now and expiresAt
function businessDaysRemaining(expiresAt) {
  const now    = new Date(); now.setHours(0,0,0,0);
  const expiry = new Date(expiresAt); expiry.setHours(0,0,0,0);
  let count = 0;
  const cursor = new Date(now);
  while (cursor < expiry) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// Check and auto-pause an announcement if its 5-day window has elapsed
function checkAndAutoExpire(a) {
  if (!a || !a.active || !a.expiresAt) return a;
  if (new Date() >= new Date(a.expiresAt)) {
    a.active    = false;
    a.autoExpired = true;
    a.updatedAt = new Date().toISOString();
    saveAnnouncement(a);
    console.log(`⏰ Announcement auto-paused after 5 business days: "${a.title}"`);
  }
  return a;
}

function nextId() { return Date.now() + Math.floor(Math.random() * 9999); }

// ── Seed demo data if DB is empty ──────────────────
function maybeSeed() {
  if (getItems().length > 0) return;
  const demos = [
    {
      id: nextId(),
      title: 'Panasonic 42" Plasma TV',
      description: 'Fully refurbished and tested. Remote included. Great picture quality. No stand.',
      price: 120, condition: 'Good', category: 'Television', photo: '', listed: true,
      addedAt: new Date().toISOString()
    },
    {
      id: nextId() + 1,
      title: 'Sony Universal Remote Control',
      description: 'Compatible with most Sony TVs and AV equipment. Includes batteries.',
      price: 15, condition: 'Good', category: 'Remote Control', photo: '', listed: true,
      addedAt: new Date().toISOString()
    },
    {
      id: nextId() + 2,
      title: 'LG Blu-ray Player',
      description: 'Plays Blu-ray and DVD. HDMI cable included. Minor cosmetic scratches.',
      price: 45, condition: 'Fair', category: 'Blu-ray / DVD', photo: '', listed: true,
      addedAt: new Date().toISOString()
    }
  ];
  saveItems(demos);
  console.log('📦 Seeded 3 demo items.');
}

// ── Auth middleware ─────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised – no token' });
  }
  const token = header.slice(7);
  const cfg   = getConfig();
  if (!cfg.tokens.includes(token)) {
    return res.status(401).json({ error: 'Unauthorised – invalid token' });
  }
  req.token = token;
  next();
}

// ══════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  const cfg = getConfig();
  if (!password || password !== cfg.password) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  cfg.tokens.push(token);
  if (cfg.tokens.length > 20) cfg.tokens = cfg.tokens.slice(-20);
  saveConfig(cfg);
  res.json({ token });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const cfg = getConfig();
  cfg.tokens = cfg.tokens.filter(t => t !== req.token);
  saveConfig(cfg);
  res.json({ ok: true });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const cfg = getConfig();
  cfg.password = password;
  cfg.tokens   = [];   // invalidate all sessions on password change
  saveConfig(cfg);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════
//  ITEMS ROUTES
// ══════════════════════════════════════════════════

// GET /api/items  – public, returns only listed items
app.get('/api/items', (req, res) => {
  const items = getItems().filter(i => i.listed !== false);
  res.json(items);
});

// GET /api/items/all  – admin only, returns all items
app.get('/api/items/all', requireAuth, (req, res) => {
  res.json(getItems());
});

// POST /api/items  – admin: create
app.post('/api/items', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const item = {
    id:          nextId(),
    title:       body.title.trim(),
    description: body.description || '',
    price:       body.price !== '' && body.price != null ? parseFloat(body.price) : null,
    condition:   body.condition   || 'Good',
    category:    body.category    || 'Other',
    photo:       body.photo       || '',
    listed:      true,
    addedAt:     new Date().toISOString()
  };
  const items = getItems();
  items.unshift(item);
  saveItems(items);
  console.log(`➕ Added item: "${item.title}" (id ${item.id})`);
  res.status(201).json(item);
});

// PUT /api/items/:id  – admin: update
app.put('/api/items/:id', requireAuth, (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const items = getItems();
  const idx   = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const body = req.body || {};
  items[idx] = {
    ...items[idx],
    title:       body.title       !== undefined ? body.title.trim()            : items[idx].title,
    description: body.description !== undefined ? body.description             : items[idx].description,
    price:       body.price       !== undefined
                   ? (body.price === '' || body.price === null ? null : parseFloat(body.price))
                   : items[idx].price,
    condition:   body.condition   !== undefined ? body.condition               : items[idx].condition,
    category:    body.category    !== undefined ? body.category                : items[idx].category,
    photo:       body.photo       !== undefined ? body.photo                   : items[idx].photo,
    updatedAt:   new Date().toISOString()
  };
  saveItems(items);
  console.log(`✏️  Updated item id ${id}`);
  res.json(items[idx]);
});

// DELETE /api/items/:id  – admin: delete
app.delete('/api/items/:id', requireAuth, (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const items = getItems();
  const found = items.some(i => i.id === id);
  if (!found) return res.status(404).json({ error: 'Item not found' });
  saveItems(items.filter(i => i.id !== id));
  console.log(`🗑  Deleted item id ${id}`);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════
//  ANNOUNCEMENT ROUTES
// ══════════════════════════════════════════════════

// GET /api/announcement  – public, returns active announcement or null (auto-expires if needed)
app.get('/api/announcement', (req, res) => {
  let a = getAnnouncement();
  a = checkAndAutoExpire(a);
  if (!a || !a.active) return res.json(null);
  res.json(a);
});

// GET /api/announcement/admin  – admin, returns announcement regardless of active state
app.get('/api/announcement/admin', requireAuth, (req, res) => {
  let a = getAnnouncement();
  a = checkAndAutoExpire(a); // also auto-expire when admin checks
  res.json(a);
});

// POST /api/announcement  – admin: create or update
app.post('/api/announcement', requireAuth, (req, res) => {
  const { title, body, active, badge, buttonLabel } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!body  || !body.trim())  return res.status(400).json({ error: 'Body is required' });

  const isActive   = active !== false;
  const now        = new Date();
  const expiresAt  = isActive ? addBusinessDays(now, BUSINESS_DAYS).toISOString() : null;

  const a = {
    title:        title.trim(),
    body:         body.trim(),
    badge:        badge       || '',
    buttonLabel:  buttonLabel || 'Got it',
    active:       isActive,
    activatedAt:  isActive ? now.toISOString() : null,
    expiresAt,
    autoExpired:  false,
    updatedAt:    now.toISOString()
  };
  saveAnnouncement(a);
  console.log(`📢 Announcement saved: "${a.title}" (active: ${a.active}, expires: ${a.expiresAt})`);
  res.json(a);
});

// PATCH /api/announcement/toggle  – admin: flip active flag, reset expiry if re-activating
app.patch('/api/announcement/toggle', requireAuth, (req, res) => {
  const a = getAnnouncement();
  if (!a) return res.status(404).json({ error: 'No announcement set' });

  a.active = !a.active;
  a.updatedAt = new Date().toISOString();

  if (a.active) {
    // Re-activating: grant a fresh 5-business-day window
    a.activatedAt  = a.updatedAt;
    a.expiresAt    = addBusinessDays(new Date(), BUSINESS_DAYS).toISOString();
    a.autoExpired  = false;
  }

  saveAnnouncement(a);
  res.json(a);
});

// DELETE /api/announcement  – admin: remove entirely
app.delete('/api/announcement', requireAuth, (req, res) => {
  saveAnnouncement(null);
  console.log('🗑  Announcement cleared');
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════
//  CONTACT FORM ROUTE
// ══════════════════════════════════════════════════

// Nodemailer transporter — configured via environment variables.
// Set these in cPanel → Setup Node.js App → Environment Variables:
//   SMTP_HOST  = mail.servicescene.com.au  (or your host's mail server)
//   SMTP_PORT  = 465
//   SMTP_USER  = info@servicescene.com.au
//   SMTP_PASS  = (your email account password)
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'localhost',
  port:   parseInt(process.env.SMTP_PORT || '465'),
  secure: parseInt(process.env.SMTP_PORT || '465') === 465,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// POST /api/contact  – public, sends enquiry email
app.post('/api/contact', async (req, res) => {
  const { name, phone, email, subject, message } = req.body || {};

  if (!name || !name.trim())    return res.status(400).json({ error: 'Name is required' });
  if (!email || !email.trim())  return res.status(400).json({ error: 'Email is required' });
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  const mailOptions = {
    from:     `"Service Scene Website" <${process.env.SMTP_USER || 'info@servicescene.com.au'}>`,
    to:       'info@servicescene.com.au',
    replyTo:  `"${name.trim()}" <${email.trim()}>`,
    subject:  `[Website Enquiry] ${subject || 'General Enquiry'} – ${name.trim()}`,
    text: `
New enquiry from the Service Scene website
==========================================

Name:     ${name.trim()}
Phone:    ${phone ? phone.trim() : 'Not provided'}
Email:    ${email.trim()}
Subject:  ${subject || 'General Enquiry'}

Message:
${message.trim()}

--
Sent via servicescene.com.au contact form
    `.trim(),
    html: `
<p><strong>New enquiry from the Service Scene website</strong></p>
<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
  <tr><td><strong>Name</strong></td><td>${name.trim()}</td></tr>
  <tr><td><strong>Phone</strong></td><td>${phone ? phone.trim() : 'Not provided'}</td></tr>
  <tr><td><strong>Email</strong></td><td><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
  <tr><td><strong>Subject</strong></td><td>${subject || 'General Enquiry'}</td></tr>
</table>
<p><strong>Message:</strong></p>
<p style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap">${message.trim()}</p>
<hr/>
<p style="color:#888;font-size:12px">Sent via servicescene.com.au contact form</p>
    `.trim()
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Contact enquiry from ${name.trim()} <${email.trim()}>`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Failed to send contact email:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please call us directly on 03 9888 1844.' });
  }
});

// ── Start ──────────────────────────────────────────
maybeSeed();
app.listen(PORT, () => {
  console.log(`\n🔧 Service Scene running at http://localhost:${PORT}`);
  console.log(`📂 Database: ${DB_DIR}`);
  console.log(`🔑 Default admin password: servicescene2024\n`);
});
