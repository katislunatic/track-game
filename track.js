// track.js — Track rendering for indoor and outdoor ovals

const TRACK_CONFIG = {
  indoor: {
    name: 'Indoor',
    color: '#C25B1A',
    colorDark: '#8B3A0A',
    colorLight: '#D4763A',
    infield: '#2A5A28',
    infieldLine: '#3A7A36',
    lanes: 6,
    laneWidth: 36,
    // 200m indoor oval: tighter, more pronounced banks
    straightLength: 0.28, // fraction of total
    curveRadius: 0.22,    // relative tightness
    bankAngle: 12,        // degrees of banking illusion
    surfaceLines: true,
    label: 'INDOOR OVAL'
  },
  outdoor: {
    name: 'Outdoor',
    color: '#C84B1A',
    colorDark: '#8B2E08',
    colorLight: '#D46640',
    infield: '#2D6A2A',
    infieldLine: '#3E8A38',
    lanes: 8,
    laneWidth: 32,
    straightLength: 0.32,
    curveRadius: 0.18,
    bankAngle: 5,
    surfaceLines: true,
    label: 'OUTDOOR STADIUM'
  }
};

// Draw a top-down oval track preview
function drawTrackPreview(canvas, venueType) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cfg = TRACK_CONFIG[venueType];

  ctx.clearRect(0, 0, W, H);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0a14');
  bgGrad.addColorStop(1, '#050510');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Ambient glow
  const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.6);
  glow.addColorStop(0, 'rgba(200,100,30,0.1)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const lanes = cfg.lanes;
  const lw = cfg.laneWidth * 0.55;
  const totalW = lanes * lw;
  const rx = W * 0.38, ry = H * 0.32;
  const cx = W / 2, cy = H / 2;

  // Draw lanes from outer to inner
  for (let i = lanes; i >= 0; i--) {
    const frac = i / lanes;
    const r = 0.3 + frac * 0.65;
    const laneRx = rx * (0.35 + frac * 0.65);
    const laneRy = ry * (0.35 + frac * 0.65);

    if (i > 0) {
      const lc = i === lanes ? cfg.colorDark : cfg.color;
      const alt = (lanes - i) % 2 === 0;
      ctx.fillStyle = alt ? cfg.color : cfg.colorLight;
      ctx.beginPath();
      drawOval(ctx, cx, cy, laneRx, laneRy);
      ctx.fill();
    }
  }

  // Infield
  const infRx = rx * 0.35, infRy = ry * 0.35;
  const infGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, infRx);
  infGrad.addColorStop(0, cfg.infieldLine);
  infGrad.addColorStop(1, cfg.infield);
  ctx.fillStyle = infGrad;
  ctx.beginPath();
  drawOval(ctx, cx, cy, infRx, infRy);
  ctx.fill();

  // Lane lines
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= lanes; i++) {
    const frac = i / lanes;
    const laneRx = rx * (0.35 + frac * 0.65);
    const laneRy = ry * (0.35 + frac * 0.65);
    ctx.beginPath();
    drawOval(ctx, cx, cy, laneRx, laneRy);
    ctx.stroke();
  }

  // Start/finish line
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  const startRx = rx * 0.35, startFx = rx * 1.0;
  ctx.beginPath();
  ctx.moveTo(cx + startRx, cy - ry * 0.35);
  ctx.lineTo(cx + startFx, cy - ry * 1.0);
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 11px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0.2em';
  ctx.fillText(cfg.label, cx, H - 12);
}

