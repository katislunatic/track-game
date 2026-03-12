// track.js — Track rendering

const TRACK_CONFIG = {
  indoor: {
    name: 'Indoor',
    color: '#C25B1A',
    colorDark: '#8B3A0A',
    colorLight: '#D4763A',
    infield: '#2A5A28',
    infieldLine: '#3A7A36',
    lanes: 6,
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
    label: 'OUTDOOR STADIUM'
  }
};

function drawTrackPreview(canvas, venueType) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cfg = TRACK_CONFIG[venueType];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#08080F';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.6);
  glow.addColorStop(0,'rgba(200,100,30,0.12)');
  glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
  const lanes=cfg.lanes, cx=W/2, cy=H/2, rx=W*0.40, ry=H*0.36;
  ctx.fillStyle=cfg.colorDark;
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
  for(let i=lanes;i>=1;i--){
    const f=i/lanes;
    ctx.fillStyle=i%2===0?cfg.color:cfg.colorLight;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx*(0.38+f*0.62),ry*(0.38+f*0.62),0,0,Math.PI*2); ctx.fill();
  }
  const irx=rx*0.38,iry=ry*0.38;
  const ig=ctx.createRadialGradient(cx,cy,0,cx,cy,irx);
  ig.addColorStop(0,cfg.infieldLine); ig.addColorStop(1,cfg.infield);
  ctx.fillStyle=ig; ctx.beginPath(); ctx.ellipse(cx,cy,irx,iry,0,0,Math.PI*2); ctx.fill();
  for(let i=0;i<=lanes;i++){
    const f=i/lanes;
    ctx.strokeStyle=i===0||i===lanes?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.35)';
    ctx.lineWidth=i===0||i===lanes?1.5:0.8;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx*(0.38+f*0.62),ry*(0.38+f*0.62),0,0,Math.PI*2); ctx.stroke();
  }
  ctx.strokeStyle='white'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(cx+irx,cy+4); ctx.lineTo(cx+rx,cy+4); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.65)';
  ctx.font='bold 11px "Barlow Condensed",sans-serif';
  ctx.textAlign='center';
  ctx.fillText(cfg.label,cx,H-10);
}

