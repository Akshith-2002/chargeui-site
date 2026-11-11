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

  /* ---------- USP 1: dynamic AC load management ----------
     Wiring view: an LT panel sits between two rows of bays with a cable to each charger.
     Current flows along each cable (thicker and faster with more kW). Auto loop:
     a car drives in, asks for full power and the site goes over its limit; sparks carry
     power from the other cars down their cables, along the panel bus and up to the new car.
     Later the fullest car finishes, its power flows back to the others and it drives off.
     Any tap or control change stops the loop for manual play. */
  const lb = $('#lb');
  if (lb) {
    const MAX_KW = 7.4, N = 6, SCALE = 44.4;
    const bayBox = $('#lb-bays'), toggle = $('#lb-toggle'), range = $('#lb-limit'), playBtn = $('#lb-play');
    const out = $('#lb-limit-out'), totalEl = $('#lb-total'), limitV = $('#lb-limit-v'), fillEl = $('#lb-fill'), mark = $('#lb-limit-mark'), msg = $('#lb-msg');
    const stepEls = $$('#lb-steps li');
    const names = ['A-101', 'A-204', 'B-002', 'B-305', 'C-110', 'C-402'];
    const state = Array(N).fill(false);
    const shown = Array(N).fill(0);
    const soc = Array(N).fill(0);
    let shownTotal = 0, pending = -1, arriving = -1, leaving = -1;
    let auto = false, visible = false, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    // --- layout: bays 1-3, panel bus, bays 4-6; SVG wires underneath; sparks layer on top
    const NS = 'http://www.w3.org/2000/svg';
    const wires = document.createElementNS(NS, 'svg');
    wires.setAttribute('class', 'lb-wires');
    wires.setAttribute('aria-hidden', 'true');
    const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); wires.appendChild(p); return p; };
    const busBase = mk('w-base w-bus'), wBase = names.map(() => mk('w-base'));
    const busL = mk('w-flow'), busR = mk('w-flow'), wFlow = names.map(() => mk('w-flow'));
    bayBox.appendChild(wires);

    const bus = document.createElement('div');
    bus.className = 'lb-bus';
    bus.innerHTML = '<span class="lbp"><i class="lbp-led"></i><span>LT panel</span><b id="lb-bus-lim">22 kW max</b></span>';
    const busLim = $('#lb-bus-lim', bus) || bus.querySelector('b');

    const bays = names.map((n, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bay';
      b.innerHTML = `<span class="bay-id"><span>Bay ${i + 1}</span><span>Flat ${n}</span></span>
        <span class="bay-car"><svg class="bay-scene" viewBox="0 0 260 100" aria-hidden="true">
          <rect x="0" y="96" width="260" height="4" class="bs-floor"/>
          <g class="wc"><rect x="168" y="4" width="26" height="34" rx="5" class="wc-box"/><rect x="173" y="10" width="16" height="10" rx="2" class="wc-scr"/><circle cx="181" cy="28" r="3" class="wc-led"/></g>
          <path class="wc-holster" d="M181 38 C 181 52, 172 58, 186 62"/>
          <g class="ev-g"><use href="#ev-car" x="40" y="20" width="180" height="80"/></g>
          <path class="wc-cable" d="M181 38 C 182 52, 190 62, 199 68"/>
        </svg></span>
        <span class="bay-empty">Empty</span>
        <span class="bay-tag" aria-hidden="true"></span>
        <span class="bay-row"><span class="bay-kw"><span class="kw">0.0</span><small>kW</small></span><span class="bay-soc"><i class="bat"><i></i></i><span class="pct">0%</span></span></span>
        <span class="bay-bar"><i></i></span>`;
      b.addEventListener('click', () => {
        stopAuto();
        state[i] = !state[i];
        if (state[i] && soc[i] < 5) { soc[i] = 20 + Math.round(Math.random() * 20); paintSoc(i); }
        render();
      });
      return b;
    });
    bays.slice(0, 3).forEach((b) => bayBox.appendChild(b));
    bayBox.appendChild(bus);
    bays.slice(3).forEach((b) => bayBox.appendChild(b));
    const fx = document.createElement('div');
    fx.className = 'lb-fx';
    fx.setAttribute('aria-hidden', 'true');
    bayBox.appendChild(fx);

    function geo() {
      const box = bayBox.getBoundingClientRect(), br = bus.getBoundingClientRect();
      const y = br.top - box.top + br.height / 2;
      const pts = bays.map((b, i) => {
        const r = b.getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, edge: i < 3 ? r.bottom - box.top : r.top - box.top };
      });
      const cx = br.left - box.left + br.width / 2;
      return { w: box.width, h: box.height, y, cx, pts };
    }
    function drawWires() {
      const g = geo();
      wires.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
      const xs = g.pts.map((p) => p.x), xmin = Math.min(...xs), xmax = Math.max(...xs);
      busBase.setAttribute('d', `M${xmin} ${g.y} L${xmax} ${g.y}`);
      busL.setAttribute('d', `M${g.cx} ${g.y} L${xmin} ${g.y}`);
      busR.setAttribute('d', `M${g.cx} ${g.y} L${xmax} ${g.y}`);
      g.pts.forEach((p, i) => {
        const d = `M${p.x} ${g.y} L${p.x} ${p.edge}`;
        wBase[i].setAttribute('d', d);
        wFlow[i].setAttribute('d', d);
      });
    }
    const setFlow = (p, k, on) => {
      p.classList.toggle('on', on);
      p.style.strokeWidth = (1.6 + k * 0.42).toFixed(2);
      p.style.animationDuration = Math.max(0.35, 1.5 - k * 0.15).toFixed(2) + 's';
    };

    const paintSoc = (i) => {
      $('.pct', bays[i]).textContent = Math.round(soc[i]) + '%';
      $('.bat i', bays[i]).style.width = soc[i] + '%';
    };

    const tween = (el, from, to, ms = 700) => {
      cancelAnimationFrame(el._raf);
      if (reduced || Math.abs(to - from) < 0.05) { el.textContent = to.toFixed(1); return; }
      const t0 = performance.now();
      const stepFn = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (from + (to - from) * e).toFixed(1);
        if (k < 1) el._raf = requestAnimationFrame(stepFn);
      };
      el._raf = requestAnimationFrame(stepFn);
    };
    const fairShare = (n, limit, on) => (n ? (on ? Math.min(MAX_KW, limit / n) : MAX_KW) : 0);

    function render(note) {
      const limit = +range.value;
      const on = toggle.checked;
      const settled = state.map((s, i) => s && i !== pending && i !== arriving);
      const n = settled.filter(Boolean).length;
      const share = fairShare(n, limit, on);
      const kw = state.map((s, i) => (!s || i === arriving ? 0 : i === pending ? MAX_KW : pending >= 0 ? shown[i] : share));
      const total = kw.reduce((a, b) => a + b, 0);
      out.textContent = limit + ' kW';
      limitV.textContent = limit;
      busLim.textContent = limit + ' kW max';
      tween(totalEl, shownTotal, total);
      shownTotal = total;
      fillEl.style.width = Math.min(100, (total / SCALE) * 100) + '%';
      mark.style.left = (limit / SCALE) * 100 + '%';
      const over = total > limit + 0.01;
      lb.classList.toggle('over', over);
      lb.classList.toggle('ok', !over && n > 0);
      bays.forEach((b, i) => {
        b.classList.toggle('on', state[i]);
        b.classList.toggle('asking', i === pending);
        b.setAttribute('aria-label', `Bay ${i + 1}, ${state[i] ? 'car charging at ' + kw[i].toFixed(1) + ' kilowatts' : 'empty'}. Tap to ${state[i] ? 'unplug' : 'plug in'}.`);
        tween($('.kw', b), shown[i], kw[i]);
        shown[i] = kw[i];
        $('.bay-bar i', b).style.width = (kw[i] / MAX_KW) * 100 + '%';
        if (state[i]) paintSoc(i);
      });
      drawWires();
      [busL, busR].forEach((p) => setFlow(p, Math.min(MAX_KW, total / 2.5), total > 0.05));
      wFlow.forEach((p, i) => { setFlow(p, kw[i], kw[i] > 0.05); p.classList.toggle('ask', i === pending); });
      const all = state.filter(Boolean).length;
      if (note) msg.textContent = note;
      else if (!all) msg.textContent = 'Tap a bay to plug a car in.';
      else if (over) msg.textContent = `${total.toFixed(1)} kW is over the ${limit} kW limit. Without load management the main breaker trips and every car stops charging.`;
      else if (on && share < MAX_KW) msg.textContent = `${all} cars sharing ${limit} kW at ${share.toFixed(1)} kW each. Nothing trips, everyone charges.`;
      else msg.textContent = `${all} car${all > 1 ? 's' : ''} charging at full ${MAX_KW} kW. Within the limit.`;
    }

    // Sparks travel down the donor's cable, along the panel bus and up the receiver's cable.
    function sparks(from, to, n = 6) {
      if (reduced) return;
      const g = geo(), a = g.pts[from], b = g.pts[to];
      const P = [[a.x, a.edge], [a.x, g.y], [b.x, g.y], [b.x, b.edge]];
      const seg = [1, 2, 3].map((k) => Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
      const L = seg.reduce((x, y) => x + y, 0) || 1;
      let acc = 0;
      const offs = [0, ...seg.map((s) => (acc += s) / L)];
      offs[3] = 1;
      for (let k = 0; k < n; k++) {
        const s = document.createElement('span');
        s.className = 'spark';
        fx.appendChild(s);
        const anim = s.animate(P.map((p, j) => ({
          transform: `translate(${p[0]}px, ${p[1]}px) scale(${j === 0 || j === 3 ? 0.6 : 1})`,
          opacity: j === 0 ? 0 : j === 3 ? 0.2 : 1,
          offset: offs[j],
        })), { duration: 600 + L * 1.6, delay: k * 90, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' });
        anim.onfinish = () => s.remove();
      }
      bays[from].classList.add('give');
      bays[to].classList.add('gain');
      later(() => { bays[from].classList.remove('give'); bays[to].classList.remove('gain'); }, 1600);
    }

    const setStep = (k, warn) => stepEls.forEach((el, i) => { el.classList.toggle('on', i === k); el.classList.toggle('warn', i === k && !!warn); });
    const label = (i) => `Bay ${i + 1}`;
    const list = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);
    const onBays = () => state.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);

    let nextBay = 1, step = 0;
    const PLAN = ['arrive', 'arrive', 'depart', 'depart'];

    function resetScene() {
      timers.forEach(clearTimeout); timers = [];
      fx.textContent = '';
      bays.forEach((b) => b.classList.remove('arrive', 'depart', 'give', 'gain', 'asking', 'done'));
      pending = arriving = leaving = -1;
      range.value = 22; toggle.checked = true;
      state.fill(false); soc.fill(0);
      [[0, 64], [2, 43], [4, 28]].forEach(([i, v]) => { state[i] = true; soc[i] = v; });
      nextBay = 1; step = 0;
      setStep(-1);
      render();
    }

    function arrive() {
      let k = nextBay;
      for (let j = 0; j < N && state[k]; j++) k = (k + 1) % N;
      nextBay = (k + 2) % N;
      const donors = onBays();
      const limit = +range.value;
      const before = fairShare(donors.length, limit, true);
      const after = fairShare(donors.length + 1, limit, true);
      state[k] = true; arriving = k;
      soc[k] = 18 + Math.round(Math.random() * 14);
      $('.bay-tag', bays[k]).textContent = `Needs ${MAX_KW} kW`;
      bays[k].classList.add('arrive');
      setStep(0);
      render(`A car pulls into ${label(k)} and plugs in.`);
      later(() => {
        arriving = -1; pending = k;
        setStep(1, true);
        render(`${label(k)} asks for the full ${MAX_KW} kW. The site would draw ${(before * donors.length + MAX_KW).toFixed(1)} kW, over its ${limit} kW limit.`);
        later(() => {
          setStep(2);
          donors.forEach((d, j) => later(() => sparks(d, k), j * 180));
          later(() => {
            pending = -1;
            bays[k].classList.remove('arrive');
            render(`ChargeUI moves ${(before - after).toFixed(1)} kW from each of ${list(donors.map(label))} to ${label(k)}. ${donors.length + 1} cars now share ${limit} kW at ${after.toFixed(1)} kW each.`);
          }, 700);
        }, 1700);
      }, 1000);
    }

    function depart() {
      const cars = onBays();
      const k = cars.reduce((a, b) => (soc[b] > soc[a] ? b : a), cars[0]);
      const rest = cars.filter((i) => i !== k);
      const limit = +range.value;
      const after = fairShare(rest.length, limit, true);
      leaving = k;
      setStep(3);
      const from = soc[k], t0 = performance.now();
      const fill = (now) => {
        const e = Math.min(1, (now - t0) / 800);
        soc[k] = from + (100 - from) * e; paintSoc(k);
        if (e < 1 && leaving === k) requestAnimationFrame(fill);
      };
      requestAnimationFrame(fill);
      later(() => {
        bays[k].classList.add('done');
        $('.bay-tag', bays[k]).textContent = 'Fully charged';
        msg.textContent = `${label(k)} is fully charged and unplugs. Its ${shown[k].toFixed(1)} kW goes back to the ${rest.length} cars still charging.`;
        later(() => {
          rest.forEach((r, j) => later(() => sparks(k, r), j * 180));
          later(() => {
            bays[k].classList.add('depart');
            state[k] = false; leaving = -1; soc[k] = 0;
            render(`${rest.length} cars now share ${limit} kW at ${after.toFixed(1)} kW each.`);
            later(() => bays[k].classList.remove('done', 'depart'), 900);
          }, 700);
        }, 900);
      }, 800);
    }

    function tick() {
      if (!auto) return;
      if (!visible) { later(tick, 800); return; }
      let what = PLAN[step % PLAN.length];
      const count = onBays().length;
      if (what === 'arrive' && count >= 5) what = 'depart';
      if (what === 'depart' && count <= 2) what = 'arrive';
      step++;
      if (what === 'arrive') { arrive(); later(tick, 6400); } else { depart(); later(tick, 5600); }
    }

    function startAuto() {
      auto = true;
      playBtn.hidden = true;
      msg.setAttribute('aria-live', 'off');
      lb.classList.add('auto');
      resetScene();
      later(tick, 1500);
    }
    function stopAuto() {
      if (!auto) return;
      auto = false;
      timers.forEach(clearTimeout); timers = [];
      fx.textContent = '';
      pending = arriving = leaving = -1;
      bays.forEach((b) => b.classList.remove('arrive', 'depart', 'give', 'gain', 'asking', 'done'));
      setStep(-1);
      msg.setAttribute('aria-live', 'polite');
      lb.classList.remove('auto');
      playBtn.hidden = false;
    }

    // Batteries fill while cars charge (only while the demo is on screen).
    setInterval(() => {
      if (!visible || reduced) return;
      state.forEach((s, i) => {
        if (!s || i === arriving || i === leaving) return;
        soc[i] = Math.min(97, soc[i] + shown[i] * 0.06);
        paintSoc(i);
      });
    }, 300);

    toggle.addEventListener('change', () => { stopAuto(); render(); });
    range.addEventListener('input', () => { stopAuto(); render(); });
    playBtn.addEventListener('click', startAuto);
    if ('ResizeObserver' in window) new ResizeObserver(() => drawWires()).observe(bayBox);
    addEventListener('load', drawWires);

    if (reduced) {
      [[0, 64], [1, 30], [2, 43], [4, 28]].forEach(([i, v]) => { state[i] = true; soc[i] = v; });
      render();
    } else {
      render();
      let started = false;
      onView(lb, (v) => {
        visible = v;
        if (v && !started) { started = true; startAuto(); }
      }, { threshold: 0 });
    }
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
    const PATHS = ['dashboard', 'analytics', 'alarms', 'transactions', 'assets/stations', 'sessions', 'tickets', 'broadcasts'];
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

  /* ---------- user app story: sticky phone follows the step in view ---------- */
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
      'The LT panel distributes power to each charger through MCCB and RCD protection.',
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
