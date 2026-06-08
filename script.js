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
  const submitBtn    = contactForm.querySelector('button[type="submit"]');
  const subjectEl    = document.getElementById('cf-subject');
  const suburbGroup  = document.getElementById('cf-suburb-group');
  const suburbInput  = document.getElementById('cf-suburb');

  function toggleSuburb() {
    const isCallout = subjectEl.value === 'Call-Out Service';
    suburbGroup.style.display = isCallout ? 'block' : 'none';
    suburbInput.required      = isCallout;
  }
  subjectEl.addEventListener('change', toggleSuburb);
  toggleSuburb();

  contactForm.addEventListener('submit', async e => {
    e.preventDefault();

    const successEl = document.getElementById('form-success');
    const errorEl   = document.getElementById('form-error');
    if (successEl) successEl.style.display = 'none';
    if (errorEl)   errorEl.style.display   = 'none';

    const originalText    = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled    = true;

    try {
      const formData = new FormData(contactForm);

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body:   formData
      });
      const data = await response.json();

      if (response.ok) {
        if (successEl) successEl.style.display = 'block';
        contactForm.reset();
      } else {
        if (errorEl) { errorEl.textContent = data.message || 'Something went wrong.'; errorEl.style.display = 'block'; }
      }
    } catch {
      if (errorEl) { errorEl.textContent = 'Could not send message. Please call us on 03 9888 1844.'; errorEl.style.display = 'block'; }
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled    = false;
    }
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

// ══════════════════════════════════════════
//  TRADING HOURS
// ══════════════════════════════════════════

function fmt12h(t) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m === '00' ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}

async function loadHours() {
  try {
    const res   = await fetch('/api/hours');
    if (!res.ok) return;
    const hours = await res.json();

    // Build topbar summary — group days with identical open hours
    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const DAY_SHORT = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };

    // Group consecutive open days with same times
    const openDays = DAYS.filter(d => hours[d]?.open);
    const groups = [];
    for (const day of openDays) {
      const { from, to } = hours[day];
      const last = groups[groups.length - 1];
      if (last && last.from === from && last.to === to) {
        last.days.push(day);
      } else {
        groups.push({ days: [day], from, to });
      }
    }

    const topbarParts = groups.map(g => {
      const label = g.days.length === 1
        ? DAY_SHORT[g.days[0]]
        : `${DAY_SHORT[g.days[0]]}–${DAY_SHORT[g.days[g.days.length - 1]]}`;
      return `${label}: ${fmt12h(g.from)} – ${fmt12h(g.to)}`;
    });

    const topbarEl = document.getElementById('topbar-hours');
    if (topbarEl) topbarEl.textContent = topbarParts.join('  |  ') || 'See website for hours';

    // Build contact section — one line per day or group
    const contactLines = DAYS.map(day => {
      const d = hours[day];
      const label = DAY_SHORT[day];
      if (!d?.open) return `${label}: Closed`;
      return `${label}: ${fmt12h(d.from)} – ${fmt12h(d.to)}`;
    });

    const contactEl = document.getElementById('contact-hours');
    if (contactEl) contactEl.innerHTML = contactLines.join('<br />');

  } catch {
    // Silently ignore — hours are optional enhancement
  }
}

// Init
loadForSale();
loadAnnouncement();
loadHours();
