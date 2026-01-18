import React, { useState, useEffect, useRef } from 'react';
import { JoystickData, ChatMessage, Memory, TicTacToeState, PlayerData, CharacterType } from '../types';
import Joystick from './Joystick';
import { MEMORIES, WORLD_RADIUS } from '../constants';
import { MessageSquare, Heart, Music, X, Hand, Grid3X3, RotateCw, LogOut, UtensilsCrossed, ArrowUpCircle, Armchair, Zap } from 'lucide-react';

interface GameUIProps {
  roomCode: string;
  playerCount: number;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onMove: (data: JoystickData) => void;
  onStopMove: () => void;
  onJump: () => void;
  onEmote: (name: string) => void;
  onToggleMusic: () => void;
  activeMemoryId: number | null;
  xoState: TicTacToeState;
  onXOAction: (index: number | null) => void;
  players: Record<string, PlayerData>;
  myId: string | undefined;
  onLeave: () => void;
  isNearStove: boolean;
  burgerCount: number;
  onCook: () => void;
  isNearTreehouse: boolean;
  onEnterTreehouse: () => void;
  isNearBench: boolean;
  isSitting: boolean;

  myCharType: CharacterType;
  onPunch: () => void;
}

const GameUI: React.FC<GameUIProps> = ({
  roomCode,
  playerCount,
  messages,
  onSendMessage,
  onMove,
  onStopMove,
  onJump,
  onEmote,
  onToggleMusic,
  activeMemoryId,
  xoState,
  onXOAction,
  players,
  myId,
  onLeave,
  isNearStove,
  burgerCount,
  onCook,
  isNearTreehouse,
  onEnterTreehouse,
  isNearBench,
  isSitting,

  myCharType,
  onPunch
}) => {
  const [showChat, setShowChat] = useState(false);
  const [showXO, setShowXO] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (activeMemoryId) {
      setActiveMemory(MEMORIES.find(m => m.id === activeMemoryId) || null);
    } else {
      setActiveMemory(null);
    }
  }, [activeMemoryId]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // Draw Minimap
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const scale = (w / 2 - 5) / WORLD_RADIUS;

    // Lake (approx at 0, -10 with radius 15)
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + (-10 * scale), 15 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 200, 255, 0.6)";
    ctx.fill();

    // Players
    Object.values(players).forEach(p => {
      const mapX = w / 2 + p.x * scale;
      const mapY = h / 2 + p.z * scale;
      ctx.beginPath();
      ctx.arc(mapX, mapY, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.id === myId ? "#00ff00" : "#ff0000";
      ctx.fill();
    });
  }, [players, myId]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 select-none overflow-hidden flex flex-col justify-between p-safe" style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>

      {/* Top Bar */}
      <div className="flex justify-between items-start pt-4 px-4 w-full pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/20 text-[#ff6b6b] font-bold">
            <p className="text-sm">Room: {roomCode}</p>
            <p className="text-xs text-gray-500 font-medium">Players: {playerCount}</p>
          </div>

          <button onClick={onLeave} className="h-10 bg-red-500/90 backdrop-blur-md text-white px-4 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border border-white/20 active:scale-95 transition-all">
            <LogOut size={16} /> <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Top Right Controls */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          {/* Mini Map */}
          <div className="relative w-20 h-20 bg-black/20 backdrop-blur-md rounded-full overflow-hidden border-2 border-white/30 shadow-2xl">
            <canvas ref={canvasRef} width={80} height={80} className="w-full h-full" />
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={() => setShowXO(!showXO)} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl border border-white/20 active:scale-95 text-purple-600">
              <Grid3X3 size={24} />
            </button>
            <button onClick={() => setShowChat(!showChat)} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl border border-white/20 active:scale-95 text-[#5d54a4]">
              <MessageSquare size={24} />
            </button>

            {/* Emotes */}
            <div className="flex flex-col gap-1.5 bg-black/10 backdrop-blur-md p-1 rounded-full border border-white/10">
              <button onClick={() => onEmote('heart')} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow active:scale-95 text-red-500">
                <Heart size={20} fill="currentColor" />
              </button>
              <button onClick={() => onEmote('dance')} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow active:scale-95 text-blue-500">
                <Music size={20} />
              </button>
              <button onClick={() => onEmote('wave')} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow active:scale-95 text-yellow-500">
                <Hand size={20} />
              </button>
            </div>

            <button onClick={onToggleMusic} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl border border-white/20 active:scale-95 text-green-500">
              <Music size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Interface */}
      <div className="flex flex-col w-full pb-8 px-8 pointer-events-none">

        {/* Action Buttons (Near Object) */}
        <div className="flex justify-center gap-4 mb-4">
          {isNearStove && (
            <div className="flex flex-col items-center animate-bounce pointer-events-auto">
              <div className="bg-white/90 px-3 py-1 rounded-full mb-1 text-xs font-bold text-orange-600 shadow-xl border border-white/20 backdrop-blur-md">
                Burgers: {burgerCount}
              </div>
              <button
                onClick={onCook}
                className="w-16 h-16 bg-orange-500/90 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white active:scale-95"
              >
                <UtensilsCrossed size={32} />
              </button>
            </div>
          )}

          {isNearTreehouse && (
            <button
              onClick={onEnterTreehouse}
              className="w-16 h-16 bg-green-600/90 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white active:scale-95 animate-pulse pointer-events-auto"
            >
              <ArrowUpCircle size={32} />
            </button>
          )}

          {(isNearBench || isSitting) && (
            <button
              onClick={onToggleSit}
              className={`w-16 h-16 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white active:scale-95 transition-all pointer-events-auto ${isSitting ? 'bg-red-500' : 'bg-blue-600'}`}
            >
              {isSitting ? <X size={32} /> : <Armchair size={32} />}
            </button>
          )}

          {/* PUNCH BUTTON (Douri Only) */}
          {myCharType === 'douri' && (
            <button
              onClick={onPunch}
              className="w-16 h-16 bg-red-600/90 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white active:scale-90 transition-all pointer-events-auto animate-pulse"
            >
              <Zap size={32} fill="yellow" />
            </button>
          )}
        </div>

        {/* Movement Controls */}
        <div className="flex justify-between items-end w-full max-w-lg mx-auto pointer-events-none">
          <div className="pointer-events-auto backdrop-blur-sm rounded-full bg-black/5 p-2">
            <Joystick onMove={onMove} onStop={onStopMove} />
          </div>

          <button
            onPointerDown={onJump}
            className="w-20 h-20 bg-[#ff6b6b]/90 backdrop-blur-md rounded-full border-4 border-white shadow-2xl flex items-center justify-center active:bg-[#ff6b6b] active:scale-90 transition-all pointer-events-auto"
          >
            <span className="text-3xl text-white">⬆️</span>
          </button>
        </div>
      </div>

      {/* XO Game Modal - FIXED CENTERING */}
      {showXO && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-auto z-50">
          <div className="w-80 max-w-[90vw] bg-white/95 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border-4 border-purple-300 flex flex-col items-center animate-fade-in">
            <div className="flex justify-between w-full mb-4">
              <h3 className="font-bold text-xl text-purple-600">Tic Tac Toe</h3>
              <button onClick={() => setShowXO(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full aspect-square mb-4">
              {xoState.board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => onXOAction(i)}
                  className={`bg-purple-50 rounded-xl text-3xl font-bold flex items-center justify-center shadow-md hover:bg-purple-100 transition-colors ${cell === 'X' ? 'text-blue-500' : 'text-red-500'}`}
                >
                  {cell}
                </button>
              ))}
            </div>
            {xoState.winner && (
              <div className="mb-3 font-bold text-xl text-green-600">
                {xoState.winner === 'Draw' ? 'Draw!' : `Winner: ${xoState.winner}`}
              </div>
            )}
            <button
              onClick={() => onXOAction(null)}
              className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-full font-bold shadow-lg hover:bg-purple-600 active:scale-95"
            >
              <RotateCw size={18} /> Reset Game
            </button>
          </div>
        </div>
      )}

      {/* Memory Panel */}
      {/* Memory Panel - FIXED CENTERING */}
      {activeMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border-4 border-[#ffb7b2] flex flex-col items-center text-center animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-[#ff6b6b] mb-2">{activeMemory.title}</h3>
            {activeMemory.image && (
              <img src={activeMemory.image} alt="Memory" className="w-full h-48 object-cover rounded-xl mb-4 shadow-sm" />
            )}
            <p className="text-gray-700 text-lg leading-relaxed mb-6 whitespace-pre-wrap">{activeMemory.text}</p>
            <button
              onClick={() => setActiveMemory(null)}
              className="px-8 py-3 bg-[#ff6b6b] text-white font-bold rounded-full shadow-lg hover:bg-[#ff5252] active:scale-95 transition-all"
            >
              Close Memory
            </button>
          </div>
        </div>
      )}

      {/* Chat OVERLAY */}
      {showChat && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm pointer-events-auto z-[60]">
          <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-4 shadow-2xl border-2 border-white/20">
            <div className="h-64 overflow-y-auto mb-4 flex flex-col gap-2 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div key={idx} className="bg-white/10 rounded-xl p-2 text-sm text-white border border-white/5">
                  <span className="font-bold text-[#ffb7b2] mr-2">{msg.user_name}:</span>
                  <span className="break-words">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 bg-white/20 rounded-2xl px-4 py-3 outline-none border border-white/30 text-white placeholder-white/50"
                placeholder="Say something..."
              />
              <button type="submit" className="w-12 h-12 bg-[#ff6b6b] rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95">
                ➤
              </button>
            </form>
            <button onClick={() => setShowChat(false)} className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl text-gray-500 border-2 border-[#ffb7b2]">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GameUI;