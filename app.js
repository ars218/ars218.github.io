
(function () {
  const HOLD_MS = 450;
  const MOVE_CANCEL = 12;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const backdrop = document.getElementById('menu-backdrop');
  const menu = document.getElementById('ctx-menu');
  const list = document.getElementById('ctx-list');
  const capsule = document.getElementById('ctx-capsule');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  let menuOpen = false;
  let activeIndex = 0;
  let menuActions = [];
  let holdTimer = null;
  let holdOrigin = null;
  let holdTarget = null;
  let suppressClick = false;
  let dragging = false;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Link copied');
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast('Link copied');
        return true;
      } catch {
        toast('Could not copy');
        return false;
      }
    }
  }

  async function shareLink(title, url) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url, text: title });
        toast('Shared');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    await copyText(url);
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function icon(path) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  const I = {
    open: icon('<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
    details: icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v4h1"/>'),
    copy: icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>'),
    share: icon('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.5 13.5l7 4M15.5 6.5l-7 4"/>'),
    github: icon('<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 00-6 0C6.3 2.8 5.2 3.1 5.2 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 003.8 9.5c0 4.6 2.7 5.7 5.5 6-.6.5-.6 1.2-.5 2V21"/>'),
    home: icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>'),
    apps: icon('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  };

  function appMenuItems(card) {
    const name = card.dataset.app === 'gradix' ? 'Gradix' : 'myDecidr';
    const url = card.dataset.url;
    const github = card.dataset.github;
    const section = card.dataset.section;
    return [
      { label: 'Open app', icon: I.open, run: () => window.open(url, '_blank', 'noopener') },
      { label: 'View details', icon: I.details, run: () => scrollToId(section) },
      { label: 'Copy link', icon: I.copy, run: () => copyText(url) },
      { label: 'Share', icon: I.share, run: () => shareLink(name, url) },
      { divider: true },
      { label: 'GitHub', icon: I.github, run: () => window.open(github, '_blank', 'noopener') },
    ];
  }

  function ssMenuItems(tile) {
    const src = new URL(tile.dataset.ssSrc, location.href).href;
    const label = tile.dataset.ssLabel || 'Screenshot';
    return [
      { label: 'Copy image link', icon: I.copy, run: () => copyText(src) },
      { label: 'Share', icon: I.share, run: () => shareLink(label, src) },
      { divider: true },
      { label: 'Open image', icon: I.open, run: () => window.open(src, '_blank', 'noopener') },
    ];
  }

  function siteMenuItems() {
    return [
      { label: 'myDecidr', icon: I.details, run: () => scrollToId('section-mydecidr') },
      { label: 'Gradix', icon: I.apps, run: () => scrollToId('section-gradix') },
      { divider: true },
      { label: 'Copy site link', icon: I.copy, run: () => copyText(location.href.replace(/#.*$/, '')) },
      { label: 'Share site', icon: I.share, run: () => shareLink('ARS Apps', location.href.replace(/#.*$/, '')) },
    ];
  }

  function moveCapsule(index, animate) {
    const items = list.querySelectorAll('.ctx-item');
    if (!items.length) return;
    index = Math.max(0, Math.min(items.length - 1, index));
    activeIndex = index;
    const item = items[index];
    const top = item.offsetTop;
    if (!animate || reduced) capsule.style.transition = 'none';
    else capsule.style.transition = '';
    capsule.style.transform = `translateY(${top}px)`;
    capsule.classList.add('visible');
    items.forEach((el, i) => el.setAttribute('aria-selected', i === index ? 'true' : 'false'));
    if (!animate || reduced) requestAnimationFrame(() => { capsule.style.transition = ''; });
  }

  function openMenu(x, y, items) {
    menuActions = items.filter(it => !it.divider);
    list.innerHTML = '';
    items.forEach((it) => {
      if (it.divider) {
        const hr = document.createElement('li');
        hr.className = 'ctx-divider';
        hr.setAttribute('role', 'separator');
        list.appendChild(hr);
        return;
      }
      const li = document.createElement('li');
      li.setAttribute('role', 'none');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctx-item';
      btn.setAttribute('role', 'menuitem');
      btn.innerHTML = `${it.icon}<span>${it.label}</span>`;
      btn.addEventListener('pointerenter', () => {
        const idx = menuActions.indexOf(it);
        if (idx >= 0) moveCapsule(idx, true);
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        confirmSelection();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    backdrop.hidden = false;
    menu.hidden = false;
    menu.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');

    // Position near press, keep on screen
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.classList.add('open');
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const pad = 12;
    let left = x - mw * 0.72;
    let top = y + 10;
    left = Math.max(pad, Math.min(window.innerWidth - mw - pad, left));
    top = Math.max(pad + 20, Math.min(window.innerHeight - mh - pad, top));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    menuOpen = true;
    dragging = true;
    requestAnimationFrame(() => moveCapsule(0, false));
  }

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    dragging = false;
    menu.classList.remove('open');
    backdrop.classList.remove('open');
    capsule.classList.remove('visible');
    menu.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!menuOpen) {
        menu.hidden = true;
        backdrop.hidden = true;
        list.innerHTML = '';
      }
    }, reduced ? 0 : 280);
  }

  function confirmSelection() {
    const action = menuActions[activeIndex];
    closeMenu();
    if (action && action.run) {
      setTimeout(() => action.run(), 40);
    }
  }

  function indexFromPoint(clientY) {
    const items = list.querySelectorAll('.ctx-item');
    if (!items.length) return 0;
    let best = 0;
    let bestDist = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const d = Math.abs(clientY - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  function clearHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holdTarget) holdTarget.classList.remove('is-pressing');
    holdTarget = null;
    holdOrigin = null;
  }

  function startHold(target, x, y, buildItems) {
    clearHold();
    holdTarget = target;
    holdOrigin = { x, y, buildItems };
    target.classList.add('is-pressing');
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (!holdOrigin) return;
      const items = holdOrigin.buildItems();
      const ox = holdOrigin.x;
      const oy = holdOrigin.y;
      target.classList.remove('is-pressing');
      suppressClick = true;
      openMenu(ox, oy, items);
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {}
    }, HOLD_MS);
  }

  function onPointerDown(e) {
    if (menuOpen) return;
    if (e.button != null && e.button !== 0) return;
    const card = e.target.closest('.app-card');
    const tile = e.target.closest('.ss-tile');
    if (card) {
      startHold(card, e.clientX, e.clientY, () => appMenuItems(card));
    } else if (tile) {
      startHold(tile, e.clientX, e.clientY, () => ssMenuItems(tile));
    }
  }

  function onPointerMove(e) {
    if (menuOpen && dragging) {
      const idx = indexFromPoint(e.clientY);
      if (idx !== activeIndex) moveCapsule(idx, true);
      return;
    }
    if (!holdOrigin) return;
    const dx = e.clientX - holdOrigin.x;
    const dy = e.clientY - holdOrigin.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL) clearHold();
  }

  function onPointerUp(e) {
    if (menuOpen && dragging) {
      dragging = false;
      // If released on a menu item after drag, confirm
      if (e.target.closest && e.target.closest('.ctx-item')) {
        confirmSelection();
      } else if (e.target === backdrop || !menu.contains(e.target)) {
        // release outside after opening via hold — keep open; tap dismisses
      }
      return;
    }
    clearHold();
  }

  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerup', onPointerUp, { passive: true });
  document.addEventListener('pointercancel', () => { clearHold(); }, { passive: true });

  // Click / short tap on app card → scroll to details
  document.querySelectorAll('.app-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
      scrollToId(card.dataset.section);
    });
  });

  backdrop.addEventListener('click', () => closeMenu());
  backdrop.addEventListener('pointerdown', (e) => { e.stopPropagation(); });

  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveCapsule(activeIndex + 1, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCapsule(activeIndex - 1, true); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmSelection(); }
  });

  document.getElementById('btn-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  document.getElementById('btn-overflow').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openMenu(r.left + r.width / 2, r.bottom + 4, siteMenuItems());
  });

  // Prevent native context menu on long-press targets
  document.querySelectorAll('.app-card, .ss-tile').forEach((el) => {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
})();