function drawOval(ctx, cx, cy, rx, ry) {
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

// ══════════════════════════════════════════════
// RACE TRACK — side-scrolling perspective view
// ══════════════════════════════════════════════

class RaceTrack {
  constructor(canvas, venueType, eventMeters) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.venueType = venueType;
    this.eventMeters = eventMeters;
    this.cfg = TRACK_CONFIG[venueType];

    // Determine laps
    if (venueType === 'indoor' && eventMeters === 400) {
      this.totalLaps = 2;
    } else if (venueType === 'indoor' && eventMeters === 200) {
      this.totalLaps = 1;
    } else if (venueType === 'outdoor' && eventMeters === 400) {
      this.totalLaps = 1;
    } else {
      this.totalLaps = 1; // sprints: straight race
    }

    this.isSprint = (eventMeters <= 200 && !(venueType === 'outdoor' && eventMeters === 200));
    // 60m indoor, 100m outdoor are straight sprints
    // 200m both venues = curve + straight
    // 400m = full oval(s)
    if (eventMeters === 60 || eventMeters === 100) {
      this.raceType = 'straight';
    } else if (eventMeters === 200) {
      this.raceType = 'half';
    } else {
      this.raceType = 'oval';
    }

    this.cameraX = 0;
    this.totalRaceLength = eventMeters * 4.2; // pixels per meter equivalent

    this._resize();
  }

  _resize() {
    this.W = this.canvas.width = this.canvas.offsetWidth || window.innerWidth;
    this.H = this.canvas.height = this.canvas.offsetHeight || 500;
  }

  // Draw the track scene given player progress (0-1) and all runners
  draw(progress, runners, playerLane) {
    const ctx = this.ctx;
    this._resize();
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    if (this.raceType === 'straight') {
      this._drawStraightRace(ctx, W, H, progress, runners, playerLane);
    } else if (this.raceType === 'half') {
      this._drawHalfOvalRace(ctx, W, H, progress, runners, playerLane);
    } else {
      this._drawOvalRace(ctx, W, H, progress, runners, playerLane);
    }
  }

  _drawSkyAndStands(ctx, W, H) {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    if (this.venueType === 'indoor') {
      sky.addColorStop(0, '#1A0F28');
      sky.addColorStop(1, '#2A1530');
    } else {
      sky.addColorStop(0, '#1A3A6A');
      sky.addColorStop(1, '#2A5090');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.45);

    if (this.venueType === 'indoor') {
      this._drawIndoorCeiling(ctx, W, H);
    } else {
      this._drawOutdoorStands(ctx, W, H);
    }
  }

  _drawIndoorCeiling(ctx, W, H) {
    // Ceiling structure
    ctx.fillStyle = '#12101E';
    ctx.fillRect(0, 0, W, H * 0.3);

    // Roof trusses
    ctx.strokeStyle = 'rgba(80,60,100,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = (i / 7) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(W / 2, H * 0.28);
      ctx.stroke();
    }

    // Stadium lights (hanging)
    const lights = [0.15, 0.35, 0.5, 0.65, 0.85];
    lights.forEach(lx => {
      const lxPx = lx * W;
      // cable
      ctx.strokeStyle = 'rgba(120,100,140,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lxPx, 0);
      ctx.lineTo(lxPx, H * 0.22);
      ctx.stroke();
      // light fixture
      ctx.fillStyle = '#FFF8E0';
      ctx.beginPath();
      ctx.ellipse(lxPx, H * 0.22, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // glow
      const lg = ctx.createRadialGradient(lxPx, H * 0.22, 0, lxPx, H * 0.22, 80);
      lg.addColorStop(0, 'rgba(255,248,200,0.25)');
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(lxPx, H * 0.22, 80, 50, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawOutdoorStands(ctx, W, H) {
    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    [[W * 0.15, H * 0.08, 60, 20], [W * 0.55, H * 0.12, 90, 25], [W * 0.8, H * 0.06, 50, 18]].forEach(([x, y, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Stadium stands silhouette
    const standH = H * 0.28;
    const standY = H * 0.17;

    // Left stands
    ctx.fillStyle = '#1E2D4A';
    ctx.beginPath();
    ctx.moveTo(0, standY + standH);
    ctx.lineTo(0, standY + 20);
    ctx.lineTo(W * 0.38, standY);
    ctx.lineTo(W * 0.38, standY + standH);
    ctx.closePath();
    ctx.fill();

    // Right stands
    ctx.fillStyle = '#1E2D4A';
    ctx.beginPath();
    ctx.moveTo(W, standY + standH);
    ctx.lineTo(W, standY + 20);
    ctx.lineTo(W * 0.62, standY);
    ctx.lineTo(W * 0.62, standY + standH);
    ctx.closePath();
    ctx.fill();

    // Stand rows
    for (let r = 0; r < 6; r++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, standY + r * 8);
      ctx.lineTo(W * 0.38, standY + r * 8 * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W, standY + r * 8);
      ctx.lineTo(W * 0.62, standY + r * 8 * 0.6);
      ctx.stroke();
    }

    // Scoreboard
    ctx.fillStyle = '#0A1020';
    ctx.fillRect(W * 0.38, standY - 10, W * 0.24, standH * 0.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(W * 0.38, standY - 10, W * 0.24, standH * 0.7);
    ctx.fillStyle = 'rgba(26,143,227,0.8)';
    ctx.font = 'bold 11px "Bebas Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPRINT STADIUM', W / 2, standY + 12);
  }

  _drawStraightRace(ctx, W, H, progress, runners, playerLane) {
    this._drawSkyAndStands(ctx, W, H);

    const groundY = H * 0.52;
    const laneCount = this.cfg.lanes;
    const laneH = (H - groundY - 40) / laneCount;
    const visibleMeters = this.eventMeters * 1.2;

    // Perspective vanishing point
    const vpX = W * 0.5, vpY = groundY;

    // Infield / grass beyond finish
    ctx.fillStyle = this.cfg.infield;
    ctx.fillRect(0, groundY, W, 20);

    // Track surface
    const trackGrad = ctx.createLinearGradient(0, groundY, 0, H);
    trackGrad.addColorStop(0, this.cfg.colorLight);
    trackGrad.addColorStop(0.3, this.cfg.color);
    trackGrad.addColorStop(1, this.cfg.colorDark);
    ctx.fillStyle = trackGrad;
    ctx.fillRect(0, groundY + 18, W, H - groundY);

    // Perspective lane lines
    for (let l = 0; l <= laneCount; l++) {
      const yFraction = l / laneCount;
      const screenY = groundY + 18 + yFraction * (H - groundY - 18);
      ctx.strokeStyle = l === 0 || l === laneCount ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = l === 0 || l === laneCount ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(W, screenY);
      ctx.stroke();
    }

    // Distance markers
    const metersMoved = progress * this.eventMeters;
    for (let m = 0; m <= this.eventMeters; m += 10) {
      const relPos = (m - metersMoved) / visibleMeters;
      const screenX = vpX + (relPos - 0.5) * W * 2.5;
      if (screenX < -50 || screenX > W + 50) continue;

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(screenX, groundY + 18);
      ctx.lineTo(screenX, H);
      ctx.stroke();
      ctx.setLineDash([]);

      if (m % 20 === 0 && m > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '10px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m + 'm', screenX, groundY + 12);
      }
    }

    // Finish line
    const finishRel = (this.eventMeters - metersMoved) / visibleMeters;
    const finishX = vpX + (finishRel - 0.5) * W * 2.5;
    if (finishX > 0 && finishX < W) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(finishX, groundY + 16);
      ctx.lineTo(finishX, H);
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 13px "Bebas Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', finishX, groundY + 10);
    }

    // Draw runners
    runners.forEach((runner, idx) => {
      const relPos = (runner.progress * this.eventMeters - metersMoved) / visibleMeters;
      const screenX = vpX + (relPos - 0.5) * W * 2.5;
      const laneFrac = (runner.lane + 0.5) / laneCount;
      const screenY = groundY + 22 + laneFrac * (H - groundY - 60);
      const runnerScale = 0.6 + laneFrac * 0.8;

      if (screenX < -60 || screenX > W + 60) return;

      if (runner.isPlayer) {
        drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], screenX, screenY, runner.frame, true, runnerScale);
      } else {
        drawOpponent(ctx, screenX, screenY, runner.frame, runner.color, runner.skinTone, runnerScale);
      }
    });
  }

  _drawHalfOvalRace(ctx, W, H, progress, runners, playerLane) {
    // 200m: starts on curve, ends on straight
    // Simplified: show as perspective track with curved feel
    this._drawStraightRace(ctx, W, H, progress, runners, playerLane);

    // Add curvature effect
    if (progress < 0.45) {
      const curveIntensity = (1 - progress / 0.45) * 0.3;
      ctx.fillStyle = `rgba(0,0,0,${curveIntensity * 0.4})`;
      ctx.fillRect(0, 0, W * 0.1, H);
      ctx.fillRect(W * 0.9, 0, W * 0.1, H);
    }
  }

  _drawOvalRace(ctx, W, H, progress, runners, playerLane) {
    // 400m+ races: true oval overhead + side view blend
    this._drawSkyAndStands(ctx, W, H);

    const groundY = H * 0.5;
    const laneCount = this.cfg.lanes;
    const cfgC = this.cfg;

    // Track surface
    ctx.fillStyle = cfgC.colorDark;
    ctx.fillRect(0, groundY, W, H - groundY);

    const trackGrad = ctx.createLinearGradient(0, groundY, 0, H);
    trackGrad.addColorStop(0, cfgC.colorLight);
    trackGrad.addColorStop(0.4, cfgC.color);
    trackGrad.addColorStop(1, cfgC.colorDark);
    ctx.fillStyle = trackGrad;
    ctx.fillRect(0, groundY + 10, W, H - groundY);

    // Lane lines
    for (let l = 0; l <= laneCount; l++) {
      const yFraction = l / laneCount;
      const screenY = groundY + 12 + yFraction * (H - groundY - 12);
      ctx.strokeStyle = l === 0 || l === laneCount ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = l === 0 || l === laneCount ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(W, screenY);
      ctx.stroke();
    }

    // Overhead mini-map oval
    this._drawMiniMap(ctx, W, H, runners, progress);

    // Moving stripe effect
    const stripeOff = (progress * W * 3) % 80;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let sx = -80 + stripeOff; sx < W + 80; sx += 80) {
      ctx.beginPath();
      ctx.moveTo(sx, groundY);
      ctx.lineTo(sx + 40, H);
      ctx.stroke();
    }

    // Runners
    runners.forEach((runner, idx) => {
      const trackProgress = runner.progress; // 0-1 of full race
      const laneFrac = (runner.lane + 0.5) / laneCount;
      // Position on screen based on race progress relative to player
      const playerProgress = runners.find(r => r.isPlayer)?.progress || 0;
      const relativeOffset = (trackProgress - playerProgress) * this.eventMeters * 5;
      const screenX = W * 0.42 + relativeOffset;
      const screenY = groundY + 14 + laneFrac * (H - groundY - 50);
      const runnerScale = 0.55 + laneFrac * 0.75;

      if (screenX < -60 || screenX > W + 60) return;

      if (runner.isPlayer) {
        drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], screenX, screenY, runner.frame, true, runnerScale);
      } else {
        drawOpponent(ctx, screenX, screenY, runner.frame, runner.color, runner.skinTone, runnerScale);
      }
    });
  }

  _drawMiniMap(ctx, W, H, runners, progress) {
    const mmX = W - 160, mmY = 12;
    const mmW = 148, mmH = 90;
    const cx = mmX + mmW / 2, cy = mmY + mmH / 2;
    const rx = mmW * 0.42, ry = mmH * 0.38;

    // BG
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(mmX, mmY, mmW, mmH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Oval
    ctx.strokeStyle = this.cfg.color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Lane lines
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let l = 1; l < this.cfg.lanes; l++) {
      const frac = l / this.cfg.lanes;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * (0.6 + frac * 0.4), ry * (0.6 + frac * 0.4), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Start/finish line on map
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.6, cy - ry * 0.05);
    ctx.lineTo(cx + rx * 1.0, cy - ry * 0.05);
    ctx.stroke();

    // Runner dots
    runners.forEach(runner => {
      const angle = runner.progress * Math.PI * 2 * this.totalLaps - Math.PI / 2;
      const dotX = cx + Math.cos(angle) * rx * 0.8;
      const dotY = cy + Math.sin(angle) * ry * 0.8;

      ctx.beginPath();
      ctx.arc(dotX, dotY, runner.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = runner.isPlayer ? '#FFD060' : runner.color;
      ctx.fill();
      if (runner.isPlayer) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Lap label
    if (this.totalLaps > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '9px "Barlow Condensed"';
      ctx.textAlign = 'center';
      ctx.fillText('LAP TRACKER', cx, mmY + mmH - 5);
    }
  }
}
