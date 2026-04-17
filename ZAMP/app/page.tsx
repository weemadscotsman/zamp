'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Square, Pause, SkipForward, SkipBack, Volume2, RefreshCw, Save, Coffee, X, Dices, Download, Settings, Music, Waves } from 'lucide-react';
import { RANDOM_GENRES, RANDOM_TOPICS, RANDOM_VOCALS, RANDOM_ARTISTS, RANDOM_MOODS, ARTISTS, VISUALIZER_STYLES, SKINS, SkinKey } from './constants';
import Visualizer from './components/Visualizer';

interface Track {
  title: string;
  url: string;
  taskId?: string;
  lyrics?: string;
  syncData?: { time: number, text: string }[];
}

const GENERATION_MODES = {
  normal: {
    name: '🎵 Normal Mode',
    description: 'Clean, balanced generation. Standard voices, moderate chaos, radio-friendly.',
    promptModifier: 'professional studio production, polished mix, clear vocals, balanced instrumentation',
    lyricModifier: 'coherent, structured, verse-chorus format, memorable hooks',
    voiceConfig: { primary: 'mixed', layers: 'minimal', backingVocals: true, adLibs: false },
    chaosOverride: 5,
    moodOverride: null,
    tags: [],
    voiceStrategy: 'respect_user',
    instrumentalBias: 0.1
  },
  funky: {
    name: '🕺 Funky Mode',
    description: 'Groovy bass, soulful vibes, rhythmic guitars, call-and-response vocals.',
    promptModifier: 'funky groove with slap bass, wah-wah guitars, tight drums, soulful Rhodes, clavinet, horn stabs, danceable rhythm section, 70s/80s funk influence, syncopated rhythms',
    lyricModifier: 'fun, danceable, call-and-response, groovy, soulful, party vibes, rhythmic phrasing',
    voiceConfig: { primary: 'group', layers: 'doubled', backingVocals: true, adLibs: true },
    chaosOverride: 6,
    moodOverride: 'playful',
    tags: ['vocal group', 'male vocalist', 'female vocalist'],
    voiceStrategy: 'override_group',
    instrumentalBias: 0.2
  },
  unhinged: {
    name: '🤪 Unhinged Mode',
    description: 'Chaotic, genre-bending, experimental, wild tempo shifts, unexpected sounds.',
    promptModifier: 'ABSOLUTELY CHAOTIC genre-fusion, unexpected tempo changes, wild experimental production, kitchen sink approach, bizarre instrumentation, distorted elements, glitches, genre switches mid-song, unpredictable structure, ADHD energy, maximalist chaos',
    lyricModifier: 'nonsensical, surreal, stream-of-consciousness, absurd, random topic shifts, manic energy, free-association, unfiltered',
    voiceConfig: { primary: 'mixed_chaos', layers: 'excessive', backingVocals: true, adLibs: true, pitchShifting: true, effects: ['distortion', 'reverb', 'delay'] },
    chaosOverride: 10,
    moodOverride: 'chaotic',
    tags: ['screaming vocal', 'robotic voice', 'choir'],
    voiceStrategy: 'chaos_mix',
    instrumentalBias: 0.5
  },
  cinematic: {
    name: '🎬 Cinematic Mode',
    description: 'Epic orchestral, soundtrack quality, dramatic dynamics, movie trailer vibes.',
    promptModifier: 'epic cinematic production, orchestral elements, dramatic dynamics, movie soundtrack quality, sweeping strings, powerful brass, massive percussion, trailer-style builds, Hans Zimmer influence, atmospheric pads, emotional swells',
    lyricModifier: 'epic, grand, emotional, narrative-driven, heroic, dramatic, storytelling, larger-than-life',
    voiceConfig: { primary: 'choir', layers: 'orchestral_vocal', backingVocals: true, adLibs: false, epicHarmonies: true },
    chaosOverride: 4,
    moodOverride: 'epic',
    tags: ['choir', 'male vocalist', 'female vocalist'],
    voiceStrategy: 'override_choir',
    instrumentalBias: 0.3
  },
  lofi_chill: {
    name: '😌 Lo-Fi Chill Mode',
    description: 'Dusty samples, soft vocals, rain sounds, study beats, warm and cozy.',
    promptModifier: 'lo-fi hip hop with vinyl crackle, dusty samples, warm Rhodes piano, muted bass, relaxed boom-bap drums, soft rain ambience, tape hiss, warped textures, cozy atmosphere, late-night vibes, minimal processing',
    lyricModifier: 'introspective, mellow, nostalgic, late-night thoughts, soft-spoken, dreamy, personal, quiet',
    voiceConfig: { primary: 'soft_male', layers: 'minimal', backingVocals: false, adLibs: false, whisperLayers: true },
    chaosOverride: 3,
    moodOverride: 'calm',
    tags: ['male vocalist', 'female vocalist'],
    voiceStrategy: 'respect_user',
    instrumentalBias: 0.4
  },
  industrial_metal: {
    name: '⚙️ Industrial Metal Mode',
    description: 'Harsh mechanical sounds, screaming vocals, heavy distortion, dystopian.',
    promptModifier: 'industrial metal with mechanical percussion, distorted guitars, factory machine samples, harsh noise elements, dystopian atmosphere, crushing compression, screaming vocals, metallic textures, cybernetic elements, aggressive and oppressive',
    lyricModifier: 'dystopian, mechanical, angry, anti-establishment, dark, aggressive, dehumanized, technological dread',
    voiceConfig: { primary: 'screaming', layers: 'aggressive', backingVocals: true, adLibs: true, distorted: true, roboticLayers: true },
    chaosOverride: 7,
    moodOverride: 'aggressive',
    tags: ['screaming vocal', 'robotic voice', 'male vocalist'],
    voiceStrategy: 'override_scream',
    instrumentalBias: 0.2
  },
  dream_pop: {
    name: '☁️ Dream Pop Mode',
    description: 'Ethereal vocals, heavy reverb, hazy guitars, washed out, romantic.',
    promptModifier: 'dream pop with washed out guitars, heavy reverb, ethereal vocals, hazy atmosphere, warm tape saturation, swirling textures, shoegaze influence, blurred edges, nostalgic warmth, floating sensation, intimate yet distant',
    lyricModifier: 'dreamy, ethereal, romantic, nostalgic, hazy, abstract, emotional, floating, intimate',
    voiceConfig: { primary: 'ethereal_female', layers: 'harmonized', backingVocals: true, adLibs: false, breathy: true, reverbHeavy: true },
    chaosOverride: 4,
    moodOverride: 'romantic',
    tags: ['female vocalist', 'androgynous vocals'],
    voiceStrategy: 'override_female',
    instrumentalBias: 0.3
  },
  punk_raw: {
    name: '💀 Punk Raw Mode',
    description: 'Fast, raw, rebellious, garage production, anti-establishment energy.',
    promptModifier: 'raw punk rock with lo-fi recording quality, fast tempos, distorted guitars, aggressive drums, shouted vocals, basement acoustics, DIY ethos, rebellious energy, no polish, in-your-face attitude, short and intense',
    lyricModifier: 'rebellious, angry, political, youthful, anti-authority, raw, direct, chantable, protest',
    voiceConfig: { primary: 'shouted', layers: 'gang', backingVocals: true, adLibs: true, raw: true },
    chaosOverride: 8,
    moodOverride: 'aggressive',
    tags: ['screaming vocal', 'male vocalist'],
    voiceStrategy: 'override_group',
    instrumentalBias: 0.1
  },
  trap_dark: {
    name: '💎 Dark Trap Mode',
    description: '808s, hi-hats, dark atmosphere, street vibes, modern hip-hop.',
    promptModifier: 'dark trap with booming 808s, rapid hi-hats, ominous synth pads, dark atmosphere, street aesthetic, lean-soaked ambience, minimal melodic elements, hard-hitting drums, mysterious and threatening vibe, modern rap production',
    lyricModifier: 'street life, flex culture, struggle, success, dark, confident, trap lifestyle, hustler mentality',
    voiceConfig: { primary: 'rapper', layers: 'doubled', backingVocals: false, adLibs: true, autoTune: true },
    chaosOverride: 5,
    moodOverride: 'dark',
    tags: ['male rapper', 'female rapper'],
    voiceStrategy: 'override_rapper',
    instrumentalBias: 0.2
  },
  hyperpop_maximalist: {
    name: '✨ Hyperpop Max Mode',
    description: 'Extreme pitch shifts, sugary synths, chaotic energy, internet culture.',
    promptModifier: 'hyperpop with extreme pitch-shifted vocals, glitchy production, maximalist sound design, bubblegum bass, sugary synths, chaotic energy, digital distortion, internet aesthetic, processed vocals, emojis-as-sounds, sensory overload',
    lyricModifier: 'playful, internet culture, surreal, exaggerated emotions, meme references, hyperactive, digital age romance, absurdist',
    voiceConfig: { primary: 'pitch_shifted', layers: 'excessive_auto', backingVocals: true, adLibs: true, extremeProcessing: true },
    chaosOverride: 9,
    moodOverride: 'playful',
    tags: ['robotic voice', 'screaming vocal'],
    voiceStrategy: 'chaos_mix',
    instrumentalBias: 0.3
  },
  acoustic_folk: {
    name: '🪵 Acoustic Folk Mode',
    description: 'Raw acoustic, storytelling, organic, campfire vibes, authentic.',
    promptModifier: 'acoustic folk with organic instrumentation, fingerpicked guitar, raw vocals, storytelling focus, warm natural reverb, unplugged aesthetic, roots influence, authentic and intimate, human imperfections, campfire warmth',
    lyricModifier: 'storytelling, narrative, personal, authentic, traditional, nature references, introspective, warm',
    voiceConfig: { primary: 'natural_male', layers: 'minimal', backingVocals: false, adLibs: false, raw: true },
    chaosOverride: 2,
    moodOverride: 'introspective',
    tags: ['male vocalist', 'female vocalist'],
    voiceStrategy: 'respect_user',
    instrumentalBias: 0.1
  },
  phonk_memphis: {
    name: '🏎️ Phonk Drift Mode',
    description: 'Cowbells, Memphis samples, reverb-heavy, drifting culture, underground.',
    promptModifier: 'phonk with cowbell percussion, chopped Memphis rap samples, heavy distorted 808s, reverb-drenched atmosphere, drifting car culture, underground aesthetic, slowed + reverb vibes, haunting samples, bass-heavy, trance-inducing',
    lyricModifier: 'street, drifting, underground, aggressive, trance-like, hypnotic, car culture, nighttime drives',
    voiceConfig: { primary: 'chopped', layers: 'sampled', backingVocals: false, adLibs: false, lowPitch: true },
    chaosOverride: 6,
    moodOverride: 'hypnotic',
    tags: ['male rapper'],
    voiceStrategy: 'override_rapper',
    instrumentalBias: 0.5
  }
};
type GenerationModeKey = keyof typeof GENERATION_MODES;

