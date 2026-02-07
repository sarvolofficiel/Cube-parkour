import { LevelData, Platform } from './levels';

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  color: string;
  name: string;
  isDead: boolean;
  hasWon: boolean;
  deaths: number;
}

export interface GameState {
  player: PlayerState;
  remotePlayers: Map<string, PlayerState>;
  level: LevelData;
  camera: { x: number; y: number };
  keys: Set<string>;
  time: number;
  particles: Particle[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const MOVE_SPEED = 5;
const FRICTION = 0.85;
const PLAYER_SIZE = 30;

export function createPlayer(level: LevelData, name: string, color: string): PlayerState {
  return {
    x: level.playerStart.x,
    y: level.playerStart.y,
    vx: 0,
    vy: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    onGround: false,
    color,
    name,
    isDead: false,
    hasWon: false,
    deaths: 0,
  };
}

export function createGameState(level: LevelData, name: string, color: string): GameState {
  return {
    player: createPlayer(level, name, color),
    remotePlayers: new Map(),
    level,
    camera: { x: 0, y: 0 },
    keys: new Set(),
    time: 0,
    particles: [],
  };
}

function getPlatformPosition(platform: Platform, time: number): { x: number; y: number } {
  if (!platform.moving) return { x: platform.x, y: platform.y };
  const offset = Math.sin(time * platform.moving.speed * 0.02) * platform.moving.range;
  if (platform.moving.axis === 'x') {
    return { x: platform.x + offset, y: platform.y };
  }
  return { x: platform.x, y: platform.y + offset };
}

function spawnParticles(state: GameState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

function rectCollision(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function updateGame(state: GameState, canvasWidth: number, canvasHeight: number): void {
  state.time++;
  const { player, level, keys } = state;

  if (player.isDead) {
    player.isDead = false;
    player.x = level.playerStart.x;
    player.y = level.playerStart.y;
    player.vx = 0;
    player.vy = 0;
    return;
  }

  if (player.hasWon) return;

  // Input
  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('q')) {
    player.vx -= MOVE_SPEED * 0.3;
  }
  if (keys.has('ArrowRight') || keys.has('d')) {
    player.vx += MOVE_SPEED * 0.3;
  }
  if ((keys.has('ArrowUp') || keys.has('w') || keys.has('z') || keys.has(' ')) && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    spawnParticles(state, player.x + player.width / 2, player.y + player.height, '#fff', 5);
  }

  // Physics
  player.vx *= FRICTION;
  player.vy += GRAVITY;

  // Clamp velocity
  if (Math.abs(player.vx) < 0.1) player.vx = 0;
  if (player.vy > 15) player.vy = 15;

  // Move X
  player.x += player.vx;
  player.onGround = false;

  // Platform collision X
  for (const plat of level.platforms) {
    const pos = getPlatformPosition(plat, state.time);
    if (rectCollision(player.x, player.y, player.width, player.height, pos.x, pos.y, plat.w, plat.h)) {
      if (player.vx > 0) {
        player.x = pos.x - player.width;
      } else if (player.vx < 0) {
        player.x = pos.x + plat.w;
      }
      player.vx = 0;
    }
  }

  // Move Y
  player.y += player.vy;

  // Platform collision Y
  for (const plat of level.platforms) {
    const pos = getPlatformPosition(plat, state.time);
    if (rectCollision(player.x, player.y, player.width, player.height, pos.x, pos.y, plat.w, plat.h)) {
      if (player.vy > 0) {
        player.y = pos.y - player.height;
        player.vy = 0;
        player.onGround = true;

        // Moving platform carry
        if (plat.moving && plat.moving.axis === 'x') {
          const nextOffset = Math.sin((state.time + 1) * plat.moving.speed * 0.02) * plat.moving.range;
          const currOffset = Math.sin(state.time * plat.moving.speed * 0.02) * plat.moving.range;
          player.x += nextOffset - currOffset;
        }
      } else if (player.vy < 0) {
        player.y = pos.y + plat.h;
        player.vy = 0;
      }
    }
  }

  // Spike collision
  for (const spike of level.spikes) {
    if (rectCollision(player.x, player.y, player.width, player.height, spike.x, spike.y, spike.w, spike.h)) {
      player.isDead = true;
      player.deaths++;
      spawnParticles(state, player.x + player.width / 2, player.y + player.height / 2, '#ff0000', 15);
      return;
    }
  }

  // Bounce pad collision
  for (const pad of level.bouncePads) {
    if (rectCollision(player.x, player.y, player.width, player.height, pad.x, pad.y, pad.w, pad.h)) {
      player.vy = pad.force;
      player.onGround = false;
      spawnParticles(state, player.x + player.width / 2, player.y + player.height, '#ffff00', 8);
    }
  }

  // Goal collision
  if (rectCollision(player.x, player.y, player.width, player.height, level.goal.x, level.goal.y, level.goal.w, level.goal.h)) {
    player.hasWon = true;
    spawnParticles(state, level.goal.x + level.goal.w / 2, level.goal.y + level.goal.h / 2, '#00ff00', 30);
  }

  // Fall off screen
  if (player.y > level.height + 100) {
    player.isDead = true;
    player.deaths++;
  }

  // Left boundary
  if (player.x < 0) player.x = 0;

  // Camera
  const targetCamX = player.x - canvasWidth / 2 + player.width / 2;
  const targetCamY = player.y - canvasHeight / 2 + player.height / 2;
  state.camera.x += (targetCamX - state.camera.x) * 0.1;
  state.camera.y += (targetCamY - state.camera.y) * 0.1;

  // Clamp camera
  state.camera.x = Math.max(0, Math.min(level.width - canvasWidth, state.camera.x));
  state.camera.y = Math.max(0, Math.min(level.height - canvasHeight, state.camera.y));

  // Update particles
  state.particles = state.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life--;
    return p.life > 0;
  });
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number, canvasHeight: number): void {
  const { player, level, camera, time } = state;

  // Background
  ctx.fillStyle = level.bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Stars background
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 50; i++) {
    const sx = ((i * 137 + 50) % canvasWidth + Math.sin(time * 0.005 + i) * 2);
    const sy = ((i * 97 + 30) % canvasHeight);
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridSize = 50;
  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const startY = Math.floor(camera.y / gridSize) * gridSize;
  for (let x = startX; x < camera.x + canvasWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, camera.y);
    ctx.lineTo(x, camera.y + canvasHeight);
    ctx.stroke();
  }
  for (let y = startY; y < camera.y + canvasHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(camera.x, y);
    ctx.lineTo(camera.x + canvasWidth, y);
    ctx.stroke();
  }

