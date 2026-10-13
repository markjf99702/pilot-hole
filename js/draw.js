// The drawings: a bit standing in its hole (the drill index and the hole cards), fastener and head icons,
// material swatches, and a section through each kind of joint with its holes coloured to match the cards.

const n = x => +x.toFixed(2);

// ---------- Shared gradients and patterns, put on the page once ----------
export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="g-gold" x1="0" x2="1"><stop offset="0" stop-color="#7c5512"/><stop offset=".28" stop-color="#e9c46a"/><stop offset=".42" stop-color="#fff0b8"/><stop offset=".62" stop-color="#c9952f"/><stop offset="1" stop-color="#6e4a10"/></linearGradient>
  <linearGradient id="g-black" x1="0" x2="1"><stop offset="0" stop-color="#0c0e10"/><stop offset=".3" stop-color="#3d434a"/><stop offset=".42" stop-color="#7d8792"/><stop offset=".6" stop-color="#262a2f"/><stop offset="1" stop-color="#0a0b0c"/></linearGradient>
  <linearGradient id="g-bright" x1="0" x2="1"><stop offset="0" stop-color="#5e666e"/><stop offset=".3" stop-color="#d9dee3"/><stop offset=".42" stop-color="#ffffff"/><stop offset=".62" stop-color="#a7afb7"/><stop offset="1" stop-color="#565d64"/></linearGradient>
  <linearGradient id="g-cobalt" x1="0" x2="1"><stop offset="0" stop-color="#5a3615"/><stop offset=".3" stop-color="#d3a062"/><stop offset=".42" stop-color="#f6d6a4"/><stop offset=".62" stop-color="#a36a2c"/><stop offset="1" stop-color="#4e2f12"/></linearGradient>
  <radialGradient id="g-hole" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#050607"/><stop offset=".7" stop-color="#14181c"/><stop offset="1" stop-color="#2b3238"/></radialGradient>
  <radialGradient id="g-forstner" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#eef1f3"/><stop offset=".55" stop-color="#a9b1b8"/><stop offset="1" stop-color="#5b636a"/></radialGradient>
  <pattern id="p-grain" width="46" height="13" patternUnits="userSpaceOnUse"><path d="M-2 4c8-2.6 15 2.4 24 0s16 2.2 26-.4M-2 10.5c9 1.8 17-2.4 25 0s15 1.4 25-.6" fill="none" stroke="var(--grain)" stroke-width="1.1"/></pattern>
  <pattern id="p-metal" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v7" stroke="var(--hatch)" stroke-width="1.2"/></pattern>
  <pattern id="p-layers" width="10" height="3.2" patternUnits="userSpaceOnUse"><path d="M0 3h10" stroke="var(--layers)" stroke-width="1"/></pattern>
  <pattern id="p-mdf" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="var(--grain)"/><circle cx="6.5" cy="7" r=".6" fill="var(--grain)"/><circle cx="7" cy="1.5" r=".5" fill="var(--grain)"/></pattern>
  <pattern id="p-ply" width="40" height="36" patternUnits="userSpaceOnUse"><rect width="40" height="6" fill="var(--ply-a)"/><rect y="6" width="40" height="6" fill="var(--ply-b)"/><rect y="12" width="40" height="6" fill="var(--ply-a)"/><rect y="18" width="40" height="6" fill="var(--ply-b)"/><rect y="24" width="40" height="6" fill="var(--ply-a)"/><rect y="30" width="40" height="6" fill="var(--ply-b)"/><path d="M0 6h40M0 12h40M0 18h40M0 24h40M0 30h40" stroke="var(--grain)" stroke-width=".8"/></pattern>
