// track.js — True oval track with camera following runner

const TRACK_CONFIG = {
  indoor: {
    name: 'Indoor', color: '#C25B1A', colorDark: '#8B3A0A', colorLight: '#D4763A',
    infield: '#2A5A28', infieldLine: '#3A7A36', lanes: 6, label: 'INDOOR OVAL',
    // Indoor: tighter oval, more circular
    straightFrac: 0.30,   // fraction of track that is straight (each straight)
  },
  outdoor: {
    name: 'Outdoor', color: '#C84B1A', colorDark: '#8B2E08', colorLight: '#D46640',
    infield: '#2D6A2A', infieldLine: '#3E8A38', lanes: 8, label: 'OUTDOOR STADIUM',
    // Outdoor: longer straights
    straightFrac: 0.37,
  }
};

// ── OVAL GEOMETRY ─────────────────────────────────────────────────────────────
// The track is defined as a parametric path around an oval.
// t = 0..1 maps to angle around the oval (0 = right side, finish line area)
// We compute x,y and the tangent direction at any t.
//
// The oval has:
//   - Two semicircular ends (radius R)
//   - Two straight sections of length S
//   Total perimeter = 2*PI*R + 2*S = trackLength
//
// We parameterise t around the oval:
//   t=0: start/finish (top of right straight)
//   going clockwise: right straight → bottom curve → left straight → top curve → back

function buildOvalGeometry(W, H, lanes, venueType) {
  const cfg = TRACK_CONFIG[venueType];
  const laneW = venueType === 'indoor' ? 34 : 32;

  // Innermost lane edge radius and straight length
  // For the canvas we scale to fit nicely
  const margin = 60;
  const availW = W - margin * 2;
  const availH = H - margin * 2;

  // The oval aspect ratio: outdoor is wider, indoor more circular
  const aspectRatio = venueType === 'outdoor' ? 2.6 : 2.0;

  // Compute R and S so it fits in canvas
  // Width = 2R + 2S, Height = 2R
  // Width/Height = (2R+2S)/(2R) = 1 + S/R = aspectRatio
  // S/R = aspectRatio - 1
  // Also: 2R <= availH, 2R+2S <= availW
  const maxR = availH / 2;
  const maxS = availW / 2 - maxR;
  let R = Math.min(maxR, availH / 2);
  let S = R * (aspectRatio - 1);
  if (R + S > availW / 2) {
    S = availW / 2 - R;
    R = S / (aspectRatio - 1);
  }

  // Centre of oval
  const cx = W / 2;
  const cy = H / 2;

  // Inner track edge (lane 1 inner)
  const innerR = R;
  const innerS = S;

  // Total inner perimeter
  const perim = 2 * Math.PI * innerR + 2 * innerS;

  // Build lane radii
  const laneRadii = [];
  for (let i = 0; i <= lanes; i++) {
    laneRadii.push(innerR + i * laneW);
  }
  const outerR = laneRadii[lanes];
  const totalW_track = outerR - innerR;

  return { cx, cy, innerR, innerS, outerR, laneW, laneRadii, perim, lanes };
}

// Get x,y position on the oval at parameter t (0..1), for given radius R and straight S
function ovalPoint(t, cx, cy, R, S) {
  // Parameterize clockwise starting at top-right corner of right straight
  // Section lengths: right-straight (S), bottom-curve (PI*R), left-straight (S), top-curve (PI*R)
  const perim = 2 * S + 2 * Math.PI * R;
  const d = t * perim; // distance along track

  const s1End = S;            // end of right straight
  const c1End = S + Math.PI * R; // end of bottom curve
  const s2End = c1End + S;    // end of left straight
  // c2End = perim               // end of top curve (=start)

  if (d <= s1End) {
    // Right straight: going down (from top-right to bottom-right)
    const frac = d / S;
    return { x: cx + R + S * 0, y: cy - R + frac * 2 * R, angle: Math.PI / 2 };
  } else if (d <= c1End) {
    // Bottom curve: semicircle on the right end, going clockwise
    const a = (d - s1End) / (Math.PI * R); // 0..1
    const theta = -Math.PI / 2 + a * Math.PI; // from -90° to +90° (right side)
    return {
      x: cx + S + Math.cos(theta) * R,  // wait — need to think carefully
      y: cy + Math.sin(theta) * R,       // bottom of oval is cy+R when theta=90
      angle: theta + Math.PI / 2
    };
  } else if (d <= s2End) {
    // Left straight: going up
    const frac = (d - c1End) / S;
    return { x: cx - R - S * 0, y: cy + R - frac * 2 * R, angle: -Math.PI / 2 };
  } else {
    // Top curve: semicircle on the left end
    const a = (d - s2End) / (Math.PI * R);
    const theta = Math.PI / 2 + a * Math.PI;
    return {
      x: cx - S + Math.cos(theta) * R,
      y: cy + Math.sin(theta) * R,
      angle: theta + Math.PI / 2
    };
  }
}

