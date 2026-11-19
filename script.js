/* =========================================================
   VOLTA — Hair Lab  |  script.js
   Inga beroenden. 3D-flaskor byggs med CSS 3D (ren DOM).
   ========================================================= */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const fmt = n => n.toLocaleString('sv-SE') + ' kr';
  try { history.scrollRestoration = 'manual'; } catch (e) {}

  /* ------------------------------------------------------
     PRODUKTDATA (exempel – byt ut mot era riktiga produkter)
     ------------------------------------------------------ */
  const PRODUCTS = [
    { id: 'static',    name: 'Static',    type: 'Shampoo',       vol: '250 ml', price: 229, color: '#c8ff3d', ink: '#0b0a10', tag: 'Rengör',
      step: 'Tvätta',   copy: 'Skummar upp som en åskkväll. Citrusskarp start på dagen — rent och redo.' },
    { id: 'surge',     name: 'Surge',     type: 'Repair Mask',   vol: '200 ml', price: 289, color: '#7a4dff', ink: '#ffffff', tag: 'Återställ',
      step: 'Återställ', copy: 'Tung, len mask för hår som levt livet. Låt verka, skölj, gå vidare.' },
    { id: 'gravity',   name: 'Gravity',   type: 'Texture Spray', vol: '150 ml', price: 219, color: '#ff4d6d', ink: '#ffffff', tag: 'Forma',
      step: 'Forma',    copy: 'Grepp och volym utan stelhet. Spraya, rufsa, gå ut genom dörren.' },
    { id: 'afterglow', name: 'Afterglow', type: 'Shine Oil',     vol: '50 ml',  price: 259, color: '#ffb23d', ink: '#0b0a10', tag: 'Glans',
      step: 'Glans',    copy: 'Några droppar i topparna. Slutpunkten som fångar ljuset.' }
  ];

  /* ------------------------------------------------------
     3D-FLASKA (cylindrar byggda av tunna skivor)
     ------------------------------------------------------ */
  const R = 64, BH = 210;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(lerp(r, t, p)); g = Math.round(lerp(g, t, p)); b = Math.round(lerp(b, t, p));
    return `rgb(${r},${g},${b})`;
  }

  function labelURL(p, idx, circ) {
    const W = +circ.toFixed(1), cx = W / 2, ink = p.ink;
    const font = "font-family='Arial Black,Impact,Arial,sans-serif'";
    const name = p.name.toUpperCase();
    const size = Math.min(36, 175 / (name.length * 0.78));
    const face = x => `
      <text x='${x}' y='34' text-anchor='middle' ${font} font-size='10' letter-spacing='3' fill='${ink}'>VOLTA HAIR LAB</text>
      <rect x='${x - 42}' y='46' width='84' height='2' fill='${ink}'/>
      <text x='${x}' y='104' text-anchor='middle' ${font} font-size='${size.toFixed(1)}' fill='${ink}'>${name}</text>
      <text x='${x}' y='126' text-anchor='middle' ${font} font-size='11' letter-spacing='2' fill='${ink}'>${p.type.toUpperCase()}</text>
      <path d='M${x + 6} 140 l-15 24 h10 l-4 17 l16 -25 h-10 z' fill='${ink}'/>
      <text x='${x}' y='196' text-anchor='middle' ${font} font-size='10' letter-spacing='2' fill='${ink}'>${p.vol.toUpperCase()}</text>`;
    const back = x => `<text x='${x}' y='128' text-anchor='middle' ${font} font-size='84' fill='${ink}' opacity='.16'>0${idx + 1}</text>`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${BH}' viewBox='0 0 ${W} ${BH}'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${shade(p.color, .12)}'/><stop offset='1' stop-color='${shade(p.color, -.28)}'/></linearGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/>${face(cx)}${back(0)}${back(W)}</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function cyl({ r, h, top, n = 24, bg, img, circ, cap }) {
    const el = document.createElement('div');
    el.className = 'cyl';
    el.style.top = top + 'px';
    el.style.height = h + 'px';
    const w = (2 * Math.PI * r) / n;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.style.width = (w + 0.9) + 'px';
      s.style.height = h + 'px';
      s.style.marginLeft = (-(w + 0.9) / 2) + 'px';
      s.style.transform = `rotateY(${(i * 360) / n}deg) translateZ(${r}px)`;
      s.style.backgroundColor = bg;
      if (img) {
        s.style.backgroundImage = `url("${img}")`;
        s.style.backgroundSize = `${circ}px ${h}px`;
        s.style.backgroundRepeat = 'repeat-x';
        s.style.backgroundPositionX = (circ / 2 - i * w) + 'px';
      }
      el.appendChild(s);
    }
    [0, 1].forEach(k => {
      const d = document.createElement('b');
      d.className = 'disc';
      d.style.cssText = `width:${2 * r}px;height:${2 * r}px;left:${-r}px;top:${(k ? h : 0) - r}px;background:${cap || bg}`;
      el.appendChild(d);
    });
    return el;
  }

  function buildBottle(p, idx) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const b = document.createElement('div');
    b.className = 'bottle';
    const circ = 2 * Math.PI * R;
    const img = labelURL(p, idx, circ);
    const nozzle = cyl({ r: 6, h: 40, top: -72, n: 12, bg: '#0d0b12' });
    nozzle.style.transform = 'translateX(28px) rotateZ(90deg)';
    b.append(
      cyl({ r: R, h: BH, top: 0, n: 32, bg: p.color, img, circ, cap: shade(p.color, -.4) }),
      cyl({ r: 31, h: 16, top: -16, n: 20, bg: '#c9c9d3', cap: '#e6e6ee' }),
      cyl({ r: 9,  h: 26, top: -42, n: 12, bg: '#15131c' }),
      cyl({ r: 22, h: 16, top: -58, n: 20, bg: '#0d0b12', cap: '#1d1a27' }),
      nozzle
    );
    slot.appendChild(b);
    slot._b = b;
    return slot;
  }

  function setRot(slot, rx, ry, rz = 0) {
    slot._b.style.transform = `translateY(-105px) rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }

  function mountScene(scene, slots) {
    slots.forEach(s => scene.appendChild(s));
    const sh = document.createElement('i');
    sh.className = 'shade';
    scene.appendChild(sh);
  }

  /* ------------------------------------------------------
     TEXT-SPLIT & REVEAL
     ------------------------------------------------------ */
  function split(el) {
    let k = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok.trim()) { frag.append(tok); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = tok;
            s.style.setProperty('--d', (k++ * 70) + 'ms');
            w.append(s); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }
  $$('[data-split]').forEach(split);

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .18 });
  $$('.reveal, .shop__head, .join__card h2').forEach(el => io.observe(el));

  // count-up
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || '';
    const t0 = performance.now();
    const run = now => {
      const p = clamp((now - t0) / 1500);
      el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * to) + suf;
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* ------------------------------------------------------
     HERO-FLASKA
     ------------------------------------------------------ */
  const heroScene = $('#heroScene');
  const heroSlot = buildBottle(PRODUCTS[0], 0);
  heroSlot.style.opacity = 1;
  mountScene(heroScene, [heroSlot]);

  const hero = { drag: 0, vel: 0, down: false, lastX: 0 };
  const stage = $('#heroStage');
  stage.addEventListener('pointerdown', e => { hero.down = true; hero.lastX = e.clientX; });
  addEventListener('pointerup', () => { hero.down = false; });
  addEventListener('pointermove', e => {
    if (!hero.down) return;
    const dx = e.clientX - hero.lastX; hero.lastX = e.clientX;
    hero.drag += dx * .6; hero.vel = dx * .6;
  });

  /* ------------------------------------------------------
     PRODUKTKORT
     ------------------------------------------------------ */
  const track = $('#track');
  const cards = PRODUCTS.map((p, i) => {
    const el = document.createElement('article');
    el.className = 'card';
    el.style.setProperty('--c', p.color);
    el.style.setProperty('--ink-on', p.ink);
    el.innerHTML = `
      <span class="card__n">0${i + 1}</span>
      <span class="card__tag">${p.tag}</span>
      <div class="card__stage"><div class="float" style="animation-delay:${-i * 1.3}s"><div class="scene"></div></div></div>
      <div class="card__info"><div><h3>${p.name}</h3><p>${p.type} · ${p.vol}</p></div><strong>${fmt(p.price)}</strong></div>
      <p class="card__copy">${p.copy}</p>
      <button class="btn btn--fill magnetic" data-add="${p.id}"><span>Lägg i väska</span></button>`;
    const scene = $('.scene', el);
    scene.style.setProperty('--glow', p.color + '66');
    const slot = buildBottle(p, i);
    mountScene(scene, [slot]);
    track.appendChild(el);

    const c = { el, slot, i, hx: 0, hy: 0, cx: 0, cy: 0, vis: false };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      c.hx = (e.clientX - r.left) / r.width - .5;
      c.hy = (e.clientY - r.top) / r.height - .5;
    });
    el.addEventListener('pointerleave', () => { c.hx = 0; c.hy = 0; });
    return c;
  });
  const cardIO = new IntersectionObserver(es => es.forEach(e => {
    const c = cards.find(x => x.el === e.target); if (c) c.vis = e.isIntersecting;
  }), { rootMargin: '200px' });
  cards.forEach(c => cardIO.observe(c.el));

  /* ------------------------------------------------------
     RITUAL (4 flaskor, scroll styr rotation + steg)
     ------------------------------------------------------ */
  const ritualScene = $('#ritualScene');
  const rSlots = PRODUCTS.map((p, i) => buildBottle(p, i));
  rSlots.forEach(s => { s.style.opacity = 0; s.style.visibility = 'hidden'; });
  mountScene(ritualScene, rSlots);

  const stepsEl = $('#steps');
  const steps = PRODUCTS.map((p, i) => {
    const el = document.createElement('article');
    el.className = 'step';
    el.style.setProperty('--c', p.color);
    el.style.setProperty('--ink-on', p.ink);
    el.innerHTML = `
      <div class="step__n">0${i + 1}</div>
      <h3>${p.step} med <em>${p.name}</em></h3>
      <p>${p.copy}</p>
      <button class="btn btn--fill" data-add="${p.id}"><span>Lägg i väska — ${fmt(p.price)}</span></button>`;
    stepsEl.appendChild(el);
    return el;
  });
  let activeStep = -1;
  function setStep(i) {
    if (i === activeStep) return;
    activeStep = i;
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    rSlots.forEach((s, k) => {
      s.style.opacity = k === i ? 1 : 0;
      s.style.visibility = k === i ? 'visible' : 'hidden';
    });
    $('#stepNum').textContent = '0' + (i + 1);
    $('#ritualPin').style.setProperty('--c', PRODUCTS[i].color);
    ritualScene.style.setProperty('--glow', PRODUCTS[i].color + '77');
  }

  /* ------------------------------------------------------
     MANIFEST (ord tänds vid scroll)
     ------------------------------------------------------ */
  const mtext = $('#mtext');
  const words = [];
  (function () {
    const raw = mtext.textContent.trim();
    mtext.textContent = '';
    let hl = false;
    raw.split(/\s+/).forEach(tok => {
      let t = tok;
      if (t.startsWith('*')) { hl = true; t = t.slice(1); }
      const end = t.endsWith('*') || t.endsWith('*.') || t.endsWith('*,');
      t = t.replace(/\*/g, '');
      const s = document.createElement('span');
      s.textContent = t + ' ';
      if (hl) s.className = 'hl';
      mtext.appendChild(s);
      words.push(s);
      if (end) hl = false;
    });
  })();

  /* ------------------------------------------------------
     VÄSKA
     ------------------------------------------------------ */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('volta-cart') || '[]'); } catch (e) { cart = []; }
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  function saveCart() { try { localStorage.setItem('volta-cart', JSON.stringify(cart)); } catch (e) {} }
  function renderCart() {
    const list = $('#cartList');
    const count = cart.reduce((a, i) => a + i.q, 0);
    $('#cartCount').textContent = count;
    if (!cart.length) {
      list.innerHTML = '<p class="cart__empty">Din väska är tom. Ladda upp med något från dropen.</p>';
    } else {
      list.innerHTML = cart.map(it => {
        const p = PRODUCTS.find(x => x.id === it.id);
        return `<div class="item" style="--c:${p.color}">
          <div class="item__sw"></div>
          <div><h4>${p.name}</h4><p>${p.type} · ${p.vol}</p>
            <div class="qty"><button data-q="-1" data-id="${p.id}" aria-label="Minska">−</button><span>${it.q}</span><button data-q="1" data-id="${p.id}" aria-label="Öka">+</button></div></div>
          <strong>${fmt(p.price * it.q)}</strong></div>`;
      }).join('');
    }
    const total = cart.reduce((a, it) => a + PRODUCTS.find(x => x.id === it.id).price * it.q, 0);
    $('#cartTotal').textContent = fmt(total);
  }
  function addToCart(id) {
    const it = cart.find(i => i.id === id);
    it ? it.q++ : cart.push({ id, q: 1 });
    saveCart(); renderCart();
    const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    toast(PRODUCTS.find(p => p.id === id).name + ' ligger i väskan ⚡');
  }
  function changeQty(id, d) {
    const it = cart.find(i => i.id === id); if (!it) return;
    it.q += d;
    if (it.q <= 0) cart = cart.filter(i => i.id !== id);
    saveCart(); renderCart();
  }
  function openCart(open) {
    document.body.classList.toggle('cart-open', open);
    $('#cart').setAttribute('aria-hidden', String(!open));
  }
  // OBS: Ingen riktig betalning är kopplad. Här kopplar ni på kassan
  // (t.ex. Swish/Stripe/Klarna eller beställning via e-post) när det är dags.
  function checkout() {
    if (!cart.length) { toast('Väskan är tom'); return; }
    toast('Demo: kassan är inte kopplad än — se checkout() i script.js');
  }

  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { addToCart(add.dataset.add); return; }
    const q = e.target.closest('[data-q]');
    if (q) changeQty(q.dataset.id, +q.dataset.q);
  });
  $('#cartBtn').addEventListener('click', () => openCart(true));
  $('#cartClose').addEventListener('click', () => openCart(false));
  $('#scrim').addEventListener('click', () => openCart(false));
  $('#checkout').addEventListener('click', checkout);
  addEventListener('keydown', e => { if (e.key === 'Escape') { openCart(false); setMenu(false); } });
  renderCart();

  /* ------------------------------------------------------
     MENY, NYHETSBREV
     ------------------------------------------------------ */
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    $('#burger').setAttribute('aria-expanded', String(open));
  }
  $('#burger').addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#email').value.trim(), msg = $('#joinMsg');
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    msg.className = 'join__msg ' + (ok ? 'ok' : 'err');
    if (!ok) { msg.textContent = 'Skriv en giltig e-postadress.'; return; }
    // TODO: skicka v till er e-posttjänst (Mailchimp, Brevo, Klaviyo …)
    msg.textContent = 'Tack! Du är med. (Demo – koppla en e-posttjänst för riktig anmälan.)';
    $('#email').value = '';
  });

  /* ------------------------------------------------------
     KURSOR + MAGNETISKA KNAPPAR
     ------------------------------------------------------ */
  const cur = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
  const mouse = { x: 0, y: 0, nx: 0, ny: 0, px: -999, py: -999 };
  const dot = $('#curDot'), ring = $('#curRing');
  if (!coarse) document.body.classList.add('has-cursor');
  addEventListener('pointermove', e => {
    cur.x = e.clientX; cur.y = e.clientY;
    mouse.nx = e.clientX / innerWidth - .5; mouse.ny = e.clientY / innerHeight - .5;
    mouse.px = e.clientX; mouse.py = e.clientY;
    ring.classList.toggle('hover', !!e.target.closest('a,button,input,.card'));
  });
  $$('.magnetic').forEach(b => {
    b.addEventListener('pointermove', e => {
      if (coarse) return;
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  /* ------------------------------------------------------
     PARTIKLAR (canvas)
     ------------------------------------------------------ */
  const cv = $('#fx'), cx = cv.getContext('2d');
  let W, H, DPR, parts = [];
  const PAL = ['200,255,61', '122,77,255', '255,77,109'];
  function resizeCanvas() {
    DPR = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
    const n = innerWidth < 700 ? 34 : 70;
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .3 * DPR, vy: (Math.random() - .5) * .3 * DPR,
      r: (Math.random() * 1.8 + .6) * DPR, c: PAL[(Math.random() * PAL.length) | 0]
    }));
  }
  function drawFx() {
    cx.clearRect(0, 0, W, H);
    cx.globalCompositeOperation = 'lighter';
    const mx = mouse.px * DPR, my = mouse.py * DPR, link = 120 * DPR;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
      if (d < 160 * DPR && d > 0) { p.vx += (dx / d) * .02 * DPR; p.vy += (dy / d) * .02 * DPR; }
      p.vx *= .995; p.vy *= .995;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      cx.fillStyle = `rgba(${p.c},.8)`;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
      for (let j = i + 1; j < parts.length; j++) {
        const q = parts[j], l = Math.hypot(p.x - q.x, p.y - q.y);
        if (l < link) {
          cx.strokeStyle = `rgba(${p.c},${(1 - l / link) * .22})`;
          cx.lineWidth = DPR * .8;
          cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke();
        }
      }
    }
  }

  /* ------------------------------------------------------
     MÄTNING AV SEKTIONER (för scroll-progress)
     ------------------------------------------------------ */
  const shop = $('#shop'), ritual = $('#ritual'), manifest = $('#manifest');
  const M = {};
  let shopDist = 0;
  function measure() {
    if (innerWidth < 900) {
      shop.style.height = ''; shop.classList.add('native'); shopDist = 0;
    } else {
      shop.classList.remove('native');
      shopDist = Math.max(0, track.scrollWidth - innerWidth + 40);
      shop.style.height = (shopDist + innerHeight) + 'px';
    }
    [[shop, 'shop'], [ritual, 'ritual'], [manifest, 'manifest']].forEach(([el, k]) => {
      const r = el.getBoundingClientRect();
      M[k] = { top: r.top + scrollY, h: r.height };
    });
  }
  const P = k => clamp((sy - M[k].top) / Math.max(1, M[k].h - innerHeight));

  /* ------------------------------------------------------
     HUVUDLOOP
     ------------------------------------------------------ */
  let sy = 0, lastY = 0, mxs = 0, mys = 0;
  const heroWord = $('#heroWord'), heroCopy = $('#heroCopy');
  const bar = $('#bar'), shopBar = $('#shopBar'), nav = $('#nav');
  let lastLit = -1;

  function tick(t) {
    requestAnimationFrame(tick);
    sy = reduce ? scrollY : lerp(sy, scrollY, .1);
    mxs = lerp(mxs, mouse.nx, .06); mys = lerp(mys, mouse.ny, .06);
    const vh = innerHeight;

    // kursor
    if (!coarse) {
      cur.rx = lerp(cur.rx, cur.x, .16); cur.ry = lerp(cur.ry, cur.y, .16);
      dot.style.transform = `translate3d(${cur.x}px,${cur.y}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${cur.rx}px,${cur.ry}px,0) translate(-50%,-50%)`;
    }

    // scroll-progress + nav
    const docH = document.documentElement.scrollHeight - vh;
    bar.style.transform = `scaleX(${docH > 0 ? scrollY / docH : 0})`;
    nav.classList.toggle('hide', scrollY > lastY && scrollY > 240 && !document.body.classList.contains('menu-open'));
    lastY = scrollY;

    drawFx();

    // HERO
    if (sy < vh * 1.3) {
      if (!hero.down) { hero.drag += hero.vel; hero.vel *= .94; }
      const ry = hero.drag + sy * .22 + t * .012 + mxs * 24;
      setRot(heroSlot, -10 + mys * -14, ry, mxs * 5);
      heroWord.style.transform = `translate3d(0,${sy * .3}px,0) scale(${1 + sy * .0003})`;
      stage.style.transform = `translate3d(0,${sy * .16}px,0)`;
      heroCopy.style.opacity = clamp(1 - sy / (vh * .55));
    }

    // SHOP (horisontell scroll)
    if (M.shop) {
      const sp = P('shop');
      if (!shop.classList.contains('native')) {
        track.style.transform = `translate3d(${-sp * shopDist}px,0,0)`;
        shopBar.style.transform = `scaleX(${sp})`;
      }
      cards.forEach(c => {
        if (!c.vis) return;
        c.cx = lerp(c.cx, c.hx, .1); c.cy = lerp(c.cy, c.hy, .1);
        c.el.style.transform = `perspective(900px) rotateX(${-c.cy * 8}deg) rotateY(${c.cx * 10}deg)`;
        const idle = Math.sin(t * .0009 + c.i * 1.7) * 14;
        setRot(c.slot, -8 + c.cy * -14, -24 + idle + c.cx * 90 + sy * .02, c.cx * 4);
      });
    }

    // RITUAL
    if (M.ritual) {
      const rp = P('ritual');
      const idx = Math.min(3, Math.floor(rp * 4));
      setStep(idx);
      const local = rp * 4 - idx;
      const spin = rp * 1080;
      rSlots.forEach((s, k) => { if (k === idx) setRot(s, -9 + Math.sin(local * 3.14) * -8, spin, Math.sin(local * 6.28) * 3); });
    }

    // MANIFEST
    if (M.manifest) {
      const mp = P('manifest');
      const lit = clamp((mp - .06) / .78) * words.length;
      const key = Math.floor(lit * 4);
      if (key !== lastLit) {
        lastLit = key;
        words.forEach((w, i) => { w.style.opacity = (.12 + .88 * clamp(lit - i)).toFixed(2); });
      }
    }

    // JOIN-kort: 3D-tilt
    const jc = $('#joinCard');
    if (jc.classList.contains('in')) jc.style.transform = `rotateX(${-mys * 7}deg) rotateY(${mxs * 9}deg)`;
  }

  /* ------------------------------------------------------
     START
     ------------------------------------------------------ */
  addEventListener('resize', () => { resizeCanvas(); measure(); });
  resizeCanvas();
  measure();
  sy = scrollY;
  requestAnimationFrame(tick);
  addEventListener('load', () => { measure(); setTimeout(measure, 800); });

  // Preloader
  const loader = $('#loader'), num = $('#loaderNum'), lbar = $('#loaderBar');
  const dur = reduce ? 200 : 1700, t0 = performance.now();
  (function ld(now) {
    const p = clamp((now - t0) / dur);
    num.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * 100);
    lbar.style.transform = `scaleX(${p})`;
    if (p < 1) { requestAnimationFrame(ld); return; }
    window.scrollTo(0, 0);
    loader.classList.add('done');
    document.body.classList.add('ready');
    setTimeout(() => { loader.remove(); measure(); }, 1100);
  })(t0);
})();
