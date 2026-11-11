// Legal pages: scroll battery in the header and table-of-contents highlight.
(function () {
  'use strict';
  const nav = document.getElementById('nav'), fill = document.getElementById('batt-fill'), pct = document.getElementById('batt-pct');
  const batt = document.querySelector('.nav-batt');
  const links = [...document.querySelectorAll('.lg-toc a')];
  const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(100, Math.round((scrollY / max) * 100)) : 0;
    fill.style.width = p + '%'; pct.textContent = p + '%';
    batt.classList.toggle('full', p >= 99);
    nav.classList.toggle('scrolled', scrollY > 8);
    let cur = 0;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= 140) cur = i; });
    links.forEach((a, i) => { a.classList.toggle('on', i === cur); if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
