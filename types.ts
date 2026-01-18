export type CharacterType = 'michael' | 'douri';

export interface PlayerData {
  id?: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  type: CharacterType;
  moving: boolean;
  emote?: {
    name: string;
    time: number;
  };
  lastPunchTime?: number;
  timestamp?: any;
}

export interface ChatMessage {
  id?: string;
  user_name: string; // Changed from name to match DB
  message: string;   // Changed from text to match DB
  created_at?: string;
}

export interface Memory {
  id: number;
  x: number;
  z: number;
  title: string;
  text: string;
  image: string;
  isFinal?: boolean;
}

export interface JoystickData {
  x: number;
  y: number; // Normalized -1 to 1
}

export interface GameState {
  joined: boolean;
  roomId: string;
  character: CharacterType;
  playersCount: number;
}

export interface TicTacToeState {
  board: (string | null)[];
  isXNext: boolean;
  winner: string | null;
  resetRequest?: number;
}