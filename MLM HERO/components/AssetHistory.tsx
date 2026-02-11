import React from 'react';
import { GeneratedAsset } from '../types';

interface AssetHistoryProps {
  history: GeneratedAsset[];
  onSelect: (asset: GeneratedAsset) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const AssetHistory: React.FC<AssetHistoryProps> = ({ history, onSelect, onDelete, onClose }) => {
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-950/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col font-sans">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/40">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_10px_#00f3ff]"></span>
            Session Lineage
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-gray-500 text-xs font-medium">No history yet.</p>
                <p className="text-gray-600 text-[10px] mt-1">Assets you generate will appear here automatically.</p>
            </div>
        ) : (
            history.map((asset) => (
                <div key={asset.id} className="group relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-neon-blue/50 transition-all shadow-lg hover:shadow-neon-blue/10">
                    <div className="aspect-video bg-black/50 relative cursor-pointer border-b border-gray-800" onClick={() => onSelect(asset)}>
                        {asset.mediaType === 'VIDEO' ? (
                            <video src={asset.videoUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                        ) : (
                            <img src={asset.spriteSheetUrl || asset.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                        
                        <div className="absolute top-2 left-2">
                             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-md ${
                                 asset.mediaType === 'VIDEO' 
                                 ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' 
                                 : 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue'
                             }`}>
                                {asset.mediaType}
                             </span>
                        </div>
                    </div>
                    
                    <div className="p-3">
                        <div className="flex justify-between items-center mb-1.5">
                             <div className="text-[10px] text-gray-500 font-mono">
                                {new Date(asset.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </div>
                             {asset.style && (
                                 <div className="text-[9px] text-gray-600 uppercase font-bold tracking-tight">
                                     {asset.style.replace('_', ' ')}
                                 </div>
                             )}
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-2 mb-3 font-medium leading-relaxed opacity-90" title={asset.prompt}>
                            {asset.prompt}
                        </p>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-gray-800/50">
                            <button 
                                onClick={() => onSelect(asset)}
                                className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Restore
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
                                className="text-[10px] font-bold text-gray-600 hover:text-red-400 uppercase tracking-wider transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>
      
      {history.length > 0 && (
          <div className="p-4 border-t border-gray-800 bg-gray-900/50">
              <button 
                onClick={() => {
                    if(confirm('Clear entire session history? This cannot be undone.')) {
                        history.forEach(h => onDelete(h.id));
                    }
                }}
                className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded transition-all uppercase tracking-wide"
              >
                  Clear Session
              </button>
          </div>
      )}
    </div>
  );
};

export default AssetHistory;