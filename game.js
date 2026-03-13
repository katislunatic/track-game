// game.js — Main controller

const Game = {
  venue:       null,
  eventMeters: null,
  athleteIdx:  0,
  raceEngine:  null,
  raceTrack:   null,
  animFrame:   null,
  lastTime:    0,
  phase:       'intro',
};

// ── SCREEN MANAGER ──────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── INTRO ────────────────────────────────────────────
(function initIntro() {
  let frame = 0;
  const canvas = document.getElementById('intro-canvas');
  const ctx    = canvas.getContext('2d');

  function loop() {
    ctx.clearRect(0, 0, 200, 260);
    if (typeof ATHLETES !== 'undefined') {
      drawAthlete(ctx, ATHLETES[0], 100, 190, frame, true, 2.8);
    }
    frame++;
    requestAnimationFrame(loop);
  }
  loop();

  document.getElementById('btn-start').addEventListener('click', () => {
    Game.phase = 'select';
    showScreen('screen-select');
    initSelectScreen();
  });
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && Game.phase === 'intro') {
      e.preventDefault();
      document.getElementById('btn-start').click();
    }
  });
})();

// ── VENUE SELECT ─────────────────────────────────────
function initSelectScreen() {
  const ic = document.getElementById('preview-indoor');
  const oc = document.getElementById('preview-outdoor');
  if (ic) drawTrackPreview(ic, 'indoor');
  if (oc) drawTrackPreview(oc, 'outdoor');

  document.querySelectorAll('.venue-card').forEach(card => {
    // Remove old listeners by cloning
    const fresh = card.cloneNode(true);
    card.parentNode.replaceChild(fresh, card);
    fresh.addEventListener('click', () => {
      Game.venue = fresh.dataset.venue;
      showScreen('screen-event');
      initEventScreen();
    });
  });

  // Redraw previews after clone
  const ic2 = document.getElementById('preview-indoor');
  const oc2 = document.getElementById('preview-outdoor');
  if (ic2) drawTrackPreview(ic2, 'indoor');
  if (oc2) drawTrackPreview(oc2, 'outdoor');
}

document.getElementById('btn-back-select').addEventListener('click', () => {
  Game.phase = 'intro';
  showScreen('screen-intro');
});

