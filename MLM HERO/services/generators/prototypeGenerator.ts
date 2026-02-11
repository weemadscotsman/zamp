
import { Type, Schema } from "@google/genai";
import { UserPreferences, GeneratedGame, GameAudio, ForgeManifest, GeneratedAsset } from "../../types";
import { getAIClient } from "../client";
import { parseAndSanitize, validateStructure, mapAIError, withRetry } from "../utils/aiHelpers";
import { generateShortHash } from "../../utils/tokenEstimator";
import { PromptRegistry } from "../promptRegistry";
import { ENGINE_VERSION } from "../../version";

const prototypeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    html: { 
      type: Type.STRING, 
      description: "A complete, self-contained HTML string with embedded JS/CSS. Contains the full runnable game." 
    },
    instructions: { type: Type.STRING, description: "Clear, short bullet points on controls and objective." }
  },
  required: ["html", "instructions"]
};

export const generatePrototype = async (
    blueprint: GeneratedGame, 
    prefs: UserPreferences, 
    audio: GameAudio | undefined, 
    assets: GeneratedAsset[], // NEW PARAMETER
    onLog?: (msg: string) => void
): Promise<GeneratedGame> => {
  const log = (msg: string) => onLog && onLog(msg);
  log(">>> STEP 3: PROTOTYPE CONSTRUCTION");
  log(`Engine: ${prefs.gameEngine} | Quality: ${prefs.quality}`);
  
  const assignedCount = assets.filter(a => a.role).length;
  if (assignedCount > 0) {
      log(`Injecting ${assignedCount} Custom Asset(s) into Prompt Context...`);
  }

  const ai = getAIClient();

  // Construct Audio Context String for the Prompt
  let audioContextStr = "NO CUSTOM AUDIO.";
  if (audio && audio.soundEffects && audio.soundEffects.length > 0) {
      log("Injecting audio subsystem...");
      audioContextStr = `
      PROCEDURAL AUDIO ASSETS (You MUST integrate these):
      
      // BACKGROUND MUSIC CODE
      ${audio.backgroundMusic}
      
      // SOUND EFFECT FUNCTIONS
      ${audio.soundEffects.map(sfx => `
      // Trigger: ${sfx.trigger}
      ${sfx.code}
      `).join('\n')}
      
      INTEGRATION INSTRUCTIONS:
      1. Embed these functions in the script.
      2. Call 'playMusic(window.audioCtx)' inside the existing 'Click to Start' handler (after audioCtx.resume()).
      3. Call the specific SFX functions (e.g., 'playJump(window.audioCtx)') inside your game logic when the event occurs.
      `;
  } else {
      log("Skipping audio injection (none provided).");
  }

  // --- STRICT GPU ENFORCEMENT ---
  let gpuRules = "";
  switch (prefs.capabilities.gpuTier) {
      case 'low':
          gpuRules = "STRICT CONSTRAINTS: LOW POLY ONLY. MAX 100 INSTANCES. NO DYNAMIC SHADOWS. USE BAKED LIGHTING OR VERTEX COLORS. MOBILE OPTIMIZED SHADERS.";
          break;
      case 'mid':
          gpuRules = "CONSTRAINTS: MEDIUM POLY. LIMITED DYNAMIC SHADOWS (Max 1 Directional Light). STANDARD WEBGL SHADERS. TARGET 60FPS ON LAPTOP.";
          break;
      case 'high':
          gpuRules = "CONSTRAINTS: HIGH POLY ALLOWED. DYNAMIC LIGHTING ENABLED. POST-PROCESSING (BLOOM/AO) ALLOWED. TARGET 60FPS DESKTOP.";
          break;
      default:
          gpuRules = "CONSTRAINTS: OPTIMIZE FOR WEB.";
  }

  try {
    const prototypeData = await withRetry(async () => {
        log("Sending Build Request to Gemini (Thinking Budget: 4k tokens)...");
        
        const response = await ai.generateContent({
          model: "gemini-3-pro-preview",
          contents: PromptRegistry.BuildPrototype(blueprint, prefs, audioContextStr, gpuRules, assets),
          config: {
            responseMimeType: "application/json",
            responseSchema: prototypeSchema,
            thinkingConfig: { thinkingBudget: 4096 }, // Increased for better code quality
            maxOutputTokens: 65536 // Maximize for full code output
          }
        });

        log("Response stream closed. Decoding JSON...");
        const data = parseAndSanitize(response.text || "{}");
        validateStructure(data, ["html", "instructions"], "Prototype Builder");
        
        if (!data.html || data.html.length < 500) {
            throw new Error("Generated HTML is suspiciously short or empty.");
        }
        
        log(`SUCCESS: Code generated (${data.html.length} chars).`);
        return data;
    }, 2, (attempt, err) => {
        log(`WARN: Prototype Build Attempt ${attempt} failed: ${err.message}. Retrying...`);
    });

    // Generate Manifest
    log("Signing build manifest...");
    const specHash = generateShortHash(JSON.stringify(blueprint));
    const buildHash = generateShortHash(prototypeData.html || "");
    
    const manifest: ForgeManifest = {
        version: ENGINE_VERSION, // Enforce Versioning
        timestamp: Date.now(),
        seed: prefs.seed,
        specHash: specHash,
        buildHash: buildHash,
        platform: prefs.platform,
        quality: prefs.quality
    };

    return {
        ...blueprint,
        html: prototypeData.html,
        instructions: prototypeData.instructions,
        audio: audio,
        manifest: manifest
    };
  } catch (error: any) {
    log("ERROR: Prototype construction failed after retries.");
    throw mapAIError(error, "Prototype Construction");
  }
};
