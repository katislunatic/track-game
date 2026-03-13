// athletes.js — Retro Bowl-style pixel sprite rendering

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

// Draw a filled rectangle in pixel-grid coordinates
// ox,oy = top-left origin in canvas px, P = pixel size
function _r(ctx, ox, oy, col, row, w, h, color, P) {
  ctx.fillStyle = color;
  ctx.fillRect(ox + col * P, oy + row * P, w * P, h * P);
}

/**
 * Draw a running athlete.
 * x, y = centre-bottom of sprite (feet position) in canvas coords.
 * scale multiplies the whole sprite.
 */
function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1) {
  const P  = Math.max(1, Math.round(2 * scale)); // pixel size, min 1
  const GW = 10; // grid cols
  const GH = 16; // grid rows

  // Top-left origin so that centre-bottom = (x, y)
  const ox = Math.round(x - (GW / 2) * P);
  const oy = Math.round(y - GH * P);

  // Mirror for left-facing
  ctx.save();
  if (!facingRight) {
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
  }

  const f   = frame % 8;
  const alt = f < 4;

  const sk = athlete.skinTone  || '#C8956C';
  const ki = athlete.kitColor  || '#E8A800';
  const ac = athlete.kitAccent || '#9E6E00';
  const ha = athlete.hairColor || '#1A1208';
  const sh = '#111111';
  const bi = '#F5E6C8';

  const R = (c,r,w,h,col) => _r(ctx, ox, oy, c, r, w, h, col, P);

  // ── HEAD (rows 0-3, cols 3-6) ──
  R(3, 0, 4, 2, ha); // hair
  R(3, 2, 4, 2, sk); // face

  // ── BODY (rows 4-8, cols 2-7) ──
  R(2, 4, 6, 4, ki); // torso
  R(3, 4, 4, 3, bi); // bib
  // bib number
  ctx.fillStyle = ac;
  ctx.font = `bold ${Math.max(5, P * 2)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, ox + 5 * P, oy + 6 * P);

  // ── ARMS (rows 5-7) ──
  if (alt) {
    R(8, 4, 2, 2, sk); // right arm up
    R(0, 6, 2, 2, sk); // left arm down
  } else {
    R(0, 4, 2, 2, sk); // left arm up
    R(8, 6, 2, 2, sk); // right arm down
  }

  // ── LEGS (rows 8-15) ──
  if (alt) {
    // left leg forward
    R(1, 8,  3, 3, ac);  // left thigh fwd
    R(0, 11, 3, 2, ac);  // left shin fwd
    R(0, 13, 3, 1, sh);  // left shoe
    // right leg back
    R(5, 8,  3, 2, ki);  // right thigh back
    R(6, 10, 3, 2, ki);  // right shin back
    R(6, 12, 3, 1, sh);  // right shoe
  } else {
    // right leg forward
    R(6, 8,  3, 3, ki);  // right thigh fwd
    R(7, 11, 3, 2, ki);  // right shin fwd
    R(7, 13, 3, 1, sh);  // right shoe
    // left leg back
    R(2, 8,  3, 2, ac);  // left thigh back
    R(1, 10, 3, 2, ac);  // left shin back
    R(1, 12, 3, 1, sh);  // left shoe
  }

  ctx.restore();
}

/**
 * Draw athlete standing still.
 * x, y = centre-bottom (feet).
 */
function drawAthleteStanding(ctx, athlete, x, y, scale = 1) {
  const P  = Math.max(1, Math.round(2 * scale));
  const GW = 10;
  const GH = 16;

  const ox = Math.round(x - (GW / 2) * P);
  const oy = Math.round(y - GH * P);

  const sk = athlete.skinTone  || '#C8956C';
  const ki = athlete.kitColor  || '#E8A800';
  const ac = athlete.kitAccent || '#9E6E00';
  const ha = athlete.hairColor || '#1A1208';
  const sh = '#111111';
  const bi = '#F5E6C8';

  const R = (c,r,w,h,col) => _r(ctx, ox, oy, c, r, w, h, col, P);

  // HEAD
  R(3, 0, 4, 2, ha);
  R(3, 2, 4, 2, sk);

  // BODY
  R(2, 4, 6, 4, ki);
  R(3, 4, 4, 3, bi);
  ctx.fillStyle = ac;
  ctx.font = `bold ${Math.max(5, P * 2)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, ox + 5 * P, oy + 6 * P);

  // ARMS
  R(0, 5, 2, 3, sk);
  R(8, 5, 2, 3, sk);

  // LEGS
  R(2,  8, 3, 5, ac);
  R(5,  8, 3, 5, ki);
  R(2, 13, 3, 1, sh);
  R(5, 13, 3, 1, sh);
}

function drawOpponent(ctx, x, y, frame, color, skinTone, scale = 1) {
  const fakeAthlete = {
    id: 9,
    skinTone:  skinTone || '#C8956C',
    kitColor:  color,
    kitAccent: _shade(color, -40),
    hairColor: '#1A1208',
  };
  drawAthlete(ctx, fakeAthlete, x, y, frame, true, scale);
}

function _shade(hex, amt) {
  const n = parseInt((hex || '#888888').replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16)|(g << 8)|b).toString(16).padStart(6,'0');
}
