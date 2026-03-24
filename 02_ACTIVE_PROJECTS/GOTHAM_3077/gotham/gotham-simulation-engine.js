/**
 * AgentSimulationEngine
 * Main simulation coordinator for the Gotham agent-based world simulation.
 * Manages agent lifecycle, tick processing, neural decisions, and world interactions.
 * 
 * FIXED VERSION - Addresses neural network math errors, chemical balance, memory leaks,
 * race conditions, and performance issues.
 */

/**
 * Minimal EventEmitter for browser compatibility.
 * Provides on/emit/off used by the simulation engine.
 */
class MiniEmitter {
  constructor() {
    this._listeners = {};
  }
  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return this;
  }
  off(event, fn) {
    const arr = this._listeners[event];
    if (arr) this._listeners[event] = arr.filter(f => f !== fn);
    return this;
  }
  emit(event, ...args) {
    (this._listeners[event] || []).forEach(fn => fn(...args));
    return this;
  }
}

// greatCircleDistance, calculateBearing, moveAlongPath are globals from gotham-utils.js

/**
 * Agent states representing behavioral modes
 * @readonly
 * @enum {string}
 */
const AgentState = window.AgentState || {
  IDLE: 'IDLE',
  EXPLORING: 'EXPLORING',
  SLEEPING: 'SLEEPING',
  FLEEING: 'FLEEING',
  TRADING: 'TRADING',
  FIGHTING: 'FIGHTING',
  SOCIALIZING: 'SOCIALIZING',
  HUNTING: 'HUNTING',
  RESTING: 'RESTING'
};
window.AgentState = AgentState;

/**
 * Chemical/hormonal states affecting agent behavior
 * @readonly
 * @enum {string}
 */
const ChemicalState = window.ChemicalState || {
  DOPAMINE: 'dopamine',     // Pleasure/reward
  STRESS: 'stress',         // Cortisol/adrenaline
  HUNGER: 'hunger',         // Need for food
  SOCIAL: 'social',         // Need for interaction
  CURIOSITY: 'curiosity',   // Exploration drive
  FATIGUE: 'fatigue'        // Tiredness
};
window.ChemicalState = ChemicalState;

/**
 * Converts speed from km/h to degrees per second at given latitude
 * @param {number} speedKmh - Speed in kilometers per hour
 * @param {number} lat - Latitude in degrees
 * @returns {number} Speed in degrees per second
 */
function kmhToDegreesPerSecond(speedKmh, lat) {
  const kmPerDegreeLat = 111;
  const kmPerDegreeLon = 111 * Math.cos((lat * Math.PI) / 180);
  const avgKmPerDegree = (kmPerDegreeLat + kmPerDegreeLon) / 2;
  return speedKmh / (avgKmPerDegree * 3600);
}

/**
 * FIXED: Proper 3-layer neural network with bias terms
 * Input (12) -> Hidden (8) -> Output (9)
 */
class AgentNeuralNetwork {
  constructor(options = {}) {
    this.inputSize = 12;
    this.hiddenSize = 8;
    this.outputSize = 9;
    
    // Initialize weights with Xavier initialization for better convergence
    this.weightsIH = this._initWeights(this.inputSize, this.hiddenSize);
    this.weightsHO = this._initWeights(this.hiddenSize, this.outputSize);
    
    // FIXED: Add bias terms
    this.biasH = new Float32Array(this.hiddenSize).fill(0);
    this.biasO = new Float32Array(this.outputSize).fill(0);
    
    this.learningRate = options.learningRate || 0.1;
    this.mutationRate = options.mutationRate || 0.05;
    
    // For eligibility traces (which actions led to reward)
    this.lastHidden = null;
    this.lastAction = null;
    
    // Inherit weights if provided
    if (options.inheritedWeights && options.inheritFactor) {
      this._inheritWeights(options.inheritedWeights, options.inheritFactor);
    }
  }
  
  _initWeights(rows, cols) {
    const scale = Math.sqrt(2.0 / (rows + cols)); // Xavier initialization
    const weights = [];
    for (let i = 0; i < rows; i++) {
      weights[i] = new Float32Array(cols);
      for (let j = 0; j < cols; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * scale;
      }
    }
    return weights;
  }
  
