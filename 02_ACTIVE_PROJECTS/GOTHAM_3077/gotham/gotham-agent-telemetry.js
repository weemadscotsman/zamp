/**
 * AgentTelemetry - Debugging and performance monitoring for the agent system
 * Provides real-time statistics, agent inspection, and performance benchmarks
 */

/**
 * Performance metrics collector
 */
class PerformanceMetrics {
  constructor() {
    this.tickTimes = [];
    this.agentCounts = [];
    this.maxSamples = 100;
    this.startTime = performance.now();
  }

  recordTick(duration, agentCount) {
    this.tickTimes.push(duration);
    this.agentCounts.push(agentCount);

    if (this.tickTimes.length > this.maxSamples) {
      this.tickTimes.shift();
      this.agentCounts.shift();
    }
  }

  getAverageTickTime() {
    if (this.tickTimes.length === 0) return 0;
    return this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length;
  }

  getAverageFPS() {
    const avgTick = this.getAverageTickTime();
    return avgTick > 0 ? 1000 / avgTick : 0;
  }

  getAverageAgents() {
    if (this.agentCounts.length === 0) return 0;
    return this.agentCounts.reduce((a, b) => a + b, 0) / this.agentCounts.length;
  }

  getStats() {
    return {
      averageTickTime: Math.round(this.getAverageTickTime() * 100) / 100,
      averageFPS: Math.round(this.getAverageFPS() * 10) / 10,
      averageAgentCount: Math.round(this.getAverageAgents()),
      maxTickTime: Math.round(Math.max(...this.tickTimes, 0) * 100) / 100,
      minTickTime: Math.round(Math.min(...this.tickTimes, Infinity) * 100) / 100,
      uptime: Math.round((performance.now() - this.startTime) / 1000)
    };
  }
}

/**
 * Agent inspection tools
 */
class AgentInspector {
  constructor(simulationEngine) {
    this.engine = simulationEngine;
    this.selectedAgentId = null;
    this.agentHistory = new Map(); // agentId -> array of states
    this.maxHistorySize = 100;
  }

  /**
   * Select an agent for detailed inspection
   */
  selectAgent(agentId) {
    this.selectedAgentId = agentId;
    return this.getAgentDetails(agentId);
  }

  /**
   * Get detailed information about an agent
   */
  getAgentDetails(agentId) {
    const agent = this.engine.getAgent(agentId);
    if (!agent) return null;

    return {
      id: agent.id,
      type: agent.type,
      position: agent.position,
      state: agent.state,
      hp: agent.hp,
      maxHp: agent.maxHp,
      age: Math.round(agent.age * 10) / 10,
      generation: agent.generation,
      
      // Chemicals
      chemicals: agent.chemicalSystem ? agent.chemicalSystem.state : agent.chemicals,
      stressLevel: Math.round(agent.stressLevel * 100) / 100,
      
      // Neural network
      neuralOutputs: agent.neuralNetwork ? agent.neuralNetwork.forward(
        this.engine._prepareNeuralInputs(agent, { resources: {} })
      ) : null,
      
      // Memory
      memoryStats: agent.memory ? agent.memory.getStats() : null,
      
      // Last actions (from history)
      history: this.agentHistory.get(agentId)?.slice(-10) || []
    };
  }