// ── EVENT SELECT ─────────────────────────────────────
function initEventScreen() {
  const title = document.getElementById('event-screen-title');
  title.textContent = (Game.venue === 'indoor' ? 'INDOOR' : 'OUTDOOR') + ' — SELECT EVENT';

  const events = Game.venue === 'indoor'
    ? [
        { meters: 60,  label: '60',  sub: '1 STRAIGHT' },
        { meters: 200, label: '200', sub: '1 CURVE + STRAIGHT' },
        { meters: 400, label: '400', sub: '2 LAPS' },
      ]
    : [
        { meters: 100, label: '100', sub: '1 STRAIGHT' },
        { meters: 200, label: '200', sub: 'HALF OVAL' },
        { meters: 400, label: '400', sub: '1 LAP' },
      ];

  const container = document.getElementById('event-buttons');
  container.innerHTML = '';
  Game.eventMeters = events[0].meters;

  events.forEach((ev, i) => {
    const btn = document.createElement('div');
    btn.className = 'event-btn' + (i === 0 ? ' selected' : '');
    btn.innerHTML = `
      <div class="event-btn-dist">${ev.label}</div>
      <div class="event-btn-unit">METERS</div>
      <div class="event-btn-laps">${ev.sub}</div>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.event-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      Game.eventMeters = ev.meters;
    });
    container.appendChild(btn);
  });

  // Athlete cards
  const cards = document.querySelectorAll('.athlete-card');
  cards.forEach(card => {
    const idx = parseInt(card.dataset.athlete);
    const cvs = card.querySelector('.athlete-preview');
    if (cvs) {
      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, 60, 80);
      drawAthleteStanding(ctx, ATHLETES[idx], 30, 38, 0.85);
    }
    const fresh = card.cloneNode(true);
    card.parentNode.replaceChild(fresh, card);
    // Redraw after clone
    const cvs2 = fresh.querySelector('.athlete-preview');
    if (cvs2) {
      const ctx2 = cvs2.getContext('2d');
      ctx2.clearRect(0,0,60,80);
      drawAthleteStanding(ctx2, ATHLETES[idx], 30, 38, 0.85);
    }
    fresh.addEventListener('click', () => {
      document.querySelectorAll('.athlete-card').forEach(c => c.classList.remove('selected'));
      fresh.classList.add('selected');
      Game.athleteIdx = idx;
    });
  });

  // Animate selected athlete card
  let af = 0;
  let animId;
  function animSelected() {
    document.querySelectorAll('.athlete-card').forEach(card => {
      if (card.classList.contains('selected')) {
        const idx2 = parseInt(card.dataset.athlete);
        const cvs2 = card.querySelector('.athlete-preview');
        if (cvs2) {
          const ctx2 = cvs2.getContext('2d');
          ctx2.clearRect(0,0,60,80);
          drawAthlete(ctx2, ATHLETES[idx2], 30, 50, af, true, 0.85);
        }
      }
    });
    af++;
    if (document.getElementById('screen-event').classList.contains('active')) {
      animId = requestAnimationFrame(animSelected);
    }
  }
  animSelected();
}

document.getElementById('btn-back-event').addEventListener('click', () => {
  showScreen('screen-select');
  initSelectScreen();
});

document.getElementById('btn-race').addEventListener('click', () => {
  showIntroduction();
});

// ── PRE-RACE ATHLETE INTRODUCTION ────────────────────
function showIntroduction() {
  // Show the introduction overlay on the race screen
  showScreen('screen-race');

  const canvas = document.getElementById('race-canvas');
  canvas.style.width = '100%';
  canvas.style.display = 'block';

  // Build intro overlay content
  const overlay = document.getElementById('race-overlay');
  const phaseEl = document.getElementById('overlay-phase');
  overlay.classList.remove('hidden');

  const athlete = ATHLETES[Game.athleteIdx];
  const laneCount = TRACK_CONFIG[Game.venue].lanes;
  const playerLane = Math.floor(laneCount / 2) + 1; // 1-indexed for display

  phaseEl.innerHTML = `
    <div style="font-size:.5rem;letter-spacing:.15em;color:var(--muted);margin-bottom:12px;font-family:'Press Start 2P',monospace">YOU ARE RACING AS</div>
    <div style="font-size:2.2rem;color:${athlete.color};line-height:1.2;margin-bottom:8px;font-family:'Press Start 2P',monospace;text-shadow:3px 3px 0px var(--brown-dark)">${athlete.name}</div>
    <div style="font-size:.5rem;letter-spacing:.12em;color:var(--muted);margin-bottom:20px;font-family:'Press Start 2P',monospace">
      LANE <span style="color:var(--cream);font-size:.9rem;font-family:'Press Start 2P',monospace">${playerLane}</span> OF ${laneCount}
    </div>
    <div style="display:flex;gap:20px;justify-content:center;margin-bottom:18px;font-size:.38rem;letter-spacing:.08em;font-family:'Press Start 2P',monospace">
      <div><span style="color:var(--muted)">SPEED</span><br><span style="color:var(--gold)">${'█'.repeat(Math.round(athlete.topSpeed*5))}${'░'.repeat(5-Math.round(athlete.topSpeed*5))}</span></div>
      <div><span style="color:var(--muted)">ACCEL</span><br><span style="color:var(--gold)">${'█'.repeat(Math.round(athlete.acceleration*5))}${'░'.repeat(5-Math.round(athlete.acceleration*5))}</span></div>
      <div><span style="color:var(--muted)">STAM</span><br><span style="color:var(--gold)">${'█'.repeat(Math.round(athlete.stamina*5))}${'░'.repeat(5-Math.round(athlete.stamina*5))}</span></div>
    </div>
    <div style="font-size:.45rem;letter-spacing:.1em;color:var(--gold);font-family:'Press Start 2P',monospace">
      ${Game.venue.toUpperCase()} · ${Game.eventMeters}m${Game.venue==='indoor'&&Game.eventMeters===400?' · 2 LAPS':''}
    </div>
    <div style="font-size:.4rem;letter-spacing:.1em;color:var(--muted);margin-top:24px;animation:phasePulse .8s infinite alternate;font-family:'Press Start 2P',monospace">
      GET READY...
    </div>
  `;

  // Draw still background on canvas while intro shows
  Game.raceEngine = new RaceEngine(Game.venue, Game.eventMeters, Game.athleteIdx);
  Game.raceTrack  = new RaceTrack(canvas, Game.venue, Game.eventMeters);
  Game.raceTrack.draw(0, Game.raceEngine.allRunners);

  // After 3 seconds, start countdown
  setTimeout(() => startCountdown(), 3000);
}

// ── COUNTDOWN & RACE START ───────────────────────────
function startCountdown() {
  const overlay = document.getElementById('race-overlay');
  const phaseEl = document.getElementById('overlay-phase');

  phaseEl.style.fontSize = '';
  phaseEl.style.color    = '';

  Game.raceEngine.startBlocks();

  phaseEl.innerHTML = 'ON YOUR MARKS';
  phaseEl.style.fontSize = 'clamp(3rem,8vw,6.5rem)';

  setTimeout(() => {
    phaseEl.innerHTML = 'GET SET';
    Game.raceEngine.triggerSet();
  }, 1400);

  setTimeout(() => {
    phaseEl.style.color   = '#2ECC71';
    phaseEl.innerHTML     = 'GO!';
    Game.raceEngine.triggerGo();

    setTimeout(() => {
      overlay.classList.add('hidden');
      beginRaceLoop();
    }, 550);
  }, 2400);
}

// ── RACE LOOP ─────────────────────────────────────────
function beginRaceLoop() {
  const canvas  = document.getElementById('race-canvas');
  const engine  = Game.raceEngine;
  const track   = Game.raceTrack;

  // HUD
  document.getElementById('hud-event-name').textContent =
    (Game.venue === 'indoor' ? 'INDOOR ' : 'OUTDOOR ') + Game.eventMeters + 'm';
  const lapEl = document.getElementById('hud-lap');
  lapEl.textContent = engine.totalLaps > 1 ? 'LAP 1 / ' + engine.totalLaps : '';

  Game.lastTime = performance.now();

  function loop(ts) {
    const dt = Math.min((ts - Game.lastTime) / 1000, 0.05);
    Game.lastTime = ts;

    engine.update(dt);

    // HUD updates
    document.getElementById('hud-time').textContent = engine.elapsed.toFixed(3);

    document.getElementById('hud-speed-fill').style.width   = engine.getSpeedPercent() + '%';
    document.getElementById('hud-stamina-fill').style.width = (engine.player.stamina * 100) + '%';

    if (engine.totalLaps > 1) {
      lapEl.textContent = 'LAP ' + engine.getPlayerLap() + ' / ' + engine.totalLaps;
    }

    // Draw
    track.draw(engine.player.progress, engine.allRunners);

    if (engine.isFinished()) {
      Game.animFrame = null;
      setTimeout(showResults, 1400);
      return;
    }

    Game.animFrame = requestAnimationFrame(loop);
  }

  Game.animFrame = requestAnimationFrame(loop);
}

// ── RESULTS ───────────────────────────────────────────
function showResults() {
  const results = Game.raceEngine.getResults();
  if (Game.raceEngine) { Game.raceEngine.destroy(); }

  showScreen('screen-result');

  const medals     = ['🥇','🥈','🥉'];
  const placeNames = ['1ST PLACE','2ND PLACE','3RD PLACE','4TH PLACE','5TH PLACE','6TH PLACE','7TH PLACE','8TH PLACE'];
  const place = results.place || 1;

  document.getElementById('result-medal').textContent = place <= 3 ? medals[place-1] : '🏃';
  document.getElementById('result-place').textContent = placeNames[Math.min(place-1, placeNames.length-1)];
  document.getElementById('result-event-name').textContent =
    (Game.venue === 'indoor' ? 'INDOOR ' : 'OUTDOOR ') + Game.eventMeters + 'm';

  const t = results.time || 0;

  if (results.isWorldRecord) {
    document.getElementById('result-record').textContent = '🌟 NEW WORLD RECORD!';
  } else {
    const diff = (t - results.worldRecord).toFixed(2);
    document.getElementById('result-record').textContent =
      `WR: ${results.worldRecord.toFixed(2)}s  (+${diff}s off record)`;
  }

  // Personal best
  try {
    const pbKey  = 'pb_' + results.eventKey;
    const prevPB = parseFloat(localStorage.getItem(pbKey)) || 9999;
    if (t < prevPB) {
      localStorage.setItem(pbKey, t.toFixed(3));
      if (!results.isWorldRecord) {
        document.getElementById('result-record').textContent += ' 🎉 NEW PERSONAL BEST!';
      }
    }
  } catch(e) {}

  // Animated time counter
  const timeEl   = document.getElementById('result-time');
  const startTs  = performance.now();
  const dur      = 1100;
  function countUp(ts) {
    const frac = Math.min((ts - startTs) / dur, 1);
    const ease = 1 - Math.pow(1 - frac, 3);
    timeEl.textContent = (ease * t).toFixed(2);
    if (frac < 1) requestAnimationFrame(countUp);
  }
  requestAnimationFrame(countUp);
}

// ── RESULT BUTTONS ────────────────────────────────────
document.getElementById('btn-retry').addEventListener('click', () => {
  if (Game.animFrame) cancelAnimationFrame(Game.animFrame);
  showIntroduction();
});

document.getElementById('btn-menu').addEventListener('click', () => {
  if (Game.animFrame) cancelAnimationFrame(Game.animFrame);
  if (Game.raceEngine) { Game.raceEngine.destroy(); Game.raceEngine = null; }
  Game.phase = 'intro';
  showScreen('screen-intro');
});

// ── TOUCH INPUT ───────────────────────────────────────
document.addEventListener('touchstart', e => {
  if (Game.raceEngine && Game.raceEngine.state === 'running') {
    e.preventDefault();
    Game.raceEngine.handleTouch();
  }
}, { passive: false });

// ── RESIZE ────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (Game.raceTrack) Game.raceTrack._resize();
});

// Boot
showScreen('screen-intro');
