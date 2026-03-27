// race.js — RETRO BLAZE race engine
// Improvements: rhythm bonus system, better stamina curve, smarter AI pacing

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

// Rhythm: alternating ← → within this window = bonus
const RHYTHM_WINDOW = 0.45; // seconds

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

    // Rhythm tracking
    this.lastKeyTime  = 0;
    this.lastAltKey   = null;
    this.rhythmChain  = 0;   // consecutive alternating presses
    this.rhythmMeter  = 0;   // 0..1 shown in HUD
    this._rhythmDecay = 0;

    const cfg       = TRACK_CONFIG[venueType];
    const laneCount = cfg.lanes;
    this.playerLane = Math.floor(laneCount / 2);

    const a = this.athlete;
    const topSpeeds = { 60: 12.0, 100: 12.0, 200: 11.5, 400: 13.5 };
    const topSpeed  = (topSpeeds[eventMeters] || 11.0) * (0.88 + a.topSpeed * 0.12);
    const addPerPress  = (eventMeters >= 400 ? 2.4 : 1.6) * (0.85 + a.acceleration * 0.15);
    const decayPerSec  = (eventMeters >= 400 ? 2.2 : 3.2) * (1.05 - a.stamina * 0.10);
    const staminaBonus = eventMeters >= 400 ? 1.3 : eventMeters >= 200 ? 0.9 : 0;

    this.player = {
      isPlayer:   true,
      lane:       this.playerLane,
      athleteIdx: athleteIdx,
      progress:   0,
      staggerT:   0,
      speed:      0,
      stamina:    1.0,
      frame:      0,
      frameTimer: 0,
      finished:   false,
      finishTime: null,
      place:      null,
      sp: {
        topSpeed, addPerPress, decayPerSec, staminaBonus,
        staminaDrain: eventMeters >= 400 ? 0.00013 : eventMeters >= 200 ? 0.00009 : 0
      }
    };

    this.opponents  = this._genOpponents(laneCount);
    this.player.staggerT = this._staggerOvalT(this.playerLane);
    this.opponents.forEach(op => { op.staggerT = this._staggerOvalT(op.lane); });
    this.allRunners = [this.player, ...this.opponents];
    this._bindInput();
  }

  _staggerOvalT(laneIdx) {
    const isStaggered = (this.eventMeters === 400) ||
                        (this.eventMeters === 200 && this.venueType === 'outdoor');
    if (!isStaggered) return 0;
    const staggerPerLane = 2 * Math.PI * 1.22;
    const totalOvalMetres = this.eventMeters;
    return (laneIdx * staggerPerLane) / totalOvalMetres;
  }

  _genOpponents(laneCount) {
    const ops    = [];
    const ek     = `${this.venueType}-${this.eventMeters}`;
    const wr     = WORLD_RECORDS[ek] || 10;
    const numOpp = laneCount - 1;
    let   lane   = 0;

    for (let i = 0; i < numOpp; i++) {
      if (lane === this.playerLane) lane++;
      if (lane >= laneCount) break;

      const oc = OPPONENT_COLORS[i % OPPONENT_COLORS.length];
      // Spread from elite (WR+0.5) to mediocre (WR+4.8)
      const spread = i / Math.max(1, numOpp - 1);
      const targetTime = wr + 0.5 + spread * 4.3 + (Math.random() - 0.5) * 0.4;

      // AI behaviour: fast starters (sprinters) vs slow burners (endurance)
      const isSpeedType = Math.random() > 0.4;
      ops.push({
        isPlayer:      false,
        lane:          lane++,
        color:         oc.color,
        skinTone:      oc.skinTone,
        progress:      0,
        staggerT:      0,
        stamina:       1.0,
        speed:         0,
        frame:         0,
        frameTimer:    0,
        finished:      false,
        finishTime:    null,
        place:         null,
        aiTargetSpeed: this.eventMeters / targetTime,
        aiVariance:    0.02 + Math.random() * 0.06,
        aiPhase:       Math.random() * Math.PI * 2,
        aiSpeedType:   isSpeedType, // speed type = fast start, fade; endurance = slow build
        reactionDelay: 0.06 + Math.random() * 0.22,
        reactionLeft:  0,
      });
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

    const sp  = this.player.sp;
    const now = this.elapsed;

    const isLeft  = code === 'ArrowLeft' || code === 'KeyA';
    const isRight = code === 'ArrowRight' || code === 'KeyD';
    const isAlt   = isLeft || isRight;

    // -- Rhythm system --
    let rhythmMult = 1.0;
    if (isAlt) {
      const timeSinceLast = now - this.lastKeyTime;
      const correctAlt    = isLeft ? this.lastAltKey !== 'L' : this.lastAltKey !== 'R';

      if (timeSinceLast < RHYTHM_WINDOW && correctAlt) {
        this.rhythmChain = Math.min(this.rhythmChain + 1, 8);
      } else if (timeSinceLast >= RHYTHM_WINDOW || !correctAlt) {
        this.rhythmChain = correctAlt ? 1 : 0;
      }
      this.lastAltKey = isLeft ? 'L' : 'R';

      // Rhythm bonus: up to +40% speed at max chain
      rhythmMult = 1.0 + Math.min(this.rhythmChain / 8, 1) * 0.40;
      this.rhythmMeter = Math.min(this.rhythmChain / 8, 1);
    } else {
      // Space press breaks rhythm chain slightly
      this.rhythmChain = Math.max(0, this.rhythmChain - 1);
      this.rhythmMeter = Math.min(this.rhythmChain / 8, 1);
    }

    this.lastKeyTime = now;
    this._rhythmDecay = 1.5; // seconds until rhythm meter fades

    const stamMult = 0.45 + this.player.stamina * 0.55;
    const add = sp.addPerPress * rhythmMult * stamMult;
    this.player.speed = Math.min(this.player.speed + add, sp.topSpeed * (0.98 + rhythmMult * 0.04));
  }

  handleTouch() { this._press('Space'); }
  startBlocks() { this.state = 'blocks'; }
  triggerSet()  { this.state = 'set'; this.falseStart = false; }
  triggerGo()   {
    this.state = 'running';
    this.opponents.forEach(op => { op.reactionLeft = op.reactionDelay; });
  }

  update(dt) {
    if (this.state !== 'running') return;
    this.elapsed += dt;

    // Rhythm meter decay
    if (this._rhythmDecay > 0) {
      this._rhythmDecay -= dt;
      if (this._rhythmDecay <= 0) {
        this.rhythmMeter = Math.max(0, this.rhythmMeter - dt * 0.5);
        this.rhythmChain = 0;
      }
    } else {
      this.rhythmMeter = Math.max(0, this.rhythmMeter - dt * 0.8);
    }

    this._updatePlayer(dt);
    this.opponents.forEach(op => this._updateOpponent(op, dt));
    this._checkFinish();
  }

  _updatePlayer(dt) {
    if (this.player.finished) return;
    const sp = this.player.sp;

    // Speed decay — faster when stamina low
    const staminaFactor = 0.7 + this.player.stamina * 0.3;
    const decay = (sp.decayPerSec + sp.staminaBonus * (1 - this.player.stamina)) / staminaFactor;
    this.player.speed = Math.max(0, this.player.speed - decay * dt);

    // Stamina drain
    if (sp.staminaDrain > 0 && this.player.speed > 2) {
      this.player.stamina = Math.max(0, this.player.stamina - sp.staminaDrain * this.player.speed);
    }

    this.player.progress += (this.player.speed * dt) / (this.eventMeters * this.totalLaps);
    this.player.progress  = Math.min(this.player.progress, 1);

    // Animate sprite faster at higher speed
    this.player.frameTimer += dt * this.player.speed * 0.55;
    if (this.player.frameTimer > 0.065) { this.player.frame++; this.player.frameTimer = 0; }
  }

  _updateOpponent(op, dt) {
    if (op.finished) return;
    if (op.reactionLeft > 0) { op.reactionLeft -= dt; return; }

    // Stamina drain for AI in longer events
    if (this.eventMeters >= 200) {
      op.stamina = Math.max(0.3, op.stamina - 0.00022 * Math.max(0, op.speed));
    }

    // Speed-type: burst then fade; endurance type: steady build
    let targetMultiplier = 1.0;
    const raceProgress = op.progress;
    if (op.aiSpeedType) {
      // Fast starter: 110% first 20%, then fade to 90% at end
      targetMultiplier = raceProgress < 0.2 ? 1.1 : 1.0 - raceProgress * 0.12;
    } else {
      // Endurance: starts 95%, builds to 105% at 70%, fades slightly
      targetMultiplier = raceProgress < 0.7 ? 0.95 + raceProgress * 0.14 : 1.05 - (raceProgress - 0.7) * 0.15;
    }
    targetMultiplier *= Math.max(0.5, op.stamina);

    const v = Math.sin(this.elapsed * 1.2 + op.aiPhase) * op.aiVariance;
    const desired = op.aiTargetSpeed * targetMultiplier * (1 + v);
    op.speed += (desired - op.speed) * Math.min(1, dt * 4.5);
    op.speed  = Math.max(0, op.speed);

    op.progress += (op.speed * dt) / (this.eventMeters * this.totalLaps);
    op.progress  = Math.min(op.progress, 1);

    op.frameTimer += dt * op.speed * 0.55;
    if (op.frameTimer > 0.065) { op.frame++; op.frameTimer = 0; }
  }

  _checkFinish() {
    let placed = this.allRunners.filter(r => r.finished).length;
    this.allRunners.forEach(r => {
      if (!r.finished && r.progress >= 1) {
        r.finished = true;
        r.finishTime = this.elapsed;
        r.place = ++placed;
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
  isFinished()         { return this.player.finished; }
  getSpeedPercent()    { return Math.min(100, (this.player.speed / this.player.sp.topSpeed) * 100); }
  getRhythmPercent()   { return Math.round(this.rhythmMeter * 100); }

  getResults() {
    const ek  = `${this.venueType}-${this.eventMeters}`;
    const wr  = WORLD_RECORDS[ek] || 999;
    const sorted = [...this.allRunners].sort((a, b) => (a.finishTime || 999) - (b.finishTime || 999));
    return {
      time:          this.finishTime,
      place:         this.player.place,
      totalRunners:  this.allRunners.length,
      isWorldRecord: this.finishTime && this.finishTime < wr,
      worldRecord:   wr,
      eventKey:      ek,
      allResults:    sorted,
    };
  }
}
