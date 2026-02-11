
import { Type, Schema } from "@google/genai";
import { UserPreferences, GeneratedGame } from "../../types";
import { getAIClient } from "../client";
import { parseAndSanitize, validateStructure, mapAIError, withRetry } from "../utils/aiHelpers";
import { PromptRegistry } from "../promptRegistry";

// --- SCHEMA 1: QUANTIZED SPEC SHEET ---
const specSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The title of the game." },
    summary: { type: Type.STRING, description: "One sentence high concept pitch." },
    coreMechanics: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of 3-5 key gameplay mechanics. Be specific."
    },
    visualRequirements: {
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of 3-5 technical visual targets (e.g. 'Neon Bloom', 'Flat Shading')."
    }
  },
  required: ["title", "summary", "coreMechanics", "visualRequirements"]
};

// --- SCHEMA 2: TECHNICAL ARCHITECTURE ---
const architectureSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recommendedEngine: { type: Type.STRING, description: "The best web-based engine for this task (e.g., Three.js, Babylon.js, PlayCanvas)." },
    language: { type: Type.STRING, description: "The programming language (e.g., TypeScript, JavaScript)." },
    architecture: {
      type: Type.OBJECT,
      properties: {
        style: { type: Type.STRING, description: "Architecture Pattern name ONLY (e.g. ECS, MVC). Max 10 words." },
        description: { type: Type.STRING, description: "A concise technical summary (max 50 words). DO NOT REPEAT WORDS." },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the system or component." },
              description: { type: Type.STRING, description: "What this specific node handles. Max 15 words." },
              type: { type: Type.STRING, enum: ['pattern', 'component', 'system', 'data'] }
            }
          }
        }
      }
    },
    techStack: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "Category (e.g., Rendering, Physics, AI)." },
          name: { type: Type.STRING, description: "Tool or library name." },
          description: { type: Type.STRING, description: "Why this tool was chosen." },
          link: { type: Type.STRING, description: "URL to documentation." }
        }
      }
    },
    prerequisites: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, description: "Name of the prerequisite." },
          command: { type: Type.STRING, description: "Install command if applicable." },
          importance: { type: Type.STRING, enum: ['Critical', 'Recommended', 'Optional'] }
        }
      }
    }
  },
  required: ["recommendedEngine", "language", "architecture", "techStack", "prerequisites"]
};

export const generateBlueprint = async (prefs: UserPreferences, onLog?: (msg: string) => void): Promise<GeneratedGame> => {
  const ai = getAIClient();
  const log = (msg: string) => onLog && onLog(msg);

  // STEP 1: QUANTIZE REQUIREMENTS
  log(">>> STEP 1: QUANTIZING REQUIREMENTS");
  log("Initializing Gemini-3-Pro model connection...");
  
  let specData: any;
  try {
      specData = await withRetry(async () => {
          const response = await ai.generateContent({
            model: "gemini-3-pro-preview",
            contents: PromptRegistry.QuantizeRequirements(prefs),
            config: {
              responseMimeType: "application/json",
              responseSchema: specSchema,
              thinkingConfig: { thinkingBudget: 1024 }, 
              maxOutputTokens: 16384
            }
          });
          
          log(`Spec response received (${response.text?.length || 0} chars). Parsing...`);
          const data = parseAndSanitize(response.text || "{}");
          validateStructure(data, ["title", "summary", "coreMechanics"], "Blueprint Spec");
          log("SUCCESS: Spec quantization complete.");
          return data;
      }, 2, (attempt, err) => {
          log(`WARN: Quantization Attempt ${attempt} failed: ${err.message}. Retrying...`);
      });
  } catch (e: any) {
      log(`ERROR: Spec generation fatal failure.`);
      throw mapAIError(e, "Blueprint Quantization");
  }

  // STEP 2: GENERATE ARCHITECTURE
  log(">>> STEP 2: ARCHITECTING SYSTEM");
  log(`Context: ${specData.title} (${prefs.architectureStyle})`);

  let archData: any;
  try {
      archData = await withRetry(async () => {
          const response = await ai.generateContent({
            model: "gemini-3-pro-preview",
            contents: PromptRegistry.ArchitectSystem(specData, prefs),
            config: {
              responseMimeType: "application/json",
              responseSchema: architectureSchema,
              thinkingConfig: { thinkingBudget: 2048 },
              maxOutputTokens: 32768
            }
          });
          
          log(`Architecture response received (${response.text?.length || 0} chars). Parsing...`);
          const data = parseAndSanitize(response.text || "{}");
          validateStructure(data, ["architecture", "techStack"], "Blueprint Architecture");
          log(`SUCCESS: Architecture generated with ${data.architecture?.nodes?.length || 0} nodes.`);
          return data;
      }, 2, (attempt, err) => {
           log(`WARN: Architecture Attempt ${attempt} failed: ${err.message}. Retrying...`);
      });

  } catch (e: any) {
      log(`ERROR: System Architecture fatal failure.`);
      throw mapAIError(e, "System Architecture");
  }

  return { ...specData, ...archData };
};
