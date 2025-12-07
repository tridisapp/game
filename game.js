const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(960, 600);
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#060c15');

const camera = new THREE.PerspectiveCamera(60, 960 / 600, 0.1, 1000);
camera.position.set(0, 220, 260);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0x88aaff, 0.5);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(-80, 120, 80);
scene.add(dirLight);

const grid = new THREE.GridHelper(320, 16, 0x13d8ff, 0x0a2236);
grid.position.y = 0.01;
scene.add(grid);

const floorGeo = new THREE.PlaneGeometry(320, 200);
const floorMat = new THREE.MeshStandardMaterial({
  color: '#0b1f2e',
  metalness: 0.1,
  roughness: 0.8,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

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

const playerGeo = new THREE.CylinderGeometry(8, 8, 16, 12);
const playerMat = new THREE.MeshStandardMaterial({ color: '#21f0b6', emissive: '#082b2d' });
const playerMesh = new THREE.Mesh(playerGeo, playerMat);
playerMesh.castShadow = true;
playerMesh.receiveShadow = true;
scene.add(playerMesh);

const player = {
  x: 0,
  z: 0,
  y: 8,
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
let mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let aimPoint = new THREE.Vector3(0, 0, 0);

function resetGame() {
  player.x = 0;
  player.z = 0;
  player.health = 100;
  player.armor = 50;
  player.dead = false;
  bullets.forEach((b) => scene.remove(b.mesh));
  enemies.forEach((e) => scene.remove(e.mesh));
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
  const geo = new THREE.BoxGeometry(14, 14, 14);
  const mat = new THREE.MeshStandardMaterial({ color: '#ff4757', emissive: '#2e0b0d' });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 7, z);
  scene.add(mesh);
  return {
    x,
    z,
    y: 7,
    radius: 10,
    health: baseHealth,
    speed: baseSpeed,
    color: '#ff4757',
    hitTimer: 0,
    damage: 18,
    mesh,
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
  const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 10, 10),
    new THREE.MeshStandardMaterial({ color: '#f8f9fa', emissive: '#4fd1c5' })
  );
  mesh.position.set(player.x + dir.x * player.radius, player.y, player.z + dir.z * player.radius);
  scene.add(mesh);
  bullets.push({
    x: mesh.position.x,
    z: mesh.position.z,
    y: player.y,
    vx: dir.x * player.weapon.bulletSpeed,
    vz: dir.z * player.weapon.bulletSpeed,
    life: player.weapon.bulletLifetime,
    damage: player.weapon.damage,
    mesh,
  });
}

function updateBullets(dt) {
  bullets = bullets.filter((b) => {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    b.mesh.position.set(b.x, b.y, b.z);

    if (Math.abs(b.x) > world.width / 2 || Math.abs(b.z) > world.height / 2) {
      scene.remove(b.mesh);
      return false;
    }
    if (b.life <= 0) {
      scene.remove(b.mesh);
      return false;
    }

    for (const enemy of enemies) {
      const dist = Math.hypot(enemy.x - b.x, enemy.z - b.z);
      if (dist < enemy.radius + 4) {
        enemy.health -= b.damage;
        enemy.hitTimer = 0.15;
        scene.remove(b.mesh);
        return false;
      }
    }
    return true;
  });
}

function updateEnemies(dt) {
  enemies = enemies.filter((enemy) => {
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    const [dx, dz] = normalize(player.x - enemy.x, player.z - enemy.z);
    enemy.x += dx * enemy.speed * dt;
    enemy.z += dz * enemy.speed * dt;
    enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);

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
      scene.remove(enemy.mesh);
      return false;
    }

    const emissiveStrength = enemy.hitTimer > 0 ? 0.6 : 0.15;
    enemy.mesh.material.emissiveIntensity = emissiveStrength;
    return true;
  });

  if (enemies.length === 0) {
    wave += 1;
    spawnWave();
  }
}

function updateAimPoint() {
  raycaster.setFromCamera(mouse, camera);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersection);
  aimPoint.copy(intersection);
}

function updatePlayerMesh() {
  playerMesh.position.set(player.x, player.y, player.z);
  const lookTarget = new THREE.Vector3(aimPoint.x, player.y, aimPoint.z);
  playerMesh.lookAt(lookTarget);
}

function updateCamera() {
  const desiredPos = new THREE.Vector3(player.x, 200, player.z + 220);
  camera.position.lerp(desiredPos, 0.08);
  camera.lookAt(new THREE.Vector3(player.x, 0, player.z));
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
  updateAimPoint();
  updatePlayerMesh();
  updateCamera();
  timeSinceLastShot += dt;
  if (player.health <= 0) {
    gameOver();
  }
  updateUI();
}

function render() {
  renderer.render(scene, camera);
}

function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000) || 0;
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function onClick() {
  shoot(aimPoint);
}

window.addEventListener('resize', () => {
  const width = 960;
  const height = 600;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
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
