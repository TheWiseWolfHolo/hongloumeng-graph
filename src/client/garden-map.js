/* 园林画作只绘制一次，地点范围、题额路线和文字覆盖在同一幅图上。 */
import { GARDEN, GARDEN_TOUR, GARDEN_TOUR_PATH } from '../data/garden.ts';
import { cn as cnNum } from '../lib/cn.ts';
import bridgeArtwork from '../assets/paintings/garden-bridge.svg?raw';

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Garden = (() => {
  const W = 1200, H = 790;
  const visibleSites = new Set(['qft', 'oxx', 'ajg', 'qfz']);
  const places = new Map(GARDEN.map(place => [place.id, place]));
  const labelBoxes = new Map();
  const numberMeasure = document.createElement('canvas').getContext('2d');
  let svg, box;
  let tour = null, route = null, reveal = null, marker = null, stops = [], stopEls = [], total = 0, raf = 0;
  const r1 = n => Math.round(n * 10) / 10;
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, value);
    parent?.appendChild(node);
    return node;
  };
  const pathData = (points, closed = false) => points.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])} ${r1(p[1])}`).join('') + (closed ? 'Z' : '');
  const ringPath = (rx, ry) => `M${-rx} 0C${-rx} ${-ry * .57} ${-rx * .55} ${-ry} 0 ${-ry}C${rx * .57} ${-ry * 1.02} ${rx * 1.03} ${-ry * .53} ${rx} 0C${rx * .98} ${ry * .57} ${rx * .53} ${ry * 1.02} 0 ${ry * .98}C${-rx * .56} ${ry} ${-rx * 1.02} ${ry * .52} ${-rx} 0Z`;
  const text = (parent, value, x, y, cls, anchor = 'middle') => {
    const node = el('text', { class: cls, x, y, 'text-anchor': anchor }, parent);
    node.textContent = value;
    return node;
  };
  function centerBadge(group) {
    const label = $('text', group), style = getComputedStyle(label);
    numberMeasure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const ink = numberMeasure.measureText(label.textContent);
    const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
    const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
    label.setAttribute('x', r1((ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / 2));
    label.setAttribute('y', r1((ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2));
    $('circle', group).setAttribute('r', r1(Math.max(10, Math.hypot(width, height) / 2 + 3)));
  }
  function numberBadge(parent, value, cls) {
    el('circle', {}, parent);
    text(parent, value, 0, 0, cls, 'start');
    centerBadge(parent);
  }
  function nearestEdge(points, x, y) {
    let nearest = points[0], distance = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      const p = [a[0] + dx * t, a[1] + dy * t], d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < distance) { distance = d; nearest = p; }
    }
    return nearest;
  }
  function placeLabel(group, place) {
    const [x, y, anchor] = place.lab;
    const size = place.kind === 'home' ? 19 : 17;
    const width = [...place.name].length * size * 1.08;
    const left = x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0) - 7;
    const top = y - size - 3, right = left + width + 14, bottom = y + 7;
    labelBoxes.set(place.id, { left, right, top, bottom });
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    const edge = nearestEdge(place.footprint, centerX, centerY);
    const start = [Math.max(left, Math.min(right, edge[0])), Math.max(top, Math.min(bottom, edge[1]))];
    const label = el('g', { class: 'g-place-label' }, group);
    if (Math.hypot(start[0] - edge[0], start[1] - edge[1]) > 9) {
      el('path', { class: 'g-label-leader', d: pathData([start, edge]) }, label);
    }
    el('path', { class: 'g-label-paper', d: `M${left} ${top}L${right} ${top + .5}L${right - .4} ${bottom}L${left + .6} ${bottom - .4}Z` }, label);
    text(label, place.name, x, y, `g-place-name ${place.kind}`, anchor);
  }
  function draw() {
    svg.replaceChildren();
    labelBoxes.clear();
    pinG = null;
    const artwork = svg.dataset.artwork;
    const defs = el('defs', {}, svg);
    const mask = el('mask', { id: 'gdTourMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    el('path', { id: 'gdTourReveal', fill: 'none', stroke: '#fff', 'stroke-width': 16, 'stroke-linecap': 'round' }, mask);
    el('image', { class: 'g-artwork', href: artwork, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, svg);
    const vacancy = el('g', { class: 'g-vacant-layer', 'aria-hidden': 'true' }, svg);
    const vacancyClip = el('clipPath', { id: 'gdVacant', clipPathUnits: 'userSpaceOnUse' }, defs);
    for (const place of GARDEN.filter(p => p.kind === 'home')) {
      el('path', { class: 'g-vacant-region', 'data-vacant-id': place.id, d: pathData(place.footprint, true) }, vacancyClip);
    }
    el('image', { class: 'g-vacancy', href: artwork, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'xMidYMid meet', 'clip-path': 'url(#gdVacant)' }, vacancy);
    el('g', { class: 'g-bridge-overlay', 'aria-hidden': 'true', 'pointer-events': 'none' }, svg).innerHTML = bridgeArtwork;
    const interactive = el('g', { class: 'g-places' }, svg);
    for (const place of GARDEN) {
      const shown = place.kind === 'home' || visibleSites.has(place.id);
      const group = el('g', { class: `g-${place.kind}${shown ? ' label-default' : ''}`, 'data-id': place.id, tabindex: 0, role: 'button', 'aria-label': place.name, 'aria-pressed': 'false' }, interactive);
      const shape = pathData(place.footprint, true);
      el('path', { class: 'g-hit', d: shape }, group);
      const [cx, cy, rx, ry, rotation] = place.focusRing;
      el('path', { class: 'g-outline', d: ringPath(rx, ry), transform: `translate(${cx} ${cy}) rotate(${rotation})` }, group);
      placeLabel(group, place);
    }
    const tg = el('g', { class: 'g-tour', 'aria-hidden': 'true' }, svg);
    const itinerary = pathData(GARDEN_TOUR_PATH);
    el('path', { class: 'g-route-paper', d: itinerary, mask: 'url(#gdTourMask)' }, tg);
    route = el('path', { class: 'g-route', d: itinerary, mask: 'url(#gdTourMask)' }, tg);
    reveal = $('#gdTourReveal', svg);
    reveal.setAttribute('d', itinerary);
    stopEls = GARDEN_TOUR.map((stop, i) => {
      const group = el('g', { class: 'g-stop', transform: `translate(${stop.at[0]} ${stop.at[1]})` }, tg);
      numberBadge(group, cnNum(i + 1), 'g-stop-number');
      return group;
    });
    marker = el('g', { class: 'g-marker' }, tg);
    el('circle', { class: 'core', r: 4.5 }, marker);
    stops = [];
  }

  let onPick = () => {};
  let pinG = null;
  const preparedArt = new Map();
  let artworkRequest = 0;
  let artworkTransition = Promise.resolve();
  async function setArtwork(src) {
    const request = ++artworkRequest;
    const base = $('.g-artwork', svg);
    if (src !== base.getAttribute('href') && !preparedArt.has(src)) {
      const picture = new Image();
      picture.src = src;
      preparedArt.set(src, picture.decode());
    }
    await preparedArt.get(src);
    await artworkTransition;
    if (request !== artworkRequest || src === base.getAttribute('href')) return;
    const next = el('image', { class: 'g-artwork g-artwork-next', href: src, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
    base.after(next);
    const fade = next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 0 : 420, easing: 'ease-in-out', fill: 'forwards' });
    artworkTransition = fade.finished.then(() => {
      base.setAttribute('href', src);
      $('.g-vacancy', svg).setAttribute('href', src);
      next.remove();
    });
    await artworkTransition;
  }
  function mark(id) {
    $$('.g-home, .g-site', svg).forEach(group => {
      const active = group.dataset.id === id;
      group.classList.toggle('on', active);
      group.setAttribute('aria-pressed', String(active));
    });
  }
  function focusOn(keep) {
    svg.classList.toggle('narrow', !!keep);
    $$('.g-home, .g-site', svg).forEach(group => group.classList.toggle('keep', !!keep && keep.has(group.dataset.id)));
  }
  function vacant(ids) {
    $$('.g-home', svg).forEach(group => {
      const empty = ids.has(group.dataset.id), place = places.get(group.dataset.id);
      group.classList.toggle('vacant', empty);
      group.setAttribute('aria-label', `${place.name}${empty ? '，此时空置' : ''}`);
    });
    $$('.g-vacant-region', svg).forEach(region => region.classList.toggle('is-vacant', ids.has(region.dataset.vacantId)));
    $('.g-vacancy', svg).classList.toggle('is-vacant', ids.size > 0);
  }
  function pins(list) {
    pinG?.remove();
    pinG = null;
    if (!list?.length) return;
    pinG = el('g', { class: 'g-pins', 'aria-hidden': 'true' }, svg);
    for (const { id, n } of list) {
      const group = el('g', { class: 'g-pin', 'data-pin': n, 'data-place': id }, pinG);
      numberBadge(group, cnNum(n), 'g-pin-number');
    }
    layoutPins();
  }
  function layoutPins() {
    const grouped = new Map();
    $$('.g-pin', svg).forEach(pin => {
      const id = pin.dataset.place;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(pin);
    });
    for (const [id, markers] of grouped) {
      const label = labelBoxes.get(id), radii = markers.map(pin => +$('circle', pin).getAttribute('r'));
      const rowWidth = radii.reduce((sum, radius) => sum + radius * 2, 0) + (markers.length - 1) * 6;
      const rightSide = label.right + 9 + rowWidth <= W - 8;
      const maxRadius = Math.max(...radii);
      const y = Math.max(8 + maxRadius, Math.min(H - 8 - maxRadius, (label.top + label.bottom) / 2));
      let edge = rightSide ? label.right + 9 : label.left - 9;
      markers.forEach((pin, i) => {
        const x = rightSide ? edge + radii[i] : edge - radii[i];
        pin.setAttribute('transform', `translate(${r1(x)} ${r1(y)})`);
        edge += (rightSide ? 1 : -1) * (radii[i] * 2 + 6);
      });
    }
  }
  function center(id) {
    if (box.scrollWidth <= box.clientWidth) return;
    const b = GARDEN.find(x => x.id === id), k = box.scrollWidth / W;
    if (b) box.scrollTo({ left: b.pos[0] * k - box.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* 游园：路线按站点逐段展开，行人沿路走过去 */
  function measure() {
    const distances = [0];
    for (let i = 1; i < GARDEN_TOUR_PATH.length; i++) {
      const a = GARDEN_TOUR_PATH[i - 1], b = GARDEN_TOUR_PATH[i];
      distances.push(distances[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    total = distances.at(-1);
    let from = 0;
    stops = GARDEN_TOUR.map(stop => {
      from = GARDEN_TOUR_PATH.findIndex((point, index) => index >= from && point[0] === stop.at[0] && point[1] === stop.at[1]);
      return distances[from];
    });
  }
  function setLen(L) {
    tour.len = L;
    reveal.setAttribute('stroke-dasharray', `${r1(L)} ${r1(total + 20)}`);
    const p = route.getPointAtLength(L);
    marker.setAttribute('transform', `translate(${r1(p.x)} ${r1(p.y)})`);
    stopEls.forEach((s, k) => s.classList.toggle('done', stops[k] <= L + 1));
  }
  function tourGo(i) {
    if (!tour) return;
    i = Math.max(0, Math.min(GARDEN_TOUR.length - 1, i));
    const from = tour.len, to = stops[i], st = GARDEN_TOUR[i];
    tour.i = i;
    mark(st.site || null);
    cancelAnimationFrame(raf);
    const dur = reduced ? 0 : Math.min(2600, Math.max(400, Math.abs(to - from) * 2.4)), t0 = performance.now();
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setLen(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    if (box.scrollWidth > box.clientWidth) {
      const k = box.scrollWidth / W;
      box.scrollTo({ left: st.at[0] * k - box.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
    }
    return i;
  }
  function startTour() {
    if (!stops.length) measure();
    tour = { i: 0, len: 0 };
    svg.classList.add('touring');
    setLen(0);
    return tourGo(0);
  }
  function endTour() {
    cancelAnimationFrame(raf);
    tour = null;
    svg.classList.remove('touring');
  }

  function init(opts = {}) {
    svg = $('#gardenSvg');
    box = $('.gscroll');
    onPick = opts.onPick || onPick;
    draw();
    const numberStyle = getComputedStyle($('.g-stop-number', svg));
    document.fonts.load(`${numberStyle.fontWeight} ${numberStyle.fontSize} ${numberStyle.fontFamily}`, '一二三四五六七八九十').then(() => {
      $$('.g-stop, .g-pin', svg).forEach(centerBadge);
      layoutPins();
    });
    const pick = ev => { const g = ev.target.closest('.g-home, .g-site'); if (g) onPick(g.dataset.id); };
    svg.addEventListener('click', pick);
    svg.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const g = ev.target.closest('.g-home, .g-site'); if (g) { ev.preventDefault(); onPick(g.dataset.id); } } });
    if (box.scrollWidth > box.clientWidth) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
  }
  return { init, setArtwork, mark, focusOn, vacant, pins, center, startTour, tourGo, endTour, touring: () => !!tour, tourIndex: () => tour?.i ?? -1 };
})();

export default Garden;
