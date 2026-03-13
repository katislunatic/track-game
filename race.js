// race.js — Race engine

const OPPONENT_COLORS = [
  { color: '#E8392A', skinTone: '#C8956C' },
  { color: '#2ECC71', skinTone: '#8B5A2B' },
  { color: '#9B59B6', skinTone: '#6B3A2A' },
  { color: '#1A8FE3', skinTone: '#FDBCB4' },
  { color: '#E67E22', skinTone: '#8B5A2B' },
  { color: '#E91E8C', skinTone: '#C8956C' },
  { color: '#00BCD4', skinTone: '#6B3A2A' },
];

const WORLD_RECORDS = {
  'indoor-60':   6.34,
  'indoor-200':  19.92,
  'indoor-400':  44.57,
  'outdoor-100': 9.58,
  'outdoor-200': 19.19,
  'outdoor-400': 43.03,
};

class RaceEngine {
  constructor(venueType, eventMeters, athleteIdx) {
    this.venueType   = venueType;
    this.eventMeters = eventMeters;
    this.athleteIdx  = athleteIdx;
    this.athlete     = ATHLETES[athleteIdx];
    this.totalLaps   = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;
    this.state       = 'idle';
    this.elapsed     = 0;
    this.finishTime  = null;
    this.falseStart  = false;
    this._onKeyDown  = null;
    this.lastAltKey  = null;

    const cfg       = TRACK_CONFIG[venueType];
    const laneCount = cfg.lanes;

    // Player is in the middle lane (0-indexed)
    this.playerLane = Math.floor(laneCount / 2);

    const a = this.athlete;
    // Top speed in m/s — tuned per event
    const topSpeeds = { 60:12.0, 100:12.0, 200:11.5, 400:13.5 };
    const topSpeed  = (topSpeeds[eventMeters] || 11.0) * (0.88 + a.topSpeed * 0.12);
    // Speed added per keypress
    const addPerPress  = (eventMeters >= 400 ? 2.2 : 1.5) * (0.85 + a.acceleration * 0.15);
    // Speed decay per second (player must keep pressing)
    const decayPerSec  = (eventMeters >= 400 ? 2.0 : 3.0) * (1.05 - a.stamina * 0.10);
    const staminaBonus = eventMeters >= 400 ? 1.2 : eventMeters >= 200 ? 0.8 : 0;

    this.player = {
      isPlayer:   true,
      lane:       this.playerLane,
      athleteIdx: athleteIdx,
      // progress = 0..1 = fraction of TOTAL RACE (eventMeters * totalLaps)
      progress:   0,
      speed:      0,
      stamina:    1.0,
      frame:      0,
      frameTimer: 0,
      finished:   false,
      finishTime: null,
      place:      null,
      sp: { topSpeed, addPerPress, decayPerSec, staminaBonus,
            staminaDrain: eventMeters>=400 ? 0.00012 : eventMeters>=200 ? 0.00008 : 0 }
    };

    this.opponents  = this._genOpponents(laneCount);
    this.allRunners = [this.player, ...this.opponents];
    this._bindInput();
  }

