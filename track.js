// track.js — Track rendering (clean rewrite)

const TRACK_CONFIG = {
  indoor: {
    color:'#C25B1A', colorDark:'#8B3A0A', colorLight:'#D4763A',
    infield:'#2A5A28', infieldLine:'#3A7A36',
    lanes:6, laneWidth:30, label:'INDOOR OVAL'
  },
  outdoor: {
    color:'#C84B1A', colorDark:'#8B2E08', colorLight:'#D46640',
    infield:'#2D6A2A', infieldLine:'#3E8A38',
    lanes:8, laneWidth:28, label:'OUTDOOR STADIUM'
  }
};

// ════════════════════════════════════════════════════════
//  OVAL GEOMETRY
//  The track is a "stadium" oval: two straights + two semicircles.
//  Layout (clockwise, t=0 at start/finish line, top of right straight):
//    [A] Right semicircle  (centre at cx+S, cy)  angle -π/2 → +π/2
//    [B] Bottom straight   (cx+S, cy+R) → (cx-S, cy+R)   going LEFT
//    [C] Left semicircle   (centre at cx-S, cy)  angle +π/2 → +3π/2
//    [D] Top straight      (cx-S, cy-R) → (cx+S, cy-R)   going RIGHT
//  Total perimeter = πR + 2S + πR + 2S = 2πR + 4S
//    where S = half the straight length (cx offset to arc centre)
// ════════════════════════════════════════════════════════

function ovalPos(t, cx, cy, R, S) {
  // t: 0..1 around the oval (clockwise)
  t = ((t % 1) + 1) % 1;
  const LA = Math.PI * R; // right arc length
  const LB = 2 * S;       // bottom straight length
  const LC = Math.PI * R; // left arc length
  const LD = 2 * S;       // top straight length
  const P  = LA + LB + LC + LD;
  let d = t * P;

  if (d < LA) {
    // Right arc: centre (cx+S, cy), from angle -π/2 CW to +π/2
    const a = -Math.PI/2 + (d/LA)*Math.PI;
    return { x:(cx+S)+Math.cos(a)*R, y:cy+Math.sin(a)*R, tx:-Math.sin(a), ty:Math.cos(a) };
  }
  d -= LA;
  if (d < LB) {
    // Bottom straight: going left
    const f = d/LB;
    return { x:cx+S - f*2*S, y:cy+R, tx:-1, ty:0 };
  }
  d -= LB;
  if (d < LC) {
    // Left arc: centre (cx-S, cy), from angle +π/2 CW to +3π/2
    const a = Math.PI/2 + (d/LC)*Math.PI;
    return { x:(cx-S)+Math.cos(a)*R, y:cy+Math.sin(a)*R, tx:-Math.sin(a), ty:Math.cos(a) };
  }
  d -= LC;
  // Top straight: going right
  const f = d/LD;
  return { x:cx-S + f*2*S, y:cy-R, tx:1, ty:0 };
}

// Draw oval path (no fill/stroke — caller does that)
function ovalPath(ctx, cx, cy, R, S) {
  ctx.beginPath();
  ctx.arc(cx+S, cy, R, -Math.PI/2,  Math.PI/2, false); // right arc CW
  ctx.arc(cx-S, cy, R,  Math.PI/2, -Math.PI/2, false); // left arc CW
  ctx.closePath();
}

// Compute oval geometry to fit W×H with margin
function calcGeo(W, H, venueType, margin) {
  const cfg    = TRACK_CONFIG[venueType];
  const lanes  = cfg.lanes;
  let   laneW  = cfg.laneWidth;
  const avW    = W - margin*2;
  const avH    = H - margin*2;

  let outerR = avH / 2;
  let S      = avW/2 - outerR;
  if (S < outerR * 0.15) {
    const scale = avW / (avH * 1.6);
    outerR = (avH / 2) * scale;
    S      = avW/2 - outerR;
  }
  if (S < 10) S = 10;

  const minInner = outerR * 0.30;
  if (outerR - lanes * laneW < minInner) {
    laneW = Math.floor((outerR - minInner) / lanes);
  }

  const innerR    = outerR - lanes * laneW;
  const laneRadii = Array.from({length: lanes+1}, (_, i) => innerR + i*laneW);
  return { cx:W/2, cy:H/2, innerR, outerR, S, lanes, laneW, laneRadii };
}

