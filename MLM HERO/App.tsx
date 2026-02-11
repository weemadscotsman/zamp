
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './components/Icons';
import { GamePreview } from './components/GamePreview';
import { CodeBlock } from './components/CodeBlock';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { TokenHistoryGraph } from './components/TokenHistoryGraph';
import { LoadingTerminal } from './components/LoadingTerminal';
import { AssetStudio } from './components/AssetStudio'; 
import { generateBlueprint, generatePrototype, refineGame, generateSoundscape, optimizeSettings } from './services/geminiService';
import { estimateTokens, formatTokenCount } from './utils/tokenEstimator';
import { 
  UserPreferences, GeneratedGame, Genre, Platform, SkillLevel, ArchitectureStyle,
  VisualStyle, CameraPerspective, EnvironmentType, Atmosphere, Pacing, TokenTransaction,
  QualityLevel, RefinementSettings, GameEngine, PhysicsEngine, AppError, GeneratedAsset
} from './types';
import { ForgeError } from './services/utils/aiHelpers';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import JSZip from 'jszip';
import { ENGINE_VERSION } from './version';

type GenerationPhase = 'idle' | 'generating_blueprint' | 'blueprint_ready' | 'generating_audio' | 'generating_prototype' | 'complete';
type ViewMode = 'FORGE' | 'ASSET_LAB'; 