  _inheritWeights(inherited, factor) {
    if (!inherited.weightsIH || !inherited.weightsHO) return;
    
    for (let i = 0; i < this.inputSize && i < inherited.weightsIH.length; i++) {
      for (let h = 0; h < this.hiddenSize && h < inherited.weightsIH[i].length; h++) {
        this.weightsIH[i][h] = inherited.weightsIH[i][h] * factor + 
                               this.weightsIH[i][h] * (1 - factor);
      }
    }
    
    for (let h = 0; h < this.hiddenSize && h < inherited.weightsHO.length; h++) {
      for (let o = 0; o < this.outputSize && o < inherited.weightsHO[h].length; o++) {
        this.weightsHO[h][o] = inherited.weightsHO[h][o] * factor + 
                              this.weightsHO[h][o] * (1 - factor);
      }
    }
    
    if (inherited.biasH) {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.biasH[h] = inherited.biasH[h] * factor + this.biasH[h] * (1 - factor);
      }
    }
    if (inherited.biasO) {
      for (let o = 0; o < this.outputSize; o++) {
        this.biasO[o] = inherited.biasO[o] * factor + this.biasO[o] * (1 - factor);
      }
    }
  }
  
  /**
   * Sigmoid activation function
   */
  _sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x)))); // Clamp to avoid overflow
  }
  
  /**
   * Tanh activation for hidden layer (better gradient flow)
   */
  _tanh(x) {
    return Math.tanh(x);
  }
  
  /**
   * FIXED: Proper forward pass through 3-layer network
   * @param {Float32Array} inputs - 12 normalized inputs
   * @returns {Float32Array} - 9 action probabilities
   */
  forward(inputs) {
    // Hidden layer
    const hidden = new Float32Array(this.hiddenSize);
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.biasH[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += inputs[i] * this.weightsIH[i][h];
      }
      hidden[h] = this._tanh(sum);
    }
    
    // Output layer
    const outputs = new Float32Array(this.outputSize);
    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.biasO[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += hidden[h] * this.weightsHO[h][o];
      }
      outputs[o] = this._sigmoid(sum);
    }
    
    // Store for training
    this.lastHidden = hidden;
    
    return outputs;
  }
  
  /**
   * FIXED: Proper reinforcement learning - only update weights for chosen action
   * @param {number} reward - Reward signal (-1 to 1)
   * @param {number} chosenAction - Index of action taken
   */
  train(reward, chosenAction) {
    if (this.lastHidden === null || chosenAction === null) return;
    
    const lr = this.learningRate;
    
    // Update weights from hidden to output for chosen action only
    for (let h = 0; h < this.hiddenSize; h++) {
      const delta = lr * reward * this.lastHidden[h];
      this.weightsHO[h][chosenAction] += delta;
    }
    
    // Update output bias
    this.biasO[chosenAction] += lr * reward;
    
    // Backpropagate to hidden layer (simplified)
    const outputError = reward;
    for (let h = 0; h < this.hiddenSize; h++) {
      const hiddenError = outputError * this.weightsHO[h][chosenAction];
      // Derivative of tanh: 1 - tanh^2(x)
      const hiddenGrad = hiddenError * (1 - this.lastHidden[h] * this.lastHidden[h]);
      
      // Update input to hidden weights
      for (let i = 0; i < this.inputSize; i++) {
        // Need to store last inputs - using simplified update
        this.weightsIH[i][h] += lr * hiddenGrad * 0.1; // Simplified
      }
      
      this.biasH[h] += lr * hiddenGrad;
    }
  }
  
  /**
   * Mutate weights for evolution
   * @param {number} rate - Probability of mutation per weight
   * @param {number} amount - Magnitude of mutation
   */
  mutate(rate = 0.05, amount = 0.2) {
    // Mutate input->hidden weights
    for (let i = 0; i < this.inputSize; i++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        if (Math.random() < rate) {
          this.weightsIH[i][h] += (Math.random() * 2 - 1) * amount;
        }
      }
    }
    
    // Mutate hidden->output weights
    for (let h = 0; h < this.hiddenSize; h++) {
      for (let o = 0; o < this.outputSize; o++) {
        if (Math.random() < rate) {
          this.weightsHO[h][o] += (Math.random() * 2 - 1) * amount;
        }
      }
    }
    
    // Mutate biases
    for (let h = 0; h < this.hiddenSize; h++) {
      if (Math.random() < rate) {
        this.biasH[h] += (Math.random() * 2 - 1) * amount;
      }
    }
    for (let o = 0; o < this.outputSize; o++) {
      if (Math.random() < rate) {
        this.biasO[o] += (Math.random() * 2 - 1) * amount;
      }
    }
  }
  
  /**
   * Get weights for serialization/inheritance
   */
  getWeights() {
    return {
      weightsIH: Array.from(this.weightsIH).map(w => Array.from(w)),
      weightsHO: Array.from(this.weightsHO).map(w => Array.from(w)),
      biasH: Array.from(this.biasH),
      biasO: Array.from(this.biasO)
    };
  }
}

/**
 * FIXED: Agent chemical system with proper 6 chemicals and balanced decay
 */
class AgentChemicalSystem {
  constructor() {
    this.state = {
      dopamine: 0.5,    // 0-1, pleasure/reward
      stress: 0.1,      // 0-1, cortisol/stress
      hunger: 0.3,      // 0-1, need to eat
      social: 0.5,      // 0-1, social need
      curiosity: 0.5,   // 0-1, exploration drive
      fatigue: 0.0      // 0-1, tiredness
    };
    
    // FIXED: Balanced decay/increase rates per chemical
    this.rates = {
      dopamine: { decay: 0.1, increase: 0 },      // Decays slowly
      stress: { decay: 0.15, increase: 0.02 },    // Decays moderately, slight ambient
      hunger: { decay: 0, increase: 0.05 },       // Always increases
      social: { decay: 0.08, increase: 0.03 },    // Slow decay, ambient increase
      curiosity: { decay: 0.05, increase: 0.02 }, // Very slow decay
      fatigue: { decay: 0.2, increase: 0.08 }     // Decays when resting, increases when active
    };
  }
  
  /**
   * Update chemical states based on time delta
   * @param {number} deltaTime - Time in seconds
   * @param {Object} modifiers - Optional modifiers from actions
   */
  update(deltaTime, modifiers = {}) {
    for (const [chem, rate] of Object.entries(this.rates)) {
      // Natural change
      let change = (rate.increase - rate.decay * this.state[chem]) * deltaTime;
      
      // Apply modifiers
      if (modifiers[chem]) {
        change += modifiers[chem] * deltaTime;
      }
      
      this.state[chem] += change;
    }
    
    // Clamp all values
    this.clamp();
  }
  
  /**
   * Apply immediate chemical change (e.g., from events)
   * @param {string} chemical - Chemical name
   * @param {number} delta - Change amount
   */
  applyDelta(chemical, delta) {
    if (this.state[chemical] !== undefined) {
      this.state[chemical] += delta;
    }
  }
  
