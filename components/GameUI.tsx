import React, { useState, useEffect, useRef } from 'react';
import { JoystickData, ChatMessage, Memory, TicTacToeState, PlayerData } from '../types';
import Joystick from './Joystick';
import { MEMORIES, WORLD_RADIUS } from '../constants';
import { MessageSquare, Heart, Music, X, Hand, Grid3X3, RotateCw, LogOut, UtensilsCrossed, ArrowUpCircle, Armchair } from 'lucide-react';

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
  onToggleSit: () => void;
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
  onToggleSit
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
    <div className="fixed inset-0 pointer-events-none z-40 select-none overflow-hidden" style={{ touchAction: 'none' }}>

      {/* Top Bar - Safe Area Padding */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-between items-start pointer-events-auto bg-gradient-to-b from-black/20 to-transparent">
        <div className="flex gap-4">
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg text-[#ff6b6b] font-bold">
            <p className="text-sm">Room: {roomCode}</p>
            <p className="text-xs text-gray-600">Players: {playerCount}</p>
          </div>

          <button onClick={onLeave} className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-2xl shadow-lg font-bold text-xs active:scale-95">
            <LogOut size={16} /> Leave
          </button>
        </div>

        {/* Top Right Controls */}
        <div className="flex flex-col items-end gap-2">
          {/* Mini Map */}
          <div className="relative w-24 h-24 mb-2">
            <canvas ref={canvasRef} width={96} height={96} className="w-full h-full" />
            <div className="absolute bottom-0 w-full text-center text-[10px] text-white font-bold drop-shadow-md">MAP</div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={() => setShowXO(!showXO)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform text-purple-600">
              <Grid3X3 size={24} />
            </button>
            <button onClick={() => setShowChat(!showChat)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform text-[#5d54a4]">
              <MessageSquare size={24} />
            </button>

            {/* Emotes */}
            <div className="flex flex-col gap-1 bg-black/10 p-1 rounded-full">
              <button onClick={() => onEmote('heart')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow active:scale-95 text-red-500">
                <Heart size={20} fill="currentColor" />
              </button>
              <button onClick={() => onEmote('dance')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow active:scale-95 text-blue-500">
                <Music size={20} />
              </button>
              <button onClick={() => onEmote('wave')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow active:scale-95 text-yellow-500">
                <Hand size={20} />
              </button>
            </div>

            <button onClick={onToggleMusic} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform text-green-500 mt-2">
              <Music size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto items-end">
        {isNearStove && (
          <div className="flex flex-col items-center animate-bounce">
            <div className="bg-white/90 px-3 py-1 rounded-full mb-1 text-xs font-bold text-orange-600 shadow">
              Burgers: {burgerCount}
            </div>
            <button
              onClick={onCook}
              className="w-16 h-16 bg-orange-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white active:scale-95"
            >
              <UtensilsCrossed size={32} />
            </button>
          </div>
        )}

        {isNearTreehouse && (
          <button
            onClick={onEnterTreehouse}
            className="w-16 h-16 bg-green-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white active:scale-95 animate-pulse"
          >
            <ArrowUpCircle size={32} />
          </button>
        )}

        {(isNearBench || isSitting) && (
          <button
            onClick={onToggleSit}
            className={`w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white active:scale-95 transition-all ${isSitting ? 'bg-red-500' : 'bg-blue-600'}`}
          >
            {isSitting ? <X size={32} /> : <Armchair size={32} />}
          </button>
        )}
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

      {/* Chat */}
      {showChat && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-[90%] max-w-sm pointer-events-auto transition-all">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 h-48 overflow-y-auto mb-2 flex flex-col">
            {messages.map((msg, idx) => (
              <div key={idx} className="mb-1 text-sm text-white drop-shadow-md">
                <span className="font-bold text-[#ffb7b2] mr-1">{msg.user_name}:</span>
                <span className="break-words">{msg.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="flex-1 bg-white/90 rounded-full px-4 py-3 outline-none border-2 border-[#ffb7b2] text-gray-800"
              placeholder="Say something..."
            />
            <button type="submit" className="w-12 h-12 bg-[#ff6b6b] rounded-full flex items-center justify-center text-white font-bold shadow-md">
              ➤
            </button>
          </form>
          <button onClick={() => setShowChat(false)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow text-gray-500">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="pointer-events-auto">
        <Joystick onMove={onMove} onStop={onStopMove} />
      </div>

      <button
        onPointerDown={onJump}
        className="absolute bottom-8 right-8 w-20 h-20 bg-[#ff6b6b]/90 rounded-full border-4 border-white/30 shadow-xl flex items-center justify-center active:bg-[#ff6b6b] active:scale-95 transition-all pointer-events-auto"
      >
        <span className="text-3xl text-white">⬆️</span>
      </button>

    </div>
  );
};

export default GameUI;