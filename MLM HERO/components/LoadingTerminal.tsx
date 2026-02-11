import React, { useEffect, useRef } from 'react';
import { Icons } from './Icons';

interface Props {
  logs: string[];
  phase: string;
  onAbort: () => void;
}

export const LoadingTerminal: React.FC<Props> = ({ logs, phase, onAbort }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full h-full flex flex-col bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl font-mono text-xs relative">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Icons.Terminal className="w-4 h-4 text-green-500 animate-pulse" />
          <span className="text-zinc-400 font-bold uppercase tracking-wider">
            FORGE_KERNEL_V1.2 :: {phase.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
      </div>

      {/* Log Output */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-1 bg-black/95"
      >
        {logs.length === 0 && (
            <div className="text-zinc-600 italic">Initializing subsystem...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="text-zinc-600 select-none">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
            <span className={`break-words ${
                log.includes("ERROR") ? "text-red-500 font-bold" :
                log.includes("SUCCESS") ? "text-green-400" :
                log.includes("WARN") ? "text-yellow-400" :
                log.includes(">>>") ? "text-indigo-400 font-bold" :
                "text-zinc-300"
            }`}>
              {log}
            </span>
          </div>
        ))}
        {/* Blinking Cursor */}
        <div className="h-4 w-2 bg-green-500 animate-pulse mt-2" />
      </div>

      {/* Footer / Abort */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
         <div className="flex items-center gap-2 text-zinc-500">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
             <span>Processing...</span>
         </div>
         <button 
            onClick={onAbort}
            className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 rounded text-[10px] font-bold uppercase tracking-wide transition-colors"
         >
            ABORT PROCESS
         </button>
      </div>
    </div>
  );
};