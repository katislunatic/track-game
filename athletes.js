// athletes.js — Retro Bowl-style chunky sprites

const ATHLETES = [
  {
    id: 0, name: 'BOLT',
    color: '#E8A800', skinTone: '#C8956C',
    kitColor: '#E8A800', kitAccent: '#9E6E00',
    hairColor: '#1A1208',
    topSpeed: 1.0, acceleration: 0.78, stamina: 0.80,
  },
  {
    id: 1, name: 'SWIFT',
    color: '#1A50C8', skinTone: '#F5C8A0',
    kitColor: '#1A50C8', kitAccent: '#0D3080',
    hairColor: '#8B4A14',
    topSpeed: 0.86, acceleration: 1.0, stamina: 0.92,
  },
  {
    id: 2, name: 'TITAN',
    color: '#D4200C', skinTone: '#8B5A2B',
    kitColor: '#D4200C', kitAccent: '#7A1008',
    hairColor: '#1A1208',
    topSpeed: 0.78, acceleration: 0.88, stamina: 1.0,
  }
];

// Retro Bowl-style: chunky blocky shapes, no smooth curves, pixel-art feel
// All drawing is relative to (0,0) after translate, so transforms work correctly

function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facingRight ? scale : -scale, scale);

  const f   = frame % 8;
  const alt = f < 4;

  const sk = athlete.skinTone  || '#C8956C';
  const ki = athlete.kitColor  || '#E8A800';
  const ac = athlete.kitAccent || '#9E6E00';
  const ha = athlete.hairColor || '#1A1208';
  const sh = '#111111';

  // All coords are relative, centred at (0,0) = feet centre
  // Sprite is ~20px wide, ~46px tall at scale=1

  // ── SHADOW ──
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-8, -1, 16, 3);

  // ── LEGS ──
  if (alt) {
    // Left leg forward, right leg back
    ctx.fillStyle = ac;
    ctx.fillRect(-7, -18, 6, 10); // left thigh fwd
    ctx.fillRect(-9, -10, 6,  8); // left shin fwd
    ctx.fillStyle = ki;
    ctx.fillRect( 1, -18, 6,  8); // right thigh back
    ctx.fillRect( 3, -12, 6,  8); // right shin back
    // shoes
    ctx.fillStyle = sh;
    ctx.fillRect(-10, -4, 8, 4);  // left shoe
    ctx.fillRect(  3, -6, 8, 4);  // right shoe
  } else {
    // Right leg forward, left leg back
    ctx.fillStyle = ki;
    ctx.fillRect( 1, -18, 6, 10); // right thigh fwd
    ctx.fillRect( 3, -10, 6,  8); // right shin fwd
    ctx.fillStyle = ac;
    ctx.fillRect(-7, -18, 6,  8); // left thigh back
    ctx.fillRect(-9, -12, 6,  8); // left shin back
    // shoes
    ctx.fillStyle = sh;
    ctx.fillRect( 3,  -4, 8, 4);  // right shoe
    ctx.fillRect(-10, -6, 8, 4);  // left shoe
  }

  // ── BODY ──
  ctx.fillStyle = ki;
  ctx.fillRect(-8, -36, 16, 18);

  // Bib (white patch on chest)
  ctx.fillStyle = '#F5E6C8';
  ctx.fillRect(-5, -34, 10, 10);
  ctx.fillStyle = ac;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, 0, -29);

  // ── ARMS ──
  if (alt) {
    // right arm up-forward, left arm down-back
    ctx.fillStyle = sk;
    ctx.fillRect( 8, -38, 5, 10); // right arm up
    ctx.fillRect(-13, -28, 5, 10); // left arm down
  } else {
    // left arm up-forward, right arm down-back
    ctx.fillStyle = sk;
    ctx.fillRect(-13, -38, 5, 10); // left arm up
    ctx.fillRect(  8, -28, 5, 10); // right arm down
  }

  // ── HEAD ──
  // Hair (big blocky square — Retro Bowl style)
  ctx.fillStyle = ha;
  ctx.fillRect(-7, -50, 14, 8);
  // Face
  ctx.fillStyle = sk;
  ctx.fillRect(-6, -44, 12, 10);
  // Eyes (two dark dots)
  ctx.fillStyle = sh;
  ctx.fillRect(-4, -42, 2, 2);
  ctx.fillRect( 2, -42, 2, 2);

  ctx.restore();
}

function drawAthleteStanding(ctx, athlete, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const sk = athlete.skinTone  || '#C8956C';
  const ki = athlete.kitColor  || '#E8A800';
  const ac = athlete.kitAccent || '#9E6E00';
  const ha = athlete.hairColor || '#1A1208';
  const sh = '#111111';

  // Legs straight
  ctx.fillStyle = ac;
  ctx.fillRect(-8, -18, 6, 18);
  ctx.fillStyle = ki;
  ctx.fillRect( 2, -18, 6, 18);
  ctx.fillStyle = sh;
  ctx.fillRect(-9,  -2, 8, 4);
  ctx.fillRect( 1,  -2, 8, 4);

  // Body
  ctx.fillStyle = ki;
  ctx.fillRect(-8, -36, 16, 18);
  ctx.fillStyle = '#F5E6C8';
  ctx.fillRect(-5, -34, 10, 10);
  ctx.fillStyle = ac;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, 0, -29);

  // Arms at sides
  ctx.fillStyle = sk;
  ctx.fillRect(-13, -34, 5, 14);
  ctx.fillRect(  8, -34, 5, 14);

  // Head
  ctx.fillStyle = ha;
  ctx.fillRect(-7, -50, 14, 8);
  ctx.fillStyle = sk;
  ctx.fillRect(-6, -44, 12, 10);
  ctx.fillStyle = sh;
  ctx.fillRect(-4, -42, 2, 2);
  ctx.fillRect( 2, -42, 2, 2);

  ctx.restore();
}

function drawOpponent(ctx, x, y, frame, color, skinTone, scale = 1) {
  const fakeAthlete = {
    id: 9,
    skinTone:  skinTone || '#C8956C',
    kitColor:  color    || '#888888',
    kitAccent: _shade(color || '#888888', -40),
    hairColor: '#1A1208',
  };
  drawAthlete(ctx, fakeAthlete, x, y, frame, true, scale);
}

function _shade(hex, amt) {
  const n = parseInt((hex||'#888888').replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