// Better parametric oval: two straights + two semicircles
// Returns {x, y, tangentAngle} at fraction t (0=start/finish line, clockwise)
function ovalPos(t, cx, cy, R, S) {
  // Start/finish at right side, top of right straight
  // Clockwise: down right straight → around right curve → up left straight → around left curve
  const perim = 2 * S + 2 * Math.PI * R;
  let d = ((t % 1) + 1) % 1 * perim;

  const RS = S, RC = Math.PI * R, LS = S, LC = Math.PI * R;

  if (d < RS) {
    // Right straight, going downward
    const frac = d / RS;
    return { x: cx + S, y: cy - R + frac * 2 * R, tx: 0, ty: 1 };
  }
  d -= RS;
  if (d < RC) {
    // Bottom-right curve (180°), goes from bottom-right to bottom-left
    const theta = -Math.PI / 2 + (d / RC) * Math.PI; // -90° → 90°  on right circle
    // Right semicircle center: (cx + S, cy)  — no wait
    // The right semicircle connects the bottom of the right straight to the bottom of the left straight
    // Centre of right arc = (cx + S, cy)? No.
    // Right straight is at x = cx+S, y from cy-R to cy+R
    // Left straight is at x = cx-S, y from cy+R to cy-R  
    // Right semicircle: centre = (cx+S ... wait, the arc connects (cx+S, cy+R) to (cx-S, cy+R)?
    // No — it connects the BOTTOM of right straight (cx+S, cy+R) going around the right end
    // Actually the right end arc centre is at (cx+S, cy), radius R? No that would be wrong width.
    // 
    // Let me redefine: the straights are horizontal and the curves are at the ends.
    // Straight top: y = cy-R, x from cx-S to cx+S  — horizontal
    // Straight bottom: y = cy+R, x from cx+S to cx-S — horizontal  
    // Right curve: connects (cx+S, cy-R) to (cx+S, cy+R) — centre (cx+S, cy), going clockwise (right side)
    // Left curve: connects (cx-S, cy+R) to (cx-S, cy-R) — centre (cx-S, cy), going clockwise (left side)
    // 
    // With this layout: track goes clockwise:
    //   Start = (cx+S, cy-R) = top-right corner
    //   → right curve CW from top → (cx+S+R, cy) → bottom-right
    //   → bottom straight left → (cx-S, cy+R)  
    //   → left curve CW → (cx-S, cy-R)
    //   → top straight right → back to start
    // Perimeter = PI*R + S + PI*R + S = 2*PI*R + 2*S ✓
    // So right curve arc centre = (cx+S, cy), from angle -PI/2 going CW (increasing angle)
    const arcCx = cx + S, arcCy = cy;
    const startAngle = -Math.PI / 2;
    const angle = startAngle + (d / RC) * Math.PI;
    const tx = -Math.sin(angle); const ty = Math.cos(angle); // tangent CW
    return { x: arcCx + Math.cos(angle) * R, y: arcCy + Math.sin(angle) * R, tx, ty };
  }
  d -= RC;
  if (d < LS) {
    // Bottom straight, going leftward
    const frac = d / LS;
    return { x: cx + S - frac * 2 * S, y: cy + R, tx: -1, ty: 0 };
  }
  d -= LS;
  {
    // Left curve, centre (cx-S, cy), from angle PI/2 going CW
    const arcCx = cx - S, arcCy = cy;
    const startAngle = Math.PI / 2;
    const angle = startAngle + (d / LC) * Math.PI;
    const tx = -Math.sin(angle); const ty = Math.cos(angle);
    return { x: arcCx + Math.cos(angle) * R, y: arcCy + Math.sin(angle) * R, tx, ty };
  }
}

