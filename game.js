const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

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

const world = {
  width: canvas.width,
  height: canvas.height,
};

const player = {
  x: world.width / 2,
  y: world.height / 2,
  speed: 230,
  radius: 16,
  color: '#21f0b6',
  health: 100,
  armor: 50,
  weapon: {
    fireRate: 8, // bullets per second
    bulletSpeed: 520,
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
let mouse = { x: world.width / 2, y: world.height / 2 };

function resetGame() {
  player.x = world.width / 2;
  player.y = world.height / 2;
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
    const margin = 30;
    let x, y;
    if (side === 0) {
      x = Math.random() * world.width;
      y = margin;
    } else if (side === 1) {
      x = Math.random() * world.width;
      y = world.height - margin;
    } else if (side === 2) {
      x = margin;
      y = Math.random() * world.height;
    } else {
      x = world.width - margin;
      y = Math.random() * world.height;
    }
    enemies.push(createEnemy(x, y));
  }
}

function createEnemy(x, y) {
  const baseSpeed = 80 + wave * 6;
  const baseHealth = 40 + wave * 8;
  return {
    x,
    y,
    radius: 14,
    health: baseHealth,
    speed: baseSpeed,
    color: '#ff4757',
    hitTimer: 0,
    damage: 14,
  };
}

function updateUI() {
  ui.health.textContent = Math.max(0, Math.round(player.health));
  ui.armor.textContent = Math.max(0, Math.round(player.armor));
  ui.ammo.textContent = '∞';
  ui.score.textContent = score;
  ui.wave.textContent = wave;
}

function normalize(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function handleInput(dt) {
  let dx = 0;
  let dy = 0;
  if (keys['KeyW'] || keys['ArrowUp'] || keys['KeyZ']) dy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
  if (keys['KeyA'] || keys['ArrowLeft'] || keys['KeyQ']) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

  if (dx !== 0 || dy !== 0) {
    [dx, dy] = normalize(dx, dy);
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
  }

  player.x = Math.max(player.radius, Math.min(world.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(world.height - player.radius, player.y));
}

function shoot(targetX, targetY) {
  if (player.dead) return;
  const secondsPerShot = 1 / player.weapon.fireRate;
  if (timeSinceLastShot < secondsPerShot) return;
  timeSinceLastShot = 0;

  const angle = Math.atan2(targetY - player.y, targetX - player.x) + (Math.random() - 0.5) * player.weapon.spread;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  bullets.push({
    x: player.x + dx * player.radius,
    y: player.y + dy * player.radius,
    vx: dx * player.weapon.bulletSpeed,
    vy: dy * player.weapon.bulletSpeed,
    life: player.weapon.bulletLifetime,
    damage: player.weapon.damage,
  });
}

function updateBullets(dt) {
  bullets = bullets.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height) return false;
    if (b.life <= 0) return false;

    for (const enemy of enemies) {
      const dist = Math.hypot(enemy.x - b.x, enemy.y - b.y);
      if (dist < enemy.radius + 4) {
        enemy.health -= b.damage;
        enemy.hitTimer = 0.15;
        return false;
      }
    }
    return true;
  });
}

function updateEnemies(dt) {
  enemies = enemies.filter((enemy) => {
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    const [dx, dy] = normalize(player.x - enemy.x, player.y - enemy.y);
    enemy.x += dx * enemy.speed * dt;
    enemy.y += dy * enemy.speed * dt;

    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
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

function drawPlayer() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  // body
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // visor
  ctx.fillStyle = '#0c1a24';
  ctx.beginPath();
  ctx.arc(10, -4, 6, -Math.PI / 2, Math.PI / 2);
  ctx.arc(10, 4, 6, Math.PI / 2, -Math.PI / 2);
  ctx.fill();

  // weapon
  ctx.fillStyle = '#13d8ff';
  ctx.fillRect(8, -4, 24, 8);
  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.hitTimer > 0 ? '#ffd166' : e.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // health bar
    const width = 30;
    const ratio = Math.max(0, e.health / (40 + wave * 8));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-width / 2, -e.radius - 10, width, 6);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(-width / 2, -e.radius - 10, width * ratio, 6);
    ctx.restore();
  }
}

function drawBullets() {
  ctx.fillStyle = '#f8f9fa';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUD() {
  // background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < world.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 0; y < world.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
}

function gameOver() {
  player.dead = true;
  ui.finalScore.textContent = `Score : ${score}`;
  ui.overlay.classList.remove('hidden');
}

function update(dt) {
  if (player.dead) return;
  handleInput(dt);
  updateBullets(dt);
  updateEnemies(dt);
  timeSinceLastShot += dt;
  if (player.health <= 0) {
    gameOver();
  }
  updateUI();
}

function render() {
  ctx.clearRect(0, 0, world.width, world.height);
  drawHUD();
  drawBullets();
  drawPlayer();
  drawEnemies();
}

function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000) || 0;
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  shoot(x, y);
});

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

ui.restart.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(loop);