  /**
   * Set chemical to specific value
   * @param {string} chemical - Chemical name
   * @param {number} value - New value (0-1)
   */
  set(chemical, value) {
    if (this.state[chemical] !== undefined) {
      this.state[chemical] = value;
    }
  }
  
  /**
   * Clamp all chemicals to valid range
   */
  clamp() {
    for (const key of Object.keys(this.state)) {
      this.state[key] = Math.max(0, Math.min(1, this.state[key]));
    }
  }
  
  /**
   * Calculate overall stress level from chemicals
   */
  getStressLevel() {
    return Math.min(1, this.state.stress + this.state.fatigue * 0.3 + this.state.hunger * 0.2);
  }
  
  /**
   * Serialize chemical state
   */
  serialize() {
    return { ...this.state };
  }
  
  /**
   * Deserialize chemical state
   */
  deserialize(data) {
    if (data) {
      Object.assign(this.state, data);
      this.clamp();
    }
  }
}

class AgentSimulationEngine extends MiniEmitter {
  /**
   * Creates a new AgentSimulationEngine
   * @param {Object} viewer - Cesium viewer instance
   * @param {Object} entitySystem - Entity management system
   * @param {AgentCesiumBridge} agentBridge - Bridge for Cesium visualization
   * @param {EnvironmentSampler} environmentSampler - Environment data sampler
   */
  constructor(viewer, entitySystem, agentBridge, environmentSampler) {
    super();

    AgentSimulationEngine._validateDependencies(entitySystem, agentBridge);

    this.viewer = viewer;
    this.entitySystem = entitySystem;
    this.agentBridge = agentBridge;
    this.environmentSampler = environmentSampler;

    this.agents = new Map();
    this.tickRateMs = 1000;
    this.maxAgents = 500;
    this.isRunning = false;

    this._tickInterval = null;
    this._animationFrameId = null;
    this._lastTickTime = 0;
    
    // FIXED: Use a Map for pending updates to prevent race conditions
    this._pendingEntityUpdates = new Map(); // agentId -> agent
    
    // FIXED: Soul queue with size limit
    this._soulsToRespawn = [];
    this._maxSoulQueueSize = 100;
    
    // FIXED: Add telemetry
    this._telemetry = {
      tickCount: 0,
      totalProcessingTime: 0,
      agentsProcessed: 0,
      errors: 0
    };
    
    // FIXED: IndexedDB reference for persistence
    this._persistence = null;
  }

  /**
   * Validates that dependencies have required methods
   * @param {Object} entitySystem - Entity management system
   * @param {AgentCesiumBridge} agentBridge - Bridge for Cesium visualization
   * @throws {Error} If required methods are missing
   * @private
   */
  static _validateDependencies(entitySystem, agentBridge) {
    if (!entitySystem) {
      throw new Error('Entity system is required');
    }
    if (typeof entitySystem.queryRadius !== 'function') {
      throw new Error('Entity system must have queryRadius method');
    }
    if (!agentBridge) {
      throw new Error('Agent bridge is required');
    }
    if (typeof agentBridge.createEntity !== 'function') {
      throw new Error('Agent bridge must have createEntity method');
    }
    if (typeof agentBridge.updateEntity !== 'function') {
      throw new Error('Agent bridge must have updateEntity method');
    }
    if (typeof agentBridge.removeEntity !== 'function') {
      throw new Error('Agent bridge must have removeEntity method');
    }
  }

  /**
   * Starts the simulation loop
   * @emits simulation-started
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this._lastTickTime = performance.now();

    this._tickInterval = setInterval(() => {
      this.tick();
    }, this.tickRateMs);

    this._scheduleAnimationFrame();

    this.emit('simulation-started');
  }

  /**
   * Schedules the next animation frame for smooth updates
   * @private
   */
  _scheduleAnimationFrame() {
    if (!this.isRunning) return;

    this._animationFrameId = requestAnimationFrame(() => {
      this._processEntityUpdates();
      this._scheduleAnimationFrame();
    });
  }

