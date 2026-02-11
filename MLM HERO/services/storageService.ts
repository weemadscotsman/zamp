
import { get, set } from 'idb-keyval';
import { GeneratedAsset } from '../types';

const HISTORY_KEY = 'cannon_ai_history_v3';

// Save history to IndexedDB (Capacity is much larger than LocalStorage)
export const saveHistory = async (history: GeneratedAsset[]) => {
  try {
    // Keep only last 25 items to ensure performance remains snappy
    const trimmed = history.slice(0, 25);
    await set(HISTORY_KEY, trimmed);
  } catch (err) {
    console.error("Failed to save history to IndexedDB:", err);
  }
};

// Retrieve history
export const getHistory = async (): Promise<GeneratedAsset[]> => {
  try {
    const data = await get(HISTORY_KEY);
    return (data as GeneratedAsset[]) || [];
  } catch (err) {
    console.error("Failed to load history:", err);
    return [];
  }
};
