import React, { useState } from 'react';
import { CharacterType } from '../types';

interface LoginScreenProps {
  onJoin: (char: CharacterType, room: string) => void;
  loading: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin, loading }) => {
  const [char, setChar] = useState<CharacterType>('michael');
  const [room, setRoom] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (room.trim().toLowerCase() === 'marldouri') {
      onJoin(char, room.trim().toUpperCase());
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop')] bg-cover bg-center flex flex-col items-center justify-center p-6 z-50 overflow-hidden">
      {/* Overlay Gradient for dreamy look */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a0845]/80 via-[#6441A5]/60 to-[#fe8c00]/40 backdrop-blur-[2px]"></div>

      {/* Floating Particles (Simple CSS circles) */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-700"></div>
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-bounce duration-[3000ms]"></div>

      <div className="relative bg-white/10 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl w-full max-w-md flex flex-col items-center text-center animate-fade-in border border-white/20 ring-1 ring-white/30">

        {/* Header */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full blur opacity-30 animate-pulse"></div>
          <div className="relative text-7xl animate-bounce drop-shadow-lg">💖</div>
        </div>

        <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg tracking-tight">M&D World</h1>
        <p className="text-pink-100 font-medium text-lg mb-8 tracking-wide drop-shadow-md">400 Days of Us ✨</p>

        <div className="w-full space-y-8">

          {/* Character Selection */}
          <div className="text-left w-full">
            <label className="block text-white/90 font-bold mb-3 ml-2 text-sm uppercase tracking-wider">I am:</label>
            <div className="flex gap-4">
              <button
                onClick={() => setChar('michael')}
                className={`flex-1 group relative overflow-hidden py-4 rounded-3xl border-2 transition-all duration-300 ${char === 'michael' ? 'border-[#ffceda] bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' : 'border-white/10 bg-black/20 hover:bg-black/10'}`}
              >
                <div className="text-4xl mb-2 transition-transform group-hover:scale-110">👱‍♂️</div>
                <div className={`font-bold text-lg ${char === 'michael' ? 'text-white' : 'text-white/60'}`}>Marble</div>
              </button>

              <button
                onClick={() => setChar('douri')}
                className={`flex-1 group relative overflow-hidden py-4 rounded-3xl border-2 transition-all duration-300 ${char === 'douri' ? 'border-[#ffceda] bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' : 'border-white/10 bg-black/20 hover:bg-black/10'}`}
              >
                <div className="text-4xl mb-2 transition-transform group-hover:scale-110">👩‍🦰</div>
                <div className={`font-bold text-lg ${char === 'douri' ? 'text-white' : 'text-white/60'}`}>Douri</div>
              </button>
            </div>
          </div>

          {/* Room Code */}
          <div className="text-left w-full">
            <label className="block text-white/90 font-bold mb-3 ml-2 text-sm uppercase tracking-wider">Room Code:</label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="ENTER ROOM NAME"
                className="relative w-full p-4 text-xl rounded-2xl bg-black/20 border border-white/10 text-white placeholder-white/40 outline-none focus:bg-black/30 transition-all text-center uppercase tracking-widest font-bold shadow-inner"
              />
            </div>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleSubmit}
            disabled={!room || loading}
            className="w-full py-5 bg-gradient-to-r from-[#ff6b6b] to-[#ff8e53] text-white text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-white/20 group"
          >
            <span className="drop-shadow-md group-hover:hidden">{loading ? 'Connecting...' : 'Enter Paradise 🏝️'}</span>
            <span className="hidden group-hover:inline drop-shadow-md">Let's Go! 🚀</span>
          </button>
        </div>
      </div>

      {/* Footer / Copyright */}
      <div className="absolute bottom-4 text-white/40 text-xs font-medium">
        Made with ❤️ for You
      </div>
    </div>
  );
};

export default LoginScreen;