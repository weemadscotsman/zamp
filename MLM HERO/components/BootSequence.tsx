import React, { useEffect, useState, useRef } from 'react';

interface BootSequenceProps {
  onComplete: () => void;
}

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const bootLogs = [
    "INITIALIZING KERNEL...",
    "LOADING NEURAL ENGINE v1.4...",
    "MOUNTING VRAM [OK]",
    "CONNECTING TO GEMINI CLUSTER...",
    "VERIFYING NANO BANANA SHADERS...",
    "LOADING VEO DRIVERS...",
    "OPTIMIZING TENSOR FLOW...",
    "SYSTEM CHECK: PASS",
    "ESTABLISHING SECURE PIPELINE...",
    "LOADING UI FRAMEWORK...",
    "CANN.ON.AI READY."
  ];

  useEffect(() => {
    let delay = 0;
    bootLogs.forEach((log, index) => {
      // Varied timing for realism
      delay += Math.random() * 300 + 100;
      setTimeout(() => {
        setLogs(prev => [...prev, log]);
        if (index === bootLogs.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono text-neon-blue p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center animate-pulse">
          <div className="text-4xl font-bold mb-2 tracking-tighter">CANN.ON<span className="text-white">.AI</span></div>
          <div className="text-xs text-gray-500 uppercase tracking-[0.5em]">Bios Sequence Initiated</div>
        </div>
        
        <div 
          ref={scrollRef}
          className="h-64 border border-gray-800 bg-gray-900/50 rounded p-4 overflow-hidden font-xs relative shadow-[0_0_20px_rgba(0,243,255,0.1)]"
        >
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/20 z-10"></div>
          {logs.map((log, i) => (
            <div key={i} className="mb-1 text-sm">
              <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
              <span className={i === logs.length - 1 ? "text-white animate-pulse" : "text-neon-blue opacity-80"}>
                {log}
              </span>
            </div>
          ))}
          <div className="w-2 h-4 bg-neon-blue animate-pulse inline-block mt-1"></div>
        </div>

        <div className="mt-4 w-full bg-gray-900 h-1 rounded-full overflow-hidden">
           <div 
             className="h-full bg-neon-blue transition-all duration-300 ease-out"
             style={{ width: `${(logs.length / bootLogs.length) * 100}%` }}
           ></div>
        </div>
      </div>
    </div>
  );
};

export default BootSequence;