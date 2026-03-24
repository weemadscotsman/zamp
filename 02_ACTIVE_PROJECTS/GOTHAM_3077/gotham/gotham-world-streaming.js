/**
 * GOTHAM 3077 - WorldStreamingController v1.0
 * The CRITICAL glue between planetary scale (Cesium) and tile scale (OmniTown)
 * 
 * Responsibilities:
 * 1. Event bus for cross-system communication
 * 2. Zoom threshold detection and renderer handoff
 * 3. Biome lookup from planetary coordinates
 * 4. Deterministic agent seeding from geohash + population
 * 5. Event propagation (planetary → regional → tile)
 * 6. Agent state persistence across zoom levels
 */

/**
 * WorldStreamingEventBus - Central event coordination system
 * Enables decoupled communication between Cesium, TileWorld, and Agent systems
 */
class WorldStreamingEventBus {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistory = 100;
    this.debugMode = false;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @param {Object} options - { once: boolean, priority: number }
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, options = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const listener = { callback, options, id: Math.random().toString(36) };
    this.listeners.get(event).push(listener);
    
    // Sort by priority (higher first)
    this.listeners.get(event).sort((a, b) => 
      (b.options.priority || 0) - (a.options.priority || 0)
    );
    
    if (this.debugMode) {
      console.log(`[EventBus] Subscribed to '${event}'`);
    }
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  once(event, callback) {
    return this.on(event, callback, { once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.callback === callback);
    if (index > -1) {
      listeners.splice(index, 1);
      if (this.debugMode) {
        console.log(`[EventBus] Unsubscribed from '${event}'`);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {Object} metadata - { source: string, timestamp: number }
   */
  emit(event, data, metadata = {}) {
    const listeners = this.listeners.get(event);
    const eventData = {
      event,
      data,
      source: metadata.source || 'unknown',
      timestamp: metadata.timestamp || Date.now(),
      propagationStopped: false
    };

    // Add to history
    this.eventHistory.push(eventData);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    if (this.debugMode) {
      console.log(`[EventBus] Emitting '${event}':`, data);
    }

    // Stop propagation method
    eventData.stopPropagation = () => {
      eventData.propagationStopped = true;
    };

    if (listeners) {
      // Iterate in reverse so we can remove once listeners safely
      for (let i = listeners.length - 1; i >= 0; i--) {
        const listener = listeners[i];
        
        try {
          listener.callback(eventData.data, eventData);
          
          if (eventData.propagationStopped) break;
          
          // Remove once listeners
          if (listener.options.once) {
            listeners.splice(i, 1);
          }
        } catch (error) {
          console.error(`[EventBus] Error in '${event}' handler:`, error);
        }
      }
    }

    // Also dispatch as DOM event for non-subscribers
    window.dispatchEvent(new CustomEvent(`worldstream:${event}`, {
      detail: eventData
    }));

    return eventData;
  }

  /**
   * Get event history
   * @param {string} event - Optional event filter
   * @param {number} limit - Max events to return
   */
  getHistory(event = null, limit = 10) {
    let history = this.eventHistory;
    if (event) {
      history = history.filter(e => e.event === event);
    }
    return history.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debugMode = enabled;
  }
}

/**
 * BiomeMapper - Determines biome and terrain type from lat/lon coordinates
 * Uses elevation data, climate zones, and urban density
 */
class BiomeMapper {
  constructor() {
    // Climate zones based on latitude
    this.climateZones = [
      { name: 'polar', minLat: 66.5, maxLat: 90, biomes: ['arctic', 'tundra', 'ice_cap'] },
      { name: 'subpolar', minLat: 55, maxLat: 66.5, biomes: ['boreal_forest', 'taiga'] },
      { name: 'temperate', minLat: 35, maxLat: 55, biomes: ['temperate_forest', 'grassland', 'mediterranean'] },
      { name: 'subtropical', minLat: 23.5, maxLat: 35, biomes: ['shrubland', 'savanna', 'desert'] },
      { name: 'tropical', minLat: 0, maxLat: 23.5, biomes: ['tropical_forest', 'savanna', 'rainforest'] }
    ];

    // Urban centers for density calculation
    this.urbanCenters = [
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503, density: 1.0 },
      { name: 'Delhi', lat: 28.7041, lon: 77.1025, density: 0.95 },
      { name: 'Shanghai', lat: 31.2304, lon: 121.4737, density: 0.95 },
      { name: 'Sao Paulo', lat: -23.5505, lon: -46.6333, density: 0.9 },
      { name: 'Mexico City', lat: 19.4326, lon: -99.1332, density: 0.9 },
      { name: 'Cairo', lat: 30.0444, lon: 31.2357, density: 0.9 },
      { name: 'Mumbai', lat: 19.0760, lon: 72.8777, density: 0.9 },
      { name: 'Beijing', lat: 39.9042, lon: 116.4074, density: 0.9 },
      { name: 'New York', lat: 40.7128, lon: -74.0060, density: 0.95 },
      { name: 'London', lat: 51.5074, lon: -0.1278, density: 0.9 },
      { name: 'Paris', lat: 48.8566, lon: 2.3522, density: 0.9 },
      { name: 'Singapore', lat: 1.3521, lon: 103.8198, density: 0.95 },
      { name: 'Sydney', lat: -33.8688, lon: 151.2093, density: 0.85 },
      { name: 'Berlin', lat: 52.5200, lon: 13.4050, density: 0.85 },
      { name: 'Edinburgh', lat: 55.9533, lon: -3.1883, density: 0.7 }
    ];

    this.cache = new Map();
    this.cacheMaxSize = 1000;
  }

  /**
   * Get biome information for coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Biome data
   */
  getBiome(lat, lon) {
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const absLat = Math.abs(lat);
    
    // Find climate zone
    let zone = this.climateZones.find(z => absLat >= z.minLat && absLat < z.maxLat);
    if (!zone) {
      zone = this.climateZones.find(z => z.name === 'temperate');
    }

    // Calculate urban density based on proximity to known cities
    const urbanData = this.calculateUrbanDensity(lat, lon);
    
    // Determine specific biome
    const biome = this.selectBiome(zone, urbanData, lat, lon);

    const result = {
      climateZone: zone.name,
      biome: biome.type,
      subBiome: biome.subType,
      urbanDensity: urbanData.density,
      nearestCity: urbanData.nearestCity,
      terrainRoughness: this.calculateTerrainRoughness(lat, lon),
      vegetationDensity: this.calculateVegetation(lat, lon, zone.name),
      waterProximity: this.calculateWaterProximity(lat, lon),
      elevation: this.estimateElevation(lat, lon)
    };

    // Cache result
    this.cache.set(cacheKey, result);
    if (this.cache.size > this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return result;
  }

  /**
   * Calculate urban density based on proximity to major cities
   * @private
   */
  calculateUrbanDensity(lat, lon) {
    let maxDensity = 0;
    let nearestCity = null;
    let minDistance = Infinity;

    for (const city of this.urbanCenters) {
      const distance = this.haversine(lat, lon, city.lat, city.lon);
      
      // Exponential decay of influence
      const influence = city.density * Math.exp(-distance / 50); // 50km decay constant
      
      if (influence > maxDensity) {
        maxDensity = influence;
      }
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = { name: city.name, distance, density: city.density };
      }
    }

    // Add some noise for rural areas
    const ruralNoise = Math.random() * 0.1;
    maxDensity = Math.min(1, maxDensity + ruralNoise);

    return {
      density: maxDensity,
      nearestCity,
      isUrban: maxDensity > 0.6,
      isSuburban: maxDensity > 0.3 && maxDensity <= 0.6
    };
  }

  /**
   * Select specific biome based on zone and urban data
   * @private
   */
  selectBiome(zone, urbanData, lat, lon) {
    // Urban override
    if (urbanData.isUrban) {
      return { type: 'urban', subType: this.selectUrbanType(urbanData.density) };
    }
    if (urbanData.isSuburban) {
      return { type: 'suburban', subType: 'residential' };
    }

    // Use pseudo-random but deterministic selection based on coordinates
    const seed = Math.abs(lat * 1000 + lon) % 1000;
    const biomeIndex = Math.floor((seed / 1000) * zone.biomes.length);
    
    return { 
      type: zone.biomes[biomeIndex] || zone.biomes[0],
      subType: this.selectSubBiome(zone.biomes[biomeIndex], seed)
    };
  }

  /**
   * Select urban subtype based on density
   * @private
   */
  selectUrbanType(density) {
    if (density > 0.9) return 'megacity';
    if (density > 0.7) return 'metropolis';
    return 'city';
  }

  /**
   * Select sub-biome variation
   * @private
   */
  selectSubBiome(biome, seed) {
    const subBiomes = {
      'temperate_forest': ['deciduous', 'mixed', 'coniferous'],
      'tropical_forest': ['rainforest', 'monsoon', 'cloud_forest'],
      'grassland': ['prairie', 'steppe', 'pampas'],
      'desert': ['sandy', 'rocky', 'cold_desert']
    };
    
    const options = subBiomes[biome] || ['standard'];
    return options[seed % options.length];
  }

  /**
   * Calculate terrain roughness
   * @private
   */
  calculateTerrainRoughness(lat, lon) {
    // Simplified roughness based on coordinate patterns
    // In production, this would use actual elevation data
    const noise = Math.sin(lat * 0.1) * Math.cos(lon * 0.1);
    return Math.abs(noise);
  }

  /**
   * Calculate vegetation density
   * @private
   */
  calculateVegetation(lat, lon, climateZone) {
    const baseVegetation = {
      'tropical': 0.9,
      'subtropical': 0.6,
      'temperate': 0.7,
      'subpolar': 0.5,
      'polar': 0.1
    };
    
    const base = baseVegetation[climateZone] || 0.5;
    const variation = Math.sin(lat * 0.5) * 0.2;
    
    return Math.max(0, Math.min(1, base + variation));
  }

  /**
   * Calculate proximity to water bodies
   * @private
   */
  calculateWaterProximity(lat, lon) {
    // Simplified - in production would use actual coastline data
    // Coordinates near coastlines have higher water proximity
    const latMod = Math.abs(lat % 10);
    const lonMod = Math.abs(lon % 10);
    
    // Simulate coastlines at certain intervals
    const nearCoast = Math.min(latMod, 10 - latMod) < 2 || Math.min(lonMod, 10 - lonMod) < 2;
    
    return {
      isNearWater: nearCoast,
      distanceToCoast: nearCoast ? Math.random() * 5 : 50 + Math.random() * 100,
      hasFreshwater: Math.random() > 0.7
    };
  }

  /**
   * Estimate elevation (simplified)
   * @private
   */
  estimateElevation(lat, lon) {
    // Use coordinate patterns to simulate mountain ranges
    const mountainPattern = Math.sin(lat * 0.3) * Math.cos(lon * 0.2);
    const elevation = Math.max(0, mountainPattern * 3000 + Math.random() * 500);
    return Math.round(elevation);
  }

  /**
   * Haversine distance calculation
   * @private
   */
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * DeterministicSeeder - Seeds agents deterministically from geohash + population data
 * Ensures same location always generates same agents
 */
class DeterministicSeeder {
  constructor() {
    this.agentTypes = ['warrior', 'trader', 'thief', 'mage', 'worker', 'berserker'];
    this.agentWeights = { warrior: 15, trader: 25, thief: 12, mage: 10, worker: 28, berserker: 10 };
  }

  /**
   * Generate deterministic agents for a location
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} locationData - Population, crime rate, etc.
   * @returns {Array} Array of agent seed data
   */
  generateAgents(lat, lon, locationData) {
    const geohash = this.encodeGeohash(lat, lon, 6);
    const seed = this.geohashToSeed(geohash);
    const population = locationData.population || 100000;
    
    // Calculate agent count based on population
    const baseCount = Math.min(100, Math.max(10, Math.floor(population / 5000)));
    const urbanMultiplier = locationData.urbanDensity > 0.6 ? 1.5 : 1.0;
    const agentCount = Math.floor(baseCount * urbanMultiplier);
    
    // Generate RNG from seed
    const rng = this.createSeededRNG(seed);
    
    const agents = [];
    for (let i = 0; i < agentCount; i++) {
      const agentSeed = seed + i * 997; // Prime offset for uniqueness
      agents.push(this.createAgentSeed(i, agentSeed, locationData, rng));
    }
    
    return {
      agents,
      geohash,
      seed,
      count: agentCount,
      locationSignature: this.generateLocationSignature(lat, lon, locationData)
    };
  }

  /**
   * Create a single agent seed
   * @private
   */
  createAgentSeed(index, seed, locationData, rng) {
    const type = this.selectWeightedType(rng);
    
    // Modify stats based on location data
    const crimeRate = locationData.crimeRate || 0.5;
    const techLevel = locationData.techLevel || 3;
    
    // Higher crime = more warriors/thieves, lower crime = more traders/workers
    const dangerModifier = crimeRate > 0.7 ? 1.3 : crimeRate < 0.3 ? 0.8 : 1.0;
    
    return {
      id: `agent_${seed.toString(36)}_${index}`,
      type,
      seed,
      
      // Deterministic stats based on seed
      stats: {
        strength: this.seededRandom(seed, 10, 20),
        agility: this.seededRandom(seed + 1, 10, 20),
        intelligence: this.seededRandom(seed + 2, 10, 20),
        charisma: this.seededRandom(seed + 3, 10, 20),
        luck: this.seededRandom(seed + 4, 5, 25)
      },
      
      // Modifiers based on location
      dangerModifier,
      techAffinity: techLevel / 5,
      
      // Starting equipment/resources
      resources: {
        gold: this.seededRandom(seed + 5, 0, 100),
        items: this.generateStartingItems(type, seed + 6, techLevel)
      },
      
      // Personality (deterministic from seed)
      personality: {
        aggression: rng(),
        sociability: rng(),
        curiosity: rng(),
        caution: rng(),
        ambition: rng()
      },
      
      // Position in tile grid (deterministic)
      position: {
        x: this.seededRandom(seed + 100, 0, 50),
        y: this.seededRandom(seed + 101, 0, 50)
      }
    };
  }

  /**
   * Select agent type using weighted random
   * @private
   */
  selectWeightedType(rng) {
    const totalWeight = Object.values(this.agentWeights).reduce((a, b) => a + b, 0);
    let random = rng() * totalWeight;
    
    for (const [type, weight] of Object.entries(this.agentWeights)) {
      random -= weight;
      if (random <= 0) return type;
    }
    
    return 'worker';
  }

  /**
   * Generate starting items based on type and tech level
   * @private
   */
  generateStartingItems(type, seed, techLevel) {
    const items = [];
    const itemCount = this.seededRandom(seed, 0, 3);
    
    const typeItems = {
      warrior: ['sword', 'shield', 'armor', 'potion'],
      trader: ['coin_purse', 'trade_goods', 'map', 'compass'],
      thief: ['lockpick', 'dagger', 'cloak', 'poison'],
      mage: ['staff', 'scroll', 'crystal', 'robe'],
      worker: ['hammer', 'axe', 'pickaxe', 'backpack'],
      berserker: ['axe', 'fur_armor', 'trophy', 'rune']
    };
    
    const available = typeItems[type] || typeItems.worker;
    
    for (let i = 0; i < itemCount; i++) {
      const item = available[this.seededRandom(seed + i, 0, available.length)];
      if (item) items.push({ type: item, quality: this.seededRandom(seed + i + 10, 1, techLevel) });
    }
    
    return items;
  }

  /**
   * Encode coordinates to geohash
   * @private
   */
  encodeGeohash(lat, lon, precision = 6) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = '';
    
    let latRange = [-90.0, 90.0];
    let lonRange = [-180.0, 180.0];
    
    while (geohash.length < precision) {
      if (evenBit) {
        // Divide longitude range
        const lonMid = (lonRange[0] + lonRange[1]) / 2;
        if (lon >= lonMid) {
          idx = idx * 2 + 1;
          lonRange[0] = lonMid;
        } else {
          idx = idx * 2;
          lonRange[1] = lonMid;
        }
      } else {
        // Divide latitude range
        const latMid = (latRange[0] + latRange[1]) / 2;
        if (lat >= latMid) {
          idx = idx * 2 + 1;
          latRange[0] = latMid;
        } else {
          idx = idx * 2;
          latRange[1] = latMid;
        }
      }
      
      evenBit = !evenBit;
      bit++;
      
      if (bit === 5) {
        geohash += base32[idx];
        bit = 0;
        idx = 0;
      }
    }
    
    return geohash;
  }

  /**
   * Convert geohash to numeric seed
   * @private
   */
  geohashToSeed(geohash) {
    let seed = 0;
    for (let i = 0; i < geohash.length; i++) {
      seed = seed * 31 + geohash.charCodeAt(i);
    }
    return Math.abs(seed);
  }

  /**
   * Generate location signature for caching
   * @private
   */
  generateLocationSignature(lat, lon, locationData) {
    const data = `${lat.toFixed(4)}_${lon.toFixed(4)}_${locationData.population || 0}`;
    return btoa(data).replace(/=/g, '');
  }

  /**
   * Create seeded random number generator
   * @private
   */
  createSeededRNG(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * Seeded random integer
   * @private
   */
  seededRandom(seed, min, max) {
    const rng = this.createSeededRNG(seed);
    return Math.floor(rng() * (max - min)) + min;
  }
}

/**
 * WorldStreamingController - Main controller for seamless world streaming
 * Manages the handoff between Cesium globe and Tile World
 */
class WorldStreamingController {
  constructor(viewer, options = {}) {
    if (!viewer) {
      throw new Error('Cesium viewer is required');
    }

    this.viewer = viewer;
    this.eventBus = new WorldStreamingEventBus();
    this.biomeMapper = new BiomeMapper();
    this.seeder = new DeterministicSeeder();

    // Thresholds for zoom level transitions
    this.thresholds = {
      tile: options.tileThreshold || 500,      // meters - switch to tile view
      transition: options.transitionZone || 200, // meters - fade zone
      region: options.regionThreshold || 1000,  // meters - region view
      planet: options.planetThreshold || 10000  // meters - planet view
    };

    // State
    this.currentMode = 'planet';
    this.currentSector = null;
    this.tileWorld = null;
    this.activeTileCanvas = null;
    this.isTransitioning = false;
    this.transitionProgress = 0;

    // Event propagation
    this.eventPropagationEnabled = true;
    this.propagationRules = new Map();

    // Agent state cache
    this.agentStateCache = new Map();
    this.maxCacheSize = 50;

    // WebSocket connection
    this.ws = null;
    this.wsReconnectInterval = 5000;

    // Initialize
    this._init();
  }

  /**
   * Initialize the controller
   * @private
   */
  _init() {
    this._bindCameraListener();
    this._setupEventPropagation();
    this._connectWebSocket();
    this._createTileCanvas();

    console.log('[WorldStreaming] Controller initialized');
    this.eventBus.emit('controller:initialized', {
      thresholds: this.thresholds,
      mode: this.currentMode
    });
  }

  /**
   * Create the tile world canvas element
   * @private
   */
  _createTileCanvas() {
    this.activeTileCanvas = document.createElement('canvas');
    this.activeTileCanvas.id = 'worldstream-tile-canvas';
    this.activeTileCanvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1000;
      display: none;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s ease;
    `;
    
    // Set canvas size to match window
    this.activeTileCanvas.width = window.innerWidth;
    this.activeTileCanvas.height = window.innerHeight;
    
    document.body.appendChild(this.activeTileCanvas);

    // Handle resize
    window.addEventListener('resize', () => {
      if (this.activeTileCanvas) {
        this.activeTileCanvas.width = window.innerWidth;
        this.activeTileCanvas.height = window.innerHeight;
      }
    });
  }

  /**
   * Bind to Cesium camera change events
   * @private
   */
  _bindCameraListener() {
    if (!this.viewer || !this.viewer.camera) return;

    this.viewer.camera.changed.addEventListener(() => {
      this._onCameraChange();
    });

    // Set percentage changed for smoother updates
    this.viewer.camera.percentageChanged = 0.01;

    // Initial check
    this._onCameraChange();
  }

  /**
   * Handle camera position changes
   * @private
   */
  _onCameraChange() {
    const camera = this.viewer.camera;
    const height = camera.positionCartographic.height;
    const lat = Cesium.Math.toDegrees(camera.positionCartographic.latitude);
    const lon = Cesium.Math.toDegrees(camera.positionCartographic.longitude);

    // Determine mode based on height
    let targetMode = 'planet';
    if (height < this.thresholds.tile) {
      targetMode = 'tile';
    } else if (height < this.thresholds.region) {
      targetMode = 'region';
    }

    // Handle mode transitions
    if (targetMode !== this.currentMode) {
      this._transitionMode(targetMode, lat, lon, height);
    }

    // Emit position update
    this.eventBus.emit('camera:moved', {
      lat,
      lon,
      height,
      mode: this.currentMode
    });

    // Calculate transition progress for fade effects
    if (this.currentMode === 'tile' || targetMode === 'tile') {
      const tileThreshold = this.thresholds.tile;
      const transitionZone = this.thresholds.transition;
      
      if (height < tileThreshold + transitionZone) {
        this.transitionProgress = 1 - ((height - tileThreshold) / transitionZone);
        this.transitionProgress = Math.max(0, Math.min(1, this.transitionProgress));
      }
    }
  }

  /**
   * Transition between viewing modes
   * @private
   */
  _transitionMode(newMode, lat, lon, height) {
    if (this.isTransitioning) return;
    
    this.isTransitioning = true;
    const oldMode = this.currentMode;

    console.log(`[WorldStreaming] Transitioning: ${oldMode} -> ${newMode}`);

    this.eventBus.emit('mode:transitioning', {
      from: oldMode,
      to: newMode,
      lat,
      lon,
      height
    });

    if (newMode === 'tile') {
      this._enterTileWorld(lat, lon);
    } else if (oldMode === 'tile') {
      this._exitTileWorld();
    }

    this.currentMode = newMode;
    this.isTransitioning = false;

    this.eventBus.emit('mode:changed', {
      from: oldMode,
      to: newMode,
      lat,
      lon
    });
  }

  /**
   * Enter tile world mode
   * @private
   */
  async _enterTileWorld(lat, lon) {
    try {
      // Get biome and location data
      const biomeData = this.biomeMapper.getBiome(lat, lon);
      
      // Fetch real-world data for this location
      const worldData = await this.fetchWorldData(lat, lon);
      
      const locationData = {
        ...biomeData,
        ...worldData,
        coordinates: { lat, lon }
      };

      // Generate deterministic agents
      const seedData = this.seeder.generateAgents(lat, lon, locationData);

      // Check for cached agent states
      const cachedState = this.getCachedAgentState(seedData.geohash);

      // Create tile world engine
      if (typeof TileWorldEngine !== 'undefined') {
        this.tileWorld = new TileWorldEngine(
          this.activeTileCanvas,
          lat,
          lon,
          locationData,
          null // No external agent system for now
        );

        // Generate world with biome-specific tiles
        this.tileWorld.generate();

        // Spawn agents with deterministic seeding
        if (cachedState) {
          this.tileWorld.loadAgentState(cachedState);
        } else {
          this.tileWorld.spawnAgents(seedData.count);
          // Apply deterministic variations
          this._applyDeterministicTraits(this.tileWorld.agents, seedData.agents);
        }

        // Start simulation
        this.tileWorld.start();
      }

      // Fade transition
      await this._fadeToTileWorld();

      // Update current sector
      this.currentSector = { lat, lon, geohash: seedData.geohash };

      this.eventBus.emit('tileworld:entered', {
        lat,
        lon,
        biome: biomeData,
        agents: seedData.count,
        geohash: seedData.geohash
      });

    } catch (error) {
      console.error('[WorldStreaming] Error entering tile world:', error);
      this.eventBus.emit('tileworld:error', { error: error.message });
    }
  }

  /**
   * Exit tile world mode
   * @private
   */
  async _exitTileWorld() {
    try {
      // Save agent state
      if (this.tileWorld && this.currentSector) {
        const agentState = this.tileWorld.saveAgentState();
        this.cacheAgentState(this.currentSector.geohash, agentState);
      }

      // Fade transition
      await this._fadeToGlobe();

      // Destroy tile world
      if (this.tileWorld) {
        this.tileWorld.destroy();
        this.tileWorld = null;
      }

      this.currentSector = null;

      this.eventBus.emit('tileworld:exited', {});

    } catch (error) {
      console.error('[WorldStreaming] Error exiting tile world:', error);
    }
  }

  /**
   * Fade transition to tile world
   * @private
   */
  _fadeToTileWorld() {
    return new Promise((resolve) => {
      const cesiumContainer = this.viewer.container;
      
      // Fade out Cesium
      cesiumContainer.style.transition = 'opacity 0.5s ease';
      cesiumContainer.style.opacity = '0.3';
      cesiumContainer.style.pointerEvents = 'none';

      // Show and fade in tile canvas
      if (this.activeTileCanvas) {
        this.activeTileCanvas.style.display = 'block';
        this.activeTileCanvas.style.pointerEvents = 'auto';
        
        requestAnimationFrame(() => {
          this.activeTileCanvas.style.opacity = '1';
        });
      }

      setTimeout(resolve, 500);
    });
  }

  /**
   * Fade transition to globe
   * @private
   */
  _fadeToGlobe() {
    return new Promise((resolve) => {
      const cesiumContainer = this.viewer.container;
      
      // Fade out tile canvas
      if (this.activeTileCanvas) {
        this.activeTileCanvas.style.opacity = '0';
        this.activeTileCanvas.style.pointerEvents = 'none';
      }

      // Fade in Cesium
      cesiumContainer.style.opacity = '1';
      cesiumContainer.style.pointerEvents = 'auto';

      setTimeout(() => {
        if (this.activeTileCanvas) {
          this.activeTileCanvas.style.display = 'none';
        }
        resolve();
      }, 500);
    });
  }

  /**
   * Apply deterministic traits to spawned agents
   * @private
   */
  _applyDeterministicTraits(agents, seedAgents) {
    if (!agents || !seedAgents) return;

    agents.forEach((agent, index) => {
      const seedAgent = seedAgents[index];
      if (seedAgent && agent) {
        // Apply deterministic stats
        agent.stats = { ...agent.stats, ...seedAgent.stats };
        agent.personality = seedAgent.personality;
        agent.resources = seedAgent.resources;
        
        // Position from seed
        agent.x = seedAgent.position.x % this.tileWorld.gridWidth;
        agent.y = seedAgent.position.y % this.tileWorld.gridHeight;
        agent.pixelX = agent.x * this.tileWorld.tileSize + this.tileWorld.tileSize / 2;
        agent.pixelY = agent.y * this.tileWorld.tileSize + this.tileWorld.tileSize / 2;
      }
    });
  }

  /**
   * Fetch real-world data for a location
   * @private
   */
  async fetchWorldData(lat, lon) {
    try {
      // Try to fetch from server API
      const response = await fetch(`/api/location-data?lat=${lat}&lon=${lon}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Fallback to simulated data
    }

    // Generate simulated data based on coordinates
    return this.generateSimulatedWorldData(lat, lon);
  }

  /**
   * Generate simulated world data
   * @private
   */
  generateSimulatedWorldData(lat, lon) {
    let seed = Math.abs(lat * 1000 + lon);
    const rng = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    return {
      population: Math.floor(50000 + rng() * 950000),
      crimeRate: 0.3 + rng() * 0.5,
      trafficDensity: 0.2 + rng() * 0.7,
      techLevel: Math.floor(1 + rng() * 4),
      airQuality: 0.5 + rng() * 0.4,
      gdpPerCapita: 20000 + rng() * 60000,
      isCoastal: rng() > 0.7,
      primaryIndustry: ['tech', 'finance', 'manufacturing', 'tourism'][Math.floor(rng() * 4)]
    };
  }

  /**
   * Set up event propagation rules
   * @private
   */
  _setupEventPropagation() {
    // Planetary events -> Regional -> Tile
    this.propagationRules.set('planetary:earthquake', {
      propagateTo: ['regional', 'tile'],
      transform: (event) => ({
        type: 'seismic',
        magnitude: event.magnitude,
        epicenter: { lat: event.lat, lon: event.lon },
        affectedRadius: event.magnitude * 100 // km
      })
    });

    this.propagationRules.set('planetary:weather_alert', {
      propagateTo: ['regional', 'tile'],
      transform: (event) => ({
        type: 'weather',
        severity: event.severity,
        condition: event.condition,
        affectedArea: event.area
      })
    });

    this.propagationRules.set('regional:traffic_spike', {
      propagateTo: ['tile'],
      transform: (event) => ({
        type: 'traffic',
        density: event.density,
        congestionLevel: event.level
      })
    });

    // Tile events -> Regional -> Planetary
    this.propagationRules.set('tile:agent_event', {
      propagateTo: ['regional'],
      transform: (event) => ({
        type: 'agent_activity',
        activity: event.type,
        agentCount: event.count,
        location: this.currentSector
      })
    });

    // Listen for planetary events from WebSocket
    this.eventBus.on('ws:planetary_event', (data) => {
      this.propagateEvent('planetary', data.type, data);
    });
  }

  /**
   * Propagate an event across system boundaries
   * @param {string} sourceLevel - Source system level
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   */
  propagateEvent(sourceLevel, eventType, eventData) {
    if (!this.eventPropagationEnabled) return;

    const ruleKey = `${sourceLevel}:${eventType}`;
    const rule = this.propagationRules.get(ruleKey);

    if (!rule) return;

    // Transform event
    const transformedEvent = rule.transform ? rule.transform(eventData) : eventData;

    // Propagate to target levels
    for (const target of rule.propagateTo) {
      this.eventBus.emit(`${target}:event`, {
        source: sourceLevel,
        originalType: eventType,
        ...transformedEvent
      });

      // Special handling for tile world
      if (target === 'tile' && this.tileWorld && this.currentSector) {
        this._applyEventToTileWorld(transformedEvent);
      }
    }
  }

  /**
   * Apply a propagated event to the tile world
   * @private
   */
  _applyEventToTileWorld(event) {
    if (!this.tileWorld) return;

    switch (event.type) {
      case 'seismic':
        // Trigger flee behavior in agents
        this.tileWorld.agents.forEach(agent => {
          if (agent.brain) {
            agent.chemicals.stress = 100;
            agent.chemicals.adrenaline = 80;
          }
        });
        break;

      case 'weather':
        // Affect agent behavior based on weather
        if (event.severity === 'severe') {
          this.tileWorld.agents.forEach(agent => {
            agent.chemicals.stress = Math.min(100, agent.chemicals.stress + 30);
          });
        }
        break;

      case 'traffic':
        // Could affect agent movement speed
        break;
    }
  }

  /**
   * Connect to WebSocket for real-time events
   * @private
   */
  _connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WorldStreaming] WebSocket connected');
        this.eventBus.emit('ws:connected', {});
      };

      this.ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          this._handleWebSocketMessage(data);
        } catch (e) {
          console.warn('[WorldStreaming] Invalid WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[WorldStreaming] WebSocket disconnected');
        this.eventBus.emit('ws:disconnected', {});
        
        // Reconnect
        setTimeout(() => this._connectWebSocket(), this.wsReconnectInterval);
      };

