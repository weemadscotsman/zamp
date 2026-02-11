import React, { useState, useRef, useEffect } from 'react';
import { ModelType, ImageSize, GeneratedAsset, ProcessingState, RenderStyle, MediaType, VideoModel, AdvancedConfig } from './types';
import SettingsPanel from './components/SettingsPanel';
import EngineExport from './components/EngineExport';
import UserGuide from './components/UserGuide';
import AssetHistory from './components/AssetHistory';
import BootSequence from './components/BootSequence';
import AuthScreen from './components/AuthScreen';
import PaymentLock from './components/PaymentLock';
import { generateGameAsset, generateVeoVideo, blobToBase64, base64ToBlob } from './services/geminiService';
import { generateOpenRouterVideo } from './services/openRouterService';
import { generateMaps } from './services/textureService';
import { saveHistory, getHistory } from './services/storageService';

// App States
type AppState = 'BOOT' | 'AUTH' | 'APP' | 'LOCKED';

// Full List for Batch Generation
const BATCH_ACTIONS = [
    'Idle Animation',
    'Walk Cycle',
    'Run Cycle',
    'Jump Animation',
    'Fighting / Combat',
    'Attacking (Melee)',
    'Attacking (Ranged)',
    'Hiding / Crouch',
    'Hit Reaction',
    'Death / Collapse'
];

