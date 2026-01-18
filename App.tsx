import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import Scene3D from './components/Scene3D';
import GameUI from './components/GameUI';
import { JoystickData, GameState, PlayerData, ChatMessage, TicTacToeState } from './types';
import { supabase } from './services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const myIdRef = useRef<string>(Math.random().toString(36).substring(7));
  const channelRef = useRef<RealtimeChannel | null>(null);

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

  // Clean up
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const handleJoin = async (char: 'michael' | 'douri', room: string) => {
    setLoading(true);
    try {
      const roomId = room.toUpperCase();
      setGameState({
        joined: true,
        roomId: roomId,
        character: char,
        playersCount: 1
      });

      // 1. Join Realtime Channel for Presence (Movement)
      const channel = supabase.channel(`room:${roomId}`, {
        config: { presence: { key: myIdRef.current } }
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const newPlayers: Record<string, PlayerData> = {};
          Object.keys(state).forEach(key => {
            if (key !== myIdRef.current) {
              const p = state[key][0] as any;
              newPlayers[key] = p;
            }
          });
          setPlayers(newPlayers);
          setGameState(prev => ({ ...prev, playersCount: Object.keys(newPlayers).length + 1 }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              x: Math.random() * 4 - 2,
              y: 0,
              z: 15,
              rot: 0,
              type: char,
              moving: false
            });
          }
        });

      channelRef.current = channel;

      // 2. Fetch & Subscribe to Chat
      const { data: existingMsgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (existingMsgs) setMessages(existingMsgs.reverse());

      supabase
        .channel(`chat:${roomId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
          setMessages(prev => [...prev.slice(-49), payload.new as ChatMessage]);
        })
        .subscribe();

      // 3. Game State (XO & Burgers)
      const { data: dbState } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (dbState) {
        if (dbState.board) setXoState(prev => ({ ...prev, board: dbState.board, isXNext: dbState.is_x_next, winner: dbState.winner }));
        if (dbState.burger_count) setBurgerCount(dbState.burger_count);
      } else {
        // Init room if not exists
        await supabase.from('game_states').insert({ room_id: roomId });
      }

      supabase
        .channel(`gamestate:${roomId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}` }, (payload) => {
          const newState = payload.new;
          if (newState.board) setXoState({ board: newState.board, isXNext: newState.is_x_next, winner: newState.winner });
          if (newState.burger_count !== undefined) setBurgerCount(newState.burger_count);
        })
        .subscribe();

    } catch (error) {
      console.error("Login failed", error);
      alert("Could not connect to Supabase. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (channelRef.current) {
      await channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
    }
    setGameState({ joined: false, roomId: '', character: 'michael', playersCount: 0 });
    setPlayers({});
    setMessages([]);
    setBurgerCount(0);
    setIsNearStove(false);
    setIsNearTreehouse(false);
    setIsSitting(false);
  };

  const handleXOAction = async (index: number | null) => {
    if (!gameState.roomId) return;

    let newState: Partial<TicTacToeState> = {};

    if (index === null) {
      newState = { board: Array(9).fill(null), isXNext: true, winner: null };
    } else {
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

      newState = {
        board: newBoard,
        isXNext: !xoState.isXNext,
        winner
      };
    }

    await supabase.from('game_states').update({
      board: newState.board,
      is_x_next: newState.isXNext,
      winner: newState.winner,
      updated_at: new Date().toISOString()
    }).eq('room_id', gameState.roomId);
  };

  const handlePunch = () => {
    if (!channelRef.current) return;
    updatePosition(
      players[myIdRef.current]?.x || 0,
      players[myIdRef.current]?.y || 0,
      players[myIdRef.current]?.z || 0,
      players[myIdRef.current]?.rot || 0,
      false
    );
    // Force a separate update for the punch event with timestamp
    const punchPayload = {
      ...players[myIdRef.current],
      type: gameState.character,
      lastPunchTime: Date.now()
    };
    channelRef.current.track(punchPayload);
  };

  const updatePosition = (x: number, y: number, z: number, rot: number, moving: boolean) => {
    if (!channelRef.current) return;

    channelRef.current.track({
      x, y, z, rot, moving,
      type: gameState.character,
      id: myIdRef.current,
      id: myIdRef.current,
      timestamp: Date.now(),
      lastPunchTime: Date.now() - (players[myIdRef.current]?.lastPunchTime || 0) < 500 ? players[myIdRef.current]?.lastPunchTime : undefined,
      ...(localEmote && (Date.now() - localEmote.time < 3000) ? { emote: localEmote } : {})
    });
  };

  const handleEmote = (name: string) => {
    const emoteData = { name, time: Date.now() };
    setLocalEmote(emoteData);
  };

  const sendMessage = async (text: string) => {
    if (!gameState.roomId) return;
    const name = gameState.character === 'michael' ? 'Michael' : 'Douri';
    await supabase.from('chat_messages').insert({
      room_id: gameState.roomId,
      user_name: name,
      message: text
    });
  };

  const handleCook = async () => {
    if (!gameState.roomId) return;
    const newCount = burgerCount + 1;
    await supabase.from('game_states').update({ burger_count: newCount }).eq('room_id', gameState.roomId);
  };

  const handleEnterTreehouse = () => {
    setTeleportReq({ x: 40, y: 10, z: 20, id: Date.now() });
  };

  const handleToggleSit = () => {
    if (isSitting) {
      setIsSitting(false);
    } else if (isNearBench) {
      setIsSitting(true);
      setInput({ x: 0, y: 0 });
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
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
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
          myId={myIdRef.current}
          onLeave={handleLeave}
          isNearStove={isNearStove}
          burgerCount={burgerCount}
          onCook={handleCook}
          isNearTreehouse={isNearTreehouse}
          onEnterTreehouse={handleEnterTreehouse}
          isNearBench={isNearBench}
          isSitting={isSitting}
          isSitting={isSitting}
          onToggleSit={handleToggleSit}
          myCharType={gameState.character}
          onPunch={handlePunch}
        />
      </div>
    </div>
  );
};

export default App;