// race.js — Race engine: physics, AI opponents, input handling

const OPPONENT_COLORS = [
  { color: '#E8392A', skinTone: '#C8956C' },
  { color: '#2ECC71', skinTone: '#8B5A2B' },
  { color: '#9B59B6', skinTone: '#6B3A2A' },
  { color: '#1A8FE3', skinTone: '#C8956C' },
  { color: '#E67E22', skinTone: '#8B5A2B' },
];

// World records (roughly realistic targets)
const WORLD_RECORDS = {
  'indoor-60':    6.34,
  'indoor-200':   19.92,
  'indoor-400':   44.57,
  'outdoor-100':  9.58,
  'outdoor-200':  19.19,
  'outdoor-400':  43.03,
};

class RaceEngine {
  constructor(venueType, eventMeters, athleteIdx) {
    this.venueType = venueType;
    this.eventMeters = eventMeters;
    this.athleteIdx = athleteIdx;
    this.athlete = ATHLETES[athleteIdx];

    // Determine laps
    if (venueType === 'indoor' && eventMeters === 400) {
      this.totalLaps = 2;
    } else {
      this.totalLaps = 1;
    }

    this.state = 'idle'; // idle -> blocks -> set -> running -> finished
    this.elapsed = 0;
    this.falseStartPenalty = 0;
    this.finishTime = null;

    // Input
    this.keys = {};
    this.lastKeyTime = 0;
    this.keyAlternate = false; // for left/right alternation bonus
    this.inputBuffer = [];

    // Player runner
    this.player = {
      isPlayer: true,
      lane: 3,
      athleteIdx: athleteIdx,
      progress: 0,   // 0-1 of race
      speed: 0,
      maxSpeed: 0,
      stamina: 1.0,
      frame: 0,
      frameTimer: 0,
      finished: false,
      finishTime: null,
      place: null,
    };

    // Compute athlete-specific params
    const a = this.athlete;
    // base top speed in m/s scaled by eventMeters
    const baseTop = 8.5 + a.topSpeed * 3.2;
    const staminaDrain = eventMeters <= 100 ? 0.0001 : eventMeters <= 200 ? 0.0004 : 0.0010;
    this.player.speedParams = {
      topSpeed: baseTop,
      acceleration: 0.035 + a.acceleration * 0.025,
      staminaDrain: staminaDrain * (1 - a.stamina * 0.5),
      staminaRecovery: 0.0002,
    };

    // Generate opponents
    this.opponents = this._generateOpponents();
    this.allRunners = [this.player, ...this.opponents];

    // Timing
    this.inputRate = 0;
    this.inputHistory = [];

    this._bindInput();
  }

  _generateOpponents() {
    const numOpponents = this.venueType === 'indoor' ? 4 : 6;
    const opponents = [];
    const eventKey = `${this.venueType}-${this.eventMeters}`;
    const wr = WORLD_RECORDS[eventKey] || 10;

    for (let i = 0; i < numOpponents; i++) {
      const lane = i < 3 ? i : i + 1; // skip player's lane (3)
      const oc = OPPONENT_COLORS[i % OPPONENT_COLORS.length];

      // AI difficulty: times range from WR+0.3s to WR+3s
      const targetTime = wr + 0.3 + (i / numOpponents) * 2.8 + (Math.random() - 0.5) * 0.4;
      const avgSpeed = this.eventMeters / targetTime;

      opponents.push({
        isPlayer: false,
        lane: lane >= 3 ? lane + 1 : lane,
        color: oc.color,
        skinTone: oc.skinTone,
        progress: 0,
        speed: 0,
        maxSpeed: avgSpeed * 1.15,
        stamina: 1.0,
        frame: 0,
        frameTimer: 0,
        finished: false,
        finishTime: null,
        place: null,
        // AI params
        aiTargetSpeed: avgSpeed,
        aiVariance: 0.08 + Math.random() * 0.06,
        aiPhase: Math.random() * Math.PI * 2,
        reactionDelay: 0.08 + Math.random() * 0.15,
        reactionTimer: 0,
      });
    }
    return opponents;
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        this._handleInput(e.code);
      }
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  _handleInput(code) {
    if (this.state === 'set' || this.state === 'blocks') {
      // False start detection (before GO)
      if (this.state === 'set') {
        this.falseStart = true;
      }
      return;
    }
    if (this.state !== 'running') return;
    if (this.player.finished) return;

    const now = performance.now();
    const timeSinceLast = now - this.lastKeyTime;

    // Alternating bonus: left/right alternation is better
    let inputBoost = 1.0;
    if (code === 'ArrowLeft' || code === 'KeyA') {
      inputBoost = this.keyAlternate ? 1.3 : 0.85;
      this.keyAlternate = true;
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      inputBoost = !this.keyAlternate ? 1.3 : 0.85;
      this.keyAlternate = false;
    } else {
      // Space: always works but no alternation bonus
      inputBoost = 1.1;
    }

    // Rate: too fast = diminishing returns, sweet spot ~5-7 per second
    const rate = 1000 / Math.max(timeSinceLast, 50);
    const rateEfficiency = Math.min(1, Math.max(0.4, 1 - Math.pow(Math.max(0, rate - 8) / 10, 1.5)));

    // Apply speed boost
    const sp = this.player.speedParams;
    const stamBoost = this.player.stamina > 0.3 ? 1 : 0.5 + this.player.stamina * 1.5;
    const boost = sp.acceleration * inputBoost * rateEfficiency * stamBoost * 1.2;
    this.player.speed = Math.min(this.player.speed + boost, sp.topSpeed * this.player.stamina);

    this.lastKeyTime = now;
    this.inputHistory.push(now);
    // keep only recent 1s
    this.inputHistory = this.inputHistory.filter(t => now - t < 1000);
  }