const App: React.FC = () => {
  // --- Lifecycle State ---
  const [appState, setAppState] = useState<AppState>('BOOT');
  const [isTrialMode, setIsTrialMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds

  // --- App Feature State ---
  const [mediaType, setMediaType] = useState<MediaType>('IMAGE');
  const [prompt, setPrompt] = useState('');
  
  // UI State
  const [showDocs, setShowDocs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Image State
  const [model, setModel] = useState<ModelType>(ModelType.NANO_BANANA);
  const [style, setStyle] = useState<RenderStyle>(RenderStyle.PRE_RENDERED_3D); // Default to 3D for backend gen feel
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [autoPbr, setAutoPbr] = useState(true); // Default to true for 3D
  
  // NEW: Asset Mode State
  const [assetMode, setAssetMode] = useState<'STATIC' | 'ANIMATION'>('STATIC');
  const [animAction, setAnimAction] = useState('Walk Cycle');

  // Advanced State
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>({
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      seed: 0, // 0 implies random
      systemInstruction: ""
  });
  
  // Video State
  const [videoModel, setVideoModel] = useState<VideoModel>(VideoModel.VEO_FAST);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('luma/ray-2');

  const [aspectRatio, setAspectRatio] = useState('1:1');
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  
  // History & Assets
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ 
    isGenerating: false, 
    stage: '', 
    progress: 0 
  });
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auto PBR Switching ---
  useEffect(() => {
    if (style === RenderStyle.PRE_RENDERED_3D) {
      setAutoPbr(true);
    } else {
      setAutoPbr(false);
    }
  }, [style]);

  // --- Timer Logic ---
  useEffect(() => {
    let interval: any;
    if (appState === 'APP' && isTrialMode) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setAppState('LOCKED');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, isTrialMode]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Persistence Logic ---
  useEffect(() => {
    const loadHistory = async () => {
        try {
            const saved = await getHistory();
            if (saved && saved.length > 0) {
                setHistory(saved);
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };
    loadHistory();
  }, []);

  const addToHistory = async (asset: GeneratedAsset) => {
      // Optimistic Update
      setHistory(prev => {
          const newHistory = [asset, ...prev];
          saveHistory(newHistory); // Async save to IndexedDB
          return newHistory;
      });
  };

  const removeFromHistory = async (id: string) => {
      const newHistory = history.filter(a => a.id !== id);
      setHistory(newHistory);
      await saveHistory(newHistory);
      
      if (generatedAsset?.id === id) {
          setGeneratedAsset(null);
      }
  };
  
  const loadFromHistory = (asset: GeneratedAsset) => {
      setGeneratedAsset(asset);
      setMediaType(asset.mediaType);
      setModel(asset.model as ModelType); // Roughly cast
      setPrompt(asset.prompt);
      if(asset.style) setStyle(asset.style);
      
      // RESTORE SEED: This enables "Reload from Seed"
      if (asset.seed) {
          setAdvancedConfig(prev => ({ ...prev, seed: asset.seed }));
      }
      
      // Infer mode based on data
      if (asset.isSpriteSheet || asset.spriteSheetUrl) {
          setAssetMode('ANIMATION');
      } else {
          setAssetMode('STATIC');
      }

      setShowHistory(false);
  };

  // --- Auth Handlers ---
  const handleBootComplete = () => {
    setAppState('AUTH');
  };

  const handleStartTrial = () => {
    setIsTrialMode(true);
    setAppState('APP');
  };

  const handleEnterKey = (key: string) => {
    setIsTrialMode(false);
    setOpenRouterKey(key);
    setAppState('APP');
  };

  const handleUnlock = () => {
    setAppState('APP');
    setTimeRemaining(15 * 60); // Reset timer for another session
  };


  // Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedImage(file);
      const base64 = await blobToBase64(file);
      setUploadedPreview(`data:${file.type};base64,${base64}`);
    }
  };

  const handleStyleSelect = (style: string) => {
    if (prompt.includes(style)) return;
    setPrompt(prev => prev ? `${prev}, ${style}` : style);
  };

  // --- BATCH GENERATOR LOGIC ---
  const handleGenerateBatch = async () => {
      if (!prompt && !uploadedImage) {
          setError("Batch requires a prompt or uploaded source.");
          return;
      }
      setError(null);

      // Lock seed if random to ensure consistency across batch
      const runtimeSeed = advancedConfig.seed === 0 
        ? Math.floor(Math.random() * 2147483647) 
        : advancedConfig.seed;

      setProcessing({ isGenerating: true, stage: 'Batch Init: Validating...', progress: 0 });

      try {
          // Iterate SEQUENTIALLY to avoid rate limits
          for (let i = 0; i < BATCH_ACTIONS.length; i++) {
              const currentAction = BATCH_ACTIONS[i];
              
              setProcessing({ 
                isGenerating: true, 
                stage: `Batch: Generating ${currentAction} (${i + 1}/${BATCH_ACTIONS.length})...`, 
                progress: ((i) / BATCH_ACTIONS.length) * 100 
              });

              // Add small delay buffer (1.5s) to avoid choking the API
              if (i > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1500));
              }

              const resultImage = await generateGameAsset({
                prompt: prompt,
                sourceImage: uploadedImage,
                model: model,
                style: style,
                imageSize: imageSize,
                aspectRatio: aspectRatio,
                advancedConfig: advancedConfig,
                runtimeSeed: runtimeSeed, // Use SAME seed for all
                assetType: 'ANIMATION',
                animationAction: currentAction
            });

            const newAsset: GeneratedAsset = {
                id: crypto.randomUUID(),
                mediaType: 'IMAGE',
                imageUrl: resultImage,
                spriteSheetUrl: resultImage,
                isSpriteSheet: true,
                timestamp: Date.now(),
                prompt: prompt,
                model: model,
                seed: runtimeSeed,
                style: style,
                engineFormat: 'Universal',
            };

            // Save immediately so progress is saved even if batch fails mid-way
            await addToHistory(newAsset);
            
            // Set last generated as current view
            setGeneratedAsset(newAsset);
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

    // Reset
    setError(null);
    setGeneratedAsset(null);
    setProcessing({ isGenerating: true, stage: 'Initializing Backend Generator...', progress: 5 });

    // --- SEED MANAGEMENT ---
    // If the seed is 0 (Random), we generate a specific seed NOW so we can save it to history.
    // If the seed is non-zero (Locked), we use it.
    const runtimeSeed = advancedConfig.seed === 0 
        ? Math.floor(Math.random() * 2147483647) 
        : advancedConfig.seed;

    try {
        if (mediaType === 'IMAGE') {
            // --- IMAGE FLOW ---
            const progressInterval = setInterval(() => {
                setProcessing(prev => {
                if (prev.progress >= 85) return prev;
                return { ...prev, progress: prev.progress + (Math.random() * 8) };
                });
            }, 400);

            if (model === ModelType.NANO_BANANA_PRO) {
                setProcessing(prev => ({ ...prev, stage: 'Authenticating Nano Banana Pro...' }));
            }

            // Enhanced stage messaging for Identity Locking
            if (assetMode === 'ANIMATION') {
                if (uploadedImage) {
                     setProcessing(prev => ({ ...prev, stage: `Identity Lock Active: Creating ${animAction} from Source...` }));
                } else {
                     setProcessing(prev => ({ ...prev, stage: `Backend: Sequencing ${animAction}...` }));
                }
            } else {
                if (uploadedImage) {
                    setProcessing(prev => ({ ...prev, stage: `Identity Lock Active: Transforming Source to ${style === RenderStyle.PRE_RENDERED_3D ? '3D' : '2D'}...` }));
                } else {
                    setProcessing(prev => ({ ...prev, stage: `Backend: Synthesizing ${style === RenderStyle.PRE_RENDERED_3D ? '3D Geometry Render' : '2D Vector Sprite'}...` }));
                }
            }

            // We now pass the prompt directly. The service handles the Animation Prompt Construction
            // to ensure cleaner logic separation and robustness.
            const resultImage = await generateGameAsset({
                prompt: prompt,
                sourceImage: uploadedImage, // Ensure this is definitely passed!
                model: model,
                style: style,
                imageSize: imageSize,
                aspectRatio: aspectRatio,
                advancedConfig: advancedConfig,
                runtimeSeed: runtimeSeed,
                assetType: assetMode, // 'STATIC' or 'ANIMATION'
                animationAction: animAction // 'Walk Cycle', 'Fighting', etc.
            });

            clearInterval(progressInterval);
            setProcessing({ isGenerating: false, stage: 'Finalizing Asset...', progress: 100 });

            const newAsset: GeneratedAsset = {
                id: crypto.randomUUID(),
                mediaType: 'IMAGE',
                imageUrl: resultImage,
                // If in animation mode, the result IS the sheet
                spriteSheetUrl: assetMode === 'ANIMATION' ? resultImage : undefined,
                isSpriteSheet: assetMode === 'ANIMATION',
                timestamp: Date.now(),
                prompt: prompt,
                model: model,
                seed: runtimeSeed, 
                style: style,
                engineFormat: 'Universal',
            };

            setGeneratedAsset(newAsset);
            await addToHistory(newAsset);

            // Auto PBR Trigger
            if (autoPbr && !newAsset.isSpriteSheet) {
                setTimeout(() => handleGeneratePBR(newAsset), 500);
            }

        } else {
            // --- VIDEO FLOW ---
            setProcessing(prev => ({ ...prev, stage: 'Initializing Video Engine...', progress: 10 }));
            
            let videoUrl = '';

            if (videoModel === VideoModel.OPEN_ROUTER) {
                if (!openRouterKey) throw new Error("OpenRouter API Key required for custom models.");
                setProcessing(prev => ({ ...prev, stage: `Contacting OpenRouter (${openRouterModel})...`, progress: 20 }));
                
                const base64 = uploadedImage ? await blobToBase64(uploadedImage) : undefined;
                videoUrl = await generateOpenRouterVideo({
                    prompt,
                    apiKey: openRouterKey,
                    model: openRouterModel,
                    sourceImage: base64 ? `data:${uploadedImage?.type};base64,${base64}` : undefined
                });

            } else {
                // Veo 3.1
                setProcessing(prev => ({ ...prev, stage: `Veo 3.1: Authenticating & Queueing...`, progress: 15 }));
                
                const pollingInterval = setInterval(() => {
                    setProcessing(prev => {
                         const next = prev.progress + 2;
                         return next > 90 ? prev : { ...prev, progress: next };
                    });
                }, 1000);

                videoUrl = await generateVeoVideo({
                    prompt,
                    sourceImage: uploadedImage,
                    model: videoModel,
                    aspectRatio: aspectRatio
                });
                
                clearInterval(pollingInterval);
            }
            
            setProcessing({ isGenerating: false, stage: 'Done', progress: 100 });
            const newAsset: GeneratedAsset = {
                id: crypto.randomUUID(),
                mediaType: 'VIDEO',
                videoUrl: videoUrl,
                timestamp: Date.now(),
                prompt: prompt,
                model: videoModel,
                seed: 0, 
                engineFormat: 'MP4',
            };
            setGeneratedAsset(newAsset);
            await addToHistory(newAsset);
        }

    } catch (err: any) {
      setProcessing({ isGenerating: false, stage: 'Error', progress: 0 });
      setError(err.message || "An unknown error occurred during generation.");
    }
  };

  const handleGeneratePBR = async (targetAsset: GeneratedAsset | null = generatedAsset) => {
    if (!targetAsset || targetAsset.mediaType !== 'IMAGE' || !targetAsset.imageUrl) return;
    
    setProcessing({ isGenerating: true, stage: 'Backend Generator: Baking PBR Maps...', progress: 40 });
    try {
        const maps = await generateMaps(targetAsset.imageUrl);
        const updatedAsset = {
            ...targetAsset,
            normalMapUrl: maps.normal,
            roughnessMapUrl: maps.roughness,
            ormMapUrl: maps.orm,
            heightMapUrl: maps.height
        };
        setGeneratedAsset(updatedAsset);
        
        // Update history with new maps
        setHistory(prev => {
            const newHistory = prev.map(a => a.id === updatedAsset.id ? updatedAsset : a);
            saveHistory(newHistory);
            return newHistory;
        });

        setProcessing({ isGenerating: false, stage: 'Done', progress: 100 });
    } catch (err) {
        setProcessing({ isGenerating: false, stage: 'Error generating maps', progress: 0 });
    }
  };

  // --- Render Views Based on State ---
  if (appState === 'BOOT') {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  if (appState === 'AUTH') {
    return <AuthScreen onStartTrial={handleStartTrial} onEnterKey={handleEnterKey} />;
  }

  return (
    <div className="min-h-screen text-gray-200 pb-20 font-sans selection:bg-neon-blue selection:text-black relative">
      
      {/* Payment Lock Overlay */}
      {appState === 'LOCKED' && <PaymentLock onUnlock={handleUnlock} />}

      {/* Documentation Overlay */}
      {showDocs && <UserGuide onClose={() => setShowDocs(false)} />}
      
      {/* History Sidebar */}
      {showHistory && (
          <AssetHistory 
            history={history} 
            onSelect={loadFromHistory} 
            onDelete={removeFromHistory}
            onClose={() => setShowHistory(false)}
          />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg shadow-neon-blue/20">
              <span className="font-bold text-black text-lg">C</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              CANN.ON<span className="text-neon-blue font-light">.AI</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            
            {/* Trial Timer Display */}
            {isTrialMode && appState === 'APP' && (
              <div className="bg-red-500/10 border border-red-500/30 px-3 py-1 rounded text-red-400 font-mono text-xs font-bold animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                TRIAL: {formatTime(timeRemaining)}
              </div>
            )}

             <button 
                onClick={() => setShowHistory(true)}
                className="text-xs font-bold text-neon-blue hover:text-white border border-neon-blue/50 hover:border-white px-3 py-1.5 rounded transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(0,243,255,0.1)] hover:shadow-[0_0_15px_rgba(0,243,255,0.3)]"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                History ({history.length})
            </button>
            <button 
                onClick={() => setShowDocs(true)}
                className="text-xs font-bold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded transition-all flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                Docs
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-32">
        
        {/* Intro */}
        <div className="mb-8 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mb-4">
            {mediaType === 'IMAGE' ? (
                <>Backend <span className="text-neon-blue">Generator</span> Console</>
            ) : (
                <>Cinematic <span className="text-neon-purple">Director</span></>
            )}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {mediaType === 'IMAGE' 
             ? "Upload single 2D Source. Select Nano Banana Model. Output Instant 3D Renders or 2D Sprites for Godot, Unity, & UE5."
             : "Create in-game cutscenes using Veo 3.1 or External Models via OpenRouter. Output MP4 for Unity/Unreal Video Players."}
          </p>
        </div>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upload Zone */}
            <div 
              className={`relative group border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer ${
                uploadedPreview ? 'border-neon-green/50 bg-neon-green/5' : 'border-gray-700 bg-gray-900/50 hover:border-neon-blue/50 hover:bg-gray-800'
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
                  <img src={uploadedPreview} alt="Upload" className="w-full h-48 object-contain rounded-lg shadow-lg" />
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></span>
                    Identity Lock
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setUploadedImage(null);
                      setUploadedPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 z-20 shadow-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-700 transition-all shadow-inner border border-gray-700 group-hover:border-neon-blue">
                    <svg className="w-8 h-8 text-gray-400 group-hover:text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2h-8a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-200 group-hover:text-white transition-colors">
                        SINGLE UPLOAD
                    </p>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                        Drop any 2D PNG/JPG here
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {uploadedImage ? 'Refinement Instructions' : 'Asset Description'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mediaType === 'IMAGE' 
                    ? (uploadedImage ? "E.g., Make it look more aggressive, keep colors..." : "E.g., A robot holding a shield, isometric view...") 
                    : "E.g., A cyberpunk car driving through rain at night, neon lights reflecting..."}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-neon-blue focus:border-transparent outline-none transition-all resize-none h-32 text-sm leading-relaxed"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={processing.isGenerating}
              className={`w-full py-4 rounded-lg font-bold text-lg tracking-wide uppercase transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] ${
                processing.isGenerating
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : mediaType === 'IMAGE' 
                    ? 'bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue bg-[length:200%_auto] hover:bg-right text-white hover:shadow-[0_0_25px_rgba(188,19,254,0.5)]'
                    : 'bg-gradient-to-r from-neon-green via-neon-blue to-neon-green bg-[length:200%_auto] hover:bg-right text-black hover:shadow-[0_0_25px_rgba(0,255,0,0.5)]'
              }`}
            >
              {processing.isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                    {processing.stage.includes('Video') ? 'Rendering...' : 'Backend Processing...'}
                </span>
              ) : (
                mediaType === 'IMAGE' 
                    ? "RUN BACKEND GENERATOR"
                    : "RENDER CUTSCENE"
              )}
            </button>

             {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-200 text-xs">
                ⚠️ {error}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Settings & Preview */}
          <div className="lg:col-span-8 flex flex-col h-full">
            
            <SettingsPanel 
              mediaType={mediaType}
              setMediaType={setMediaType}
              
              model={model}
              setModel={setModel}
              style={style}
              setStyle={setStyle}
              imageSize={imageSize}
              setImageSize={setImageSize}

              assetMode={assetMode}
              setAssetMode={setAssetMode}
              animAction={animAction}
              setAnimAction={setAnimAction}
              onGenerateAll={handleGenerateBatch}

              videoModel={videoModel}
              setVideoModel={setVideoModel}
              openRouterKey={openRouterKey}
              setOpenRouterKey={setOpenRouterKey}
              openRouterModel={openRouterModel}
              setOpenRouterModel={setOpenRouterModel}
              
              advancedConfig={advancedConfig}
              setAdvancedConfig={setAdvancedConfig}

              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              disabled={processing.isGenerating}
              onStyleSelect={handleStyleSelect}
              autoPbr={autoPbr}
              setAutoPbr={setAutoPbr}
            />

            {/* Main Preview Area */}
            <div className="flex-grow bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden relative min-h-[500px] flex items-center justify-center group flex-col">
              
              {/* Grid Background in preview */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" 
                   style={{
                     backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
                     backgroundSize: '20px 20px'
                   }}
              ></div>

              {generatedAsset ? (
                <div className="relative w-full h-full p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 overflow-y-auto z-10 pb-32">
                  
                  {/* MAIN ASSET DISPLAY */}
                  <div className="relative shadow-2xl rounded-lg overflow-hidden border border-gray-700 bg-black/40 backdrop-blur-sm mb-4">
                    <div className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider z-20 ${generatedAsset.mediaType === 'VIDEO' ? 'bg-neon-green/20 border border-neon-green text-neon-green' : 'bg-neon-blue/20 border border-neon-blue text-neon-blue'}`}>
                      {generatedAsset.mediaType === 'VIDEO' 
                        ? (generatedAsset.model === VideoModel.OPEN_ROUTER ? 'OpenRouter Video' : 'Veo 3.1 Render') 
                        : (generatedAsset.isSpriteSheet ? `Sheet: ${animAction}` : (generatedAsset.style === RenderStyle.PRE_RENDERED_3D ? '3D Render' : '2D Sprite'))}
                    </div>
                    
                    {generatedAsset.mediaType === 'VIDEO' && generatedAsset.videoUrl ? (
                        <video 
                            controls 
                            autoPlay 
                            loop 
                            src={generatedAsset.videoUrl} 
                            className="max-h-[400px] w-auto mx-auto rounded"
                        />
                    ) : (
                        <img 
                        src={generatedAsset.spriteSheetUrl || generatedAsset.imageUrl} 
                        alt="Generated Asset" 
                        className="max-h-[350px] object-contain w-auto mx-auto"
                        />
                    )}
                  </div>

                  {/* Generated Maps Row (Images Only) */}
                  {generatedAsset.mediaType === 'IMAGE' && !generatedAsset.isSpriteSheet && (generatedAsset.normalMapUrl || generatedAsset.roughnessMapUrl) && (
                      <div className="flex gap-2 mt-4 w-full justify-center flex-wrap">
                          {generatedAsset.normalMapUrl && (
                              <div className="text-center group/map">
                                  <p className="text-[9px] text-gray-500 mb-1 uppercase group-hover/map:text-neon-purple transition-colors">Normal</p>
                                  <img src={generatedAsset.normalMapUrl} className="h-16 w-16 object-cover border border-gray-700 rounded bg-black" />
                              </div>
                          )}
                           {generatedAsset.roughnessMapUrl && (
                              <div className="text-center group/map">
                                  <p className="text-[9px] text-gray-500 mb-1 uppercase group-hover/map:text-white transition-colors">Roughness</p>
                                  <img src={generatedAsset.roughnessMapUrl} className="h-16 w-16 object-cover border border-gray-700 rounded bg-black" />
                              </div>
                          )}
                          {generatedAsset.ormMapUrl && (
                              <div className="text-center group/map">
                                  <p className="text-[9px] text-gray-500 mb-1 uppercase group-hover/map:text-red-400 transition-colors">ORM (UE5)</p>
                                  <img src={generatedAsset.ormMapUrl} className="h-16 w-16 object-cover border border-gray-700 rounded bg-black" />
                              </div>
                          )}
                           {generatedAsset.heightMapUrl && (
                              <div className="text-center group/map">
                                  <p className="text-[9px] text-gray-500 mb-1 uppercase group-hover/map:text-gray-300 transition-colors">Height</p>
                                  <img src={generatedAsset.heightMapUrl} className="h-16 w-16 object-cover border border-gray-700 rounded bg-black" />
                              </div>
                          )}
                      </div>
                  )}

                  {/* Actions for Asset */}
                  <div className="mt-6 flex gap-3 justify-center w-full">
                      {generatedAsset.mediaType === 'IMAGE' && !generatedAsset.isSpriteSheet && !generatedAsset.normalMapUrl && (
                        <button 
                            onClick={() => handleGeneratePBR(generatedAsset)}
                            disabled={processing.isGenerating}
                            className="bg-gray-800 hover:bg-gray-700 text-neon-blue border border-neon-blue/30 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                            Build PBR Maps (Backend)
                        </button>
                      )}
                  </div>

                </div>
              ) : (
                <div className="text-center p-12 opacity-30 select-none pointer-events-none">
                  <div className="mb-4 flex justify-center">
                    <svg className="w-24 h-24 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-500">No Asset Generated</h3>
                  <p className="text-gray-600 mt-2">
                      {mediaType === 'IMAGE' ? "Upload source image & run Backend Generator." : "Setup your scene to render video."}
                  </p>
                </div>
              )}

              {/* Loading Overlay */}
              {processing.isGenerating && (
                 <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden relative">
                        <div 
                            className={`h-full absolute top-0 left-0 transition-all duration-300 ease-out ${mediaType === 'VIDEO' ? 'bg-gradient-to-r from-neon-green to-neon-blue' : 'bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue'}`}
                            style={{ width: `${processing.progress}%` }}
                        ></div>
                    </div>
                    <div className="mt-4 font-mono text-neon-blue animate-pulse text-sm tracking-widest uppercase">
                        {processing.stage}
                    </div>
                 </div>
              )}
            </div>

            {/* Export Panel */}
            <EngineExport asset={generatedAsset} />
            
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-gray-600 py-8 text-xs border-t border-gray-900 mt-12">
        <p>&copy; 2025 CANN.ON.AI. Instant import for Godot, Unity, and Unreal Engine 5.</p>
      </footer>
    </div>
  );
};

export default App;