
export type MediaType = 'IMAGE' | 'VIDEO';

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
  videoUrl?: string; // MP4 URL
  spriteSheetUrl?: string; // New: For Walk Cycles/Animations
  isSpriteSheet?: boolean; // New flag to identify if the main image IS a sheet
  timestamp: number;
  prompt: string;
  model: string;
  seed: number; // Stored seed for reproducibility
  style?: RenderStyle;
  engineFormat: string;
  // PBR Maps (Images only)
  normalMapUrl?: string;
  roughnessMapUrl?: string; 
  ormMapUrl?: string;     
  heightMapUrl?: string;  
}

export interface ProcessingState {
  isGenerating: boolean;
  stage: string; 
  progress: number;
}