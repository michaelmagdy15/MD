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
  timestamp?: any;
}

export interface ChatMessage {
  id?: string;
  name: string;
  text: string;
  timestamp: any;
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