// ════════════════════════════════════════════════════════
//  VENUE SELECT PREVIEW
// ════════════════════════════════════════════════════════
function drawTrackPreview(canvas, venueType) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cfg = TRACK_CONFIG[venueType];
  ctx.clearRect(0, 0, W, H);

  const geo = calcGeo(W, H, venueType, 20);
  const { cx, cy, innerR, outerR, S, laneRadii, lanes } = geo;

  // Background grass
  ctx.fillStyle = cfg.infield;
  ctx.fillRect(0, 0, W, H);

  // Track outer band
  ctx.fillStyle = cfg.colorDark;
  ovalPath(ctx, cx, cy, outerR, S); ctx.fill();

  // Alternating lane fills (draw from outermost lane inward)
  for (let i = lanes; i >= 1; i--) {
    ctx.fillStyle = i%2===0 ? cfg.color : cfg.colorLight;
    ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.fill();
  }

  // Infield
  const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  ig.addColorStop(0, cfg.infieldLine);
  ig.addColorStop(1, cfg.infield);
  ovalPath(ctx, cx, cy, innerR, S);
  ctx.fillStyle = ig; ctx.fill();

  // Lane lines
  for (let i = 0; i <= lanes; i++) {
    ctx.strokeStyle = (i===0||i===lanes) ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = (i===0||i===lanes) ? 1.5 : 0.6;
    ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.stroke();
  }

  // Start/finish line
  ctx.fillStyle = 'white';
  ctx.fillRect(cx+S-2, cy-outerR, 4, outerR-innerR);

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 10px "Press Start 2P",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(cfg.label, cx, H-5);
}

// ════════════════════════════════════════════════════════
//  RACE TRACK CLASS
// ════════════════════════════════════════════════════════
class RaceTrack {
  constructor(canvas, venueType, eventMeters) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.venueType   = venueType;
    this.eventMeters = eventMeters;
    this.cfg         = TRACK_CONFIG[venueType];
    this.totalLaps   = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;

    // Race type
    if (eventMeters === 60 || eventMeters === 100) {
      this.raceType = 'straight';
    } else {
      this.raceType = 'oval'; // 200m and 400m both rendered on the oval
    }

    // startT = where on the oval the race begins (0..1)
    // ovalFrac = what fraction of the oval is covered per lap
    // outdoor 200m: starts at back straight (t=0.5), runs half the oval to finish
    // indoor 200m: full lap
    // 400m: full lap(s)
    if (venueType === 'outdoor' && eventMeters === 200) {
      this.startT   = 0.5;
      this.ovalFrac = 0.5;
    } else {
      this.startT   = 0.0;
      this.ovalFrac = 1.0;
    }

