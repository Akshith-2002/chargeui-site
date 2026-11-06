(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const inr = (n, d = 0) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const onView = (el, fn, opts = { threshold: 0.35 }) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(true); return; }
    new IntersectionObserver((entries) => entries.forEach((e) => fn(e.isIntersecting)), opts).observe(el);
  };

  /* ---------- nav: scroll battery + section highlight ---------- */
  const nav = $('#nav'), fill = $('#batt-fill'), pct = $('#batt-pct'), batt = $('.nav-batt');
  const navBar = $('nav', nav);
  const pill = document.createElement('span');
  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  navBar.prepend(pill);
  const links = $$('a[href^="#"]', navBar);
  const spySections = $$('main > section[id]');
  let current = null;
  function setCurrent(id) {
    if (id === current) return;
    current = id;
    const link = links.find((a) => a.getAttribute('href') === '#' + id);
    links.forEach((a) => {
      const on = a === link;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    if (link) {
      pill.style.width = link.offsetWidth + 'px';
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
      pill.classList.add('on');
    } else pill.classList.remove('on');
  }
  // USP tabs follow the block in view
  const utabs = $$('.utab');
  const ublocks = $$('.usp-block');
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(100, Math.round((scrollY / max) * 100)) : 0;
    fill.style.width = p + '%';
    pct.textContent = p + '%';
    batt.classList.toggle('full', p >= 99);
    nav.classList.toggle('scrolled', scrollY > 8);
    const line = innerHeight * 0.4;
    let id = null;
    for (const s of spySections) if (s.getBoundingClientRect().top <= line) id = s.id;
    setCurrent(id);
    let u = -1;
    ublocks.forEach((b, i) => { if (b.getBoundingClientRect().top <= innerHeight * 0.5) u = i; });
    utabs.forEach((t, i) => t.classList.toggle('on', i === u));
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { const id = current; current = null; setCurrent(id); });
  onScroll();

  /* ---------- hero: rotating operational notifications ---------- */
  const toast = $('#htoast');
  if (toast) {
    const msgs = [
      { ico: '⚡', cls: '', t: 'Load rebalanced', s: 'Green Meadows · 4 cars sharing 22 kW' },
      { ico: '!', cls: 'amber', t: 'Ticket #1048 opened automatically', s: 'GR-0419-A fault · assigned to Ravi K.' },
      { ico: '✓', cls: 'green', t: 'Ticket #1048 resolved', s: 'Charger back online in 44 minutes' },
      { ico: '₹', cls: 'green', t: 'Daily settlement ready', s: 'Green Meadows · ₹9,500 net for yesterday' },
    ];
    let i = 0;
    const ico = $('#ht-ico'), tt = $('#ht-title'), ts = $('#ht-sub');
    if (!reduced) setInterval(() => {
      toast.classList.add('swap');
      setTimeout(() => {
        i = (i + 1) % msgs.length;
        const m = msgs[i];
        ico.textContent = m.ico; ico.className = 't-ico ' + m.cls; tt.textContent = m.t; ts.textContent = m.s;
        toast.classList.remove('swap');
      }, 380);
    }, 3600);
  }

  /* ---------- USP 1: dynamic AC load management ---------- */
  const lb = $('#lb');
  if (lb) {
    const MAX_KW = 7.4, N = 6;
    const bayBox = $('#lb-bays'), toggle = $('#lb-toggle'), range = $('#lb-limit');
    const out = $('#lb-limit-out'), totalEl = $('#lb-total'), limitV = $('#lb-limit-v'), fillEl = $('#lb-fill'), mark = $('#lb-limit-mark'), msg = $('#lb-msg');
    const names = ['A-101', 'A-204', 'B-002', 'B-305', 'C-110', 'C-402'];
    const state = Array(N).fill(false);
    let touched = false;
    const bays = names.map((n, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bay';
      b.innerHTML = `<span class="bay-id"><span>Bay ${i + 1}</span><span>Flat ${n}</span></span>
        <span class="bay-car"><svg viewBox="0 0 360 160" aria-hidden="true"><use href="#ev-car"/></svg></span>
        <span class="bay-empty">Empty · tap to plug in</span>
        <span class="bay-kw"><span class="kw">0.0</span><small>kW</small></span>
        <span class="bay-bar"><i></i></span>`;
      b.addEventListener('click', () => { touched = true; state[i] = !state[i]; render(); });
      bayBox.appendChild(b);
      return b;
    });
    function render() {
      const limit = +range.value;
      const on = toggle.checked;
      const n = state.filter(Boolean).length;
      const share = n ? (on ? Math.min(MAX_KW, limit / n) : MAX_KW) : 0;
      const total = share * n;
      const scale = 44.4;
      out.textContent = limit + ' kW';
      limitV.textContent = limit;
      totalEl.textContent = total.toFixed(1);
      fillEl.style.width = Math.min(100, (total / scale) * 100) + '%';
      mark.style.left = (limit / scale) * 100 + '%';
      const over = total > limit + 0.01;
      lb.classList.toggle('over', over);
      lb.classList.toggle('ok', !over && n > 0);
      bays.forEach((b, i) => {
        const kw = state[i] ? share : 0;
        b.classList.toggle('on', state[i]);
        b.setAttribute('aria-label', `Bay ${i + 1}, ${state[i] ? 'car charging at ' + kw.toFixed(1) + ' kilowatts' : 'empty'}. Tap to ${state[i] ? 'unplug' : 'plug in'}.`);
        $('.kw', b).textContent = kw.toFixed(1);
        $('.bay-bar i', b).style.width = (kw / MAX_KW) * 100 + '%';
      });
      if (!n) msg.textContent = 'Tap a bay to plug a car in.';
      else if (over) msg.textContent = `${total.toFixed(1)} kW is over the ${limit} kW limit. Without load management the main breaker trips and every car stops charging.`;
      else if (on && share < MAX_KW) msg.textContent = `${n} cars sharing ${limit} kW at ${share.toFixed(1)} kW each. Nothing trips, everyone charges.`;
      else msg.textContent = `${n} car${n > 1 ? 's' : ''} charging at full ${MAX_KW} kW. Within the limit.`;
    }
    toggle.addEventListener('change', () => { touched = true; render(); });
    range.addEventListener('input', () => { touched = true; render(); });
    render();
    // Cars arrive one by one the first time the demo comes into view.
    let started = false;
    onView(lb, (v) => {
      if (!v || started) return;
      started = true;
      const order = [0, 2, 4, 1];
      order.forEach((k, j) => setTimeout(() => { if (!touched) { state[k] = true; render(); } }, reduced ? 0 : 500 + j * 1100));
    }, { threshold: 0.4 });
  }

  /* ---------- USP 2: issue tracking timeline ---------- */
  const it = $('#it');
  if (it) {
    const stages = $$('#it-stages li'), logs = $$('#it-log li'), prog = $('#it-progress'), badge = $('#it-badge');
    const BADGE = ['Open', 'Open', 'Assigned', 'In progress', 'Resolved'];
    let timers = [];
    function show(k) {
      stages.forEach((s, i) => s.classList.toggle('on', i <= k));
      logs.forEach((l, i) => { l.classList.toggle('on', i <= k); l.classList.toggle('cur', i === k); });
      prog.style.width = (k / (stages.length - 1)) * 100 + '%';
      badge.textContent = BADGE[k];
      badge.className = 'it-badge' + (k === 4 ? ' done' : k >= 2 ? ' prog' : '');
      it.classList.toggle('done', k === 4);
    }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      if (reduced) { show(4); return; }
      show(0);
      for (let k = 1; k < 5; k++) timers.push(setTimeout(() => show(k), k * 1500));
    }
    $('#it-replay').addEventListener('click', play);
    let played = false;
    onView(it, (v) => { if (v && !played) { played = true; play(); } }, { threshold: 0.45 });
  }

  /* ---------- USP 3: daily settlement ---------- */
  const st = $('#st');
  if (st) {
    // Illustrative: processing fee 2%, platform fee 3% of gross.
    const DAYS = [
      { d: 'Mon', n: 2, gross: 10000 },
      { d: 'Tue', n: 3, gross: 8420 },
      { d: 'Wed', n: 4, gross: 12650 },
      { d: 'Thu', n: 5, gross: 9310 },
      { d: 'Fri', n: 6, gross: 11080, today: true },
    ];
    // Amounts count from their previous value to the new one.
    const countTo = (el, to, prefix) => {
      const from = el._v || 0;
      el._v = to;
      if (reduced) { el.textContent = prefix + inr(to); return; }
      cancelAnimationFrame(el._raf);
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 600);
        el.textContent = prefix + inr(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) el._raf = requestAnimationFrame(step);
      };
      el._raf = requestAnimationFrame(step);
    };
    const box = $('#st-days');
    const btns = DAYS.map((x, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'st-day';
      b.setAttribute('role', 'tab');
      b.innerHTML = `${x.d}<b>${x.n}</b>Nov`;
      b.addEventListener('click', () => pick(i));
      box.appendChild(b);
      return b;
    });
    function pick(i) {
      const x = DAYS[i];
      const proc = x.gross * 0.02, plat = x.gross * 0.03, net = x.gross - proc - plat;
      const kwh = Math.round(x.gross / 16.52); // ₹14/kWh + 18% GST
      btns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
      countTo($('#st-gross'), x.gross, '');
      countTo($('#st-proc'), proc, '− ');
      countTo($('#st-plat'), plat, '− ');
      countTo($('#st-net'), net, '');
      $('#st-kwh').textContent = kwh.toLocaleString('en-IN');
      $('#st-sessions').textContent = Math.round(kwh / 13);
      const status = $('#st-status');
      status.textContent = x.today ? 'Processing' : 'Paid out';
      status.className = 'st-status' + (x.today ? ' proc' : '');
      $('#st-when').textContent = x.today ? 'Settles to your bank tomorrow morning' : `Credited to your bank on ${DAYS[i + 1].d} ${DAYS[i + 1].n} Nov`;
    }
    pick(0);
  }

  /* ---------- scroll reveals: groups of cards fade up one after another ---------- */
  if (!reduced && 'IntersectionObserver' in window) {
    const groups = ['.pillars > *', '.pos-grid > li', '.why-grid > li', '.about > div', '.modules > div', '.ind-cards > li', '.infra-grid > li', '.phones > li', '.fr-list > li', '.vs-row', '.usp-block', '.flow', '.energy'];
    const rio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    groups.forEach((sel) => $$(sel).forEach((el, i) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.9) return; // already on screen at load: leave it alone
      el.classList.add('rv');
      el.style.setProperty('--d', i % 8);
      rio.observe(el);
    }));
    // franchise journey: draw the line, then light up each step
    $$('.steps').forEach((ol) => {
      ol.classList.add('anim');
      $$('li', ol).forEach((li, i) => li.style.setProperty('--d', i));
      onView(ol, (v) => { if (v) ol.classList.add('in'); }, { threshold: 0.3 });
    });
  }

  /* ---------- hero: dashboard and phone tilt gently with the pointer ---------- */
  const heroVis = $('.hero-visual');
  if (heroVis && !reduced && matchMedia('(pointer: fine)').matches) {
    const hero = $('.hero');
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        heroVis.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        heroVis.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    });
    hero.addEventListener('pointerleave', () => { heroVis.style.setProperty('--px', 0); heroVis.style.setProperty('--py', 0); });
  }

  /* ---------- CMS screen gallery: rotates on its own, a click pauses it briefly ---------- */
  const gal = $('#gallery');
  if (gal) {
    const gtabs = $$('.gtab', gal), gimgs = $$('.g-stage img', gal);
    const gcap = $('#g-cap'), gpath = $('#g-path'), gbar = $('#g-bar');
    const PATHS = ['dashboard', 'analytics', 'alarms', 'transactions', 'assets/stations', 'sessions', 'tickets', 'white-label', 'broadcasts'];
    const MS = 5000;
    let gi = 0, gtimer = null, gvisible = false;
    gal.style.setProperty('--g-ms', MS + 'ms');
    function gshow(i) {
      gi = i;
      gtabs.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
      gimgs.forEach((im, k) => { im.classList.toggle('on', k === i); if (Math.abs(k - i) <= 1) im.loading = 'eager'; });
      gcap.textContent = gimgs[i].dataset.cap;
      gpath.textContent = PATHS[i];
      const row = gtabs[i].parentElement, tb = gtabs[i];
      if (row.scrollWidth > row.clientWidth) row.scrollTo({ left: tb.offsetLeft - (row.clientWidth - tb.offsetWidth) / 2, behavior: 'smooth' });
      gbar.classList.remove('run'); void gbar.offsetWidth;
      if (!reduced && gvisible) gbar.classList.add('run');
    }
    function gnext(delay) {
      clearTimeout(gtimer);
      gtimer = setTimeout(() => { if (gvisible) gshow((gi + 1) % gimgs.length); gnext(MS); }, delay);
    }
    gtabs.forEach((b, k) => b.addEventListener('click', () => { gshow(k); gnext(MS * 2); }));
    if (!reduced) onView(gal, (v) => { const was = gvisible; gvisible = v; if (v && !was) { gshow(gi); gnext(MS); } }, { threshold: 0.25 });
  }

  /* ---------- admin screenshot settles flat ---------- */
  const adminShot = $('#admin');
  if (adminShot) {
    if (reduced) adminShot.classList.add('in');
    else onView(adminShot, (v) => { if (v) adminShot.classList.add('in'); }, { threshold: 0.2 });
  }

  /* ---------- white-label brand switcher ---------- */
  const wl = $('#wl');
  if (wl) {
    $$('.wl-b', wl).forEach((b) => b.addEventListener('click', () => {
      $$('.wl-b', wl).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
      wl.style.setProperty('--c1', b.dataset.c1);
      wl.style.setProperty('--c2', b.dataset.c2);
      $$('.wl-name', wl).forEach((n) => (n.textContent = b.dataset.name));
    }));
  }

  /* ---------- driver app story: sticky phone follows the step in view ---------- */
  $$('.qr').forEach((box) => {
    const N = 21; let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    let r = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" fill="#0f172a">${r}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</svg>`;
  });
  const stack = $('#story-stack'), dotsBox = $('#story-dots');
  const steps = $$('.story-step');
  if (stack && steps.length) {
    const screens = steps.map((s) => {
      const ui = $('.step-screen .ui', s).cloneNode(true);
      ui.setAttribute('aria-hidden', 'true');
      stack.appendChild(ui);
      dotsBox.appendChild(document.createElement('i'));
      return ui;
    });
    const dots = $$('i', dotsBox);
    const setActive = (i) => {
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      screens.forEach((u, k) => u.classList.toggle('on', k === i));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    };
    setActive(0);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(steps.indexOf(e.target)); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach((s) => io.observe(s));
    }
  }

  /* ---------- power flow: energise each stage in turn ---------- */
  const flow = $('#flow');
  if (flow) {
    const CAPS = [
      'Power arrives from the utility\'s 11 kV overhead line and drops down the pole through an HT cable.',
      'The CTPT steps current and voltage down to measurable levels. Thin signal wires feed the meter box beside it, which records every unit.',
      'The HT vacuum circuit breaker (VCB) protects everything after it and cuts the supply instantly if there is a fault.',
      'The transformer steps 11 kV down to 415 V, the voltage your site and chargers use.',
      'The LT kiosk distributes power to each charger through MCCB and RCD protection.',
      'Power reaches the chargers. From here, ChargeUI\'s CMS monitors every session and balances load across them.',
    ];
    const btns = $$('.flow-steps button', flow);
    const cap = $('#flow-cap');
    const byStage = (sel, k) => $$(sel + `[data-s="${k}"]`, flow);
    const sc = $('.flow-scroll', flow), svg = $('.flow-svg', flow);
    const CENTERS = [80, 238, 395, 600, 790, 1060];
    let k = -1, timer = null, energised = false, visible = false;
    function show(n) {
      k = n;
      if (n === 5) energised = true; // after the first full pass, power keeps flowing everywhere
      for (let s = 0; s <= 5; s++) {
        const live = energised || s <= n;
        byStage('.flow-p', s).forEach((p) => p.classList.toggle('live', live));
        byStage('.eq', s).forEach((e) => { e.classList.toggle('live', live); e.classList.toggle('cur', s === n); });
        byStage('.fl-labels g', s).forEach((g) => { g.classList.toggle('live', live); g.classList.toggle('cur', s === n); });
      }
      btns.forEach((b, i) => { b.classList.toggle('on', i === n); b.classList.toggle('done', i < n); b.setAttribute('aria-selected', i === n); });
      cap.textContent = CAPS[n];
      // On narrow screens the diagram scrolls sideways: keep the current equipment in view.
      if (sc.scrollWidth > sc.clientWidth + 4) {
        sc.scrollTo({ left: (CENTERS[n] / 1200) * svg.clientWidth - sc.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    // Self-scheduling loop: never stops for good. A click pauses it briefly, then it carries on.
    function schedule(delay) {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    }
    function tick() {
      if (!visible) { schedule(800); return; }
      const next = k >= 5 ? 0 : k + 1;
      show(next);
      schedule(next === 5 ? 4200 : 2600);
    }
    btns.forEach((b, i) => b.addEventListener('click', () => { show(i); schedule(7000); }));
    if (reduced) { energised = true; show(5); }
    else {
      onView(flow, (v) => {
        visible = v;
        if (v && k < 0) { show(0); schedule(2600); }
      }, { threshold: 0 });
    }
  }

  /* ---------- WhatsApp enquiry ----------
     Set your business WhatsApp number here (country code, digits only, e.g. '919876543210').
     While it is empty, the WhatsApp button and contact row stay hidden. */
  const WHATSAPP_NUMBER = '';
  if (WHATSAPP_NUMBER) {
    const text = encodeURIComponent('Hi ChargeUI, I would like to know more about your EV charging solutions.');
    $$('.wa-link').forEach((a) => { a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`; a.hidden = false; });
    $$('.wa-row').forEach((r) => (r.hidden = false));
  }

  /* ---------- contact: enquiry paths + mailto form ---------- */
  const reqSel = $('#f-req');
  $$('.path').forEach((p) => p.addEventListener('click', () => {
    $$('.path').forEach((x) => { x.classList.toggle('on', x === p); x.setAttribute('aria-checked', x === p); });
    reqSel.value = p.dataset.req;
  }));
  const form = $('#lead');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const note = $('#form-note');
      const req = ['name', 'phone', 'email'].map((n) => form.elements[n]);
      let bad = null;
      req.forEach((el) => {
        const v = el.value.trim();
        const ok = el.name === 'email' ? /^\S+@\S+\.\S+$/.test(v) : el.name === 'phone' ? v.replace(/\D/g, '').length >= 10 : v.length > 1;
        el.classList.toggle('bad', !ok);
        if (!ok && !bad) bad = el;
      });
      if (bad) {
        note.classList.add('err');
        note.textContent = bad.name === 'email' ? 'Enter a valid email address.' : bad.name === 'phone' ? 'Enter a 10-digit mobile number.' : 'Enter your name.';
        bad.focus();
        return;
      }
      note.classList.remove('err');
      const f = form.elements;
      const body = [
        `Name: ${f.name.value}`, `Company: ${f.company.value}`, `Mobile: ${f.phone.value}`, `Email: ${f.email.value}`,
        `City: ${f.city.value}`, `Business type: ${f.type.value}`, `Requirement: ${f.req.value}`, '', f.msg.value,
      ].join('\n');
      location.href = `mailto:partners@chargeui.in?subject=${encodeURIComponent('Business enquiry: ' + f.req.value)}&body=${encodeURIComponent(body)}`;
      note.textContent = 'Your email app should open with the enquiry filled in.';
    });
  }
})();
