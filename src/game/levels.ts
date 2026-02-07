// Each level is a grid-based map
// 0 = empty, 1 = platform, 2 = spike/danger, 3 = goal, 4 = moving platform, 5 = bounce pad

export interface LevelData {
  name: string;
  description: string;
  platforms: Platform[];
  spikes: Spike[];
  bouncePads: BouncePad[];
  goal: { x: number; y: number; w: number; h: number };
  playerStart: { x: number; y: number };
  bgColor: string;
  platformColor: string;
  width: number;
  height: number;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  moving?: { axis: 'x' | 'y'; range: number; speed: number };
}

export interface Spike {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BouncePad {
  x: number;
  y: number;
  w: number;
  h: number;
  force: number;
}

export const levels: LevelData[] = [
  // Level 1 - Tutorial: Simple platforms
  {
    name: "Niveau 1 - Premiers Pas",
    description: "Apprenez à sauter ! Atteignez le portail vert.",
    width: 1200,
    height: 600,
    bgColor: "#1a1a2e",
    platformColor: "#4a9eff",
    playerStart: { x: 50, y: 400 },
    platforms: [
      { x: 0, y: 520, w: 300, h: 80 },
      { x: 350, y: 480, w: 150, h: 20 },
      { x: 550, y: 430, w: 150, h: 20 },
      { x: 750, y: 380, w: 150, h: 20 },
      { x: 950, y: 430, w: 250, h: 80 },
    ],
    spikes: [],
    bouncePads: [],
    goal: { x: 1100, y: 370, w: 40, h: 60 },
  },
  // Level 2 - Spikes introduced
  {
    name: "Niveau 2 - Attention aux Piques",
    description: "Évitez les piques rouges !",
    width: 1400,
    height: 600,
    bgColor: "#16213e",
    platformColor: "#e94560",
    playerStart: { x: 50, y: 400 },
    platforms: [
      { x: 0, y: 520, w: 200, h: 80 },
      { x: 280, y: 470, w: 120, h: 20 },
      { x: 480, y: 420, w: 200, h: 20 },
      { x: 760, y: 470, w: 120, h: 20 },
      { x: 960, y: 420, w: 120, h: 20 },
      { x: 1150, y: 470, w: 250, h: 80 },
    ],
    spikes: [
      { x: 500, y: 400, w: 40, h: 20 },
      { x: 560, y: 400, w: 40, h: 20 },
      { x: 620, y: 400, w: 40, h: 20 },
    ],
    bouncePads: [],
    goal: { x: 1300, y: 410, w: 40, h: 60 },
  },
  // Level 3 - Moving platforms
  {
    name: "Niveau 3 - Plateformes Mouvantes",
    description: "Les plateformes bougent ! Timing est la clé.",
    width: 1600,
    height: 600,
    bgColor: "#0f3460",
    platformColor: "#e94560",
    playerStart: { x: 50, y: 400 },
    platforms: [
      { x: 0, y: 520, w: 200, h: 80 },
      { x: 300, y: 450, w: 100, h: 20, moving: { axis: 'y', range: 100, speed: 1.5 } },
      { x: 500, y: 400, w: 100, h: 20, moving: { axis: 'x', range: 120, speed: 1 } },
      { x: 750, y: 350, w: 100, h: 20, moving: { axis: 'y', range: 80, speed: 2 } },
      { x: 950, y: 400, w: 100, h: 20, moving: { axis: 'x', range: 100, speed: 1.5 } },
      { x: 1200, y: 450, w: 100, h: 20 },
      { x: 1350, y: 470, w: 250, h: 80 },
    ],
    spikes: [
      { x: 1200, y: 430, w: 100, h: 20 },
    ],
    bouncePads: [],
    goal: { x: 1500, y: 410, w: 40, h: 60 },
  },
  // Level 4 - Bounce pads
  {
    name: "Niveau 4 - Trampolines",
    description: "Utilisez les trampolines jaunes pour sauter plus haut !",
    width: 1600,
    height: 700,
    bgColor: "#1b1b2f",
    platformColor: "#1faaff",
    playerStart: { x: 50, y: 500 },
    platforms: [
      { x: 0, y: 600, w: 200, h: 100 },
      { x: 350, y: 600, w: 100, h: 100 },
      { x: 600, y: 350, w: 150, h: 20 },
      { x: 850, y: 600, w: 100, h: 100 },
      { x: 1050, y: 250, w: 150, h: 20 },
      { x: 1300, y: 500, w: 300, h: 100 },
    ],
    spikes: [
      { x: 200, y: 580, w: 150, h: 20 },
      { x: 500, y: 580, w: 100, h: 20 },
    ],
    bouncePads: [
      { x: 370, y: 580, w: 60, h: 20, force: -18 },
      { x: 870, y: 580, w: 60, h: 20, force: -22 },
    ],
    goal: { x: 1500, y: 440, w: 40, h: 60 },
  },
  // Level 5 - Combination challenge
  {
    name: "Niveau 5 - Le Défi",
    description: "Tout combiné ! Plateformes, piques, trampolines.",
    width: 2000,
    height: 700,
    bgColor: "#162447",
    platformColor: "#e43f5a",
    playerStart: { x: 50, y: 500 },
    platforms: [
      { x: 0, y: 600, w: 150, h: 100 },
      { x: 250, y: 550, w: 80, h: 20, moving: { axis: 'y', range: 80, speed: 1.5 } },
      { x: 420, y: 500, w: 100, h: 20 },
      { x: 600, y: 600, w: 80, h: 100 },
      { x: 800, y: 450, w: 100, h: 20, moving: { axis: 'x', range: 100, speed: 2 } },
      { x: 1050, y: 400, w: 100, h: 20 },
      { x: 1250, y: 500, w: 80, h: 20, moving: { axis: 'y', range: 120, speed: 1 } },
      { x: 1450, y: 350, w: 100, h: 20 },
      { x: 1650, y: 500, w: 350, h: 100 },
    ],
    spikes: [
      { x: 430, y: 480, w: 30, h: 20 },
      { x: 470, y: 480, w: 30, h: 20 },
      { x: 1060, y: 380, w: 30, h: 20 },
      { x: 1650, y: 480, w: 60, h: 20 },
    ],
    bouncePads: [
      { x: 610, y: 580, w: 60, h: 20, force: -20 },
      { x: 1460, y: 330, w: 60, h: 20, force: -16 },
    ],
    goal: { x: 1900, y: 440, w: 40, h: 60 },
  },
  // Level 6 - Final Boss Level
  {
    name: "Niveau 6 - Le Final",
    description: "Le niveau ultime ! Bonne chance !",
    width: 2400,
    height: 800,
    bgColor: "#0d0d0d",
    platformColor: "#ff6b35",
    playerStart: { x: 50, y: 600 },
    platforms: [
      { x: 0, y: 700, w: 150, h: 100 },
      { x: 220, y: 650, w: 80, h: 20, moving: { axis: 'y', range: 100, speed: 2 } },
      { x: 400, y: 600, w: 60, h: 20, moving: { axis: 'x', range: 80, speed: 2.5 } },
      { x: 580, y: 700, w: 60, h: 100 },
      { x: 720, y: 550, w: 80, h: 20, moving: { axis: 'y', range: 150, speed: 1.5 } },
      { x: 900, y: 500, w: 60, h: 20 },
      { x: 1050, y: 450, w: 80, h: 20, moving: { axis: 'x', range: 120, speed: 2 } },
      { x: 1250, y: 700, w: 80, h: 100 },
      { x: 1400, y: 400, w: 60, h: 20, moving: { axis: 'y', range: 100, speed: 3 } },
      { x: 1580, y: 350, w: 100, h: 20 },
      { x: 1780, y: 450, w: 80, h: 20, moving: { axis: 'x', range: 100, speed: 2 } },
      { x: 1980, y: 350, w: 60, h: 20, moving: { axis: 'y', range: 80, speed: 2.5 } },
      { x: 2150, y: 600, w: 250, h: 100 },
    ],
    spikes: [
      { x: 580, y: 680, w: 60, h: 20 },
      { x: 910, y: 480, w: 40, h: 20 },
      { x: 1250, y: 680, w: 80, h: 20 },
      { x: 1590, y: 330, w: 40, h: 20 },
      { x: 1630, y: 330, w: 40, h: 20 },
      { x: 2150, y: 580, w: 50, h: 20 },
      { x: 2300, y: 580, w: 50, h: 20 },
    ],
    bouncePads: [
      { x: 590, y: 680, w: 40, h: 20, force: -22 },
      { x: 1260, y: 680, w: 60, h: 20, force: -24 },
    ],
    goal: { x: 2250, y: 540, w: 40, h: 60 },
  },
];
