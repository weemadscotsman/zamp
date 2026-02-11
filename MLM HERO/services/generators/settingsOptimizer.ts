import { Type, Schema } from "@google/genai";
import { UserPreferences } from "../../types";
import { getAIClient } from "../client";
import { parseAndSanitize, validateStructure, mapAIError } from "../utils/aiHelpers";
import { PromptRegistry } from "../promptRegistry";

const settingsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    genre: { type: Type.STRING },
    gameEngine: { type: Type.STRING },
    visualStyle: { type: Type.STRING },
    cameraPerspective: { type: Type.STRING },
    environmentType: { type: Type.STRING },
    atmosphere: { type: Type.STRING },
    pacing: { type: Type.STRING },
  },
  required: ["genre", "gameEngine", "visualStyle", "cameraPerspective", "environmentType", "atmosphere"]
};

export const optimizeSettings = async (concept: string): Promise<Partial<UserPreferences>> => {
    const ai = getAIClient();
    try {
        const response = await ai.generateContent({
            model: "gemini-3-flash-preview", // Use fast model for UI interactions
            contents: PromptRegistry.RecommendSettings(concept),
            config: {
                responseMimeType: "application/json",
                responseSchema: settingsSchema,
                thinkingConfig: { thinkingBudget: 0 }, // No deep thinking needed for categorization
                maxOutputTokens: 1024
            }
        });
        
        const data = parseAndSanitize(response.text || "{}");
        validateStructure(data, ["genre", "gameEngine"], "Settings Optimizer");
        
        // Return only the keys that match UserPreferences structure
        // We do not overwrite platform, seed, or quality as those are hard constraints usually
        return data as Partial<UserPreferences>;

    } catch (e: any) {
        throw mapAIError(e, "Settings Auto-Configuration");
    }
}