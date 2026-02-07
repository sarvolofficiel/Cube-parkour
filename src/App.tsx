import { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MultiplayerManager, RemotePlayerInfo } from './game/multiplayer';
import { levels } from './game/levels';

type Screen = 'menu' | 'lobby' | 'game' | 'gameover';

const PLAYER_COLORS = [
  '#ff4444', '#44aaff', '#44ff44', '#ffaa00',
  '#ff44ff', '#44ffff', '#ff8844', '#aa44ff',
];

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('cuberunner_name') || '';
  });
  const [playerColor, setPlayerColor] = useState(() => {
    return localStorage.getItem('cuberunner_color') || PLAYER_COLORS[0];
  });
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalDeaths, setTotalDeaths] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [roomLink, setRoomLink] = useState('');
  const [playerList, setPlayerList] = useState<RemotePlayerInfo[]>([]);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [urlRoomId] = useState(() => MultiplayerManager.getRoomIdFromURL());

  const multiplayerRef = useRef<MultiplayerManager | null>(null);

  // Save name/color
  useEffect(() => {
    if (playerName) localStorage.setItem('cuberunner_name', playerName);
    if (playerColor) localStorage.setItem('cuberunner_color', playerColor);
  }, [playerName, playerColor]);

  const cleanupMultiplayer = useCallback(() => {
    if (multiplayerRef.current) {
      multiplayerRef.current.destroy();
      multiplayerRef.current = null;
    }
    setConnectedPeers(0);
    setStatusMsg('');
    setPlayerList([]);
    setRoomId('');
    setRoomLink('');
    setIsHost(false);
  }, []);

  const setupMultiplayerCallbacks = useCallback((mp: MultiplayerManager) => {
    mp.onConnectionChange = (count) => {
      setConnectedPeers(count);
    };
    mp.onError = (error) => {
      setStatusMsg(`❌ ${error}`);
    };
    mp.onStatusChange = (status) => {
      setStatusMsg(status);
    };
    mp.onPlayerListChange = (players) => {
      setPlayerList([...players]);
    };
    mp.onGameStart = (level) => {
      setCurrentLevel(level);
      setTotalDeaths(0);
      setScreen('game');
    };
  }, []);

  // ======== CREATE ROOM (HOST) ========
  const handleCreateRoom = useCallback(() => {
    if (!playerName.trim()) return;
    cleanupMultiplayer();

    const newRoomId = MultiplayerManager.generateRoomId();
    const link = MultiplayerManager.generateRoomLink(newRoomId);

    const mp = new MultiplayerManager(newRoomId, playerName, playerColor, true);
    multiplayerRef.current = mp;
    setupMultiplayerCallbacks(mp);

    setRoomId(newRoomId);
    setRoomLink(link);
    setIsHost(true);
    setScreen('lobby');
    setStatusMsg('🔄 Connexion au serveur...');
  }, [playerName, playerColor, cleanupMultiplayer, setupMultiplayerCallbacks]);

  // ======== JOIN ROOM ========
  const handleJoinRoom = useCallback((inputRoomId?: string) => {
    if (!playerName.trim()) return;
    const rid = (inputRoomId || joinRoomInput.trim()).toUpperCase();
    if (!rid) return;

    // Extract room ID from a pasted link
    let finalRoomId = rid;
    const hashMatch = rid.match(/room=([a-zA-Z0-9-]+)/i);
    if (hashMatch) {
      finalRoomId = hashMatch[1].toUpperCase();
    }

    cleanupMultiplayer();

    const mp = new MultiplayerManager(finalRoomId, playerName, playerColor, false);
    multiplayerRef.current = mp;
    setupMultiplayerCallbacks(mp);

    setRoomId(finalRoomId);
    setRoomLink(MultiplayerManager.generateRoomLink(finalRoomId));
    setIsHost(false);
    setScreen('lobby');
    setStatusMsg('🔄 Connexion au serveur...');

    // Clear the URL hash
    window.history.replaceState(null, '', window.location.pathname);
  }, [playerName, playerColor, joinRoomInput, cleanupMultiplayer, setupMultiplayerCallbacks]);

  const handlePlaySolo = () => {
    cleanupMultiplayer();
    setCurrentLevel(0);
    setTotalDeaths(0);
    setScreen('game');
  };

  const handleStartMultiplayerGame = () => {
    setCurrentLevel(0);
    setTotalDeaths(0);
    setScreen('game');
    if (multiplayerRef.current) {
      multiplayerRef.current.startGame(0);
    }
  };

  const handleLevelComplete = useCallback(() => {
    if (currentLevel < levels.length - 1) {
      setCurrentLevel(prev => prev + 1);
      if (multiplayerRef.current) {
        multiplayerRef.current.sendLevelChange(currentLevel + 1);
      }
    } else {
      setScreen('gameover');
    }
  }, [currentLevel]);

  const handleDeath = useCallback((deaths: number) => {
    setTotalDeaths(deaths);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (multiplayerRef.current) {
        multiplayerRef.current.destroy();
      }
    };
  }, []);

  // ============================
  // MENU SCREEN
  // ============================
  if (screen === 'menu') {
    const hasAutoJoin = !!urlRoomId;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg mx-auto shadow-lg shadow-cyan-500/30 flex items-center justify-center animate-bounce border-2 border-cyan-300">
                <div className="w-10 h-10 bg-white/30 rounded-sm" />
              </div>
            </div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 mb-2">
              CUBE RUNNER
            </h1>
            <p className="text-gray-400 text-lg">6 Niveaux • Multijoueur Local</p>
            <p className="text-gray-500 text-sm mt-1">Ouvre 2 onglets et joue avec toi-même ou un ami ! 🎮</p>
          </div>

          {/* Auto-join banner */}
          {hasAutoJoin && (
            <div className="bg-green-900/40 border border-green-500/50 rounded-xl p-4 mb-4 text-center">
              <p className="text-green-400 font-bold mb-1">🎮 Invitation détectée !</p>
              <p className="text-green-300 text-sm">Salle : <span className="font-mono font-bold">{urlRoomId}</span></p>
              <p className="text-gray-400 text-xs mt-1">Entrez votre nom puis cliquez &quot;Rejoindre la salle&quot; ci-dessous</p>
            </div>
          )}

          {/* Player Setup */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-700/50">
            <h2 className="text-white font-bold mb-4 text-lg">👤 Votre Profil</h2>
            <div className="mb-4">
              <label className="text-gray-300 text-sm mb-1 block">Nom du joueur</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Entrez votre nom..."
                maxLength={15}
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder-gray-500"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block">Couleur du cube</label>
              <div className="flex gap-2 flex-wrap">
                {PLAYER_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setPlayerColor(color)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                      playerColor === color ? 'border-white scale-110 shadow-lg' : 'border-gray-600'
                    }`}
                    style={{ backgroundColor: color, boxShadow: playerColor === color ? `0 0 15px ${color}` : 'none' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Game Modes */}
          <div className="space-y-3">
            <button
              onClick={handlePlaySolo}
              disabled={!playerName.trim()}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-lg"
            >
              🎮 Jouer Solo
            </button>

            {/* Auto-join button if URL has room */}
            {hasAutoJoin && (
              <button
                onClick={() => handleJoinRoom(urlRoomId!)}
                disabled={!playerName.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-lg animate-pulse"
              >
                🚀 Rejoindre la salle {urlRoomId}
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCreateRoom}
                disabled={!playerName.trim()}
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold py-4 px-4 rounded-xl hover:from-purple-400 hover:to-pink-500 transition-all hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🖥️ Créer une Salle
              </button>
              <button
                onClick={() => handleJoinRoom()}
                disabled={!playerName.trim() || (!joinRoomInput.trim() && !hasAutoJoin)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-4 rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🔗 Rejoindre
              </button>
            </div>

            {/* Join room input */}
            {!hasAutoJoin && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomInput}
                  onChange={(e) => setJoinRoomInput(e.target.value.toUpperCase())}
                  placeholder="Code ou lien de la salle..."
                  className="flex-1 bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-green-500 focus:outline-none placeholder-gray-500 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && playerName.trim() && joinRoomInput.trim()) {
                      handleJoinRoom();
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="mt-6 bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
            <h3 className="text-gray-300 font-bold mb-2 text-sm">🌐 Comment marche le multijoueur ?</h3>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Clique <strong className="text-purple-400">&quot;Créer une Salle&quot;</strong></li>
              <li>Copie le <strong className="text-cyan-400">lien</strong> généré</li>
              <li>Colle dans un <strong className="text-green-400">2ème onglet normal</strong> (même navigateur)</li>
              <li>L&apos;autre joueur se connecte <strong className="text-yellow-400">automatiquement</strong> !</li>
              <li>Le host lance la partie 🎉</li>
            </ol>
            <p className="text-xs text-green-400 mt-2">✅ Fonctionne entre onglets, navigateurs, appareils et même à distance !</p>
          </div>

          {/* Controls */}
          <div className="mt-4 bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
            <h3 className="text-gray-300 font-bold mb-2 text-sm">🕹️ Contrôles</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>← → ou A/D : Déplacer</div>
              <div>↑ ou Espace : Sauter</div>
              <div>R : Recommencer</div>
              <div>Entrée : Niveau suivant</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // LOBBY SCREEN
  // ============================
  if (screen === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-white mb-2">
              {isHost ? '🖥️ Votre Salle' : '🔗 Salle Rejointe'}
            </h1>
            <p className="text-gray-400">
              {isHost ? 'Partagez le lien pour inviter des joueurs !' : 'En attente du lancement...'}
            </p>
          </div>

          {/* Room ID Display */}
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 mb-4 border border-gray-700/50 text-center">
            <p className="text-gray-400 text-sm mb-2">Code de la salle</p>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 tracking-wider mb-4">
              {roomId}
            </div>

            {/* Link copy section */}
            <div className="bg-gray-900/80 rounded-xl p-3 mb-4">
              <p className="text-gray-400 text-xs mb-2">📋 Lien à partager</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={roomLink}
                  className="flex-1 bg-gray-800 text-cyan-300 px-3 py-2 rounded-lg font-mono text-xs border border-gray-600 truncate"
                />
                <button
                  onClick={() => handleCopy(roomLink)}
                  className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-500 transition-colors text-sm font-bold whitespace-nowrap"
                >
                  {copied ? '✅ Copié !' : '📋 Copier'}
                </button>
              </div>
            </div>

            {/* Status */}
            {statusMsg && (
              <p className={`text-sm mb-3 ${
                statusMsg.includes('🟢') ? 'text-green-400' :
                statusMsg.includes('🔴') ? 'text-red-400' :
                statusMsg.includes('❌') ? 'text-red-400' :
                'text-yellow-400'
              }`}>{statusMsg}</p>
            )}

            {/* Player count */}
            <div className="flex items-center justify-center gap-2 text-lg">
              <span className="text-gray-400">Joueurs connectés :</span>
              <span className="text-cyan-400 font-black text-2xl">{connectedPeers + 1}</span>
            </div>
          </div>

          {/* Player List */}
          <div className="bg-gray-800/40 rounded-2xl p-4 mb-4 border border-gray-700/30">
            <h3 className="text-white font-bold mb-3 text-sm">👥 Joueurs dans la salle</h3>
            <div className="space-y-2">
              {/* Self */}
              <div className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-4 py-3">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-white/50 shadow-lg"
                  style={{ backgroundColor: playerColor }}
                />
                <div className="flex-1">
                  <span className="text-white font-bold">{playerName}</span>
                  <span className="text-gray-500 text-xs ml-2">(vous{isHost ? ' - host' : ''})</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              </div>

              {/* Remote players */}
              {playerList.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-gray-900/40 rounded-xl px-4 py-3">
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-gray-500"
                    style={{ backgroundColor: p.color }}
                  />
                  <div className="flex-1">
                    <span className="text-gray-200 font-bold">{p.name}</span>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                </div>
              ))}

              {/* Waiting indicator */}
              {connectedPeers === 0 && (
                <div className="flex items-center gap-3 bg-gray-900/20 rounded-xl px-4 py-3 border-2 border-dashed border-gray-700">
                  <div className="w-8 h-8 rounded-lg border-2 border-gray-700 bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-600">?</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-500 text-sm italic">En attente d&apos;un joueur...</span>
                  </div>
                  <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3 mb-4">
            <p className="text-blue-300 text-xs text-center">
              💡 <strong>Astuce :</strong> Copie le lien et envoie-le à un ami, ou colle-le dans un autre onglet / navigateur / appareil !
            </p>
            <p className="text-green-300 text-xs text-center mt-1">
              ✅ Fonctionne entre 2 onglets normaux du même navigateur. Pour tester : ouvre 2 onglets normaux (pas 1 normal + 1 privé).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isHost && (
              <button
                onClick={handleStartMultiplayerGame}
                disabled={connectedPeers === 0}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all hover:shadow-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {connectedPeers > 0 ? '🚀 Lancer la Partie !' : '⏳ En attente de joueurs...'}
              </button>
            )}

            {!isHost && (
              <div className="text-center py-3">
                <div className="inline-flex items-center gap-2 text-yellow-400">
                  {connectedPeers === 0 && (
                    <div className="animate-spin w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full" />
                  )}
                  {connectedPeers > 0 && (
                    <div className="w-5 h-5 bg-green-500 rounded-full animate-pulse" />
                  )}
                  <span className="font-bold">
                    {connectedPeers > 0
                      ? 'Connecté ! En attente que le host lance la partie...'
                      : 'En attente du host... (il doit être dans la salle)'}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                cleanupMultiplayer();
                window.history.replaceState(null, '', window.location.pathname);
                setScreen('menu');
              }}
              className="w-full bg-gray-700 text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-600 transition-colors"
            >
              ← Retour au Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // GAME OVER SCREEN
  // ============================
  if (screen === 'gameover') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-green-950 flex items-center justify-center p-4">
        <div className="text-center max-w-lg">
          <div className="text-8xl mb-6">🏆</div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mb-4">
            FÉLICITATIONS !
          </h1>
          <p className="text-gray-300 text-xl mb-2">Vous avez terminé les 6 niveaux !</p>
          <div className="bg-gray-800/50 rounded-2xl p-6 mb-8 inline-block border border-gray-700/50">
            <div className="text-4xl font-black text-red-400 mb-1">💀 {totalDeaths}</div>
            <div className="text-gray-400">Morts au total</div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                setCurrentLevel(0);
                setTotalDeaths(0);
                setScreen('game');
              }}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 px-8 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all text-lg"
            >
              🔄 Rejouer
            </button>
            <button
              onClick={() => {
                cleanupMultiplayer();
                window.history.replaceState(null, '', window.location.pathname);
                setScreen('menu');
              }}
              className="w-full bg-gray-700 text-white font-bold py-3 px-8 rounded-xl hover:bg-gray-600 transition-colors"
            >
              ← Menu Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // GAME SCREEN
  // ============================
  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-gray-900/90 px-4 py-2 flex items-center justify-between shrink-0 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              cleanupMultiplayer();
              window.history.replaceState(null, '', window.location.pathname);
              setScreen('menu');
            }}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Menu
          </button>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: playerColor }} />
            <span className="text-white text-sm font-bold">{playerName}</span>
          </div>
          {roomId && (
            <span className="text-gray-500 text-xs font-mono">Salle: {roomId}</span>
          )}
        </div>

        {/* Level indicators */}
        <div className="flex items-center gap-1">
          {levels.map((_, i) => (
            <div
              key={i}
              className={`w-8 h-2 rounded-full transition-all ${
                i < currentLevel
                  ? 'bg-green-500'
                  : i === currentLevel
                  ? 'bg-cyan-400 animate-pulse'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-red-400">💀 {totalDeaths}</span>
          {multiplayerRef.current && (
            <span className="text-green-400">👥 {connectedPeers + 1}</span>
          )}
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 relative">
        <GameCanvas
          currentLevel={currentLevel}
          playerName={playerName}
          playerColor={playerColor}
          multiplayer={multiplayerRef.current}
          onLevelComplete={handleLevelComplete}
          onDeath={handleDeath}
        />
      </div>
    </div>
  );
}
