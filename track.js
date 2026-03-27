// track.js — RETRO BLAZE track renderer
// Improvements: richer backgrounds, crowd dots, finish flash, particle effects

const TRACK_CONFIG = {
  indoor: {
    color: '#C25B1A', colorDark: '#7A3208', colorLight: '#D4763A',
    infield: '#2A5A28', infieldLine: '#3A7A36',
    lanes: 6, laneWidth: 30, label: 'INDOOR OVAL',
    bgSky0: '#12101C', bgSky1: '#201830',
  },
  outdoor: {
    color: '#C84B1A', colorDark: '#7A2E08', colorLight: '#D46640',
    infield: '#2D6A2A', infieldLine: '#3E8A38',
    lanes: 8, laneWidth: 28, label: 'OUTDOOR STADIUM',
    bgSky0: '#182840', bgSky1: '#2A4A80',
  }
};

// ── OVAL GEOMETRY ─────────────────────────────────────
function ovalPos(t, cx, cy, R, S) {
  t = ((t % 1) + 1) % 1;
  const LA = Math.PI * R, LB = 2 * S, LC = Math.PI * R, LD = 2 * S;
  const P  = LA + LB + LC + LD;
  let d = t * P;
  if (d < LA) {
    const a = -Math.PI / 2 + (d / LA) * Math.PI;
    return { x: (cx + S) + Math.cos(a) * R, y: cy + Math.sin(a) * R, tx: -Math.sin(a), ty: Math.cos(a) };
  }
  d -= LA;
  if (d < LB) {
    const f = d / LB;
    return { x: cx + S - f * 2 * S, y: cy + R, tx: -1, ty: 0 };
  }
  d -= LB;
  if (d < LC) {
    const a = Math.PI / 2 + (d / LC) * Math.PI;
    return { x: (cx - S) + Math.cos(a) * R, y: cy + Math.sin(a) * R, tx: -Math.sin(a), ty: Math.cos(a) };
  }
  d -= LC;
  const f = d / LD;
  return { x: cx - S + f * 2 * S, y: cy - R, tx: 1, ty: 0 };
}

function ovalPath(ctx, cx, cy, R, S) {
  ctx.beginPath();
  ctx.arc(cx + S, cy, R, -Math.PI / 2, Math.PI / 2, false);
  ctx.arc(cx - S, cy, R,  Math.PI / 2, -Math.PI / 2, false);
  ctx.closePath();
}

function calcGeo(W, H, venueType, margin) {
  const cfg    = TRACK_CONFIG[venueType];
  const lanes  = cfg.lanes;
  let   laneW  = cfg.laneWidth;
  const avW    = W - margin * 2;
  const avH    = H - margin * 2;
  let outerR = avH / 2;
  let S      = avW / 2 - outerR;
  if (S < outerR * 0.15) {
    const scale = avW / (avH * 1.6);
    outerR = (avH / 2) * scale;
    S = avW / 2 - outerR;
  }
  if (S < 10) S = 10;
  const minInner = outerR * 0.30;
  if (outerR - lanes * laneW < minInner)
    laneW = Math.floor((outerR - minInner) / lanes);
  const innerR    = outerR - lanes * laneW;
  const laneRadii = Array.from({ length: lanes + 1 }, (_, i) => innerR + i * laneW);
  return { cx: W / 2, cy: H / 2, innerR, outerR, S, lanes, laneW, laneRadii };
}

