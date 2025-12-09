const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const width = 960;
const height = 600;
canvas.width = width;
canvas.height = height;

const ui = {
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  ammo: document.getElementById('ammo'),
  score: document.getElementById('score'),
  wave: document.getElementById('wave'),
  overlay: document.getElementById('overlay'),
  finalScore: document.getElementById('final-score'),
  restart: document.getElementById('restart'),
};

const world = { width: 320, height: 200 };

const player = {
  x: 0,
  z: 0,
  speed: 110,
  radius: 10,
  health: 100,
  armor: 50,
  color: '#21f0b6',
  weapon: {
    fireRate: 8,
    bulletSpeed: 220,
    bulletLifetime: 1.6,
    damage: 25,
    spread: 0.05,
  },
  dead: false,
};

let lastTime = 0;
let keys = {};
let bullets = [];
let enemies = [];
let score = 0;
let wave = 1;
let timeSinceLastShot = 0;
let mouse = { x: 0, y: 0 };
let aimPoint = { x: 0, z: 0 };

function resetGame() {
  player.x = 0;
  player.z = 0;
  player.health = 100;
  player.armor = 50;
  player.dead = false;
  bullets = [];
  enemies = [];
  score = 0;
  wave = 1;
  spawnWave();
  ui.overlay.classList.add('hidden');
}

function spawnWave() {
  const count = 4 + wave * 2;
  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);
    const marginX = world.width / 2 - 10;
    const marginZ = world.height / 2 - 10;
    let x, z;
    if (side === 0) {
      x = (Math.random() - 0.5) * world.width;
      z = -marginZ;
    } else if (side === 1) {
      x = (Math.random() - 0.5) * world.width;
      z = marginZ;
    } else if (side === 2) {
      x = -marginX;
      z = (Math.random() - 0.5) * world.height;
    } else {
      x = marginX;
      z = (Math.random() - 0.5) * world.height;
    }
    enemies.push(createEnemy(x, z));
  }
}

function createEnemy(x, z) {
  const baseSpeed = 40 + wave * 5;
  const baseHealth = 40 + wave * 8;
  return {
    x,
    z,
    radius: 10,
    health: baseHealth,
    speed: baseSpeed,
    color: '#ff4757',
    hitTimer: 0,
    damage: 18,
  };
}

function updateUI() {
  ui.health.textContent = Math.max(0, Math.round(player.health));
  ui.armor.textContent = Math.max(0, Math.round(player.armor));
  ui.ammo.textContent = '∞';
  ui.score.textContent = score;
  ui.wave.textContent = wave;
}

