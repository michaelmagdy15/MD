import React, { useState } from 'react';
import { CharacterType } from '../types';

interface LoginScreenProps {
  onJoin: (char: CharacterType, room: string) => void;
  loading: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin, loading }) => {
  const [char, setChar] = useState<CharacterType>('michael');
  const [room, setRoom] = useState('');

  const handleSubmit = () => {
    if (room.trim()) {
      onJoin(char, room.trim().toUpperCase());
    }
  };

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#ffdac1] flex flex-col items-center justify-center p-6 z-50">
      <div className="bg-white/95 backdrop-blur-lg p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center text-center animate-fade-in border-4 border-[#ffb7b2]">
        <div className="text-6xl mb-4 animate-bounce">💖</div>
        <h1 className="text-4xl font-bold text-[#ff6b6b] mb-2 drop-shadow-sm">M&D World</h1>
        <p className="text-[#5d54a4] font-medium mb-8">400 Days of Us</p>

        <div className="w-full space-y-6">
          <div className="text-left">
            <label className="block text-gray-600 font-bold mb-2 ml-2">I am:</label>
            <div className="flex gap-4">
              <button 
                onClick={() => setChar('michael')}
                className={`flex-1 py-4 rounded-2xl border-2 transition-all ${char === 'michael' ? 'border-[#ff6b6b] bg-[#fff0f0] scale-105 shadow-md' : 'border-gray-200 bg-white opacity-60'}`}
              >
                <div className="text-2xl mb-1">👱‍♂️</div>
                <div className="font-bold text-gray-700">Michael</div>
              </button>
              <button 
                onClick={() => setChar('douri')}
                className={`flex-1 py-4 rounded-2xl border-2 transition-all ${char === 'douri' ? 'border-[#ff6b6b] bg-[#fff0f0] scale-105 shadow-md' : 'border-gray-200 bg-white opacity-60'}`}
              >
                <div className="text-2xl mb-1">👩‍🦰</div>
                <div className="font-bold text-gray-700">Douri</div>
              </button>
            </div>
          </div>

          <div className="text-left">
            <label className="block text-gray-600 font-bold mb-2 ml-2">Room Code:</label>
            <input 
              type="text" 
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Enter Room Name"
              className="w-full p-4 text-lg rounded-2xl border-2 border-[#ffb7b2] outline-none focus:ring-4 focus:ring-[#ffb7b2]/30 transition-all text-center uppercase tracking-wider"
            />
          </div>

          <button 
            onClick={handleSubmit}
            disabled={!room || loading}
            className="w-full py-4 bg-[#ff6b6b] text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Enter World'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;