// ── PREVIEW ───────────────────────────────────────────
function drawTrackPreview(canvas, venueType) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cfg = TRACK_CONFIG[venueType];
  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, cfg.bgSky0);
  sky.addColorStop(1, cfg.bgSky1);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  const geo = calcGeo(W, H, venueType, 18);
  const { cx, cy, innerR, outerR, S, laneRadii, lanes } = geo;

  // Outer shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ovalPath(ctx, cx + 4, cy + 5, outerR + 4, S); ctx.fill();

  // Track outer band
  ctx.fillStyle = cfg.colorDark;
  ovalPath(ctx, cx, cy, outerR + 3, S); ctx.fill();

  // Lane fills
  for (let i = lanes; i >= 1; i--) {
    ctx.fillStyle = i % 2 === 0 ? cfg.color : cfg.colorLight;
    ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.fill();
  }

  // Infield gradient
  const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  ig.addColorStop(0, cfg.infieldLine);
  ig.addColorStop(0.7, cfg.infield);
  ig.addColorStop(1, '#1A3018');
  ovalPath(ctx, cx, cy, innerR, S);
  ctx.fillStyle = ig; ctx.fill();

  // Lane lines
  for (let i = 0; i <= lanes; i++) {
    ctx.strokeStyle = (i === 0 || i === lanes) ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = (i === 0 || i === lanes) ? 1.8 : 0.7;
    ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.stroke();
  }

  // Start/finish line (mini checkerboard)
  _miniChecker(ctx, cx, cy, innerR, outerR, S, 0.0);

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 9px "Press Start 2P",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(cfg.label, cx, H - 6);
}

function _miniChecker(ctx, cx, cy, innerR, outerR, S, t) {
  const pO = ovalPos(t, cx, cy, outerR, S);
  const pI = ovalPos(t, cx, cy, innerR, S);
  const dx = pO.x - pI.x, dy = pO.y - pI.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist, ny = dy / dist;
  const strips = 6, sw = dist / strips, thick = 3;
  const px = pI.tx, py = pI.ty;
  for (let i = 0; i < strips; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'white' : '#111';
    ctx.beginPath();
    const bx = pI.x + nx * i * sw, by = pI.y + ny * i * sw;
    ctx.moveTo(bx - px * thick, by - py * thick);
    ctx.lineTo(bx + nx * sw - px * thick, by + ny * sw - py * thick);
    ctx.lineTo(bx + nx * sw + px * thick, by + ny * sw + py * thick);
    ctx.lineTo(bx + px * thick, by + py * thick);
    ctx.closePath(); ctx.fill();
  }
}

// ── RACE TRACK CLASS ─────────────────────────────────
class RaceTrack {
  constructor(canvas, venueType, eventMeters) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.venueType   = venueType;
    this.eventMeters = eventMeters;
    this.cfg         = TRACK_CONFIG[venueType];
    this.totalLaps   = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;
    this.raceType    = (eventMeters === 60 || eventMeters === 100) ? 'straight' : 'oval';
    this.startT      = (venueType === 'outdoor' && eventMeters === 200) ? 0.5 : 0.0;
    this.ovalFrac    = (venueType === 'outdoor' && eventMeters === 200) ? 0.5 : 1.0;

    // Finish flash
    this.finishFlash = 0;
    // Particles
    this.particles = [];
    // Crowd dots (static, generated once)
    this.crowdDots = null;