  /**
   * Record agent state for history
   */
  recordAgentState(agent) {
    if (!this.agentHistory.has(agent.id)) {
      this.agentHistory.set(agent.id, []);
    }

    const history = this.agentHistory.get(agent.id);
    history.push({
      timestamp: Date.now(),
      state: agent.state,
      position: { ...agent.position },
      stress: agent.stressLevel,
      hp: agent.hp
    });

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get neural network weights visualization data
   */
  getNeuralVisualization(agentId) {
    const agent = this.engine.getAgent(agentId);
    if (!agent || !agent.neuralNetwork) return null;

    const weights = agent.neuralNetwork.getWeights();
    
    return {
      inputToHidden: weights.weightsIH,
      hiddenToOutput: weights.weightsHO,
      biasH: weights.biasH,
      biasO: weights.biasO,
      
      // Statistics
      stats: {
        ihMean: this._calculateMean(weights.weightsIH.flat()),
        ihStd: this._calculateStd(weights.weightsIH.flat()),
        hoMean: this._calculateMean(weights.weightsHO.flat()),
        hoStd: this._calculateStd(weights.weightsHO.flat())
      }
    };
  }

  _calculateMean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  _calculateStd(arr) {
    if (arr.length === 0) return 0;
    const mean = this._calculateMean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /**
   * Get population statistics
   */
  getPopulationStats() {
    const agents = this.engine.getAllAgents();
    const states = {};
    const types = {};
    const generations = {};
    
    let totalStress = 0;
    let totalHP = 0;
    let totalAge = 0;
    let chemicalSums = { dopamine: 0, stress: 0, hunger: 0, social: 0, curiosity: 0, fatigue: 0 };

    for (const agent of agents) {
      // State distribution
      states[agent.state] = (states[agent.state] || 0) + 1;
      
      // Type distribution
      types[agent.type] = (types[agent.type] || 0) + 1;
      
      // Generation distribution
      generations[agent.generation] = (generations[agent.generation] || 0) + 1;
      
      // Averages
      totalStress += agent.stressLevel || 0;
      totalHP += agent.hp || 0;
      totalAge += agent.age || 0;
      
      // Chemicals
      const chems = agent.chemicalSystem ? agent.chemicalSystem.state : agent.chemicals || {};
      for (const key of Object.keys(chemicalSums)) {
        chemicalSums[key] += chems[key] || 0;
      }
    }

    const count = agents.length;
    
    // Calculate averages
    for (const key of Object.keys(chemicalSums)) {
      chemicalSums[key] = count > 0 ? chemicalSums[key] / count : 0;
    }

    return {
      count,
      stateDistribution: states,
      typeDistribution: types,
      generationDistribution: generations,
      averageStress: count > 0 ? totalStress / count : 0,
      averageHP: count > 0 ? totalHP / count : 0,
      averageAge: count > 0 ? totalAge / count : 0,
      averageChemicals: chemicalSums
    };
  }
}

/**
 * Real-time telemetry dashboard
 */
class AgentTelemetry {
  constructor(simulationEngine) {
    this.engine = simulationEngine;
    this.metrics = new PerformanceMetrics();
    this.inspector = new AgentInspector(simulationEngine);
    this.isRunning = false;
    this.updateInterval = null;
    this.listeners = new Map();
  }

  /**
   * Start telemetry collection
   */
  start(updateRateMs = 1000) {
    if (this.isRunning) return;
    this.isRunning = true;

    // Listen to simulation ticks
    this.engine.on('simulation-tick', (data) => {
      this.metrics.recordTick(data.duration, data.agentCount);
      
      // Record state for all agents
      for (const agent of this.engine.getAllAgents()) {
        this.inspector.recordAgentState(agent);
      }
    });

    // Periodic updates
    this.updateInterval = setInterval(() => {
      this._emit('telemetry-update', this.getFullReport());
    }, updateRateMs);
  }

  /**
   * Stop telemetry collection
   */
  stop() {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get full telemetry report
   */
  getFullReport() {
    return {
      performance: this.metrics.getStats(),
      simulation: this.engine.getStats(),
      population: this.inspector.getPopulationStats(),
      selectedAgent: this.inspector.selectedAgentId ? 
        this.inspector.getAgentDetails(this.inspector.selectedAgentId) : null,
      timestamp: Date.now()
    };
  }

  /**
   * Get performance benchmark results
   */
  getBenchmark() {
    const stats = this.metrics.getStats();
    const targetFPS = 60;
    const targetAgents = 500;
    const currentAgents = this.engine.agents.size;
    
    return {
      // Current performance
      currentFPS: stats.averageFPS,
      currentAgents,
      averageTickTime: stats.averageTickTime,
      
      // Scaling estimates
      estimatedMaxAgents: Math.floor(targetAgents * (targetFPS / Math.max(stats.averageFPS, 1))),
      fpsPerAgent: stats.averageFPS / Math.max(currentAgents, 1),
      msPerAgent: (stats.averageTickTime / Math.max(currentAgents, 1)) * 1000,
      
      // Recommendations
      recommendations: this._generateRecommendations(stats, currentAgents)
    };
  }

  _generateRecommendations(stats, agentCount) {
    const recs = [];
    
    if (stats.averageFPS < 30) {
      recs.push('FPS below 30 - consider reducing tick rate or agent count');
    }
    
    if (agentCount > 400 && stats.averageTickTime > 16) {
      recs.push('High agent count with slow ticks - enable sectorization');
    }
    
    if (stats.maxTickTime > stats.averageTickTime * 3) {
      recs.push('High tick time variance - check for blocking operations');
    }
    
    if (stats.averageTickTime < 5 && agentCount < 300) {
      recs.push('Performance good - can increase agent count');
    }
    
    return recs;
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }

  _emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  /**
   * Export agent evolution data
   */
  exportEvolutionData() {
    const agents = this.engine.getAllAgents();
    const data = {
      timestamp: Date.now(),
      agentCount: agents.length,
      generations: {},
      traits: {}
    };

    for (const agent of agents) {
      const gen = agent.generation || 0;
      if (!data.generations[gen]) {
        data.generations[gen] = { count: 0, avgStress: 0, avgHP: 0 };
      }
      data.generations[gen].count++;
      data.generations[gen].avgStress += agent.stressLevel || 0;
      data.generations[gen].avgHP += agent.hp || 0;
    }

    // Average by count
    for (const gen of Object.values(data.generations)) {
      gen.avgStress /= gen.count;
      gen.avgHP /= gen.count;
    }

    return data;
  }

  /**
   * Run stress test
   */
  async runStressTest(targetAgents = 500, durationMs = 10000) {
    const startCount = this.engine.agents.size;
    const results = {
      startTime: Date.now(),
      targetAgents,
      samples: []
    };

    // Spawn agents gradually
    const spawnInterval = setInterval(() => {
      if (this.engine.agents.size >= targetAgents) {
        clearInterval(spawnInterval);
        return;
      }
      
      // Spawn in random locations
      const lat = (Math.random() - 0.5) * 180;
      const lon = (Math.random() - 0.5) * 360;
      this.engine.spawnAgent('worker', lat, lon);
    }, 10);

    // Collect samples
    const sampleInterval = setInterval(() => {
      results.samples.push({
        time: Date.now() - results.startTime,
        agentCount: this.engine.agents.size,
        tickTime: this.metrics.getAverageTickTime(),
        fps: this.metrics.getAverageFPS()
      });
    }, 1000);

    // End test
    await new Promise(resolve => setTimeout(resolve, durationMs));
    clearInterval(sampleInterval);

    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    results.finalFPS = this.metrics.getAverageFPS();
    results.finalTickTime = this.metrics.getAverageTickTime();

    // Cleanup - remove spawned agents
    const agents = this.engine.getAllAgents();
    for (let i = startCount; i < agents.length; i++) {
      this.engine.removeAgent(agents[i].id);
    }

    return results;
  }
}

if (typeof window !== 'undefined') {
  window.AgentTelemetry = AgentTelemetry;
  window.PerformanceMetrics = PerformanceMetrics;
  window.AgentInspector = AgentInspector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentTelemetry, PerformanceMetrics, AgentInspector };
}
