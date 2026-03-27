// athletes.js — RETRO BLAZE sprites

const ATHLETES = [
  {
    id: 0, name: 'BOLT',
    color: '#F5B800', skinTone: '#C8956C',
    kitColor: '#E8A000', kitAccent: '#9E6E00',
    hairColor: '#1A1208',
    glowColor: 'rgba(245,184,0,0.5)',
    topSpeed: 1.0, acceleration: 0.78, stamina: 0.80,
  },
  {
    id: 1, name: 'SWIFT',
    color: '#4080FF', skinTone: '#F5C8A0',
    kitColor: '#1A50C8', kitAccent: '#0D3080',
    hairColor: '#8B4A14',
    glowColor: 'rgba(64,128,255,0.5)',
    topSpeed: 0.86, acceleration: 1.0, stamina: 0.92,
  },
  {
    id: 2, name: 'TITAN',
    color: '#E83020', skinTone: '#8B5A2B',
    kitColor: '#D4200C', kitAccent: '#7A1008',
    hairColor: '#1A1208',
    glowColor: 'rgba(232,48,32,0.5)',
    topSpeed: 0.78, acceleration: 0.88, stamina: 1.0,
  }
];

// Draw running athlete with motion blur streaks
function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1, speed = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facingRight ? scale : -scale, scale);

  const f         = frame % 8;
  const legSwing  = Math.sin(f / 8 * Math.PI * 2);
  const armSwing  = -legSwing;
  const bounce    = Math.abs(legSwing) * 3.5;

  const skin = athlete.skinTone  || '#C8956C';
  const kit  = athlete.kitColor  || '#E8A800';
  const acc  = athlete.kitAccent || '#9E6E00';
  const hair = athlete.hairColor || '#1A1208';

  // Speed streaks (motion blur effect)
  if (speed && speed > 4) {
    const alpha = Math.min(0.35, (speed - 4) / 20);
    const streakCount = 3;
    for (let i = 1; i <= streakCount; i++) {
      ctx.save();
      ctx.globalAlpha = alpha * (1 - i / streakCount);
      ctx.translate(-i * 7, 0);
      _drawBody(ctx, athlete, legSwing * (1 - i * 0.2), bounce * (1 - i * 0.2), skin, kit, acc, hair);
      ctx.restore();
    }
  }

  // Shadow (ellipse on ground)
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 2, 13 * Math.abs(scale) / scale, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Glow for player at high speed
  if (speed && speed > 6 && athlete.glowColor) {
    const glowA = Math.min(0.6, (speed - 6) / 14);
    const g = ctx.createRadialGradient(0, -24 + bounce, 0, 0, -24 + bounce, 28);
    g.addColorStop(0, athlete.glowColor.replace('0.5', String(glowA)));
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(-28, -60, 56, 70);
  }

  _drawBody(ctx, athlete, legSwing, bounce, skin, kit, acc, hair, frame);

  ctx.restore();
}

function _drawBody(ctx, athlete, legSwing, bounce, skin, kit, acc, hair, frame) {
  const armSwing = -legSwing;

  // Back leg
  ctx.save();
  ctx.translate(1, -16 + bounce);
  ctx.rotate(-legSwing * 0.6);
  ctx.fillStyle = acc;
  ctx.fillRect(-3, 0, 7, 14);
  ctx.fillStyle = '#111';
  ctx.fillRect(-4, 12, 9, 5);
  ctx.restore();

  // Front leg
  ctx.save();
  ctx.translate(-1, -16 + bounce);
  ctx.rotate(legSwing * 0.6);
  ctx.fillStyle = kit;
  ctx.fillRect(-3, 0, 7, 14);
  ctx.fillStyle = '#111';
  ctx.fillRect(-4, 12, 9, 5);
  ctx.restore();

  // Body
  ctx.fillStyle = kit;
  ctx.beginPath();
  ctx.roundRect(-8, -34 + bounce, 16, 18, 3);
  ctx.fill();

  // Stripe on body
  ctx.fillStyle = acc;
  ctx.fillRect(-8, -30 + bounce, 16, 3);

  // Bib number
  ctx.fillStyle = '#F5E6C8';
  ctx.fillRect(-4, -33 + bounce, 8, 9);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, 0, -29 + bounce);

  // Back arm
  ctx.save();
  ctx.translate(-6, -30 + bounce);
  ctx.rotate(armSwing * 0.75 + 0.35);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 5, 11);
  ctx.restore();

  // Front arm
  ctx.save();
  ctx.translate(6, -30 + bounce);
  ctx.rotate(-armSwing * 0.75 - 0.35);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 5, 11);
  ctx.restore();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -42 + bounce, 7, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -44 + bounce, 6.5, Math.PI, 0);
  ctx.fill();

  // Eyes (little white dots when running fast)
  if (bounce > 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(2, -44 + bounce, 3, 2);
  }
}

function drawAthleteStanding(ctx, athlete, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const skin = athlete.skinTone  || '#C8956C';
  const kit  = athlete.kitColor  || '#E8A800';
  const acc  = athlete.kitAccent || '#9E6E00';
  const hair = athlete.hairColor || '#1A1208';

  // Legs
  ctx.fillStyle = acc;  ctx.fillRect(-9, -20, 7, 20);
  ctx.fillStyle = kit;  ctx.fillRect( 2, -20, 7, 20);
  ctx.fillStyle = '#111';
  ctx.fillRect(-10, -3, 9, 5);
  ctx.fillRect(  1, -3, 9, 5);

  // Body
  ctx.fillStyle = kit;
  ctx.beginPath(); ctx.roundRect(-9, -38, 18, 18, 3); ctx.fill();
  ctx.fillStyle = acc; ctx.fillRect(-9, -34, 18, 3);
  ctx.fillStyle = '#F5E6C8'; ctx.fillRect(-4, -37, 8, 10);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, 0, -32);

  // Arms
  ctx.fillStyle = skin;
  ctx.fillRect(-15, -36, 6, 15);
  ctx.fillRect(  9, -36, 6, 15);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -46, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, -49, 7.5, Math.PI, 0); ctx.fill();

  // Gleam on head
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(-2, -50, 3, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawOpponent(ctx, x, y, frame, color, skinTone, scale = 1, speed = 0) {
  const fakeAthlete = {
    id: 9,
    skinTone:  skinTone || '#C8956C',
    kitColor:  color    || '#888',
    kitAccent: _shade(color || '#888', -40),
    hairColor: '#1A1208',
    glowColor: null,
  };
  drawAthlete(ctx, fakeAthlete, x, y, frame, true, scale, 0);
}

function _shade(hex, amt) {
  const n = parseInt((hex || '#888888').replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
