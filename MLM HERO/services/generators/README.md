# CANN.ON.AI - Next Gen Asset Generator

## Overview
CANN.ON.AI is a bleeding-edge web application designed to streamline the creation of game assets. It leverages Google's latest Gemini models (Nano Banana series for images, Veo for video) to generate high-fidelity 2D sprites, 3D pre-renders, and cinematic cutscenes directly in the browser.

## Features

### 1. Sprite Generator (Image Mode)
- **Models**:
  - `Nano Banana` (Flash): Fast, efficient 2D/3D generation.
  - `Nano Banana Pro` (Pro): High-definition output, supports 2K/4K resolution.
- **Styles**:
  - Flat 2D Sprites
  - Pre-rendered 3D (Blender/Unreal style)
- **PBR Map Generation**: Automatically generates Normal, Roughness, ORM (Occlusion/Roughness/Metallic), and Height maps from a single generated image using client-side processing.
- **Animation Studio**: One-click generation of Sprite Sheets (Walk, Run, Idle, Attack) based on your generated character.

### 2. Cutscene Director (Video Mode)
- **Models**:
  - `Veo 3.1` (Fast & HQ): Google's native video generation models.
  - `OpenRouter`: Support for external video models via custom API keys.
- **Formats**: 16:9 Landscape or 9:16 Portrait.

### 3. Advanced "Bleeding Edge" Options
- Full control over model parameters:
  - **Temperature**: Control creativity vs determinism.
  - **Top P / Top K**: Fine-tune token selection.
  - **Seed Lock / DNA**: Deterministic generation for reproducible results. Re-load exact seeds from history.
  - **System Instructions**: Override the core behavior of the model.

### 4. Engine Export
- **Unity**: Standard Albedo + Normal + Mask maps.
- **Unreal Engine 5**: Base Color + Normal + ORM packed maps.
- **Godot**: Albedo + Normal + Roughness + Height maps.
- **Video**: MP4 export for UI/Cutscene players.
- **Manifest**: JSON export of generation parameters (Seed, Prompt, Model) for pipeline integration.

## Setup

1. **Environment Variables**:
   The app requires a Google Gemini API Key.
   Create a `.env` file or set the variable in your environment:
   `API_KEY=your_google_api_key_here`

2. **Run**:
   - `npm install`
   - `npm start` (or your framework's equivalent command)

## Tech Stack
- **Frontend**: React 19, TailwindCSS
- **AI Integration**: `@google/genai` SDK
- **Rendering**: HTML5 Canvas for texture map generation

## Usage Guide
See the in-app "Documentation" button for a detailed user guide on prompting and workflow strategies.