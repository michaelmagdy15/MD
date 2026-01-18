import { Memory } from './types';

export const COLORS = {
  skyTop: 0x16213e,
  skyBottom: 0xffb7b2,
  grass: 0x95e06c,
  water: 0xa2d2ff,
  michael: 0x4dabf7,
  douri: 0xff8787
};

export const WORLD_RADIUS = 80;

export const MEMORIES: Memory[] = [
  { 
      id: 1, x: -10, z: -10, title: "Day 1", 
      text: "Do you remember when we first started talking? I knew then you were special.",
      image: "https://i.ibb.co/xqgsXQ45/Screenshot-1.png" 
  },
  { id: 2, x: 10, z: -8, title: "The Park", text: "Our first awkward walk. I wanted to hold your hand so bad!", image: "" },
  { id: 3, x: -12, z: 8, title: "Your Birthday", text: "Seeing you smile at the gazebo was the highlight of my year.", image: "" },
  { id: 4, x: 12, z: 5, title: "Comfort", text: "When times were hard, you were my rock. Thank you.", image: "" },
  { id: 5, x: 0, z: -18, title: "Inside Joke", text: "Wait... are we still doing that silly voice? Haha!", image: "" },
  { id: 6, x: 15, z: 15, title: "The Sunset", text: "100 Days felt like magic. But 400 feels like destiny.", image: "" },
  { id: 7, x: -15, z: 12, title: "Trust", text: "We've built a bridge of trust that nothing can break.", image: "" },
  { id: 8, x: 0, z: 0, title: "400 Days", text: "Stand here together...", image: "", isFinal: true } 
];