interface ChangeLogItem {
  id: string;
  prompt: string;
  timestamp: number;
}

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('FORGE'); 
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [logs, setLogs] = useState<string[]>([]); 
  const [error, setError] = useState<AppError | null>(null);
  const [game, setGame] = useState<GeneratedGame | null>(null);
  const [activeTab, setActiveTab] = useState<'play' | 'blueprint' | 'code'>('play');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [changeLog, setChangeLog] = useState<ChangeLogItem[]>([]);
  
  // SHARED ASSET STATE
  const [projectAssets, setProjectAssets] = useState<GeneratedAsset[]>([]);

  // Voice & Optimizer State
  const [isListening, setIsListening] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Pro Features State
  const [seedLocked, setSeedLocked] = useState(false);
  const [specFrozen, setSpecFrozen] = useState(false);
  
  // Refinement Tuning State
  const [showRefineSettings, setShowRefineSettings] = useState(false);
  const [refineSettings, setRefineSettings] = useState<RefinementSettings>({
      temperature: 0.7,
      maxOutputTokens: 65536,
      topP: 0.95,
      topK: 40
  });

  // Token Tracking
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [tokenHistory, setTokenHistory] = useState<TokenTransaction[]>([]);
  const [showTokenGraph, setShowTokenGraph] = useState(false);

  // WebGL/WebGPU Check
  const [webglStatus, setWebglStatus] = useState<boolean | null>(null);
  const [webgpuStatus, setWebgpuStatus] = useState<boolean | null>(null);
  const abortRef = useRef<boolean>(false);

  const [prefs, setPrefs] = useState<UserPreferences>({
    genre: Genre.FPS,
    platform: Platform.Web,
    gameEngine: GameEngine.ThreeJS, // Default to ThreeJS for 3D
    physicsEngine: PhysicsEngine.Rapier, // Recommended for 3D
    skillLevel: SkillLevel.Beginner,
    architectureStyle: ArchitectureStyle.ECS, // Default to ECS for scalable 3D
    projectDescription: '',
    visualStyle: VisualStyle.Cyberpunk,
    cameraPerspective: CameraPerspective.FirstPerson,
    environmentType: EnvironmentType.Dungeon,
    atmosphere: Atmosphere.Neon,
    pacing: Pacing.Arcade,
    // Pro Defaults
    seed: Math.random().toString(36).substring(7),
    quality: QualityLevel.Prototype,
    capabilities: {
        gpuTier: 'high',
        input: 'mouse',
        telemetry: true
    }
  });

  useEffect(() => {
    // WebGL Check
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    setWebglStatus(!!gl);

    // WebGPU Check
    if ('gpu' in navigator) {
      // @ts-ignore
      navigator.gpu.requestAdapter().then(adapter => {
        setWebgpuStatus(!!adapter);
      }).catch(() => setWebgpuStatus(false));
    } else {
      setWebgpuStatus(false);
    }
  }, []);

  const addLog = (msg: string) => {
      setLogs(prev => [...prev, msg]);
  };

  const randomizeSeed = () => {
      if (!seedLocked) {
         setPrefs(p => ({...p, seed: Math.random().toString(36).substring(7) }));
      }
  };

  const handleAssetAssigned = (asset: GeneratedAsset) => {
      setProjectAssets(prev => [...prev, asset]);
      // Optional: switch back to Forge view to show progress
      addLog(`ASSET INJECTED: ${asset.role} (${asset.model})`);
  };

  const handleExport = async () => {
      if (!game || !game.manifest) return;
      
      const zip = new JSZip();
      zip.file("forge.manifest.json", JSON.stringify(game.manifest, null, 2));
      zip.file("blueprint.json", JSON.stringify(game, null, 2));
      zip.file("index.html", game.html || "");
      const readme = `# ${game.title}\n\n${game.summary}\n\nGenerated by Dream3DForge`;
      zip.file("README.md", readme);
      const content = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dream3d_${game.manifest.seed}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const addToTokenTotal = (action: string, input: any, output: any) => {
      const inp = estimateTokens(input);
      const out = estimateTokens(output);
      const total = inp + out;
      setTotalTokens(prev => {
        const newTotal = prev + total;
        setTokenHistory(h => [...h, {
            id: Date.now().toString() + Math.random().toString().slice(2),
            timestamp: Date.now(),
            action,
            inputTokens: inp,
            outputTokens: out,
            totalTokens: newTotal
        }]);
        return newTotal;
      });
  };

  const handleError = (e: any, defaultTitle: string) => {
      if (!abortRef.current) {
          if (e instanceof ForgeError || e.name === 'ForgeError') {
              const fe = e as ForgeError;
              setError({
                  title: fe.title,
                  message: fe.message,
                  code: fe.code,
                  suggestion: fe.suggestion
              });
              addLog(`CRITICAL_ERROR: ${fe.message}`);
          } else {
              setError({
                  title: defaultTitle,
                  message: e.message || "An unexpected error occurred."
              });
              addLog(`CRITICAL_ERROR: ${e.message}`);
          }
      }
  };

  const handleVoiceInput = () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          alert("Speech recognition is not supported in this browser.");
          return;
      }
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setPrefs(prev => ({
              ...prev,
              projectDescription: (prev.projectDescription + " " + transcript).trim()
          }));
      };
      recognition.start();
  };

  const handleAutoTune = async () => {
      if (!prefs.projectDescription || prefs.projectDescription.length < 5) return;
      setIsOptimizing(true);
      try {
          const optimized = await optimizeSettings(prefs.projectDescription);
          setPrefs(prev => ({ ...prev, ...optimized }));
          addToTokenTotal("Auto-Tune Settings", prefs.projectDescription, optimized);
      } catch (e) {
          console.warn("Optimizer failed", e);
      } finally {
          setIsOptimizing(false);
      }
  };

  const handleGenerateBlueprint = async () => {
    if (!prefs.projectDescription.trim()) {
        setError({
            title: "Missing Description", 
            message: "Please describe your game concept before generating.",
            suggestion: "Enter a prompt like 'A cyberpunk racing game where you hack the track'."
        });
        return;
    }
    if (specFrozen) return;
    abortRef.current = false;
    setPhase('generating_blueprint');
    setLogs([]); 
    setError(null);
    setGame(null);
    setChangeLog([]);
    try {
      addLog("Starting Blueprint Phase...");
      const blueprint = await generateBlueprint(prefs, (msg) => {
        if (!abortRef.current) addLog(msg);
      });
      if (!abortRef.current) {
        addToTokenTotal("Generate Blueprint", prefs, blueprint);
        setGame(blueprint);
        setPhase('blueprint_ready');
        setActiveTab('blueprint');
        addLog("Blueprint Phase Complete.");
      }
    } catch (e: any) {
      if (!abortRef.current) {
        setPhase('idle');
        handleError(e, "Architecture Failed");
      }
    }
  };

  const handleFreezeSpec = () => {
      setSpecFrozen(true);
  };

  const handleGeneratePrototype = async () => {
    if (!game) return;
    abortRef.current = false;
    setError(null);
    
    setPhase('generating_audio');
    addLog("Starting Audio Synthesis...");
    let audioData;
    
    try {
        const audioPromise = generateSoundscape(game, prefs, (msg) => {
            if (!abortRef.current) addLog(msg);
        });
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error("Audio generation timed out")), 20000);
        });
        audioData = await Promise.race([audioPromise, timeoutPromise]) as any;
        if (!abortRef.current) {
             addToTokenTotal("Generate Audio", game, audioData);
        }
    } catch (e: any) {
        addLog(`WARN: Audio failed/timed out: ${e.message}. Skipping.`);
    }

    if (abortRef.current) return;

    setPhase('generating_prototype');
    addLog("Starting Core Prototype Build...");
    
    // Inject Assets here
    if (projectAssets.length > 0) {
        addLog(`Linking ${projectAssets.length} Custom Assets...`);
    }

    try {
        const protoPromise = generatePrototype(game, prefs, audioData, projectAssets, (msg) => {
           if (!abortRef.current) addLog(msg);
        });
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error("Prototype generation timed out")), 90000);
        });
        const fullGame = await Promise.race([protoPromise, timeoutPromise]) as GeneratedGame;
        if (!abortRef.current) {
            addToTokenTotal("Build Prototype", game, fullGame);
            setGame(fullGame);
            setPhase('complete');
            setActiveTab('play'); 
            addLog("SUCCESS: System Online.");
        }
    } catch (e: any) {
        if (!abortRef.current) {
            setPhase('blueprint_ready');
            handleError(e, "Prototype Construction Failed");
        }
    }
  };

  const handleRefine = async () => {
    if (!game || !refinePrompt.trim()) return;
    abortRef.current = false;
    const prevPhase = phase;
    setPhase('generating_prototype'); 
    setLogs([]);
    addLog("Applying Refinement Patch...");
    const newLogItem = { id: Date.now().toString(), prompt: refinePrompt, timestamp: Date.now() };
    setChangeLog(prev => [newLogItem, ...prev]);
    try {
        const result = await refineGame(game, refinePrompt, refineSettings);
        if (!abortRef.current) {
            addToTokenTotal("Refine Code", {game: game.html, prompt: refinePrompt, settings: refineSettings}, result.html);
            setGame(result);
            setRefinePrompt(''); 
            setPhase('complete');
            setActiveTab('play');
            addLog("SUCCESS: Patch Applied.");
        }
    } catch (e: any) {
        if (!abortRef.current) {
            setPhase(prevPhase);
            handleError(e, "Refinement Failed");
            setChangeLog(prev => prev.filter(item => item.id !== newLogItem.id));
        }
    }
  };

  const handleCancel = () => {
      abortRef.current = true;
      addLog("USER ABORT TRIGGERED.");
      if (phase === 'generating_prototype' || phase === 'generating_audio') {
          setPhase('blueprint_ready');
      } else {
          setPhase('idle');
      }
  };

  const handleReset = () => {
      setPhase('idle');
      setGame(null);
      setError(null);
      setLogs([]);
      setTotalTokens(0);
      setTokenHistory([]);
      setChangeLog([]);
      setSpecFrozen(false);
      setProjectAssets([]); // Clear asset buffer
      if (!seedLocked) {
          setPrefs(p => ({...p, seed: Math.random().toString(36).substring(7)}));
      }
  };

  const SelectField = ({ label, value, onChange, options, disabled }: any) => (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</label>
      <select 
        disabled={disabled}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-xs text-zinc-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all hover:bg-zinc-900"
        value={value}
        onChange={onChange}
      >
        {Object.values(options).map((opt: any) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="h-screen bg-black text-zinc-100 selection:bg-indigo-500/30 font-sans flex flex-col overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full h-full max-w-[1920px] mx-auto px-4 py-4 lg:px-6 flex flex-col">
        
        {/* Header */}
        <header className="shrink-0 mb-4 flex flex-col border-b border-zinc-800 pb-3 relative">
          <div className="flex justify-between items-end">
              <div className="flex items-center gap-6">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Icons.Box className="w-6 h-6 text-indigo-500" />
                  Dream3DForge
                </h1>
                
                {/* TAB NAVIGATION */}
                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button 
                        onClick={() => setViewMode('FORGE')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                            viewMode === 'FORGE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'
                        }`}
                    >
                        Game Architect
                    </button>
                    <button 
                        onClick={() => setViewMode('ASSET_LAB')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                            viewMode === 'ASSET_LAB' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'
                        }`}
                    >
                        Asset Studio
                    </button>
                    {projectAssets.length > 0 && (
                        <div className="ml-2 flex items-center gap-2 px-2 bg-green-500/10 rounded border border-green-500/20">
                            <Icons.Check className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] font-bold text-green-400">{projectAssets.length} Assets Linked</span>
                        </div>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                 {game && viewMode === 'FORGE' && (
                   <div className="hidden md:flex flex-col items-end">
                     <span className="font-semibold text-zinc-200 text-sm">{game.title}</span>
                   </div>
                 )}
                 <div className="relative">
                    <button 
                      onClick={() => setShowTokenGraph(!showTokenGraph)}
                      className={`flex flex-col items-end px-3 py-1 border-r border-zinc-800 mr-2 transition-colors rounded hover:bg-zinc-900 ${showTokenGraph ? 'bg-zinc-900' : ''}`}
                    >
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">Est. Usage</span>
                        <span className="text-xs font-mono font-bold text-indigo-400">{formatTokenCount(totalTokens)}</span>
                    </button>
                    <AnimatePresence>
                      {showTokenGraph && (
                        <TokenHistoryGraph history={tokenHistory} onClose={() => setShowTokenGraph(false)} />
                      )}
                    </AnimatePresence>
                 </div>
                 <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono border ${webglStatus ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  <Icons.Monitor className="w-3 h-3" />
                  WebGL {webglStatus ? 'OK' : 'ERR'}
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono border ${webgpuStatus ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                  <Icons.Zap className="w-3 h-3" />
                  WebGPU {webgpuStatus ? 'OK' : 'N/A'}
                </div>
              </div>
          </div>
          
          {/* CONTROL TOOLBAR - ONLY SHOW IN FORGE MODE */}
          {viewMode === 'FORGE' && (
              <div className="mt-2 pt-2 border-t border-zinc-800 flex flex-wrap gap-4 items-center">
                  <div className={`flex items-center gap-2 bg-zinc-900 px-2 py-1 rounded border ${seedLocked ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-zinc-800'}`}>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Seed</span>
                      <input 
                          type="text" 
                          value={prefs.seed}
                          disabled={seedLocked}
                          onChange={(e) => setPrefs(p => ({...p, seed: e.target.value}))}
                          className={`bg-transparent text-xs font-mono text-zinc-300 w-20 outline-none ${seedLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      <button onClick={randomizeSeed} disabled={seedLocked} className={`text-zinc-500 hover:text-indigo-400 ${seedLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <Icons.Zap className="w-3 h-3" />
                      </button>
                      <div className="w-px h-3 bg-zinc-700 mx-1" />
                      <button 
                        onClick={() => setSeedLocked(!seedLocked)} 
                        className={`text-[10px] uppercase font-bold tracking-wider ${seedLocked ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                          {seedLocked ? 'LOCKED' : 'UNLOCKED'}
                      </button>
                  </div>

                  <div className="flex items-center gap-2 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Qual</span>
                      <select 
                          value={prefs.quality}
                          onChange={(e: any) => setPrefs(p => ({...p, quality: e.target.value}))}
                          className="bg-transparent text-xs text-zinc-300 outline-none w-24"
                      >
                          {Object.values(QualityLevel).map(q => (
                              <option key={q} value={q}>{q.split(' ')[0]}</option>
                          ))}
                      </select>
                  </div>

                  <div className="flex-1" />
                  {game && (
                      <button 
                          onClick={handleExport}
                          className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-700 transition-colors"
                      >
                          <Icons.Box className="w-3 h-3" />
                          Export
                      </button>
                  )}
              </div>
          )}
        </header>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 min-h-0 relative">
            {viewMode === 'ASSET_LAB' ? (
                // --- NEW ASSET STUDIO VIEW ---
                <div className="h-full w-full animate-in fade-in">
                    <AssetStudio onAssetAssigned={handleAssetAssigned} />
                </div>
            ) : (
                // --- EXISTING FORGE VIEW ---
                <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
                    
                    {/* Left Panel: Configuration */}
                    <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                        
                        {/* Forge Settings Card */}
                        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-semibold flex items-center gap-2 text-white uppercase tracking-wider">
                                <Icons.Tools className="w-3 h-3 text-indigo-400" />
                                Forge Settings
                            </h2>
                            {phase !== 'idle' && (
                                <button onClick={handleReset} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline">
                                    Reset
                                </button>
                            )}
                        </div>
                        
                        <div className={`space-y-4 ${specFrozen ? 'opacity-30 pointer-events-none grayscale' : (phase !== 'idle' ? 'opacity-50 pointer-events-none' : '')}`}>
                            <div className="space-y-3 pb-3 border-b border-zinc-800/50">
                                <h3 className="text-[10px] font-bold text-zinc-200 flex items-center gap-2"><Icons.Cpu className="w-3 h-3" /> Identity</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <SelectField label="Engine" value={prefs.gameEngine} options={GameEngine} onChange={(e: any) => setPrefs(p => ({...p, gameEngine: e.target.value}))} disabled={specFrozen} />
                                    <SelectField label="Genre" value={prefs.genre} options={Genre} onChange={(e: any) => setPrefs(p => ({...p, genre: e.target.value}))} disabled={specFrozen} />
                                    <SelectField label="Architecture" value={prefs.architectureStyle} options={ArchitectureStyle} onChange={(e: any) => setPrefs(p => ({...p, architectureStyle: e.target.value}))} disabled={specFrozen} />
                                </div>
                            </div>

                            <div className="space-y-3 pb-3 border-b border-zinc-800/50">
                                <h3 className="text-[10px] font-bold text-zinc-200 flex items-center gap-2"><Icons.Monitor className="w-3 h-3" /> Visuals & Physics</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <SelectField label="Physics" value={prefs.physicsEngine} options={PhysicsEngine} onChange={(e: any) => setPrefs(p => ({...p, physicsEngine: e.target.value}))} disabled={specFrozen} />
                                    <SelectField label="Style" value={prefs.visualStyle} options={VisualStyle} onChange={(e: any) => setPrefs(p => ({...p, visualStyle: e.target.value}))} disabled={specFrozen} />
                                    <SelectField label="Camera" value={prefs.cameraPerspective} options={CameraPerspective} onChange={(e: any) => setPrefs(p => ({...p, cameraPerspective: e.target.value}))} disabled={specFrozen} />
                                    <SelectField label="Env" value={prefs.environmentType} options={EnvironmentType} onChange={(e: any) => setPrefs(p => ({...p, environmentType: e.target.value}))} disabled={specFrozen} />
                                </div>
                            </div>

                            {/* Concept Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Concept</label>
                                <div className="flex gap-1">
                                    <button onClick={handleAutoTune} disabled={isOptimizing || !prefs.projectDescription} className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all ${isOptimizing ? 'bg-zinc-800 text-zinc-500' : 'text-indigo-400 hover:bg-indigo-900/30'}`}>
                                            <Icons.Tools className={`w-3 h-3 ${isOptimizing ? 'animate-spin' : ''}`} />
                                            {isOptimizing ? '...' : 'Auto'}
                                    </button>
                                    <button onClick={handleVoiceInput} disabled={isListening} className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                                            {isListening ? <div className="w-2 h-2 bg-white rounded-full" /> : <Icons.Monitor className="w-3 h-3" />}
                                            {isListening ? 'Rec' : 'Mic'}
                                    </button>
                                </div>
                            </div>
                            <textarea 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none min-h-[120px] resize-none placeholder-zinc-700 text-zinc-300 custom-scrollbar"
                                placeholder="Describe specific mechanics..."
                                value={prefs.projectDescription}
                                onChange={(e) => setPrefs(prev => ({...prev, projectDescription: e.target.value}))}
                                disabled={specFrozen}
                            />
                            </div>
                        </div>

                            {/* ACTIONS */}
                            <div className="mt-4 space-y-2">
                                {phase === 'idle' && (
                                    <button 
                                        onClick={handleGenerateBlueprint}
                                        disabled={specFrozen}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 text-xs tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Icons.Zap className="w-4 h-4" />
                                        Initialize
                                    </button>
                                )}

                                {phase === 'blueprint_ready' && (
                                    <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}}>
                                        {!specFrozen ? (
                                            <button 
                                                onClick={handleFreezeSpec}
                                                className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs tracking-wide uppercase"
                                            >
                                                <Icons.Check className="w-4 h-4" />
                                                Freeze Spec
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={handleGeneratePrototype}
                                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 active:scale-95 text-xs tracking-wide uppercase animate-pulse"
                                            >
                                                <Icons.Tools className="w-4 h-4" />
                                                Compile
                                            </button>
                                        )}
                                    </motion.div>
                                )}

                                {(phase === 'generating_blueprint' || phase === 'generating_prototype' || phase === 'generating_audio') && (
                                    <div className="h-[200px] w-full">
                                    <LoadingTerminal logs={logs} phase={phase} onAbort={handleCancel} />
                                    </div>
                                )}
                                
                                {phase === 'complete' && (
                                    <div className="bg-zinc-800/50 rounded-lg p-2 text-center border border-zinc-700">
                                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">System Online</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <AnimatePresence>
                            {phase === 'complete' && game && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl flex flex-col gap-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xs font-bold flex items-center gap-2 text-green-400 uppercase tracking-widest"><Icons.Code className="w-3 h-3" /> Iterate</h2>
                                        <button onClick={() => setShowRefineSettings(!showRefineSettings)} className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${showRefineSettings ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                            {showRefineSettings ? 'Hide' : 'Tune'}
                                        </button>
                                    </div>

                                    {showRefineSettings && (
                                        <div className="p-2 bg-zinc-950/50 rounded border border-zinc-800 text-[10px]">
                                            <div className="flex justify-between mb-1"><span>Temp</span><span>{refineSettings.temperature}</span></div>
                                            <input type="range" min="0" max="2" step="0.1" value={refineSettings.temperature} onChange={(e) => setRefineSettings({...refineSettings, temperature: parseFloat(e.target.value)})} className="w-full h-1 bg-zinc-800 rounded appearance-none" />
                                        </div>
                                    )}

                                    <textarea className="w-full bg-black/50 border border-zinc-700 rounded p-2 text-xs text-white placeholder-zinc-500 outline-none h-[60px] resize-none" placeholder="Describe changes..." value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); }}} />
                                    <button onClick={handleRefine} disabled={!refinePrompt.trim()} className="w-full bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 font-bold py-2 rounded text-[10px] uppercase tracking-wide">
                                        Apply
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Panel: Content */}
                    <div className="lg:col-span-9 flex flex-col h-full min-h-0">
                        <AnimatePresence mode="wait">
                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start gap-3 mb-2 shrink-0">
                            <Icons.Warning className="w-5 h-5 text-red-400" />
                            <div className="flex-1">
                                <h4 className="font-bold text-red-100 text-sm">{error.title}</h4>
                                <p className="text-xs text-red-300/80">{error.message}</p>
                                <button onClick={() => setError(null)} className="mt-1 text-xs underline">Dismiss</button>
                            </div>
                            </motion.div>
                        )}

                        {phase === 'idle' && !error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl p-8 bg-zinc-900/20">
                                <Icons.Layers className="w-16 h-16 mb-4 opacity-20" />
                                <h3 className="text-lg font-bold text-zinc-300">System Idle</h3>
                                <p className="text-xs opacity-60 text-center">Configure parameters and Initialize Forge.</p>
                            </motion.div>
                        )}
                        
                        {(phase === 'generating_blueprint' || phase === 'generating_prototype' || phase === 'generating_audio') && !game?.html && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-zinc-500 border border-zinc-800/50 rounded-2xl p-8 bg-zinc-900/10">
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
                                <p className="text-xs text-zinc-500 font-mono">Processing...</p>
                            </motion.div>
                        )}

                        {game && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col min-h-0">
                                <div className="flex items-center gap-2 mb-2 shrink-0">
                                    {game.html && (
                                        <button onClick={() => setActiveTab('play')} className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${activeTab === 'play' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                            <Icons.Gamepad className="w-3 h-3" /> Play
                                        </button>
                                    )}
                                    <button onClick={() => setActiveTab('blueprint')} className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${activeTab === 'blueprint' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                        <Icons.Layers className="w-3 h-3" /> Blueprint
                                    </button>
                                    {game.html && (
                                        <button onClick={() => setActiveTab('code')} className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${activeTab === 'code' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                            <Icons.Code className="w-3 h-3" /> Source
                                        </button>
                                    )}
                                </div>

                                <div className="flex-1 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 relative min-h-0">
                                    {activeTab === 'play' && game.html && (
                                        <GamePreview html={game.html} title={game.title} />
                                    )}
                                    {activeTab === 'blueprint' && (
                                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                                            <div className="max-w-4xl mx-auto space-y-6">
                                                <div className="space-y-2">
                                                    <h2 className="text-xl font-bold text-white">{game.title}</h2>
                                                    <p className="text-zinc-400 text-sm">{game.summary}</p>
                                                </div>
                                                <ArchitectureDiagram nodes={game.architecture?.nodes || []} styleName={game.architecture?.style || 'Unknown'} />
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === 'code' && game.html && (
                                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                                            <CodeBlock code={game.html} language="html" />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;