      this.ws.onerror = (error) => {
        console.error('[WorldStreaming] WebSocket error:', error);
      };

    } catch (error) {
      console.warn('[WorldStreaming] WebSocket connection failed:', error);
    }
  }

  /**
   * Handle WebSocket messages
   * @private
   */
  _handleWebSocketMessage(data) {
    // Forward to event bus
    this.eventBus.emit(`ws:${data.type}`, data);

    // Handle specific message types
    switch (data.type) {
      case 'earthquake':
        this.propagateEvent('planetary', 'earthquake', data);
        break;
      case 'weather_alert':
        this.propagateEvent('planetary', 'weather_alert', data);
        break;
      case 'traffic_update':
        this.propagateEvent('regional', 'traffic_spike', data);
        break;
    }
  }

  /**
   * Cache agent state for a sector
   * @param {string} geohash - Sector geohash
   * @param {Object} state - Agent state
   */
  cacheAgentState(geohash, state) {
    if (this.agentStateCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.agentStateCache.keys().next().value;
      this.agentStateCache.delete(firstKey);
    }

    this.agentStateCache.set(geohash, {
      state,
      timestamp: Date.now()
    });

    // Also persist to localStorage
    try {
      localStorage.setItem(`worldstream_agents_${geohash}`, JSON.stringify(state));
    } catch (e) {
      // localStorage may be full
    }
  }

  /**
   * Get cached agent state
   * @param {string} geohash - Sector geohash
   * @returns {Object|null}
   */
  getCachedAgentState(geohash) {
    // Check memory cache
    const cached = this.agentStateCache.get(geohash);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min TTL
      return cached.state;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(`worldstream_agents_${geohash}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore parse errors
    }

    return null;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @param {Object} options - Subscription options
   */
  on(event, callback, options) {
    return this.eventBus.on(event, callback, options);
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {Object} metadata - Event metadata
   */
  emit(event, data, metadata) {
    return this.eventBus.emit(event, data, metadata);
  }

  /**
   * Get current mode
   * @returns {string}
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Get current sector
   * @returns {Object|null}
   */
  getCurrentSector() {
    return this.currentSector;
  }

  /**
   * Get tile world instance
   * @returns {TileWorldEngine|null}
   */
  getTileWorld() {
    return this.tileWorld;
  }

  /**
   * Force enter tile world at coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   */
  forceEnterTileWorld(lat, lon) {
    this._transitionMode('tile', lat, lon, this.thresholds.tile - 100);
  }

  /**
   * Force exit to globe view
   */
  forceExitTileWorld() {
    this._transitionMode('planet', 0, 0, this.thresholds.planet);
  }

  /**
   * Enable/disable event propagation
   * @param {boolean} enabled
   */
  setEventPropagation(enabled) {
    this.eventPropagationEnabled = enabled;
  }

  /**
   * Dispose of the controller
   */
  dispose() {
    // Exit tile world if active
    if (this.currentMode === 'tile') {
      this._exitTileWorld();
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Remove canvas
    if (this.activeTileCanvas && this.activeTileCanvas.parentNode) {
      this.activeTileCanvas.parentNode.removeChild(this.activeTileCanvas);
      this.activeTileCanvas = null;
    }

    // Clear caches
    this.agentStateCache.clear();

    // Emit disposed event
    this.eventBus.emit('controller:disposed', {});

    console.log('[WorldStreaming] Controller disposed');
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WorldStreamingController,
    WorldStreamingEventBus,
    BiomeMapper,
    DeterministicSeeder
  };
}

// Global access for browser
if (typeof window !== 'undefined') {
  window.WorldStreamingController = WorldStreamingController;
  window.WorldStreamingEventBus = WorldStreamingEventBus;
  window.BiomeMapper = BiomeMapper;
  window.DeterministicSeeder = DeterministicSeeder;
}
