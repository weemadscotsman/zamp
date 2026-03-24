/**
 * GOTHAM 3077 - Unified World State Database v1.0
 * Single source of truth for all simulation state
 */

class WorldStateDatabase {
  constructor(options = {}) {
    this.dbName = 'GothamWorldState';
    this.dbVersion = 1;
    this.db = null;
    
    // State caches
    this.cache = {
      planetary: new Map(),
      regional: new Map(),
      sectors: new Map(),
      economy: new Map(),
      history: []
    };
    
    // Event bus
    this.eventBus = options.eventBus || window.gothamEventBus;
    
    // Auto-save interval
    this.saveInterval = options.saveInterval || 30000; // 30 seconds
    this.maxHistory = options.maxHistory || 1000;
    
    // Initialize
    this._init();
  }
  
  async _init() {
    await this._openDB();
    this._startAutoSave();
    this._setupEventListeners();
    console.log('[WorldStateDB] Initialized');
  }
  
  /**
   * Open IndexedDB
   */
  _openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Object stores
        if (!db.objectStoreNames.contains('planetary')) {
          db.createObjectStore('planetary', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('regional')) {
          db.createObjectStore('regional', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sectors')) {
          const sectorStore = db.createObjectStore('sectors', { keyPath: 'key' });
          sectorStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('economy')) {
          db.createObjectStore('economy', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id' });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  
  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    if (!this.eventBus) return;
    
    // Listen for all system events and record them
    this.eventBus.use((event, data, metadata) => {
      // Don't record state change events or we'll loop infinitely
      if (event !== 'SYS_STATE_CHANGE') {
        this.recordEvent(event, data, metadata);
      }
      return data;
    });
  }
  
  /**
   * Record event in history
   */
  recordEvent(event, data, metadata = {}) {
    const record = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      event,
      data: this._clone(data),
      source: metadata.source || 'unknown',
      timestamp: metadata.timestamp || Date.now()
    };
    
    this.cache.history.push(record);
    
    // Trim history
    if (this.cache.history.length > this.maxHistory) {
      this.cache.history.shift();
    }
    
    // Emit state change
    if (this.eventBus) {
      this.eventBus.emit('SYS_STATE_CHANGE', { type: 'event', event: record });
    }
  }
  
  /**
   * Set planetary data
   */
  setPlanetary(id, data) {
    this.cache.planetary.set(id, {
      ...data,
      _lastUpdate: Date.now()
    });
    
    this._persist('planetary', id, data);
  }
  
  /**
   * Get planetary data
   */
  getPlanetary(id) {
    return this.cache.planetary.get(id);
  }
  
  /**
   * Set regional data
   */
  setRegional(id, data) {
    this.cache.regional.set(id, {
      ...data,
      _lastUpdate: Date.now()
    });
    
    this._persist('regional', id, data);
  }
  
  /**
   * Get regional data
   */
  getRegional(id) {
    return this.cache.regional.get(id);
  }
  
  /**
   * Set sector data (tile world)
   */
  setSector(key, data) {
    const sectorData = {
      key,
      agents: data.agents || [],
      resources: data.resources || [],
      buildings: data.buildings || [],
      events: data.events || [],
      timestamp: Date.now()
    };
    
    this.cache.sectors.set(key, sectorData);
    this._persist('sectors', key, sectorData);
  }
  
  /**
   * Get sector data
   */
  getSector(key) {
    return this.cache.sectors.get(key);
  }
  
  /**
   * Set economy data
   */
  setEconomy(id, data) {
    this.cache.economy.set(id, {
      ...data,
      _lastUpdate: Date.now()
    });
    
    this._persist('economy', id, data);
  }
  
  /**
   * Get economy data
   */
  getEconomy(id) {
    return this.cache.economy.get(id);
  }
  
  /**
   * Persist to IndexedDB
   */
  async _persist(storeName, key, data) {
    if (!this.db) return;
    
    try {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      await store.put(data);
    } catch (err) {
      console.error('[WorldStateDB] Persist error:', err);
    }
  }
  
  /**
   * Load from IndexedDB
   */
  async load(storeName, key) {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Load all from store
   */
  async loadAll(storeName) {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Create full snapshot
   */
  async createSnapshot() {
    const snapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        planetary: Array.from(this.cache.planetary.entries()),
        regional: Array.from(this.cache.regional.entries()),
        sectors: Array.from(this.cache.sectors.entries()),
        economy: Array.from(this.cache.economy.entries()),
        history: this.cache.history.slice(-100) // Last 100 events
      }
    };
    
    await this._persist('snapshots', snapshot.id, snapshot);
    
    if (this.eventBus) {
      this.eventBus.emit('SYS_SNAPSHOT', { id: snapshot.id });
    }
    
    return snapshot.id;
  }
  
  /**
   * Restore from snapshot
   */
  async restoreSnapshot(snapshotId) {
    const snapshot = await this.load('snapshots', snapshotId);
    if (!snapshot) return false;
    
    // Restore caches
    this.cache.planetary = new Map(snapshot.data.planetary);
    this.cache.regional = new Map(snapshot.data.regional);
    this.cache.sectors = new Map(snapshot.data.sectors);
    this.cache.economy = new Map(snapshot.data.economy);
    
    if (this.eventBus) {
      this.eventBus.emit('SYS_RESTORE', { id: snapshotId });
    }
    
    return true;
  }
  
  /**
   * Get state diff between two times
   */
  getDiff(fromTime, toTime) {
    const events = this.cache.history.filter(e => 
      e.timestamp >= fromTime && e.timestamp <= toTime
    );
    
    return {
      timeRange: { from: fromTime, to: toTime },
      eventCount: events.length,
      events: events.map(e => ({ event: e.event, timestamp: e.timestamp })),
      summary: this._summarizeEvents(events)
    };
  }
  
  /**
   * Summarize events
   */
  _summarizeEvents(events) {
    const summary = {};
    
    for (const event of events) {
      summary[event.event] = (summary[event.event] || 0) + 1;
    }
    
    return summary;
  }
  
  /**
   * Export full state
   */
  exportState() {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      planetary: Object.fromEntries(this.cache.planetary),
      regional: Object.fromEntries(this.cache.regional),
      sectors: Object.fromEntries(this.cache.sectors),
      economy: Object.fromEntries(this.cache.economy),
      history: this.cache.history
    };
  }
  
  /**
   * Import state
   */
  importState(state) {
    if (state.planetary) {
      this.cache.planetary = new Map(Object.entries(state.planetary));
    }
    if (state.regional) {
      this.cache.regional = new Map(Object.entries(state.regional));
    }
    if (state.sectors) {
      this.cache.sectors = new Map(Object.entries(state.sectors));
    }
    if (state.economy) {
      this.cache.economy = new Map(Object.entries(state.economy));
    }
    if (state.history) {
      this.cache.history = state.history;
    }
    
    if (this.eventBus) {
      this.eventBus.emit('SYS_IMPORT', { timestamp: Date.now() });
    }
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      planetary: this.cache.planetary.size,
      regional: this.cache.regional.size,
      sectors: this.cache.sectors.size,
      economy: this.cache.economy.size,
      history: this.cache.history.length,
      memoryEstimate: JSON.stringify(this.exportState()).length
    };
  }
  
  /**
   * Clear all
   */
  async clear() {
    this.cache.planetary.clear();
    this.cache.regional.clear();
    this.cache.sectors.clear();
    this.cache.economy.clear();
    this.cache.history = [];
    
    // Clear IndexedDB
    if (this.db) {
      const stores = ['planetary', 'regional', 'sectors', 'economy', 'history'];
      for (const storeName of stores) {
        const tx = this.db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
      }
    }
  }
  
  /**
   * Auto-save
   */
  _startAutoSave() {
    setInterval(async () => {
      await this.createSnapshot();
    }, this.saveInterval);
  }
  
  /**
   * Deep clone with circular reference protection
   */
  _clone(obj) {
    try {
      // Fast path for simple objects
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      // Fallback for circular or too-deep objects
      if (e instanceof RangeError || e.message.includes('circular')) {
        // Return a simplified version for history if possible, or just a placeholder
        return { _gotham_error: 'Circular or too deep to clone', _type: typeof obj };
      }
      return obj; // Return original if all else fails (caution: mutation risk)
    }
  }
  
  /**
   * Destroy
   */
  destroy() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Expose
window.WorldStateDatabase = WorldStateDatabase;

console.log('[WorldStateDatabase] v1.0 loaded - Unified persistence layer ready');
