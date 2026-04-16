/* ═══════════════════════════════════════
   SERVICE SCENE – MAIN SCRIPT
   Items are loaded from /api/items
   ═══════════════════════════════════════ */

// ── Mobile nav toggle ──
const navToggle = document.getElementById('nav-toggle');
const mainNav   = document.getElementById('main-nav');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
  });
  mainNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mainNav.classList.remove('open'));
  });
}

// ── Header scroll shadow ──
window.addEventListener('scroll', () => {
  const h = document.querySelector('.site-header');
  if (h) h.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,.3)' : 'none';
});

// ── Contact form ──
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    document.getElementById('form-success').style.display = 'block';
    contactForm.reset();
    setTimeout(() => {
      document.getElementById('form-success').style.display = 'none';
    }, 5000);
  });
}

// ══════════════════════════════════════════
//  FOR SALE – items from server API
// ══════════════════════════════════════════

// Cache for modal use
let _cachedItems = [];

function conditionClass(cond) {
  const map = { 'Good': 'cond-good', 'Fair': 'cond-fair', 'Parts Only': 'cond-parts' };
  return map[cond] || 'cond-good';
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return 'POA';
  const n = parseFloat(price);
  return isNaN(n) ? 'POA' : '$' + n.toFixed(0);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderForSale(items) {
  const grid  = document.getElementById('forsale-grid');
  const empty = document.getElementById('forsale-empty');
  if (!grid) return;

  _cachedItems = items;

  if (items.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  grid.innerHTML = items.map((item, idx) => `
    <div class="sale-card" onclick="openModal(${idx})">
      ${item.photo
        ? `<img class="sale-card-img" src="${item.photo}" alt="${escHtml(item.title)}" loading="lazy" />`
        : `<div class="sale-card-img-placeholder">📺</div>`}
      <div class="sale-card-body">
        <span class="sale-card-condition ${conditionClass(item.condition)}">${escHtml(item.condition || 'Good')}</span>
        <h4>${escHtml(item.title)}</h4>
        <p>${escHtml(item.description || '')}</p>
        <div class="sale-card-footer">
          <span class="sale-price">${formatPrice(item.price)}</span>
          <span class="sale-enquire">Enquire →</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Item detail modal ──
function openModal(idx) {
  const item = _cachedItems[idx];
  if (!item) return;

  const modal   = document.getElementById('item-modal');
  const img     = document.getElementById('modal-img');
  const imgWrap = img.parentElement;

  if (item.photo) {
    img.src = item.photo;
    img.alt = item.title;
    imgWrap.style.display = 'block';
  } else {
    imgWrap.style.display = 'none';
  }

  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-price').textContent = formatPrice(item.price);
  document.getElementById('modal-desc').textContent  = item.description || '';

  const badge = document.getElementById('modal-condition');
  badge.textContent = item.condition || 'Good';
  badge.className   = 'modal-badge ' + conditionClass(item.condition);

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('item-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function closeModal() {
  const modal = document.getElementById('item-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeAnnouncement(); }
});

// ══════════════════════════════════════════
//  ANNOUNCEMENT POPUP
// ══════════════════════════════════════════
const ANNOUNCE_SESSION_KEY = 'ss_announcement_dismissed';

function closeAnnouncement() {
  const overlay = document.getElementById('announcement-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

async function loadAnnouncement() {
  // Don't show again if already dismissed this session
  if (sessionStorage.getItem(ANNOUNCE_SESSION_KEY)) return;

  try {
    const res = await fetch('/api/announcement');
    if (!res.ok) return;
    const a = await res.json();
    if (!a) return;

    // Populate popup
    const titleEl  = document.getElementById('announcement-title');
    const bodyEl   = document.getElementById('announcement-body');
    const badgeEl  = document.getElementById('announcement-badge');
    const badgeWrap = document.getElementById('announcement-badge-wrap');
    const btnEl    = document.getElementById('announcement-btn');
    const overlay  = document.getElementById('announcement-overlay');

    titleEl.textContent  = a.title;
    // Allow simple line breaks in body
    bodyEl.innerHTML = escHtml(a.body).replace(/\n/g, '<br/>');
    btnEl.textContent = a.buttonLabel || 'Got it';

    if (a.badge) {
      badgeEl.textContent     = a.badge;
      badgeWrap.style.display = 'block';
    } else {
      badgeWrap.style.display = 'none';
    }

    // Wire up close actions
    const dismiss = () => {
      sessionStorage.setItem(ANNOUNCE_SESSION_KEY, '1');
      closeAnnouncement();
    };
    document.getElementById('announcement-close').onclick = dismiss;
    btnEl.onclick = dismiss;
    overlay.onclick = e => { if (e.target === overlay) dismiss(); };

    // Show with a short delay so page has settled
    setTimeout(() => {
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }, 800);

  } catch (err) {
    // Silently ignore — announcement is optional
  }
}

// ── Load items from API ──
async function loadForSale() {
  const grid = document.getElementById('forsale-grid');
  if (!grid) return;

  // Show loading state
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:48px;color:#94a3b8">
      <div style="font-size:2rem;margin-bottom:12px">⏳</div>
      <p>Loading items…</p>
    </div>`;

  try {
    const res   = await fetch('/api/items');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    renderForSale(items);
  } catch (err) {
    console.error('Failed to load items:', err);
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:#94a3b8">
        <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
        <p>Could not load items. Please try again later.</p>
      </div>`;
  }
}

// Init
loadForSale();
loadAnnouncement();
