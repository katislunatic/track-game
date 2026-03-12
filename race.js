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
    this.venueType  = venueType;
    this.eventMeters= eventMeters;
    this.athleteIdx = athleteIdx;
    this.athlete    = ATHLETES[athleteIdx];

    this.totalLaps = (venueType === 'indoor' && eventMeters === 400) ? 2 : 1;
    this.state     = 'idle';
    this.elapsed   = 0;
    this.finishTime= null;
    this.falseStart= false;

    // Input tracking
    this._onKeyDown = null;
    this._onKeyUp   = null;
    this.keys       = {};
    this.lastKeyTime= 0;
    this.keyAlternate = false;
    this.inputHistory = [];

    // Lane assignments: player is lane 3 (0-indexed), opponents fill others
    const laneCount = TRACK_CONFIG[venueType].lanes;
    this.playerLane = Math.floor(laneCount / 2); // middle-ish lane

    // Speed params based on athlete & event
    const a = this.athlete;
    const isSprint = (eventMeters <= 100);
    const baseTop  = isSprint ? (9.5 + a.topSpeed * 2.5) : (7.5 + a.topSpeed * 2.0);
    const stDrain  = eventMeters <= 100  ? 0.00008
                   : eventMeters <= 200  ? 0.00025
                   : 0.00055;

    this.player = {
      isPlayer:    true,
      lane:        this.playerLane,
      athleteIdx:  athleteIdx,
      progress:    0,
      speed:       0,
      stamina:     1.0,
      frame:       0,
      frameTimer:  0,
      finished:    false,
      finishTime:  null,
      place:       null,
      speedParams: {
        topSpeed:      baseTop,
        accel:         0.038 + a.acceleration * 0.022,
        staminaDrain:  stDrain * (1 - a.stamina * 0.45),
        staminaRegen:  0.00015,
      }
    };

    // Generate opponents
    this.opponents = this._genOpponents(laneCount);
    this.allRunners = [this.player, ...this.opponents];

    this._bindInput();
  }

  _genOpponents(laneCount) {
    const ops = [];
    const eventKey = `${this.venueType}-${this.eventMeters}`;
    const wr = WORLD_RECORDS[eventKey] || 10;
    const numOpp = laneCount - 1;

    let lane = 0;
    for (let i = 0; i < numOpp; i++) {
      if (lane === this.playerLane) lane++; // skip player lane
      const oc = OPPONENT_COLORS[i % OPPONENT_COLORS.length];
      const targetTime = wr + 0.25 + (i / numOpp) * 2.5 + (Math.random() - 0.5) * 0.3;
      const avgSpeed = this.eventMeters / targetTime;

      ops.push({
        isPlayer:     false,
        lane:         lane,
        color:        oc.color,
        skinTone:     oc.skinTone,
        progress:     0,
        speed:        0,
        stamina:      1.0,
        frame:        0,
        frameTimer:   0,
        finished:     false,
        finishTime:   null,
        place:        null,
        aiTargetSpeed: avgSpeed,
        aiVariance:   0.06 + Math.random() * 0.06,
        aiPhase:      Math.random() * Math.PI * 2,
        reactionDelay: 0.07 + Math.random() * 0.18,
        reactionLeft:  0,
      });
      lane++;
    }
    return ops;
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (['Space','ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) {
        e.preventDefault();
        this._handleInput(e.code);
      }
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);
  }

  destroy() {
    if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp)   document.removeEventListener('keyup',   this._onKeyUp);
  }

  _handleInput(code) {
    // False start
    if (this.state === 'set') { this.falseStart = true; return; }
    if (this.state !== 'running') return;
    if (this.player.finished) return;

    const now = performance.now();
    const timeSinceLast = now - this.lastKeyTime;

    // Alternating keys reward
    let boost = 1.0;
    const isLeft  = code === 'ArrowLeft'  || code === 'KeyA';
    const isRight = code === 'ArrowRight' || code === 'KeyD';
    if (isLeft) {
      boost = !this.keyAlternate ? 1.35 : 0.8;
      this.keyAlternate = true;
    } else if (isRight) {
      boost = this.keyAlternate ? 1.35 : 0.8;
      this.keyAlternate = false;
    } else {
      boost = 1.05; // space
    }

    // Rate limiting — diminishing returns over 9 presses/sec
    const rate = timeSinceLast > 0 ? 1000 / timeSinceLast : 20;
    const rateEff = Math.min(1, Math.max(0.35, 1 - Math.pow(Math.max(0, rate - 9) / 12, 1.4)));

    const sp = this.player.speedParams;
    const staminaMult = this.player.stamina > 0.25 ? 1 : 0.4 + this.player.stamina * 2.4;
    const addSpeed = sp.accel * boost * rateEff * staminaMult;
    this.player.speed = Math.min(this.player.speed + addSpeed, sp.topSpeed * Math.max(0.3, this.player.stamina));

    this.lastKeyTime = now;
    this.inputHistory.push(now);
    this.inputHistory = this.inputHistory.filter(t => now - t < 1000);
  }

  // Touch input
  handleTouch() { this._handleInput('Space'); }

  startBlocks() { this.state = 'blocks'; }
  triggerSet()  { this.state = 'set'; this.falseStart = false; }
  triggerGo()   {
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
    const sp = this.player.speedParams;
    // Natural friction (more when tired)
    const friction = 0.016 + (1 - this.player.stamina) * 0.008;
    this.player.speed = Math.max(0, this.player.speed * (1 - friction));
    // Stamina drain
    if (this.player.speed > 0.5) {
      this.player.stamina = Math.max(0, this.player.stamina - sp.staminaDrain * this.player.speed);
    } else {
      this.player.stamina = Math.min(1, this.player.stamina + sp.staminaRegen);
    }
    this.player.progress += (this.player.speed * dt) / this.eventMeters;
    this.player.progress  = Math.min(this.player.progress, 1);
    // Animate
    this.player.frameTimer += dt * this.player.speed * 0.55;
    if (this.player.frameTimer > 0.065) { this.player.frame++; this.player.frameTimer = 0; }
  }

  _updateOpponent(op, dt) {
    if (op.finished) return;
    if (op.reactionLeft > 0) { op.reactionLeft -= dt; return; }

    const variance = Math.sin(this.elapsed * 1.1 + op.aiPhase) * op.aiVariance;
    const desired  = op.aiTargetSpeed * (1 + variance) * Math.max(0.4, op.stamina);
    const accel    = 0.035 + Math.random() * 0.008;
    op.speed = op.speed < desired
      ? Math.min(op.speed + accel, desired)
      : Math.max(op.speed - accel * 0.6, desired);

    if (this.eventMeters >= 400 && op.speed > 0.5) {
      op.stamina = Math.max(0.35, op.stamina - 0.00028);
    }
    op.progress += (op.speed * dt) / this.eventMeters;
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

  isFinished() { return this.player.finished; }

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
