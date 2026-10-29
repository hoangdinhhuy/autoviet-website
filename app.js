/* AutoViet app — gọi API backend, có fallback dữ liệu nhúng (cho bản tĩnh) */
(function () {
  const $ = (id) => document.getElementById(id);
  const API = {
    online: false,
    async check() {
      try {
        const r = await fetch('api/brands', { signal: AbortSignal.timeout(3500) });
        this.online = r.ok;
      } catch { this.online = false; }
      $('apiDot').classList.add(this.online ? 'online' : 'offline');
      $('apiStatus').innerHTML = this.online
        ? '🟢 Đang chạy với backend API — dữ liệu thời gian thực từ <code>GET /api/cars</code>, đơn hàng lưu server.'
        : '🟡 Chế độ demo tĩnh (không có backend) — dữ liệu nhúng sẵn, đơn hàng chỉ mô phỏng.';
      return this.online;
    }
  };

  /* ---------- data ---------- */
  let CARS = [], PACKAGES = [];
  async function loadCars() {
    try {
      const r = await fetch('api/cars', { signal: AbortSignal.timeout(3500) });
      if (!r.ok) throw 0;
      const d = await r.json();
      if (!d.cars || !d.cars.length) throw 0;
      CARS = d.cars; PACKAGES = d.cars[0].packages;
    } catch {
      CARS = window.__FALLBACK.cars; PACKAGES = window.__FALLBACK.packages;
    }
  }

  const fmt = (tr) => tr >= 1000
    ? (tr / 1000).toFixed(tr % 1000 === 0 ? 0 : 2).replace('.', ',') + ' tỷ'
    : tr + ' triệu';
  const vnd = (tr) => Math.round(tr * 1e6).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = () => lucide.createIcons({ attrs: { width: 13, height: 13 } });
  const angleLabels = ['Góc trước', 'Góc sau', 'Góc 3/4', 'Chi tiết thân xe'];

  /* ---------- filters ---------- */
  const state = { brand: '', type: '', fuel: '', price: '' };
  function fillFilterOptions() {
    const uniq = (k) => [...new Set(CARS.map(c => c[k]))];
    $('fBrand').innerHTML = '<option value="">Tất cả hãng</option>' +
      uniq('brand').sort().map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    $('fType').innerHTML = '<option value="">Tất cả</option>' +
      uniq('type').map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    $('fFuel').innerHTML = '<option value="">Tất cả</option>' +
      uniq('fuel').map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  }

  function matchFilter(c) {
    if (state.brand && c.brand !== state.brand) return false;
    if (state.type && c.type !== state.type) return false;
    if (state.fuel && c.fuel !== state.fuel) return false;
    if (state.price) {
      const [lo, hi] = state.price.split('-').map(Number);
      if (c.price < lo || c.price > hi) return false;
    }
    return true;
  }

  /* ---------- render cards ---------- */
  function cardHTML(c, tuner) {
    const stats = tuner
      ? `<div class="tuner-stats">
           <span>${c.power} mã lực</span><span>0-100: ${c.accel}</span><span>V/max ${c.vMax}</span>
         </div>` : '';
    return `<article class="car">
      <div class="car-img">
        <img src="${c.gallery ? c.gallery[0] : ''}" alt="${esc(c.name)}" loading="lazy">
        ${c.tag ? `<span class="tag ${c.tagType}">${esc(c.tag)}</span>` : ''}
      </div>
      <div class="car-body">
        <h3>${esc(c.name)}</h3>
        <div class="price">${fmt(c.price)}<small>niêm yết</small></div>
        ${stats}
        <div class="specs">
          <span><i data-lucide="calendar"></i>${c.year}</span>
          <span><i data-lucide="fuel"></i>${esc(c.fuel)}</span>
          <span><i data-lucide="car"></i>${esc(c.type)}</span>
        </div>
        <div class="car-actions">
          <button class="btn btn-primary" type="button" data-detail="${c.id}">Xem 4 góc</button>
          <button class="btn btn-ghost" type="button" data-test="${c.id}">Lái thử</button>
        </div>
      </div>
    </article>`;
  }

  function renderGrids() {
    const feat = CARS.filter(c => c.collection === 'featured' && matchFilter(c));
    const tune = CARS.filter(c => c.collection === 'tuner' && matchFilter(c));
    const total = feat.length + tune.length;
    $('countInfo').textContent = API.online
      ? `${total}/${CARS.length} xe · dữ liệu từ API`
      : `${total}/${CARS.length} xe · chế độ demo`;
    $('carGrid').innerHTML = feat.length
      ? feat.map(c => cardHTML(c, false)).join('')
      : '<div class="empty"><i data-lucide="search-x"></i>Không có xe phù hợp bộ lọc.</div>';
    $('tunerGrid').innerHTML = tune.map(c => cardHTML(c, true)).join('');
    icon();
  }

  /* ---------- modal ---------- */
  const cfg = { car: null, verIdx: 0, colorIdx: 1, pkgs: [] };

  function openModal(id) {
    cfg.car = CARS.find(c => c.id === id);
    if (!cfg.car) return;
    cfg.verIdx = cfg.car.versions.length - 1;
    cfg.colorIdx = 1;
    cfg.pkgs = [];

    // gallery 4 góc
    const g = cfg.car.gallery || [];
    setGalleryImage(0);
    $('gThumbs').innerHTML = g.map((src, i) =>
      `<button class="thumb${i === 0 ? ' on' : ''}" type="button" data-ang="${i}" aria-label="${angleLabels[i] || 'Góc ' + (i + 1)}">
         <img src="${src}" alt="${angleLabels[i] || 'Góc ' + (i + 1)}">
       </button>`).join('');

    $('mTitle').textContent = cfg.car.name;
    const tunerExtra = cfg.car.collection === 'tuner'
      ? ` · ${cfg.car.power} mã lực · 0-100: ${cfg.car.accel}` : '';
    $('mSub').textContent = `${cfg.car.brand} · ${cfg.car.type} · ${cfg.car.fuel} · ${cfg.car.year}${tunerExtra}`;

    $('mVersions').innerHTML = cfg.car.versions.map((v, i) =>
      `<button class="version${i === cfg.verIdx ? ' on' : ''}" type="button" data-ver="${i}">${esc(v.name)}<small>${fmt(v.price)}</small></button>`).join('');
    $('mColors').innerHTML = cfg.car.colors.map((c, i) =>
      `<button class="swatch${i === cfg.colorIdx ? ' on' : ''}" type="button" style="--sw:${c.hex}" data-col="${i}" aria-label="${esc(c.name)}" title="${esc(c.name)}"><i data-lucide="check"></i></button>`).join('');
    $('mPkgs').innerHTML = PACKAGES.map((p, i) =>
      `<label class="pkg" data-pkg="${i}"><input type="checkbox"><span><b>${esc(p.name)}</b><p>${esc(p.desc)}</p></span><span class="pkg-price">+${p.price} tr</span></label>`).join('');
    $('mSpecs').innerHTML = Object.entries(cfg.car.specs).map(([k, v]) =>
      `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');

    switchTab('Cfg');
    $('modalWrap').classList.add('open');
    document.body.style.overflow = 'hidden';
    updateSummary(); updateFinance();
    lucide.createIcons({ attrs: { width: 16, height: 16 } });
  }

  function setGalleryImage(i) {
    const g = cfg.car.gallery || [];
    $('gMain').src = g[i] || '';
    $('gMain').alt = `${cfg.car.name} — ${angleLabels[i] || 'Góc ' + (i + 1)}`;
    $('galleryTag').textContent = angleLabels[i] || `Góc ${i + 1}`;
    document.querySelectorAll('.thumb').forEach(t => t.classList.toggle('on', +t.dataset.ang === i));
  }

  function closeModal() {
    $('modalWrap').classList.remove('open');
    document.body.style.overflow = '';
  }

  function switchTab(name) {
    ['Cfg', 'Spec', 'Fin', 'Order'].forEach(t => {
      $('tab' + t).classList.toggle('on', t === name);
      $('tab' + t).setAttribute('aria-selected', t === name);
      $('panel' + t).hidden = t !== name;
    });
  }

  /* ---------- configurator & finance ---------- */
  const basePrice = () => cfg.car.versions[cfg.verIdx].price;
  const optTotal = () => cfg.pkgs.reduce((s, i) => s + PACKAGES[i].price, 0);

  function updateSummary() {
    const base = basePrice(), opt = optTotal(), total = base + opt;
    $('mSumLabel').textContent = `Giá tùy chọn · ${cfg.car.versions[cfg.verIdx].name} · ${cfg.car.colors[cfg.colorIdx].name}`;
    $('mSum').textContent = fmt(total);
    $('mBase').textContent = vnd(base);
    $('mOpts').textContent = opt ? '+' + vnd(opt) : '—';
    $('mDown').textContent = vnd(total * 0.2);
    $('mMonthly').textContent = vnd(loanMonthly(total * 0.8, 7.5, 60));
    updateFinance();
  }

  const loanMonthly = (loan, ratePct, months) => {
    const r = ratePct / 100 / 12;
    return r > 0 ? loan * r / (1 - Math.pow(1 + r, -months)) : loan / months;
  };

  async function updateFinance() {
    if (!cfg.car) return;
    const body = {
      price: basePrice() + optTotal(),
      downPct: +$('finDown').value, term: +$('finTerm').value, rate: +$('finRate').value
    };
    let d;
    if (API.online) {
      try {
        const r = await fetch('api/finance/calc', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        d = await r.json();
      } catch { d = null; }
    }
    if (!d) d = {
      loan: body.price * (1 - body.downPct / 100),
      down: body.price * body.downPct / 100,
      monthly: loanMonthly(body.price * (1 - body.downPct / 100), body.rate, body.term),
      totalInterest: 0, totalPaid: 0
    };
    if (!d.totalPaid) d.totalPaid = d.monthly * body.term + d.down;
    if (!d.totalInterest) d.totalInterest = d.totalPaid - body.price;

    $('finDownLabel').textContent = body.downPct + '%';
    $('finTermLabel').textContent = body.term + ' tháng';
    $('finRateLabel').textContent = body.rate + '%/năm';
    $('finLoan').textContent = vnd(d.loan);
    $('finDownAmt').textContent = vnd(d.down);
    $('finMonthly').textContent = vnd(d.monthly);
    $('finInterest').textContent = vnd(d.totalInterest);
    $('finTotal').textContent = vnd(d.totalPaid);
  }

  /* ---------- order ---------- */
  async function submitOrder(e) {
    e.preventDefault();
    const msg = $('orderMsg');
    const payload = {
      name: $('oName').value, phone: $('oPhone').value, date: $('oDate').value,
      carId: cfg.car.id, variant: cfg.car.versions[cfg.verIdx].name,
      color: cfg.car.colors[cfg.colorIdx].name, note: $('oNote').value
    };
    msg.className = 'form-msg';
    msg.textContent = 'Đang gửi…';
    if (API.online) {
      try {
        const r = await fetch('api/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (!r.ok) { msg.className = 'form-msg err'; msg.textContent = d.error || 'Gửi thất bại'; return; }
        msg.className = 'form-msg ok';
        msg.textContent = d.message;
        toast(d.message);
        return;
      } catch { /* fallback dưới */ }
    }
    msg.className = 'form-msg ok';
    msg.textContent = `(Demo) Đã ghi nhận lái thử ${cfg.car.name} — chạy backend để lưu thật.`;
    toast(msg.textContent);
  }

  /* ---------- events ---------- */
  $('filters').addEventListener('submit', (e) => {
    e.preventDefault();
    state.brand = $('fBrand').value; state.type = $('fType').value;
    state.fuel = $('fFuel').value; state.price = $('fPrice').value;
    renderGrids();
  });
  $('btnReset').addEventListener('click', () => {
    ['fBrand', 'fType', 'fFuel', 'fPrice'].forEach(id => $(id).value = '');
    Object.keys(state).forEach(k => state[k] = '');
    renderGrids();
  });

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) {
      document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('on', b === go));
      const el = document.querySelector(go.dataset.go);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const d = e.target.closest('[data-detail]');
    if (d) return openModal(+d.dataset.detail);
    const t = e.target.closest('[data-test]');
    if (t) { openModal(+t.dataset.test); switchTab('Order'); return; }
    const bl = e.target.closest('[data-brand-link]');
    if (bl) {
      e.preventDefault();
      $('fBrand').value = bl.dataset.brandLink;
      state.brand = bl.dataset.brandLink; state.type = state.fuel = state.price = '';
      renderGrids();
      document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
    }
  });

  $('gThumbs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-ang]');
    if (t) setGalleryImage(+t.dataset.ang);
  });
  $('mVersions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver]');
    if (!b) return;
    cfg.verIdx = +b.dataset.ver;
    document.querySelectorAll('#mVersions .version').forEach(v => v.classList.toggle('on', v === b));
    updateSummary();
  });
  $('mColors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-col]');
    if (!b) return;
    cfg.colorIdx = +b.dataset.col;
    document.querySelectorAll('#mColors .swatch').forEach(s => s.classList.toggle('on', s === b));
    updateSummary();
  });
  $('mPkgs').addEventListener('change', (e) => {
    const l = e.target.closest('[data-pkg]');
    if (!l) return;
    const i = +l.dataset.pkg;
    if (e.target.checked) { if (!cfg.pkgs.includes(i)) cfg.pkgs.push(i); }
    else cfg.pkgs = cfg.pkgs.filter(x => x !== i);
    l.classList.toggle('on', e.target.checked);
    updateSummary();
  });
  ['finDown', 'finTerm', 'finRate'].forEach(id => $(id).addEventListener('input', updateFinance));
  ['tabCfg', 'tabSpec', 'tabFin', 'tabOrder'].forEach(id =>
    $(id).addEventListener('click', () => switchTab(id.replace('tab', ''))));
  $('btnGoOrder').addEventListener('click', () => {
    $('oColor').value = cfg.car.colors[cfg.colorIdx].name;
    switchTab('Order');
  });
  $('orderForm').addEventListener('submit', submitOrder);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(m) {
    const t = $('toast');
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  /* ---------- init ---------- */
  (async () => {
    await Promise.all([API.check(), loadCars()]);
    fillFilterOptions();
    renderGrids();
  })();
})();
