/**
 * GOTHAM 3077 - TITAN CACHE SYSTEM v1.1 (PATCHED)
 * IndexedDB persistent storage with MsgPack compression
 * 
 * PATCH NOTES:
 * - Added proper error handling and recovery
 * - Added connection state management
 * - Fixed memory leaks in cursor operations
 * - Added operation timeouts
 * - Added transaction error handling
 */

class GothamCache {
  constructor() {
    this.dbName = 'GothamCache';
    this.dbVersion = 2; // Bumped for schema updates
    this.db = null;
    this.ready = false;
    this.initializing = false;
    this.initError = null;
    
    // Operation timeout (ms)
    this.operationTimeout = 10000;
    
    // TTL configuration per feed type (seconds)
    this.ttlConfig = {
      flights: 30, military: 30, traffic: 60, transit: 60,
      satellites: 300, neos: 3600, fireballs: 3600, earthquakes: 3600,
      wildfires: 1800, volcanoes: 86400, weather: 300, cctv: 86400,
      crime: 3600, airquality: 600, bikeshare: 120, buoys: 600,
      water: 600, spacewx: 1800, evchargers: 3600, riverlevels: 1800,
      tides: 3600, carbon: 1800, alerts: 300, roads: 604800,
      default: 300
    };
    
    // Stats for monitoring
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      writes: 0,
      lastError: null
    };
    
    this.msgpack = window.msgpack || this._simpleMsgPack();
    