    this._resize();
  }

  _resize() {
    const c = this.canvas;
    this.W = c.width  = c.offsetWidth  || window.innerWidth;
    this.H = c.height = c.offsetHeight || (window.innerHeight - 120);
  }

  draw(playerProgress, runners) {
    this._resize();
    this.ctx.clearRect(0, 0, this.W, this.H);
    if (this.raceType === 'straight') {
      this._drawStraight(playerProgress, runners);
    } else {
      this._drawOval(playerProgress, runners);
    }
  }

  // ══════════════════════════════════════════════════════
  //  STRAIGHT RACE  (60m / 100m)
  // ══════════════════════════════════════════════════════
  _drawStraight(progress, runners) {
    const ctx = this.ctx, W = this.W, H = this.H, cfg = this.cfg;
    const lanes = cfg.lanes;

    // World is 4× screen width; camera follows player at 30% from left
    const WORLD = W * 4;
    const camX  = progress * WORLD - W * 0.30;

    // Background
    this._bgStraight(ctx, W, H);

    const tTop = Math.round(H * 0.26);
    const tBot = Math.round(H * 0.90);
    const lH   = (tBot - tTop) / lanes;

    // Grass above and below track
    ctx.fillStyle = cfg.infield;
    ctx.fillRect(0, 0, W, tTop+2);
    ctx.fillRect(0, tBot-2, W, H-(tBot-2));

    // Track surface
    const tg = ctx.createLinearGradient(0, tTop, 0, tBot);
    tg.addColorStop(0, cfg.colorLight); tg.addColorStop(0.4, cfg.color); tg.addColorStop(1, cfg.colorDark);
    ctx.fillStyle = tg;
    ctx.fillRect(0, tTop, W, tBot-tTop);

    // Lane lines
    for (let l = 0; l <= lanes; l++) {
      const y = tTop + l * lH;
      ctx.strokeStyle = (l===0||l===lanes) ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.38)';
      ctx.lineWidth   = (l===0||l===lanes) ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Lane labels
    for (let l = 0; l < lanes; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '11px "Press Start 2P",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('LANE '+(l+1), 8, tTop + l*lH + lH/2);
    }

    // Distance markers
    ctx.save(); ctx.setLineDash([5,8]); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    for (let m = 10; m < this.eventMeters; m += 10) {
      const sx = (m / this.eventMeters) * WORLD - camX;
      if (sx < 0 || sx > W) continue;
      ctx.beginPath(); ctx.moveTo(sx, tTop); ctx.lineTo(sx, tBot); ctx.stroke();
      if (m % 20 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(m+'m', sx, tTop-2);
      }
    }
    ctx.restore();

    // Start line
    const startSX = -camX;
    if (startSX > -10 && startSX < W+10) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(startSX, tTop); ctx.lineTo(startSX, tBot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = 'bold 11px "Press Start 2P",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('START', startSX, tTop-2);
    }

    // Finish line
    const finSX = WORLD - camX;
    if (finSX > -10 && finSX < W+10) {
      this._checker(ctx, finSX-4, tTop, 8, tBot-tTop, 12);
      ctx.fillStyle = 'white'; ctx.font = 'bold 13px "Press Start 2P",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('FINISH', finSX, tTop-3);
    }

    // Runners (sorted by lane so closer lanes are drawn in front)
    [...runners].sort((a,b) => a.lane - b.lane).forEach(r => {
      const sx = (r.progress * WORLD) - camX;
      if (sx < -80 || sx > W+80) return;
      const sy = tTop + (r.lane + 0.5) * lH;
      this._spriteUpright(ctx, r, sx, sy, 0.88);
      if (r.isPlayer) this._youLabel(ctx, sx, sy - 36);
    });

    // Progress minimap
    this._miniLinear(ctx, W, H, progress, runners);
  }

  // ══════════════════════════════════════════════════════
  //  OVAL RACE  (200m / 400m)
  //  Camera follows the player — only the nearby track section is visible.
  // ══════════════════════════════════════════════════════
  _drawOval(progress, runners) {
    const ctx = this.ctx, W = this.W, H = this.H, cfg = this.cfg;

    // ── World geometry ──
    const WORLD_SCALE = this.venueType === 'indoor' ? 2.8 : 3.4;
    const baseW = W * WORLD_SCALE, baseH = H * WORLD_SCALE;
    const geo = calcGeo(baseW, baseH, this.venueType, 80);
    const { cx, cy, innerR, outerR, S, lanes, laneW, laneRadii } = geo;

    // ── Camera: follow player, keep them at screen centre ──
    // Find player's world position
    const playerLaneIdx = Math.max(0, Math.min(runners.find(r=>r.isPlayer)?.lane ?? 0, lanes-1));
    const playerLaneR   = (laneRadii[playerLaneIdx] + laneRadii[playerLaneIdx+1]) / 2;
    const playerOvalT   = (this.startT + progress * this.ovalFrac * this.totalLaps) % 1;
    const playerPos     = ovalPos(playerOvalT, cx, cy, playerLaneR, S);

    // Camera offset: shift world so player is at screen centre
    const camOffX = W / 2 - playerPos.x;
    const camOffY = H / 2 - playerPos.y;

    // ── Draw world (translated) ──
    ctx.save();
    ctx.translate(camOffX, camOffY);

    // Background — fill entire visible area in world space
    ctx.fillStyle = cfg.infield;
    ctx.fillRect(-camOffX, -camOffY, W, H);

    // Track: outer dark band
    ctx.fillStyle = cfg.colorDark;
    ovalPath(ctx, cx, cy, outerR + 8, S); ctx.fill();

    // Alternating lane fills
    for (let i = lanes; i >= 1; i--) {
      ctx.fillStyle = i % 2 === 0 ? cfg.color : cfg.colorLight;
      ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.fill();
    }

    // Infield grass
    const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    ig.addColorStop(0, cfg.infieldLine); ig.addColorStop(0.6, cfg.infield); ig.addColorStop(1, '#1a3d18');
    ovalPath(ctx, cx, cy, innerR, S);
    ctx.fillStyle = ig; ctx.fill();

    // Infield text
    ctx.save();
    ctx.font = `bold ${Math.round(innerR * 0.12)}px "Press Start 2P",monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SPRINT', cx, cy - innerR * 0.06);
    ctx.font = `${Math.round(innerR * 0.05)}px "Press Start 2P"`;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillText(this.venueType === 'indoor' ? 'INDOOR ARENA' : 'STADIUM TRACK', cx, cy + innerR * 0.08);
    ctx.restore();

    // Lane lines
    for (let i = 0; i <= lanes; i++) {
      ctx.strokeStyle = (i === 0 || i === lanes) ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.30)';
      ctx.lineWidth   = (i === 0 || i === lanes) ? 2.8 : 1;
      ovalPath(ctx, cx, cy, laneRadii[i], S); ctx.stroke();
    }

    // Start/finish line(s)
    const isOutdoor200 = this.venueType === 'outdoor' && this.eventMeters === 200;

    if (isOutdoor200) {
      // FINISH line: at t=0 (right side top of right arc)
      const finX  = cx + S;
      const finY1 = cy - outerR, finY2 = cy - innerR;
      const fbh   = (finY2 - finY1) / 10;
      for (let row = 0; row < 10; row++) for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? 'white' : '#111';
        ctx.fillRect(finX - 4 + col * 4, finY1 + row * fbh, 4, fbh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.round(laneW * 0.55)}px "Press Start 2P",monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('FINISH', finX, finY1 - 4);

      // START line: at t=0.5 (left side top of left arc)
      // t=0.5 position on the outer/inner edge of the track
      const startPosOuter = ovalPos(0.5, cx, cy, outerR, S);
      const startPosInner = ovalPos(0.5, cx, cy, innerR, S);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startPosOuter.x, startPosOuter.y);
      ctx.lineTo(startPosInner.x, startPosInner.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.round(laneW * 0.55)}px "Press Start 2P",monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('START', startPosOuter.x, startPosOuter.y - 4);

      // Stagger marks for 200m (outer lanes start further ahead)
      this._staggerMarks(ctx, cx, cy, innerR, S, laneRadii, lanes, laneW, 0.5);
    } else {
      // Normal start/finish at t=0 (right side)
      const sfX  = cx + S;
      const sfY1 = cy - outerR, sfY2 = cy - innerR;
      const bh   = (sfY2 - sfY1) / 10;
      for (let row = 0; row < 10; row++) for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? 'white' : '#111';
        ctx.fillRect(sfX - 4 + col * 4, sfY1 + row * bh, 4, bh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.round(laneW * 0.55)}px "Press Start 2P",monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('START/FINISH', sfX, sfY1 - 4);

      // Stagger marks for 400m
      if (this.eventMeters === 400) {
        this._staggerMarks(ctx, cx, cy, innerR, S, laneRadii, lanes, laneW, 0);
      }
    }

    // Lane numbers (on bottom straight)
    ctx.font = `bold ${Math.round(laneW * 0.5)}px "Press Start 2P",monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < lanes; i++) {
      const r = (laneRadii[i] + laneRadii[i + 1]) / 2;
      const p = ovalPos(0.54, cx, cy, r, S);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillText(i + 1, p.x, p.y);
    }

    // ── Runners ──
    const runnerPositions = runners.map(r => {
      const ovalT   = (this.startT + r.progress * this.ovalFrac * this.totalLaps) % 1;
      const laneIdx = Math.max(0, Math.min(r.lane, lanes - 1));
      const laneR   = (laneRadii[laneIdx] + laneRadii[laneIdx + 1]) / 2;
      const pos     = ovalPos(ovalT, cx, cy, laneR, S);
      return { runner: r, x: pos.x, y: pos.y, tx: pos.tx, ty: pos.ty };
    });

    // Sort by y so lower runners draw in front
    runnerPositions.sort((a, b) => a.y - b.y);

    // Sprite scale slightly larger since world is bigger
    runnerPositions.forEach(({ runner, x, y, tx, ty }) => {
      this._spriteOval(ctx, runner, x, y, tx, ty, 1.0);
    });

    // Glow ring on player (in world space)
    const playerData = runnerPositions.find(d => d.runner.isPlayer);
    if (playerData) {
      ctx.beginPath();
      ctx.arc(playerData.x, playerData.y, 26, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,208,96,0.7)';
      ctx.lineWidth = 3; ctx.stroke();
    }

    ctx.restore(); // end world transform

    // ── YOU label in screen space (always above centre) ──
    this._youLabel(ctx, W / 2, H / 2 - 38);

    // Minimap oval (top-right corner, small)
    this._miniOvalMap(ctx, W, H, progress, runners);

    // Lap / progress HUD
    this._ovalHUD(ctx, W, H, progress);
  }

  // ── Small oval minimap (top-right) ──────────────────────
  _miniOvalMap(ctx, W, H, progress, runners) {
    const mW = 140, mH = 80;
    const mX = W - mW - 12, mY = 12;
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(mX - 6, mY - 6, mW + 12, mH + 12, 6); ctx.fill();
    // Mini geometry
    const geo = calcGeo(mW, mH, this.venueType, 8);
    const { cx, cy, innerR, outerR, S, lanes, laneRadii } = geo;
    const mcx = mX + cx, mcy = mY + cy;
    // Track surface
    ctx.fillStyle = this.cfg.color;
    ovalPath(ctx, mcx, mcy, outerR, S); ctx.fill();
    // Infield
    ctx.fillStyle = this.cfg.infield;
    ovalPath(ctx, mcx, mcy, innerR, S); ctx.fill();
    // Outer border
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    ovalPath(ctx, mcx, mcy, outerR, S); ctx.stroke();
    // Start/finish tick(s)
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5;
    // Finish always at t=0 (right side)
    ctx.beginPath();
    ctx.moveTo(mcx + S, mcy - outerR);
    ctx.lineTo(mcx + S, mcy - innerR);
    ctx.stroke();
    // For outdoor 200m also show start at t=0.5
    if (this.venueType === 'outdoor' && this.eventMeters === 200) {
      const sp = ovalPos(0.5, mcx, mcy, (outerR + innerR) / 2, S);
      const perp = { x: -sp.ty * (outerR - innerR) / 2, y: sp.tx * (outerR - innerR) / 2 };
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(sp.x - perp.x, sp.y - perp.y);
      ctx.lineTo(sp.x + perp.x, sp.y + perp.y);
      ctx.stroke();
    }
    // Runner dots
    runners.forEach(r => {
      const ovalT   = (this.startT + r.progress * this.ovalFrac * this.totalLaps) % 1;
      const laneIdx = Math.max(0, Math.min(r.lane, lanes - 1));
      const laneR   = (laneRadii[laneIdx] + laneRadii[laneIdx + 1]) / 2;
      const pos     = ovalPos(ovalT, mcx, mcy, laneR, S);
      ctx.fillStyle = r.isPlayer ? '#FFD060' : (r.color || '#aaa');
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r.isPlayer ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (r.isPlayer) {
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  // ── STAGGER MARKS ──────────────────────────────────────
  _staggerMarks(ctx, cx, cy, innerR, S, laneRadii, lanes, laneW, baseT = 0) {
    const innerPerim = 2*Math.PI*innerR + 4*S;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;

    for (let i = 1; i < lanes; i++) {
      const laneR     = (laneRadii[i]+laneRadii[i+1])/2;
      const lanePerim = 2*Math.PI*laneR + 4*S;
      const staggerFrac = (lanePerim - innerPerim) / lanePerim;
      if (staggerFrac <= 0) continue;

      const pos = ovalPos((baseT + staggerFrac) % 1, cx, cy, laneR, S);
      const px = -pos.ty, py = pos.tx;
      ctx.beginPath();
      ctx.moveTo(pos.x + px*laneW*0.55, pos.y + py*laneW*0.55);
      ctx.lineTo(pos.x - px*laneW*0.55, pos.y - py*laneW*0.55);
      ctx.stroke();
    }
  }

  // ── SPRITE HELPERS ──────────────────────────────────────
  _spriteUpright(ctx, runner, x, y, scale) {
    if (runner.isPlayer)
      drawAthlete(ctx, ATHLETES[runner.athleteIdx||0], x, y, runner.frame, true, scale);
    else
      drawOpponent(ctx, x, y, runner.frame, runner.color, runner.skinTone, scale);
  }

  _spriteOval(ctx, runner, x, y, tx, ty, scaleOverride) {
    ctx.save();
    ctx.translate(x, y);
    const angle = Math.atan2(ty, tx);
    ctx.rotate(angle);
    const scale = scaleOverride !== undefined ? scaleOverride : 0.68;
    ctx.scale(scale, scale);
    if (runner.isPlayer)
      drawAthlete(ctx, ATHLETES[runner.athleteIdx||0], 0, 0, runner.frame, true, 1);
    else
      drawOpponent(ctx, 0, 0, runner.frame, runner.color, runner.skinTone, 1);
    ctx.restore();
  }

  _youLabel(ctx, x, y) {
    ctx.save();
    ctx.font = 'bold 12px "Press Start 2P",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
    ctx.strokeText('YOU ▼', x, y);
    ctx.fillStyle = '#FFD060'; ctx.fillText('YOU ▼', x, y);
    ctx.restore();
  }

  _checker(ctx, x, y, w, h, rows) {
    const rh = h/rows;
    for (let r=0;r<rows;r++) for (let c=0;c<2;c++) {
      ctx.fillStyle = (r+c)%2===0 ? 'white' : 'black';
      ctx.fillRect(x+c*(w/2), y+r*rh, w/2, rh);
    }
  }

  // ── MINIMAPS / HUD ──────────────────────────────────────
  _miniLinear(ctx, W, H, progress, runners) {
    const mW=200, mH=38, mX=W/2-mW/2, mY=H-mH-8;
    ctx.fillStyle='rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect(mX,mY,mW,mH,5); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.stroke();
    const bX=mX+10, bW=mW-20, bY=mY+17, bH=9;
    ctx.fillStyle=this.cfg.color; ctx.fillRect(bX,bY,bW,bH);
    ctx.strokeStyle='white'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(bX+bW,bY-4); ctx.lineTo(bX+bW,bY+bH+4); ctx.stroke();
    runners.forEach(r=>{
      const dx=bX+r.progress*bW, dy=bY+bH/2;
      ctx.fillStyle=r.isPlayer?'#FFD060':r.color;
      ctx.beginPath(); ctx.arc(dx,dy,r.isPlayer?5:3,0,Math.PI*2); ctx.fill();
      if(r.isPlayer){ctx.strokeStyle='white';ctx.lineWidth=1.2;ctx.stroke();}
    });
    ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.font='9px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(this.eventMeters+'m', mX+mW/2, mY+4);
  }

  _ovalHUD(ctx, W, H, progress) {
    const lap     = Math.min(this.totalLaps, Math.floor(progress * this.totalLaps) + 1);
    const lapFrac = this.totalLaps > 1 ? (progress * this.totalLaps) % 1 : progress;
    const bX=14, bY=14, bW=165, bH=8;
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(bX-8, bY-20, bW+16, bH+36, 5); ctx.fill();
    ctx.fillStyle = this.cfg.colorDark; ctx.fillRect(bX, bY, bW, bH);
    ctx.fillStyle = '#FFD060';          ctx.fillRect(bX, bY, lapFrac*bW, bH);
    ctx.fillStyle = 'white'; ctx.font = 'bold 11px "Press Start 2P",monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    if (this.totalLaps > 1) {
      ctx.fillText('LAP '+lap+' / '+this.totalLaps, bX, bY-1);
    } else {
      ctx.fillText(this.eventMeters+'m', bX, bY-1);
    }
    ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.font='9px "Press Start 2P"';
    ctx.textBaseline='top';
    ctx.fillText(Math.round(lapFrac*100)+'% complete', bX, bY+bH+3);
  }

  // ── BACKGROUNDS ────────────────────────────────────────
  _bgStraight(ctx, W, H) {
    const sky = ctx.createLinearGradient(0,0,0,H*0.28);
    if (this.venueType==='indoor') {
      sky.addColorStop(0,'#14101E'); sky.addColorStop(1,'#221530');
    } else {
      sky.addColorStop(0,'#1A3050'); sky.addColorStop(1,'#2A4A80');
    }
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.28);

    if (this.venueType==='indoor') {
      ctx.strokeStyle='rgba(80,60,120,0.3)'; ctx.lineWidth=1.5;
      for(let i=0;i<9;i++){
        ctx.beginPath(); ctx.moveTo((i/8)*W,0); ctx.lineTo(W/2,H*0.24); ctx.stroke();
      }
      [0.12,0.33,0.5,0.67,0.88].forEach(lx=>{
        const px=lx*W;
        ctx.fillStyle='#FFF8E0';
        ctx.beginPath(); ctx.ellipse(px,H*0.13,13,5,0,0,Math.PI*2); ctx.fill();
        const lg=ctx.createRadialGradient(px,H*0.13,0,px,H*0.13,75);
        lg.addColorStop(0,'rgba(255,248,180,0.18)'); lg.addColorStop(1,'transparent');
        ctx.fillStyle=lg; ctx.beginPath(); ctx.ellipse(px,H*0.13,75,44,0,0,Math.PI*2); ctx.fill();
      });
    } else {
      ctx.fillStyle='rgba(255,255,255,0.06)';
      [[W*.18,H*.04,54,16],[W*.55,H*.08,76,20],[W*.82,H*.03,43,14]].forEach(([x,y,rx,ry])=>{
        ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
      });
      const sY=H*0.01, sH=H*0.25;
      ctx.fillStyle='#1A2840';
      ctx.beginPath(); ctx.moveTo(0,sY+sH); ctx.lineTo(0,sY+10); ctx.lineTo(W*0.32,sY); ctx.lineTo(W*0.32,sY+sH); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W,sY+sH); ctx.lineTo(W,sY+10); ctx.lineTo(W*0.68,sY); ctx.lineTo(W*0.68,sY+sH); ctx.closePath(); ctx.fill();
    }
  }

  _bgOval(ctx, W, H, geo) {
    const sky = ctx.createLinearGradient(0,0,0,H);
    if (this.venueType==='indoor') {
      sky.addColorStop(0,'#14101E'); sky.addColorStop(1,'#1C1A2C');
    } else {
      sky.addColorStop(0,'#182840'); sky.addColorStop(1,'#101E2E');
    }
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

    if (this.venueType==='outdoor') {
      const {cx,cy,outerR,S}=geo;
      for(let i=1;i<=5;i++){
        ovalPath(ctx,cx,cy,outerR+i*13,S+i*3);
        ctx.strokeStyle=`rgba(20,32,56,${0.9-i*0.1})`;
        ctx.lineWidth=11; ctx.stroke();
      }
      for(let i=1;i<=4;i++){
        ovalPath(ctx,cx,cy,outerR+i*13,S+i*3);
        ctx.strokeStyle='rgba(255,255,255,0.018)';
        ctx.lineWidth=9; ctx.stroke();
      }
    } else {
      const {cx,cy}=geo;
      const gl=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*0.6);
      gl.addColorStop(0,'rgba(140,70,255,0.06)'); gl.addColorStop(1,'transparent');
      ctx.fillStyle=gl; ctx.fillRect(0,0,W,H);
    }
  }
}