    this._resize();
  }

  _resize() {
    const c = this.canvas;
    this.W = c.width  = c.offsetWidth  || window.innerWidth;
    this.H = c.height = c.offsetHeight || (window.innerHeight - 120);
    this.crowdDots = null; // regenerate on resize
  }

  triggerFinishFlash() {
    this.finishFlash = 1.0;
    // Spawn confetti particles
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: this.W / 2 + (Math.random() - 0.5) * 200,
        y: this.H * 0.4,
        vx: (Math.random() - 0.5) * 180,
        vy: -Math.random() * 220 - 60,
        color: ['#F5B800','#E83020','#4080FF','#2ECC71','#F5E6C8'][Math.floor(Math.random() * 5)],
        size: 3 + Math.random() * 5,
        life: 1.0,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  draw(playerProgress, runners, dt = 0.016) {
    this._resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.raceType === 'straight') {
      this._drawStraight(playerProgress, runners);
    } else {
      this._drawOval(playerProgress, runners);
    }

    // Particles
    this._updateParticles(dt);
    this._drawParticles();

    // Finish flash overlay
    if (this.finishFlash > 0) {
      ctx.fillStyle = `rgba(245,184,0,${this.finishFlash * 0.25})`;
      ctx.fillRect(0, 0, this.W, this.H);
      this.finishFlash = Math.max(0, this.finishFlash - dt * 2.5);
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt; // gravity
      p.rot += p.rotSpeed * dt;
      p.life -= dt * 0.9;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
  }

  // ── STRAIGHT RACE ───────────────────────────────────
  _drawStraight(progress, runners) {
    const ctx = this.ctx, W = this.W, H = this.H, cfg = this.cfg;
    const lanes = cfg.lanes;
    const WORLD = W * 4;
    const camX  = progress * WORLD - W * 0.28;

    // Background
    this._bgStraight(ctx, W, H);

    const tTop = Math.round(H * 0.25);
    const tBot = Math.round(H * 0.88);
    const lH   = (tBot - tTop) / lanes;

    // Grass bands
    const grassGrad = ctx.createLinearGradient(0, 0, 0, tTop + 2);
    grassGrad.addColorStop(0, cfg.infield);
    grassGrad.addColorStop(1, cfg.infieldLine);
    ctx.fillStyle = grassGrad; ctx.fillRect(0, 0, W, tTop + 2);

    const grassBot = ctx.createLinearGradient(0, tBot - 2, 0, H);
    grassBot.addColorStop(0, cfg.infieldLine);
    grassBot.addColorStop(1, cfg.infield);
    ctx.fillStyle = grassBot; ctx.fillRect(0, tBot - 2, W, H - (tBot - 2));

    // Track surface gradient
    const tg = ctx.createLinearGradient(0, tTop, 0, tBot);
    tg.addColorStop(0, cfg.colorLight);
    tg.addColorStop(0.35, cfg.color);
    tg.addColorStop(1, cfg.colorDark);
    ctx.fillStyle = tg; ctx.fillRect(0, tTop, W, tBot - tTop);

    // Subtle inner shadow on track edges
    const edgeShadow = ctx.createLinearGradient(0, tTop, 0, tTop + 12);
    edgeShadow.addColorStop(0, 'rgba(0,0,0,0.3)');
    edgeShadow.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeShadow; ctx.fillRect(0, tTop, W, 12);

    // Crowd in stands (simple dots)
    this._drawCrowdStraight(ctx, W, tTop, tBot, H);

    // Lane lines
    for (let l = 0; l <= lanes; l++) {
      const y = tTop + l * lH;
      const isBorder = l === 0 || l === lanes;
      ctx.strokeStyle = isBorder ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.32)';
      ctx.lineWidth   = isBorder ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Lane numbers
    for (let l = 0; l < lanes; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.font = '10px "Press Start 2P",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(l + 1, 8, tTop + l * lH + lH / 2);
    }

    // Distance markers
    ctx.save(); ctx.setLineDash([4, 9]); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let m = 10; m < this.eventMeters; m += 10) {
      const sx = (m / this.eventMeters) * WORLD - camX;
      if (sx < -10 || sx > W + 10) continue;
      ctx.beginPath(); ctx.moveTo(sx, tTop); ctx.lineTo(sx, tBot); ctx.stroke();
      if (m % 20 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px "Press Start 2P",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(m + 'm', sx, tTop - 3);
      }
    }
    ctx.restore();

    // Start line
    const startSX = -camX;
    if (startSX > -20 && startSX < W + 20) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(startSX, tTop); ctx.lineTo(startSX, tBot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = 'bold 10px "Press Start 2P",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('START', startSX, tTop - 3);
    }

    // Finish line — checkerboard
    const finSX = WORLD - camX;
    if (finSX > -20 && finSX < W + 20) {
      this._checker(ctx, finSX - 5, tTop, 10, tBot - tTop, 14);
      ctx.fillStyle = 'white'; ctx.font = 'bold 12px "Press Start 2P",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('FINISH', finSX, tTop - 4);
    }

    // Runners (sort by lane — lower lanes in front)
    [...runners].sort((a, b) => a.lane - b.lane).forEach(r => {
      const sx = (r.progress * WORLD) - camX;
      if (sx < -100 || sx > W + 100) return;
      const sy = tTop + (r.lane + 0.5) * lH;
      const spd = r.isPlayer ? r.speed : (r.speed || 0);
      this._spriteUpright(ctx, r, sx, sy, 0.92, spd);
      if (r.isPlayer) this._youLabel(ctx, sx, sy - 38);
    });

    this._miniLinear(ctx, W, H, progress, runners);
  }

  _drawCrowdStraight(ctx, W, tTop, tBot, H) {
    // Simple crowd dots above and below track
    const rng = this._seededRng(42);
    const dotCount = 80;
    ctx.save();
    for (let i = 0; i < dotCount; i++) {
      const x = rng() * W;
      // Above track
      const y1 = rng() * (tTop - 14) + 2;
      const cr = ['#8B4A14','#C8956C','#1A3050','#F5E6C8','#6B3A2A'][Math.floor(rng() * 5)];
      ctx.fillStyle = cr; ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.round(x), Math.round(y1), 4, 5);
      // Below track
      const y2 = tBot + 10 + rng() * (H - tBot - 14);
      ctx.fillStyle = cr;
      ctx.fillRect(Math.round(x), Math.round(y2), 4, 5);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _seededRng(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF; };
  }

  // ── OVAL RACE ───────────────────────────────────────
  _drawOval(progress, runners) {
    const ctx = this.ctx, W = this.W, H = this.H, cfg = this.cfg;
    const geo = calcGeo(W, H, this.venueType, 52);
    const { cx, cy, innerR, outerR, S, lanes, laneW, laneRadii } = geo;

    // Background
    this._bgOval(ctx, W, H, geo);

    // Grass fill
    const grassFill = ctx.createRadialGradient(cx, cy, outerR, cx, cy, Math.max(W, H));
    grassFill.addColorStop(0, cfg.infield);
    grassFill.addColorStop(1, '#1A3018');
    ctx.fillStyle = grassFill; ctx.fillRect(0, 0, W, H);

    // Crowd in stands around oval
    this._drawCrowdOval(ctx, cx, cy, outerR, S);

    // Track outer shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ovalPath(ctx, cx + 5, cy + 6, outerR + 5, S); ctx.fill();

    // Track outer band
    ctx.fillStyle = cfg.colorDark;
    ovalPath(ctx, cx, cy, outerR + 5, S); ctx.fill();

    // Alternating lane fills
    for (let i = lanes; i >= 1; i--) {
      ctx.fillStyle = i % 2 === 0 ? cfg.color : cfg.colorLight;
      ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.fill();
    }

    // Infield
    const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    ig.addColorStop(0, cfg.infieldLine);
    ig.addColorStop(0.55, cfg.infield);
    ig.addColorStop(1, '#182E16');
    ovalPath(ctx, cx, cy, innerR, S);
    ctx.fillStyle = ig; ctx.fill();

    // Infield logo text
    ctx.save();
    ctx.font = `bold ${Math.round(innerR * 0.1)}px "Press Start 2P",monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RETRO BLAZE', cx, cy - innerR * 0.05);
    ctx.restore();

    // Lane lines
    for (let i = 0; i <= lanes; i++) {
      const isBorder = i === 0 || i === lanes;
      ctx.strokeStyle = isBorder ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth   = isBorder ? 2.2 : 0.8;
      ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.stroke();
    }

    // Start / finish lines
    const isOutdoor200 = this.venueType === 'outdoor' && this.eventMeters === 200;
    this._drawLineAcrossTrack(ctx, cx, cy, innerR, outerR, S, laneRadii, lanes, 0.0, true,
      isOutdoor200 ? 'FINISH' : 'START / FINISH');
    if (isOutdoor200) {
      this._drawLineAcrossTrack(ctx, cx, cy, innerR, outerR, S, laneRadii, lanes, 0.5, false, 'START');
      this._staggerMarks(ctx, cx, cy, innerR, S, laneRadii, lanes, laneW, 0.5);
    }
    if (this.eventMeters === 400) {
      this._staggerMarks(ctx, cx, cy, innerR, S, laneRadii, lanes, laneW, 0.0);
    }

    // Lane numbers
    ctx.font = `bold ${Math.round(laneW * 0.52)}px "Press Start 2P",monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < lanes; i++) {
      const r = (laneRadii[i] + laneRadii[i + 1]) / 2;
      const p = ovalPos(0.54, cx, cy, r, S);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(i + 1, p.x, p.y);
    }

    // Runners
    const runnerPositions = runners.map(r => {
      const st    = r.staggerT || 0;
      const ovalT = ((this.startT + st + r.progress * this.ovalFrac * this.totalLaps) % 1 + 1) % 1;
      const laneIdx = Math.max(0, Math.min(r.lane, lanes - 1));
      const laneR   = (laneRadii[laneIdx] + laneRadii[laneIdx + 1]) / 2;
      const pos     = ovalPos(ovalT, cx, cy, laneR, S);
      return { runner: r, x: pos.x, y: pos.y, tx: pos.tx, ty: pos.ty };
    });

    // Sort bottom-up
    runnerPositions.sort((a, b) => a.y - b.y);
    runnerPositions.forEach(({ runner, x, y, tx }) => {
      this._spriteOval(ctx, runner, x, y, tx);
    });

    // Player glow + YOU label
    const player = runnerPositions.find(d => d.runner.isPlayer);
    if (player) {
      const spd = player.runner.speed || 0;
      const glowAlpha = Math.min(0.8, spd / 15);
      const gl = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 24);
      gl.addColorStop(0, `rgba(245,184,0,${glowAlpha * 0.6})`);
      gl.addColorStop(1, 'transparent');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(player.x, player.y, 24, 0, Math.PI * 2); ctx.fill();
      this._youLabel(ctx, player.x, player.y - 28);
    }

    this._ovalHUD(ctx, W, H, progress);
  }

  _drawCrowdOval(ctx, cx, cy, outerR, S) {
    const rng = this._seededRng(99);
    const count = 120;
    ctx.save(); ctx.globalAlpha = 0.45;
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radOff = outerR + 14 + rng() * 28;
      // Crowd on straight sections
      const straightMod = Math.abs(Math.cos(angle * 2));
      const sx = cx + (S * Math.sign(Math.cos(angle)) * straightMod * 0.5) + Math.cos(angle) * radOff;
      const sy = cy + Math.sin(angle) * (outerR + 14 + rng() * 18);
      const cr = ['#8B4A14','#C8956C','#1A3050','#F5E6C8','#2A5A28','#6B3A2A'][Math.floor(rng() * 6)];
      ctx.fillStyle = cr;
      ctx.fillRect(Math.round(sx), Math.round(sy), 4, 5);
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  _drawLineAcrossTrack(ctx, cx, cy, innerR, outerR, S, laneRadii, lanes, t, isFinish, label) {
    const pOuter = ovalPos(t, cx, cy, outerR, S);
    const pInner = ovalPos(t, cx, cy, innerR, S);
    if (isFinish) {
      const dx = pOuter.x - pInner.x, dy = pOuter.y - pInner.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / dist, ny = dy / dist;
      const strips = 8, sw = dist / strips, thick = 5;
      const px = pInner.tx, py = pInner.ty;
      for (let i = 0; i < strips; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'white' : '#111';
        ctx.beginPath();
        const bx = pInner.x + nx * i * sw, by = pInner.y + ny * i * sw;
        ctx.moveTo(bx - px * thick, by - py * thick);
        ctx.lineTo(bx + nx * sw - px * thick, by + ny * sw - py * thick);
        ctx.lineTo(bx + nx * sw + px * thick, by + ny * sw + py * thick);
        ctx.lineTo(bx + px * thick, by + py * thick);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pOuter.x, pOuter.y); ctx.lineTo(pInner.x, pInner.y); ctx.stroke();
    }
    const midX = (pOuter.x + pInner.x) / 2, midY = (pOuter.y + pInner.y) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.round(Math.max(7, (outerR - innerR) * 0.13))}px "Press Start 2P",monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(label, midX, midY - 5);
  }

  _staggerMarks(ctx, cx, cy, innerR, S, laneRadii, lanes, laneW, baseT = 0) {
    const innerPerim = 2 * Math.PI * innerR + 4 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    for (let i = 1; i < lanes; i++) {
      const laneR     = (laneRadii[i] + laneRadii[i + 1]) / 2;
      const lanePerim = 2 * Math.PI * laneR + 4 * S;
      const staggerFrac = (lanePerim - innerPerim) / lanePerim;
      if (staggerFrac <= 0) continue;
      const t   = ((baseT + staggerFrac) % 1 + 1) % 1;
      const pos = ovalPos(t, cx, cy, laneR, S);
      const px  = -pos.ty, py = pos.tx;
      ctx.beginPath();
      ctx.moveTo(pos.x + px * laneW * 0.55, pos.y + py * laneW * 0.55);
      ctx.lineTo(pos.x - px * laneW * 0.55, pos.y - py * laneW * 0.55);
      ctx.stroke();
    }
  }

  // ── SPRITE HELPERS ─────────────────────────────────
  _spriteUpright(ctx, runner, x, y, scale, speed = 0) {
    if (runner.isPlayer)
      drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], x, y, runner.frame, true, scale, speed);
    else
      drawOpponent(ctx, x, y, runner.frame, runner.color, runner.skinTone, scale, 0);
  }

  _spriteOval(ctx, runner, x, y, tx) {
    const facingRight = tx >= 0;
    const scale = 0.70;
    const speed = runner.isPlayer ? (runner.speed || 0) : 0;
    if (runner.isPlayer)
      drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], x, y, runner.frame, facingRight, scale, speed);
    else
      drawOpponent(ctx, x, y, runner.frame, runner.color, runner.skinTone, scale, 0);
  }

  _youLabel(ctx, x, y) {
    ctx.save();
    ctx.font = 'bold 11px "Press Start 2P",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3.5;
    ctx.strokeText('YOU ▼', x, y);
    ctx.fillStyle = '#FFD060'; ctx.fillText('YOU ▼', x, y);
    ctx.restore();
  }

  _checker(ctx, x, y, w, h, rows) {
    const rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? 'white' : '#111';
      ctx.fillRect(x + c * (w / 2), y + r * rh, w / 2, rh);
    }
  }

  // ── MINIMAPS / HUD ─────────────────────────────────
  _miniLinear(ctx, W, H, progress, runners) {
    const mW = 220, mH = 42, mX = W / 2 - mW / 2, mY = H - mH - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath(); ctx.roundRect(mX, mY, mW, mH, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

    const bX = mX + 12, bW = mW - 24, bY = mY + 18, bH = 9;
    // Track bar
    ctx.fillStyle = this.cfg.colorDark; ctx.fillRect(bX, bY, bW, bH);
    // Progress fill
    const pFill = ctx.createLinearGradient(bX, 0, bX + bW, 0);
    pFill.addColorStop(0, '#F07010');
    pFill.addColorStop(1, '#F5B800');
    ctx.fillStyle = pFill; ctx.fillRect(bX, bY, progress * bW, bH);
    // Finish line
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bX + bW, bY - 4); ctx.lineTo(bX + bW, bY + bH + 4); ctx.stroke();

    // Runner dots
    runners.forEach(r => {
      const dx = bX + r.progress * bW, dy = bY + bH / 2;
      ctx.fillStyle = r.isPlayer ? '#F5B800' : r.color || '#888';
      ctx.beginPath(); ctx.arc(dx, dy, r.isPlayer ? 5.5 : 3, 0, Math.PI * 2); ctx.fill();
      if (r.isPlayer) { ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke(); }
    });

    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '8px "Press Start 2P",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(this.eventMeters + 'm', mX + mW / 2, mY + 4);
  }

  _ovalHUD(ctx, W, H, progress) {
    const lap     = Math.min(this.totalLaps, Math.floor(progress * this.totalLaps) + 1);
    const lapFrac = this.totalLaps > 1 ? (progress * this.totalLaps) % 1 : progress;
    const bX = 14, bY = 16, bW = 170, bH = 9;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect(bX - 10, bY - 22, bW + 20, bH + 38, 4); ctx.fill();
    ctx.fillStyle = this.cfg.colorDark; ctx.fillRect(bX, bY, bW, bH);
    const pf = ctx.createLinearGradient(bX, 0, bX + bW, 0);
    pf.addColorStop(0, '#F07010'); pf.addColorStop(1, '#F5B800');
    ctx.fillStyle = pf; ctx.fillRect(bX, bY, lapFrac * bW, bH);
    ctx.fillStyle = 'white'; ctx.font = 'bold 10px "Press Start 2P",monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(this.totalLaps > 1 ? 'LAP ' + lap + ' / ' + this.totalLaps : this.eventMeters + 'm', bX, bY - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '8px "Press Start 2P",monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.round(lapFrac * 100) + '% done', bX, bY + bH + 3);
  }

  // ── BACKGROUNDS ────────────────────────────────────
  _bgStraight(ctx, W, H) {
    const cfg = this.cfg;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.28);
    if (this.venueType === 'indoor') {
      sky.addColorStop(0, '#12101C'); sky.addColorStop(1, '#201830');
    } else {
      sky.addColorStop(0, '#182840'); sky.addColorStop(1, '#2A4A80');
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.28);

    if (this.venueType === 'indoor') {
      // Roof structure lines
      ctx.strokeStyle = 'rgba(80,60,120,0.28)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath(); ctx.moveTo((i / 9) * W, 0); ctx.lineTo(W / 2, H * 0.23); ctx.stroke();
      }
      // Arena lights
      [0.1, 0.3, 0.5, 0.7, 0.9].forEach(lx => {
        const px = lx * W;
        ctx.fillStyle = '#FFF8E0';
        ctx.beginPath(); ctx.ellipse(px, H * 0.09, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        const lg = ctx.createRadialGradient(px, H * 0.09, 0, px, H * 0.09, 80);
        lg.addColorStop(0, 'rgba(255,248,180,0.16)'); lg.addColorStop(1, 'transparent');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(px, H * 0.09, 80, 48, 0, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      [[W * 0.15, H * 0.04, 60, 18], [W * 0.55, H * 0.07, 80, 22], [W * 0.82, H * 0.03, 44, 14]].forEach(([x, y, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      });
      // Bleachers / stadium walls
      ctx.fillStyle = '#1A2840';
      ctx.beginPath(); ctx.moveTo(0, H * 0.28); ctx.lineTo(0, H * 0.06); ctx.lineTo(W * 0.3, 0); ctx.lineTo(W * 0.3, H * 0.28); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, H * 0.28); ctx.lineTo(W, H * 0.06); ctx.lineTo(W * 0.7, 0); ctx.lineTo(W * 0.7, H * 0.28); ctx.closePath(); ctx.fill();
      // Stadium lights
      [[W * 0.28, H * 0.04], [W * 0.72, H * 0.04]].forEach(([lx, ly]) => {
        ctx.fillStyle = '#FFF8E0';
        ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill();
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 90);
        lg.addColorStop(0, 'rgba(255,248,180,0.18)'); lg.addColorStop(1, 'transparent');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(lx, ly + 30, 55, 80, 0, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  _bgOval(ctx, W, H, geo) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (this.venueType === 'indoor') {
      sky.addColorStop(0, '#12101C'); sky.addColorStop(1, '#1E1828');
    } else {
      sky.addColorStop(0, '#182840'); sky.addColorStop(1, '#101E2E');
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    if (this.venueType === 'outdoor') {
      const { cx, cy, outerR, S } = geo;
      // Stadium tiers
      for (let i = 1; i <= 6; i++) {
        ovalPath(ctx, cx, cy, outerR + i * 14, S + i * 2);
        ctx.strokeStyle = `rgba(20,32,56,${0.92 - i * 0.08})`;
        ctx.lineWidth = 13; ctx.stroke();
      }
      for (let i = 1; i <= 5; i++) {
        ovalPath(ctx, cx, cy, outerR + i * 14, S + i * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 10; ctx.stroke();
      }
    } else {
      // Indoor: purple tint ambiance
      const { cx, cy } = geo;
      const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.65);
      gl.addColorStop(0, 'rgba(120,60,200,0.06)'); gl.addColorStop(1, 'transparent');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    }
  }
}
