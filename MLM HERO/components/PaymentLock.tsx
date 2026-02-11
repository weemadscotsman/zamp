import React, { useState } from 'react';

interface PaymentLockProps {
  onUnlock: () => void;
}

const PaymentLock: React.FC<PaymentLockProps> = ({ onUnlock }) => {
  const [copied, setCopied] = useState<string | null>(null);

  // TODO: Replace with actual wallet addresses
  const USDT_ADDRESS = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"; 
  const XRP_ADDRESS = "rMdG3ju8pgyVh29ELPWaDuA48RyrgVPFec";

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-pulse">
        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h2 className="text-4xl font-bold text-white mb-2">SESSION EXPIRED</h2>
      <p className="text-red-400 font-mono text-xl mb-8 tracking-widest">TIME LIMIT REACHED [15:00]</p>
      
      <div className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <p className="text-gray-300 mb-6 text-lg">
          To continue using the bleeding edge capabilities of CANN.ON.AI, please support the development via Crypto.
        </p>
        
        <div className="space-y-4 mb-8">
            {/* USDT */}
            <div className="bg-black/50 rounded-xl p-4 border border-gray-800 flex items-center justify-between group hover:border-neon-green/50 transition-colors">
                <div className="text-left">
                    <div className="text-[10px] text-neon-green font-bold uppercase mb-1">USDT (TRC20/ERC20)</div>
                    <div className="font-mono text-xs text-gray-300 break-all">{USDT_ADDRESS}</div>
                </div>
                <button 
                    onClick={() => handleCopy(USDT_ADDRESS, 'USDT')}
                    className="ml-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="Copy Address"
                >
                    {copied === 'USDT' ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    )}
                </button>
            </div>

            {/* XRP */}
            <div className="bg-black/50 rounded-xl p-4 border border-gray-800 flex items-center justify-between group hover:border-neon-blue/50 transition-colors">
                <div className="text-left">
                    <div className="text-[10px] text-neon-blue font-bold uppercase mb-1">XRP (Ripple)</div>
                    <div className="font-mono text-xs text-gray-300 break-all">{XRP_ADDRESS}</div>
                </div>
                <button 
                    onClick={() => handleCopy(XRP_ADDRESS, 'XRP')}
                    className="ml-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="Copy Address"
                >
                     {copied === 'XRP' ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    )}
                </button>
            </div>
        </div>

        <button 
            onClick={onUnlock}
            className="w-full py-4 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue bg-[length:200%_auto] hover:bg-right text-white font-bold rounded-lg transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(188,19,254,0.4)]"
        >
          Verify Payment & Unlock Session
        </button>
        
        <p className="text-[10px] text-gray-600 mt-4">
          Automated verification typically takes 1-2 block confirmations.
        </p>
      </div>
    </div>
  );
};

export default PaymentLock;