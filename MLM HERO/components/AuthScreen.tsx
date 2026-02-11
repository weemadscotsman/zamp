import React, { useState } from 'react';

interface AuthScreenProps {
  onStartTrial: () => void;
  onEnterKey: (key: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onStartTrial, onEnterKey }) => {
  const [inputKey, setInputKey] = useState('');

  return (
    <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black z-[90] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Left: Branding */}
        <div className="flex flex-col justify-center text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-600 mb-4 tracking-tight">
            CANN.ON<br/><span className="text-neon-blue">.AI</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-md">
            The bleeding edge AI asset pipeline. <br/>
            <span className="text-neon-blue">Nano Banana</span> • <span className="text-neon-purple">Veo 3.1</span> • <span className="text-neon-green">Engine Ready</span>
          </p>
          <div className="hidden md:flex gap-4 text-xs text-gray-600 font-mono uppercase tracking-widest">
            <span>v3.0.0-RELEASE</span>
            <span>•</span>
            <span>System Online</span>
          </div>
        </div>

        {/* Right: Auth Options */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 flex flex-col justify-center shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue opacity-50 group-hover:opacity-100 transition-opacity"></div>
          
          <h2 className="text-2xl font-bold text-white mb-6">Initialize Session</h2>

          {/* Option A: Trial */}
          <div className="mb-8 pb-8 border-b border-gray-800">
            <button 
              onClick={onStartTrial}
              className="w-full py-4 bg-white text-black font-bold text-lg rounded-lg hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.02] flex items-center justify-center gap-2 group/btn"
            >
              Start Free Session
              <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
            <p className="text-xs text-center text-gray-500 mt-3 font-mono">
              15 MINUTE SESSION LIMIT • DEFAULT MODELS
            </p>
          </div>

          {/* Option B: Key */}
          <div>
            <label className="block text-xs font-bold text-neon-purple mb-2 uppercase tracking-wider">
              OpenRouter Key (Pro Access)
            </label>
            <div className="flex gap-2">
              <input 
                type="password" 
                placeholder="sk-or-v1-..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:border-neon-purple outline-none transition-colors"
              />
              <button 
                onClick={() => inputKey && onEnterKey(inputKey)}
                disabled={!inputKey}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 rounded-lg font-bold border border-gray-700 transition-all"
              >
                Enter
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              Unlocks unlimited session time and access to external video models via OpenRouter.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AuthScreen;