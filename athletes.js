// athletes.js — Athlete definitions and sprite rendering

const ATHLETES = [
  {
    id: 0,
    name: 'BOLT',
    color: '#FFD060',
    skinTone: '#8B5A2B',
    kitColor: '#FFD060',
    kitAccent: '#B8860B',
    topSpeed: 1.0,
    acceleration: 0.78,
    stamina: 0.80,
    description: 'Pure speed demon. Peaks fast, stays fast.'
  },
  {
    id: 1,
    name: 'SWIFT',
    color: '#1A8FE3',
    skinTone: '#C8956C',
    kitColor: '#1A8FE3',
    kitAccent: '#0D5FA0',
    topSpeed: 0.86,
    acceleration: 1.0,
    stamina: 0.92,
    description: 'Explosive start. Built for endurance.'
  },
  {
    id: 2,
    name: 'TITAN',
    color: '#E8392A',
    skinTone: '#6B3A2A',
    kitColor: '#E8392A',
    kitAccent: '#8B1A0E',
    topSpeed: 0.78,
    acceleration: 0.88,
    stamina: 1.0,
    description: 'Iron legs. Never fades.'
  }
];

// Draw a runner sprite on a canvas
function drawAthlete(ctx, athlete, x, y, frame, facingRight = true, scale = 1) {
  ctx.save();
  if (!facingRight) {
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
  }
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const f = frame % 8; // 8 animation frames
  const legAngle = Math.sin(f / 8 * Math.PI * 2);
  const armAngle = -legAngle;
  const bounce = Math.abs(Math.sin(f / 8 * Math.PI * 2)) * 3;

  const skin = athlete.skinTone;
  const kit = athlete.kitColor;
  const acc = athlete.kitAccent;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.ellipse(0, 38 - bounce, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // === LEGS ===
  // Back leg
  ctx.save();
  ctx.translate(0, 22 - bounce);
  ctx.rotate(-legAngle * 0.6);
  ctx.fillStyle = acc;
  ctx.fillRect(-4, 0, 8, 14);
  // shoe
  ctx.fillStyle = '#111';
  ctx.fillRect(-4, 12, 10, 4);
  ctx.restore();

  // Front leg
  ctx.save();
  ctx.translate(0, 22 - bounce);
  ctx.rotate(legAngle * 0.6);
  ctx.fillStyle = kit;
  ctx.fillRect(-4, 0, 8, 14);
  ctx.fillStyle = '#111';
  ctx.fillRect(-3, 12, 10, 4);
  ctx.restore();

  // === BODY ===
  ctx.fillStyle = kit;
  ctx.beginPath();
  ctx.roundRect(-9, 8 - bounce, 18, 16, 3);
  ctx.fill();

  // race number bib
  ctx.fillStyle = 'white';
  ctx.fillRect(-5, 10 - bounce, 10, 8);
  ctx.fillStyle = acc;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(athlete.id + 1, 0, 17 - bounce);

  // === ARMS ===
  // Back arm
  ctx.save();
  ctx.translate(-6, 12 - bounce);
  ctx.rotate(armAngle * 0.8 + 0.3);
  ctx.fillStyle = skin;
  ctx.fillRect(-3, 0, 5, 12);
  ctx.restore();

  // Front arm
  ctx.save();
  ctx.translate(6, 12 - bounce);
  ctx.rotate(-armAngle * 0.8 - 0.3);
  ctx.fillStyle = skin;
  ctx.fillRect(-2, 0, 5, 12);
  ctx.restore();

  // === HEAD ===
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, 2 - bounce, 8, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -1 - bounce, 7, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

// Draw static athlete standing
function drawAthleteStanding(ctx, athlete, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const skin = athlete.skinTone;
  const kit = athlete.kitColor;
  const acc = athlete.kitAccent;

  // Legs
  ctx.fillStyle = acc;
  ctx.fillRect(-8, 20, 6, 18);
  ctx.fillStyle = kit;
  ctx.fillRect(2, 20, 6, 18);
  // shoes
  ctx.fillStyle = '#111';
  ctx.fillRect(-9, 36, 8, 4);
  ctx.fillRect(1, 36, 8, 4);

  // Body
  ctx.fillStyle = kit;
  ctx.beginPath();
  ctx.roundRect(-10, 6, 20, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillRect(-5, 8, 10, 9);
  ctx.fillStyle = acc;
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(athlete.id + 1, 0, 16);

  // Arms
  ctx.fillStyle = skin;
  ctx.fillRect(-14, 8, 5, 14);
  ctx.fillRect(9, 8, 5, 14);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -5, 8, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

// Draw AI opponent
function drawOpponent(ctx, x, y, frame, color, skinTone, scale = 1) {
  const fakeAthlete = { skinTone, kitColor: color, kitAccent: color, id: 9 };
  drawAthlete(ctx, fakeAthlete, x, y, frame, true, scale);
}
