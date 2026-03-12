// athletes.js — Athlete definitions and sprite rendering

const ATHLETES = [
  {
    id: 0, name: 'BOLT',
    color: '#FFD060', skinTone: '#8B5A2B',
    kitColor: '#FFD060', kitAccent: '#B8860B',
    topSpeed: 1.0, acceleration: 0.78, stamina: 0.80,
  },
  {
    id: 1, name: 'SWIFT',
    color: '#1A8FE3', skinTone: '#FDBCB4',
    kitColor: '#1A8FE3', kitAccent: '#0D5FA0',
    topSpeed: 0.86, acceleration: 1.0, stamina: 0.92,
  },
  {
    id: 2, name: 'TITAN',
    color: '#E8392A', skinTone: '#6B3A2A',
    kitColor: '#E8392A', kitAccent: '#8B1A0E',
    topSpeed: 0.78, acceleration: 0.88, stamina: 1.0,
  }
];

/**
 * Draw a running athlete sprite.
 * x,y = centre-bottom of the sprite (feet position).
 */
function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facingRight ? scale : -scale, scale);

  const f = frame % 8;
  const legSwing  =  Math.sin(f / 8 * Math.PI * 2);
  const armSwing  = -legSwing;
  const bounce    =  Math.abs(legSwing) * 3;

  const skin = athlete.skinTone;
  const kit  = athlete.kitColor;
  const acc  = athlete.kitAccent;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 3, 0, 0, Math.PI * 2);
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
  ctx.roundRect(-8, -34 + bounce, 16, 18, 3);
  ctx.fill();

  // Bib number
  ctx.fillStyle = 'white';
  ctx.fillRect(-4, -32 + bounce, 8, 9);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(athlete.id + 1, 0, -25 + bounce);

  // Back arm
  ctx.save();
  ctx.translate(-5, -30 + bounce);
  ctx.rotate(armSwing * 0.7 + 0.3);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 4, 11);
  ctx.restore();

  // Front arm
  ctx.save();
  ctx.translate(5, -30 + bounce);
  ctx.rotate(-armSwing * 0.7 - 0.3);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 4, 11);
  ctx.restore();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -42 + bounce, 7, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -44 + bounce, 6, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw athlete standing still.
 * x,y = centre-bottom (feet).
 */
function drawAthleteStanding(ctx, athlete, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const skin = athlete.skinTone;
  const kit  = athlete.kitColor;
  const acc  = athlete.kitAccent;

  // Legs
  ctx.fillStyle = acc;
  ctx.fillRect(-8, -18, 6, 18);
  ctx.fillStyle = kit;
  ctx.fillRect(2, -18, 6, 18);
  ctx.fillStyle = '#111';
  ctx.fillRect(-9, -2, 8, 4);
  ctx.fillRect(1, -2, 8, 4);

  // Body
  ctx.fillStyle = kit;
  ctx.beginPath();
  ctx.roundRect(-9, -36, 18, 18, 3);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillRect(-4, -34, 8, 9);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(athlete.id + 1, 0, -27);

  // Arms
  ctx.fillStyle = skin;
  ctx.fillRect(-14, -34, 5, 14);
  ctx.fillRect(9,   -34, 5, 14);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -44, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -47, 7, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

function drawOpponent(ctx, x, y, frame, color, skinTone, scale = 1) {
  const fakeAthlete = {
    id: 9, skinTone, kitColor: color, kitAccent: color
  };
  drawAthlete(ctx, fakeAthlete, x, y, frame, true, scale);
}
