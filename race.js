// race.js — Race engine (tuned physics)

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

// ── PHYSICS MODEL ─────────────────────────────────────────
// Each keypress directly adds `addPerPress` to player speed.
// Speed decays at `decayPerSec` every frame.
// → Press fast = speed stays high. Stop pressing = slow down quickly.
// → Clear, satisfying feedback. No complex buffering.
// ─────────────────────────────────────────────────────────

class RaceEngine {
  constructor(venueType, eventMeters, athleteIdx) {
    this.venueType   = venueType;
    this.eventMeters = eventMeters;
    this.athleteIdx  = athleteIdx;
    this.athlete     = ATHLETES[athleteIdx];

    this.totalLaps  = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;
    this.state      = 'idle';
    this.elapsed    = 0;
    this.finishTime = null;
    this.falseStart = false;

    this._onKeyDown     = null;
    this._onKeyUp       = null;
    this.lastAltKey     = null;   // track left/right alternation

    const laneCount = TRACK_CONFIG[venueType].lanes;
    this.playerLane = Math.floor(laneCount / 2);

    const a = this.athlete;

    // Per-event top speeds (m/s) — realistic sprint peaks
    const topSpeeds  = { 60: 12.0, 100: 12.0, 200: 11.5, 400: 10.5 };
    const topSpeed   = (topSpeeds[eventMeters] || 11.0) * (0.88 + a.topSpeed * 0.12);

    // Speed added per keypress — scaled so ~6-8 presses/sec is competitive
    // Alternating left/right gives a 20% bonus per press
    const addPerPress = 1.5 * (0.85 + a.acceleration * 0.15);

    // Speed decay per second — player must keep pressing or they slow down
    const decayPerSec = 3.0 * (1.05 - a.stamina * 0.1);

    // For longer races, stamina adds extra decay as it depletes
    const staminaDecayBonus = eventMeters >= 400 ? 2.5 : eventMeters >= 200 ? 0.8 : 0;

    this.player = {
      isPlayer:   true,
      lane:       this.playerLane,
      athleteIdx: athleteIdx,
      progress:   0,
      speed:      0,
      stamina:    1.0,
      frame:      0,
      frameTimer: 0,
      finished:   false,
      finishTime: null,
      place:      null,
      sp: {
        topSpeed,
        addPerPress,
        decayPerSec,
        staminaDecayBonus,
        staminaDrain:  eventMeters >= 400 ? 0.00035 : eventMeters >= 200 ? 0.00008 : 0,
      }
    };

    this.opponents  = this._genOpponents(laneCount);
    this.allRunners = [this.player, ...this.opponents];

    this._bindInput();
  }

