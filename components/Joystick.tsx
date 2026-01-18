import React, { useRef, useState, useEffect } from 'react';
import { JoystickData } from '../types';

interface JoystickProps {
  onMove: (data: JoystickData) => void;
  onStop: () => void;
}

const Joystick: React.FC<JoystickProps> = ({ onMove, onStop }) => {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);

  const maxRadius = 50;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    
    setActive(true);
    setOrigin({ x: e.clientX, y: e.clientY });
    setPosition({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!active) return;

    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const cappedDist = Math.min(distance, maxRadius);
    
    const newX = cappedDist * Math.cos(angle);
    const newY = cappedDist * Math.sin(angle);

    setPosition({ x: newX, y: newY });

    // Normalize outputs (-1 to 1)
    // Invert Y because screen Y is down, but 3D world forward is usually -Z or Z depending on camera.
    // Based on Scene3D logic: y input maps to forward/back.
    onMove({
      x: newX / maxRadius,
      y: -(newY / maxRadius)
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).releasePointerCapture(e.pointerId);
    
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onStop();
  };

  return (
    <div 
      className="absolute bottom-8 left-8 w-32 h-32 z-50 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Base */}
      <div className="w-full h-full rounded-full bg-white/20 border-2 border-white/40 backdrop-blur-sm relative flex items-center justify-center pointer-events-none">
        {/* Knob */}
        <div 
          ref={knobRef}
          className="w-14 h-14 rounded-full bg-[#ff6b6b]/90 shadow-lg absolute transition-transform duration-75 ease-linear"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`
          }}
        />
      </div>
    </div>
  );
};

export default Joystick;