function normalize(dx, dz) {
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

function handleInput(dt) {
  let dx = 0;
  let dz = 0;
  if (keys['KeyW'] || keys['ArrowUp'] || keys['KeyZ']) dz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dz += 1;
  if (keys['KeyA'] || keys['ArrowLeft'] || keys['KeyQ']) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

  if (dx !== 0 || dz !== 0) {
    [dx, dz] = normalize(dx, dz);
    player.x += dx * player.speed * dt;
    player.z += dz * player.speed * dt;
  }

  const limitX = world.width / 2 - player.radius;
  const limitZ = world.height / 2 - player.radius;
  player.x = Math.max(-limitX, Math.min(limitX, player.x));
  player.z = Math.max(-limitZ, Math.min(limitZ, player.z));
}

function shoot(target) {
  if (player.dead) return;
  const secondsPerShot = 1 / player.weapon.fireRate;
  if (timeSinceLastShot < secondsPerShot) return;
  timeSinceLastShot = 0;

  const angle = Math.atan2(target.x - player.x, target.z - player.z) + (Math.random() - 0.5) * player.weapon.spread;
  const dir = { x: Math.sin(angle), z: Math.cos(angle) };
  bullets.push({
    x: player.x + dir.x * player.radius,
    z: player.z + dir.z * player.radius,
    vx: dir.x * player.weapon.bulletSpeed,
    vz: dir.z * player.weapon.bulletSpeed,
    life: player.weapon.bulletLifetime,
    damage: player.weapon.damage,
  });
}

function updateBullets(dt) {
  bullets = bullets.filter((b) => {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;

    if (Math.abs(b.x) > world.width / 2 || Math.abs(b.z) > world.height / 2) {
      return false;
    }
    if (b.life <= 0) {
      return false;
    }

    enemies = enemies.filter((enemy) => {
      const dist = Math.hypot(enemy.x - b.x, enemy.z - b.z);
      if (dist < enemy.radius + 3) {
        enemy.health -= b.damage;
        enemy.hitTimer = 0.25;
        return enemy.health > 0;
      }
      return true;
    });

    return true;
  });
}

function updateEnemies(dt) {
  enemies = enemies.filter((enemy) => {
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    const [dx, dz] = normalize(player.x - enemy.x, player.z - enemy.z);
    enemy.x += dx * enemy.speed * dt;
    enemy.z += dz * enemy.speed * dt;

    const dist = Math.hypot(enemy.x - player.x, enemy.z - player.z);
    if (dist < enemy.radius + player.radius) {
      const damage = enemy.damage * dt;
      if (player.armor > 0) {
        const absorbed = Math.min(player.armor, damage * 0.7);
        player.armor -= absorbed;
        player.health -= damage - absorbed;
      } else {
        player.health -= damage;
      }
    }

    if (enemy.health <= 0) {
      score += 10;
      return false;
    }

    return true;
  });

  if (enemies.length === 0) {
    wave += 1;
    spawnWave();
  }
}

function updateAimPoint() {
  const rect = canvas.getBoundingClientRect();
  const normX = ((mouse.x - rect.left) / rect.width) * 2 - 1;
  const normY = ((mouse.y - rect.top) / rect.height) * 2 - 1;
  aimPoint.x = normX * (world.width / 2);
  aimPoint.z = normY * (world.height / 2);
}

function gameOver() {
  player.dead = true;
  ui.finalScore.textContent = `Score : ${score}`;
  ui.overlay.classList.remove('hidden');
}

function update(dt) {
  if (player.dead) return;
  handleInput(dt);
  updateAimPoint();
  updateBullets(dt);
  updateEnemies(dt);
  timeSinceLastShot += dt;
  if (player.health <= 0) {
    gameOver();
  }
  updateUI();
}

function worldToScreen({ x, z }) {
  return {
    x: width / 2 + (x / (world.width / 2)) * (width / 2 - 20),
    y: height / 2 + (z / (world.height / 2)) * (height / 2 - 20),
  };
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0b1a27');
  gradient.addColorStop(1, '#051420');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  const stepX = width / 16;
  const stepY = height / 10;
  for (let i = 0; i <= 16; i++) {
    const x = i * stepX;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let j = 0; j <= 10; j++) {
    const y = j * stepY;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const screen = worldToScreen(player);
  const angle = Math.atan2(aimPoint.x - player.x, aimPoint.z - player.z);
  const size = 14;

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(-angle);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, size);
  ctx.lineTo(-size * 0.7, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    const screen = worldToScreen(enemy);
    const size = 14;
    ctx.save();
    ctx.translate(screen.x, screen.y);
    const baseColor = enemy.hitTimer > 0 ? '#ff6b81' : enemy.color;
    ctx.fillStyle = baseColor;
    ctx.shadowColor = 'rgba(255, 71, 87, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  });
}

function drawBullets() {
  ctx.fillStyle = '#f8f9fa';
  bullets.forEach((b) => {
    const screen = worldToScreen(b);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function render() {
  drawBackground();
  drawEnemies();
  drawPlayer();
  drawBullets();
}

function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000) || 0;
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function onMouseMove(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

function onClick() {
  shoot(aimPoint);
}

window.addEventListener('resize', () => {
  canvas.width = width;
  canvas.height = height;
});

canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mousedown', onClick);
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

ui.restart.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(loop);