class RaceTrack {
  constructor(canvas, venueType, eventMeters) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.venueType = venueType;
    this.eventMeters = eventMeters;
    this.cfg = TRACK_CONFIG[venueType];
    this.totalLaps = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;
    this.raceType = (eventMeters === 400) ? 'oval' : 'straight';
    this.PPM = 8;
    this.trackPixelLen = eventMeters * this.PPM;
    this._resize();
  }

  _resize() {
    this.W = this.canvas.width  = this.canvas.offsetWidth  || window.innerWidth;
    this.H = this.canvas.height = this.canvas.offsetHeight || 500;
  }

  draw(progress, runners) {
    this._resize();
    this.ctx.clearRect(0, 0, this.W, this.H);
    if (this.raceType === 'straight') {
      this._drawStraight(progress, runners);
    } else {
      this._drawOvalSideView(progress, runners);
    }
  }

  _drawStraight(progress, runners) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cfg = this.cfg;
    const laneCount = cfg.lanes;

    const playerWorldX = progress * this.trackPixelLen;
    const camX = playerWorldX - W * 0.35;

    this._drawBG(ctx, W, H);

    const trackTop = H * 0.46;
    const trackBot = H;

    // Grass edge strip
    ctx.fillStyle = cfg.infield;
    ctx.fillRect(0, trackTop - 12, W, 14);

    // Track surface
    const tGrad = ctx.createLinearGradient(0, trackTop, 0, trackBot);
    tGrad.addColorStop(0, cfg.colorLight);
    tGrad.addColorStop(0.25, cfg.color);
    tGrad.addColorStop(1, cfg.colorDark);
    ctx.fillStyle = tGrad;
    ctx.fillRect(0, trackTop, W, trackBot - trackTop);

    // Lane lines
    for (let l = 0; l <= laneCount; l++) {
      const t = l / laneCount;
      const y = trackTop + t * (trackBot - trackTop);
      const isEdge = l === 0 || l === laneCount;
      ctx.strokeStyle = isEdge ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = isEdge ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Distance markers
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    const mSpace = 10 * this.PPM;
    const first = Math.ceil(camX / mSpace) * mSpace;
    for (let wx = first; wx < camX + W + mSpace; wx += mSpace) {
      const sx = wx - camX;
      if (sx < 0 || sx > W) continue;
      ctx.beginPath(); ctx.moveTo(sx, trackTop); ctx.lineTo(sx, trackBot); ctx.stroke();
      const mv = Math.round(wx / this.PPM);
      if (mv > 0 && mv <= this.eventMeters && mv % 20 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '11px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mv + 'm', sx, trackTop - 3);
      }
    }
    ctx.restore();

    // Finish line
    const fsx = this.trackPixelLen - camX;
    if (fsx > -10 && fsx < W + 10) {
      this._drawFinishLine(ctx, fsx, trackTop, trackBot);
    }

    // Start line
    const startSX = 0 - camX;
    if (startSX > -20 && startSX < W + 20) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(startSX, trackTop); ctx.lineTo(startSX, trackBot); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Runners — sorted by lane so back lanes render behind
    const sorted = [...runners].sort((a, b) => b.lane - a.lane);
    sorted.forEach(runner => {
      const rwx = runner.progress * this.trackPixelLen;
      const sx = rwx - camX;
      if (sx < -80 || sx > W + 80) return;
      const laneFrac = (runner.lane + 0.5) / laneCount;
      const sy = trackTop + 12 + laneFrac * (trackBot - trackTop - 70);
      const scale = 0.5 + laneFrac * 0.95;
      this._drawRunner(ctx, runner, sx, sy, scale);
      if (runner.isPlayer) {
        ctx.fillStyle = '#FFD060';
        ctx.font = 'bold 11px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOU ▼', sx, sy - 42 * scale - 2);
      }
    });

    this._drawStraightMiniMap(ctx, W, H, progress, runners);
  }

  _drawOvalSideView(progress, runners) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cfg = this.cfg;
    const laneCount = cfg.lanes;

    const lapProgress = (progress * this.totalLaps) % 1;
    const playerWorldX = lapProgress * this.trackPixelLen;
    const camX = playerWorldX - W * 0.35;

    this._drawBG(ctx, W, H);

    const trackTop = H * 0.46;
    const trackBot = H;

    ctx.fillStyle = cfg.infield;
    ctx.fillRect(0, trackTop - 12, W, 14);

    const tGrad = ctx.createLinearGradient(0, trackTop, 0, trackBot);
    tGrad.addColorStop(0, cfg.colorLight);
    tGrad.addColorStop(0.25, cfg.color);
    tGrad.addColorStop(1, cfg.colorDark);
    ctx.fillStyle = tGrad;
    ctx.fillRect(0, trackTop, W, trackBot - trackTop);

    for (let l = 0; l <= laneCount; l++) {
      const t = l / laneCount;
      const y = trackTop + t * (trackBot - trackTop);
      const isEdge = l === 0 || l === laneCount;
      ctx.strokeStyle = isEdge ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)';
      ctx.lineWidth = isEdge ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }

    // Start/finish lines cycling with lap
    for (let lap = -1; lap <= this.totalLaps + 1; lap++) {
      const fwx = lap * this.trackPixelLen;
      const fsx = fwx - camX;
      if (fsx > -10 && fsx < W + 10) {
        this._drawFinishLine(ctx, fsx, trackTop, trackBot, 'START / FINISH');
      }
    }

    // Runners
    const sorted = [...runners].sort((a, b) => b.lane - a.lane);
    sorted.forEach(runner => {
      const runnerLapP = (runner.progress * this.totalLaps) % 1;
      let rwx = runnerLapP * this.trackPixelLen;
      let sx = rwx - camX;
      // wrap
      if (sx < -this.trackPixelLen * 0.5) sx += this.trackPixelLen;
      if (sx > W + this.trackPixelLen * 0.5) sx -= this.trackPixelLen;
      if (sx < -80 || sx > W + 80) return;

      const laneFrac = (runner.lane + 0.5) / laneCount;
      const sy = trackTop + 12 + laneFrac * (trackBot - trackTop - 70);
      const scale = 0.5 + laneFrac * 0.95;
      this._drawRunner(ctx, runner, sx, sy, scale);
      if (runner.isPlayer) {
        ctx.fillStyle = '#FFD060';
        ctx.font = 'bold 11px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOU ▼', sx, sy - 42 * scale - 2);
      }
    });

    this._drawOvalMiniMap(ctx, W, H, runners, progress);
  }

  _drawFinishLine(ctx, sx, trackTop, trackBot, label) {
    const bw = 5;
    const segH = (trackBot - trackTop) / 10;
    for (let seg = 0; seg < 10; seg++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (seg + col) % 2 === 0 ? 'white' : 'black';
        ctx.fillRect(sx - bw + col * bw, trackTop + seg * segH, bw, segH);
      }
    }
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label || 'FINISH', sx, trackTop - 4);
  }

  _drawBG(ctx, W, H) {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.48);
    if (this.venueType === 'indoor') {
      sky.addColorStop(0, '#14101E'); sky.addColorStop(1, '#221530');
    } else {
      sky.addColorStop(0, '#1A3050'); sky.addColorStop(1, '#2A4A80');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.48);
    if (this.venueType === 'indoor') this._drawIndoorBG(ctx, W, H);
    else this._drawOutdoorBG(ctx, W, H);
  }

  _drawIndoorBG(ctx, W, H) {
    ctx.strokeStyle = 'rgba(80,60,120,0.4)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const x = (i/8)*W;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(W/2,H*0.3); ctx.stroke();
    }
    [0.15,0.35,0.5,0.65,0.85].forEach(lx => {
      const px = lx * W;
      ctx.strokeStyle='rgba(120,100,150,0.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,H*0.22); ctx.stroke();
      ctx.fillStyle='#FFF8E0';
      ctx.beginPath(); ctx.ellipse(px,H*0.22,16,7,0,0,Math.PI*2); ctx.fill();
      const lg=ctx.createRadialGradient(px,H*0.22,0,px,H*0.22,90);
      lg.addColorStop(0,'rgba(255,248,180,0.22)'); lg.addColorStop(1,'transparent');
      ctx.fillStyle=lg; ctx.beginPath(); ctx.ellipse(px,H*0.22,90,60,0,0,Math.PI*2); ctx.fill();
    });
  }

  _drawOutdoorBG(ctx, W, H) {
    ctx.fillStyle='rgba(255,255,255,0.07)';
    [[W*.18,H*.07,55,18],[W*.55,H*.11,80,22],[W*.82,H*.06,45,16]].forEach(([x,y,rx,ry])=>{
      ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
    });
    const sY=H*0.18,sH=H*0.26;
    ctx.fillStyle='#1A2840';
    ctx.beginPath(); ctx.moveTo(0,sY+sH); ctx.lineTo(0,sY+15); ctx.lineTo(W*0.36,sY); ctx.lineTo(W*0.36,sY+sH); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W,sY+sH); ctx.lineTo(W,sY+15); ctx.lineTo(W*0.64,sY); ctx.lineTo(W*0.64,sY+sH); ctx.closePath(); ctx.fill();
    for(let r=0;r<6;r++){
      ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,sY+r*9); ctx.lineTo(W*0.36,sY+r*6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W,sY+r*9); ctx.lineTo(W*0.64,sY+r*6); ctx.stroke();
    }
    ctx.fillStyle='#080E1C'; ctx.fillRect(W*0.38,sY-8,W*0.24,sH*0.65);
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.strokeRect(W*0.38,sY-8,W*0.24,sH*0.65);
    ctx.fillStyle='rgba(26,143,227,0.85)'; ctx.font='bold 10px "Bebas Neue",sans-serif'; ctx.textAlign='center';
    ctx.fillText('SPRINT STADIUM',W/2,sY+12);
  }

  _drawRunner(ctx, runner, sx, sy, scale) {
    if (runner.isPlayer) {
      drawAthlete(ctx, ATHLETES[runner.athleteIdx || 0], sx, sy, runner.frame, true, scale);
    } else {
      drawOpponent(ctx, sx, sy, runner.frame, runner.color, runner.skinTone, scale);
    }
  }

  _drawStraightMiniMap(ctx, W, H, progress, runners) {
    const mmW=180, mmH=40, mmX=W/2-mmW/2, mmY=H-mmH-8;
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(mmX,mmY,mmW,mmH,4); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.stroke();
    const bX=mmX+8,bW=mmW-16,bY=mmY+16,bH=10;
    ctx.fillStyle=this.cfg.color; ctx.fillRect(bX,bY,bW,bH);
    ctx.strokeStyle='white'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(bX+bW,bY-4); ctx.lineTo(bX+bW,bY+bH+4); ctx.stroke();
    runners.forEach(r=>{
      const dx=bX+r.progress*bW, dy=bY+bH/2;
      ctx.fillStyle=r.isPlayer?'#FFD060':r.color;
      ctx.beginPath(); ctx.arc(dx,dy,r.isPlayer?5:3,0,Math.PI*2); ctx.fill();
      if(r.isPlayer){ctx.strokeStyle='white';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(dx,dy,5,0,Math.PI*2);ctx.stroke();}
    });
    ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='9px "Barlow Condensed",sans-serif'; ctx.textAlign='center';
    ctx.fillText(this.eventMeters+'m RACE',mmX+mmW/2,mmY+10);
  }

  _drawOvalMiniMap(ctx, W, H, runners, progress) {
    const mmW=160,mmH=100,mmX=W-mmW-10,mmY=10;
    const cx=mmX+mmW/2,cy=mmY+mmH/2,rx=mmW*0.42,ry=mmH*0.36;
    ctx.fillStyle='rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect(mmX,mmY,mmW,mmH,6); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.stroke();
    ctx.strokeStyle=this.cfg.color; ctx.lineWidth=10;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(cx+rx*0.6,cy); ctx.lineTo(cx+rx,cy); ctx.stroke();
    runners.forEach(r=>{
      const lapP=(r.progress*this.totalLaps)%1;
      const angle=lapP*Math.PI*2-Math.PI/2;
      const dx=cx+Math.cos(angle)*rx*0.78, dy=cy+Math.sin(angle)*ry*0.78;
      ctx.fillStyle=r.isPlayer?'#FFD060':r.color;
      ctx.beginPath(); ctx.arc(dx,dy,r.isPlayer?5.5:3.5,0,Math.PI*2); ctx.fill();
      if(r.isPlayer){ctx.strokeStyle='white';ctx.lineWidth=1.5;ctx.stroke();}
    });
    const lap=Math.min(this.totalLaps,Math.floor(progress*this.totalLaps)+1);
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='9px "Barlow Condensed"'; ctx.textAlign='center';
    ctx.fillText('LAP '+lap+'/'+this.totalLaps,cx,mmY+mmH-6);
  }
}