  _genOpponents(laneCount) {
    const ops = [];
    const eventKey = `${this.venueType}-${this.eventMeters}`;
    const wr       = WORLD_RECORDS[eventKey] || 10;
    const numOpp   = laneCount - 1;

    let lane = 0;
    for (let i = 0; i < numOpp; i++) {
      if (lane === this.playerLane) lane++;
      const oc = OPPONENT_COLORS[i % OPPONENT_COLORS.length];

      // Opponents finish between WR+0.6s and WR+4.5s
      // Player at 6-8 presses/sec finishes ~WR+1s to WR+2.5s — right in the mix
      const targetTime = wr + 0.6 + (i / Math.max(1, numOpp - 1)) * 3.9 + (Math.random() - 0.5) * 0.35;
      const avgSpeed   = this.eventMeters / targetTime;

      ops.push({
        isPlayer:      false,
        lane,
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
        aiTargetSpeed: avgSpeed,
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
      // Allow key repeat so holding a key still presses repeatedly
      if (['Space','ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) {
        e.preventDefault();
        this._handlePress(e.code);
      }
    };
    this._onKeyUp = (e) => {};
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);
  }

  destroy() {
    if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp)   document.removeEventListener('keyup',   this._onKeyUp);
  }

  _handlePress(code) {
    if (this.state === 'set') { this.falseStart = true; return; }
    if (this.state !== 'running') return;
    if (this.player.finished) return;

    const sp = this.player.sp;

    // Alternating left/right gives a 20% bonus
    let mult = 1.0;
    const isLeft  = code === 'ArrowLeft' || code === 'KeyA';
    const isRight = code === 'ArrowRight' || code === 'KeyD';
    if (isLeft || isRight) {
      const correctAlt = isLeft ? (this.lastAltKey !== 'L') : (this.lastAltKey !== 'R');
      mult = correctAlt ? 1.2 : 1.0;
      this.lastAltKey = isLeft ? 'L' : 'R';
    }

    // Stamina multiplier (only affects long races)
    const stamMult = 0.5 + this.player.stamina * 0.5;

    // Add speed directly
    const add = sp.addPerPress * mult * stamMult;
    this.player.speed = Math.min(this.player.speed + add, sp.topSpeed);
  }

  handleTouch() { this._handlePress('Space'); }

  startBlocks() { this.state = 'blocks'; }
  triggerSet()  { this.state = 'set'; this.falseStart = false; }
  triggerGo() {
    this.state = 'running';
    this.opponents.forEach(op => { op.reactionLeft = op.reactionDelay; });
  }

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

    // Speed decays continuously — player must keep pressing
    const totalDecay = sp.decayPerSec + sp.staminaDecayBonus * (1 - this.player.stamina);
    this.player.speed = Math.max(0, this.player.speed - totalDecay * dt);

    // Stamina drains in longer races
    if (sp.staminaDrain > 0 && this.player.speed > 1) {
      this.player.stamina = Math.max(0, this.player.stamina - sp.staminaDrain * this.player.speed);
    }

    // Move forward
    this.player.progress += (this.player.speed * dt) / this.eventMeters;
    this.player.progress  = Math.min(this.player.progress, 1);

    // Animate
    this.player.frameTimer += dt * this.player.speed * 0.5;
    if (this.player.frameTimer > 0.07) { this.player.frame++; this.player.frameTimer = 0; }
  }

  _updateOpponent(op, dt) {
    if (op.finished) return;
    if (op.reactionLeft > 0) { op.reactionLeft -= dt; return; }

    const variance = Math.sin(this.elapsed * 1.1 + op.aiPhase) * op.aiVariance;
    const desired  = op.aiTargetSpeed * (1 + variance) * Math.max(0.5, op.stamina);

    // Smoothly approach target speed
    const diff = desired - op.speed;
    op.speed += diff * Math.min(1, dt * 5);
    op.speed  = Math.max(0, op.speed);

    if (this.eventMeters >= 400) {
      op.stamina = Math.max(0.4, op.stamina - 0.00025 * op.speed);
    }

    op.progress += (op.speed * dt) / this.eventMeters;
    op.progress  = Math.min(op.progress, 1);

    op.frameTimer += dt * op.speed * 0.5;
    if (op.frameTimer > 0.07) { op.frame++; op.frameTimer = 0; }
  }

  _checkFinish() {
    let placed = this.allRunners.filter(r => r.finished).length;
    this.allRunners.forEach(r => {
      if (!r.finished && r.progress >= 1) {
        r.finished   = true;
        r.finishTime = this.elapsed;
        r.place      = ++placed;
      }
    });
    if (this.player.finished && !this.finishTime) {
      this.finishTime = this.player.finishTime;
    }
  }

  getPlayerLap() {
    if (this.totalLaps <= 1) return 1;
    return Math.min(this.totalLaps, Math.floor(this.player.progress * this.totalLaps) + 1);
  }

  isFinished() { return this.player.finished; }

  getSpeedPercent() {
    return Math.min(100, (this.player.speed / this.player.sp.topSpeed) * 100);
  }

  getResults() {
    const eventKey = `${this.venueType}-${this.eventMeters}`;
    const wr = WORLD_RECORDS[eventKey] || 999;
    return {
      time:          this.finishTime,
      place:         this.player.place,
      totalRunners:  this.allRunners.length,
      isWorldRecord: this.finishTime && this.finishTime < wr,
      worldRecord:   wr,
      eventKey,
    };
  }
}
