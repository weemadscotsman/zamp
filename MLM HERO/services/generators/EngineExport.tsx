import React from 'react';
import { GeneratedAsset } from '../types';

interface EngineExportProps {
  asset: GeneratedAsset | null;
}

const EngineExport: React.FC<EngineExportProps> = ({ asset }) => {
  if (!asset) return null;

  const handleDownload = (type: 'main' | 'normal' | 'roughness' | 'orm' | 'height' | 'spritesheet' | 'manifest', enginePrefix: string, suffix: string) => {
    // Determine URL based on asset type
    let url = asset.mediaType === 'VIDEO' ? asset.videoUrl : asset.imageUrl;
    let isBlob = false;
    
    // Override for maps and sheet
    if (type === 'normal' && asset.normalMapUrl) url = asset.normalMapUrl;
    if (type === 'roughness' && asset.roughnessMapUrl) url = asset.roughnessMapUrl;
    if (type === 'orm' && asset.ormMapUrl) url = asset.ormMapUrl;
    if (type === 'height' && asset.heightMapUrl) url = asset.heightMapUrl;
    if (type === 'spritesheet' && asset.spriteSheetUrl) url = asset.spriteSheetUrl;

    if (type === 'manifest') {
        const manifest = {
            version: "1.0",
            tool: "CANN.ON.AI",
            id: asset.id,
            timestamp: new Date(asset.timestamp).toISOString(),
            parameters: {
                prompt: asset.prompt,
                model: asset.model,
                style: asset.style,
                seed: asset.seed,
                engineFormat: asset.engineFormat
            },
            assets: {
                main: asset.mediaType === 'VIDEO' ? 'video.mp4' : 'albedo.png',
                normal: asset.normalMapUrl ? 'normal.png' : null,
                roughness: asset.roughnessMapUrl ? 'roughness.png' : null,
                orm: asset.ormMapUrl ? 'orm.png' : null,
                height: asset.heightMapUrl ? 'height.png' : null,
                spriteSheet: asset.spriteSheetUrl ? 'sheet.png' : null
            }
        };
        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
        url = URL.createObjectURL(blob);
        isBlob = true;
    }

    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    const timestamp = asset.timestamp;
    
    if (type === 'manifest') {
        a.download = `Asset_Manifest_${timestamp}.json`;
    } else if (asset.mediaType === 'VIDEO') {
        a.download = `Cutscene_${enginePrefix}_${timestamp}.mp4`;
    } else {
        a.download = `${enginePrefix}_${type === 'spritesheet' ? 'Sheet' : 'Sprite'}_${timestamp}${suffix}`;
    }
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    if (isBlob) URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 border-t border-gray-700 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-200 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-neon-green">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l-9 5.25m9-5.25l9-5.25" />
            </svg>
            Backend Generator Export
        </h3>
        <button 
            onClick={() => handleDownload('manifest', 'Meta', '.json')}
            className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-gray-600 hover:border-white px-3 py-1.5 rounded transition-all flex items-center gap-2"
        >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            JSON Manifest
        </button>
      </div>
      
      {asset.mediaType === 'VIDEO' ? (
        // Video Export Options
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => handleDownload('main', 'Universal', '.mp4')} className="bg-gray-800 border border-gray-600 rounded-lg p-4 hover:border-neon-purple hover:bg-gray-750 transition-all flex items-center justify-between group">
                <span className="font-bold text-gray-300 group-hover:text-white">Download MP4</span>
                <span className="text-neon-purple text-xs">H.264 High Quality</span>
             </button>
             <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-center text-gray-500 text-xs">
                Import as VideoStreamPlayer in Godot / MediaTexture in UE5
             </div>
        </div>
      ) : (
        // Image Export Options
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Unity */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="font-bold text-gray-300 mb-2 flex items-center gap-2 border-b border-gray-800 pb-2">
                    Unity (Standard)
                </div>
                <div className="space-y-2">
                    {asset.spriteSheetUrl ? (
                         <button onClick={() => handleDownload('spritesheet', 'Unity', '_Sheet.png')} className="w-full text-left text-xs bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 px-3 py-2 rounded text-white flex justify-between font-bold">
                            <span>Sprite Sheet</span> <span className="text-neon-green">PNG</span>
                        </button>
                    ) : (
                        <button onClick={() => handleDownload('main', 'Unity', '_Albedo.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400 flex justify-between">
                            <span>Albedo</span> <span className="text-neon-blue">RGBA</span>
                        </button>
                    )}
                    {asset.normalMapUrl && (
                        <button onClick={() => handleDownload('normal', 'Unity', '_Normal.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400 flex justify-between">
                            <span>Normal Map</span> <span className="text-neon-purple">RGB</span>
                        </button>
                    )}
                    {asset.roughnessMapUrl && (
                        <button onClick={() => handleDownload('roughness', 'Unity', '_Mask.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400 flex justify-between">
                            <span>Mask Map</span> <span className="text-green-500">M/O/H/S</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Unreal */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="font-bold text-gray-300 mb-2 flex items-center gap-2 border-b border-gray-800 pb-2">
                    Unreal Engine 5
                </div>
                <div className="space-y-2">
                    {asset.spriteSheetUrl ? (
                         <button onClick={() => handleDownload('spritesheet', 'UE5', '_Sheet.png')} className="w-full text-left text-xs bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 px-3 py-2 rounded text-white flex justify-between font-bold">
                            <span>Flipbook</span> <span className="text-neon-green">PNG</span>
                        </button>
                    ) : (
                        <button onClick={() => handleDownload('main', 'UE5', '_BaseColor.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400 flex justify-between">
                            <span>Base Color</span> <span className="text-neon-blue">RGB</span>
                        </button>
                    )}
                    {asset.normalMapUrl && (
                        <button onClick={() => handleDownload('normal', 'UE5', '_Normal.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400 flex justify-between">
                            <span>Normal</span> <span className="text-neon-purple">RGB</span>
                        </button>
                    )}
                    {asset.ormMapUrl && (
                        <button onClick={() => handleDownload('orm', 'UE5', '_ORM.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400 flex justify-between">
                            <span>ORM Packed</span> <span className="text-red-400">R:Occ G:Rough B:Met</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Godot */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="font-bold text-gray-300 mb-2 flex items-center gap-2 border-b border-gray-800 pb-2">
                    Godot 4
                </div>
                <div className="space-y-2">
                    {asset.spriteSheetUrl ? (
                         <button onClick={() => handleDownload('spritesheet', 'Godot', '_Sheet.png')} className="w-full text-left text-xs bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 px-3 py-2 rounded text-white font-bold">Download Sprite Sheet</button>
                    ) : (
                        <button onClick={() => handleDownload('main', 'Godot', '_albedo.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400">Download Albedo</button>
                    )}
                    {asset.normalMapUrl && <button onClick={() => handleDownload('normal', 'Godot', '_normal.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400">Download Normal</button>}
                    {asset.roughnessMapUrl && <button onClick={() => handleDownload('roughness', 'Godot', '_roughness.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400">Download Roughness</button>}
                    {asset.heightMapUrl && <button onClick={() => handleDownload('height', 'Godot', '_height.png')} className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-400">Download Height/Depth</button>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default EngineExport;