  startBlocks() {
    this.state = 'blocks';
  }

  triggerSet() {
    this.state = 'set';
    this.falseStart = false;
  }

  triggerGo() {
    if (this.falseStart) {
      // Penalty: delayed reaction
      this.state = 'running';
      this.player.reactionPenalty = 0.4;
    } else {
      this.state = 'running';
      this.player.reactionPenalty = 0;
    }
    // Reset opponent reaction timers
    this.opponents.forEach(op => {
      op.reactionTimer = op.reactionDelay;
    });
    this.raceStartTime = performance.now();
  }

  update(dt) {
    if (this.state !== 'running') return;

    this.elapsed += dt;

    // Update player
    this._updatePlayer(dt);

    // Update AI
    this.opponents.forEach(op => this._updateOpponent(op, dt));

    // Check finish
    this._checkFinish();
  }

  _updatePlayer(dt) {
    if (this.player.finished) return;
    const sp = this.player.speedParams;

    // Natural deceleration
    this.player.speed *= (1 - 0.018 * (1 + (1 - this.player.stamina) * 0.5));

    // Stamina drain while running
    if (this.player.speed > 0.5) {
      this.player.stamina = Math.max(0, this.player.stamina - sp.staminaDrain * this.player.speed);
    } else {
      this.player.stamina = Math.min(1, this.player.stamina + sp.staminaRecovery);
    }

    // Advance progress
    const metersPerSec = this.player.speed;
    this.player.progress += (metersPerSec * dt) / this.eventMeters;
    this.player.progress = Math.min(this.player.progress, 1);

    // Animate
    this.player.frameTimer += dt * this.player.speed * 0.6;
    if (this.player.frameTimer > 0.06) {
      this.player.frame++;
      this.player.frameTimer = 0;
    }
  }

  _updateOpponent(op, dt) {
    if (op.finished) return;

    if (op.reactionTimer > 0) {
      op.reactionTimer -= dt;
      return;
    }

    // AI speed control
    const targetS = op.aiTargetSpeed;
    const variance = Math.sin(this.elapsed * 1.2 + op.aiPhase) * op.aiVariance;
    const desiredSpeed = targetS * (1 + variance) * op.stamina;

    const accel = 0.04 + Math.random() * 0.01;
    if (op.speed < desiredSpeed) {
      op.speed = Math.min(op.speed + accel, desiredSpeed);
    } else {
      op.speed = Math.max(op.speed - accel * 0.5, desiredSpeed);
    }

    // Stamina for longer events
    if (this.eventMeters >= 400 && op.speed > 0.5) {
      op.stamina = Math.max(0.3, op.stamina - 0.0003);
    }

    op.progress += (op.speed * dt) / this.eventMeters;
    op.progress = Math.min(op.progress, 1);

    op.frameTimer += dt * op.speed * 0.6;
    if (op.frameTimer > 0.06) {
      op.frame++;
      op.frameTimer = 0;
    }
  }

  _checkFinish() {
    let placeCounter = this.allRunners.filter(r => r.finished).length;

    this.allRunners.forEach(runner => {
      if (!runner.finished && runner.progress >= 1) {
        runner.finished = true;
        runner.finishTime = this.elapsed;
        placeCounter++;
        runner.place = placeCounter;
      }
    });

    if (this.player.finished && !this.finishTime) {
      this.finishTime = this.player.finishTime;
    }
  }

  getInputRate() {
    const now = performance.now();
    const recent = this.inputHistory.filter(t => now - t < 1000);
    return recent.length;
  }

  getPlayerLap() {
    if (this.totalLaps <= 1) return 1;
    return Math.floor(this.player.progress * this.totalLaps) + 1;
  }

  isFinished() {
    return this.player.finished;
  }

  getResults() {
    const eventKey = `${this.venueType}-${this.eventMeters}`;
    const wr = WORLD_RECORDS[eventKey] || 999;
    const isRecord = this.finishTime && this.finishTime < wr;

    return {
      time: this.finishTime,
      place: this.player.place,
      totalRunners: this.allRunners.length,
      isWorldRecord: isRecord,
      worldRecord: wr,
      eventKey,
    };
  }
}
