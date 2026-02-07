import { useEffect, useRef, useCallback } from 'react';
import { createGameState, updateGame, renderGame } from '../game/engine';
import { levels } from '../game/levels';
import type { MultiplayerManager, MultiplayerMessage } from '../game/multiplayer';
import type { GameState } from '../game/engine';

interface GameCanvasProps {
  currentLevel: number;
  playerName: string;
  playerColor: string;
  multiplayer: MultiplayerManager | null;
  onLevelComplete: () => void;
  onDeath: (deaths: number) => void;
}

export function GameCanvas({ currentLevel, playerName, playerColor, multiplayer, onLevelComplete, onDeath }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const levelCompleteTriggered = useRef(false);

  const initLevel = useCallback(() => {
    const level = levels[currentLevel];
    if (!level) return;
    gameStateRef.current = createGameState(level, playerName, playerColor);
    levelCompleteTriggered.current = false;
  }, [currentLevel, playerName, playerColor]);

  useEffect(() => {
    initLevel();
  }, [initLevel]);

  // Multiplayer message handler
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.onMessage = (msg: MultiplayerMessage) => {
      const state = gameStateRef.current;
      if (!state) return;

      switch (msg.type) {
        case 'playerUpdate':
          state.remotePlayers.set(msg.peerId, msg.player);
          break;
        case 'playerLeft':
          state.remotePlayers.delete(msg.peerId);
          break;
      }
    };

    return () => {
      multiplayer.onMessage = null;
    };
  }, [multiplayer]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let sendTimer = 0;

    const gameLoop = () => {
      const state = gameStateRef.current;
      if (!state) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      updateGame(state, canvas.width, canvas.height);
      renderGame(ctx, state, canvas.width, canvas.height);

      // Send player position to peers
      sendTimer++;
      if (multiplayer && sendTimer % 3 === 0) {
        multiplayer.sendPlayerUpdate(state.player);
      }

      // Death callback
      if (state.player.isDead) {
        onDeath(state.player.deaths);
      }

      // Win callback
      if (state.player.hasWon && !levelCompleteTriggered.current) {
        levelCompleteTriggered.current = true;
        setTimeout(() => {
          onLevelComplete();
        }, 500);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [multiplayer, onLevelComplete, onDeath]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (!state) return;

      state.keys.add(e.key.toLowerCase());

      if (e.key === 'Enter' && state.player.hasWon) {
        onLevelComplete();
      }

      if (e.key.toLowerCase() === 'r') {
        initLevel();
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (!state) return;
      state.keys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [initLevel, onLevelComplete]);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartX = 0;
    let touchActive = false;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const state = gameStateRef.current;
      if (!state) return;
      
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchActive = true;

      if (touch.clientY < canvas.height / 2) {
        state.keys.add(' ');
      }
      
      if (touch.clientX < canvas.width / 3) {
        state.keys.add('arrowleft');
      } else if (touch.clientX > canvas.width * 2 / 3) {
        state.keys.add('arrowright');
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const state = gameStateRef.current;
      if (!state || !touchActive) return;

      const touch = e.touches[0];
      state.keys.delete('arrowleft');
      state.keys.delete('arrowright');

      if (touch.clientX < touchStartX - 30) {
        state.keys.add('arrowleft');
      } else if (touch.clientX > touchStartX + 30) {
        state.keys.add('arrowright');
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const state = gameStateRef.current;
      if (!state) return;
      touchActive = false;
      state.keys.delete('arrowleft');
      state.keys.delete('arrowright');
      state.keys.delete(' ');
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block cursor-crosshair"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
