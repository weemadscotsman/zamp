/**
 * AgentMemory Module - Persistent memory system for agents
 * Upgrade 1: World Knowledge Layer
 * Enables strategic planning instead of reactive behavior
 * 
 * FIXED VERSION - Addresses unbounded growth, adds IndexedDB persistence
 */

/**
 * Hash a location to a string key for efficient Map storage
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Hash key
 */
function hashLocation(lat, lon) {
  const precision = 1000;
  const x = Math.round(lat * precision);
  const y = Math.round(lon * precision);
  return `${x},${y}`;
}

/**
 * Calculate distance between two coordinates
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Distance in coordinate units
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

/**
 * Maximum number of memories per type to prevent unbounded growth
 * @constant {number}
 */
const MAX_MEMORIES_PER_TYPE = 500;

/**
 * FIXED: IndexedDB configuration
 */
const DB_NAME = 'GothamAgentMemory';
const DB_VERSION = 1;
const STORE_NAME = 'agentMemories';

/**
 * FIXED: IndexedDB persistence manager
 */
class AgentPersistence {
  constructor() {
    this.db = null;
    this.isReady = false;
    this._initPromise = null;
  }
  
  /**
   * Initialize IndexedDB connection
   */
  async init() {
    if (this._initPromise) return this._initPromise;
    
    this._initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('agentId', 'agentId', { unique: false });
        }
      };
    });
    
    return this._initPromise;
  }
  
  /**
   * Save agent memory to IndexedDB
   * @param {string} agentId - Agent ID
   * @param {Object} memoryData - Memory data to save
   */
  async saveAgentMemory(agentId, memoryData) {
    if (!this.isReady) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const data = {
        id: `memory_${agentId}`,
        agentId,
        timestamp: Date.now(),
        ...memoryData
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Load agent memory from IndexedDB
   * @param {string} agentId - Agent ID
   */
  async loadAgentMemory(agentId) {
    if (!this.isReady) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(`memory_${agentId}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Save all agents (for bulk persistence)
   * @param {Array} agents - Array of agent data
   */
  async saveAgents(agents) {
    if (!this.isReady) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Save bulk agents data
      const data = {
        id: 'bulk_agents',
        timestamp: Date.now(),
        agents
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Load all agents
   */
  async loadAgents() {
    if (!this.isReady) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get('bulk_agents');
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.agents : []);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete agent memory
   * @param {string} agentId - Agent ID
   */
  async deleteAgentMemory(agentId) {
    if (!this.isReady) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(`memory_${agentId}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Clear all memories
   */
  async clearAll() {
    if (!this.isReady) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Base class for all memory types
 * Handles decay and importance threshold
 */
class AgentMemory {
  /**
   * Create an AgentMemory instance
   * @param {string} agentId - Unique identifier for the agent
   */
  constructor(agentId) {
    this.agentId = agentId;
    this.decayRate = 0.95;
    this.importanceThreshold = 0.3;
    this.memories = new Map();
    this.lastDecay = Date.now();
    this.maxMemories = MAX_MEMORIES_PER_TYPE;
  }

  /**
   * Prune oldest memories to enforce size limit
   * @private
   */
  _pruneOldest() {
    if (this.memories.size <= this.maxMemories) {
      return;
    }

    const entries = Array.from(this.memories.entries());
    // Sort by importance * recency for smarter pruning
    entries.sort((a, b) => {
      const scoreA = (a[1].importance || 0) * (a[1].timestamp || 0);
      const scoreB = (b[1].importance || 0) * (b[1].timestamp || 0);
      return scoreA - scoreB;
    });

    const toRemove = entries.slice(0, entries.length - this.maxMemories);
    for (const [key] of toRemove) {
      this.memories.delete(key);
    }
  }

  /**
   * Apply decay to all memories based on time elapsed
   */
  decay() {
    const now = Date.now();
    const timeDelta = (now - this.lastDecay) / 1000;
    const decayFactor = Math.pow(this.decayRate, timeDelta);

    for (const [key, memory] of this.memories) {
      memory.importance *= decayFactor;
      if (memory.importance < this.importanceThreshold) {
        this.memories.delete(key);
      }
    }

    this.lastDecay = now;
  }

  /**
   * Clear all memories
   */
  clear() {
    this.memories.clear();
  }

  /**
   * Get count of active memories
   * @returns {number} Memory count
   */
  size() {
    return this.memories.size;
  }
}

/**
 * Spatial memory for locations visited
 */
class SpatialMemory extends AgentMemory {
  /**
   * Create a SpatialMemory instance
   * @param {string} agentId - Unique identifier for the agent
   */
  constructor(agentId) {
    super(agentId);
    this.memories = new Map();
  }

  /**
   * Store a location in memory
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {string} type - Location type (resource, danger, home, etc)
   * @param {number} importance - Importance value (0-1)
   */
  rememberLocation(lat, lon, type, importance) {
    const key = hashLocation(lat, lon);
    const existing = this.memories.get(key);

    if (existing) {
      existing.visits += 1;
      existing.importance = Math.max(existing.importance, importance);
      existing.lastVisit = Date.now();
    } else {
      this._pruneOldest();
      this.memories.set(key, {
        lat,
        lon,
        type,
        importance,
        timestamp: Date.now(),
        visits: 1,
        lastVisit: Date.now(),
        dangerous: false,
        resourceType: null
      });
    }
  }

  /**
   * Find remembered places near a point
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} radius - Search radius
   * @returns {Array} Nearby locations
   */
  recallNearby(lat, lon, radius) {
    this.decay();
    const results = [];

    for (const memory of this.memories.values()) {
      const dist = getDistance(lat, lon, memory.lat, memory.lon);
      if (dist <= radius && memory.importance >= this.importanceThreshold) {
        results.push({ ...memory, distance: dist });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get path to nearest location of specified type
   * @param {string} type - Location type to find
   * @returns {Object|null} Nearest location or null
   */
  getPathToType(type) {
    this.decay();
    let best = null;
    let bestScore = -Infinity;

    for (const memory of this.memories.values()) {
      if (memory.type === type && memory.importance >= this.importanceThreshold) {
        const score = memory.importance * memory.visits;
        if (score > bestScore) {
          bestScore = score;
          best = memory;
        }
      }
    }

    return best;
  }

  /**
   * Mark a location as dangerous
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {string} reason - Why it's dangerous
   */
  markDangerous(lat, lon, reason) {
    const key = hashLocation(lat, lon);
    const existing = this.memories.get(key);

    if (existing) {
      existing.dangerous = true;
      existing.dangerReason = reason;
      existing.importance = 1.0;
    } else {
      this._pruneOldest();
      this.memories.set(key, {
        lat,
        lon,
        type: 'danger',
        importance: 1.0,
        timestamp: Date.now(),
        visits: 0,
        lastVisit: Date.now(),
        dangerous: true,
        dangerReason: reason,
        resourceType: null
      });
    }
  }

  /**
   * Mark a location as a resource
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {string} resourceType - Type of resource
   */
  markResource(lat, lon, resourceType) {
    const key = hashLocation(lat, lon);
    const existing = this.memories.get(key);

    if (existing) {
      existing.resourceType = resourceType;
      existing.type = 'resource';
      existing.importance = Math.max(existing.importance, 0.7);
    } else {
      this._pruneOldest();
      this.memories.set(key, {
        lat,
        lon,
        type: 'resource',
        importance: 0.7,
        timestamp: Date.now(),
        visits: 0,
        lastVisit: Date.now(),
        dangerous: false,
        resourceType
      });
    }
  }

  /**
   * Get all dangerous locations
   * @returns {Array} Dangerous locations
   */
  getDangerousLocations() {
    this.decay();
    const results = [];
    for (const memory of this.memories.values()) {
      if (memory.dangerous && memory.importance >= this.importanceThreshold) {
        results.push(memory);
      }
    }
    return results;
  }

  /**
   * Get all resource locations
   * @returns {Array} Resource locations
   */
  getResourceLocations() {
    this.decay();
    const results = [];
    for (const memory of this.memories.values()) {
      if (memory.resourceType && memory.importance >= this.importanceThreshold) {
        results.push(memory);
      }
    }
    return results;
  }
}

/**
 * FIXED: Social memory for agent relationships with bounded arrays
 */
class SocialMemory extends AgentMemory {
  /**
   * Create a SocialMemory instance
   * @param {string} agentId - Unique identifier for the agent
   */
  constructor(agentId) {
    super(agentId);
    this.memories = new Map();
    this.maxInteractionsPerAgent = 50; // FIXED: Limit interactions per agent
  }

  /**
   * FIXED: Store an encounter with another agent with bounded interactions
   * @param {string} targetAgentId - Other agent's ID
   * @param {string} type - Agent type/class
   * @param {string} interaction - Type of interaction
   * @param {number} sentiment - Positive/negative value (-1 to 1)
   */
  rememberAgent(targetAgentId, type, interaction, sentiment) {
    const existing = this.memories.get(targetAgentId);
    const now = Date.now();

    if (existing) {
      existing.interactions.push({
        type: interaction,
        sentiment,
        timestamp: now
      });
      
      // FIXED: Prune old interactions
      if (existing.interactions.length > this.maxInteractionsPerAgent) {
        existing.interactions = existing.interactions.slice(-this.maxInteractionsPerAgent);
      }
      
      // Exponential moving average for sentiment
      existing.sentiment = existing.sentiment * 0.9 + sentiment * 0.1;
      existing.lastMet = now;
      existing.interactionCount += 1;
      existing.importance = Math.min(1, existing.importance + Math.abs(sentiment) * 0.1);
    } else {
      this._pruneOldest();
      this.memories.set(targetAgentId, {
        agentId: targetAgentId,
        type,
        interactions: [{
          type: interaction,
          sentiment,
          timestamp: now
        }],
        sentiment,
        lastMet: now,
        interactionCount: 1,
        importance: Math.abs(sentiment)
      });
    }
  }

  /**
   * Get relationship level with an agent
   * @param {string} targetAgentId - Other agent's ID
   * @returns {Object|null} Relationship data or null
   */
  getRelationship(targetAgentId) {
    this.decay();
    const memory = this.memories.get(targetAgentId);
    if (!memory || memory.importance < this.importanceThreshold) {
      return null;
    }
    return {
      agentId: memory.agentId,
      type: memory.type,
      sentiment: memory.sentiment,
      trust: memory.sentiment > 0 ? memory.sentiment : 0,
      fear: memory.sentiment < 0 ? -memory.sentiment : 0,
      lastMet: memory.lastMet,
      interactionCount: memory.interactionCount
    };
  }

  /**
   * Get list of allied agents (positive sentiment)
   * @returns {Array} Allied agents
   */
  recallAllies() {
    this.decay();
    const results = [];
    for (const memory of this.memories.values()) {
      if (memory.sentiment > 0.2 && memory.importance >= this.importanceThreshold) {
        results.push({
          agentId: memory.agentId,
          type: memory.type,
          sentiment: memory.sentiment,
          lastMet: memory.lastMet
        });
      }
    }
    return results.sort((a, b) => b.sentiment - a.sentiment);
  }

  /**
   * Get list of enemy agents (negative sentiment)
   * @returns {Array} Enemy agents
   */
  recallEnemies() {
    this.decay();
    const results = [];
    for (const memory of this.memories.values()) {
      if (memory.sentiment < -0.2 && memory.importance >= this.importanceThreshold) {
        results.push({
          agentId: memory.agentId,
          type: memory.type,
          sentiment: memory.sentiment,
          lastMet: memory.lastMet
        });
      }
    }
    return results.sort((a, b) => a.sentiment - b.sentiment);
  }

  /**
   * Get list of known traders
   * @returns {Array} Trader agents
   */
  recallTraders() {
    this.decay();
    const results = [];
    for (const memory of this.memories.values()) {
      if (memory.type === 'trader' && memory.importance >= this.importanceThreshold) {
        results.push({
          agentId: memory.agentId,
          sentiment: memory.sentiment,
          lastMet: memory.lastMet
        });
      }
    }
    return results.sort((a, b) => b.sentiment - a.sentiment);
  }
}

/**
 * FIXED: Resource memory with bounded history arrays
 */
class ResourceMemory extends AgentMemory {
  /**
   * Create a ResourceMemory instance
   * @param {string} agentId - Unique identifier for the agent
   */
  constructor(agentId) {
    super(agentId);
    this.memories = new Map();
    
    // FIXED: Limit history sizes
    this.maxHistorySize = 100;
    this.trades = [];
    this.thefts = [];
    this.workHistory = [];
  }

  /**
   * FIXED: Prune history array to limit size
   * @private
   */
  _pruneHistory(array) {
    if (array.length > this.maxHistorySize) {
      return array.slice(-this.maxHistorySize);
    }
    return array;
  }

  /**
   * Record a GitHub Repo as a Job Site
   */
  recordJobSite(location, repoData) {
    const key = hashLocation(location.lat, location.lon);
    const existing = this.memories.get(key);
    
    if (existing) {
      existing.lastSeen = Date.now();
      existing.repoData = repoData;
      existing.importance = Math.min(1, existing.importance + 0.1);
    } else {
      this._pruneOldest();
      this.memories.set(key, {
        location,
        type: 'job_site',
        repoData,
        importance: 0.8,
        timestamp: Date.now(),
        lastSeen: Date.now()
      });
    }
  }

  getJobSites() {
    this.decay();
    const sites = [];
    for (const memory of this.memories.values()) {
      if (memory.type === 'job_site') {
        sites.push(memory);
      }
    }
    return sites;
  }

  /**
   * Record a profitable trade
   * @param {Object} location - Location {lat, lon}
   * @param {number} profit - Profit amount
   */
  recordTrade(location, profit) {
    const key = hashLocation(location.lat, location.lon);
    const existing = this.memories.get(key);

    const record = {
      location,
      profit,
      timestamp: Date.now()
    };
    this.trades.push(record);
    this.trades = this._pruneHistory(this.trades); // FIXED: Prune

    if (existing) {
      existing.profit = (existing.profit + profit) / 2;
      existing.tradeCount += 1;
      existing.importance = Math.min(1, existing.importance + 0.1);
      existing.lastTrade = Date.now();
    } else {
      this._pruneOldest();
      this.memories.set(key, {
        location,
        type: 'trade',
        profit,
        tradeCount: 1,
        importance: 0.5 + Math.min(0.5, profit / 100),
        timestamp: Date.now(),
        lastTrade: Date.now()
      });
    }
  }

  /**
   * Record a theft attempt
   * @param {Object} location - Location {lat, lon}
   * @param {boolean} success - Whether theft succeeded
   */
  recordTheft(location, success) {
    const record = {
      location,
      success,
      timestamp: Date.now()
    };
    this.thefts.push(record);
    this.thefts = this._pruneHistory(this.thefts); // FIXED: Prune

    if (success) {
      const key = hashLocation(location.lat, location.lon);
      const existing = this.memories.get(key);

      if (existing) {
        existing.theftSuccess += 1;
        existing.importance = Math.min(1, existing.importance + 0.15);
      } else {
        this._pruneOldest();
        this.memories.set(key, {
          location,
          type: 'theft_target',
          theftSuccess: 1,
          theftAttempts: 1,
          importance: 0.6,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Record work payout
   * @param {Object} location - Location {lat, lon}
   * @param {number} payout - Earnings
   */
  recordWork(location, payout) {
    const record = {
      location,
      payout,
      timestamp: Date.now()
    };
    this.workHistory.push(record);
    this.workHistory = this._pruneHistory(this.workHistory); // FIXED: Prune

    const key = hashLocation(location.lat, location.lon);
    const existing = this.memories.get(key);

    if (existing) {
      existing.avgPayout = ((existing.avgPayout * existing.workCount) + payout) / (existing.workCount + 1);
      existing.workCount += 1;
      existing.importance = Math.min(1, 0.3 + (existing.avgPayout / 200));
    } else {
      this._pruneOldest();
      this.memories.set(key, {
        location,
        type: 'work',
        avgPayout: payout,
        workCount: 1,
        importance: 0.3 + Math.min(0.7, payout / 200),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get best trade route based on recorded profits
   * @returns {Object|null} Best trade location or null
   */
  getBestTradeRoute() {
    this.decay();
    let best = null;
    let bestProfit = 0;

    for (const memory of this.memories.values()) {
      if (memory.type === 'trade' && memory.profit > bestProfit) {
        bestProfit = memory.profit;
        best = memory;
      }
    }

    return best;
  }

  /**
   * Get safest route avoiding dangerous zones
   * @param {Object} from - Start {lat, lon}
   * @param {Object} to - End {lat, lon}
   * @param {Array} dangerZones - Array of dangerous locations
   * @returns {Array} Waypoints for safe route
   */
  getSafestRoute(from, to, dangerZones = []) {
    if (dangerZones.length === 0) {
      return [from, to];
    }

    const midLat = (from.lat + to.lat) / 2;
    const midLon = (from.lon + to.lon) / 2;

    const dangerousPoint = dangerZones.find((zone) => {
      const dist = getDistance(midLat, midLon, zone.lat, zone.lon);
      return dist < 0.1;
    });

    if (!dangerousPoint) {
      return [from, to];
    }

    const offsetLat = (to.lat - from.lat) * 0.3;
    const offsetLon = -(to.lon - from.lon) * 0.3;

    const waypoint = {
      lat: midLat + offsetLat,
      lon: midLon + offsetLon
    };

    return [from, waypoint, to];
  }

  /**
   * Get average profit from trades
   * @returns {number} Average profit
   */
  getAverageTradeProfit() {
    if (this.trades.length === 0) return 0;
    const sum = this.trades.reduce((acc, t) => acc + t.profit, 0);
    return sum / this.trades.length;
  }

  /**
   * Get theft success rate
   * @returns {number} Success rate (0-1)
   */
  getTheftSuccessRate() {
    if (this.thefts.length === 0) return 0;
    const successes = this.thefts.filter((t) => t.success).length;
    return successes / this.thefts.length;
  }
}

/**
 * FIXED: Event memory with bounded arrays and pattern decay
 */
class EventMemory extends AgentMemory {
  /**
   * Create an EventMemory instance
   * @param {string} agentId - Unique identifier for the agent
   */
  constructor(agentId) {
    super(agentId);
    this.events = [];
    this.patterns = new Map();
    this.maxEvents = 200; // FIXED: Limit events
    this.maxPatterns = 50; // FIXED: Limit patterns
  }

  /**
   * FIXED: Record a significant event with bounds checking
   * @param {string} type - Event type
   * @param {Object} location - Location {lat, lon}
   * @param {number} severity - Severity level (0-1)
   * @param {Object} details - Additional event details
   */
  recordEvent(type, location, severity, details = {}) {
    const event = {
      type,
      location,
      severity,
      details,
      timestamp: Date.now(),
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.events.push(event);
    
    // FIXED: Prune events when exceeding limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.updatePattern(type, event);

    this._pruneOldest();
    const key = `${type}_${hashLocation(location.lat, location.lon)}`;
    this.memories.set(key, {
      event,
      importance: severity,
      timestamp: event.timestamp
    });
  }

  /**
   * FIXED: Update pattern tracking with bounds
   * @param {string} type - Event type
   * @param {Object} event - Event data
   */
  updatePattern(type, event) {
    if (!this.patterns.has(type)) {
      // FIXED: Limit pattern count
      if (this.patterns.size >= this.maxPatterns) {
        // Remove oldest pattern
        const oldest = Array.from(this.patterns.entries())
          .sort((a, b) => (a[1].lastOccurrence || 0) - (b[1].lastOccurrence || 0))[0];
        if (oldest) {
          this.patterns.delete(oldest[0]);
        }
      }
      
      this.patterns.set(type, {
        events: [],
        avgInterval: null,
        lastOccurrence: null,
        importance: 0.5
      });
    }

    const pattern = this.patterns.get(type);
    
    // FIXED: Limit events per pattern
    pattern.events.push(event);
    if (pattern.events.length > 20) {
      pattern.events = pattern.events.slice(-20);
    }

    if (pattern.lastOccurrence) {
      const interval = event.timestamp - pattern.lastOccurrence;
      if (pattern.avgInterval) {
        pattern.avgInterval = (pattern.avgInterval + interval) / 2;
      } else {
        pattern.avgInterval = interval;
      }
    }

    pattern.lastOccurrence = event.timestamp;
    pattern.importance = Math.min(1, pattern.importance + event.severity * 0.1);
  }

  /**
   * Recall recent events within time window
   * @param {number} hours - Hours to look back
   * @returns {Array} Recent events
   */
  recallRecentEvents(hours) {
    this.decay();
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);

    return this.events
      .filter((e) => e.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Recall events of similar type
   * @param {string} type - Event type to match
   * @returns {Array} Similar events
   */
  recallSimilarEvents(type) {
    this.decay();
    return this.events
      .filter((e) => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Predict next occurrence of event type
   * @param {string} eventType - Type to predict
   * @returns {Object|null} Prediction data or null
   */
  predictNextOccurrence(eventType) {
    const pattern = this.patterns.get(eventType);
    if (!pattern || !pattern.avgInterval) {
      return null;
    }

    const nextTime = pattern.lastOccurrence + pattern.avgInterval;
    const confidence = Math.min(1, pattern.events.length / 5);

    return {
      eventType,
      predictedTime: nextTime,
      confidence,
      avgInterval: pattern.avgInterval,
      basedOn: pattern.events.length
    };
  }

  /**
   * Get high severity events
   * @param {number} threshold - Minimum severity (0-1)
   * @returns {Array} High severity events
   */
  getHighSeverityEvents(threshold = 0.7) {
    return this.events
      .filter((e) => e.severity >= threshold)
      .sort((a, b) => b.severity - a.severity);
  }

  /**
   * Get event statistics
   * @returns {Object} Statistics by event type
   */
  getEventStats() {
    const stats = {};
    for (const event of this.events) {
      if (!stats[event.type]) {
        stats[event.type] = { count: 0, avgSeverity: 0 };
      }
      stats[event.type].count += 1;
      stats[event.type].avgSeverity += event.severity;
    }

    for (const type in stats) {
      stats[type].avgSeverity /= stats[type].count;
    }

    return stats;
  }
}

/**
 * FIXED: Singleton world knowledge map with bounded growth
 */
class WorldKnowledgeMap {
  constructor() {
    if (WorldKnowledgeMap.instance) {
      return WorldKnowledgeMap.instance;
    }

    this.knowledge = {
      locations: new Map(),
      dangers: new Map(),
      resources: new Map(),
      tradeHubs: new Map()
    };

    this.discoveries = [];
    this.agentContributions = new Map();
    this.lastUpdate = Date.now();
    
    // FIXED: Limits
    this.maxDiscoveries = 1000;
    this.maxEntriesPerStore = 500;

    WorldKnowledgeMap.instance = this;
  }

  /**
   * Share agent memory to world knowledge
   * @param {AgentMemory} agentMemory - Memory to contribute
   */
  shareMemory(agentMemory) {
    if (agentMemory instanceof SpatialMemory) {
      this.shareSpatialMemory(agentMemory);
    }

    if (agentMemory instanceof ResourceMemory) {
      this.shareResourceMemory(agentMemory);
    }

    this.trackContribution(agentMemory.agentId);
  }

  /**
   * Share spatial memories
   * @param {SpatialMemory} spatialMemory - Spatial memory to share
   */
  shareSpatialMemory(spatialMemory) {
    for (const [key, memory] of spatialMemory.memories) {
      if (memory.dangerous) {
        this.addToCollective('dangers', key, memory);
      }
      if (memory.resourceType) {
        this.addToCollective('resources', key, memory);
      }
      this.addToCollective('locations', key, memory);
    }
  }

  /**
   * Share resource memories
   * @param {ResourceMemory} resourceMemory - Resource memory to share
   */
  shareResourceMemory(resourceMemory) {
    for (const [key, memory] of resourceMemory.memories) {
      if (memory.type === 'trade' && memory.profit > 50) {
        this.addToCollective('tradeHubs', key, memory);
      }
    }
  }

  /**
   * FIXED: Add to collective knowledge store with bounds checking
   * @param {string} store - Store name
   * @param {string} key - Item key
   * @param {Object} data - Item data
   */
  addToCollective(store, key, data) {
    const storeMap = this.knowledge[store];
    
    // FIXED: Prune if store too large
    if (storeMap.size >= this.maxEntriesPerStore) {
      const entries = Array.from(storeMap.entries());
      // Remove oldest entries
      const toRemove = entries.slice(0, Math.floor(this.maxEntriesPerStore * 0.1));
      for (const [k] of toRemove) {
        storeMap.delete(k);
      }
    }
    
    const existing = storeMap.get(key);

    if (existing) {
      existing.confirmations += 1;
      existing.lastConfirmed = Date.now();
      existing.sources.add(data.agentId || 'unknown');
    } else {
      storeMap.set(key, {
        ...data,
        confirmations: 1,
        firstReported: Date.now(),
        lastConfirmed: Date.now(),
        sources: new Set([data.agentId || 'unknown'])
      });

      if (store === 'locations') {
        this.discoveries.push({
          key,
          type: data.type,
          discoveredAt: Date.now()
        });
        
        // FIXED: Prune discoveries
        if (this.discoveries.length > this.maxDiscoveries) {
          this.discoveries = this.discoveries.slice(-this.maxDiscoveries);
        }
      }
    }
  }

  /**
   * Track agent contributions
   * @param {string} agentId - Contributing agent
   */
  trackContribution(agentId) {
    if (!this.agentContributions.has(agentId)) {
      this.agentContributions.set(agentId, 0);
    }
    this.agentContributions.set(agentId, this.agentContributions.get(agentId) + 1);
  }

  /**
   * Query collective knowledge
   * @param {string} type - Knowledge type
   * @param {Object} bounds - Geographic bounds {minLat, maxLat, minLon, maxLon}
   * @returns {Array} Matching knowledge entries
   */
  getCollectiveKnowledge(type, bounds = null) {
    const store = this.knowledge[type];
    if (!store) return [];

    const results = [];
    for (const entry of store.values()) {
      if (!bounds || this.inBounds(entry, bounds)) {
        results.push({
          ...entry,
          reliability: Math.min(1, entry.confirmations / 3)
        });
      }
    }

    return results.sort((a, b) => b.confirmations - a.confirmations);
  }

  /**
   * Check if entry is within bounds
   * @param {Object} entry - Entry with location
   * @param {Object} bounds - Geographic bounds
   * @returns {boolean} Within bounds
   */
  inBounds(entry, bounds) {
    const lat = entry.lat || entry.location?.lat;
    const lon = entry.lon || entry.location?.lon;

    if (lat === undefined || lon === undefined) return false;

    return lat >= bounds.minLat && lat <= bounds.maxLat &&
           lon >= bounds.minLon && lon <= bounds.maxLon;
  }

  /**
   * Find high-activity trade locations
   * @returns {Array} Trade hubs
   */
  findTradeHubs() {
    const hubs = [];
    for (const entry of this.knowledge.tradeHubs.values()) {
      hubs.push({
        location: entry.location,
        profit: entry.profit,
        confirmations: entry.confirmations,
        reliability: Math.min(1, entry.confirmations / 3)
      });
    }
    return hubs.sort((a, b) => b.profit - a.profit);
  }

  /**
   * Find dangerous zones
   * @returns {Array} Danger zones
   */
  findDangerZones() {
    const zones = [];
    for (const entry of this.knowledge.dangers.values()) {
      zones.push({
        location: { lat: entry.lat, lon: entry.lon },
        reason: entry.dangerReason,
        confirmations: entry.confirmations,
        reliability: Math.min(1, entry.confirmations / 3)
      });
    }
    return zones.sort((a, b) => b.confirmations - a.confirmations);
  }

  /**
   * Get recent discoveries
   * @param {number} limit - Maximum to return
   * @returns {Array} Recent discoveries
   */
  getRecentDiscoveries(limit = 10) {
    return this.discoveries
      .sort((a, b) => b.discoveredAt - a.discoveredAt)
      .slice(0, limit);
  }

  /**
   * Get statistics about world knowledge
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      locations: this.knowledge.locations.size,
      dangers: this.knowledge.dangers.size,
      resources: this.knowledge.resources.size,
      tradeHubs: this.knowledge.tradeHubs.size,
      totalDiscoveries: this.discoveries.length,
      contributingAgents: this.agentContributions.size
    };
  }

  /**
   * Reset all world knowledge
   */
  reset() {
    this.knowledge.locations.clear();
    this.knowledge.dangers.clear();
    this.knowledge.resources.clear();
    this.knowledge.tradeHubs.clear();
    this.discoveries = [];
    this.agentContributions.clear();
    this.lastUpdate = Date.now();
  }
}

WorldKnowledgeMap.instance = null;

/**
 * FIXED: Factory to create complete memory suite for an agent with persistence
 * @param {string} agentId - Agent identifier
 * @param {AgentPersistence} [persistence] - Optional persistence instance
 * @returns {Object} Complete memory suite
 */
function createAgentMemory(agentId, persistence = null) {
  const memory = {
    agentId,
    spatial: new SpatialMemory(agentId),
    social: new SocialMemory(agentId),
    resource: new ResourceMemory(agentId),
    event: new EventMemory(agentId),
    _persistence: persistence,
    _lastSave: 0,
    _saveInterval: 30000, // Save every 30 seconds

    /**
     * Share all memories to world knowledge
     */
    shareToWorld() {
      const world = new WorldKnowledgeMap();
      world.shareMemory(this.spatial);
      world.shareMemory(this.resource);
    },

    /**
     * Apply decay to all memory types
     */
    decayAll() {
      this.spatial.decay();
      this.social.decay();
      this.resource.decay();
      this.event.decay();
    },

    /**
     * Clear all memories
     */
    clearAll() {
      this.spatial.clear();
      this.social.clear();
      this.resource.clear();
      this.event.clear();
    },

    /**
     * Get memory statistics
     * @returns {Object} Statistics
     */
    getStats() {
      return {
        spatial: this.spatial.size(),
        social: this.social.size(),
        resource: this.resource.size(),
        event: this.event.size()
      };
    },

    /**
     * Serialize memories for storage
     * @returns {Object} Serialized data
     */
    serialize() {
      return {
        agentId: this.agentId,
        spatial: Array.from(this.spatial.memories.entries()),
        social: Array.from(this.social.memories.entries()),
        resource: Array.from(this.resource.memories.entries()),
        events: this.event.events,
        eventMemories: Array.from(this.event.memories.entries()),
        patterns: Array.from(this.event.patterns.entries())
      };
    },

    /**
     * Deserialize memories from storage
     * @param {Object} data - Serialized data
     */
    deserialize(data) {
      if (!data) return;
      
      try {
        this.spatial.memories = new Map(data.spatial || []);
        this.social.memories = new Map(data.social || []);
        this.resource.memories = new Map(data.resource || []);
        this.resource.trades = data.trades || [];
        this.resource.thefts = data.thefts || [];
        this.resource.workHistory = data.workHistory || [];
        this.event.events = data.events || [];
        this.event.memories = new Map(data.eventMemories || data.patterns || []);
        this.event.patterns = new Map(data.patterns || []);
      } catch (error) {
        console.error('[AgentMemory] Failed to deserialize:', error);
      }
    },
    
    /**
     * FIXED: Save to IndexedDB
     */
    async save() {
      if (!this._persistence) return;
      
      const now = Date.now();
      if (now - this._lastSave < this._saveInterval) return;
      
      try {
        await this._persistence.saveAgentMemory(this.agentId, this.serialize());
        this._lastSave = now;
      } catch (error) {
        console.error('[AgentMemory] Failed to save:', error);
      }
    },
    
    /**
     * FIXED: Load from IndexedDB
     */
    async load() {
      if (!this._persistence) return;
      
      try {
        const data = await this._persistence.loadAgentMemory(this.agentId);
        if (data) {
          this.deserialize(data);
        }
      } catch (error) {
        console.error('[AgentMemory] Failed to load:', error);
      }
    }
  };
  
  // Auto-load if persistence available
  if (persistence) {
    memory.load();
  }
  
  return memory;
}

if (typeof window !== 'undefined') {
  window.AgentMemory = AgentMemory;
  window.SpatialMemory = SpatialMemory;
  window.SocialMemory = SocialMemory;
  window.ResourceMemory = ResourceMemory;
  window.EventMemory = EventMemory;
  window.WorldKnowledgeMap = WorldKnowledgeMap;
  window.AgentPersistence = AgentPersistence;
  window.createAgentMemory = createAgentMemory;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AgentMemory,
    SpatialMemory,
    SocialMemory,
    ResourceMemory,
    EventMemory,
    WorldKnowledgeMap,
    AgentPersistence,
    createAgentMemory,
    hashLocation,
    getDistance
  };
}
