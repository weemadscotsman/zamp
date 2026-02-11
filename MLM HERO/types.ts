

export enum Genre {
  FPS = 'First Person Shooter',
  RPG = 'Role Playing Game',
  Racing = 'Racing / Vehicle',
  Simulation = 'Simulation',
  Puzzle = 'Puzzle',
  Platformer = '3D Platformer',
  Arcade = 'Arcade / Action',
  Horror = 'Survival Horror',
  Strategy = 'Strategy / RTS'
}

export enum Platform {
  Web = 'Web (WebGL/WebGPU)',
  Desktop = 'Desktop (Windows/Mac/Linux)',
  Mobile = 'Mobile (iOS/Android)',
  Console = 'Console (PS5/Xbox/Switch)'
}

export enum SkillLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced'
}

export enum ArchitectureStyle {
  Auto = 'AI Recommended',
  ECS = 'Entity Component System (ECS)',
  OOP = 'Object Oriented (OOP)',
  Functional = 'Functional / Reactive',
  DataOriented = 'Data Oriented Design'
}

// --- NEW DESIGN SETTINGS ---

export enum VisualStyle {
  Minimalist = 'Minimalist / Abstract',
  LowPoly = 'Low Poly / Flat Shaded',
  Cyberpunk = 'Cyberpunk / Neon',
  Retro = 'Retro / Voxel',
  Noir = 'Noir / High Contrast',
  Realistic = 'Realistic (PBR Simulated)',
  Toon = 'Toon / Cel Shaded'
}

export enum CameraPerspective {
  FirstPerson = 'First Person (FPS)',
  ThirdPerson = 'Third Person (Over Shoulder)',
  Isometric = 'Isometric / Top-Down',
  SideScroller = 'Side Scroller (2.5D)',
  Orbital = 'Orbital / God View'
}

export enum EnvironmentType {
  Arena = 'Arena / Enclosed',
  Dungeon = 'Dungeon / Corridors',
  OpenWorld = 'Open Field / Terrain',
  City = 'Urban / Cityscape',
  Space = 'Space / Void',
  Interior = 'Interior / House'
}

export enum Atmosphere {
  Sunny = 'Bright / Sunny',
  Dark = 'Dark / Horror',
  Neon = 'Night / Neon',
  Foggy = 'Misty / Foggy',
  Space = 'Starfield / Void'
}

export enum Pacing {
  Arcade = 'Fast / Arcade',
  Tactical = 'Slow / Tactical',
  Simulation = 'Real-time / Simulation',
  TurnBased = 'Turn-Based / Static'
}

// --- PRO FEATURES ---

export enum GameEngine {
  ThreeJS = 'Three.js (Standard)',
  ThreeJS_WebGPU = 'Three.js (WebGPU Experimental)',
  P5JS = 'p5.js (Creative Coding)',
  BabylonJS = 'Babylon.js (Enterprise 3D)',
  KaboomJS = 'Kaboom.js (2D/Retro)',
  RawWebGL = 'Raw WebGL (No Engine)'
}

export enum PhysicsEngine {
  None = 'Simple / Arcade (No Physics)',
  Cannon = 'Cannon.js (Lightweight)',
  Rapier = 'Rapier (High Performance)',
  Ammo = 'Ammo.js (Heavy / Realistic)'
}

export enum QualityLevel {
  Sketch = 'Sketch (Low Detail, Fast)',
  Prototype = 'Prototype (Standard)',
  VerticalSlice = 'Vertical Slice (High Polish)'
}

export interface CapabilityFlags {
  gpuTier: 'low' | 'mid' | 'high';
  input: 'mouse' | 'touch' | 'gamepad';
  telemetry: boolean;
}

export interface UserPreferences {
  // Core
  genre: Genre;
  platform: Platform;
  gameEngine: GameEngine;
  physicsEngine: PhysicsEngine;
  skillLevel: SkillLevel;
  architectureStyle: ArchitectureStyle;
  projectDescription: string;
  
  // Design & Assets
  visualStyle: VisualStyle;
  cameraPerspective: CameraPerspective;
  environmentType: EnvironmentType;
  atmosphere: Atmosphere;
  pacing: Pacing;

