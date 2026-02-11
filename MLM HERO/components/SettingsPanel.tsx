
import React, { useState } from 'react';
import { ModelType, ImageSize, RenderStyle, MediaType, VideoModel, AdvancedConfig, AssetGenerationMode } from '../types';
import { Icons } from './Icons';

interface SettingsPanelProps {
  mediaType: MediaType;
  setMediaType: (t: MediaType) => void;
  model: ModelType;
  setModel: (m: ModelType) => void;
  style: RenderStyle;
  setStyle: (s: RenderStyle) => void;
  imageSize: ImageSize;
  setImageSize: (s: ImageSize) => void;
  assetMode: AssetGenerationMode;
  setAssetMode: (m: AssetGenerationMode) => void;
  animAction: string;
  setAnimAction: (a: string) => void;
  onGenerateAll: () => void;
  videoModel: VideoModel;
  setVideoModel: (m: VideoModel) => void;
  openRouterKey: string;
  setOpenRouterKey: (k: string) => void;
  openRouterModel: string;
  setOpenRouterModel: (m: string) => void;
  advancedConfig: AdvancedConfig;
  setAdvancedConfig: (c: AdvancedConfig) => void;
  aspectRatio: string;
  setAspectRatio: (ar: string) => void;
  disabled: boolean;
  onStyleSelect: (style: string) => void;
  autoPbr?: boolean;
  setAutoPbr?: (v: boolean) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 backdrop-blur-sm">
      <div className="flex gap-2 mb-4 border-b border-zinc-800 pb-2">
         <button onClick={() => props.setMediaType('IMAGE')} className={`flex-1 py-2 text-xs font-bold uppercase rounded tracking-wide transition-all ${props.mediaType === 'IMAGE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>Asset Generator</button>
         <button onClick={() => props.setMediaType('VIDEO')} className={`flex-1 py-2 text-xs font-bold uppercase rounded tracking-wide transition-all ${props.mediaType === 'VIDEO' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>Cutscene Director</button>
      </div>

      {props.mediaType === 'IMAGE' ? (
        <div className="flex flex-col gap-3">
             
             {/* MODE SELECTOR */}
             <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                 <button 
                    onClick={() => props.setAssetMode(AssetGenerationMode.SPRITE)}
                    className={`text-[10px] font-bold uppercase py-1.5 rounded transition-all flex flex-col items-center gap-1 ${props.assetMode === AssetGenerationMode.SPRITE ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                    <Icons.Box className="w-3 h-3" />
                    Sprite
                 </button>
                 <button 
                    onClick={() => props.setAssetMode(AssetGenerationMode.SHEET)}
                    className={`text-[10px] font-bold uppercase py-1.5 rounded transition-all flex flex-col items-center gap-1 ${props.assetMode === AssetGenerationMode.SHEET ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                    <Icons.Layers className="w-3 h-3" />
                    Animator
                 </button>
                 <button 
                    onClick={() => props.setAssetMode(AssetGenerationMode.TEXTURE)}
                    className={`text-[10px] font-bold uppercase py-1.5 rounded transition-all flex flex-col items-center gap-1 ${props.assetMode === AssetGenerationMode.TEXTURE ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                    <Icons.Code className="w-3 h-3" />
                    Texture
                 </button>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Model Architecture</label>
                    <select value={props.model} onChange={(e) => props.setModel(e.target.value as ModelType)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors">
                        <option value={ModelType.NANO_BANANA}>Nano Banana (Flash)</option>
                        <option value={ModelType.NANO_BANANA_PRO}>Nano Banana Pro (HD)</option>
                    </select>
                 </div>
                 
                 {props.assetMode === AssetGenerationMode.TEXTURE ? (
                     <div className="opacity-50 pointer-events-none">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Render Style</label>
                        <div className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-400">Locked: Seamless PBR</div>
                     </div>
                 ) : (
                     <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Render Style</label>
                        <select value={props.style} onChange={(e) => props.setStyle(e.target.value as RenderStyle)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors">
                            <option value={RenderStyle.PRE_RENDERED_3D}>3D Pre-Rendered</option>
                            <option value={RenderStyle.FLAT_2D}>Flat 2D Sprite</option>
                        </select>
                     </div>
                 )}
             </div>
             
             {props.assetMode === AssetGenerationMode.SHEET && (
                 <div className="bg-zinc-900 border border-zinc-800 p-2 rounded">
                     <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Kinematic Action</label>
                     <div className="flex gap-2">
                        <select value={props.animAction} onChange={(e) => props.setAnimAction(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white outline-none">
                            <option>Walk Cycle</option>
                            <option>Run Cycle</option>
                            <option>Idle Animation</option>
                            <option>Attack (Melee)</option>
                            <option>Attack (Ranged)</option>
                            <option>Jump</option>
                            <option>Death</option>
                        </select>
                        <button 
                            onClick={props.onGenerateAll}
                            className="bg-zinc-800 hover:bg-zinc-700 text-xs text-white px-3 rounded border border-zinc-700 uppercase font-bold tracking-tight whitespace-nowrap"
                            title="Generate Full Move-Set Batch"
                        >
                            Batch All
                        </button>
                     </div>
                 </div>
             )}
             
             <div className="col-span-2">
                 <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={props.autoPbr} onChange={(e) => props.setAutoPbr && props.setAutoPbr(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-indigo-500 focus:ring-offset-0 focus:ring-0" />
                    <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors uppercase">Auto-Bake PBR Maps (Normal/Roughness)</span>
                 </label>
             </div>
        </div>
      ) : (
          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Video Engine</label>
                <select value={props.videoModel} onChange={(e) => props.setVideoModel(e.target.value as VideoModel)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none">
                    <option value={VideoModel.VEO_FAST}>Veo 3.1 (Fast)</option>
                    <option value={VideoModel.VEO_HQ}>Veo 3.1 (HQ)</option>
                    <option value={VideoModel.OPEN_ROUTER}>OpenRouter (External)</option>
                </select>
             </div>
             <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Aspect Ratio</label>
                <select value={props.aspectRatio} onChange={(e) => props.setAspectRatio(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none">
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                </select>
             </div>
          </div>
      )}

      {/* GOD MODE SETTINGS */}
      <div className="mt-4 border-t border-zinc-800 pt-2">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white w-full py-1"
          >
              <Icons.Cpu className="w-3 h-3" />
              Neural Overrides (God Mode)
              <span className="ml-auto transform transition-transform duration-200" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </button>
          
          {showAdvanced && (
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Temperature (Chaos)</label>
                          <input 
                            type="number" step="0.1" min="0" max="2" 
                            value={props.advancedConfig.temperature} 
                            onChange={(e) => props.setAdvancedConfig({...props.advancedConfig, temperature: parseFloat(e.target.value)})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white"
                          />
                      </div>
                      <div>
                          <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Seed (Determinism)</label>
                          <input 
                            type="number" placeholder="0 = Random"
                            value={props.advancedConfig.seed} 
                            onChange={(e) => props.setAdvancedConfig({...props.advancedConfig, seed: parseInt(e.target.value)})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white"
                          />
                      </div>
                  </div>
                   <div>
                        <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">System Instruction Override</label>
                        <textarea 
                            placeholder="E.g., You are a strict pixel artist limited to 16 colors..."
                            value={props.advancedConfig.systemInstruction}
                            onChange={(e) => props.setAdvancedConfig({...props.advancedConfig, systemInstruction: e.target.value})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white h-16 resize-none"
                        />
                   </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default SettingsPanel;