    // Auto-init with error handling
    this.init().catch(err => {
      console.warn('[GOTHAM CACHE] Auto-init failed:', err.message);
    });
  }
  
  async init() {
    if (this.initializing) {
      // Wait for existing init to complete
      while (this.initializing) {
        await new Promise(r => setTimeout(r, 100));
      }
      return this.ready;
    }
    
    if (this.ready) return true;
    
    this.initializing = true;
    
    try {
      this.db = await this._openDB();
      this.ready = true;
      this.initError = null;
      console.log('[GOTHAM CACHE] TITAN Cache System Online v1.1');
      
      // Cleanup expired entries on init
      await this._cleanupExpired();
      
      return true;
    } catch (err) {
      this.ready = false;
      this.initError = err;
      this.stats.errors++;
      this.stats.lastError = err.message;
      console.warn('[GOTHAM CACHE] Init failed:', err.message);
      return false;
    } finally {
      this.initializing = false;
    }
  }
  
  _openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
      
      request.onsuccess = () => {
        const db = request.result;
        
        // Handle connection errors
        db.onerror = (event) => {
          console.error('[GOTHAM CACHE] Database error:', event.target.error);
          this.stats.errors++;
          this.stats.lastError = event.target.error?.message;
        };
        
        db.onversionchange = () => {
          db.close();
          console.warn('[GOTHAM CACHE] Database version changed, closing connection');
          this.ready = false;
        };
        
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Entities store
        if (!db.objectStoreNames.contains('entities')) {
          const entityStore = db.createObjectStore('entities', { keyPath: 'id' });
          entityStore.createIndex('type', 'type', { unique: false });
          entityStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
        
        // Roads store
        if (!db.objectStoreNames.contains('roads')) {
          const roadStore = db.createObjectStore('roads', { keyPath: 'quadkey' });
          roadStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
        
        // Trails store
        if (!db.objectStoreNames.contains('trails')) {
          const trailStore = db.createObjectStore('trails', { keyPath: 'entityId' });
          trailStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
        
        // Tiles store
        if (!db.objectStoreNames.contains('tiles')) {
          db.createObjectStore('tiles', { keyPath: 'tileId' });
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'feed' });
        }
      };
      
      // Timeout for open operation
      setTimeout(() => {
        reject(new Error('Database open timeout'));
      }, this.operationTimeout);
    });
  }
  
  _simpleMsgPack() {
    return {
      encode: (obj) => {
        try {
          return JSON.stringify(obj);
        } catch (e) {
          console.warn('[GOTHAM CACHE] JSON encode failed:', e.message);
          return null;
        }
      },
      decode: (data) => {
        try {
          if (data instanceof ArrayBuffer) {
            data = new TextDecoder().decode(data);
          }
          return JSON.parse(data);
        } catch (e) {
          console.warn('[GOTHAM CACHE] JSON decode failed:', e.message);
          return null;
        }
      }
    };
  }
  
  // NEW: Safe operation wrapper with timeout
  async _withTimeout(promise, operation) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${operation} timeout`)), this.operationTimeout);
      })
    ]);
  }
  
  // NEW: Ensure DB is ready
  async _ensureReady() {
    if (!this.ready) {
      const success = await this.init();
      if (!success) {
        throw new Error('Cache not available: ' + (this.initError?.message || 'Unknown error'));
      }
    }
    return true;
  }
  
  async setEntities(type, entities) {
    try {
      await this._ensureReady();
      
      if (!Array.isArray(entities)) {
        console.warn('[GOTHAM CACHE] entities must be an array');
        return false;
      }
      
      const ttl = this.ttlConfig[type] || this.ttlConfig.default;
      const timestamp = Date.now();
      
      const tx = this.db.transaction('entities', 'readwrite');
      const store = tx.objectStore('entities');
      
      // Handle transaction errors
      tx.onerror = () => {
        console.error('[GOTHAM CACHE] Transaction error:', tx.error);
      };
      
      const promises = entities.map(entity => {
        if (!entity || typeof entity !== 'object') {
          return Promise.resolve();
        }
        
        const id = entity.id || `${type}_${entity.callsign || entity.name || Math.random().toString(36).substr(2, 8)}`;
        const compressed = this.msgpack.encode(entity);
        
        if (!compressed) {
          return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
          const request = store.put({
            id: id,
            type: type,
            data: compressed,
            lastUpdated: timestamp,
            ttl: ttl * 1000
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
      
      await this._withTimeout(Promise.all(promises), 'setEntities');
      await this._withTimeout(this._setMetadata(type, { lastFetch: timestamp, count: entities.length }), 'setMetadata');
      
      this.stats.writes += entities.length;
      return true;
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      console.warn('[GOTHAM CACHE] setEntities failed:', err.message);
      return false;
    }
  }
  
  async getEntities(type, options = {}) {
    try {
      await this._ensureReady();
      
      const { acceptStale = true, maxAge } = options;
      const ttl = (maxAge || this.ttlConfig[type] || this.ttlConfig.default) * 1000;
      const now = Date.now();
      
      const tx = this.db.transaction('entities', 'readonly');
      const store = tx.objectStore('entities');
      const index = store.index('type');
      
      return new Promise((resolve, reject) => {
        const results = [];
        const request = index.openCursor(type);
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            try {
              const record = cursor.value;
              const isStale = (now - record.lastUpdated) > record.ttl;
              
              if (acceptStale || !isStale) {
                const decompressed = this.msgpack.decode(record.data);
                if (decompressed) {
                  results.push(decompressed);
                }
              }
            } catch (err) {
              console.warn('[GOTHAM CACHE] Decompression failed for record');
            }
            cursor.continue();
          } else {
            this._getMetadata(type).then(meta => {
              const stale = results.length === 0 || (now - (meta?.lastFetch || 0)) > ttl;
              if (!stale) this.stats.hits++;
              else this.stats.misses++;
              
              resolve({
                data: results,
                stale: stale,
                timestamp: meta?.lastFetch || 0,
                count: results.length
              });
            }).catch(reject);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      this.stats.misses++;
      console.warn('[GOTHAM CACHE] getEntities failed:', err.message);
      return { data: [], stale: true, timestamp: 0, count: 0 };
    }
  }
  
  async fetchWithCache(type, fetchFn, options = {}) {
    try {
      const cached = await this.getEntities(type, { acceptStale: true });
      
      if (cached.data.length > 0) {
        if (cached.stale && options.backgroundRefresh !== false) {
          // Background refresh
          setTimeout(async () => {
            try {
              const fresh = await fetchFn();
              if (fresh && fresh.length > 0) {
                await this.setEntities(type, fresh);
                window.dispatchEvent(new CustomEvent('gotham-cache-refresh', {
                  detail: { type, count: fresh.length }
                }));
              }
            } catch (err) {
              console.warn('[GOTHAM CACHE] Background refresh failed:', err.message);
            }
          }, 100);
        }
        return cached.data;
      }
      
      const fresh = await fetchFn();
      if (fresh && fresh.length > 0) {
        await this.setEntities(type, fresh);
      }
      return fresh || [];
    } catch (err) {
      console.warn('[GOTHAM CACHE] fetchWithCache failed:', err.message);
      // Fallback to fetch function
      try {
        return await fetchFn();
      } catch (e) {
        return [];
      }
    }
  }
  
  async setRoadGeometry(quadkey, geometry) {
    try {
      await this._ensureReady();
      
      if (!quadkey || !geometry) return false;
      
      const compressed = this._compressRoads(geometry);
      const tx = this.db.transaction('roads', 'readwrite');
      const store = tx.objectStore('roads');
      
      return new Promise((resolve, reject) => {
        const request = store.put({
          quadkey,
          data: compressed,
          lastUpdated: Date.now(),
          bounds: geometry.bounds
        });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      console.warn('[GOTHAM CACHE] setRoadGeometry failed:', err.message);
      return false;
    }
  }
  
  async getRoadGeometry(quadkey) {
    try {
      await this._ensureReady();
      
      const tx = this.db.transaction('roads', 'readonly');
      const store = tx.objectStore('roads');
      
      return new Promise((resolve, reject) => {
        const request = store.get(quadkey);
        request.onsuccess = () => {
          if (request.result) {
            try {
              const decompressed = this._decompressRoads(request.result.data);
              this.stats.hits++;
              resolve({
                geometry: decompressed,
                lastUpdated: request.result.lastUpdated,
                bounds: request.result.bounds
              });
            } catch (err) {
              console.warn('[GOTHAM CACHE] Road decompression failed');
              resolve(null);
            }
          } else {
            this.stats.misses++;
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      return null;
    }
  }
  
  _compressRoads(geometry) {
    try {
      if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
        return null;
      }
      
      const coords = [];
      let prevLat = 0, prevLon = 0;
      
      geometry.coordinates.forEach((point, i) => {
        if (!Array.isArray(point) || point.length < 2) return;
        
        const lat = Math.round(point[1] * 100000);
        const lon = Math.round(point[0] * 100000);
        
        if (i === 0) {
          coords.push(lat, lon);
        } else {
          coords.push(lat - prevLat, lon - prevLon);
        }
        prevLat = lat;
        prevLon = lon;
      });
      
      return new Int16Array(coords);
    } catch (err) {
      console.warn('[GOTHAM CACHE] Road compression failed:', err.message);
      return null;
    }
  }
  
  _decompressRoads(compressed) {
    try {
      if (!compressed || !(compressed instanceof Int16Array)) {
        return { coordinates: [] };
      }
      
      const coords = [];
      let prevLat = 0, prevLon = 0;
      
      for (let i = 0; i < compressed.length; i += 2) {
        if (i === 0) {
          prevLat = compressed[i];
          prevLon = compressed[i + 1];
        } else {
          prevLat += compressed[i];
          prevLon += compressed[i + 1];
        }
        coords.push([prevLon / 100000, prevLat / 100000]);
      }
      
      return { coordinates: coords };
    } catch (err) {
      console.warn('[GOTHAM CACHE] Road decompression failed:', err.message);
      return { coordinates: [] };
    }
  }
  
  async setTrail(entityId, positions, timestamps) {
    try {
      await this._ensureReady();
      
      if (!entityId || !Array.isArray(positions) || positions.length === 0) {
        return false;
      }
      
      const tx = this.db.transaction('trails', 'readwrite');
      const store = tx.objectStore('trails');
      
      return new Promise((resolve, reject) => {
        const request = store.put({
          entityId,
          positions: this.msgpack.encode(positions),
          timestamps: this.msgpack.encode(timestamps),
          lastUpdated: Date.now()
        });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      return false;
    }
  }

  async getTrail(entityId) {
    try {
      await this._ensureReady();
      
      const tx = this.db.transaction('trails', 'readonly');
      const store = tx.objectStore('trails');

      return new Promise((resolve, reject) => {
        const request = store.get(entityId);
        request.onsuccess = () => {
          if (request.result) {
            try {
              const positions = this.msgpack.decode(request.result.positions);
              const timestamps = this.msgpack.decode(request.result.timestamps);
              resolve({
                positions: positions,
                timestamps: timestamps,
                lastUpdated: request.result.lastUpdated
              });
            } catch (err) {
              console.warn('[GOTHAM CACHE] Trail decompression failed');
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      return null;
    }
  }

  async _setMetadata(feed, data) {
    try {
      await this._ensureReady();
      const tx = this.db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      
      return new Promise((resolve, reject) => {
        const request = store.put({ feed, ...data });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[GOTHAM CACHE] setMetadata failed:', err.message);
    }
  }

  async _getMetadata(feed) {
    try {
      await this._ensureReady();
      const tx = this.db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');

      return new Promise((resolve, reject) => {
        const request = store.get(feed);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      return null;
    }
  }

  async _cleanupExpired() {
    try {
      await this._ensureReady();
      
      const now = Date.now();
      const tx = this.db.transaction('entities', 'readwrite');
      const store = tx.objectStore('entities');

      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const record = cursor.value;
            // Delete if expired (2x TTL for cleanup margin)
            if ((now - record.lastUpdated) > record.ttl * 2) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            if (deletedCount > 0) {
              console.log(`[GOTHAM CACHE] Cleaned up ${deletedCount} expired entities`);
            }
            resolve(deletedCount);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[GOTHAM CACHE] Cleanup failed:', err.message);
      return 0;
    }
  }

  async clearFeed(type) {
    try {
      await this._ensureReady();
      const tx = this.db.transaction('entities', 'readwrite');
      const store = tx.objectStore('entities');
      const index = store.index('type');

      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(type);
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`[GOTHAM CACHE] Cleared ${deletedCount} entities from ${type}`);
            resolve(deletedCount);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[GOTHAM CACHE] clearFeed failed:', err.message);
      return 0;
    }
  }

  async clearAll() {
    try {
      await this._ensureReady();
      const storeNames = ['entities', 'roads', 'trails', 'tiles', 'metadata'];
      for (const name of storeNames) {
        const tx = this.db.transaction(name, 'readwrite');
        await tx.objectStore(name).clear();
      }
      console.log('[GOTHAM CACHE] All stores cleared');
      return true;
    } catch (err) {
      console.warn('[GOTHAM CACHE] clearAll failed:', err.message);
      return false;
    }
  }
  
  // NEW: Get cache statistics
  getStats() {
    return {
      ...this.stats,
      ready: this.ready,
      dbVersion: this.dbVersion
    };
  }
  
  // NEW: Close connection
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.ready = false;
      console.log('[GOTHAM CACHE] Connection closed');
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GothamCache };
}

// Expose to window
if (typeof window !== 'undefined') {
  window.GothamCache = GothamCache;
}
