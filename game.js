// game.js — Main game controller

// ══════════════════════════════
// GAME STATE
// ══════════════════════════════
const Game = {
  venue: null,
  eventMeters: null,
  athleteIdx: 0,
  raceEngine: null,
  raceTrack: null,
  animFrame: null,
  lastTime: 0,
  phase: 'intro',
  countdownTimer: 0,
  countdownStep: 0, // 0=blocks 1=set 2=go 3=running
};

// ══════════════════════════════
// SCREEN MANAGEMENT
// ══════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  el.classList.add('active');
}

// ══════════════════════════════
// INTRO SCREEN
// ══════════════════════════════
(function initIntro() {
  let frame = 0;
  const canvas = document.getElementById('intro-canvas');
  const ctx = canvas.getContext('2d');

  function animateRunner() {
    ctx.clearRect(0, 0, 200, 260);
    if (ATHLETES && ATHLETES[0]) {
      drawAthlete(ctx, ATHLETES[0], 100, 180, frame, true, 2.8);
    }
    frame++;
    requestAnimationFrame(animateRunner);
  }
  animateRunner();

  document.getElementById('btn-start').addEventListener('click', () => {
    showScreen('screen-select');
    initSelectScreen();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && Game.phase === 'intro') {
      document.getElementById('btn-start').click();
    }
  });
})();

// ══════════════════════════════
// SELECT SCREEN
// ══════════════════════════════
function initSelectScreen() {
  // Draw track previews
  const ic = document.getElementById('preview-indoor');
  const oc = document.getElementById('preview-outdoor');
  if (ic) drawTrackPreview(ic, 'indoor');
  if (oc) drawTrackPreview(oc, 'outdoor');

  document.querySelectorAll('.venue-card').forEach(card => {
    card.addEventListener('click', () => {
      Game.venue = card.dataset.venue;
      showScreen('screen-event');
      initEventScreen();
    });
  });
}

document.getElementById('btn-back-select').addEventListener('click', () => {
  showScreen('screen-intro');
  Game.phase = 'intro';
});

