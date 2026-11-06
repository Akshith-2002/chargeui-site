(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const inr = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const onView = (el, fn, opts = { threshold: 0.35 }) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(true); return; }
    new IntersectionObserver((entries) => entries.forEach((e) => fn(e.isIntersecting)), opts).observe(el);
  };

  /* ---------- nav: scroll battery ---------- */
  const nav = $('#nav'), fill = $('#batt-fill'), pct = $('#batt-pct'), batt = $('.nav-batt');
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(100, Math.round((scrollY / max) * 100)) : 0;
    fill.style.width = p + '%';
    pct.textContent = p + '%';
    batt.classList.toggle('full', p >= 99);
    nav.classList.toggle('scrolled', scrollY > 8);
  }
  /* ---------- nav: highlight the link for the section in view ---------- */
  const navBar = $('nav', nav);
  const pill = document.createElement('span');
  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  navBar.prepend(pill);
  const links = $$('a[href^="#"]', navBar);
  // Every section in page order; ones without a nav link clear the highlight.
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
    } else {
      pill.classList.remove('on');
    }
  }
  function spy() {
    const line = innerHeight * 0.4;
    let id = null;
    for (const s of spySections) if (s.getBoundingClientRect().top <= line) id = s.id;
    setCurrent(id); // sections with no nav link (Autocharge, devices) clear the highlight
  }
  addEventListener('resize', () => { const id = current; current = null; setCurrent(id); });

  addEventListener('scroll', () => { onScroll(); spy(); }, { passive: true });
  onScroll();
  spy();

  /* ---------- hero: live session ----------
     Raidurg Metro, 120 kW DC, ₹24/kWh + 18% GST = ₹28.32/kWh. ₹500 held.
     12.5 kWh delivered = ₹354.00, so ₹146.00 is refunded. */
  const H = { HOLD: 500, RATE: 28.32, KWH: 12.5, RUN: 7000, PAUSE: 4500, C: 527.8 };
  const live = $('#hero-live');
  if (live) {
    const el = { ring: $('#h-ring'), kwh: $('#h-kwh'), kw: $('#h-kw'), min: $('#h-min'), bat: $('#h-bat'), hold: $('#h-hold'), title: $('#h-title') };
    const ta = $('#toast-a'), tb = $('#toast-b');
    const draw = (k) => {
      el.ring.style.strokeDashoffset = H.C * (1 - k / H.KWH);
      el.kwh.textContent = k.toFixed(1);
      el.min.textContent = Math.round(k / 1.0);
      el.bat.textContent = Math.round(38 + (k / H.KWH) * 33);
    };
    const finish = () => {
      draw(H.KWH);
      el.kw.textContent = '0';
      el.title.textContent = 'Charging complete';
      live.classList.add('done');
      const back = H.HOLD - H.KWH * H.RATE;
      el.hold.textContent = inr(back) + ' refunded to your wallet';
      ta.classList.remove('show');
      tb.classList.add('show');
    };
    const reset = () => {
      live.classList.remove('done');
      el.title.textContent = 'Charging';
      el.hold.textContent = inr(H.HOLD) + ' held from wallet';
      tb.classList.remove('show');
      draw(0);
    };
    if (reduced) { finish(); }
    else {
      const run = () => {
        reset();
        setTimeout(() => ta.classList.add('show'), 500);
        const t0 = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / H.RUN);
          const eased = 1 - Math.pow(1 - t, 1.4);
          draw(H.KWH * eased);
          el.kw.textContent = t < 1 ? String(Math.round(58 + Math.sin(now / 300) * 5 - t * 14)) : '0';
          if (t < 1) requestAnimationFrame(tick);
          else { finish(); setTimeout(run, H.PAUSE); }
        };
        requestAnimationFrame(tick);
      };
      run();
    }
  }

  /* ---------- decorative QR (fixed pseudo-random modules + finder squares) ---------- */
  $$('.qr').forEach((box) => {
    const N = 21; let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    let r = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" fill="#0b1220">${r}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</svg>`;
  });

  /* ---------- story: sticky phone follows the step in view ---------- */
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

  /* ---------- map: sample stations from the app's demo data ---------- */
  const OPS = {
    uic: { name: 'ChargeUI', mono: '⚡', color: 'linear-gradient(135deg,#0065DA,#01C7E7)' },
    pa: { name: 'Partner operator VX', mono: 'VX', color: '#0f9f8f' },
    pb: { name: 'Partner operator AM', mono: 'AM', color: '#ea6c0a' },
    pc: { name: 'Partner operator GR', mono: 'GR', color: '#7c3aed' },
  };
  const ac = (type, kw, price, free, total) => ({ cur: 'AC', type, kw, price, free, total });
  const dc = (type, kw, price, free, total) => ({ cur: 'DC', type, kw, price, free, total });
  const STATIONS = [
    { id: 'hitech', name: 'Hitech City Hub', area: 'HITEC City', op: 'uic', lat: 17.4504, lng: 78.381, hours: 'Open 24×7', rating: 4.2, reviews: 318, photo: 'station-1', amen: ['Café', 'Restroom', 'Wi-Fi', 'Covered parking'], conns: [ac('Type 2', 7.4, 16, 1, 2), dc('CCS2', 60, 21, 3, 4)] },
    { id: 'inorbit', name: 'Inorbit Mall, P2', area: 'Madhapur', op: 'pa', lat: 17.4344, lng: 78.3866, hours: '10 am – 11 pm', rating: 4.0, reviews: 142, photo: 'station-3', amen: ['Food court', 'Shopping', 'Restroom'], conns: [ac('Type 2', 22, 16, 2, 4)] },
    { id: 'kondapur', name: 'Kondapur Metro', area: 'Kondapur', op: 'pb', lat: 17.462, lng: 78.357, hours: 'Open 24×7', rating: 3.6, reviews: 57, photo: 'station-7', amen: ['Metro access', 'CCTV'], conns: [dc('CCS2', 30, 19, 0, 2)] },
    { id: 'raidurg', name: 'Raidurg Metro', area: 'Gachibowli', op: 'pc', lat: 17.4399, lng: 78.3828, hours: 'Open 24×7', rating: 4.4, reviews: 201, photo: 'station-2', amen: ['Metro access', 'Restroom', '24×7 security'], conns: [dc('CCS2', 120, 24, 2, 2), dc('CCS2', 60, 24, 1, 1)] },
    { id: 'gachi', name: 'Gachibowli Stadium', area: 'Gachibowli', op: 'pc', lat: 17.4474, lng: 78.348, hours: '6 am – 10 pm', rating: 4.1, reviews: 88, photo: 'station-5', amen: ['Parking', 'Restroom', 'Food court'], conns: [dc('CCS2', 60, 20, 1, 2), dc('CHAdeMO', 50, 20, 1, 1)] },
    { id: 'banjara', name: 'Banjara Hills Rd 12', area: 'Banjara Hills', op: 'uic', lat: 17.4156, lng: 78.4347, hours: 'Open 24×7', rating: 4.6, reviews: 64, photo: 'station-4', amen: ['Café', 'Two-wheeler bays', 'Wi-Fi'], conns: [dc('CCS2', 60, 21, 2, 2), ac('LEV', 3.3, 14, 2, 2)] },
    { id: 'jubilee', name: 'Jubilee Hills Checkpost', area: 'Jubilee Hills', op: 'pa', lat: 17.4293, lng: 78.4126, hours: 'Open 24×7', rating: 3.9, reviews: 39, photo: 'station-8', amen: ['CCTV', 'Parking'], conns: [dc('CCS2', 60, 23, 1, 2)] },
    { id: 'kokapet', name: 'Kokapet SEZ', area: 'Financial District', op: 'uic', lat: 17.4136, lng: 78.3372, hours: 'Open 24×7', rating: 4.3, reviews: 22, photo: 'station-6', amen: ['Restroom', 'Covered parking', 'Wi-Fi'], conns: [dc('CCS2', 120, 22, 2, 2)] },
  ];
  const FILTERS = {
    all: () => true,
    ac: (s) => s.conns.some((c) => c.cur === 'AC'),
    dc: (s) => s.conns.some((c) => c.cur === 'DC'),
    avail: (s) => s.conns.some((c) => c.free > 0),
    fast: (s) => s.conns.some((c) => c.kw >= 50),
    lev: (s) => s.conns.some((c) => c.type === 'LEV'),
  };
  const pinsBox = $('#pins'), card = $('#stcard'), count = $('#fcount');
  if (pinsBox && card) {
    const pos = (s) => ({ x: ((s.lng - 78.325) / 0.12) * 100, y: ((17.472 - s.lat) / 0.068) * 100 });
    const minPrice = (s) => Math.min(...s.conns.map((c) => c.price));
    const free = (s) => s.conns.reduce((a, c) => a + c.free, 0);
    const logo = (op) => `<span class="pin-logo" style="background:${OPS[op].color}">${OPS[op].mono}</span>`;

    const pins = STATIONS.map((s, i) => {
      const { x, y } = pos(s);
      const b = document.createElement('button');
      b.className = 'pin';
      b.style.left = x + '%';
      b.style.top = y + '%';
      b.style.animationDelay = i * 70 + 'ms';
      b.setAttribute('aria-label', `${s.name}, ${free(s)} connectors free, from ₹${minPrice(s)} per kWh`);
      b.innerHTML = `<span class="pin-head">${logo(s.op)}<span class="pin-price">₹${minPrice(s)}</span><span class="pin-dot ${free(s) > 0 ? 'ok' : 'busy'}"></span></span><span class="pin-tail"></span>`;
      b.addEventListener('click', () => select(s.id));
      pinsBox.appendChild(b);
      return b;
    });

    function select(id) {
      const s = STATIONS.find((x) => x.id === id);
      pins.forEach((p, k) => p.classList.toggle('sel', STATIONS[k].id === id));
      const any = free(s) > 0;
      card.innerHTML = `
        <img src="assets/photos/${s.photo}.jpg" alt="Charging bay at ${s.name} (sample photo)">
        <div class="st-body">
          <div class="st-op">${logo(s.op)}${OPS[s.op].name}</div>
          <h3>${s.name}</h3>
          <p class="st-meta">${s.area} · ${s.hours} · <span style="color:#f5b301">★</span> ${s.rating} (${s.reviews})</p>
          <div class="conns">${s.conns.map((c) => `<div class="conn"><span><b>${c.cur} · ${c.type} ${c.kw} kW</b><br><span class="st-meta">₹${c.price}/kWh + GST</span></span><em class="${c.free ? 'ok' : 'none'}">${c.free}/${c.total} free</em></div>`).join('')}</div>
          <div class="st-tags">${s.amen.map((a) => `<span>${a}</span>`).join('')}</div>
          <button class="st-cta ${any ? '' : 'notify'}" tabindex="-1">${any ? 'Charge here' : 'Notify me when free'}</button>
        </div>`;
    }

    $$('.fchip').forEach((chip) => chip.addEventListener('click', () => {
      $$('.fchip').forEach((c) => c.classList.toggle('on', c === chip));
      const f = FILTERS[chip.dataset.f];
      let n = 0, first = null;
      STATIONS.forEach((s, k) => {
        const ok = f(s);
        pins[k].classList.toggle('hide', !ok);
        if (ok) { n++; first = first || s.id; }
      });
      count.textContent = n + (n === 1 ? ' station' : ' stations');
      const sel = STATIONS.findIndex((s, k) => pins[k].classList.contains('sel'));
      if (sel < 0 || pins[sel].classList.contains('hide')) { if (first) select(first); }
    }));

    select('raidurg');
    if (!reduced) {
      let dropped = false;
      onView($('#mapbox'), (v) => { if (v && !dropped) { dropped = true; pins.forEach((p) => p.classList.add('drop')); } }, { threshold: 0.3 });
    }
  }

  /* ---------- wallet: rows slide in, balance counts up ---------- */
  const ledger = $('#ledger'), bal = $('#bal');
  if (ledger) {
    const target = parseFloat(bal.dataset.to);
    if (reduced) { bal.textContent = inr(target); }
    else {
      ledger.classList.add('anim');
      let done = false;
      onView(ledger, (v) => {
        if (!v || done) return;
        done = true;
        ledger.classList.add('in');
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / 1400);
          bal.textContent = inr(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
  }

  /* ---------- hands-free tiles: replay while visible ---------- */
  $$('.hand-art').forEach((art) => {
    if (reduced) { art.classList.add('go'); return; }
    let timer = null;
    const cycle = () => {
      art.classList.remove('go');
      void art.offsetWidth;
      setTimeout(() => art.classList.add('go'), 300);
    };
    onView(art, (v) => {
      clearInterval(timer);
      if (v) { cycle(); timer = setInterval(cycle, 5200); }
    }, { threshold: 0.5 });
  });

  /* ---------- admin screen: settles flat as it scrolls in ---------- */
  const adminShot = $('#admin');
  if (adminShot) {
    if (reduced) adminShot.classList.add('in');
    else onView(adminShot, (v) => { if (v) adminShot.classList.add('in'); }, { threshold: 0.2 });
  }
})();