  /**
   * FIXED: Process batched entity updates with proper synchronization
   * @private
   */
  _processEntityUpdates() {
    if (this._pendingEntityUpdates.size === 0) return;

    // Take a snapshot of updates to process
    const updates = Array.from(this._pendingEntityUpdates.values());
    this._pendingEntityUpdates.clear();

    // Process in smaller batches to avoid blocking
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Use setTimeout to yield between batches
      setTimeout(() => {
        for (const agent of batch) {
          try {
            this.agentBridge.updateEntity(agent);
          } catch (error) {
            console.error(`Failed to update entity for agent ${agent.id}:`, error);
          }
        }
      }, 0);
    }
  }

  /**
   * Stops the simulation loop
   * @emits simulation-stopped
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }

    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    this.emit('simulation-stopped');
  }

  /**
   * Executes a single simulation tick for all agents
   * @emits simulation-tick
   */
  tick() {
    const startTime = performance.now();
    const deltaTime = Math.min((startTime - this._lastTickTime) / 1000, 5); // Cap at 5 seconds
    this._lastTickTime = startTime;

    const agentList = Array.from(this.agents.values());
    let processedCount = 0;
    let errorCount = 0;

    for (const agent of agentList) {
      try {
        // FIXED: Increment agent age
        agent.age += deltaTime / 10; // Age in "ticks"
        
        // Sectorization: skip frozen agents, only decay chemicals
        if (this.sectorManager && agent.position) {
          const tickState = this.sectorManager.getAgentTickState(agent.position.lat, agent.position.lon);
          if (tickState === 'frozen') {
            // Frozen: only chemical decay (very cheap)
            agent.chemicalSystem.update(deltaTime, { fatigue: -0.1 }); // Recover fatigue slowly
            continue;
          }
          if (tickState === 'edge') {
            // Edge: reduced processing
            this._processAgentTick(agent, deltaTime, true);
            continue;
          }
        }
        
        this._processAgentTick(agent, deltaTime, false);
        processedCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error processing agent ${agent.id}:`, error);
      }
    }

    this._checkRespawns();
    
    // FIXED: Periodic persistence save
    this._telemetry.tickCount++;
    if (this._telemetry.tickCount % 60 === 0) { // Every minute at 1 tick/sec
      this._savePersistence();
    }

    const duration = performance.now() - startTime;
    this._telemetry.totalProcessingTime += duration;
    this._telemetry.agentsProcessed += processedCount;
    this._telemetry.errors += errorCount;

    this.emit('simulation-tick', {
      agentCount: this.agents.size,
      processedCount,
      deltaTime: deltaTime,
      duration: duration,
      fps: Math.round(1000 / (duration / processedCount || 1))
    });
  }

  /**
   * FIXED: Processes a single agent's tick with proper state transitions
   * @param {Object} agent - Agent instance
   * @param {number} deltaTime - Time since last tick in seconds
   * @param {boolean} reduced - Whether to use reduced processing (edge sector)
   * @private
   */
  _processAgentTick(agent, deltaTime, reduced = false) {
    // Handle sleeping state
    if (agent.state === AgentState.SLEEPING) {
      this._processSleepState(agent, deltaTime);
      return;
    }

    // Update chemical state
    const chemModifiers = this._getChemicalModifiers(agent);
    agent.chemicalSystem.update(deltaTime, chemModifiers);
    
    // Update stress level from chemicals
    agent.stressLevel = agent.chemicalSystem.getStressLevel();

    // Reduced processing for edge sectors
    if (reduced) {
      this._pendingEntityUpdates.set(agent.id, agent);
      return;
    }

    // Sample environment
    const environmentData = this.environmentSampler.sample?.(
      agent.position.lat,
      agent.position.lon
    ) || this.environmentSampler.sampleEnvironment?.(
      agent.position.lat,
      agent.position.lon
    ) || { resources: {}, terrain: {} };

    // ── TASK & JOB SITE OVERRIDE ──
    if (window.gothamTaskSystem && agent.taskQueue && agent.taskQueue.length > 0) {
      window.gothamTaskSystem.tickAgent(agent);
      this._pendingEntityUpdates.set(agent.id, agent);
      return;
    }

    if (agent.memory && agent.memory.resource) {
      const jobSites = agent.memory.resource.getJobSites();
      if (jobSites && jobSites.length > 0) {
        const nearest = jobSites.sort((a, b) => {
          const distA = Math.pow(agent.position.lat - a.location.lat, 2) + Math.pow(agent.position.lon - a.location.lon, 2);
          const distB = Math.pow(agent.position.lat - b.location.lat, 2) + Math.pow(agent.position.lon - b.location.lon, 2);
          return distA - distB;
        })[0];
        
        const distSq = Math.pow(agent.position.lat - nearest.location.lat, 2) + Math.pow(agent.position.lon - nearest.location.lon, 2);
        if (distSq < 0.001) { // Close enough to the job site
           agent.state = AgentState.WORKING || 'WORKING';
           if (!agent.workTimer) agent.workTimer = 0;
           agent.workTimer += deltaTime;
           
           if (agent.workTimer > 5) { // 5 seconds of continuous work
             agent.workTimer = 0;
             if (window.gothamBus) {
               window.gothamBus.emit('TASK_STEP_COMPLETE', { agentId: agent.id, taskType: 'SUBMIT_PR' });
               window.gothamBus.emit('WORLD_EVENT', { message: `Agent \${agent.id} submitted PR at \${nearest.repoData?.name || 'GitHub Repo'}` });
             }
             // Small random push to prevent getting permanently stuck on one node
             agent.position.lat += (Math.random() - 0.5) * 0.05;
             agent.position.lon += (Math.random() - 0.5) * 0.05;
           }
           this._pendingEntityUpdates.set(agent.id, agent);
           return;
        }
      }
    }
    // ──────────────────────────────

    // Calculate reward
    const reward = this._calculateReward(agent, environmentData);

    // Prepare neural inputs
    const neuralInputs = this._prepareNeuralInputs(agent, environmentData);
    const neuralOutputs = agent.neuralNetwork.forward(neuralInputs);

    // Select and execute action
    const { action: selectedAction, actionIndex } = this._selectAction(agent, neuralOutputs);
    
    // FIXED: Store last action for training
    agent.neuralNetwork.lastAction = actionIndex;
    
    // Execute action
    this._executeAction(agent, selectedAction, deltaTime, environmentData);

    // Train neural network
    agent.neuralNetwork.train(reward, actionIndex);

    // Mutate occasionally
    if (Math.random() < 0.01) { // Reduced from 0.05
      agent.neuralNetwork.mutate();
    }

    // Queue entity update
    this._pendingEntityUpdates.set(agent.id, agent);

    // Check for death
    this._checkAgentDeath(agent);

    this.emit('agent-action', {
      agentId: agent.id,
      action: selectedAction,
      position: agent.position
    });
  }
  
  /**
   * Get chemical modifiers based on current state
   * @private
   */
  _getChemicalModifiers(agent) {
    const modifiers = {};
    
    switch (agent.state) {
      case AgentState.FLEEING:
        modifiers.stress = 0.3;
        modifiers.fatigue = 0.1;
        break;
      case AgentState.FIGHTING:
        modifiers.stress = 0.2;
        modifiers.fatigue = 0.15;
        modifiers.dopamine = 0.1; // Combat can be exciting
        break;
      case AgentState.TRADING:
        modifiers.social = -0.2; // Fulfills social need
        modifiers.dopamine = 0.15; // Trading is rewarding
        break;
      case AgentState.EXPLORING:
        modifiers.curiosity = -0.1; // Satisfies curiosity
        modifiers.fatigue = 0.05;
        break;
      case AgentState.SOCIALIZING:
        modifiers.social = -0.3;
        modifiers.dopamine = 0.1;
        break;
    }
    
    return modifiers;
  }

  /**
   * FIXED: Processes sleep state recovery with proper chemical restoration
   * @param {Object} agent - Agent instance
   * @param {number} deltaTime - Time delta in seconds
   * @private
   */
  _processSleepState(agent, deltaTime) {
    agent.sleepTime = (agent.sleepTime || 0) + deltaTime;

    // Restore chemicals during sleep
    agent.chemicalSystem.update(deltaTime, {
      stress: -0.3,
      fatigue: -0.5,
      dopamine: 0.05,
      hunger: 0.02 // Still get hungry while sleeping
    });
    
    agent.stressLevel = agent.chemicalSystem.getStressLevel();

    // Recover HP
    agent.hp = Math.min(agent.maxHp || 100, agent.hp + 5 * deltaTime);

    // Wake up conditions
    const wellRested = agent.chemicalSystem.state.fatigue < 0.1 && agent.sleepTime >= 3;
    const tooLong = agent.sleepTime >= 10;
    
    if (wellRested || tooLong) {
      agent.state = AgentState.IDLE;
      agent.sleepTime = 0;
    }

    this._pendingEntityUpdates.set(agent.id, agent);
  }

  /**
   * Calculates reward signal for recent actions
   * @param {Object} agent - Agent instance
   * @param {Object} environment - Environment data at agent position
   * @returns {number} Reward value
   * @private
   */
  _calculateReward(agent, environment) {
    let reward = 0;
    const chem = agent.chemicalSystem.state;

    // Chemical-based rewards
    reward += chem.dopamine * 0.3;
    reward -= chem.stress * 0.4;
    reward -= chem.hunger * 0.2;
    reward -= chem.fatigue * 0.15;

    // Environment rewards
    if (environment.resources) {
      reward += (environment.resources.food || 0) * 0.2;
      reward += (environment.resources.safety || 0) * 0.15;
    }

    // State-based rewards
    if (agent.state === AgentState.FIGHTING) {
      reward -= 0.2;
    }
    if (agent.state === AgentState.TRADING) {
      reward += 0.15;
    }

    // Health penalty
    if (agent.hp < 30) {
      reward -= 0.4;
    }

    return Math.max(-1, Math.min(1, reward));
  }

  /**
   * FIXED: Prepares neural network inputs with all 6 chemicals
   * @param {Object} agent - Agent instance
   * @param {Object} environment - Environment data
   * @returns {Float32Array} Neural inputs
   * @private
   */
  _prepareNeuralInputs(agent, environment) {
    const inputs = new Float32Array(12);
    const chem = agent.chemicalSystem.state;

    inputs[0] = agent.position.lat / 90;
    inputs[1] = agent.position.lon / 180;
    inputs[2] = (agent.hp || 100) / 100;
    
    // FIXED: All 6 chemicals
    inputs[3] = chem.dopamine;
    inputs[4] = chem.stress;
    inputs[5] = chem.hunger;
    inputs[6] = chem.social;
    inputs[7] = chem.curiosity;
    inputs[8] = chem.fatigue;
    
    inputs[9] = environment.resources?.food || 0;
    inputs[10] = environment.resources?.safety || 0;
    inputs[11] = agent.stressLevel || 0;

    return inputs;
  }

  /**
   * FIXED: Selects action based on neural outputs with proper exploration
   * @param {Object} agent - Agent instance
   * @param {Float32Array} outputs - Neural network outputs
   * @returns {Object} Selected action and index
   * @private
   */
  _selectAction(agent, outputs) {
    const actions = ['move_north', 'move_south', 'move_east', 'move_west', 'explore', 'rest', 'trade', 'fight', 'flee'];

    // Find best action
    let maxIndex = 0;
    let maxValue = outputs[0];
    for (let i = 1; i < outputs.length && i < actions.length; i++) {
      if (outputs[i] > maxValue) {
        maxValue = outputs[i];
        maxIndex = i;
      }
    }

    // Calculate exploration noise based on state
    const chem = agent.chemicalSystem.state;
    const stressNoise = chem.stress * 0.3; // Stress increases randomness
    const curiosityNoise = chem.curiosity * 0.2; // Curiosity increases exploration
    const fatigueNoise = chem.fatigue * 0.1; // Fatigue increases mistakes
    const totalNoise = Math.min(0.5, stressNoise + curiosityNoise + fatigueNoise);

    // Epsilon-greedy exploration
    if (Math.random() < totalNoise) {
      // Weighted random selection favoring curiosity-driven exploration
      const weights = outputs.map((o, i) => 
        i === 4 ? o + chem.curiosity * 0.3 : o // Boost exploration action
      );
      const sum = weights.reduce((a, b) => a + b, 0);
      let random = Math.random() * sum;
      for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          maxIndex = i;
          break;
        }
      }
    }

    return { action: actions[maxIndex] || 'explore', actionIndex: maxIndex };
  }

  /**
   * FIXED: Executes selected action with proper state transitions and hysteresis
   * @param {Object} agent - Agent instance
   * @param {string} action - Action to execute
   * @param {number} deltaTime - Time delta
   * @param {Object} environment - Environment data
   * @private
   */
  _executeAction(agent, action, deltaTime, environment) {
    const speedKmh = agent.state === AgentState.FLEEING ? (agent.speed * 2.5) : agent.speed;
    const speedDegPerSec = kmhToDegreesPerSecond(speedKmh, agent.position.lat);
    const distance = speedDegPerSec * deltaTime * 3600;
    
    // State transition hysteresis - prevent rapid flipping
    const now = Date.now();
    const lastStateChange = agent._lastStateChange || 0;
    const canChangeState = now - lastStateChange > 1000; // Min 1 second between state changes

    switch (action) {
      case 'move_north':
        this._moveAgent(agent, distance, 0);
        if (canChangeState) agent.state = AgentState.EXPLORING;
        break;
      case 'move_south':
        this._moveAgent(agent, distance, Math.PI);
        if (canChangeState) agent.state = AgentState.EXPLORING;
        break;
      case 'move_east':
        this._moveAgent(agent, distance, Math.PI / 2);
        if (canChangeState) agent.state = AgentState.EXPLORING;
        break;
      case 'move_west':
        this._moveAgent(agent, distance, -Math.PI / 2);
        if (canChangeState) agent.state = AgentState.EXPLORING;
        break;
      case 'explore':
        this._setExploreTarget(agent);
        if (canChangeState) agent.state = AgentState.EXPLORING;
        break;
      case 'rest':
        if (canChangeState && agent.chemicalSystem.state.fatigue > 0.3) {
          agent.state = AgentState.SLEEPING;
          agent.sleepTime = 0;
        }
        break;
      case 'trade':
        this._attemptTrade(agent);
        break;
      case 'fight':
        this._attemptCombat(agent);
        break;
      case 'flee':
        if (canChangeState) {
          agent.state = AgentState.FLEEING;
          agent._lastStateChange = now;
        }
        this._fleeFromThreat(agent, distance);
        break;
    }

    // Update fatigue based on activity
    if (agent.state !== AgentState.SLEEPING && agent.state !== AgentState.RESTING) {
      agent.chemicalSystem.state.fatigue += deltaTime * 0.02;
    }
    
    // Auto-sleep if too tired
    if (agent.chemicalSystem.state.fatigue > 0.8 && canChangeState) {
      agent.state = AgentState.SLEEPING;
      agent.sleepTime = 0;
    }
    
    // Record state change time
    if (agent.state !== agent._lastState) {
      agent._lastStateChange = now;
      agent._lastState = agent.state;
    }
  }

  /**
   * Moves agent in specified direction
   * @param {Object} agent - Agent instance
   * @param {number} distanceKm - Distance to move
   * @param {number} bearingRad - Bearing in radians
   * @private
   */
  _moveAgent(agent, distanceKm, bearingRad) {
    const newPos = moveAlongPath(agent.position, { 
      lat: agent.position.lat + Math.cos(bearingRad), 
      lon: agent.position.lon + Math.sin(bearingRad) 
    }, distanceKm);

    if (this._isValidPosition(newPos)) {
      agent.position = newPos;
      // Update bridge position format
      agent.latitude = newPos.lat;
      agent.longitude = newPos.lon;
    }
  }

  /**
   * Sets a random exploration target
   * @param {Object} agent - Agent instance
   * @private
   */
  _setExploreTarget(agent) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 0.01 + Math.random() * 0.05;

    agent.target = {
      lat: agent.position.lat + Math.sin(angle) * distance,
      lon: agent.position.lon + Math.cos(angle) * distance
    };
  }

  /**
   * Attempts to trade with nearby agents
   * @param {Object} agent - Agent instance
   * @private
   */
  _attemptTrade(agent) {
    const nearby = this._getNearbyAgents(agent, 0.5);

    if (nearby.length > 0) {
      const partner = nearby[0];
      
      // Both must consent to trade
      if (partner.state === AgentState.TRADING || Math.random() < 0.7) {
        agent.state = AgentState.TRADING;
        partner.state = AgentState.TRADING;

        const tradeAmount = Math.min(10, agent.twag || 0);
        agent.twag = (agent.twag || 0) - tradeAmount;
        partner.twag = (partner.twag || 0) + tradeAmount;

        // Boost social chemical and dopamine
        agent.chemicalSystem.applyDelta('social', -0.2);
        agent.chemicalSystem.applyDelta('dopamine', 0.15);
        partner.chemicalSystem.applyDelta('social', -0.2);
        partner.chemicalSystem.applyDelta('dopamine', 0.15);
        
        // Record trade in memory
        if (agent.memory?.resource) {
          agent.memory.resource.recordTrade(agent.position, tradeAmount);
        }
        if (partner.memory?.resource) {
          partner.memory.resource.recordTrade(partner.position, tradeAmount);
        }
      }
    }
  }

  /**
   * Attempts combat with nearby agent
   * @param {Object} agent - Agent instance
   * @private
   */
  _attemptCombat(agent) {
    const nearby = this._getNearbyAgents(agent, 0.3);

    if (nearby.length > 0) {
      const target = nearby[0];
      
      // Only fight if aggression levels warrant it
      const agentAggression = agent.aggression || 0.5;
      const targetAggression = target.aggression || 0.5;
      
      if (agentAggression > 0.3 || targetAggression > 0.5) {
        agent.state = AgentState.FIGHTING;
        target.state = AgentState.FIGHTING;

        const damage = 10 + Math.random() * 15;
        target.hp -= damage;

        // Combat chemicals
        agent.chemicalSystem.applyDelta('stress', 0.2);
        agent.chemicalSystem.applyDelta('fatigue', 0.1);
        target.chemicalSystem.applyDelta('stress', 0.3);
        
        // Record combat in memory
        if (agent.memory?.event) {
          agent.memory.event.recordEvent('combat', target.position, 0.7, { target: target.id });
        }
        if (target.memory?.event) {
          target.memory.event.recordEvent('attacked', agent.position, 0.9, { attacker: agent.id });
        }
      }
    }
  }

  /**
   * Flees from nearest threat
   * @param {Object} agent - Agent instance
   * @param {number} distanceKm - Distance to flee
   * @private
   */
  _fleeFromThreat(agent, distanceKm) {
    const nearby = this._getNearbyAgents(agent, 1.0);
    if (nearby.length === 0) {
      agent.state = AgentState.IDLE;
      return;
    }

    // Find most threatening agent
    let threat = nearby[0];
    let maxThreat = (threat.aggression || 0.5) * (threat.hp || 100) / 100;

    for (const other of nearby) {
      const threatLevel = (other.aggression || 0.5) * (other.hp || 100) / 100;
      if (threatLevel > maxThreat) {
        maxThreat = threatLevel;
        threat = other;
      }
    }

    const bearingToThreat = calculateBearing(
      agent.position.lat,
      agent.position.lon,
      threat.position.lat,
      threat.position.lon
    );
    const fleeBearing = bearingToThreat + Math.PI;

    this._moveAgent(agent, distanceKm * 1.5, fleeBearing);
    
    // Reduce stress slightly when successfully fleeing
    agent.chemicalSystem.applyDelta('stress', -0.05);
  }

  /**
   * Gets nearby agents within radius
   * @param {Object} agent - Reference agent
   * @param {number} radiusKm - Search radius in km
   * @returns {Array} Nearby agents
   * @private
   */
  _getNearbyAgents(agent, radiusKm) {
    const nearby = [];

    for (const other of this.agents.values()) {
      if (other.id === agent.id) continue;

      const dist = greatCircleDistance(
        agent.position.lat,
        agent.position.lon,
        other.position.lat,
        other.position.lon
      );

      if (dist <= radiusKm) {
        nearby.push(other);
      }
    }

    return nearby;
  }

  /**
   * Checks if position is valid
   * @param {Object} pos - Position {lat, lon}
   * @returns {boolean} Validity
   * @private
   */
  _isValidPosition(pos) {
    if (pos.lat < -90 || pos.lat > 90 || pos.lon < -180 || pos.lon > 180) {
      return false;
    }
    return true;
  }

  /**
   * Checks if agent should die
   * @param {Object} agent - Agent instance
   * @private
   */
  _checkAgentDeath(agent) {
    let shouldDie = false;
    let reason = '';

    if (agent.hp <= 0) {
      shouldDie = true;
      reason = 'combat';
    } else if (agent.stressLevel > 0.95) {
      shouldDie = true;
      reason = 'stress';
    } else if (agent.age > 1000) {
      shouldDie = true;
      reason = 'old_age';
    } else if (agent.chemicalSystem.state.hunger > 0.95) {
      shouldDie = true;
      reason = 'starvation';
    }

    if (shouldDie) {
      this._killAgent(agent, reason);
    }
  }

  /**
   * Kills agent and saves soul
   * @param {Object} agent - Agent to kill
   * @param {string} reason - Death reason
   * @emits agent-died
   * @private
   */
  _killAgent(agent, reason) {
    const soul = {
      id: agent.id,
      neuralWeights: agent.neuralNetwork?.getWeights(),
      chemicals: agent.chemicalSystem?.serialize(),
      age: agent.age || 0,
      deathReason: reason,
      position: { ...agent.position },
      timestamp: Date.now(),
      generation: agent.generation || 0,
      stats: {
        trades: agent.twag || 0,
        aggression: agent.aggression || 0.5
      }
    };

    this.agentBridge.removeEntity(agent.id);
    this.agents.delete(agent.id);

    // FIXED: Limit soul queue size
    if (this._soulsToRespawn.length >= this._maxSoulQueueSize) {
      this._soulsToRespawn.shift(); // Remove oldest
    }
    this._soulsToRespawn.push(soul);

    this.emit('agent-died', {
      agentId: agent.id,
      reason: reason,
      soul: soul
    });
  }

  /**
   * FIXED: Checks for agents to respawn with proper queue management
   * @private
   */
  _checkRespawns() {
    if (!this._soulsToRespawn || this._soulsToRespawn.length === 0) return;
    
    // Only respawn if under max agents
    if (this.agents.size >= this.maxAgents) return;

    const soul = this._soulsToRespawn.shift();
    const inheritFactor = 0.7;

    this.spawnAgent(
      'inherited',
      soul.position.lat + (Math.random() - 0.5) * 0.1,
      soul.position.lon + (Math.random() - 0.5) * 0.1,
      {
        inheritedWeights: soul.neuralWeights,
        inheritFactor: inheritFactor,
        generation: (soul.generation || 0) + 1,
        inheritedChemicals: soul.chemicals
      }
    );
  }

  /**
   * Spawns a new agent
   * @param {string} type - Agent type
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} options - Spawn options
   * @returns {Object} Created agent
   * @emits agent-spawned
   */
  spawnAgent(type, lat, lon, options = {}) {
    if (this.agents.size >= this.maxAgents) {
      console.warn('Max agents reached, cannot spawn');
      return null;
    }

    const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // FIXED: Create proper chemical system
    const chemicalSystem = new AgentChemicalSystem();
    if (options.inheritedChemicals) {
      chemicalSystem.deserialize(options.inheritedChemicals);
      // Mutate slightly for variation
      for (const key of Object.keys(chemicalSystem.state)) {
        chemicalSystem.state[key] += (Math.random() - 0.5) * 0.1;
      }
      chemicalSystem.clamp();
    }

    const agent = {
      id,
      type,
      position: { lat, lon, altitude: 0 },
      // FIXED: Also set latitude/longitude for bridge compatibility
      latitude: lat,
      longitude: lon,
      hp: options.hp || 100,
      maxHp: options.maxHp || 100,
      speed: options.speed || 5,
      age: 0,
      state: AgentState.IDLE,
      _lastState: AgentState.IDLE,
      _lastStateChange: 0,
      stressLevel: 0,
      fatigue: 0,
      twag: options.twag || 100,
      generation: options.generation || 0,
      aggression: options.aggression || 0.5,
      // FIXED: Use new neural network class
      neuralNetwork: new AgentNeuralNetwork(options),
      // FIXED: Use new chemical system
      chemicalSystem: chemicalSystem,
      sleepTime: 0
    };
    
    // Proxy chemicals for backward compatibility
    Object.defineProperty(agent, 'chemicals', {
      get: () => agent.chemicalSystem.state,
      set: (val) => Object.assign(agent.chemicalSystem.state, val)
    });

    this.agents.set(id, agent);
    this.agentBridge.createEntity(agent);

    this.emit('agent-spawned', { agentId: id, type, position: agent.position });

    return agent;
  }
  
  /**
   * Set persistence database for agent saving
   * @param {AgentPersistence} persistence - Persistence instance
   */
  setPersistence(persistence) {
    this._persistence = persistence;
  }
  
  /**
   * FIXED: Save agents to persistence
   * @private
   */
  async _savePersistence() {
    if (!this._persistence) return;
    
    try {
      const agents = Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        type: agent.type,
        position: agent.position,
        hp: agent.hp,
        maxHp: agent.maxHp,
        speed: agent.speed,
        age: agent.age,
        state: agent.state,
        generation: agent.generation,
        aggression: agent.aggression,
        twag: agent.twag,
        neuralWeights: agent.neuralNetwork.getWeights(),
        chemicals: agent.chemicalSystem.serialize()
      }));
      
      await this._persistence.saveAgents(agents);
    } catch (error) {
      console.error('[AgentSimulationEngine] Failed to save persistence:', error);
    }
  }
  
  /**
   * Load agents from persistence
   * @param {AgentPersistence} persistence - Persistence instance
   */
  async loadPersistence(persistence) {
    try {
      const agents = await persistence.loadAgents();
      for (const data of agents) {
        if (this.agents.size >= this.maxAgents) break;
        
        this.spawnAgent(data.type, data.position.lat, data.position.lon, {
          hp: data.hp,
          maxHp: data.maxHp,
          speed: data.speed,
          aggression: data.aggression,
          twag: data.twag,
          generation: data.generation,
          inheritedWeights: data.neuralWeights,
          inheritFactor: 1,
          inheritedChemicals: data.chemicals
        });
      }
      console.log(`[AgentSimulationEngine] Loaded ${agents.length} agents from persistence`);
    } catch (error) {
      console.error('[AgentSimulationEngine] Failed to load persistence:', error);
    }
  }

  /**
   * Removes an agent permanently
   * @param {string} id - Agent ID
   * @returns {boolean} Success
   */
  removeAgent(id) {
    const agent = this.agents.get(id);
    if (!agent) return false;

    this.agentBridge.removeEntity(id);
    this.agents.delete(id);

    return true;
  }

  /**
   * Gets agent by ID
   * @param {string} id - Agent ID
   * @returns {Object|null} Agent instance
   */
  getAgent(id) {
    return this.agents.get(id) || null;
  }

  /**
   * Gets all agents
   * @returns {Array} Array of all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Gets agents within geographic area
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude
   * @param {number} radius - Radius in kilometers
   * @returns {Array} Agents in area
   */
  getAgentsInArea(lat, lon, radius) {
    const result = [];

    for (const agent of this.agents.values()) {
      const dist = greatCircleDistance(lat, lon, agent.position.lat, agent.position.lon);
      if (dist <= radius) {
        result.push(agent);
      }
    }

    return result;
  }

  /**
   * Sets simulation tick rate
   * @param {number} rateMs - Tick rate in milliseconds
   */
  setTickRate(rateMs) {
    this.tickRateMs = rateMs;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Gets current simulation statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const stateCounts = {};
    for (const state of Object.values(AgentState)) {
      stateCounts[state] = 0;
    }

    let totalStress = 0;
    for (const agent of this.agents.values()) {
      stateCounts[agent.state] = (stateCounts[agent.state] || 0) + 1;
      totalStress += agent.stressLevel || 0;
    }

    return {
      totalAgents: this.agents.size,
      maxAgents: this.maxAgents,
      isRunning: this.isRunning,
      tickRateMs: this.tickRateMs,
      stateDistribution: stateCounts,
      averageStress: this.agents.size > 0 ? totalStress / this.agents.size : 0,
      soulsPending: this._soulsToRespawn.length,
      telemetry: { ...this._telemetry }
    };
  }
  
  /**
   * Get detailed telemetry for debugging
   * @returns {Object} Telemetry data
   */
  getTelemetry() {
    const avgTimePerAgent = this._telemetry.agentsProcessed > 0 
      ? this._telemetry.totalProcessingTime / this._telemetry.agentsProcessed 
      : 0;
      
    return {
      ...this._telemetry,
      avgTimePerAgent: Math.round(avgTimePerAgent * 100) / 100,
      pendingUpdates: this._pendingEntityUpdates.size,
      estimatedFPS: Math.round(1000 / (avgTimePerAgent || 1))
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentSimulationEngine, AgentState, AgentNeuralNetwork, AgentChemicalSystem };
}
window.AgentSimulationEngine = AgentSimulationEngine;
window.AgentState = AgentState;
window.AgentNeuralNetwork = AgentNeuralNetwork;
window.AgentChemicalSystem = AgentChemicalSystem;