// ══════════════════════════════
// EVENT SCREEN
// ══════════════════════════════
function initEventScreen() {
  const title = document.getElementById('event-screen-title');
  title.textContent = (Game.venue === 'indoor' ? 'INDOOR' : 'OUTDOOR') + ' — SELECT EVENT';

  const events = Game.venue === 'indoor'
    ? [
        { meters: 60,  label: '60', laps: '1 STRAIGHT' },
        { meters: 200, label: '200', laps: '1 CURVE + STRAIGHT' },
        { meters: 400, label: '400', laps: '2 LAPS' },
      ]
    : [
        { meters: 100, label: '100', laps: '1 STRAIGHT' },
        { meters: 200, label: '200', laps: 'HALF OVAL' },
        { meters: 400, label: '400', laps: '1 LAP' },
      ];

  const container = document.getElementById('event-buttons');
  container.innerHTML = '';

  events.forEach((ev, i) => {
    const btn = document.createElement('div');
    btn.className = 'event-btn' + (i === 0 ? ' selected' : '');
    btn.innerHTML = `
      <div class="event-btn-dist">${ev.label}</div>
      <div class="event-btn-unit">METERS</div>
      <div class="event-btn-laps">${ev.laps}</div>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.event-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      Game.eventMeters = ev.meters;
    });
    container.appendChild(btn);
  });

  Game.eventMeters = events[0].meters;

  // Athlete cards
  const cards = document.querySelectorAll('.athlete-card');
  cards.forEach(card => {
    const idx = parseInt(card.dataset.athlete);
    const canvas = card.querySelector('.athlete-preview');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 60, 80);
      drawAthleteStanding(ctx, ATHLETES[idx], 30, 35, 0.9);
    }
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      Game.athleteIdx = idx;
    });
  });

  // Animate athletes
  let f = 0;
  function animCards() {
    if (document.getElementById('screen-event').classList.contains('active')) {
      cards.forEach(card => {
        const idx = parseInt(card.dataset.athlete);
        const canvas = card.querySelector('.athlete-preview');
        if (canvas && card.classList.contains('selected')) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, 60, 80);
          drawAthlete(ctx, ATHLETES[idx], 30, 48, f, true, 0.9);
        }
      });
      f++;
      requestAnimationFrame(animCards);
    }
  }
  animCards();
}

document.getElementById('btn-back-event').addEventListener('click', () => {
  showScreen('screen-select');
  initSelectScreen();
});

document.getElementById('btn-race').addEventListener('click', () => {
  startRace();
});

// ══════════════════════════════
// RACE SCREEN
// ══════════════════════════════
function startRace() {
  // Cancel any existing loop
  if (Game.animFrame) cancelAnimationFrame(Game.animFrame);
  if (Game.raceEngine) Game.raceEngine.destroy();

  showScreen('screen-race');

  const canvas = document.getElementById('race-canvas');
  canvas.style.width = '100%';
  canvas.style.display = 'block';

  Game.raceEngine = new RaceEngine(Game.venue, Game.eventMeters, Game.athleteIdx);
  Game.raceTrack = new RaceTrack(canvas, Game.venue, Game.eventMeters);

  // HUD setup
  document.getElementById('hud-event-name').textContent =
    (Game.venue === 'indoor' ? 'INDOOR ' : 'OUTDOOR ') + Game.eventMeters + 'm';

  const lapEl = document.getElementById('hud-lap');
  if (Game.raceEngine.totalLaps > 1) {
    lapEl.textContent = 'LAP 1 / ' + Game.raceEngine.totalLaps;
  } else {
    lapEl.textContent = '';
  }

  // Countdown sequence
  Game.countdownStep = 0;
  Game.raceEngine.startBlocks();

  const overlay = document.getElementById('race-overlay');
  const overlayPhase = document.getElementById('overlay-phase');

  overlay.classList.remove('hidden');
  overlayPhase.textContent = 'ON YOUR MARKS';

  setTimeout(() => {
    overlayPhase.textContent = 'GET SET';
    Game.raceEngine.triggerSet();
    setTimeout(() => {
      overlayPhase.style.color = '#2ECC71';
      overlayPhase.textContent = 'GO!';
      Game.raceEngine.triggerGo();
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlayPhase.style.color = '';
      }, 600);
    }, 900);
  }, 1400);

  Game.lastTime = performance.now();
  Game.phase = 'race';

  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - Game.lastTime) / 1000, 0.05);
    Game.lastTime = timestamp;

    const engine = Game.raceEngine;
    engine.update(dt);

    // Update HUD
    document.getElementById('hud-time').textContent =
      engine.elapsed.toFixed(3);

    const speedPct = Math.min(100, (engine.player.speed / (engine.player.speedParams.topSpeed)) * 100);
    document.getElementById('hud-speed-fill').style.width = speedPct + '%';
    document.getElementById('hud-stamina-fill').style.width =
      (engine.player.stamina * 100) + '%';

    if (engine.totalLaps > 1) {
      const lap = engine.getPlayerLap();
      lapEl.textContent = `LAP ${lap} / ${engine.totalLaps}`;
    }

    // Render track
    Game.raceTrack.draw(engine.player.progress, engine.allRunners, engine.player.lane);

    if (engine.isFinished()) {
      Game.animFrame = null;
      setTimeout(() => showResults(), 1200);
      return;
    }

    Game.animFrame = requestAnimationFrame(gameLoop);
  }

  Game.animFrame = requestAnimationFrame(gameLoop);
}

// ══════════════════════════════
// RESULTS SCREEN
// ══════════════════════════════
function showResults() {
  const results = Game.raceEngine.getResults();

  // Clean up
  if (Game.raceEngine) Game.raceEngine.destroy();

  showScreen('screen-result');

  const places = ['🥇', '🥈', '🥉', '4TH', '5TH', '6TH', '7TH', '8TH'];
  const placeNames = ['1ST PLACE', '2ND PLACE', '3RD PLACE', '4TH PLACE', '5TH PLACE', '6TH PLACE', '7TH PLACE', '8TH PLACE'];

  const place = results.place || 1;
  document.getElementById('result-medal').textContent =
    place <= 3 ? places[place - 1] : '🏃';
  document.getElementById('result-place').textContent =
    placeNames[Math.min(place - 1, placeNames.length - 1)];
  document.getElementById('result-event-name').textContent =
    (Game.venue === 'indoor' ? 'INDOOR ' : 'OUTDOOR ') + Game.eventMeters + 'm';

  const t = results.time || 0;
  document.getElementById('result-time').textContent = t.toFixed(2);

  if (results.isWorldRecord) {
    document.getElementById('result-record').textContent = '🌟 WORLD RECORD BROKEN!';
  } else if (results.worldRecord) {
    const diff = (t - results.worldRecord).toFixed(2);
    document.getElementById('result-record').textContent =
      `WR: ${results.worldRecord.toFixed(2)}s  (+${diff}s behind)`;
  }

  // Personal best storage
  const pbKey = `pb_${results.eventKey}`;
  const prevPB = parseFloat(localStorage.getItem(pbKey)) || 9999;
  if (t < prevPB) {
    localStorage.setItem(pbKey, t.toFixed(3));
    if (!results.isWorldRecord) {
      document.getElementById('result-record').textContent += ' 🎉 NEW PERSONAL BEST!';
    }
  }

  // Animate time counter
  const timeEl = document.getElementById('result-time');
  let dispTime = 0;
  const dur = 1.2;
  const startTs = performance.now();
  function countUp(ts) {
    const frac = Math.min((ts - startTs) / (dur * 1000), 1);
    const ease = 1 - Math.pow(1 - frac, 3);
    dispTime = ease * t;
    timeEl.textContent = dispTime.toFixed(2);
    if (frac < 1) requestAnimationFrame(countUp);
  }
  requestAnimationFrame(countUp);
}

document.getElementById('btn-retry').addEventListener('click', () => {
  startRace();
});

document.getElementById('btn-menu').addEventListener('click', () => {
  if (Game.animFrame) cancelAnimationFrame(Game.animFrame);
  if (Game.raceEngine) { Game.raceEngine.destroy(); Game.raceEngine = null; }
  Game.phase = 'intro';
  showScreen('screen-intro');
});

// ══════════════════════════════
// TOUCH INPUT
// ══════════════════════════════
document.addEventListener('touchstart', (e) => {
  if (Game.phase === 'race' && Game.raceEngine) {
    e.preventDefault();
    Game.raceEngine._handleInput('Space');
  }
}, { passive: false });

// ══════════════════════════════
// RESIZE
// ══════════════════════════════
window.addEventListener('resize', () => {
  if (Game.raceTrack) Game.raceTrack._resize();
});

// Start
showScreen('screen-intro');