  // Platforms
  for (const plat of level.platforms) {
    const pos = getPlatformPosition(plat, time);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(pos.x + 3, pos.y + 3, plat.w, plat.h);
    
    // Main platform
    const gradient = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + plat.h);
    gradient.addColorStop(0, level.platformColor);
    gradient.addColorStop(1, shadeColor(level.platformColor, -30));
    ctx.fillStyle = gradient;
    ctx.fillRect(pos.x, pos.y, plat.w, plat.h);
    
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(pos.x, pos.y, plat.w, 3);

    // Moving indicator
    if (plat.moving) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(pos.x + plat.w / 2 - 5, pos.y + plat.h / 2 - 2, 10, 4);
    }
  }

  // Spikes
  for (const spike of level.spikes) {
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    const spCount = Math.floor(spike.w / 15);
    for (let i = 0; i < spCount; i++) {
      const sx = spike.x + i * (spike.w / spCount);
      const sw = spike.w / spCount;
      ctx.moveTo(sx, spike.y + spike.h);
      ctx.lineTo(sx + sw / 2, spike.y);
      ctx.lineTo(sx + sw, spike.y + spike.h);
    }
    ctx.fill();
    
    // Glow
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Bounce pads
  for (const pad of level.bouncePads) {
    const bounce = Math.sin(time * 0.1) * 2;
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(pad.x, pad.y + bounce, pad.w, pad.h - bounce);
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(pad.x + 2, pad.y + bounce + 2, pad.w - 4, 3);
    
    // Spring lines
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    const midX = pad.x + pad.w / 2;
    ctx.beginPath();
    ctx.moveTo(midX, pad.y + pad.h);
    ctx.lineTo(midX - 5, pad.y + pad.h + 5);
    ctx.lineTo(midX + 5, pad.y + pad.h + 10);
    ctx.lineTo(midX - 5, pad.y + pad.h + 15);
    ctx.stroke();
  }

  // Goal
  const goalPulse = Math.sin(time * 0.05) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(0, 255, 100, ${goalPulse})`;
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  ctx.strokeStyle = '#00ff64';
  ctx.lineWidth = 2;
  ctx.strokeRect(level.goal.x - 2, level.goal.y - 2, level.goal.w + 4, level.goal.h + 4);
  
  // Goal glow
  ctx.shadowColor = '#00ff64';
  ctx.shadowBlur = 20;
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  ctx.shadowBlur = 0;

  // Portal effect
  ctx.strokeStyle = `rgba(0, 255, 100, ${goalPulse * 0.5})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const s = 1 + i * 0.2 + Math.sin(time * 0.03 + i) * 0.1;
    ctx.strokeRect(
      level.goal.x + level.goal.w / 2 - (level.goal.w * s) / 2,
      level.goal.y + level.goal.h / 2 - (level.goal.h * s) / 2,
      level.goal.w * s,
      level.goal.h * s
    );
  }

  // Remote players
  state.remotePlayers.forEach((rp) => {
    if (rp.isDead) return;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(rp.x + 2, rp.y + 2, rp.width, rp.height);
    // Body
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = rp.color;
    ctx.fillRect(rp.x, rp.y, rp.width, rp.height);
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(rp.x + 6, rp.y + 8, 6, 6);
    ctx.fillRect(rp.x + 18, rp.y + 8, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(rp.x + 8, rp.y + 10, 3, 3);
    ctx.fillRect(rp.x + 20, rp.y + 10, 3, 3);
    ctx.globalAlpha = 1;
    // Name
    ctx.fillStyle = rp.color;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(rp.name, rp.x + rp.width / 2, rp.y - 5);
  });

  // Local player
  if (!player.isDead) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(player.x + 3, player.y + 3, player.width, player.height);
    
    // Body with gradient
    const pGrad = ctx.createLinearGradient(player.x, player.y, player.x + player.width, player.y + player.height);
    pGrad.addColorStop(0, player.color);
    pGrad.addColorStop(1, shadeColor(player.color, -20));
    ctx.fillStyle = pGrad;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(player.x, player.y, player.width, player.height / 3);
    
    // Eyes
    const eyeDir = player.vx > 0.5 ? 2 : player.vx < -0.5 ? -2 : 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 5, player.y + 8, 8, 8);
    ctx.fillRect(player.x + 17, player.y + 8, 8, 8);
    ctx.fillStyle = '#111';
    ctx.fillRect(player.x + 8 + eyeDir, player.y + 11, 4, 4);
    ctx.fillRect(player.x + 20 + eyeDir, player.y + 11, 4, 4);
    
    // Name above
    ctx.fillStyle = player.color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, player.x + player.width / 2, player.y - 8);
  }

  // Particles
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvasWidth, 45);
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(level.name, 10, 20);
  
  ctx.font = '12px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(level.description, 10, 38);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff6666';
  ctx.fillText(`💀 Morts: ${player.deaths}`, canvasWidth - 10, 20);

  const onlinePlayers = state.remotePlayers.size + 1;
  ctx.fillStyle = '#66ff66';
  ctx.fillText(`👥 Joueurs: ${onlinePlayers}`, canvasWidth - 10, 38);

  // Win overlay
  if (player.hasWon) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.fillStyle = '#00ff64';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 NIVEAU TERMINÉ !', canvasWidth / 2, canvasHeight / 2 - 30);
    
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText(`Morts: ${player.deaths}`, canvasWidth / 2, canvasHeight / 2 + 20);
    ctx.fillText('Appuyez sur ENTRÉE pour continuer', canvasWidth / 2, canvasHeight / 2 + 60);
  }
}

function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