  _genOpponents(laneCount) {
    const ops      = [];
    const eventKey = `${this.venueType}-${this.eventMeters}`;
    const wr       = WORLD_RECORDS[eventKey] || 10;
    const numOpp   = laneCount - 1; // fill all lanes except player's

    let lane = 0;
    for (let i = 0; i < numOpp; i++) {
      if (lane === this.playerLane) lane++; // skip player lane
      if (lane >= laneCount) break;         // safety
      const oc = OPPONENT_COLORS[i % OPPONENT_COLORS.length];
      // Spread: fastest = WR+0.6s, slowest = WR+4.5s
      const targetTime = wr + 0.6 + (i / Math.max(1, numOpp-1)) * 3.9 + (Math.random()-0.5)*0.3;
      ops.push({
        isPlayer:      false,
        lane:          lane,
        color:         oc.color,
        skinTone:      oc.skinTone,
        progress:      0,
        speed:         0,
        stamina:       1.0,
        frame:         0,
        frameTimer:    0,
        finished:      false,
        finishTime:    null,
        place:         null,
        aiTargetSpeed: this.eventMeters / targetTime, // avg m/s
        aiVariance:    0.03 + Math.random() * 0.05,
        aiPhase:       Math.random() * Math.PI * 2,
        reactionDelay: 0.08 + Math.random() * 0.2,
        reactionLeft:  0,
      });
      lane++;
    }
    return ops;
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      if (['Space','ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) {
        e.preventDefault();
        this._press(e.code);
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
  }

  _press(code) {
    if (this.state === 'set')    { this.falseStart = true; return; }
    if (this.state !== 'running' || this.player.finished) return;

    const sp     = this.player.sp;
    const isLeft = code==='ArrowLeft'||code==='KeyA';
    const isRight= code==='ArrowRight'||code==='KeyD';
    let mult = 1.0;
    if (isLeft||isRight) {
      mult = (isLeft ? this.lastAltKey!=='L' : this.lastAltKey!=='R') ? 1.2 : 1.0;
      this.lastAltKey = isLeft ? 'L' : 'R';
    }
    const stamMult = 0.5 + this.player.stamina * 0.5;
    this.player.speed = Math.min(this.player.speed + sp.addPerPress * mult * stamMult, sp.topSpeed);
  }

  handleTouch() { this._press('Space'); }
  startBlocks() { this.state = 'blocks'; }
  triggerSet()  { this.state = 'set'; this.falseStart = false; }
  triggerGo()   { this.state = 'running'; this.opponents.forEach(op=>{ op.reactionLeft=op.reactionDelay; }); }

  update(dt) {
    if (this.state !== 'running') return;
    this.elapsed += dt;
    this._updatePlayer(dt);
    this.opponents.forEach(op => this._updateOpponent(op, dt));
    this._checkFinish();
  }

  _updatePlayer(dt) {
    if (this.player.finished) return;
    const sp = this.player.sp;
    // Decay speed
    const decay = sp.decayPerSec + sp.staminaBonus * (1 - this.player.stamina);
    this.player.speed = Math.max(0, this.player.speed - decay * dt);
    // Stamina drain (long races)
    if (sp.staminaDrain > 0 && this.player.speed > 1) {
      this.player.stamina = Math.max(0, this.player.stamina - sp.staminaDrain * this.player.speed);
    }
    // progress = fraction of total race distance
    // total race metres = eventMeters * totalLaps
    this.player.progress += (this.player.speed * dt) / (this.eventMeters * this.totalLaps);
    this.player.progress  = Math.min(this.player.progress, 1);
    // Animate
    this.player.frameTimer += dt * this.player.speed * 0.5;
    if (this.player.frameTimer > 0.07) { this.player.frame++; this.player.frameTimer = 0; }
  }

  _updateOpponent(op, dt) {
    if (op.finished) return;
    if (op.reactionLeft > 0) { op.reactionLeft -= dt; return; }
    const v = Math.sin(this.elapsed * 1.1 + op.aiPhase) * op.aiVariance;
    const desired = op.aiTargetSpeed * (1+v) * Math.max(0.5, op.stamina);
    op.speed += (desired - op.speed) * Math.min(1, dt*5);
    op.speed  = Math.max(0, op.speed);
    if (this.eventMeters >= 400)
      op.stamina = Math.max(0.4, op.stamina - 0.00025 * op.speed);
    op.progress += (op.speed * dt) / (this.eventMeters * this.totalLaps);
    op.progress  = Math.min(op.progress, 1);
    op.frameTimer += dt * op.speed * 0.5;
    if (op.frameTimer > 0.07) { op.frame++; op.frameTimer = 0; }
  }

  _checkFinish() {
    let placed = this.allRunners.filter(r=>r.finished).length;
    this.allRunners.forEach(r=>{
      if (!r.finished && r.progress >= 1) {
        r.finished=true; r.finishTime=this.elapsed; r.place=++placed;
      }
    });
    if (this.player.finished && !this.finishTime) this.finishTime = this.player.finishTime;
  }

  getPlayerLap() {
    if (this.totalLaps <= 1) return 1;
    return Math.min(this.totalLaps, Math.floor(this.player.progress * this.totalLaps) + 1);
  }
  isFinished()      { return this.player.finished; }
  getSpeedPercent() { return Math.min(100, (this.player.speed / this.player.sp.topSpeed) * 100); }

  getResults() {
    const ek = `${this.venueType}-${this.eventMeters}`;
    const wr  = WORLD_RECORDS[ek] || 999;
    return { time:this.finishTime, place:this.player.place, totalRunners:this.allRunners.length,
             isWorldRecord:this.finishTime&&this.finishTime<wr, worldRecord:wr, eventKey:ek };
  }
}