// ── TRACK PREVIEW ─────────────────────────────────────────────────────────────
function drawTrackPreview(canvas, venueType) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cfg = TRACK_CONFIG[venueType];

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#06060C';
  ctx.fillRect(0, 0, W, H);

  const geo = buildOvalGeometry(W, H, cfg.lanes, venueType);
  const { cx, cy, innerR, innerS, outerR, laneW, laneRadii, lanes } = geo;

  // Draw from outside in
  _drawOvalShape(ctx, cx, cy, outerR, innerS, cfg.colorDark, null, 0, true);
  for (let i = lanes; i >= 1; i--) {
    const r = laneRadii[i];
    const col = i % 2 === 0 ? cfg.color : cfg.colorLight;
    _drawOvalShape(ctx, cx, cy, r, innerS, col, null, 0, true);
  }

  // Infield
  const infGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  infGrad.addColorStop(0, cfg.infieldLine);
  infGrad.addColorStop(1, cfg.infield);
  _drawOvalShape(ctx, cx, cy, innerR, innerS, null, infGrad, 0, true);

  // Lane lines
  for (let i = 0; i <= lanes; i++) {
    const r = laneRadii[i];
    const isEdge = i === 0 || i === lanes;
    ctx.strokeStyle = isEdge ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isEdge ? 1.5 : 0.8;
    _drawOvalShape(ctx, cx, cy, r, innerS, null, null, 0, false);
    ctx.stroke();
  }

  // Start/finish line
  const sfP = ovalPos(0, cx, cy, innerR, innerS);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sfP.x, sfP.y);
  const sfPout = ovalPos(0, cx, cy, outerR, innerS);
  ctx.lineTo(sfPout.x, sfPout.y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 10px "Barlow Condensed",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cfg.label, cx, H - 8);
}

// Draw a filled oval path
function _drawOvalShape(ctx, cx, cy, R, S, fillColor, fillGrad, rotation, doFill) {
  ctx.beginPath();
  // Top straight: right to left? No — let's do the proper path
  // Start at top-right
  ctx.moveTo(cx + S, cy - R);
  // Right arc CW (top to bottom of right end)
  ctx.arc(cx + S, cy, R, -Math.PI / 2, Math.PI / 2);
  // Bottom straight: right to left
  ctx.lineTo(cx - S, cy + R);
  // Left arc CW (bottom to top of left end)
  ctx.arc(cx - S, cy, R, Math.PI / 2, -Math.PI / 2);
  // Top straight: left to right
  ctx.lineTo(cx + S, cy - R);
  ctx.closePath();

  if (doFill) {
    ctx.fillStyle = fillGrad || fillColor;
    ctx.fill();
  }
}

// ── RACE TRACK CLASS ──────────────────────────────────────────────────────────
class RaceTrack {
  constructor(canvas, venueType, eventMeters) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.venueType   = venueType;
    this.eventMeters = eventMeters;
    this.cfg         = TRACK_CONFIG[venueType];
    this.totalLaps   = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;

    // Race type determines rendering
    if (eventMeters === 400) {
      this.raceType = 'oval';
    } else if (eventMeters === 200) {
      this.raceType = 'half';   // starts on back straight
    } else {
      this.raceType = 'straight'; // 60m / 100m — pure straight
    }

