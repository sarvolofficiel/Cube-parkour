// Multiplayer System — Multi-transport approach
// 1. BroadcastChannel: instant between tabs of same browser (same mode: both normal or both private)
// 2. localStorage events: works between different browser windows  
// 3. Both together ensure maximum compatibility
//
// For cross-device play, players would need a WebSocket relay server.
// This implementation focuses on same-machine multiplayer (2 tabs/windows).

import { PlayerState } from './engine';

export interface RemotePlayerInfo {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

export type MultiplayerMessage =
  | { type: 'playerUpdate'; player: PlayerState; peerId: string }
  | { type: 'levelChange'; level: number; peerId: string }
  | { type: 'playerJoin'; peerId: string; name: string; color: string }
  | { type: 'playerLeft'; peerId: string }
  | { type: 'startGame'; level: number; peerId: string }
  | { type: 'heartbeat'; peerId: string; name: string; color: string };

type MessageHandler = (msg: MultiplayerMessage) => void;

export class MultiplayerManager {
  peerId: string;
  roomId: string;
  isHost: boolean;
  playerName: string;
  playerColor: string;
  remotePlayers: Map<string, RemotePlayerInfo> = new Map();

  onMessage: MessageHandler | null = null;
  onConnectionChange: ((count: number) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onStatusChange: ((status: string) => void) | null = null;
  onGameStart: ((level: number) => void) | null = null;
  onPlayerListChange: ((players: RemotePlayerInfo[]) => void) | null = null;

  private bcChannel: BroadcastChannel | null = null;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private seenMessageIds = new Set<string>();

  constructor(roomId: string, playerName: string, playerColor: string, isHost: boolean) {
    this.peerId = 'p-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    this.roomId = roomId;
    this.isHost = isHost;
    this.playerName = playerName;
    this.playerColor = playerColor;

    this.setupBroadcastChannel();
    this.setupStorageTransport();

    // Report connected immediately — the transport is ready
    setTimeout(() => {
      if (!this.destroyed) {
        this.onStatusChange?.('🟢 Salle prête ! En attente de joueurs...');
      }
    }, 100);

    // Send heartbeats every 400ms
    this.heartbeatInterval = setInterval(() => {
      if (this.destroyed) return;
      this.broadcast({
        type: 'heartbeat',
        peerId: this.peerId,
        name: this.playerName,
        color: this.playerColor,
      });
    }, 400);

    // Cleanup stale players every 2s
    this.cleanupInterval = setInterval(() => {
      if (this.destroyed) return;
      const now = Date.now();
      let changed = false;
      this.remotePlayers.forEach((player, id) => {
        if (now - player.lastSeen > 3000) {
          this.remotePlayers.delete(id);
          this.onStatusChange?.(`🔴 ${player.name} s'est déconnecté`);
          this.onMessage?.({ type: 'playerLeft', peerId: id });
          changed = true;
        }
      });
      if (changed) this.notifyConnectionChange();
    }, 2000);

    // Announce presence immediately and multiple times
    this.announceJoin();
    setTimeout(() => this.announceJoin(), 200);
    setTimeout(() => this.announceJoin(), 600);
    setTimeout(() => this.announceJoin(), 1200);
    setTimeout(() => this.announceJoin(), 2500);
  }

  // ====== BroadcastChannel Transport ======
  private setupBroadcastChannel() {
    try {
      this.bcChannel = new BroadcastChannel(`cuberunner-room-${this.roomId}`);
      this.bcChannel.onmessage = (event) => {
        if (this.destroyed) return;
        const msg = event.data as MultiplayerMessage & { _msgId?: string };
        // Deduplicate
        if (msg._msgId && this.seenMessageIds.has(msg._msgId)) return;
        if (msg._msgId) {
          this.seenMessageIds.add(msg._msgId);
          // Keep set small
          if (this.seenMessageIds.size > 200) {
            const arr = Array.from(this.seenMessageIds);
            this.seenMessageIds = new Set(arr.slice(-100));
          }
        }
        this.handleIncomingMessage(msg);
      };
    } catch {
      // BroadcastChannel not supported
    }
  }

  // ====== localStorage Transport ======
  private setupStorageTransport() {
    try {
      this.storageHandler = (e: StorageEvent) => {
        if (this.destroyed) return;
        if (!e.key || !e.key.startsWith(`cr-${this.roomId}-`)) return;
        if (!e.newValue) return;
        try {
          const wrapper = JSON.parse(e.newValue);
          if (wrapper.from === this.peerId) return;
          const msg = wrapper.data as MultiplayerMessage & { _msgId?: string };
          // Deduplicate
          if (msg._msgId && this.seenMessageIds.has(msg._msgId)) return;
          if (msg._msgId) {
            this.seenMessageIds.add(msg._msgId);
            if (this.seenMessageIds.size > 200) {
              const arr = Array.from(this.seenMessageIds);
              this.seenMessageIds = new Set(arr.slice(-100));
            }
          }
          this.handleIncomingMessage(msg);
        } catch { /* bad data */ }
      };
      window.addEventListener('storage', this.storageHandler);
    } catch {
      // localStorage not available
    }
  }

  private announceJoin() {
    if (this.destroyed) return;
    this.broadcast({
      type: 'playerJoin',
      peerId: this.peerId,
      name: this.playerName,
      color: this.playerColor,
    });
  }

  private handleIncomingMessage(msg: MultiplayerMessage) {
    if ('peerId' in msg && msg.peerId === this.peerId) return;

    switch (msg.type) {
      case 'heartbeat':
      case 'playerJoin': {
        const wasKnown = this.remotePlayers.has(msg.peerId);
        this.remotePlayers.set(msg.peerId, {
          id: msg.peerId,
          name: msg.name,
          color: msg.color,
          lastSeen: Date.now(),
        });
        if (!wasKnown) {
          this.onStatusChange?.(`🟢 ${msg.name} a rejoint la salle !`);
          this.notifyConnectionChange();
          // Reply with our own join so they discover us too
          if (msg.type === 'playerJoin') {
            setTimeout(() => this.announceJoin(), 50);
          }
        }
        break;
      }

      case 'playerUpdate': {
        const existing = this.remotePlayers.get(msg.peerId);
        if (existing) {
          existing.lastSeen = Date.now();
        } else {
          this.remotePlayers.set(msg.peerId, {
            id: msg.peerId,
            name: msg.player.name,
            color: msg.player.color,
            lastSeen: Date.now(),
          });
          this.notifyConnectionChange();
        }
        this.onMessage?.(msg);
        break;
      }

      case 'startGame': {
        this.onGameStart?.(msg.level);
        break;
      }

      case 'playerLeft': {
        const leaving = this.remotePlayers.get(msg.peerId);
        if (leaving) {
          this.onStatusChange?.(`🔴 ${leaving.name} a quitté`);
        }
        this.remotePlayers.delete(msg.peerId);
        this.notifyConnectionChange();
        this.onMessage?.(msg);
        break;
      }

      case 'levelChange': {
        this.onMessage?.(msg);
        break;
      }
    }
  }

  private notifyConnectionChange() {
    const count = this.remotePlayers.size;
    this.onConnectionChange?.(count);
    this.onPlayerListChange?.(Array.from(this.remotePlayers.values()));
  }

  private broadcast(msg: MultiplayerMessage) {
    if (this.destroyed) return;

    // Add message ID for deduplication
    const msgWithId = { ...msg, _msgId: this.peerId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) };

    // Send via BroadcastChannel
    if (this.bcChannel) {
      try {
        this.bcChannel.postMessage(msgWithId);
      } catch { /* closed */ }
    }

    // Send via localStorage (for cross-window communication)
    try {
      const key = `cr-${this.roomId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem(key, JSON.stringify({
        from: this.peerId,
        data: msgWithId,
      }));
      // Clean up after a short delay
      setTimeout(() => {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }, 600);
    } catch { /* not available */ }
  }

  sendPlayerUpdate(player: PlayerState) {
    this.broadcast({
      type: 'playerUpdate',
      player: {
        x: player.x,
        y: player.y,
        vx: player.vx,
        vy: player.vy,
        width: player.width,
        height: player.height,
        onGround: player.onGround,
        color: player.color,
        name: player.name,
        isDead: player.isDead,
        hasWon: player.hasWon,
        deaths: player.deaths,
      },
      peerId: this.peerId,
    });
  }

  sendLevelChange(level: number) {
    this.broadcast({
      type: 'levelChange',
      level,
      peerId: this.peerId,
    });
  }

  startGame(level: number) {
    this.broadcast({
      type: 'startGame',
      level,
      peerId: this.peerId,
    });
  }

  getConnectedCount(): number {
    return this.remotePlayers.size;
  }

  getPlayerList(): RemotePlayerInfo[] {
    return Array.from(this.remotePlayers.values());
  }

  destroy() {
    this.destroyed = true;

    // Announce departure
    this.broadcast({ type: 'playerLeft', peerId: this.peerId });

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    if (this.bcChannel) {
      try { this.bcChannel.close(); } catch { /* ignore */ }
    }

    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
    }

    // Clean up any localStorage entries for our room
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`cr-${this.roomId}-`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }

    this.remotePlayers.clear();
  }

  static generateRoomLink(roomId: string): string {
    const url = new URL(window.location.href.split('#')[0]);
    url.hash = `room=${roomId}`;
    return url.toString();
  }

  static getRoomIdFromURL(): string | null {
    const hash = window.location.hash;
    const match = hash.match(/room=([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  static generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}