const SHORTCUTS = [
  { key: 'Space', action: 'Play/Pause' },
  { key: '← / →', action: 'Prev/Next Track' },
  { key: '↑ / ↓', action: 'Volume Up/Down' },
  { key: 'N', action: 'Focus Prompt' },
  { key: 'G', action: 'Generate' },
  { key: 'R', action: 'Randomize' },
  { key: 'S', action: 'Save Track' },
  { key: 'D', action: 'Download Lyrics' },
  { key: 'L', action: 'Toggle Lyrics' },
  { key: '?', action: 'Show Shortcuts' }
];

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

export default function WinampApp() {
  const [prompt, setPrompt] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [artist, setArtist] = useState('Snoopys Log');
  const [genre, setGenre] = useState('Metal Lullaby');
  const [mood, setMood] = useState('epic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('WINAMP 2.0 AI EDITION');
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [spectrum, setSpectrum] = useState<number[]>(Array(15).fill(10));
  const [credits, setCredits] = useState<number | string>('...');
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [showCreditsPurchase, setShowCreditsPurchase] = useState(false);
  const [skin, setSkin] = useState<SkinKey>('winamp');
  const [powerOn, setPowerOn] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [showIntelBoot, setShowIntelBoot] = useState(false);
  const [splashVu, setSplashVu] = useState<number[]>(Array(8).fill(10));
  const [intelLines, setIntelLines] = useState<string[]>([]);

  const [tempo, setTempo] = useState('Mid-tempo Groove');
  const [persona, setPersona] = useState('The Rebel');
  const [chaos, setChaos] = useState(5);
  const [arc, setArc] = useState('Static (Consistent Vibe)');
  const [generationMode, setGenerationMode] = useState<GenerationModeKey>('normal');
  
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const [showLyrics, setShowLyrics] = useState(true);

  const [visualizerStyle, setVisualizerStyle] = useState('bars');
  const [eqBands, setEqBands] = useState<number[]>(Array(10).fill(0));
  const [showEqPanel, setShowEqPanel] = useState(false);
  const [showVisualizerPanel, setShowVisualizerPanel] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);
  const [minimizedPanels, setMinimizedPanels] = useState<Record<string, boolean>>({});

  const currentSkin = SKINS[skin];

  const togglePanel = (panelId: string) => {
    setMinimizedPanels(prev => ({ ...prev, [panelId]: !prev[panelId] }));
  };

  const isPanelMinimized = (panelId: string) => !!minimizedPanels[panelId];

  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const fetchCredits = async () => {
    try {
      // Check Sonauto credits balance first
      const res = await fetch('/api/credits');
      const data = await res.json();
      if (data.num_credits !== undefined) {
        setCredits(data.num_credits + (data.num_credits_payg || 0));
      } else if (data.balance !== undefined) {
        setCredits(data.balance);
      } else {
        // Fallback to localStorage for demo
        const stored = localStorage.getItem('zamp_credits');
        if (stored) setCredits(parseInt(stored, 10));
        else setCredits(5); // Default 5 free credits
      }
    } catch (e) {
      // Fallback to localStorage
      const stored = localStorage.getItem('zamp_credits');
      if (stored) setCredits(parseInt(stored, 10));
      else setCredits(5);
    }
  };

  useEffect(() => {
    fetchCredits();
    try {
      const saved = localStorage.getItem('zamp_playlist');
      const savedIndex = localStorage.getItem('zamp_currentTrackIndex');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPlaylist(parsed);
      }
      if (savedIndex) {
        const idx = parseInt(savedIndex, 10);
        if (!isNaN(idx)) setCurrentTrackIndex(idx);
      }
    } catch (e) {
      console.error('Failed to load playlist from localStorage', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('zamp_playlist', JSON.stringify(playlist));
      localStorage.setItem('zamp_currentTrackIndex', String(currentTrackIndex));
    } catch (e) {
      console.error('Failed to save playlist to localStorage', e);
    }
  }, [playlist, currentTrackIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key !== 'Escape') return;
      }
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) handlePause();
          else handlePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'n':
        case 'N':
          (document.querySelector('input[placeholder*="cat finding"]') as HTMLElement)?.focus();
          break;
        case 'g':
        case 'G':
          if (!isGenerating && prompt) generateSong();
          break;
        case 'r':
        case 'R':
          handleRandomize();
          break;
        case 's':
        case 'S':
          if (currentTrackIndex >= 0 && playlist[currentTrackIndex]) {
            handleDownload(playlist[currentTrackIndex].url, playlist[currentTrackIndex].title);
          }
          break;
        case 'd':
        case 'D':
          {
            const currentLyrics = playlist[currentTrackIndex]?.lyrics;
            if (currentLyrics) {
              const blob = new Blob([currentLyrics], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${playlist[currentTrackIndex].title}_lyrics.txt`;
              a.click();
            }
          }
          break;
        case 'l':
        case 'L':
          setShowLyrics(prev => !prev);
          break;
        case '?':
          setShowShortcuts(true);
          break;
        case 'Escape':
          setShowShortcuts(false);
          setShowEqPanel(false);
          setShowVisualizerPanel(false);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTrackIndex, playlist, prompt, isGenerating]);

  useEffect(() => {
    if (powerOn && showSplash) {
      const interval = setInterval(() => {
        setSplashVu(Array(8).fill(0).map(() => Math.floor(Math.random() * 90) + 10));
      }, 100);
      const timeout = setTimeout(() => {
        setShowSplash(false);
        setShowIntelBoot(true);
      }, 2500);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
  }, [powerOn, showSplash]);

  // Intel Boot Sequence lines
  const INTEL_BOOT_LINES = [
    "Intel (R) Pentium (R) CPU",
    "Copyright (C) Intel Corporation",
    "",
    "128MB Memory",
    "",
    "Detecting IDE Primary Master... HDD-0",
    "Detecting IDE Primary Slave... CD-ROM",
    "Detecting IDE Secondary Master... None",
    "Detecting IDE Secondary Slave... None",
    "",
    "PCI Device Listing:",
    "  Bus 0 Device 0: Intel AGP Controller",
    "  Bus 0 Device 1: Intel USB Controller",
    "  Bus 0 Device 2: Intel Audio Device",
    "  Bus 0 Device 3: Intel Network Controller",
    "",
    "Loading LUNO Boot Sector...",
    "Starting LUNO OS v3.4...",
    "",
    "Initializing CANN.ON.AI Core...",
  ];

  useEffect(() => {
    if (showIntelBoot) {
      setIntelLines([]);
      let lineIndex = 0;
      const lineInterval = setInterval(() => {
        if (lineIndex < INTEL_BOOT_LINES.length) {
          setIntelLines(prev => [...prev, INTEL_BOOT_LINES[lineIndex]]);
          lineIndex++;
        } else {
          clearInterval(lineInterval);
          setTimeout(() => setShowIntelBoot(false), 1500);
        }
      }, 180);
      return () => clearInterval(lineInterval);
    }
  }, [showIntelBoot]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setSpectrum(Array(15).fill(0).map(() => Math.floor(Math.random() * 90) + 10));
      }, 100);
    } else if (isGenerating) {
      let step = 0;
      interval = setInterval(() => {
        setSpectrum(Array(15).fill(0).map((_, i) => {
          return 10 + Math.abs(Math.sin(step + i * 0.5)) * 80;
        }));
        step += 0.2;
      }, 50);
    } else {
      setSpectrum(Array(15).fill(10));
    }
    return () => clearInterval(interval);
  }, [isPlaying, isGenerating]);

  useEffect(() => {
    if (lyricsRef.current && isPlaying) {
      const container = lyricsRef.current;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      if (scrollHeight > 0) {
        container.scrollTop = (progress / 100) * scrollHeight;
      }
    }
  }, [progress, isPlaying]);

  const handlePlay = () => {
    if (currentTrackIndex === -1 && playlist.length > 0) {
      setCurrentTrackIndex(0);
      setIsPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      setStatus(`PLAYING: ${playlist[currentTrackIndex]?.title || 'TRACK'}`);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setStatus('PAUSED');
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setStatus('STOPPED');
    }
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => prev <= 0 ? playlist.length - 1 : prev - 1);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleRandomize = () => {
    const randomGenre = RANDOM_GENRES[Math.floor(Math.random() * RANDOM_GENRES.length)];
    const randomTopic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
    const randomVocal = RANDOM_VOCALS[Math.floor(Math.random() * RANDOM_VOCALS.length)];
    const randomMood = RANDOM_MOODS[Math.floor(Math.random() * RANDOM_MOODS.length)];
    const randomArtist = RANDOM_ARTISTS[Math.floor(Math.random() * RANDOM_ARTISTS.length)];
    
    const modeKeys = Object.keys(GENERATION_MODES).filter(k => k !== 'normal');
    const randomMode = modeKeys[Math.floor(Math.random() * modeKeys.length)] as GenerationModeKey;
    
    setGenre(randomGenre);
    setPrompt(randomTopic);
    setVocalStyle(randomVocal);
    setMood(randomMood);
    setArtist(randomArtist);
    setGenerationMode(randomMode);
    setCustomLyrics('');
    setStatus(`RANDOMIZED: ${GENERATION_MODES[randomMode].name.toUpperCase()} MODE ACTIVATED`);
  };

  const insertLyricTag = (tag: string) => {
    setCustomLyrics(prev => prev + (prev.length > 0 && !prev.endsWith('\n') ? '\n' : '') + tag + '\n');
  };

  const handleGenerateSTT = async () => {
    const track = playlist[currentTrackIndex];
    if (!track || !track.url || !track.lyrics) return;
    
    setStatus('ANALYZING AUDIO WITH STT...');
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: track.url, lyrics: track.lyrics })
      });
      const data = await res.json();
      if (data.syncData) {
        setPlaylist(prev => {
          const newP = [...prev];
          newP[currentTrackIndex].syncData = data.syncData;
          return newP;
        });
        setStatus('STT SYNC COMPLETE');
      } else {
        setStatus('STT FAILED');
      }
    } catch (e) {
      setStatus('STT ERROR');
    }
  };

  const handleTTS = () => {
    const track = playlist[currentTrackIndex];
    if (!track || !track.lyrics) return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(track.lyrics);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
      setStatus('PLAYING TTS...');
    } else {
      setStatus('TTS NOT SUPPORTED');
    }
  };

  const toggleFavorite = (idx: number) => {
    setFavorites(prev => 
      prev.includes(idx) 
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    );
  };

  const handleCreditPurchase = (amount: number, price: number) => {
    // For now, show crypto payment modal
    setShowCreditsPurchase(false);
    setShowCryptoModal(true);
    setStatus(`CREDITS: $${price} - SELECT PAYMENT METHOD`);
  };

  const exportPlaylist = () => {
    const exportData = {
      tracks: playlist,
      favorites: favorites,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zamp-playlist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('PLAYLIST EXPORTED');
  };

  const importPlaylist = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.tracks && Array.isArray(data.tracks)) {
          setPlaylist(data.tracks);
          if (data.favorites && Array.isArray(data.favorites)) {
            setFavorites(data.favorites);
          }
          setStatus('PLAYLIST IMPORTED');
        }
      } catch (err) {
        setStatus('IMPORT FAILED');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const title = file.name.replace(/\.[^/.]+$/, '');
      setPlaylist(prev => [...prev, { title, url }]);
    });
    e.target.value = '';
    setStatus('TRACKS ADDED');
  };

  const handleDownload = async (url: string, title: string) => {
    if (!url || url.includes('api-stream.sonauto.ai')) {
      setStatus('CANNOT DOWNLOAD STREAM');
      return;
    }
    try {
      setStatus('DOWNLOADING...');
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      setStatus('DOWNLOAD COMPLETE');
    } catch (e) {
      console.error(e);
      setStatus('DOWNLOAD FAILED');
    }
  };

  const generateSong = async () => {
    if (!prompt && !customLyrics) return;
    
    // Check credits before generation
    const currentCredits = typeof credits === 'number' ? credits : parseInt(String(credits), 10);
    if (isNaN(currentCredits) || currentCredits < 1) {
      setStatus('NO CREDITS - CLICK COFFEE TO BUY');
      setShowCreditsPurchase(true);
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setIsStreaming(false);
    setStatus('STARTING AI ENGINE...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, artist, genre, customLyrics, mood, tempo, persona, chaos, arc, generationMode })
      });

      const data = await res.json();
      const generatedLyrics = data.lyrics;

      if (data.success && data.task_id) {
        setStatus('POLLING SONAUTO API...');
        
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/status?task_id=${data.task_id}`);
            const statusData = await statusRes.json();
            
            if (statusData.status === 'GENERATING_STREAMING_READY') {
              setStatus('GENERATING AUDIO...');
            } else if (statusData.status === 'SUCCESS') {
              clearInterval(pollInterval);
              
              let audioUrl = '';
              if (statusData.song_paths && statusData.song_paths.length > 0) {
                audioUrl = statusData.song_paths[0];
              }
              
              if (audioUrl) {
                const trackTitle = `${artist} - ${prompt.substring(0, 20)}`;
                const finalLyrics = statusData.lyrics || generatedLyrics;
                
                setPlaylist(prev => {
                  const existingIdx = prev.findIndex(t => t.taskId === data.task_id);
                  if (existingIdx !== -1) {
                    const newPlaylist = [...prev];
                    newPlaylist[existingIdx] = {
                      title: trackTitle,
                      url: audioUrl,
                      taskId: data.task_id,
                      lyrics: finalLyrics
                    };
                    return newPlaylist;
                  }
                  return [...prev, {
                    title: trackTitle,
                    url: audioUrl,
                    taskId: data.task_id,
                    lyrics: finalLyrics
                  }];
                });

                if (finalLyrics) {
                   const blob = new Blob([finalLyrics], { type: 'text/plain' });
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `${trackTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lyrics.txt`;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
                }

                handleDownload(audioUrl, trackTitle);
                
                // Deduct credit locally
                const newCredits = typeof credits === 'number' ? credits - 1 : 4;
                setCredits(newCredits);
                localStorage.setItem('zamp_credits', String(newCredits));
                
                setStatus('GENERATION COMPLETE');
              } else {
                setStatus('ERROR: NO AUDIO URL');
              }
              setPrompt('');
              setCustomLyrics('');
              setIsGenerating(false);
              setIsStreaming(false);
              fetchCredits();
            } else if (statusData.status === 'FAILED' || statusData.status === 'FAILURE') {
              clearInterval(pollInterval);
              setStatus(`ERROR: ${statusData.error_message || 'GENERATION FAILED'}`);
              setIsGenerating(false);
              setIsStreaming(false);
              fetchCredits();
            } else if (statusData.error) {
              clearInterval(pollInterval);
              setStatus(`API ERROR: ${statusData.error}`);
              setIsGenerating(false);
              setIsStreaming(false);
            } else {
              setStatus(`STATUS: ${statusData.status || 'WORKING...'}`);
            }
          } catch (e) {
            console.error(e);
          }
        }, 5000);
      } else {
        setStatus('ERROR STARTING GENERATION');
        setIsGenerating(false);
      }
    } catch (e) {
      setStatus('API CONNECTION ERROR');
      setIsGenerating(false);
    }
  };

  const resetEq = () => setEqBands(Array(10).fill(0));

  if (!powerOn) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-[family-name:var(--font-vt323)] crt">
        <button
          onClick={() => { setPowerOn(true); setShowSplash(true); }}
          className="flex flex-col items-center animate-pulse cursor-pointer bg-transparent border-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00ff00] mb-4 drop-shadow-[0_0_20px_#00ff00]" style={{filter:'drop-shadow(0 0 10px #00ff00)'}}>
            <path d="M12 2v10"></path>
            <path d="M18.4 6.6a9 9 0 1 1-12.77.04"></path>
          </svg>
          <h1 className="text-4xl text-[#00ff00] drop-shadow-[0_0_10px_#00ff00]">POWER ON</h1>
        </button>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-[family-name:var(--font-vt323)] text-center p-4">
        <div className="flex items-end gap-1 h-16 mb-8">
          {splashVu.map((h, i) => (
            <div key={i} className="w-4 bg-[#00ff00] transition-all duration-75 shadow-[0_0_10px_#00ff00]" style={{ height: `${h}%` }}></div>
          ))}
        </div>
        <h1 className="text-5xl text-[#00ff00] mb-4 drop-shadow-[0_0_10px_#00ff00]">CANN.ON.AI Production Core Online</h1>
        <h2 className="text-2xl text-[#00aa00] tracking-widest">LUNO STUDIOS – 128kbps & BEYOND</h2>
        <p className="mt-8 text-[#005500] animate-pulse">INITIALIZING AUDIO MATRICES...</p>
      </div>
    );
  }

  if (showIntelBoot) {
    return (
      <div className="fixed inset-0 bg-[#000040] z-50 flex flex-col font-[family-name:var(--font-vt323)] text-[#00ff00] p-4 overflow-hidden">
        <div className="text-sm leading-5 tracking-tight">
          <div className="mb-1">Intel (R) Pentium (R) CPU</div>
          <div className="mb-3">Copyright (C) Intel Corporation</div>
          <div className="mb-4 border-t border-[#00ff00]/30 pt-2"></div>
          {intelLines.map((line, i) => (
            <div key={i} className={line === "" ? "h-3" : ""}>{line}</div>
          ))}
          <div className="mt-4 animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const currentLyrics = playlist[currentTrackIndex]?.lyrics || '';
  const lyricLines = currentLyrics.split('\n').filter(l => l.trim() !== '');
  const currentLineIndex = lyricLines.length > 0 
    ? Math.min(lyricLines.length - 1, Math.floor((progress / 100) * lyricLines.length))
    : -1;

  return (
    <div className={`min-h-screen ${currentSkin.bg} relative overflow-hidden font-sans transition-colors duration-300`}>
      {/* Full-screen background visualizer */}
      <div className="absolute inset-0 z-0">
        <Visualizer
          audioRef={audioRef}
          style={visualizerStyle}
          speed={1}
          intensity={1}
          colorHue={0}
          performanceMode="mid"
          eqBands={eqBands}
        />
      </div>

      {/* Click to toggle player visibility */}
      <div 
        className="absolute inset-0 z-[1] cursor-pointer"
        onClick={() => setShowPlayer(prev => !prev)}
        title={showPlayer ? 'Click to hide player' : 'Click to show player'}
      />

      <div 
        className={`relative z-10 min-h-screen flex flex-col items-center justify-start p-4 overflow-y-auto transition-opacity duration-500 ${showPlayer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 pb-20">

          <div className="lg:col-span-5 space-y-4">
            <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
              <div 
                className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                onClick={() => togglePanel('skin-ai')}
              >
                <span>{currentSkin.name.toUpperCase()} AI {isPanelMinimized('skin-ai') ? '[-]' : '[−]'}</span>
                <div className="flex items-center gap-2">
                  <select 
                    value={skin} 
                    onChange={(e) => setSkin(e.target.value as SkinKey)}
                    className="bg-transparent text-inherit border-none text-[10px] outline-none cursor-pointer"
                  >
                    {Object.entries(SKINS).map(([k, v]) => (
                      <option key={k} value={k} className="text-black">{v.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setShowCryptoModal(true)}
                    className="flex items-center gap-1 bg-[#ff9900] text-black px-2 py-0.5 text-[10px] font-bold hover:bg-[#ffaa22] border border-black"
                    title="Buy me a coffee"
                  >
                    <Coffee size={10} /> TIP
                  </button>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setShowVisualizerPanel(!showVisualizerPanel)}
                      className="flex items-center justify-center w-5 h-5 bg-[#c0c0c0] border border-[#fff] border-b-[#444] border-r-[#444] text-[8px] text-black"
                      title="Visualizer"
                    >
                      <Music size={8} />
                    </button>
                    <button 
                      onClick={() => setShowEqPanel(!showEqPanel)}
                      className="flex items-center justify-center w-5 h-5 bg-[#c0c0c0] border border-[#fff] border-b-[#444] border-r-[#444] text-[8px] text-black"
                      title="EQ"
                    >
                      <Waves size={8} />
                    </button>
                  </div>
                </div>
              </div>

              {!isPanelMinimized('skin-ai') && (
              <div className="p-3 space-y-3">
                <div className={`${currentSkin.lcd} p-2 flex flex-col gap-1 relative overflow-hidden transition-all duration-300`}>
                  <div className={`${currentSkin.lcdFont} text-xl tracking-widest whitespace-nowrap overflow-hidden relative h-7`}>
                    <div className={status.length > 25 ? "animate-[marquee_10s_linear_infinite] absolute whitespace-nowrap" : "absolute whitespace-nowrap"}>
                      {status} {status.length > 25 && <span className="ml-8">{status}</span>}
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className={`${currentSkin.lcdFont} text-4xl leading-none`}>
                      {isPlaying ? '01:23' : '00:00'}
                    </div>
                    <div className="flex gap-[2px] h-10 items-end bg-black/50 p-1 border border-white/10">
                      {spectrum.map((height, i) => (
                        <div key={i} className="w-1.5 bg-black/50 flex flex-col justify-end overflow-hidden h-full">
                          <div
                            className="w-full bg-current transition-all duration-75"
                            style={{ height: `${height}%` }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`${currentSkin.lcdFont} text-sm flex justify-between mt-1 opacity-80`}>
                    <div className="flex gap-4">
                      <span>128 kbps</span>
                      <span>44 kHz</span>
                    </div>
                    <span>CREDITS: {credits}</span>
                  </div>
                </div>

                <div className={`${currentSkin.panel} p-2 flex flex-col gap-3 transition-all duration-300`}>
                  <div className="h-3 bg-black/80 border border-white/20 relative cursor-pointer">
                    <div className="h-full bg-current" style={{ width: `${progress}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                      <button onClick={handlePrev} className={`w-8 h-8 flex items-center justify-center ${currentSkin.button}`}>
                        <SkipBack size={16} fill="currentColor" />
                      </button>
                      <button onClick={handlePlay} className={`w-8 h-8 flex items-center justify-center ${currentSkin.button}`}>
                        <Play size={16} fill="currentColor" />
                      </button>
                      <button onClick={handlePause} className={`w-8 h-8 flex items-center justify-center ${currentSkin.button}`}>
                        <Pause size={16} fill="currentColor" />
                      </button>
                      <button onClick={handleStop} className={`w-8 h-8 flex items-center justify-center ${currentSkin.button}`}>
                        <Square size={14} fill="currentColor" />
                      </button>
                      <button onClick={handleNext} className={`w-8 h-8 flex items-center justify-center ${currentSkin.button}`}>
                        <SkipForward size={16} fill="currentColor" />
                      </button>
                      <button 
                        onClick={() => {
                          if (currentTrackIndex >= 0 && playlist[currentTrackIndex]) {
                            handleDownload(playlist[currentTrackIndex].url, playlist[currentTrackIndex].title);
                          }
                        }}
                        className={`w-8 h-8 flex items-center justify-center ml-2 ${currentSkin.button}`}
                        title="Save Track (S)"
                      >
                        <Save size={16} />
                      </button>
                      {!showLyrics && (
                        <button 
                          onClick={() => setShowLyrics(true)}
                          className={`w-8 h-8 flex items-center justify-center ml-1 ${currentSkin.button}`}
                          title="Show Lyrics (L)"
                        >
                          <span className="text-[10px]">L</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Volume2 size={16} className="opacity-70" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>

            {showVisualizerPanel && (
              <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
                <div 
                  className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                  onClick={() => togglePanel('visualizer')}
                >
                  <span>VISUALIZER {isPanelMinimized('visualizer') ? '[-]' : '[−]'}</span>
                  <button onClick={(e) => { e.stopPropagation(); setShowVisualizerPanel(false); }}><X size={12} /></button>
                </div>
                {!isPanelMinimized('visualizer') && (
                <div className="p-2">
                  <select
                    value={visualizerStyle}
                    onChange={(e) => setVisualizerStyle(e.target.value)}
                    className={`w-full p-1 ${currentSkin.input} ${currentSkin.lcdFont}`}
                  >
                    {VISUALIZER_STYLES.map((style) => (
                      <option key={style.id} value={style.id}>{style.name}</option>
                    ))}
                  </select>
                </div>
                )}
              </div>
            )}

            {showEqPanel && (
              <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
                <div 
                  className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                  onClick={() => togglePanel('eq')}
                >
                  <span>10-BAND EQUALIZER {isPanelMinimized('eq') ? '[-]' : '[−]'}</span>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); resetEq(); }} className="text-[10px] hover:opacity-80">RESET</button>
                    <button onClick={(e) => { e.stopPropagation(); setShowEqPanel(false); }}><X size={12} /></button>
                  </div>
                </div>
                {!isPanelMinimized('eq') && (
                <div className="p-2">
                  <div className="flex justify-between items-end h-24 gap-1">
                    {eqBands.map((band, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={band}
                          onChange={(e) => {
                            const newEq = [...eqBands];
                            newEq[i] = parseFloat(e.target.value);
                            setEqBands(newEq);
                          }}
                          className="w-4 h-16 appearance-none bg-black/50 rounded"
                          style={{ 
                            writingMode: 'vertical-rl',
                            WebkitAppearance: 'slider-vertical'
                          } as any}
                        />
                        <span className={`text-[8px] ${currentSkin.text}`}>{EQ_LABELS[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}

            <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
              <div 
                className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                onClick={() => togglePanel('luno-console')}
              >
                <span>LUNO STUDIO CONSOLE {isPanelMinimized('luno-console') ? '[-]' : '[−]'}</span>
              </div>
              {!isPanelMinimized('luno-console') && (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                   <select value={tempo} onChange={e=>setTempo(e.target.value)} className={`p-1 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}>
                     <option>Slow & Heavy</option>
                     <option>Mid-tempo Groove</option>
                     <option>Fast & Driving</option>
                     <option>Frantic / Chaotic</option>
                   </select>
                    <select value={persona} onChange={e=>setPersona(e.target.value)} className={`p-1 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}>
                      <option value="The Anarchist">The Anarchist 🏴‍☠️</option>
                      <option value="The Heartbreaker">The Heartbreaker 💔</option>
                      <option value="The Cosmic Prophet">The Cosmic Prophet 🪐</option>
                      <option value="The Sad Clown">The Sad Clown 🤡</option>
                      <option value="The Glitchy Machine">The Glitchy Machine 🤖</option>
                      <option value="The Disco Diva">The Disco Diva 💃</option>
                      <option value="The Grunge Grifter">The Grunge Grifter 🎸</option>
                      <option value="The Pop Puppet">The Pop Puppet 🎭</option>
                    </select>
                   <select value={arc} onChange={e=>setArc(e.target.value)} className={`p-1 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont} col-span-2`}>
                     <option>Static (Consistent Vibe)</option>
                     <option>Rise (Builds to Climax)</option>
                     <option>Fall (Starts High, Ends Low)</option>
                     <option>Wave (Ups and Downs)</option>
                     <option>Explosion (Chaos Then Calm)</option>
                   </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={currentSkin.text}>CHAOS LEVEL</span>
                    <span className={currentSkin.text}>{chaos}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={chaos}
                    onChange={(e) => setChaos(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] opacity-60 mt-1">
                    <span>Predictable</span>
                    <span>Chaotic</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs mb-1"><span className={currentSkin.text}>GENERATION MODE</span></div>
                  <select 
                    value={generationMode} 
                    onChange={(e) => setGenerationMode(e.target.value as GenerationModeKey)}
                    className={`w-full p-1 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}
                  >
                    {Object.entries(GENERATION_MODES).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                  <p className={`text-[10px] mt-1 opacity-70 ${currentSkin.text}`}>
                    {GENERATION_MODES[generationMode].description}
                  </p>
                </div>
              </div>
              )}
            </div>

            <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
              <div 
                className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                onClick={() => togglePanel('playlist')}
              >
                <span>PLAYLIST ({playlist.length}) {isPanelMinimized('playlist') ? '[-]' : '[−]'}</span>
                <div className="flex gap-2">
                  <button onClick={exportPlaylist} className="text-[10px] hover:opacity-80">EXPORT</button>
                  <label className="text-[10px] hover:opacity-80 cursor-pointer">
                    IMPORT
                    <input type="file" accept=".json" onChange={importPlaylist} className="hidden" />
                  </label>
                  <label className="text-[10px] hover:opacity-80 cursor-pointer">
                    ADD
                    <input type="file" accept="audio/*" multiple onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`text-[10px] hover:opacity-80 ${showFavoritesOnly ? 'text-yellow-400' : ''}`}>
                    {showFavoritesOnly ? 'ALL' : '♥'}
                  </button>
                </div>
              </div>
              {!isPanelMinimized('playlist') && (
              <div className={`max-h-48 overflow-y-auto p-1 space-y-1 ${currentSkin.panel}`}>
                {playlist.length === 0 && (
                  <div className={`text-center text-xs py-4 opacity-50 ${currentSkin.text}`}>NO TRACKS</div>
                )}
                {playlist.map((track, idx) => {
                  if (showFavoritesOnly && !favorites.includes(idx)) return null;
                  const isCurrent = idx === currentTrackIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => { setCurrentTrackIndex(idx); setIsPlaying(true); }}
                      className={`flex items-center justify-between px-2 py-1 text-xs cursor-pointer ${isCurrent ? currentSkin.highlight : currentSkin.hover}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="opacity-50 w-4">{idx + 1}</span>
                        <span className="truncate">{track.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(idx); }}
                          className={`text-[10px] ${favorites.includes(idx) ? 'text-yellow-400' : 'opacity-30'}`}
                        >
                          ♥
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(track.url, track.title); }}
                          className="opacity-50 hover:opacity-100"
                        >
                          <Download size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
              <div 
                className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                onClick={() => togglePanel('generation')}
              >
                <span>AI SONG GENERATOR {isPanelMinimized('generation') ? '[-]' : '[−]'}</span>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleRandomize(); }} className="flex items-center gap-1 text-[10px] hover:opacity-80">
                    <Dices size={10} /> RANDOMIZE (R)
                  </button>
                </div>
              </div>
              {!isPanelMinimized('generation') && (
              <div className="p-3 space-y-3">
                <div>
                  <label className={`text-xs block mb-1 ${currentSkin.text}`}>PROMPT / TOPIC</label>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. a cat finding itself in space"
                    className={`w-full p-2 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-xs block mb-1 ${currentSkin.text}`}>ARTIST</label>
                    <select
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      className={`w-full p-2 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}
                    >
                      {ARTISTS.map((a) => (
                        <option key={a.key} value={a.key}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${currentSkin.text}`}>GENRE</label>
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      placeholder="e.g. Cyberpunk Polka"
                      className={`w-full p-2 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}
                    />
                  </div>
                  <div>
                    <label className={`text-xs block mb-1 ${currentSkin.text}`}>MOOD</label>
                    <select
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className={`w-full p-2 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont}`}
                    >
                      {RANDOM_MOODS.map((m) => (
                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className={`text-xs ${currentSkin.text}`}>CUSTOM LYRICS (OPTIONAL)</label>
                    <div className="flex gap-1">
                      {['[Intro]', '[Verse 1]', '[Chorus]', '[Bridge]', '[Outro]'].map(tag => (
                        <button
                          key={tag}
                          onClick={() => insertLyricTag(tag)}
                          className={`text-[10px] px-1 py-0.5 ${currentSkin.button}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder="Leave empty for AI-generated lyrics..."
                    rows={4}
                    className={`w-full p-2 focus:outline-none ${currentSkin.input} ${currentSkin.lcdFont} resize-none`}
                  />
                </div>

                <button
                  onClick={generateSong}
                  disabled={isGenerating || (!prompt && !customLyrics)}
                  className={`w-full py-2 font-bold text-sm ${currentSkin.button} disabled:opacity-50`}
                >
                  {isGenerating ? 'GENERATING...' : 'GENERATE SONG (G)'}
                </button>
              </div>
              )}
            </div>

            {showLyrics && (
              <div className={`${currentSkin.window} p-1 transition-all duration-300`}>
                <div 
                  className={`${currentSkin.titleBar} px-2 py-0.5 flex justify-between items-center text-xs font-bold cursor-pointer select-none`}
                  onClick={() => togglePanel('lyrics')}
                >
                  <span>LYRICS {isPanelMinimized('lyrics') ? '[-]' : '[−]'}</span>
                  <div className="flex gap-2">
                    {currentLyrics && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleTTS(); }} className="text-[10px] hover:opacity-80">TTS</button>
                        <button onClick={(e) => { e.stopPropagation(); handleGenerateSTT(); }} className="text-[10px] hover:opacity-80">SYNC</button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setShowLyrics(false); }}><X size={12} /></button>
                  </div>
                </div>
                {!isPanelMinimized('lyrics') && (
                <div
                  ref={lyricsRef}
                  className={`max-h-64 overflow-y-auto p-3 text-sm whitespace-pre-wrap ${currentSkin.panel} ${currentSkin.lcdFont}`}
                >
                  {currentLyrics ? (
                    lyricLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={`mb-1 transition-opacity duration-300 ${
                          idx === currentLineIndex ? 'opacity-100 font-bold' : 'opacity-50'
                        }`}
                      >
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className={`text-center py-8 opacity-50 ${currentSkin.text}`}>NO LYRICS FOR CURRENT TRACK</div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {playlist[currentTrackIndex] && (
        <audio
          ref={audioRef}
          src={playlist[currentTrackIndex].url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleNext}
          autoPlay
        />
      )}

      {showCreditsPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className={`${currentSkin.window} max-w-md w-full p-4`}>
            <div className={`${currentSkin.titleBar} px-2 py-1 flex justify-between items-center text-xs font-bold mb-3`}>
              <span>🎵 BUY CREDITS</span>
              <button onClick={() => setShowCreditsPurchase(false)}><X size={14} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className={currentSkin.text}>Select a credit package to continue generating music:</p>
              
              {/* Credit Packages */}
              {[
                { amount: 10, price: 2.99, label: 'Starter Pack', tag: 'POPULAR' },
                { amount: 30, price: 7.99, label: 'Standard Pack', tag: 'BEST VALUE' },
                { amount: 100, price: 19.99, label: 'Power User', tag: null }
              ].map((pkg) => (
                <div key={pkg.amount} className={`p-3 ${currentSkin.panel} border-2 border-transparent hover:border-[#00ff88] cursor-pointer transition-all`} onClick={() => handleCreditPurchase(pkg.amount, pkg.price)}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-lg font-bold text-[#00ff88]">{pkg.amount} Credits</span>
                      <span className="text-xs opacity-60 ml-2">{pkg.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">${pkg.price}</div>
                      {pkg.tag && <div className="text-[10px] bg-[#ff0066] text-white px-2 py-0.5 rounded">{pkg.tag}</div>}
                    </div>
                  </div>
                </div>
              ))}

              <div className={`mt-4 p-3 ${currentSkin.panel}`}>
                <p className="text-xs opacity-70 mb-2">Or pay with crypto directly:</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 bg-black/30 rounded">
                    <div className="text-[8px] opacity-50 mb-1">BTC</div>
                    <div className="font-mono break-all leading-tight">bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</div>
                  </div>
                  <div className="p-2 bg-black/30 rounded">
                    <div className="text-[8px] opacity-50 mb-1">USDT (TRC20)</div>
                    <div className="font-mono break-all leading-tight">TJb1USrL2kP8yCEM3XU3JK1y9Km9s9X4G5</div>
                  </div>
                  <div className="p-2 bg-black/30 rounded">
                    <div className="text-[8px] opacity-50 mb-1">XRP</div>
                    <div className="font-mono break-all leading-tight">rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh</div>
                  </div>
                  <div className="p-2 bg-black/30 rounded">
                    <div className="text-[8px] opacity-50 mb-1">XLM</div>
                    <div className="font-mono break-all leading-tight">GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SQ5WQ4PS</div>
                  </div>
                  <div className="p-2 bg-black/30 rounded">
                    <div className="text-[8px] opacity-50 mb-1">MATIC</div>
                    <div className="font-mono break-all leading-tight">0x71C7656EC7ab88b098defB751B7401B5f6d8976F</div>
                  </div>
                  <a
                    href="https://ko-fi.com/dreamlabsdreamforge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#ff464f] hover:bg-[#ff5865] rounded text-white font-bold text-sm transition-colors"
                  >
                    <svg viewBox="0 0 32 32" className="w-4 h-4" fill="currentColor">
                      <path d="M4 4h24v24H4V4zm4 8h16v2H8v-2zm0 4h12v2H8v-2zm0 4h8v2H8v-2z"/>
                    </svg>
                    Support on Ko-fi
                  </a>
                </div>
                <p className="text-[10px] opacity-50 mt-2">Send payment and email proof to zamp@cann.on.ai for manual credit activation.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCryptoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className={`${currentSkin.window} max-w-sm w-full p-4`}>
            <div className={`${currentSkin.titleBar} px-2 py-1 flex justify-between items-center text-xs font-bold mb-3`}>
              <span>SUPPORT THE PROJECT</span>
              <button onClick={() => setShowCryptoModal(false)}><X size={14} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className={currentSkin.text}>If you enjoy ZAMP, consider supporting development:</p>
              <div className={`p-2 ${currentSkin.panel}`}>
                <div className="text-xs opacity-70 mb-1">BTC</div>
                <div className="font-mono text-xs break-all">bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</div>
              </div>
              <div className={`p-2 ${currentSkin.panel}`}>
                <div className="text-xs opacity-70 mb-1">ETH / ERC-20</div>
                <div className="font-mono text-xs break-all">0x71C7656EC7ab88b098defB751B7401B5f6d8976F</div>
              </div>
              <div className={`p-2 ${currentSkin.panel}`}>
                <div className="text-xs opacity-70 mb-1">SOL</div>
                <div className="font-mono text-xs break-all">HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH</div>
              </div>
              <div className={`p-2 ${currentSkin.panel}`}>
                <div className="text-xs opacity-70 mb-1">XRP</div>
                <div className="font-mono text-xs break-all">rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh</div>
              </div>
              <div className={`p-2 ${currentSkin.panel}`}>
                <div className="text-xs opacity-70 mb-1">XLM</div>
                <div className="font-mono text-xs break-all">GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SQ5WQ4PS</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowShortcuts(false)}>
          <div className={`${currentSkin.window} max-w-sm w-full p-4`} onClick={e => e.stopPropagation()}>
            <div className={`${currentSkin.titleBar} px-2 py-1 flex justify-between items-center text-xs font-bold mb-3`}>
              <span>KEYBOARD SHORTCUTS</span>
              <button onClick={() => setShowShortcuts(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className={`flex justify-between p-1 ${currentSkin.panel}`}>
                  <span className="font-bold">{s.key}</span>
                  <span className="opacity-80">{s.action}</span>
                </div>
              ))}
            </div>
            <p className={`text-xs mt-3 text-center opacity-60 ${currentSkin.text}`}>Press ? to show, Escape to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
