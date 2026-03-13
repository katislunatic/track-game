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

// ─────────────────────────────────────────────────────────
//  PIXEL HELPER — draw a block on a virtual pixel grid
//  P = pixel size in canvas units
// ─────────────────────────────────────────────────────────
function px(ctx, col, row, w, h, color, P) {
  ctx.fillStyle = color;
  ctx.fillRect(col * P, row * P, w * P, h * P);
}

// ─────────────────────────────────────────────────────────
//  RUNNING SPRITE  (Retro Bowl style)
//  Drawn on a 10×18 pixel grid, P = pixel size
//  x,y = canvas centre-bottom (feet)
//  frame drives the leg/arm animation
// ─────────────────────────────────────────────────────────
function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1) {
  const P  = 3 * scale;   // each "pixel" = 3 canvas units
  const GW = 10;           // grid width  (pixels)
  const GH = 18;           // grid height (pixels)

  ctx.save();
  // Anchor at centre-bottom; flip if facing left
  ctx.translate(x, y);
  if (!facingRight) ctx.scale(-1, 1);
  // Shift so grid bottom-centre = origin
  ctx.translate(-GW / 2 * P, -GH * P);

  const f   = frame % 8;
  const alt = f < 4; // alternates every 4 frames for 2-phase animation

  const skin = athlete.skinTone;
  const kit  = athlete.kitColor;
  const acc  = athlete.kitAccent;
  const hair = athlete.hairColor || '#1A1208';
  const shoe = '#1A1208';
  const bib  = '#F5E6C8';

  // ── HEAD (cols 3-6, rows 0-3) ──
  px(ctx, 3, 0, 4, 1, hair, P); // hair top
  px(ctx, 3, 1, 4, 1, hair, P);
  px(ctx, 3, 2, 4, 2, skin, P); // face
  px(ctx, 3, 1, 1, 1, skin, P); // face sides
  px(ctx, 6, 1, 1, 1, skin, P);

  // ── BODY / VEST (cols 2-7, rows 4-8) ──
  px(ctx, 2, 4, 6, 5, kit, P);
  // Bib number patch
  px(ctx, 3, 4, 4, 3, bib, P);
  // Number on bib
  ctx.fillStyle = acc;
  ctx.font = `bold ${Math.round(P * 2)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(athlete.id + 1, GW / 2 * P, 5.5 * P);

  // ── ARMS ──
  // Running: arms pump alternately
  if (alt) {
    // Right arm forward-up, left arm back-down
    px(ctx, 7, 5, 2, 1, skin, P); // right arm up
    px(ctx, 8, 4, 1, 2, skin, P);
    px(ctx, 1, 7, 2, 1, skin, P); // left arm back
    px(ctx, 0, 8, 1, 1, skin, P);
  } else {
    // Left arm forward-up, right arm back-down
    px(ctx, 1, 5, 2, 1, skin, P); // left arm up
    px(ctx, 0, 4, 1, 2, skin, P);
    px(ctx, 7, 7, 2, 1, skin, P); // right arm back
    px(ctx, 8, 8, 1, 1, skin, P);
  }

  // ── LEGS ──
  // Phase A: left leg forward, right leg back
  // Phase B: right leg forward, left leg back
  if (alt) {
    // Left leg: forward stride (angled forward)
    px(ctx, 2, 9,  3, 3, acc, P);  // left thigh forward
    px(ctx, 1, 12, 3, 2, acc, P);  // left shin
    px(ctx, 0, 14, 3, 1, shoe, P); // left shoe
    // Right leg: back kick
    px(ctx, 5, 9,  3, 2, kit, P);  // right thigh back
    px(ctx, 6, 11, 2, 2, kit, P);  // right shin
    px(ctx, 6, 13, 3, 1, shoe, P); // right shoe
  } else {
    // Right leg: forward stride
    px(ctx, 5, 9,  3, 3, kit, P);  // right thigh forward
    px(ctx, 6, 12, 3, 2, kit, P);  // right shin
    px(ctx, 6, 14, 3, 1, shoe, P); // right shoe
    // Left leg: back kick
    px(ctx, 2, 9,  3, 2, acc, P);  // left thigh back
    px(ctx, 1, 11, 2, 2, acc, P);  // left shin
    px(ctx, 1, 13, 3, 1, shoe, P); // left shoe
  }

  // ── BODY OUTLINE (1px dark border on sides) ──
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(2 * P, 4 * P, P * 0.5, 5 * P); // left edge
  ctx.fillRect(7.5 * P, 4 * P, P * 0.5, 5 * P); // right edge

  // ── DROP SHADOW ──
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.fillRect(P * 2, GH * P, P * 6, P * 0.8);
  ctx.restore();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────
//  STANDING SPRITE  (for athlete select screen)
// ─────────────────────────────────────────────────────────
function drawAthleteStanding(ctx, athlete, x, y, scale = 1) {
  const P  = 3 * scale;
  const GW = 10;
  const GH = 18;

  ctx.save();
  ctx.translate(x, y);
  ctx.translate(-GW / 2 * P, -GH * P);

  const skin = athlete.skinTone;
  const kit  = athlete.kitColor;
  const acc  = athlete.kitAccent;
  const hair = athlete.hairColor || '#1A1208';
  const shoe = '#1A1208';
  const bib  = '#F5E6C8';

  // HEAD
  px(ctx, 3, 0, 4, 1, hair, P);
  px(ctx, 3, 1, 4, 1, hair, P);
  px(ctx, 3, 2, 4, 2, skin, P);
  px(ctx, 3, 1, 1, 1, skin, P);
  px(ctx, 6, 1, 1, 1, skin, P);

  // BODY
  px(ctx, 2, 4, 6, 5, kit, P);
  px(ctx, 3, 4, 4, 3, bib, P);
  ctx.fillStyle = acc;
  ctx.font = `bold ${Math.round(P * 2)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(athlete.id + 1, GW / 2 * P, 5.5 * P);

  // ARMS (at sides)
  px(ctx, 0, 5, 2, 3, skin, P); // left arm
  px(ctx, 8, 5, 2, 3, skin, P); // right arm

  // LEGS (straight down)
  px(ctx, 2, 9,  3, 5, acc, P);  // left leg
  px(ctx, 5, 9,  3, 5, kit, P);  // right leg
  px(ctx, 2, 14, 3, 1, shoe, P); // left shoe
  px(ctx, 5, 14, 3, 1, shoe, P); // right shoe

  // Outline
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(2 * P, 4 * P, P * 0.5, 5 * P);
  ctx.fillRect(7.5 * P, 4 * P, P * 0.5, 5 * P);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────
//  OPPONENT  (uses drawAthlete with opponent colours)
// ─────────────────────────────────────────────────────────
function drawOpponent(ctx, x, y, frame, color, skinTone, scale = 1) {
  // Darken the kit color for accent
  const fakeAthlete = {
    id: 9,
    skinTone,
    kitColor:  color,
    kitAccent: shadeColor(color, -30),
    hairColor: '#1A1208',
  };
  drawAthlete(ctx, fakeAthlete, x, y, frame, true, scale);
}

// Simple color darkener
function shadeColor(hex, amt) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
