/* 阅读偏好、入卷页与可恢复的人物地址。旧的 #graph 等页签地址继续有效。 */
const Reading = {
  reveal: false,
  init() {
    this.reveal = store.get('hlm-endings') === 'show';
    this.updateLabel();
    $('#endingToggle').addEventListener('click', () => {
      this.reveal = !this.reveal;
      store.set('hlm-endings', this.reveal ? 'show' : 'hide');
      $$('details.spoiler').forEach(el => { el.open = this.reveal; });
      this.updateLabel();
      this.notice(this.reveal ? '已展开结局与解读。' : '已收起结局与解读。简介、关系和回目仍会涉及情节。');
    });
    document.addEventListener('click', ev => {
      const nav = ev.target.closest('[data-nav]');
      if (nav) { Tabs.show(nav.dataset.nav, true); return; }
      const place = ev.target.closest('[data-place]');
      if (place) { Tabs.show('garden', true); Garden.select(place.dataset.place, true); }
      const journey = ev.target.closest('[data-journey]');
      if (journey) {
        if (journey.dataset.journey === 'garden') { Tabs.show('garden', true); Garden.startTour(); }
        else { const event = EVENTS.find(e => e.c[0] === +journey.dataset.journey); if (event) { Tabs.show('timeline', true); Timeline.focus(event.i); } }
      }
    });
  },
  updateLabel() {
    const b = $('#endingToggle');
    b.textContent = this.reveal ? '结局展开' : '结局收起';
    b.setAttribute('aria-pressed', String(this.reveal));
    b.title = '控制结局与判词解读的默认展开状态；简介、关系和回目仍会涉及情节';
    document.documentElement.classList.toggle('show-endings', this.reveal);
  },
  spoiler(html, label = '后文与结局') {
    return `<details class="spoiler"${this.reveal ? ' open' : ''}><summary>${label}<span>按需展开</span></summary><div class="spoiler-body">${html}</div></details>`;
  },
  notice(message) {
    $('#notice').textContent = message;
    $('#notice').classList.add('visible');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => $('#notice').classList.remove('visible'), 4200);
  },
  remember(id) {
    let recent;
    try { recent = JSON.parse(store.get('hlm-recent') || '[]'); } catch { recent = []; }
    if (!Array.isArray(recent)) recent = [];
    store.set('hlm-recent', JSON.stringify([id, ...recent.filter(x => x !== id && byId.has(x))].slice(0, 6)));
    if (Tabs.inited.home) Home.recent();
  },
  async share(id, button) {
    const url = new URL(location.href);
    url.hash = 'index?' + new URLSearchParams({ person: id });
    try {
      await navigator.clipboard.writeText(url.href);
      this.notice('人物链接已复制。');
    } catch {
      let field = $('.share-fallback', Drawer.el);
      if (!field) { field = document.createElement('input'); field.className = 'share-fallback'; field.readOnly = true; field.setAttribute('aria-label', '人物链接，选中后复制'); Drawer.head.append(field); }
      field.value = url.href; field.focus(); field.select();
      this.notice('浏览器未允许自动复制，请复制已选中的人物链接。');
    }
  }
};

const Route = {
  busy: false,
  parse() {
    const [page, query = ''] = location.hash.slice(1).split('?');
    const person = new URLSearchParams(query).get('person');
    return { page: Tabs.names.includes(page) ? page : 'home', person: byId.has(person) ? person : null };
  },
  write(person = Drawer.cur, replace = false) {
    if (this.busy) return;
    const hash = '#' + Tabs.cur + (person ? '?' + new URLSearchParams({ person }) : '');
    if (location.hash === hash) return;
    const full = document.documentElement.classList.contains('stage-full');
    history[replace || full ? 'replaceState' : 'pushState'](full ? { hlmStage: 1 } : {}, '', hash);
  },
  apply() {
    this.busy = true;
    try {
      const r = this.parse();
      if (Tabs.inited.graph) Graph.exitFull(true);
      Tabs.show(r.page);
      if (r.person) {
        if (r.page === 'graph') Graph.select(r.person, true);
        else Drawer.open(r.person, { snap: 'full' });
      } else Drawer.close(true);
    } finally { this.busy = false; }
  },
  init() {
    addEventListener('popstate', () => this.apply());
    addEventListener('hashchange', () => { const r = this.parse(); if (r.page !== Tabs.cur || r.person !== Drawer.cur) this.apply(); });
    this.apply();
  }
};

const Home = {
  init() {
    const paths = [
      { n: '第三回', title: '随黛玉初入贾府', text: '先认识贾母、凤姐与宝玉，再看宁荣二府如何相连。', key: '3', action: '从这一回读起' },
      { n: '第十七回', title: '跟着宝玉走进园子', text: '从正门到怡红院，沿九处景致读匾额、看住户。', key: 'garden', action: '开始游园' },
      { n: '第三十七回', title: '赴一场海棠诗社', text: '读姐妹们的诗号，看看秋爽斋里有哪些熟面孔。', key: '37', action: '看看这场相聚' }
    ];
    $('#readingPaths').innerHTML = paths.map(p => `<button type="button" class="reading-path" data-journey="${p.key}"><small>${p.n}</small><strong>${p.title}</strong><p>${p.text}</p><span>${p.action}</span></button>`).join('');
    const portraits = [['薛宝钗','蘅芜君'],['史湘云','枕霞旧友'],['王熙凤','凤辣子'],['贾探春','蕉下客']];
    $('#homePortraits').innerHTML = portraits.map(([id, sub]) => `<button type="button" class="portrait-link" data-pick="${id}"><img src="${portrait(id)}" alt="" width="640" height="960" loading="lazy"><span>${id}<small>${sub}</small></span></button>`).join('');
    bindSearch($('#homeQ'), $('#homeSuggest'), id => Drawer.open(id, { snap: 'full' }));
    $('#homeSearchForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const value = $('#homeQ').value.trim();
      if (!value) { $('#homeQ').focus(); return; }
      const results = Catalog.search(value);
      if (results.length === 1) Drawer.open(results[0].id, { snap: 'full' });
      else { Tabs.show('index', true); PeopleIndex.search(value); }
      $('#homeSuggest').hidden = true;
    });
    this.recent();
  },
  recent() {
    let ids;
    try { ids = JSON.parse(store.get('hlm-recent') || '[]'); } catch { ids = []; }
    ids = Array.isArray(ids) ? ids.filter(id => byId.has(id)) : [];
    const el = $('#continueReading');
    el.hidden = !ids.length;
    el.innerHTML = `<span>接着上次的阅读</span>${ids.map(pill).join('')}<button class="text-link" type="button" id="clearRecent">清除记录</button>`;
    $('#clearRecent').addEventListener('click', () => { store.set('hlm-recent', '[]'); this.recent(); });
  }
};
