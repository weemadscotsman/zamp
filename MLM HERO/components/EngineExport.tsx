
import React from 'react';
import { GeneratedAsset } from '../types';

interface EngineExportProps {
  asset: GeneratedAsset | null;
}

const EngineExport: React.FC<EngineExportProps> = ({ asset }) => {
  if (!asset) return null;

  const handleDownload = (type: 'main' | 'normal' | 'roughness' | 'orm' | 'height', engine: string, suffix: string) => {
      let url = asset.imageUrl;
      if (type === 'normal') url = asset.normalMapUrl;
      if (type === 'roughness') url = asset.roughnessMapUrl;
      if (type === 'orm') url = asset.ormMapUrl;
      if (type === 'height') url = asset.heightMapUrl;
      
      if (!url) return;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${engine}_${type}_${Date.now()}${suffix}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  return (
    <div className="mt-4 pt-4 border-t border-zinc-800">
      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">One-Click Engine Export</h4>
      <div className="grid grid-cols-3 gap-2">
         {/* Unity */}
         <div className="bg-zinc-900 p-2 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
             <div className="text-[10px] text-zinc-300 font-bold mb-1 border-b border-zinc-800 pb-1">Unity</div>
             <div className="space-y-1">
                 <button onClick={() => handleDownload('main', 'Unity', '_Albedo.png')} className="w-full text-left text-[9px] text-zinc-500 hover:text-white">Albedo</button>
                 {asset.normalMapUrl && <button onClick={() => handleDownload('normal', 'Unity', '_Normal.png')} className="w-full text-left text-[9px] text-purple-400 hover:text-white">Normal</button>}
                 {asset.roughnessMapUrl && <button onClick={() => handleDownload('roughness', 'Unity', '_Mask.png')} className="w-full text-left text-[9px] text-green-400 hover:text-white">Mask Map</button>}
             </div>
         </div>
         {/* Unreal */}
         <div className="bg-zinc-900 p-2 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
             <div className="text-[10px] text-zinc-300 font-bold mb-1 border-b border-zinc-800 pb-1">Unreal 5</div>
             <div className="space-y-1">
                 <button onClick={() => handleDownload('main', 'UE5', '_BaseColor.png')} className="w-full text-left text-[9px] text-zinc-500 hover:text-white">Base Color</button>
                 {asset.ormMapUrl && <button onClick={() => handleDownload('orm', 'UE5', '_ORM.png')} className="w-full text-left text-[9px] text-red-400 hover:text-white">ORM Packed</button>}
             </div>
         </div>
         {/* Godot */}
         <div className="bg-zinc-900 p-2 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
             <div className="text-[10px] text-zinc-300 font-bold mb-1 border-b border-zinc-800 pb-1">Godot</div>
             <div className="space-y-1">
                 <button onClick={() => handleDownload('main', 'Godot', '_albedo.png')} className="w-full text-left text-[9px] text-zinc-500 hover:text-white">Albedo</button>
                 {asset.heightMapUrl && <button onClick={() => handleDownload('height', 'Godot', '_height.png')} className="w-full text-left text-[9px] text-blue-400 hover:text-white">Height</button>}
             </div>
         </div>
      </div>
    </div>
  );
};

export default EngineExport;
