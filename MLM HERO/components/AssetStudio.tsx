
import React, { useState, useRef } from 'react';
import { ModelType, ImageSize, GeneratedAsset, ProcessingState, RenderStyle, MediaType, VideoModel, AdvancedConfig, AssetRole, AssetGenerationMode } from '../types';
import SettingsPanel from './SettingsPanel';
import EngineExport from './EngineExport';
import { generateGameAsset, generateVeoVideo } from '../services/assetService';
import { generateOpenRouterVideo } from '../services/openRouterService';
import { blobToBase64 } from '../services/utils/fileUtils';
import { generateMaps } from '../services/textureService';
import { Icons } from './Icons';

interface AssetStudioProps {
    onAssetAssigned?: (asset: GeneratedAsset) => void;
}

const BATCH_ACTIONS = [
    'Idle Animation',
    'Walk Cycle',
    'Run Cycle',
    'Jump Animation',
    'Attack (Melee)',
    'Hit Reaction',
    'Death'
];

export const AssetStudio: React.FC<AssetStudioProps> = ({ onAssetAssigned }) => {
  const [mediaType, setMediaType] = useState<MediaType>('IMAGE');
  const [prompt, setPrompt] = useState('');
  
  // Image State
  const [model, setModel] = useState<ModelType>(ModelType.NANO_BANANA);
  const [style, setStyle] = useState<RenderStyle>(RenderStyle.PRE_RENDERED_3D);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [autoPbr, setAutoPbr] = useState(true);
  
  // Asset Mode State
  const [assetMode, setAssetMode] = useState<AssetGenerationMode>(AssetGenerationMode.SPRITE);
  const [animAction, setAnimAction] = useState('Walk Cycle');

  // Advanced State
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>({
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      seed: 0,
      systemInstruction: ""
  });
  
  // Video State
  const [videoModel, setVideoModel] = useState<VideoModel>(VideoModel.VEO_FAST);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('luma/ray-2');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ 
    isGenerating: false, stage: '', progress: 0 
  });
  const [error, setError] = useState<string | null>(null);
  
  // Assignment State
  const [selectedRole, setSelectedRole] = useState<AssetRole>(AssetRole.NONE);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedImage(file);
      const base64 = await blobToBase64(file);
      setUploadedPreview(`data:${file.type};base64,${base64}`);
    }
  };

  const handleStyleSelect = (s: string) => {
    if (prompt.includes(s)) return;
    setPrompt(prev => prev ? `${prev}, ${s}` : s);
  };

  const createAssetObject = (
    id: string, 
    type: MediaType, 
    url: string, 
    mode: AssetGenerationMode, 
    currentSeed: number
  ): GeneratedAsset => {
      return {
          id,
          mediaType: type,
          imageUrl: type === 'IMAGE' ? url : undefined,
          videoUrl: type === 'VIDEO' ? url : undefined,
          spriteSheetUrl: mode === AssetGenerationMode.SHEET ? url : undefined,
          isSpriteSheet: mode === AssetGenerationMode.SHEET,
          timestamp: Date.now(),
          prompt, model, seed: currentSeed, style, 
          engineFormat: type === 'VIDEO' ? 'MP4' : 'Universal',
          role: AssetRole.NONE
      };
  };

  // --- BATCH GENERATOR LOGIC ---
  const handleGenerateBatch = async () => {
      if (!prompt && !uploadedImage) {
          setError("Batch requires a prompt or uploaded identity source.");
          return;
      }
      setError(null);

      // Lock seed if random to ensure consistency across batch
      const runtimeSeed = advancedConfig.seed === 0 
        ? Math.floor(Math.random() * 2147483647) 
        : advancedConfig.seed;

      setProcessing({ isGenerating: true, stage: 'Batch Init: Locking Identity...', progress: 0 });

      try {
          // Iterate SEQUENTIALLY to avoid rate limits and browser choke
          for (let i = 0; i < BATCH_ACTIONS.length; i++) {
              const currentAction = BATCH_ACTIONS[i];
              
              setProcessing({ 
                isGenerating: true, 
                stage: `Batch: Generating ${currentAction} (${i + 1}/${BATCH_ACTIONS.length})...`, 
                progress: ((i) / BATCH_ACTIONS.length) * 100 
              });

              // Add small delay buffer (2s)
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 2000));

              const resultImage = await generateGameAsset({
                prompt,
                sourceImage: uploadedImage,
                model,
                style,
                imageSize,
                aspectRatio,
                advancedConfig,
                runtimeSeed,
                assetMode: AssetGenerationMode.SHEET,
                animationAction: currentAction
            });

            const newAsset = createAssetObject(
                crypto.randomUUID(), 
                'IMAGE', 
                resultImage, 
                AssetGenerationMode.SHEET, 
                runtimeSeed
            );
            
            // In a real app we'd append to a history list. 
            // Here we just set the last one as current but the user sees progress.
            // Ideally we'd trigger an onAssetCreated prop here to update the parent history.
            setGeneratedAsset(newAsset);
            
            // Auto-assign role if needed, or just log
            console.log(`Generated ${currentAction}`);
          }
          
          setProcessing({ isGenerating: false, stage: 'Batch Complete', progress: 100 });

      } catch (err: any) {
          console.error("Batch Failed:", err);
          setError(`Batch halted: ${err.message}`);
          setProcessing({ isGenerating: false, stage: 'Error', progress: 0 });
      }
  };

  const handleGenerate = async () => {
    if (!prompt && !uploadedImage) {
      setError("Please provide a text prompt or upload an image.");
      return;
    }

    setError(null);
    setGeneratedAsset(null);
    setProcessing({ isGenerating: true, stage: 'Initializing Backend Generator...', progress: 5 });

    const runtimeSeed = advancedConfig.seed === 0 
        ? Math.floor(Math.random() * 2147483647) 
        : advancedConfig.seed;

    try {
        if (mediaType === 'IMAGE') {
            setProcessing(prev => ({ ...prev, stage: 'Generating Asset...', progress: 20 }));
            const resultImage = await generateGameAsset({
                prompt,
                sourceImage: uploadedImage,
                model,
                style,
                imageSize,
                aspectRatio,
                advancedConfig,
                runtimeSeed,
                assetMode,
                animationAction: animAction
            });

            setProcessing({ isGenerating: false, stage: 'Finalizing...', progress: 100 });

            const newAsset = createAssetObject(
                crypto.randomUUID(), 
                'IMAGE', 
                resultImage, 
                assetMode, 
                runtimeSeed
            );

            setGeneratedAsset(newAsset);
            
            // Auto PBR for Textures and 3D Sprites
            if (autoPbr && assetMode !== AssetGenerationMode.SHEET) {
                handleGeneratePBR(newAsset);
            }

        } else {
            setProcessing(prev => ({ ...prev, stage: 'Rendering Video...', progress: 10 }));
            
            let videoUrl = '';
            if (videoModel === VideoModel.OPEN_ROUTER) {
                if (!openRouterKey) throw new Error("OpenRouter API Key required.");
                const base64 = uploadedImage ? await blobToBase64(uploadedImage) : undefined;
                videoUrl = await generateOpenRouterVideo({
                    prompt,
                    apiKey: openRouterKey,
                    model: openRouterModel,
                    sourceImage: base64 ? `data:${uploadedImage?.type};base64,${base64}` : undefined
                });
            } else {
                videoUrl = await generateVeoVideo({
                    prompt,
                    sourceImage: uploadedImage,
                    model: videoModel,
                    aspectRatio
                });
            }
            
            setProcessing({ isGenerating: false, stage: 'Done', progress: 100 });
            setGeneratedAsset({
                id: crypto.randomUUID(),
                mediaType: 'VIDEO',
                videoUrl,
                timestamp: Date.now(),
                prompt, model: videoModel, seed: 0, engineFormat: 'MP4',
            });
        }
    } catch (err: any) {
      setProcessing({ isGenerating: false, stage: 'Error', progress: 0 });
      setError(err.message);
    }
  };

  const handleGeneratePBR = async (targetAsset: GeneratedAsset) => {
    if (!targetAsset.imageUrl) return;
    setProcessing({ isGenerating: true, stage: 'Baking PBR Maps...', progress: 50 });
    try {
        const maps = await generateMaps(targetAsset.imageUrl);
        setGeneratedAsset({
            ...targetAsset,
            normalMapUrl: maps.normal,
            roughnessMapUrl: maps.roughness,
            ormMapUrl: maps.orm,
            heightMapUrl: maps.height
        });
        setProcessing({ isGenerating: false, stage: 'Done', progress: 100 });
    } catch (err) {
        setProcessing({ isGenerating: false, stage: 'Error generating maps', progress: 0 });
    }
  };

  const handleAssignRole = () => {
      if (generatedAsset && onAssetAssigned) {
          const updated = { ...generatedAsset, role: selectedRole };
          onAssetAssigned(updated);
          // Visual feedback
          const btn = document.getElementById('assign-btn');
          if(btn) {
              const orig = btn.innerText;
              btn.innerText = "INJECTED";
              btn.classList.add("bg-indigo-600");
              setTimeout(() => { 
                  btn.innerText = orig; 
                  btn.classList.remove("bg-indigo-600");
              }, 1000);
          }
      }
  };

  return (
    <div className="flex h-full gap-6 p-4">
      {/* LEFT COLUMN: Controls */}
      <div className="w-1/3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
        
        {/* Upload Zone */}
        <div 
          className={`relative group border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer ${
            uploadedPreview ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-700 bg-zinc-900/50 hover:border-indigo-500/50 hover:bg-zinc-800'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
          />
          
          {uploadedPreview ? (
            <div className="relative z-0">
              <img src={uploadedPreview} alt="Upload" className="w-full h-32 object-contain rounded-lg shadow-lg" />
              <div className="absolute top-2 right-2 bg-indigo-600/90 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm border border-indigo-400/50 shadow-lg animate-pulse font-bold tracking-wider">
                 IDENTITY LOCK ACTIVE
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation(); setUploadedImage(null); setUploadedPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-20 hover:bg-red-600 transition-colors"
              >
                <Icons.Warning className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-2 py-2">
              <Icons.Atom className="w-8 h-8 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
              <p className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">UPLOAD REFERENCE</p>
              <p className="text-[9px] text-zinc-600">Extracts DNA for consistent character generation</p>
            </div>
          )}
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex justify-between">
            <span>{assetMode === AssetGenerationMode.TEXTURE ? 'Material Spec' : 'Description'}</span>
            <span className="text-zinc-600">{prompt.length} chars</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={assetMode === AssetGenerationMode.TEXTURE 
                ? "Seamless rusty metal floor, hexagonal pattern, sci-fi vent details..." 
                : "A cyberpunk street samurai, neon katana, chrome arm..."}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-24 text-xs placeholder-zinc-700"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={processing.isGenerating}
          className={`w-full py-3 rounded-lg font-bold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 ${
            processing.isGenerating
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95'
          }`}
        >
          {processing.isGenerating ? <Icons.Zap className="w-4 h-4 animate-spin" /> : <Icons.Zap className="w-4 h-4" />}
          {processing.isGenerating ? processing.stage : "GENERATE ASSET"}
        </button>

        {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded border border-red-500/20 flex items-center gap-2"><Icons.Warning className="w-3 h-3"/> {error}</div>}
      </div>

      {/* RIGHT COLUMN: Settings & Preview */}
      <div className="flex-1 flex flex-col h-full min-h-0">
        <SettingsPanel 
          mediaType={mediaType} setMediaType={setMediaType}
          model={model} setModel={setModel}
          style={style} setStyle={setStyle}
          imageSize={imageSize} setImageSize={setImageSize}
          assetMode={assetMode} setAssetMode={setAssetMode}
          animAction={animAction} setAnimAction={setAnimAction}
          onGenerateAll={handleGenerateBatch} 
          videoModel={videoModel} setVideoModel={setVideoModel}
          openRouterKey={openRouterKey} setOpenRouterKey={setOpenRouterKey}
          openRouterModel={openRouterModel} setOpenRouterModel={setOpenRouterModel}
          advancedConfig={advancedConfig} setAdvancedConfig={setAdvancedConfig}
          aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
          disabled={processing.isGenerating}
          onStyleSelect={handleStyleSelect}
          autoPbr={autoPbr} setAutoPbr={setAutoPbr}
        />

        <div className="flex-grow bg-zinc-950 rounded-xl border border-zinc-800 relative flex items-center justify-center overflow-hidden mt-4 group">
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
          />
          
          {generatedAsset ? (
            <div className="flex flex-col items-center gap-4 max-h-full overflow-y-auto p-4 w-full z-10">
                {generatedAsset.mediaType === 'VIDEO' ? (
                    <video src={generatedAsset.videoUrl} controls autoPlay loop className="max-h-[300px] rounded shadow-2xl border border-zinc-800" />
                ) : (
                    <img src={generatedAsset.spriteSheetUrl || generatedAsset.imageUrl} className="max-h-[300px] object-contain shadow-2xl border border-zinc-800 bg-[url('https://transparent-textures.patterns.s3.amazonaws.com/subtle_dots.png')]" />
                )}
                
                {/* Maps Preview */}
                {generatedAsset.normalMapUrl && (
                    <div className="flex gap-2 p-2 bg-zinc-900/80 rounded-lg border border-zinc-800">
                        <div className="text-center group/map cursor-pointer">
                             <div className="text-[8px] text-zinc-500 uppercase mb-1">Normal</div>
                             <img src={generatedAsset.normalMapUrl} className="w-12 h-12 border border-zinc-700 rounded bg-black/50 hover:scale-150 transition-transform origin-bottom" />
                        </div>
                         <div className="text-center group/map cursor-pointer">
                             <div className="text-[8px] text-zinc-500 uppercase mb-1">Rough</div>
                             <img src={generatedAsset.roughnessMapUrl} className="w-12 h-12 border border-zinc-700 rounded bg-black/50 hover:scale-150 transition-transform origin-bottom" />
                        </div>
                         <div className="text-center group/map cursor-pointer">
                             <div className="text-[8px] text-zinc-500 uppercase mb-1">ORM</div>
                             <img src={generatedAsset.ormMapUrl} className="w-12 h-12 border border-zinc-700 rounded bg-black/50 hover:scale-150 transition-transform origin-bottom" />
                        </div>
                    </div>
                )}
            </div>
          ) : (
              <div className="text-zinc-700 flex flex-col items-center select-none">
                  <Icons.Box className="w-16 h-16 mb-4 opacity-10" />
                  <span className="text-xs uppercase tracking-widest font-bold opacity-30">Awaiting Neural Input</span>
              </div>
          )}

          {processing.isGenerating && (
             <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                 <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${processing.progress}%` }} />
                 </div>
                 <span className="text-indigo-400 text-xs font-mono mt-3 animate-pulse uppercase tracking-wider">{processing.stage}</span>
             </div>
          )}
        </div>

        {/* --- ASSIGNMENT PANEL --- */}
        {generatedAsset && generatedAsset.mediaType === 'IMAGE' && (
            <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3 flex-1">
                    <Icons.Code className="w-4 h-4 text-green-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Inject into Prototype:</span>
                    <select 
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as AssetRole)}
                        className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white outline-none flex-1 transition-colors focus:border-green-500"
                    >
                        <option value={AssetRole.NONE}>-- Select Role --</option>
                        {Object.values(AssetRole).filter(r => r !== AssetRole.NONE).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                </div>
                <button 
                    id="assign-btn"
                    onClick={handleAssignRole}
                    disabled={selectedRole === AssetRole.NONE}
                    className="ml-4 px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded uppercase tracking-wide transition-all shadow-lg shadow-green-900/20"
                >
                    Confirm Injection
                </button>
            </div>
        )}

        <EngineExport asset={generatedAsset} />
      </div>
    </div>
  );
};
