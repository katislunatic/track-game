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

// Retro Bowl-style sprite: chunky rectangles, simple animation.
// x,y = centre-bottom (feet). All drawing relative to 0,0 after translate.

function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facingRight ? scale : -scale, scale);

  const f      = frame % 8;
  const legSwing  = Math.sin(f / 8 * Math.PI * 2);
  const armSwing  = -legSwing;
  const bounce    = Math.abs(legSwing) * 3;

  const skin = athlete.skinTone  || '#C8956C';
  const kit  = athlete.kitColor  || '#E8A800';
  const acc  = athlete.kitAccent || '#9E6E00';
  const hair = athlete.hairColor || '#1A1208';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 3, 0, 0, Math.PI*2);
  ctx.fill();

  // Back leg
  ctx.save();
  ctx.translate(0, -16 + bounce);
  ctx.rotate(-legSwing * 0.55);
  ctx.fillStyle = acc;
  ctx.fillRect(-3, 0, 7, 14);
  ctx.fillStyle = '#111';
  ctx.fillRect(-3, 13, 9, 4);
  ctx.restore();

  // Front leg
  ctx.save();
  ctx.translate(0, -16 + bounce);
  ctx.rotate(legSwing * 0.55);
  ctx.fillStyle = kit;
  ctx.fillRect(-3, 0, 7, 14);
  ctx.fillStyle = '#111';
  ctx.fillRect(-3, 13, 9, 4);
  ctx.restore();

  // Body
  ctx.fillStyle = kit;
  ctx.beginPath();
  ctx.roundRect(-8, -34+bounce, 16, 18, 3);
  ctx.fill();

  // Bib
  ctx.fillStyle = '#F5E6C8';
  ctx.fillRect(-4, -32+bounce, 8, 9);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((athlete.id ?? 0) + 1, 0, -28+bounce);

  // Back arm
  ctx.save();
  ctx.translate(-5, -30+bounce);
  ctx.rotate(armSwing * 0.7 + 0.3);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 4, 11);
  ctx.restore();

  // Front arm
  ctx.save();
  ctx.translate(5, -30+bounce);
  ctx.rotate(-armSwing * 0.7 - 0.3);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 4, 11);
  ctx.restore();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -42+bounce, 7, 0, Math.PI*2);
  ctx.fill();

  // Hair (blocky top — Retro Bowl style)
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -44+bounce, 6, Math.PI, 0);
  ctx.fill();

  ctx.restore();
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
  ctx.fillStyle = acc;  ctx.fillRect(-8, -18, 6, 18);
  ctx.fillStyle = kit;  ctx.fillRect( 2, -18, 6, 18);
  ctx.fillStyle = '#111';
  ctx.fillRect(-9, -2, 8, 4);
  ctx.fillRect( 1, -2, 8, 4);

  // Body
  ctx.fillStyle = kit;
  ctx.beginPath(); ctx.roundRect(-9, -36, 18, 18, 3); ctx.fill();
  ctx.fillStyle = '#F5E6C8'; ctx.fillRect(-4, -34, 8, 9);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText((athlete.id ?? 0) + 1, 0, -30);

  // Arms
  ctx.fillStyle = skin;
  ctx.fillRect(-14, -34, 5, 14);
  ctx.fillRect(  9, -34, 5, 14);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -44, 8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, -47, 7, Math.PI, 0); ctx.fill();

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
  const r = Math.max(0, Math.min(255, (n>>16)+amt));
  const g = Math.max(0, Math.min(255, ((n>>8)&0xff)+amt));
  const b = Math.max(0, Math.min(255, (n&0xff)+amt));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
