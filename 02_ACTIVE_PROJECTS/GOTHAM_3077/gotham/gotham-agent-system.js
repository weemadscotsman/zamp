/**
 * gotham-agent-system.js
 * Master integration loader for the Gotham Agent System.
 * Single entry point that loads and initializes all 7 agent modules in correct order.
 * Wrapped in IIFE to avoid redeclaring identifiers from earlier <script> tags.
 *
 * @module gotham/gotham-agent-system
 * @requires ./gotham-utils.js (optional)
 * @requires ./gotham-agent-bridge.js
 * @requires ./gotham-environment-sampler.js
 * @requires ./gotham-agent-memory.js
 * @requires ./gotham-behavior-graph.js
 * @requires ./gotham-world-influence.js
 * @requires ./gotham-simulation-engine.js
 */

(function() {
// =============================================================================
// MODULE REFERENCES - All modules loaded via <script> tags before this file
// =============================================================================

const AgentCesiumBridge = window.AgentCesiumBridge;
const EnvironmentSampler = window.EnvironmentSampler;
const createAgentMemory = window.createAgentMemory;
const WorldKnowledgeMap = window.WorldKnowledgeMap;
const BehaviorGraph = window.BehaviorGraph;
const WorldInfluence = window.WorldInfluence;
const AgentSimulationEngine = window.AgentSimulationEngine;
const AgentState = window.AgentState;
const SectorManager = window.SectorManager;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default configuration options
 * @constant {Object}
 */
const DEFAULT_OPTIONS = {
  maxAgents: 500,
  tickRateMs: 1000,
  enableMemory: true,
  enableBehaviorGraph: true,
  enableWorldInfluence: true,
  cities: {
    'new_york': { lat: 40.7128, lon: -74.0060, radius: 10, name: 'New York' },
    'london': { lat: 51.5074, lon: -0.1278, radius: 10, name: 'London' },
    'tokyo': { lat: 35.6762, lon: 139.6503, radius: 10, name: 'Tokyo' },
    'sydney': { lat: -33.8688, lon: 151.2093, radius: 10, name: 'Sydney' },
    'cairo': { lat: 30.0444, lon: 31.2357, radius: 10, name: 'Cairo' }
  }
};

/**
 * Agent type definitions for spawning
 * @constant {Object}
 */
const AGENT_TYPES = {
  warrior: { hp: 120, speed: 4, traits: ['warrior'], aggression: 0.7 },
  trader: { hp: 80, speed: 5, traits: ['trader'], aggression: 0.1 },
  thief: { hp: 70, speed: 7, traits: ['thief'], aggression: 0.4 },
  mage: { hp: 60, speed: 3, traits: ['mage'], aggression: 0.3 },
  worker: { hp: 100, speed: 4, traits: ['worker'], aggression: 0.1 },
  berserker: { hp: 150, speed: 6, traits: ['warrior', 'berserker'], aggression: 0.9 }
};

// =============================================================================
// AGENT SYSTEM INITIALIZER
// =============================================================================

/**
 * Initializes the complete agent system with all modules.
 *
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} entitySystem - Entity management system
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.maxAgents=500] - Maximum number of agents
 * @param {number} [options.tickRateMs=1000] - Simulation tick rate in ms
 * @param {boolean} [options.enableMemory=true] - Enable memory system
 * @param {boolean} [options.enableBehaviorGraph=true] - Enable behavior graphs
 * @param {boolean} [options.enableWorldInfluence=true] - Enable world modification
 * @param {Object} [options.cities] - Predefined city zones
 * @returns {AgentSystemController} Controller object for the system
 * @throws {Error} If initialization fails
 *
 * @example
 * const controller = initAgentSystem(viewer, entitySystem, {
 *   maxAgents: 1000,
 *   tickRateMs: 500,
 *   enableMemory: true
 * });
 */
async function initAgentSystem(viewer, entitySystem, options = {}) {
  try {
    console.log('[GothamAgentSystem] Initializing agent system...');

    // Validate required parameters
    if (!viewer) {
      throw new Error('Cesium viewer is required');
    }
    if (!entitySystem) {
      throw new Error('Entity system is required');
    }

    // Merge options with defaults
    const config = { ...DEFAULT_OPTIONS, ...options };

    // Track initialization state
    const initState = {
      bridge: false,
      sampler: false,
      memory: false,
      behaviorGraph: false,
      worldInfluence: false,
      simulation: false,
      persistence: false
    };

    // -------------------------------------------------------------------------
    // Initialize Module 2: AgentCesiumBridge (visualization)
    // -------------------------------------------------------------------------
    console.log('[GothamAgentSystem] Creating visualization bridge...');
    const bridge = new AgentCesiumBridge(viewer, entitySystem);
    initState.bridge = true;

    // -------------------------------------------------------------------------
    // Initialize Module 3: EnvironmentSampler (sensory input)
    // -------------------------------------------------------------------------
    console.log('[GothamAgentSystem] Creating environment sampler...');
    const dataCache = entitySystem.dataCache || entitySystem.cache || null;
    const sampler = new EnvironmentSampler(entitySystem, dataCache);
    initState.sampler = true;

    // -------------------------------------------------------------------------
    // Initialize Module 4: AgentMemory (knowledge)
    // -------------------------------------------------------------------------
    let worldKnowledge = null;
    if (config.enableMemory) {
      console.log('[GothamAgentSystem] Initializing memory system...');
      worldKnowledge = new WorldKnowledgeMap();
      initState.memory = true;
    }

    // -------------------------------------------------------------------------
    // Initialize Module 5: BehaviorGraph (decision making)
    // -------------------------------------------------------------------------
    let behaviorGraph = null;
    if (config.enableBehaviorGraph) {
      console.log('[GothamAgentSystem] Initializing behavior graph...');
      behaviorGraph = new BehaviorGraph({
        enableLearning: true,
        maxPlanLength: 50,
        replanThreshold: 0.3
      });
      initState.behaviorGraph = true;
    }

    // -------------------------------------------------------------------------
    // Initialize Module 6: WorldInfluence (world modification)
    // -------------------------------------------------------------------------
    let worldInfluence = null;
    if (config.enableWorldInfluence) {
      console.log('[GothamAgentSystem] Initializing world influence system...');
      worldInfluence = new WorldInfluence(viewer, entitySystem);
      initState.worldInfluence = true;
    }

    // -------------------------------------------------------------------------
    // Initialize Module 7: AgentSimulationEngine (main loop)
    // -------------------------------------------------------------------------
    console.log('[GothamAgentSystem] Creating simulation engine...');
    const simulation = new AgentSimulationEngine(viewer, entitySystem, bridge, sampler);
    simulation.maxAgents = config.maxAgents;
    simulation.tickRateMs = config.tickRateMs;
    initState.simulation = true;
    
    // -------------------------------------------------------------------------
    // Initialize Module 8: IndexedDB Persistence (if available)
    // -------------------------------------------------------------------------
    let persistence = null;
    if (config.enablePersistence !== false && typeof window !== 'undefined' && window.indexedDB) {
      try {
        console.log('[GothamAgentSystem] Initializing persistence...');
        persistence = new AgentPersistence();
        await persistence.init();
        simulation.setPersistence(persistence);
        initState.persistence = true;
        
        // Load saved agents
        simulation.loadPersistence(persistence);
      } catch (e) {
        console.warn('[GothamAgentSystem] Persistence initialization failed:', e);
      }
    }

    // -------------------------------------------------------------------------
    // Initialize SectorManager (sectorization optimization)
    // -------------------------------------------------------------------------
    let sectorManager = null;
    if (SectorManager) {
      console.log('[GothamAgentSystem] Initializing sector manager...');
      sectorManager = new SectorManager(viewer, config.sectorOptions || {});
      simulation.sectorManager = sectorManager;
      initState.sectorManager = true;
    }

    // Wire up additional dependencies
    if (worldKnowledge) {
      simulation.worldKnowledge = worldKnowledge;
    }
    if (behaviorGraph) {
      simulation.behaviorGraph = behaviorGraph;
    }
    if (worldInfluence) {
      simulation.worldInfluence = worldInfluence;
    }

    // -------------------------------------------------------------------------
    // Create and return controller
    // -------------------------------------------------------------------------
    const controller = new AgentSystemController({
      simulation,
      bridge,
      sampler,
      memory: worldKnowledge,
      behaviorGraph,
      worldInfluence,
      sectorManager,
      persistence,
      config,
      entitySystem,
      viewer
    });

    // Set up event listeners
    setupEventListeners(controller, entitySystem);

    // Dispatch ready event
    dispatchReadyEvent(controller, initState);

    console.log('[GothamAgentSystem] Initialization complete');
    console.log('[GothamAgentSystem] Status:', initState);

    return controller;

  } catch (error) {
    console.error('[GothamAgentSystem] Initialization failed:', error);
    throw error;
  }
}

// =============================================================================
// AGENT SYSTEM CONTROLLER
// =============================================================================

/**
 * Controller class for managing the agent system.
 * Provides high-level API for spawning agents, controlling simulation, and querying state.
 */
class AgentSystemController {
  /**
   * Creates a new AgentSystemController.
   * @param {Object} deps - Dependencies object
   * @param {AgentSimulationEngine} deps.simulation - Simulation engine
   * @param {AgentCesiumBridge} deps.bridge - Visualization bridge
   * @param {EnvironmentSampler} deps.sampler - Environment sampler
   * @param {WorldKnowledgeMap} [deps.memory] - World knowledge
   * @param {BehaviorGraph} [deps.behaviorGraph] - Behavior graph
   * @param {WorldInfluence} [deps.worldInfluence] - World influence
   * @param {AgentPersistence} [deps.persistence] - Persistence manager
   * @param {Object} deps.config - Configuration options
   * @param {Object} deps.entitySystem - Entity system
   * @param {Object} deps.viewer - Cesium viewer
   */
  constructor(deps) {
    this.simulation = deps.simulation;
    this.bridge = deps.bridge;
    this.sampler = deps.sampler;
    this.memory = deps.memory;
    this.behaviorGraph = deps.behaviorGraph;
    this.worldInfluence = deps.worldInfluence;
    this.sectorManager = deps.sectorManager;
    this.persistence = deps.persistence;
    this.config = deps.config;
    this.entitySystem = deps.entitySystem;
    this.viewer = deps.viewer;

    this._isPaused = false;
    this._eventListeners = new Map();
    this._spawnedCount = 0;
    this._telemetry = null;

    // Start the simulation
    this.simulation.start();
    
    // Initialize telemetry if available
    if (typeof AgentTelemetry !== 'undefined') {
      this._telemetry = new AgentTelemetry(this.simulation);
      this._telemetry.start();
    }
  }

  /**
   * Spawns a single agent at the specified location.
   *
   * @param {string} type - Agent type (warrior, trader, thief, mage, worker, berserker)
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} [options={}] - Additional spawn options
   * @returns {Object|null} The spawned agent or null if failed
   *
   * @example
   * const agent = controller.spawnAgent('warrior', 40.7128, -74.0060);
   */
  spawnAgent(type, lat, lon, options = {}) {
    try {
      if (!AGENT_TYPES[type]) {
        console.warn(`[GothamAgentSystem] Unknown agent type: ${type}, using 'worker'`);
        type = 'worker';
      }

      const typeConfig = AGENT_TYPES[type];
      const agentOptions = {
        hp: options.hp || typeConfig.hp,
        maxHp: options.maxHp || typeConfig.hp,
        speed: options.speed || typeConfig.speed,
        traits: options.traits || typeConfig.traits,
        aggression: options.aggression ?? typeConfig.aggression,
        twag: options.twag || 100,
        ...options
      };

      const agent = this.simulation.spawnAgent(type, lat, lon, agentOptions);

      if (agent && this.memory && this.config.enableMemory) {
        // FIXED: Pass persistence to createAgentMemory for auto-save/load
        agent.memory = createAgentMemory(agent.id, this.persistence);
      }

      if (agent) {
        this._spawnedCount++;
      }

      return agent;

    } catch (error) {
      console.error('[GothamAgentSystem] Failed to spawn agent:', error);
      return null;
    }
  }

  /**
   * Spawns multiple agents within a city's zone.
   *
   * @param {string} city - City name or key
   * @param {number} count - Number of agents to spawn
   * @param {Object} [options={}] - Spawn options
   * @param {string} [options.type] - Agent type (random if not specified)
   * @returns {Array<Object>} Array of spawned agents
   *
   * @example
   * const agents = controller.spawnCityAgents('new_york', 50);
   */
  spawnCityAgents(city, count, options = {}) {
    try {
      const cityData = this.config.cities[city.toLowerCase()];
      if (!cityData) {
        console.warn(`[GothamAgentSystem] Unknown city: ${city}`);
        return [];
      }

      const spawned = [];
      const types = Object.keys(AGENT_TYPES);

      for (let i = 0; i < count; i++) {
        // Random position within city radius
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * cityData.radius * 0.01;
        const lat = cityData.lat + Math.sin(angle) * distance;
        const lon = cityData.lon + Math.cos(angle) * distance;

        // Random type if not specified
        const type = options.type || types[Math.floor(Math.random() * types.length)];

        const agent = this.spawnAgent(type, lat, lon, options);
        if (agent) {
          spawned.push(agent);
        }
      }

      console.log(`[GothamAgentSystem] Spawned ${spawned.length} agents in ${cityData.name}`);
      return spawned;

    } catch (error) {
      console.error('[GothamAgentSystem] Failed to spawn city agents:', error);
      return [];
    }
  }

  /**
   * Pauses the simulation.
   */
  pause() {
    if (!this._isPaused) {
      this.simulation.stop();
      this._isPaused = true;
      this._emit('paused');
      console.log('[GothamAgentSystem] Simulation paused');
    }
  }

  /**
   * Resumes the simulation.
   */
  resume() {
    if (this._isPaused) {
      this.simulation.start();
      this._isPaused = false;
      this._emit('resumed');
      console.log('[GothamAgentSystem] Simulation resumed');
    }
  }

  /**
   * Gets global statistics about the agent system.
   *
   * @returns {Object} Statistics object
   * @property {number} totalAgents - Total number of active agents
   * @property {number} maxAgents - Maximum allowed agents
   * @property {boolean} isRunning - Whether simulation is running
   * @property {boolean} isPaused - Whether simulation is paused
   * @property {number} tickRateMs - Current tick rate
   * @property {Object} stateDistribution - Count of agents in each state
   * @property {number} averageStress - Average stress level across agents
   * @property {number} spawnedCount - Total agents spawned this session
   * @property {Object} influenceStats - World influence statistics (if enabled)
   * @property {Object} knowledgeStats - World knowledge statistics (if enabled)
   */
  getStats() {
    const simStats = this.simulation.getStats();

    const stats = {
      totalAgents: simStats.totalAgents,
      maxAgents: simStats.maxAgents,
      isRunning: simStats.isRunning,
      isPaused: this._isPaused,
      tickRateMs: simStats.tickRateMs,
      stateDistribution: simStats.stateDistribution,
      averageStress: simStats.averageStress,
      spawnedCount: this._spawnedCount,
      soulsPending: simStats.soulsPending,
      moduleStatus: {
        memory: !!this.memory,
        behaviorGraph: !!this.behaviorGraph,
        worldInfluence: !!this.worldInfluence,
        sectorManager: !!this.sectorManager,
        persistence: !!this.persistence,
        telemetry: !!this._telemetry
      }
    };

    if (this.worldInfluence) {
      stats.influenceStats = this.worldInfluence.getGlobalInfluenceStats?.();
    }

    if (this.memory) {
      stats.knowledgeStats = this.memory.getStats();
    }

    if (this.sectorManager) {
      stats.sectorStats = this.sectorManager.getStats();
    }
    
    if (this._telemetry) {
      stats.telemetry = this._telemetry.getFullReport();
    }

    return stats;
  }
  
  /**
   * Get performance benchmark results
   * @returns {Object} Benchmark data
   */
  getBenchmark() {
    if (!this._telemetry) {
      return { error: 'Telemetry not initialized' };
    }
    return this._telemetry.getBenchmark();
  }
  
  /**
   * Get detailed telemetry for debugging
   * @returns {Object} Telemetry data
   */
  getTelemetry() {
    if (!this._telemetry) {
      return { error: 'Telemetry not initialized' };
    }
    return this._telemetry.getFullReport();
  }
  
  /**
   * Inspect a specific agent
   * @param {string} agentId - Agent ID to inspect
   * @returns {Object|null} Agent details
   */
  inspectAgent(agentId) {
    if (!this._telemetry) return null;
    return this._telemetry.inspector.getAgentDetails(agentId);
  }
  
  /**
   * Export evolution data
   * @returns {Object} Evolution statistics
   */
  exportEvolutionData() {
    if (!this._telemetry) return null;
    return this._telemetry.exportEvolutionData();
  }

  /**
   * Cleans up all resources and stops the simulation.
   * This should be called when shutting down the system.
   */
  dispose() {
    try {
      console.log('[GothamAgentSystem] Disposing system...');

      // Stop telemetry
      if (this._telemetry) {
        this._telemetry.stop();
        this._telemetry = null;
      }

      // Stop simulation
      this.simulation.stop();

      // Dispose bridge
      if (this.bridge) {
        this.bridge.dispose();
      }

      // Dispose world influence
      if (this.worldInfluence) {
        this.worldInfluence.dispose();
      }

      // Dispose sector manager
      if (this.sectorManager) {
        this.sectorManager.dispose();
      }

      // Clear event listeners
      this._eventListeners.clear();

      // Remove global event listeners
      window.removeEventListener('gotham-data-update', this._dataUpdateHandler);
      window.removeEventListener('gotham-alert', this._alertHandler);

      console.log('[GothamAgentSystem] Disposal complete');

    } catch (error) {
      console.error('[GothamAgentSystem] Error during disposal:', error);
    }
  }

  /**
   * Adds an event listener.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(callback);
  }

  /**
   * Removes an event listener.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx > -1) {
        listeners.splice(idx, 1);
      }
    }
  }

  /**
   * Emits an event to registered listeners.
   * @private
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  _emit(event, data) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[GothamAgentSystem] Event listener error for ${event}:`, e);
        }
      });
    }
  }

  /**
   * Handler for data update events.
   * @private
   * @param {CustomEvent} event - Data update event
   */
  _dataUpdateHandler = (event) => {
    try {
      console.log('[GothamAgentSystem] Received data update, refreshing environment...');
      if (this.sampler && event.detail) {
        this.sampler.invalidateCache?.();
      }
    } catch (error) {
      console.error('[GothamAgentSystem] Error handling data update:', error);
    }
  };

  /**
   * Handler for alert events.
   * @private
   * @param {CustomEvent} event - Alert event
   */
  _alertHandler = (event) => {
    try {
      const alert = event.detail;
      console.log('[GothamAgentSystem] Received alert:', alert);

      if (alert && alert.lat && alert.lon) {
        // Notify nearby agents
        const nearbyAgents = this.simulation.getAgentsInArea(
          alert.lat,
          alert.lon,
          alert.radius || 10
        );

        nearbyAgents.forEach((agent) => {
          if (agent.memory) {
            agent.memory.event.recordEvent('alert', { lat: alert.lat, lon: alert.lon }, 0.8, alert);
          }

          // Trigger stress response
          if (agent.chemicalSystem) {
            agent.chemicalSystem.applyDeltas({
              stress: 0.3,
              dopamine: -0.1
            });
          } else if (agent.chemicals) {
            // Fallback for backward compatibility
            agent.chemicals.stress = Math.min(1.0, (agent.chemicals.stress || 0) + 0.3);
          }
        });

        console.log(`[GothamAgentSystem] Notified ${nearbyAgents.length} agents of threat`);
      }
    } catch (error) {
      console.error('[GothamAgentSystem] Error handling alert:', error);
    }
  };
}

// =============================================================================
// EVENT INTEGRATION
// =============================================================================

/**
 * Sets up event listeners for Gotham system integration.
 * @private
 * @param {AgentSystemController} controller - Controller instance
 * @param {Object} entitySystem - Entity system
 */
function setupEventListeners(controller, entitySystem) {
  // Listen for data updates to refresh environment
  window.addEventListener('gotham-data-update', controller._dataUpdateHandler);

  // Listen for alerts to notify agents of threats
  window.addEventListener('gotham-alert', controller._alertHandler);

  // Listen for simulation events
  controller.simulation.on('agent-spawned', (data) => {
    controller._emit('agent-spawned', data);
  });

  controller.simulation.on('agent-died', (data) => {
    controller._emit('agent-died', data);

    // Create event site for significant deaths
    if (controller.worldInfluence && data.soul) {
      const age = data.soul.age || 0;
      if (age > 500 || data.reason === 'combat') {
        controller.worldInfluence.createInfluence('EventSite', {
          location: data.soul.position,
          eventType: data.reason === 'combat' ? 'battle' : 'death',
          significance: Math.min(1, age / 1000),
          description: `Agent ${data.agentId} died from ${data.reason}`,
          creator: data.agentId
        });
      }
    }
  });

  controller.simulation.on('simulation-tick', (data) => {
    controller._emit('tick', data);
  });
}

/**
 * Dispatches the agent-system-ready event.
 * @private
 * @param {AgentSystemController} controller - Controller instance
 * @param {Object} initState - Initialization state
 */
function dispatchReadyEvent(controller, initState) {
  const event = new CustomEvent('agent-system-ready', {
    detail: {
      controller,
      stats: controller.getStats(),
      initializationState: initState,
      timestamp: Date.now()
    }
  });

  window.dispatchEvent(event);

  // Also emit on controller
  controller._emit('ready', { initializationState: initState });
}

// =============================================================================
// EXPORTS
// =============================================================================

window.GothamAgentSystem = {
  initAgentSystem,
  AgentSystemController,
  AGENT_TYPES,
  DEFAULT_OPTIONS,
  AgentState
};
window.initAgentSystem = initAgentSystem;

})();
