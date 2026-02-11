import { ErrorCode } from "../../types";

export class ForgeError extends Error {
  code: ErrorCode;
  title: string;
  suggestion?: string;

  constructor(code: ErrorCode, title: string, message: string, suggestion?: string) {
    super(message);
    this.name = 'ForgeError';
    this.code = code;
    this.title = title;
    this.suggestion = suggestion;
  }
}

export const mapAIError = (e: any, context: string): ForgeError => {
  // If it's already a ForgeError, just return it
  if (e instanceof ForgeError) return e;
  if (e.name === 'ForgeError') return e as ForgeError;

  const msg = e.message || String(e);

  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource has been exhausted")) {
    return new ForgeError(
      ErrorCode.API_QUOTA,
      "API Quota Exceeded",
      "The Gemini API rate limit has been reached.",
      "Please wait a minute before trying again."
    );
  }

  if (msg.includes("503") || msg.includes("500") || msg.includes("fetch failed") || msg.includes("network")) {
    return new ForgeError(
      ErrorCode.API_CONNECTION,
      "Network Error",
      `Unable to connect to AI services during ${context}.`,
      "Check your internet connection and API key configuration."
    );
  }

  if (msg.includes("safety") || msg.includes("blocked")) {
    return new ForgeError(
      ErrorCode.GENERATION_FILTERED,
      "Safety Filter Triggered",
      "The AI response was blocked by safety settings.",
      "Try rephrasing your request to be less sensitive."
    );
  }

  if (msg.includes("JSON") || msg.includes("SyntaxError") || msg.includes("structure") || msg.includes("valid object")) {
    return new ForgeError(
      ErrorCode.PARSING_FAILED,
      "Data Corruption",
      `Received invalid data structure during ${context}.`,
      "This is a random AI glitch. Clicking the button again usually fixes it."
    );
  }
  
  if (msg.includes("Missing required fields")) {
      return new ForgeError(
          ErrorCode.VALIDATION_FAILED,
          "Blueprint Incomplete",
          msg,
          "The AI failed to complete the design. Please retry."
      );
  }

  return new ForgeError(
    ErrorCode.UNKNOWN,
    "System Error",
    `Unexpected error in ${context}: ${msg}`,
    "Check console logs for details."
  );
};

/**
 * Executes an async operation with automatic retries and logging.
 */
export async function withRetry<T>(
    operation: () => Promise<T>, 
    retries = 2, 
    onRetry?: (attempt: number, error: any) => void
): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
        try {
            return await operation();
        } catch (e) {
            lastError = e;
            const isFatal = e instanceof ForgeError && e.code === ErrorCode.GENERATION_FILTERED; // Don't retry safety blocks
            
            if (i < retries && !isFatal) {
                if (onRetry) onRetry(i + 1, e);
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); 
            } else {
                throw e; // Exhausted retries or fatal error
            }
        }
    }
    throw lastError;
}

/**
 * Advanced JSON Repair Strategy
 * Attempts to fix truncated JSON by closing open brackets/braces/quotes.
 */
function repairTruncatedJSON(jsonStr: string): string {
    let balanced = jsonStr;
    const stack = [];
    let inString = false;
    let escape = false;

    // 1. Process the string to find the state at the end
    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{' || char === '[') {
                stack.push(char);
            } else if (char === '}') {
                if (stack[stack.length - 1] === '{') stack.pop();
            } else if (char === ']') {
                if (stack[stack.length - 1] === '[') stack.pop();
            }
        }
    }

    // 2. Close the open string if cut off
    if (inString) {
        balanced += '"';
    }

    // 3. Remove trailing comma if it exists before closing
    // Check backwards from the end (ignoring whitespace)
    if (balanced.trim().endsWith(',')) {
        balanced = balanced.trim().slice(0, -1);
    }

    // 4. Close all open brackets in reverse order
    while (stack.length > 0) {
        const open = stack.pop();
        if (open === '{') balanced += '}';
        if (open === '[') balanced += ']';
    }

    return balanced;
}

export const parseAndSanitize = (text: string): any => {
    if (!text) throw new Error("Received empty response from AI.");

    // 1. Remove Markdown Code Blocks (```json ... ```)
    let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // 2. Remove JavaScript-style comments (// and /* */)
    // This regex carefully matches strings first to avoid removing // inside URLs
    clean = clean.replace(/("([^"\\]*(\\.[^"\\]*)*)")|('([^'\\]*(\\.[^'\\]*)*)')|(\/\*[\s\S]*?\*\/)|(\/\/.*$)/gm, (match, doubleQuoted, _1, _2, singleQuoted, _3, _4, blockComment, lineComment) => {
        if (doubleQuoted || singleQuoted) return match; // Keep strings
        return ""; // Remove comments
    });

    // 3. Attempt Parse
    try {
        return JSON.parse(clean);
    } catch (e) {
        // 4. Fallback: Find first '{' and last '}' to handle preambles/postscripts
        const first = clean.indexOf('{');
        // Note: We don't strictly look for the last '}' yet because it might be missing
        
        if (first !== -1) {
            let snippet = clean.substring(first);
            
            // Try 4a: Repair Truncated JSON
            try {
                const repaired = repairTruncatedJSON(snippet);
                return JSON.parse(repaired);
            } catch (repairErr) {
                 // Try 4b: Fix trailing commas (common AI error)
                 // Replaces ", }" with "}" and ", ]" with "]"
                 const noTrailing = snippet.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                 try {
                    return JSON.parse(noTrailing);
                 } catch(e3) {
                     console.error("Parse failed.", text.substring(0, 200) + "...");
                     throw new Error("Failed to parse AI response. The generated JSON was malformed or truncated.");
                 }
            }
        }
        throw new Error("No JSON object found in response.");
    }
}

/**
 * Validates that an object contains specific required keys.
 * Throws an error if validation fails.
 */
export const validateStructure = (data: any, requiredKeys: string[], context: string) => {
    if (!data || typeof data !== 'object') {
        throw new Error(`${context}: Response was not a valid object.`);
    }
    const missing = requiredKeys.filter(key => !(key in data));
    if (missing.length > 0) {
        // Soft validation for Audio description to prevent crashing entire app if optional field missing
        if (context.includes("Audio") && missing.includes("description")) {
             data.description = "Audio description unavailable";
             return data;
        }
        throw new Error(`${context}: Missing required fields: ${missing.join(', ')}`);
    }
    return data;
};

/**
 * Compresses code for the AI context window by stripping heavy data assets.
 * This significantly reduces token usage during refinement.
 */
export const compressCodeForContext = (code: string): string => {
    if (!code) return "";
    let compressed = code;
    // Replace base64 data URIs (images/audio)
    compressed = compressed.replace(/data:[a-z]+\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, '<BASE64_DATA_HIDDEN>');
    // Replace heavy numeric arrays (geometry data) - generic catch for arrays with >10 numbers
    compressed = compressed.replace(/\[(\s*-?\d*\.?\d+,){10,}\s*-?\d*\.?\d+\s*\]/g, '[...GEOMETRY_DATA_HIDDEN...]');
    return compressed;
};