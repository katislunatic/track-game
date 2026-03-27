// game.js — RETRO BLAZE main controller

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

// ── SCREEN MANAGER ───────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── FLAME PARTICLES (intro) ──────────────────────────
(function initFlameParticles() {
  const container = document.getElementById('flame-particles');
  if (!container) return;
  const colors = ['#F5B800','#F07010','#E83020','#FFD84A','#FF8040'];
  function spawnFlame() {
    const el = document.createElement('div');
    el.className = 'flame-particle';
    const size = 6 + Math.random() * 14;
    const x = 30 + Math.random() * 70; // % from right side
    el.style.cssText = `
      width: ${size}px; height: ${size * 1.4}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      right: ${x}%; bottom: ${5 + Math.random() * 15}%;
      animation-duration: ${1.2 + Math.random() * 1.8}s;
      animation-delay: ${Math.random() * 2}s;
      filter: blur(${1 + Math.random() * 2}px);
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  setInterval(spawnFlame, 200);
  for (let i = 0; i < 8; i++) spawnFlame();
})();

// ── INTRO ─────────────────────────────────────────────
(function initIntro() {
  let frame = 0;
  const canvas = document.getElementById('intro-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (typeof ATHLETES !== 'undefined') {
      // Fake speed so we get motion blur streaks on intro
      const fakeSpeed = 8 + Math.sin(frame * 0.05) * 2;
      drawAthlete(ctx, ATHLETES[0], 120, 220, frame, true, 3.0, fakeSpeed);
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

// ── VENUE SELECT ──────────────────────────────────────
function initSelectScreen() {
  const drawPreviews = () => {
    const ic = document.getElementById('preview-indoor');
    const oc = document.getElementById('preview-outdoor');
    if (ic) drawTrackPreview(ic, 'indoor');
    if (oc) drawTrackPreview(oc, 'outdoor');
  };
  drawPreviews();

  document.querySelectorAll('.venue-card').forEach(card => {
    const fresh = card.cloneNode(true);
    card.parentNode.replaceChild(fresh, card);
    fresh.addEventListener('click', () => {
      Game.venue = fresh.dataset.venue;
      showScreen('screen-event');
      initEventScreen();
    });
  });
  drawPreviews(); // redraw after clone
}

document.getElementById('btn-back-select').addEventListener('click', () => {
  Game.phase = 'intro';
  showScreen('screen-intro');
});

// ── EVENT SELECT ──────────────────────────────────────
function initEventScreen() {
  const title = document.getElementById('event-screen-title');
  title.textContent = (Game.venue === 'indoor' ? 'INDOOR' : 'OUTDOOR') + ' — SELECT EVENT';

  const events = Game.venue === 'indoor'
    ? [
        { meters: 60,  label: '60',  sub: '1 STRAIGHT' },
        { meters: 200, label: '200', sub: '1 FULL LAP' },
        { meters: 400, label: '400', sub: '2 LAPS' },
      ]
    : [
        { meters: 100, label: '100', sub: '1 STRAIGHT' },
        { meters: 200, label: '200', sub: 'HALF OVAL' },
        { meters: 400, label: '400', sub: '1 FULL LAP' },
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
      container.querySelectorAll('.event-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      Game.eventMeters = ev.meters;
    });
    container.appendChild(btn);
  });

  // Athlete cards
  const cards = document.querySelectorAll('.athlete-card');
  cards.forEach(card => {
    const idx = parseInt(card.dataset.athlete);
    const fresh = card.cloneNode(true);
    card.parentNode.replaceChild(fresh, card);

    // Draw standing sprite
    const cvs = fresh.querySelector('.athlete-preview');
    if (cvs) {
      const ctx2 = cvs.getContext('2d');
      ctx2.clearRect(0, 0, 70, 90);
      drawAthleteStanding(ctx2, ATHLETES[idx], 35, 50, 0.95);
    }

    fresh.addEventListener('click', () => {
      document.querySelectorAll('.athlete-card').forEach(c => c.classList.remove('selected'));
      fresh.classList.add('selected');
      Game.athleteIdx = idx;
    });
  });

  // Animate selected athlete's preview
  let af = 0;
  function animSelected() {
    document.querySelectorAll('.athlete-card').forEach(c => {
      if (!c.classList.contains('selected')) return;
      const idx2 = parseInt(c.dataset.athlete);
      const cvs2 = c.querySelector('.athlete-preview');
      if (!cvs2) return;
      const ctx2 = cvs2.getContext('2d');
      ctx2.clearRect(0, 0, 70, 90);
      drawAthlete(ctx2, ATHLETES[idx2], 35, 62, af, true, 0.92, 6);
    });
    af++;
    if (document.getElementById('screen-event').classList.contains('active'))
      requestAnimationFrame(animSelected);
  }
  animSelected();
}

document.getElementById('btn-back-event').addEventListener('click', () => {
  showScreen('screen-select');
  initSelectScreen();
});

document.getElementById('btn-race').addEventListener('click', showIntroduction);

// ── ATHLETE INTRODUCTION ──────────────────────────────
function showIntroduction() {
  showScreen('screen-race');

  const canvas = document.getElementById('race-canvas');
  const overlay = document.getElementById('race-overlay');
  const phaseEl = document.getElementById('overlay-phase');
  overlay.classList.remove('hidden');

  const athlete   = ATHLETES[Game.athleteIdx];
  const laneCount = TRACK_CONFIG[Game.venue].lanes;
  const playerLane = Math.floor(laneCount / 2) + 1;

  const statBar = (val) =>
    `<span style="color:var(--gold)">${'█'.repeat(Math.round(val * 5))}${'░'.repeat(5 - Math.round(val * 5))}</span>`;

  phaseEl.innerHTML = `
    <div style="font-size:.42rem;letter-spacing:.18em;color:var(--muted);margin-bottom:14px;font-family:'Press Start 2P',monospace">YOU ARE RACING AS</div>
    <div style="font-size:2.4rem;color:${athlete.color};line-height:1.15;margin-bottom:10px;font-family:'Press Start 2P',monospace;text-shadow:4px 4px 0 var(--brown-dark),0 0 30px ${athlete.color}88">${athlete.name}</div>
    <div style="font-size:.44rem;letter-spacing:.1em;color:var(--muted);margin-bottom:22px;font-family:'Press Start 2P',monospace">
      LANE <span style="color:var(--cream);font-size:.85rem">${playerLane}</span> OF ${laneCount}
    </div>
    <div style="display:flex;gap:24px;justify-content:center;margin-bottom:18px;font-size:.34rem;letter-spacing:.08em;font-family:'Press Start 2P',monospace">
      <div style="text-align:center"><div style="color:var(--muted);margin-bottom:5px">SPEED</div>${statBar(athlete.topSpeed)}</div>
      <div style="text-align:center"><div style="color:var(--muted);margin-bottom:5px">ACCEL</div>${statBar(athlete.acceleration)}</div>
      <div style="text-align:center"><div style="color:var(--muted);margin-bottom:5px">STAM</div>${statBar(athlete.stamina)}</div>
    </div>
    <div style="font-size:.42rem;letter-spacing:.12em;color:var(--gold);font-family:'Press Start 2P',monospace;margin-bottom:20px">
      ${Game.venue.toUpperCase()} · ${Game.eventMeters}m${Game.venue === 'indoor' && Game.eventMeters === 400 ? ' · 2 LAPS' : ''}
    </div>
    <div style="font-size:.38rem;letter-spacing:.1em;color:var(--muted);animation:phasePulse .8s infinite alternate;font-family:'Press Start 2P',monospace">
      GET READY...
    </div>
  `;

  // Build race engine and draw still frame
  Game.raceEngine = new RaceEngine(Game.venue, Game.eventMeters, Game.athleteIdx);
  Game.raceTrack  = new RaceTrack(canvas, Game.venue, Game.eventMeters);
  Game.raceTrack.draw(0, Game.raceEngine.allRunners);

  setTimeout(startCountdown, 3000);
}

// ── COUNTDOWN ─────────────────────────────────────────
function startCountdown() {
  const overlay = document.getElementById('race-overlay');
  const phaseEl = document.getElementById('overlay-phase');

  Game.raceEngine.startBlocks();

  phaseEl.style.fontSize = '';
  phaseEl.innerHTML = 'ON YOUR<br>MARKS';
  phaseEl.style.color = '';

  setTimeout(() => {
    phaseEl.innerHTML = 'GET SET';
    Game.raceEngine.triggerSet();
  }, 1500);

  setTimeout(() => {
    phaseEl.style.color = '#2ECC71';
    phaseEl.innerHTML   = 'GO!';
    Game.raceEngine.triggerGo();

    // Check for false start
    if (Game.raceEngine.falseStart) {
      handleFalseStart();
      return;
    }

    setTimeout(() => {
      overlay.classList.add('hidden');
      beginRaceLoop();
    }, 500);
  }, 2600);
}

function handleFalseStart() {
  const phaseEl = document.getElementById('overlay-phase');
  phaseEl.style.color = '#E83020';
  phaseEl.innerHTML = 'FALSE<br>START!';
  setTimeout(() => {
    // Restart countdown
    Game.raceEngine = new RaceEngine(Game.venue, Game.eventMeters, Game.athleteIdx);
    startCountdown();
  }, 1800);
}

// ── RACE LOOP ──────────────────────────────────────────
function beginRaceLoop() {
  const canvas  = document.getElementById('race-canvas');
  const engine  = Game.raceEngine;
  const track   = Game.raceTrack;

  document.getElementById('hud-event-name').textContent =
    (Game.venue === 'indoor' ? 'INDOOR ' : 'OUTDOOR ') + Game.eventMeters + 'm';
  const lapEl = document.getElementById('hud-lap');
  lapEl.textContent = engine.totalLaps > 1 ? 'LAP 1 / ' + engine.totalLaps : '';

  Game.lastTime = performance.now();
  let finishTriggered = false;

  function loop(ts) {
    const dt = Math.min((ts - Game.lastTime) / 1000, 0.05);
    Game.lastTime = ts;

    engine.update(dt);

    // Update HUD
    const t = engine.elapsed;
    const timeEl = document.getElementById('hud-time');
    timeEl.textContent = t.toFixed(3);
    // Flash timer when going fast
    const spd = engine.getSpeedPercent();
    timeEl.classList.toggle('fast', spd > 80);

    document.getElementById('hud-speed-fill').style.width   = spd + '%';
    document.getElementById('hud-stamina-fill').style.width = (engine.player.stamina * 100) + '%';
    document.getElementById('hud-rhythm-fill').style.width  = engine.getRhythmPercent() + '%';

    if (engine.totalLaps > 1) {
      lapEl.textContent = 'LAP ' + engine.getPlayerLap() + ' / ' + engine.totalLaps;
    }

    track.draw(engine.player.progress, engine.allRunners, dt);

    if (engine.isFinished() && !finishTriggered) {
      finishTriggered = true;
      track.triggerFinishFlash();
      // Keep drawing for 1.4s for the flash + confetti
      const finishStart = ts;
      function finishLoop(ts2) {
        const fdt = Math.min((ts2 - finishStart) / 1000, 0.05);
        track.draw(engine.player.progress, engine.allRunners, fdt);
        if (ts2 - finishStart < 1400) requestAnimationFrame(finishLoop);
        else showResults();
      }
      requestAnimationFrame(finishLoop);
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

  const medals     = ['🥇', '🥈', '🥉'];
  const placeNames = ['1ST PLACE','2ND PLACE','3RD PLACE','4TH PLACE','5TH PLACE','6TH PLACE','7TH PLACE','8TH PLACE'];
  const place = results.place || 1;

  document.getElementById('result-medal').textContent = place <= 3 ? medals[place - 1] : '🏃';
  document.getElementById('result-place').textContent = placeNames[Math.min(place - 1, placeNames.length - 1)];
  document.getElementById('result-event-name').textContent =
    (Game.venue === 'indoor' ? 'INDOOR ' : 'OUTDOOR ') + Game.eventMeters + 'm';

  const t  = results.time || 0;
  const wr = results.worldRecord;

  // Record line
  let recordText = '';
  if (results.isWorldRecord) {
    recordText = '🌟 NEW WORLD RECORD!';
    document.getElementById('result-time').style.color = '#FFD84A';
  } else {
    const diff = (t - wr).toFixed(2);
    recordText = `WR: ${wr.toFixed(2)}s  (+${diff}s off WR)`;
  }
  document.getElementById('result-record').textContent = recordText;

  // Personal best
  try {
    const pbKey  = 'rb_pb_' + results.eventKey;
    const prevPB = parseFloat(localStorage.getItem(pbKey)) || 9999;
    if (t < prevPB) {
      localStorage.setItem(pbKey, t.toFixed(3));
      if (!results.isWorldRecord) recordText += '  🎉 PB!';
      document.getElementById('result-record').textContent = recordText;
    }
  } catch (e) {}

  // Ranking breakdown (show all finishers)
  const rankEl = document.getElementById('result-ranking');
  if (results.allResults) {
    const lines = results.allResults
      .filter(r => r.finishTime)
      .slice(0, 4)
      .map((r, i) => {
        const isPlayer = r.isPlayer;
        const name = isPlayer ? ATHLETES[r.athleteIdx || 0].name : 'CPU';
        const marker = isPlayer ? '► ' : '  ';
        return `${marker}${i + 1}. ${name.padEnd(6)} ${r.finishTime.toFixed(3)}s`;
      });
    rankEl.innerHTML = lines
      .map((l, i) => `<div style="color:${i === place - 1 ? 'var(--gold)' : 'var(--muted)'}">${l}</div>`)
      .join('');
  }

  // Animated time counter
  const timeEl  = document.getElementById('result-time');
  const startTs = performance.now();
  const dur     = 1200;
  function countUp(ts) {
    const frac = Math.min((ts - startTs) / dur, 1);
    const ease = 1 - Math.pow(1 - frac, 3);
    timeEl.textContent = (ease * t).toFixed(2);
    if (frac < 1) requestAnimationFrame(countUp);
    else timeEl.textContent = t.toFixed(3);
  }
  requestAnimationFrame(countUp);
}

// ── RESULT BUTTONS ─────────────────────────────────────
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

// ── TOUCH ─────────────────────────────────────────────
document.addEventListener('touchstart', e => {
  if (Game.raceEngine && Game.raceEngine.state === 'running') {
    e.preventDefault();
    Game.raceEngine.handleTouch();
  }
}, { passive: false });

// ── RESIZE ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (Game.raceTrack) Game.raceTrack._resize();
});

// Boot
showScreen('screen-intro');
