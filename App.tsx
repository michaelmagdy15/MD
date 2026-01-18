import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import Scene3D from './components/Scene3D';
import GameUI from './components/GameUI';
import { JoystickData, GameState, PlayerData, ChatMessage, TicTacToeState } from './types';
import { auth, db, APP_ID_KEY, firebase } from './services/firebase';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    joined: false,
    roomId: '',
    character: 'michael',
    playersCount: 0
  });

  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState<JoystickData>({ x: 0, y: 0 });
  const [isJumping, setIsJumping] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerData>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeMemoryId, setActiveMemoryId] = useState<number | null>(null);
  const [xoState, setXoState] = useState<TicTacToeState>({ board: Array(9).fill(null), isXNext: true, winner: null });
  const [loginTime, setLoginTime] = useState<number>(0);
  const [localEmote, setLocalEmote] = useState<{ name: string, time: number } | null>(null);
  const [sprinting, setSprinting] = useState(false);

  // New State for Mini Games / Interactions
  const [isNearStove, setIsNearStove] = useState(false);
  const [burgerCount, setBurgerCount] = useState(0);
  const [isNearTreehouse, setIsNearTreehouse] = useState(false);
  const [teleportReq, setTeleportReq] = useState<{ x: number, y: number, z: number, id: number } | undefined>();

  // Sitting
  const [isNearBench, setIsNearBench] = useState(false);
  const [benchId, setBenchId] = useState<number | null>(null);
  const [isSitting, setIsSitting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userRef = useRef<firebase.User | null>(null);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      const key = e.key.toLowerCase();
      let x = input.x;
      let y = input.y;

      if (key === 'w' || key === 'arrowup') y = isDown ? 1 : 0;
      if (key === 's' || key === 'arrowdown') y = isDown ? -1 : 0;
      if (key === 'a' || key === 'arrowleft') x = isDown ? -1 : 0;
      if (key === 'd' || key === 'arrowright') x = isDown ? 1 : 0;

      if (key === 'shift') setSprinting(isDown);

      if (key === ' ' && isDown && !isSitting) setIsJumping(true);

      if (isDown || (!isDown && (x !== input.x || y !== input.y))) {
        if (!isSitting) setInput({ x, y });
      }
    };

    const down = (e: KeyboardEvent) => handleKey(e, true);
    const up = (e: KeyboardEvent) => handleKey(e, false);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [input, isSitting]);

  // Clean up player on unmount
  useEffect(() => {
    const cleanup = async () => {
      if (userRef.current && gameState.roomId) {
        try {
          await db.collection('artifacts').doc(APP_ID_KEY)
            .collection('public').doc('data')
            .collection('mdworld_rooms').doc(gameState.roomId)
            .collection('players').doc(userRef.current.uid).delete();
        } catch (e) { console.error("Cleanup error", e); }
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      cleanup();
      window.removeEventListener('beforeunload', cleanup);
    };
  }, [gameState.roomId]);

  // Subscribe to Burger Count
  useEffect(() => {
    if (!gameState.roomId) return;
    const unsub = db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(gameState.roomId)
      .collection('kitchen').doc('status')
      .onSnapshot(doc => {
        if (doc.exists) {
          setBurgerCount(doc.data()?.burgers || 0);
        }
      });
    return () => unsub();
  }, [gameState.roomId]);

  const handleJoin = async (char: 'michael' | 'douri', room: string) => {
    setLoading(true);
    try {
      const userCred = await auth.signInAnonymously();
      userRef.current = userCred.user;

      if (userRef.current) {
        setLoginTime(Date.now());
        setGameState({
          joined: true,
          roomId: room,
          character: char,
          playersCount: 1
        });

        // Clear chat UI state on join
        setMessages([]);

        subscribeToRoom(room);
        subscribeToChat(room);
        subscribeToXO(room);
      }
    } catch (error) {
      console.error("Login failed", error);
      alert("Could not connect to Firebase. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (userRef.current && gameState.roomId) {
      try {
        await db.collection('artifacts').doc(APP_ID_KEY)
          .collection('public').doc('data')
          .collection('mdworld_rooms').doc(gameState.roomId)
          .collection('players').doc(userRef.current.uid).delete();
      } catch (e) { console.error(e); }
    }
    auth.signOut();
    setGameState({ joined: false, roomId: '', character: 'michael', playersCount: 0 });
    setPlayers({});
    setMessages([]);
    setBurgerCount(0);
    setIsNearStove(false);
    setIsNearTreehouse(false);
    setIsSitting(false);
  };

  const subscribeToRoom = (roomId: string) => {
    const roomRef = db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(roomId)
      .collection('players');

    roomRef.onSnapshot(snapshot => {
      const now = Date.now();
      const newPlayers: Record<string, PlayerData> = {};

      snapshot.forEach(doc => {
        if (doc.id !== userRef.current?.uid) {
          const data = doc.data() as PlayerData;
          let lastSeen = 0;
          if (data.timestamp?.toMillis) lastSeen = data.timestamp.toMillis();
          else if (data.timestamp) lastSeen = new Date(data.timestamp).getTime();

          if (now - lastSeen < 60000) {
            newPlayers[doc.id] = data;
          }
        }
      });
      setPlayers(newPlayers);
      setGameState(prev => ({ ...prev, playersCount: Object.keys(newPlayers).length + 1 }));
    });
  };

  const subscribeToChat = (roomId: string) => {
    const chatRef = db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(roomId)
      .collection('chat')
      .orderBy('timestamp', 'desc')
      .limit(50);

    chatRef.onSnapshot(snapshot => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        let msgTime = 0;
        if (data.timestamp && data.timestamp.toMillis) msgTime = data.timestamp.toMillis();
        else if (data.timestamp) msgTime = new Date(data.timestamp).getTime();

        if (msgTime > (loginTime - 2000)) {
          msgs.push({ id: doc.id, ...data } as ChatMessage);
        }
      });
      setMessages(msgs.reverse());
    });
  };

  const subscribeToXO = (roomId: string) => {
    const xoRef = db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(roomId)
      .collection('tictactoe').doc('game');

    xoRef.onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data() as TicTacToeState;
        setXoState(data);
      }
    });
  };

  const handleXOAction = (index: number | null) => {
    if (!gameState.roomId) return;
    const xoRef = db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(gameState.roomId)
      .collection('tictactoe').doc('game');

    if (index === null) {
      xoRef.set({ board: Array(9).fill(null), isXNext: true, winner: null });
      return;
    }

    if (xoState.board[index] || xoState.winner) return;

    const newBoard = [...xoState.board];
    newBoard[index] = xoState.isXNext ? 'X' : 'O';

    let winner = null;
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        winner = newBoard[a];
      }
    }
    if (!winner && newBoard.every(c => c)) winner = 'Draw';

    xoRef.set({
      board: newBoard,
      isXNext: !xoState.isXNext,
      winner
    });
  };

  const updatePosition = (x: number, y: number, z: number, rot: number, moving: boolean) => {
    if (!userRef.current || !gameState.roomId) return;

    db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(gameState.roomId)
      .collection('players').doc(userRef.current.uid)
      .set({
        x, y, z, rot,
        moving,
        type: gameState.character,
        id: userRef.current.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ...(localEmote && (Date.now() - localEmote.time < 3000) ? { emote: localEmote } : {})
      }, { merge: true });
  };

  const handleEmote = (name: string) => {
    const emoteData = { name, time: Date.now() };
    setLocalEmote(emoteData);

    if (!userRef.current || !gameState.roomId) return;
    db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(gameState.roomId)
      .collection('players').doc(userRef.current.uid)
      .set({
        emote: emoteData
      }, { merge: true });
  };

  const sendMessage = (text: string) => {
    if (!userRef.current || !gameState.roomId) return;
    const name = gameState.character === 'michael' ? 'Michael' : 'Douri';
    db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(gameState.roomId)
      .collection('chat').add({
        name, text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
  };

  const handleCook = () => {
    if (!gameState.roomId) return;
    const ref = db.collection('artifacts').doc(APP_ID_KEY)
      .collection('public').doc('data')
      .collection('mdworld_rooms').doc(gameState.roomId)
      .collection('kitchen').doc('status');

    // Simple atomic increment via transaction
    db.runTransaction(async t => {
      const doc = await t.get(ref);
      const newCount = (doc.data()?.burgers || 0) + 1;
      t.set(ref, { burgers: newCount }, { merge: true });
    });
  };

  const handleEnterTreehouse = () => {
    setTeleportReq({ x: 40, y: 10, z: 20, id: Date.now() });
    updatePosition(40, 10, 20, 0, false);
  };

  const handleToggleSit = () => {
    if (isSitting) {
      setIsSitting(false);
      // Teleport slightly forward to avoid clipping when standing up
      // We can't easily read current pos here without state loop, so we assume player just moves
    } else if (isNearBench) {
      setIsSitting(true);
      // Lock input
      setInput({ x: 0, y: 0 });
      // Note: In a full engine we'd snap to bench position (x, y, z).
      // Here scene3D handles visual snap, we just freeze input
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=piano-moment-111003.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }

    if (audioRef.current.paused) {
      audioRef.current.play().catch(e => console.log(e));
    } else {
      audioRef.current.pause();
    }
  };

  if (!gameState.joined) {
    return <LoginScreen onJoin={handleJoin} loading={loading} />;
  }

  return (
    <div className="relative w-full h-full">
      <Scene3D
        input={input}
        isJumping={isJumping}
        onResetJump={() => setIsJumping(false)}
        myCharType={gameState.character}
        players={players}
        onUpdatePosition={updatePosition}
        onNearMemory={setActiveMemoryId}
        myEmote={localEmote}
        onNearStove={setIsNearStove}
        onNearTreehouse={setIsNearTreehouse}
        teleportRequest={teleportReq}
        burgerCount={burgerCount}
        onNearBench={(isNear, id) => { setIsNearBench(isNear); setBenchId(id); }}
        isSitting={isSitting}
        isSprinting={sprinting}
      />
      <GameUI
        roomCode={gameState.roomId}
        playerCount={gameState.playersCount}
        messages={messages}
        onSendMessage={sendMessage}
        onMove={setInput}
        onStopMove={() => setInput({ x: 0, y: 0 })}
        onJump={() => setIsJumping(true)}
        onEmote={handleEmote}
        onToggleMusic={toggleMusic}
        activeMemoryId={activeMemoryId}
        xoState={xoState}
        onXOAction={handleXOAction}
        players={players}
        myId={userRef.current?.uid}
        onLeave={handleLeave}
        isNearStove={isNearStove}
        burgerCount={burgerCount}
        onCook={handleCook}
        isNearTreehouse={isNearTreehouse}
        onEnterTreehouse={handleEnterTreehouse}
        isNearBench={isNearBench}
        isSitting={isSitting}
        onToggleSit={handleToggleSit}
      />
    </div>
  );
};

export default App;