  // Pro Features
  seed: string;
  quality: QualityLevel;
  capabilities: CapabilityFlags;
}

export interface ArchitectureNode {
  name: string;
  type: 'system' | 'component' | 'data' | 'pattern';
  description: string;
}

export interface TechStackItem {
  category: string;
  name: string;
  description: string;
  link?: string;
}

export interface Prerequisite {
  item: string;
  command?: string;
  importance: 'Critical' | 'Recommended' | 'Optional';
}

export interface GameAudio {
  description: string;
  backgroundMusic: string; // Javascript code
  soundEffects: {
    name: string;
    trigger: string;
    code: string; // Javascript code
  }[];
}

export interface RefinementSettings {
  temperature: number;      // Creativity (0.0 - 2.0)
  maxOutputTokens: number;  // Length
  topP: number;            // Probability Mass
  topK: number;            // Token Pool Size
}

export interface ForgeManifest {
  version: string;
  timestamp: number;
  seed: string;
  specHash: string; // Hash of the blueprint
  buildHash: string; // Hash of the generated HTML
  platform: Platform;
  quality: QualityLevel;
  parentHash?: string; // For diffing/lineage
}

export interface GeneratedGame {
  title: string;
  summary: string;
  
  // Playable Prototype
  html?: string; 
  instructions?: string; 

  // Architectural Advice
  recommendedEngine: string;
  language: string;
  architecture: {
    style: string;
    description: string;
    nodes: ArchitectureNode[];
  };
  techStack: TechStackItem[];
  prerequisites: Prerequisite[];
  
  // Assets
  audio?: GameAudio;
  
  // Metadata
  manifest?: ForgeManifest;
}

export interface TokenTransaction {
  id: string;
  timestamp: number;
  action: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export enum ErrorCode {
  API_CONNECTION = 'ERR_CONN',
  API_QUOTA = 'ERR_QUOTA',
  GENERATION_FILTERED = 'ERR_FILTER',
  PARSING_FAILED = 'ERR_PARSE',
  VALIDATION_FAILED = 'ERR_VALIDATION',
  UNKNOWN = 'ERR_UNKNOWN'
}

export interface AppError {
  title: string;
  message: string;
  code?: ErrorCode;
  suggestion?: string;
}

// --- ASSET GENERATOR TYPES ---

export type MediaType = 'IMAGE' | 'VIDEO';

export enum AssetGenerationMode {
  SPRITE = 'SPRITE',
  SHEET = 'SHEET', 
  TEXTURE = 'TEXTURE'
}

export enum ModelType {
  NANO_BANANA = 'gemini-2.5-flash-image',
  NANO_BANANA_PRO = 'gemini-3-pro-image-preview',
}

export enum VideoModel {
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO_HQ = 'veo-3.1-generate-preview',
  OPEN_ROUTER = 'open-router-custom', // For user defined external models
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K',
}

export enum RenderStyle {
  FLAT_2D = '2D_SPRITE',
  PRE_RENDERED_3D = '3D_RENDER',
}

// NEW: Roles for Game Injection
export enum AssetRole {
  PLAYER = 'Player Character',
  ENEMY = 'Enemy / NPC',
  ITEM = 'Item / Pickup',
  WALL = 'Wall / Obstacle',
  FLOOR = 'Floor / Ground',
  SKYBOX = 'Skybox / Background',
  UI = 'UI Element',
  PROP = 'Prop / Decoration',
  NONE = 'Unassigned'
}

export interface AdvancedConfig {
  temperature: number;
  topP: number;
  topK: number;
  seed: number;
  systemInstruction: string;
}

export interface GeneratedAsset {
  id: string;
  mediaType: MediaType;
  imageUrl?: string;
  videoUrl?: string; 
  spriteSheetUrl?: string; 
  isSpriteSheet?: boolean; 
  timestamp: number;
  prompt: string;
  model: string;
  seed: number; 
  style?: RenderStyle;
  engineFormat: string;
  // PBR Maps (Images only)
  normalMapUrl?: string;
  roughnessMapUrl?: string; 
  ormMapUrl?: string;     
  heightMapUrl?: string;  
  
  // Project Assignment
  role?: AssetRole;
}

export interface ProcessingState {
  isGenerating: boolean;
  stage: string; 
  progress: number;
}