    this._resize();
    this._buildGeometry();
  }

  _resize() {
    this.W = this.canvas.width  = this.canvas.offsetWidth  || window.innerWidth;
    this.H = this.canvas.height = this.canvas.offsetHeight || 500;
  }

  _buildGeometry() {
    const W = this.W, H = this.H;
    const cfg = this.cfg;

    if (this.raceType === 'straight') {
      // For straight races: wide track going left→right across screen
      this.laneCount = cfg.lanes;
      this.laneW_px  = Math.floor((H * 0.45) / this.laneCount);
      this.trackTop  = H * 0.27;
      this.trackBot  = this.trackTop + this.laneCount * this.laneW_px;
      // World pixel length
      this.PPM       = Math.floor((W * 0.75) / this.eventMeters * 10); // scale to fit
      this.trackLen  = this.eventMeters * this.PPM;
      return;
    }

    // Oval geometry: build to fit screen with good padding
    const margin = 55;
    const lanes   = cfg.lanes;
    const laneW   = venueType === 'indoor' ? 32 : 30;

    // The outer oval needs to fit in (W-2*margin) x (H-2*margin)
    // Track width = lanes * laneW
    // For outdoor: aspect ~2.5:1, indoor ~1.9:1
    const aspect = this.venueType === 'outdoor' ? 2.5 : 1.9;

    // outerR + S must fit
    // 2*outerR <= availH  → outerR = availH/2
    // 2*(outerR + S) <= availW → S = availW/2 - outerR
    const availW = W - margin * 2;
    const availH = H - margin * 2;
    let outerR = availH / 2;
    let S      = availW / 2 - outerR;

    if (S < outerR * 0.3) {
      // screen too narrow — shrink R
      S = outerR * 0.35;
      outerR = availW / 2 / (1 + 0.35);
    }

    const innerR = outerR - lanes * laneW;
    const innerS = S;

    this.geo = {
      cx: W / 2, cy: H / 2,
      outerR, innerR, S: innerS,
      lanes, laneW,
      laneRadii: Array.from({ length: lanes + 1 }, (_, i) => innerR + i * laneW),
    };

    // Stagger starts for 200m (back straight) and 400m
    // Each outer lane runner starts ahead (stagger) to compensate for larger radius
    // Stagger per lane ≈ 2*PI*laneW (circumference difference per lane)
    this.staggerPerLane = 2 * Math.PI * laneW / (2 * Math.PI * innerR + 2 * innerS);
  }

  // ── MAIN DRAW ──────────────────────────────────────────
  draw(playerProgress, runners) {
    this._resize();
    this._buildGeometry();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.raceType === 'straight') {
      this._drawStraightRace(playerProgress, runners);
    } else {
      this._drawOvalRace(playerProgress, runners);
    }
  }

  // ── STRAIGHT RACE (60m / 100m) ──────────────────────────
  _drawStraightRace(progress, runners) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cfg = this.cfg;
    const laneCount = cfg.lanes;

    // Camera follows player
    const trackLen = W * 3.5; // total world pixels for the straight
    const playerWorldX = progress * trackLen;
    const camX = playerWorldX - W * 0.30;

    // Sky/background
    this._drawStraightBG(ctx, W, H);

    const trackTop = H * 0.30;
    const trackBot = H * 0.92;
    const laneH    = (trackBot - trackTop) / laneCount;

    // Grass
    ctx.fillStyle = cfg.infield;
    ctx.fillRect(0, trackTop - 18, W, 20);
    ctx.fillRect(0, trackBot - 2, W, H - trackBot + 2);

    // Track surface
    const tg = ctx.createLinearGradient(0, trackTop, 0, trackBot);
    tg.addColorStop(0, cfg.colorLight); tg.addColorStop(0.4, cfg.color); tg.addColorStop(1, cfg.colorDark);
    ctx.fillStyle = tg;
    ctx.fillRect(0, trackTop, W, trackBot - trackTop);

    // Lane lines
    for (let l = 0; l <= laneCount; l++) {
      const y = trackTop + l * laneH;
      const isEdge = l === 0 || l === laneCount;
      ctx.strokeStyle = isEdge ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = isEdge ? 3 : 1.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Lane numbers on left
    for (let l = 0; l < laneCount; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = 'bold 13px "Bebas Neue",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('LANE ' + (l + 1), 8, trackTop + l * laneH + laneH * 0.6);
    }

    // Distance markers scrolling with camera
    ctx.save();
    ctx.setLineDash([8, 8]);
    const spacing = trackLen / this.eventMeters * 10; // every 10m
    const first = Math.ceil(camX / spacing) * spacing;
    for (let wx = first; wx < camX + W + spacing; wx += spacing) {
      const sx = wx - camX;
      if (sx < 0 || sx > W) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, trackTop); ctx.lineTo(sx, trackBot); ctx.stroke();
      const mv = Math.round((wx / trackLen) * this.eventMeters);
      if (mv > 0 && mv < this.eventMeters && mv % 20 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(mv + 'm', sx, trackTop - 5);
      }
    }
    ctx.restore();

    // Starting blocks (world x=0)
    const startSX = 0 - camX;
    if (startSX > -20 && startSX < W + 20) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(startSX, trackTop); ctx.lineTo(startSX, trackBot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 12px "Bebas Neue",sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('START', startSX, trackTop - 5);
    }

    // Finish line (checkerboard)
    const finSX = trackLen - camX;
    if (finSX > -20 && finSX < W + 20) {
      this._drawFinishLineVertical(ctx, finSX, trackTop, trackBot);
    }

    // Runners sorted by lane (back lane first)
    const sorted = [...runners].sort((a, b) => a.lane - b.lane);
    sorted.forEach(r => {
      const rwx = r.progress * trackLen;
      const sx  = rwx - camX;
      if (sx < -80 || sx > W + 80) return;
      const laneY = trackTop + (r.lane + 0.5) * laneH;
      const scale = 0.85;
      this._drawRunnerSprite(ctx, r, sx, laneY + 10, scale);
      if (r.isPlayer) this._drawYouLabel(ctx, sx, laneY - 20);
    });

    // Mini map
    this._drawLinearMiniMap(ctx, W, H, progress, runners);
  }

  // ── OVAL RACE (200m / 400m) ─────────────────────────────
  _drawOvalRace(progress, runners) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cfg = this.cfg;
    const geo = this.geo;
    if (!geo) return;

    const { cx, cy, outerR, innerR, S, lanes, laneW, laneRadii } = geo;

    // ── BACKGROUND ──
    this._drawOvalBG(ctx, W, H);

    // ── OUTER GRASS ──
    ctx.fillStyle = cfg.infield;
    ctx.fillRect(0, 0, W, H);

    // ── TRACK LAYERS (outer to inner) ──
    // Outer band (beyond last lane) — darker
    _drawOvalShape(ctx, cx, cy, outerR + 20, S, cfg.colorDark, null, 0, true);
    // Track surface — alternating lane colors
    for (let i = lanes; i >= 1; i--) {
      const r = laneRadii[i];
      const col = i % 2 === 0 ? cfg.color : cfg.colorLight;
      _drawOvalShape(ctx, cx, cy, r, S, col, null, 0, true);
    }

    // ── INFIELD ──
    const infGrad = ctx.createRadialGradient(cx, cy, innerR * 0.3, cx, cy, innerR);
    infGrad.addColorStop(0, cfg.infieldLine);
    infGrad.addColorStop(0.6, cfg.infield);
    infGrad.addColorStop(1, '#1a4018');
    _drawOvalShape(ctx, cx, cy, innerR, S, null, infGrad, 0, true);

    // Infield markings
    this._drawInfieldDetail(ctx, cx, cy, innerR, S);

    // ── LANE LINES ──
    for (let i = 0; i <= lanes; i++) {
      const r = laneRadii[i];
      const isEdge = i === 0 || i === lanes;
      ctx.strokeStyle = isEdge ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)';
      ctx.lineWidth   = isEdge ? 2.5 : 1;
      _drawOvalShape(ctx, cx, cy, r, S, null, null, 0, false);
      ctx.stroke();
    }

    // ── START/FINISH LINE ──
    // At t=0: top of right straight (cx+S, cy-innerR)
    this._drawFinishLineOval(ctx, cx, cy, innerR, outerR, S, lanes, laneRadii);

    // ── STAGGER LINES (for 400m / 200m) ──
    if (this.raceType === 'oval' || this.raceType === 'half') {
      this._drawStaggerLines(ctx, cx, cy, innerR, S, lanes, laneRadii, laneW);
    }

    // ── LANE NUMBERS ──
    this._drawLaneNumbers(ctx, cx, cy, laneRadii, S, lanes);

    // ── RUNNERS ──
    // Compute screen positions for all runners
    const runnerScreenPos = runners.map(r => {
      const lapFrac = this.totalLaps > 1 ? (r.progress * this.totalLaps) % 1 : r.progress;
      const adjusted = this._adjustedT(r, lapFrac);
      const mid = (laneRadii[r.lane] + laneRadii[r.lane + 1]) / 2;
      const pos = ovalPos(adjusted, cx, cy, mid, S);
      return { ...r, sx: pos.x, sy: pos.y, tx: pos.tx, ty: pos.ty };
    });

    // Sort by y so lower runners (further down screen) drawn last (on top)
    runnerScreenPos.sort((a, b) => a.sy - b.sy);
    runnerScreenPos.forEach(r => {
      const angle = Math.atan2(r.ty, r.tx); // facing direction
      this._drawRunnerOnOval(ctx, r, r.sx, r.sy, angle);
    });

    // ── MINI MAP / HUD OVERLAY ──
    this._drawOvalLapDisplay(ctx, W, H, runners, progress);

    // ── CAMERA INDICATOR: show player position on oval edge ──
    // (Optional: highlight player with a glow ring)
    const pRunner = runnerScreenPos.find(r => r.isPlayer);
    if (pRunner) {
      ctx.beginPath();
      ctx.arc(pRunner.sx, pRunner.sy, 22, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,208,96,0.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      this._drawYouLabel(ctx, pRunner.sx, pRunner.sy - 30);
    }
  }

  // Adjust t for stagger: outer lanes start ahead
  _adjustedT(runner, lapFrac) {
    if (!runner.isPlayer || this.raceType !== 'oval') {
      // For oval, all runners start at their staggered position
      // progress=0 means at their stagger start, progress=1 means one lap further
      return lapFrac;
    }
    return lapFrac;
  }

  // ── INFIELD DETAIL ──────────────────────────────────────
  _drawInfieldDetail(ctx, cx, cy, R, S) {
    // Centre text / logo
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = 'bold 28px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPRINT', cx, cy - 12);
    ctx.font = '14px "Barlow Condensed",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillText(this.venueType === 'indoor' ? 'INDOOR ARENA' : 'STADIUM TRACK', cx, cy + 14);
    ctx.restore();

    // A few field lines
    if (this.venueType === 'outdoor') {
      ctx.strokeStyle = 'rgba(60,120,50,0.5)';
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - S * 0.7, cy + i * (R * 0.22));
        ctx.lineTo(cx + S * 0.7, cy + i * (R * 0.22));
        ctx.stroke();
      }
    }
  }

  // ── FINISH LINE ON OVAL ──────────────────────────────────
  _drawFinishLineOval(ctx, cx, cy, innerR, outerR, S, lanes, laneRadii) {
    // Finish line = vertical line from inner to outer edge at start/finish (t=0)
    // t=0 is at the top of the right straight: x = cx+S, y = cy-innerR..cy-outerR
    const x = cx + S;
    const y1 = cy - outerR;
    const y2 = cy - innerR;

    // Checkerboard pattern
    const bh = (y2 - y1) / 10;
    for (let seg = 0; seg < 10; seg++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (seg + col) % 2 === 0 ? 'white' : 'black';
        ctx.fillRect(x - 3 + col * 3, y1 + seg * bh, 3, bh);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 11px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START / FINISH', x, y1 - 6);
  }

  // ── STAGGER LINES ───────────────────────────────────────
  _drawStaggerLines(ctx, cx, cy, innerR, S, lanes, laneRadii, laneW) {
    // Each lane starts slightly ahead of the previous
    // Stagger = extra distance = 2*PI*laneW per lane difference
    // Visually: curved lines across lanes at staggered positions on the track
    const perim = (t, R) => 2 * Math.PI * R + 2 * S;

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;

    for (let lane = 1; lane < lanes; lane++) {
      const R_mid = (laneRadii[lane] + laneRadii[lane + 1]) / 2;
      const R_inner = laneRadii[lane];
      const R_outer = laneRadii[lane + 1];

      // Stagger t for this lane relative to lane 0
      const lanePerim = 2 * Math.PI * R_mid + 2 * S;
      const lane0Perim = 2 * Math.PI * laneRadii[0] + 2 * S; // use inner edge
      const extraDist = lanePerim - lane0Perim; // extra distance for this lane
      // As fraction of this lane's perimeter, how far ahead is the stagger mark?
      // stagger_t relative to lane 0's start (t=0)
      // In standard 400m: lane 0 starts at t=0, lane N starts at t = N * staggerPerLane
      const staggerT = lane * this._staggerPerLane();

      // Position of the stagger mark on the oval
      const pos = ovalPos(staggerT, cx, cy, R_mid, S);
      // Draw a short line perpendicular to the track at that point
      const perp_x = -pos.ty;
      const perp_y = pos.tx;
      ctx.beginPath();
      ctx.moveTo(pos.x + perp_x * laneW * 0.5, pos.y + perp_y * laneW * 0.5);
      ctx.lineTo(pos.x - perp_x * laneW * 0.5, pos.y - perp_y * laneW * 0.5);
      ctx.stroke();
    }
  }

  _staggerPerLane() {
    if (!this.geo) return 0;
    const { innerR, S, laneW } = this.geo;
    const lane0Perim = 2 * Math.PI * innerR + 2 * S;
    const lane1Perim = 2 * Math.PI * (innerR + laneW) + 2 * S;
    return (lane1Perim - lane0Perim) / lane0Perim;
  }

  // ── LANE NUMBERS ────────────────────────────────────────
  _drawLaneNumbers(ctx, cx, cy, laneRadii, S, lanes) {
    ctx.font = 'bold 11px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < lanes; i++) {
      const r = (laneRadii[i] + laneRadii[i + 1]) / 2;
      // Place number on the bottom straight at the left side
      const pos = ovalPos(0.5, cx, cy, r, S); // t=0.5 = midpoint of bottom straight
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(i + 1, pos.x, pos.y);
    }
  }

  // ── RUNNER ON OVAL ──────────────────────────────────────
  _drawRunnerOnOval(ctx, runner, sx, sy, facingAngle) {
    ctx.save();
    ctx.translate(sx, sy);
    // Rotate so runner faces the direction they're going
    ctx.rotate(facingAngle - Math.PI / 2); // -PI/2 because sprites face right by default

    const scale = 0.75;
    ctx.scale(scale, scale);

    // Draw sprite (upright, at origin — translate so feet are at 0,0)
    if (runner.isPlayer) {
      drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], 0, 0, runner.frame, true, 1);
    } else {
      drawOpponent(ctx, 0, 0, runner.frame, runner.color, runner.skinTone, 1);
    }
    ctx.restore();
  }

  // ── YOU LABEL ───────────────────────────────────────────
  _drawYouLabel(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#FFD060';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 12px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeText('YOU ▼', x, y);
    ctx.fillText('YOU ▼', x, y);
    ctx.restore();
  }

  // ── RUNNER SPRITE (for straight race) ───────────────────
  _drawRunnerSprite(ctx, runner, x, y, scale) {
    if (runner.isPlayer) {
      drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], x, y, runner.frame, true, scale);
    } else {
      drawOpponent(ctx, x, y, runner.frame, runner.color, runner.skinTone, scale);
    }
  }

  // ── STRAIGHT BACKGROUND ─────────────────────────────────
  _drawStraightBG(ctx, W, H) {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.32);
    if (this.venueType === 'indoor') {
      sky.addColorStop(0, '#14101E'); sky.addColorStop(1, '#221530');
    } else {
      sky.addColorStop(0, '#1A3050'); sky.addColorStop(1, '#2A4A80');
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.32);

    if (this.venueType === 'indoor') {
      // Ceiling lights
      ctx.strokeStyle = 'rgba(80,60,120,0.3)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const x = (i / 8) * W;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(W / 2, H * 0.28); ctx.stroke();
      }
      [0.15, 0.35, 0.5, 0.65, 0.85].forEach(lx => {
        const px = lx * W;
        ctx.fillStyle = '#FFF8E0';
        ctx.beginPath(); ctx.ellipse(px, H * 0.18, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        const lg = ctx.createRadialGradient(px, H * 0.18, 0, px, H * 0.18, 80);
        lg.addColorStop(0, 'rgba(255,248,180,0.2)'); lg.addColorStop(1, 'transparent');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(px, H * 0.18, 80, 50, 0, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      [[W * .18, H * .05, 55, 18], [W * .55, H * .09, 80, 22], [W * .82, H * .04, 45, 16]].forEach(([x, y, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      });
      // Stands
      const sY = H * 0.02, sH = H * 0.28;
      ctx.fillStyle = '#1A2840';
      ctx.beginPath(); ctx.moveTo(0, sY + sH); ctx.lineTo(0, sY + 10); ctx.lineTo(W * 0.34, sY); ctx.lineTo(W * 0.34, sY + sH); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, sY + sH); ctx.lineTo(W, sY + 10); ctx.lineTo(W * 0.66, sY); ctx.lineTo(W * 0.66, sY + sH); ctx.closePath(); ctx.fill();
      for (let r = 0; r < 8; r++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, sY + r * 9); ctx.lineTo(W * 0.34, sY + r * 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W, sY + r * 9); ctx.lineTo(W * 0.66, sY + r * 5); ctx.stroke();
      }
    }
  }

  // ── OVAL BACKGROUND ─────────────────────────────────────
  _drawOvalBG(ctx, W, H) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (this.venueType === 'indoor') {
      sky.addColorStop(0, '#14101E');
      sky.addColorStop(0.5, '#1C1530');
      sky.addColorStop(1, '#12101A');
    } else {
      sky.addColorStop(0, '#1A3050');
      sky.addColorStop(0.5, '#1A4060');
      sky.addColorStop(1, '#102030');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (this.venueType === 'outdoor') {
      // Stands around the outside of the oval
      const { cx, cy, outerR, S } = this.geo;
      ctx.save();
      ctx.strokeStyle = 'rgba(26,40,64,0.9)';
      ctx.lineWidth = outerR * 0.35;
      _drawOvalShape(ctx, cx, cy, outerR + outerR * 0.18, S + 15, null, null, 0, false);
      ctx.stroke();
      // Stand rows
      for (let i = 1; i <= 5; i++) {
        const rr = outerR + i * outerR * 0.06;
        ctx.strokeStyle = `rgba(255,255,255,${0.015 + i * 0.005})`;
        ctx.lineWidth = 1;
        _drawOvalShape(ctx, cx, cy, rr, S + 5 + i * 3, null, null, 0, false);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Indoor: ceiling glow
      const { cx, cy } = this.geo;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      glow.addColorStop(0, 'rgba(180,120,255,0.06)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── FINISH LINE (vertical, for straight) ────────────────
  _drawFinishLineVertical(ctx, sx, trackTop, trackBot) {
    const bh = (trackBot - trackTop) / 12;
    for (let seg = 0; seg < 12; seg++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (seg + col) % 2 === 0 ? 'white' : 'black';
        ctx.fillRect(sx - 4 + col * 4, trackTop + seg * bh, 4, bh);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', sx, trackTop - 5);
  }

  // ── LINEAR MINI MAP ─────────────────────────────────────
  _drawLinearMiniMap(ctx, W, H, progress, runners) {
    const mmW = 200, mmH = 42, mmX = W / 2 - mmW / 2, mmY = H - mmH - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect(mmX, mmY, mmW, mmH, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

    const bX = mmX + 10, bW = mmW - 20, bY = mmY + 18, bH = 10;
    const cfg = this.cfg;
    ctx.fillStyle = cfg.color; ctx.fillRect(bX, bY, bW, bH);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bX + bW, bY - 4); ctx.lineTo(bX + bW, bY + bH + 4); ctx.stroke();

    runners.forEach(r => {
      const dx = bX + r.progress * bW, dy = bY + bH / 2;
      ctx.fillStyle = r.isPlayer ? '#FFD060' : r.color;
      ctx.beginPath(); ctx.arc(dx, dy, r.isPlayer ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      if (r.isPlayer) { ctx.strokeStyle = 'white'; ctx.lineWidth = 1.2; ctx.stroke(); }
    });

    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '9px "Barlow Condensed"';
    ctx.textAlign = 'center'; ctx.fillText(this.eventMeters + 'm', mmX + mmW / 2, mmY + 11);
  }

  // ── OVAL LAP DISPLAY ────────────────────────────────────
  _drawOvalLapDisplay(ctx, W, H, runners, progress) {
    if (this.totalLaps <= 1) return;
    const lap = Math.min(this.totalLaps, Math.floor(progress * this.totalLaps) + 1);
    const lapFrac = (progress * this.totalLaps) % 1;

    // Lap progress bar — top left corner
    const bX = 16, bY = 16, bW = 160, bH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(bX - 8, bY - 16, bW + 16, bH + 32, 5); ctx.fill();
    ctx.fillStyle = this.cfg.colorDark;
    ctx.fillRect(bX, bY, bW, bH);
    ctx.fillStyle = '#FFD060';
    ctx.fillRect(bX, bY, lapFrac * bW, bH);
    ctx.fillStyle = 'white'; ctx.font = 'bold 11px "Bebas Neue",sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('LAP ' + lap + ' / ' + this.totalLaps, bX, bY - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '9px "Barlow Condensed"';
    ctx.fillText(Math.round(lapFrac * 100) + '% complete', bX, bY + bH + 11);
  }
}