</defs></svg>`;

// ---------- A bit standing in its hole ----------
// w × h cell; the bit's diameter in px; finish picks the gradient; rise is how far it stands out of the hole.
export function bitInHole({ w = 40, h = 78, d, rise, finish = 'gold', missing = false, forstner = false, ghost = false }) {
  const cx = w / 2;
  const holeY = h - 9;
  const r = Math.max(d / 2, 0.75);
  const hr = r + Math.max(1.4, r * 0.18);
  const ry = k => n(k * 0.36);
  if (forstner) return forstnerTop({ w, h, d });
  const hole = `<ellipse cx="${cx}" cy="${holeY}" rx="${n(hr)}" ry="${ry(hr)}" fill="url(#g-hole)"/>`
    + `<path d="M${n(cx - hr)} ${holeY}a${n(hr)} ${ry(hr)} 0 0 0 ${n(2 * hr)} 0" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>`;
  if (missing && !ghost) return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${hole}</svg>`;
  if (ghost) {
    // The bit you'd need, drawn as a dashed outline standing in its hole.
    const top = holeY - rise, cone = Math.max(r * 0.62, 1);
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${hole}<path d="M${n(cx - r)} ${holeY}V${n(top + cone)}L${cx} ${n(top)}L${n(cx + r)} ${n(top + cone)}V${holeY}" class="bit-ghost"/></svg>`;
  }
  const top = holeY - rise;
  const g = `url(#g-${finish})`;
  const cone = r * 0.62;                 // a 118° point
  const fluteTop = top + cone;
  const fluteEnd = top + rise * 0.72;    // the shank shows below the flutes
  let body = '';
  if (r < 1.6) {
    body = `<rect x="${n(cx - r)}" y="${n(top)}" width="${n(2 * r)}" height="${n(holeY - top)}" fill="${g}"/>`;
  } else {
    body = `<rect x="${n(cx - r)}" y="${n(fluteTop)}" width="${n(2 * r)}" height="${n(holeY - fluteTop)}" fill="${g}"/>`
      + `<path d="M${n(cx - r)} ${n(fluteTop)}L${cx} ${n(top)}L${n(cx + r)} ${n(fluteTop)}Z" fill="${g}"/>`
      + `<path d="M${n(cx - r)} ${n(fluteTop)}L${cx} ${n(top)}L${n(cx + r * 0.25)} ${n(fluteTop + r * 0.2)}Z" fill="rgba(0,0,0,.28)"/>`;
    // Helical flutes: slanted bands across the body, the land catching the light.
    const lead = Math.max(Math.min(r * 2.3, (fluteEnd - fluteTop) / 2.6), 3.2), slant = Math.min(r * 1.15, lead * 0.55), band = Math.max(Math.min(r * 0.55, lead * 0.32), 0.9);
    let y = fluteTop + lead * 0.35;
    const flutes = [];
    while (y + band + 0.5 < fluteEnd) {
      flutes.push(`M${n(cx - r)} ${n(y + slant)}L${n(cx + r)} ${n(y)}L${n(cx + r)} ${n(y + band)}L${n(cx - r)} ${n(y + slant + band)}Z`);
      y += lead;
    }
    if (flutes.length) body += `<path d="${flutes.join('')}" fill="rgba(0,0,0,.34)"/>`;
    body += `<rect x="${n(cx - r * 0.28)}" y="${n(fluteTop)}" width="${n(Math.max(r * 0.16, 0.5))}" height="${n(holeY - fluteTop)}" fill="rgba(255,255,255,.35)"/>`;
  }
  // The front lip of the hole, over the foot of the bit.
  const lip = `<path d="M${n(cx - hr)} ${holeY}a${n(hr)} ${ry(hr)} 0 0 0 ${n(2 * hr)} 0" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="${n(Math.max(1.2, ry(hr) * 0.9))}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${hole}<g class="bit">${body}</g>${lip}</svg>`;
}

// A Forstner bit seen from above: rim, two cutting lips and the centre spur.
function forstnerTop({ w, h, d }) {
  const r = d / 2, cx = w / 2, cy = Math.max(h / 2, h - r - 8);
  const teeth = [];
  const k = Math.max(8, Math.round(r / 2.2));
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    teeth.push(`M${n(cx + Math.cos(a) * r * 0.92)} ${n(cy + Math.sin(a) * r * 0.92)}L${n(cx + Math.cos(a + 0.09) * r * 1.03)} ${n(cy + Math.sin(a + 0.09) * r * 1.03)}`);
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${n(r + 2)}" fill="url(#g-hole)"/>
    <circle cx="${cx}" cy="${cy}" r="${n(r)}" fill="url(#g-forstner)" stroke="#3d4349" stroke-width="1"/>
    <path d="${teeth.join('')}" stroke="#2c3136" stroke-width="1.2"/>
    <path d="M${n(cx - r * 0.86)} ${n(cy + r * 0.12)}L${n(cx + r * 0.86)} ${n(cy - r * 0.12)}" stroke="#2c3136" stroke-width="${n(Math.max(1.4, r * 0.09))}"/>
    <path d="M${n(cx - r * 0.86)} ${n(cy + r * 0.12)}L${n(cx - r * 0.1)} ${n(cy + r * 0.34)}L${n(cx + r * 0.1)} ${n(cy + r * 0.05)}Z" fill="rgba(0,0,0,.28)"/>
    <path d="M${n(cx + r * 0.86)} ${n(cy - r * 0.12)}L${n(cx + r * 0.1)} ${n(cy - r * 0.34)}L${n(cx - r * 0.1)} ${n(cy - r * 0.05)}Z" fill="rgba(0,0,0,.28)"/>
    <circle cx="${cx}" cy="${cy}" r="${n(Math.max(1.4, r * 0.08))}" fill="#e8ecef" stroke="#2c3136" stroke-width=".8"/>
  </svg>`;
}

// A countersink, side on: the cone the head sits in.
export function coneGlyph({ w = 44, h = 44, angle = 82 } = {}) {
  const top = 10, depth = 15, half = depth * Math.tan((angle / 2) * Math.PI / 180);
  const cx = w / 2;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <path d="M2 ${top}H${n(cx - half)}L${n(cx - 3)} ${top + depth}V${h - 2}H2Z M${w - 2} ${top}H${n(cx + half)}L${n(cx + 3)} ${top + depth}V${h - 2}H${w - 2}Z" fill="var(--sec-wood)" stroke="var(--ink-2)" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M${n(cx - half)} ${top}L${n(cx - 3)} ${top + depth}H${n(cx + 3)}L${n(cx + half)} ${top}Z" fill="var(--head-soft)" stroke="var(--head)" stroke-width="1.6" stroke-linejoin="round"/>
    <text x="${cx}" y="${top + depth - 4.5}" text-anchor="middle" class="cone-deg">${angle}°</text>
  </svg>`;
}

// ---------- Icons ----------
const ICONS = {
  wood: '<path d="M7 4.5h14l-5 5.5h-4z"/><path d="M12 10v11.5l2 4 2-4V10"/><path d="M12 13l4-1.6M12 16.4l4-1.6M12 19.8l4-1.6"/><path d="M10.5 5.5h7"/>',
  machine: '<rect x="9" y="3.5" width="10" height="7" rx="1.6"/><path d="M12.3 5.6h3.4l.9 1.4-.9 1.4h-3.4l-.9-1.4z"/><path d="M11.5 10.5v15h5v-15"/><path d="M11.5 13.5l5-1.4M11.5 16.5l5-1.4M11.5 19.5l5-1.4M11.5 22.5l5-1.4"/>',
  lag: '<path d="M8.5 4h11v4.5h-11z"/><path d="M12 4v4.5M16 4v4.5"/><path d="M6.5 9.5h15"/><path d="M11.5 9.5v12l2.5 4.5 2.5-4.5v-12"/><path d="M11.5 14l5-2M11.5 18l5-2"/>',
  sheet: '<path d="M7.5 9.5c0-4 2.8-5.5 6.5-5.5s6.5 1.5 6.5 5.5z"/><path d="M11.8 9.5v12.5l2.2 4 2.2-4V9.5"/><path d="M11.8 12l4.4-1.3M11.8 14.8l4.4-1.3M11.8 17.6l4.4-1.3M11.8 20.4l4.4-1.3"/>',
  heatset: '<rect x="8.5" y="6" width="11" height="17" rx="1.5"/><path d="M8.5 9.5l11 3M8.5 13.5l11 3M8.5 17.5l11 3M19.5 9.5l-11 3M19.5 13.5l-11 3M19.5 17.5l-11 3" stroke-width="1.1"/><ellipse cx="14" cy="6" rx="2.6" ry="1"/>',
  insert: '<path d="M9 7h10v15.5H9z"/><path d="M7 9.5l14-1M7 13l14-1M7 16.5l14-1M7 20l14-1"/><path d="M12 7l1-2h2l1 2"/>',
  dowel: '<path d="M10 4.5h8l1.5 1.5v16l-1.5 1.5h-8L8.5 22V6z"/><path d="M11.5 6.5v15M14 6.5v15M16.5 6.5v15" stroke-width="1"/>',
  shelfpin: '<path d="M4.5 12.5h9.5"/><path d="M14 9.5h4.5c2 0 3 1.4 3 3v6.5h-7.5z"/><path d="M4.5 10v5"/>',
  hinge: '<circle cx="10.5" cy="14" r="6.2"/><circle cx="10.5" cy="14" r="3.4"/><path d="M16.7 12.2h7.3v3.6h-7.3"/><path d="M20 12.2v3.6"/>',
};
export function typeIcon(id, size = 28) {
  return `<svg class="ticon" viewBox="0 0 28 28" width="${size}" height="${size}" aria-hidden="true">${ICONS[id] || ''}</svg>`;
}

const HEAD_ICONS = {
  socket: '<rect x="4" y="3" width="12" height="7.5" rx="1.4"/><path d="M8 3.8h4M8.5 10.5v8.5h3v-8.5"/>',
  button: '<path d="M3.5 10c0-4.4 2.9-6.5 6.5-6.5s6.5 2.1 6.5 6.5z"/><path d="M8.5 10v9h3v-9"/>',
  flat: '<path d="M3 3.5h14l-5 6h-4z"/><path d="M8.5 9.5v9.5h3V9.5"/>',
  pan: '<path d="M3.5 10V7.4c0-2.6 1.8-3.9 6.5-3.9s6.5 1.3 6.5 3.9V10z"/><path d="M8.5 10v9h3v-9"/>',
  hex: '<path d="M3.5 3.5h13v7h-13z"/><path d="M7.8 3.5v7M12.2 3.5v7"/><path d="M8.5 10.5v8.5h3v-8.5"/>',
};
export const headIcon = id => `<svg class="hicon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${HEAD_ICONS[id] || ''}</svg>`;

export function swatch(id) {
  return `<svg class="swatch" viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><rect width="22" height="22" rx="5" class="sw sw-${id}"/>${id === 'plywood' || id === 'mdf' || id === 'hardwood' || id === 'softwood' || id === 'printed' || id === 'steel' || id === 'aluminium'
    ? `<rect width="22" height="22" rx="5" fill="url(#p-${{ hardwood: 'grain', softwood: 'grain', plywood: 'ply', mdf: 'mdf', printed: 'layers', steel: 'metal', aluminium: 'metal' }[id]})"/>` : ''}<rect x=".5" y=".5" width="21" height="21" rx="4.5" fill="none" stroke="rgba(0,0,0,.18)"/></svg>`;
}

// ---------- Sections through each kind of joint ----------
// The holes are coloured by role, the same as the cards: main (red), clear (blue), head (green).
const W = 330;
const fillFor = m => `m-${m}`;
function block(x, y, w, h, mat, face = false) {
  let pat = { hardwood: 'grain', softwood: 'grain', plywood: 'ply', mdf: 'mdf', printed: 'layers', steel: 'metal', aluminium: 'metal' }[mat];
  if (face && pat === 'ply') pat = 'grain';
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="blk ${fillFor(mat)}"/>`
    + (pat && pat !== 'ply' ? `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#p-${pat})"/>` : '')
    + (pat === 'ply' ? `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#p-ply)"/>` : '')
    + `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="edge"/>`;
}
const holeRect = (x, y, w, h, role) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="hole-cut r-${role}"/>`;
const holePath = (d, role) => `<path d="${d}" class="hole-cut r-${role}"/>`;
const ghost = d => `<path d="${d}" class="ghost"/>`;
function label(x, y, text, role, anchor = 'start', tx = null) {
  const lx = tx ?? (anchor === 'start' ? x + 26 : x - 26);
  return `<path d="M${n(x)} ${n(y)}H${n(lx + (anchor === 'start' ? -4 : 4))}" class="lead r-${role}"/><text x="${n(lx)}" y="${n(y + 4)}" text-anchor="${anchor}" class="lbl r-${role}">${text}</text>`;
}
function threadTicks(x, y0, y1, half, step) {
  let d = '';
  for (let y = y0 + step / 2; y < y1 - 1; y += step) d += `M${n(x - half - 3)} ${n(y)}l3 ${n(step / 2)}M${n(x + half + 3)} ${n(y)}l-3 ${n(step / 2)}`;
  return `<path d="${d}" class="threads"/>`;
}
const svg = (h, body, title) => `<svg class="section" viewBox="0 0 ${W} ${h}" role="img" aria-label="${title}">${body}</svg>`;

export function section(r) {
  const m = r.pick.material;
  const has = key => r.holes.find(h => h.key === key);
  const X = 120;           // the screw's axis
  const L = 'start';
  switch (r.diagram) {
    case 'wood': case 'lag': case 'sheet': {
      const lag = r.diagram === 'lag', sheet = r.diagram === 'sheet';
      const metal = ['steel', 'aluminium'].includes(m);
      const thin = sheet && metal;
      const topH = thin ? 20 : 36, topY = thin ? 34 : 22;
      const botY = topY + topH, botH = thin ? 20 : 70;
      const pilotW = 10, shankW = lag ? 17 : 15, headW = lag ? 34 : 36;
      let b = '';
      const topMat = sheet && metal ? m : (['steel', 'aluminium'].includes(m) ? m : m);
      b += block(20, topY, 200, topH, topMat);
      if (!r.warn) b += block(20, botY, 200, botH, m);
      const pilot = has('pilot') || has('lead');
      const shank = has('shank') || has('clear');
      const cs = has('csink');
      const csDepth = cs ? 10 : 0;
      // Holes
      if (cs) b += holePath(`M${X - headW / 2} ${topY}L${X - shankW / 2} ${topY + csDepth}H${X + shankW / 2}L${X + headW / 2} ${topY}Z`, 'head');
      if (shank) b += holeRect(X - shankW / 2, topY + csDepth, shankW, topH - csDepth, 'clear');
      if (pilot && !r.warn) {
        if (thin) b += holeRect(X - pilotW / 2, botY, pilotW, botH, 'main');
        else {
          const ph = botH - 16;
          b += holePath(`M${X - pilotW / 2} ${botY}V${botY + ph}L${X} ${botY + ph + 4}L${X + pilotW / 2} ${botY + ph}V${botY}Z`, 'main');
        }
      }
      // The screw, ghosted
      const tipY = r.warn ? botY + 30 : thin ? botY + botH + 26 : botY + botH - 14;
      if (lag) {
        b += ghost(`M${X - 22} ${topY - 2}h44M${X - 13} ${topY - 2}v-12h26v12M${X - 4.5} ${topY - 14}v12M${X + 4.5} ${topY - 14}v12`);
        b += ghost(`M${X - 8} ${topY}V${botY + 8}L${X - 6.5} ${tipY - 8}L${X} ${tipY}L${X + 6.5} ${tipY - 8}L${X + 8} ${botY + 8}V${topY}`);
      } else if (sheet) {
        b += ghost(`M${X - 15} ${topY}c0-9 6-12 15-12s15 3 15 12z`);
        b += ghost(`M${X - 6.5} ${topY}V${tipY - 9}L${X} ${tipY}L${X + 6.5} ${tipY - 9}V${topY}`);
      } else {
        b += ghost(`M${X - headW / 2 + 1} ${topY}H${X + headW / 2 - 1}L${X + 7} ${topY + csDepth}V${botY + 4}L${X + 6} ${tipY - 10}L${X} ${tipY}L${X - 6} ${tipY - 10}L${X - 7} ${botY + 4}V${topY + csDepth}Z`);
      }
      let zz = '';
      const t0 = lag || sheet ? (sheet ? topY + 3 : botY - 4) : botY + 4;
      for (let y = t0; y < tipY - 12; y += 7) zz += `M${X - 8} ${y + 3.5}L${X + 8} ${y}`;
      b += `<path d="${zz}" class="ghost thin"/>`;
      // Labels on the right
      if (cs) b += label(X + headW / 2 - 2, topY + 3, 'countersink', 'head', L, 236);
      if (shank) b += label(X + shankW / 2, topY + topH * 0.55, lag ? 'shank hole' : sheet || r.warn ? 'clearance' : 'shank hole', 'clear', L, 236);
      if (pilot && !r.warn) b += label(X + pilotW / 2, botY + botH * 0.55, lag ? 'lead hole' : 'pilot hole', 'main', L, 236);
      return svg(r.warn ? topY + topH + 50 : thin ? tipY + 8 : botY + botH + 8, b, `A section through the joint: ${r.holes.map(h => h.name.toLowerCase()).join(', ')}`);
    }
    case 'tapped': case 'bolt': {
      const bolt = r.diagram === 'bolt';
      const topY = 26, topH = 30, botY = topY + topH, botH = bolt ? 44 : 66;
      const clearW = 15, tapW = 11, cbW = 30, cbD = 12;
      const cb = has('cbore'), cs = has('csink');
      let b = block(20, topY, 200, topH, bolt ? m : m === 'printed' ? 'printed' : m);
      b += block(20, botY, 200, botH, m);
      const recess = cb ? cbD : cs ? 10 : 0;
      if (cb) b += holeRect(X - cbW / 2, topY, cbW, cbD, 'head');
      if (cs) b += holePath(`M${X - 17} ${topY}L${X - clearW / 2} ${topY + 10}H${X + clearW / 2}L${X + 17} ${topY}Z`, 'head');
      b += holeRect(X - clearW / 2, topY + recess, clearW, topH - recess, 'clear');
      let tipY;
      if (bolt) {
        b += holeRect(X - clearW / 2, botY, clearW, botH, 'clear');
        tipY = botY + botH + 16;
      } else {
        const depth = botH - 18;
        b += holePath(`M${X - tapW / 2} ${botY}V${botY + depth}L${X} ${botY + depth + 4}L${X + tapW / 2} ${botY + depth}V${botY}Z`, 'main');
        b += threadTicks(X, botY, botY + depth - 8, tapW / 2, 4.5);
        tipY = botY + depth - 8;
      }
      // The screw: head, shank, then a nut and washer on the back for a through bolt
      const hk = r.pick.head;
      const headTop = cb ? topY + cbD - 11 : topY - 11;
      if (hk === 'socket') b += ghost(`M${X - 13} ${headTop}h26v11h-26z M${X - 4} ${headTop}v4h8v-4`);
      else if (hk === 'button') b += ghost(`M${X - 15} ${topY}c0-8 6-11 15-11s15 3 15 11z`);
      else if (hk === 'flat') b += ghost(`M${X - 16} ${topY}H${X + 16}L${X + 6} ${topY + 10}H${X - 6}Z`);
      else if (hk === 'pan') b += ghost(`M${X - 15} ${topY}v-5c0-4 4-6 15-6s15 2 15 6v5z`);
      else b += ghost(`M${X - 18} ${topY - 2}h36M${X - 14} ${topY - 2}v-10h28v10M${X - 5} ${topY - 12}v10M${X + 5} ${topY - 12}v10`);
      b += ghost(`M${X - 6} ${cs ? topY + 10 : topY}V${tipY}H${X + 6}V${cs ? topY + 10 : topY}`);
      let zz = '';
      for (let y = bolt ? botY + botH - 4 : botY + 2; y < tipY - 3; y += 4.5) zz += `M${X - 6} ${y + 2.2}L${X + 6} ${y}`;
      b += `<path d="${zz}" class="ghost thin"/>`;
      if (bolt) b += ghost(`M${X - 18} ${botY + botH + 1}h36M${X - 13} ${botY + botH + 2.5}h26v9h-26zM${X - 4.5} ${botY + botH + 2.5}v9M${X + 4.5} ${botY + botH + 2.5}v9`);
      if (cb) b += label(X + cbW / 2, topY + 5, 'counterbore', 'head', L, 236);
      if (cs) b += label(X + 15, topY + 3, 'countersink', 'head', L, 236);
      b += label(X + clearW / 2, topY + topH - 8, bolt ? 'through hole' : 'clearance', 'clear', L, 236);
      if (!bolt) b += label(X + tapW / 2 + 3, botY + 26, 'tap drill', 'main', L, 236);
      return svg(bolt ? botY + botH + 22 : botY + botH + 8, b, `A section through the joint: ${r.holes.map(h => h.name.toLowerCase()).join(', ')}`);
    }
    case 'heatset': case 'insert': {
      const heat = r.diagram === 'heatset';
      const topY = 22, topH = 20, botY = 50, botH = 64;
      const insW = 26, holeW = 22, clearW = 13, depth = 42;
      let b = block(20, topY, 200, topH, heat ? 'printed' : m);
      b += block(20, botY, 200, botH, heat ? 'printed' : m);
      b += holeRect(X - clearW / 2, topY, clearW, topH, 'clear');
      b += holeRect(X - holeW / 2, botY, holeW, depth, 'main');
      // The insert in its hole
      if (heat) {
        let k = '';
        for (let y = botY + 3; y < botY + 33; y += 6) k += `M${X - insW / 2} ${y}l${insW} 4M${X + insW / 2} ${y}l${-insW} 4`;
        b += `<rect x="${X - insW / 2}" y="${botY}" width="${insW}" height="34" rx="2" class="brass"/><path d="${k}" class="knurl"/>`;
      } else {
        let k = '';
        for (let y = botY + 2; y < botY + 36; y += 7) k += `M${X - insW / 2 - 3} ${y + 3}L${X + insW / 2 + 3} ${y}`;
        b += `<rect x="${X - insW / 2 + 2}" y="${botY}" width="${insW - 4}" height="38" class="brass"/><path d="${k}" class="knurl"/>`;
      }
      b += `<rect x="${X - 6}" y="${botY}" width="12" height="${heat ? 34 : 38}" class="bore"/>`;
      b += ghost(`M${X - 13} ${topY - 11}h26v11h-26z M${X - 6} ${topY}V${botY + 26}H${X + 6}V${topY}`);
      b += label(X + clearW / 2, topY + 10, 'clearance', 'clear', L, 236);
      b += label(X + holeW / 2, botY + depth - 6, heat ? 'insert hole' : 'insert hole', 'main', L, 236);
      return svg(botY + botH + 8, b, `A section: ${r.holes.map(h => h.name.toLowerCase()).join(', ')}`);
    }
    case 'dowel': {
      const y = 20, h = 70, jx = 165, depth = 58, dw = 16;
      let b = block(20, y, jx - 20, h, m) + block(jx, y, 310 - jx, h, m);
      b += holeRect(jx - depth, y + h / 2 - dw / 2, depth, dw, 'main');
      b += holeRect(jx, y + h / 2 - dw / 2, depth, dw, 'main');
      b += ghost(`M${jx - depth + 3} ${y + h / 2 - dw / 2 + 2}h${depth * 2 - 6}v${dw - 4}h${-(depth * 2 - 6)}z`);
      let fl = '';
      for (let x = jx - depth + 10; x < jx + depth - 8; x += 9) fl += `M${x} ${y + h / 2 - dw / 2 + 3}v${dw - 6}`;
      b += `<path d="${fl}" class="ghost thin"/>`;
      b += `<path d="M${jx} ${y - 6}v${h + 12}" class="joint"/>`;
      b += `<text x="${jx - depth / 2}" y="${y + h + 22}" text-anchor="middle" class="dim">depth</text><text x="${jx + depth / 2}" y="${y + h + 22}" text-anchor="middle" class="dim">depth</text>`;
      b += `<path d="M${jx - depth} ${y + h + 9}h${depth}M${jx} ${y + h + 9}h${depth}" class="dimline"/>`;
      return svg(y + h + 30, b, 'A section through a doweled joint, a hole in each piece');
    }
    case 'shelfpin': {
      // The inside face of a cabinet side, front edge on the left: two rows of holes, a pin in each at one height,
      // and the shelf resting on them. On the 32 mm system the rows are 37 mm in and the holes 32 mm apart.
      const metric = r.pick.size === '5';
      const sc = 1.9, ex = 34, top = 14, wide = 262, tall = 166;
      let b = block(ex, top, wide, tall, m, true);
      b += `<path d="M${ex} ${top - 4}v${tall + 8}" class="door-edge"/>`;
      const fx = ex + 37 * sc, bx = ex + wide - 37 * sc, rows = [top + 22, top + 22 + 32 * sc, top + 22 + 64 * sc];
      const hr = (metric ? 5 : 6.35) * sc / 2 + 1;
      for (const y of rows) for (const x of [fx, bx]) b += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(hr)}" class="hole-cut r-main"/>`;
      const py = rows[1];
      for (const x of [fx, bx]) b += `<path d="M${n(x - 4)} ${n(py - 3)}h${n(x === fx ? 20 : -12)}v-5h${n(x === fx ? -24 : 16)}z" class="pin"/>`;
      b += `<path d="M${ex + 4} ${n(py - 9)}H${ex + wide - 4}" class="shelf-line"/><text x="${n((fx + bx) / 2)}" y="${n(py - 14)}" text-anchor="middle" class="dim">shelf</text>`;
      if (metric) {
        b += `<path d="M${ex} ${top + tall + 12}H${n(fx)}" class="dimline"/><text x="${n((ex + fx) / 2)}" y="${top + tall + 26}" text-anchor="middle" class="dim">37</text>`;
        b += `<path d="M${n(fx - 16)} ${n(rows[1])}V${n(rows[2])}" class="dimline"/><text x="${n(fx - 20)}" y="${n((rows[1] + rows[2]) / 2 + 4)}" text-anchor="end" class="dim">32</text>`;
      }
      b += `<text x="${ex + 6}" y="${top + tall + (metric ? 40 : 18)}" class="dim">← front edge</text>`;
      return svg(top + tall + (metric ? 46 : 24), b, metric ? 'The inside of a cabinet side: rows of 5 mm holes 37 mm in from the edges and 32 mm apart, with a shelf on two pins' : 'The inside of a cabinet side: rows of shelf-pin holes with a shelf on two pins');
    }
    case 'hinge': {
      // The back of a door at its hinge edge: the cup, and the two screw holes beside it.
      const ex = 40, cy = 92, s = 2.6; // 2.6 px per mm
      const cx = ex + 22.5 * s, rr = 17.5 * s;
      let b = block(ex, 12, 250, 160, m, true);
      b += `<circle cx="${n(cx)}" cy="${cy}" r="${n(rr)}" class="hole-cut r-main"/>`;
      b += `<circle cx="${n(cx)}" cy="${cy}" r="${n(rr - 9)}" class="cup-floor"/>`;
      const sx = cx + 9.5 * s;
      b += `<circle cx="${n(sx)}" cy="${n(cy - 22.5 * s)}" r="4.5" class="hole-cut r-clear"/><circle cx="${n(sx)}" cy="${n(cy + 22.5 * s)}" r="4.5" class="hole-cut r-clear"/>`;
      b += `<path d="M${ex} ${cy}H${n(cx)}" class="dimline"/><text x="${n((ex + cx) / 2 + 2)}" y="${cy - 7}" text-anchor="middle" class="dim on-wood">22.5</text>`;
      b += `<path d="M${n(sx + 30)} ${n(cy - 22.5 * s)}V${n(cy + 22.5 * s)}M${n(sx + 6)} ${n(cy - 22.5 * s)}h28M${n(sx + 6)} ${n(cy + 22.5 * s)}h28" class="dimline"/><text x="${n(sx + 36)}" y="${cy + 4}" class="dim on-wood">45</text>`;
      b += `<path d="M${n(cx)} ${n(cy + rr + 2)}v14M${n(sx)} ${n(cy + 22.5 * s + 6)}V${n(cy + rr + 16)}M${n(cx)} ${n(cy + rr + 12)}H${n(sx)}" class="dimline"/><text x="${n(sx + 6)}" y="${n(cy + rr + 16)}" class="dim on-wood">9.5</text>`;
      b += `<path d="M${ex} 6v172" class="door-edge"/><text x="${ex + 6}" y="186" class="dim">door edge</text>`;
      return svg(192, b, 'The back of a door: a 35 mm cup 22.5 mm in from the edge, and screw holes 45 mm apart');
    }
    default: return '';
  }
}
