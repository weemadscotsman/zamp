/**
 * GOTHAM 3077 - Agent Integration Layer v1.0
 * Bridges OmniTown AI agents with real-world Cesium globe
 * Maps agents to geographic coordinates, connects to real data feeds
 */

// Ported agent types from OmniTown
const AGENT_TYPES = {
  WARRIOR: 'warrior',
  TRADER: 'trader',
  THIEF: 'thief',
  MAGE: 'mage',
  WORKER: 'worker',
  BERSERKER: 'berserker'
};

const AGENT_ACTIONS = ['Eat', 'Sleep', 'Socialize', 'Explore', 'Flee', 'Idle'];
const AGENT_INPUTS = ['Hunger', 'Threat', 'Social Need', 'Fatigue', 'Curiosity'];

/**
 * Simplified AgentBrain for geographic context
 */
class GeoAgentBrain {
  constructor(inputSize = 5, hiddenSize = 8, outputSize = 6) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.weightsIH = this._initWeights(inputSize, hiddenSize);
    this.weightsHO = this._initWeights(hiddenSize, outputSize);
  }

  _initWeights(rows, cols) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1))
    );
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  forward(inputs) {
    const hidden = new Array(this.hiddenSize).fill(0);
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = 0;
      for (let i = 0; i < this.inputSize; i++) {
        sum += inputs[i] * this.weightsIH[i][h];
      }
      hidden[h] = this.sigmoid(sum);
    }

    const outputs = new Array(this.outputSize).fill(0);
    for (let o = 0; o < this.outputSize; o++) {
      let sum = 0;
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += hidden[h] * this.weightsHO[h][o];
      }
      outputs[o] = this.sigmoid(sum);
    }

    return { hidden, outputs };
  }

  train(inputs, hidden, chosenAction, reward, lr = 0.1) {
    for (let h = 0; h < this.hiddenSize; h++) {
      const deltaHO = lr * reward * hidden[h];
      this.weightsHO[h][chosenAction] += deltaHO;
      for (let i = 0; i < this.inputSize; i++) {
        const deltaIH = lr * reward * inputs[i] * this.weightsHO[h][chosenAction];
        this.weightsIH[i][h] += deltaIH;
      }
    }
  }

  mutate(rate = 0.05, amount = 0.2) {
    for (let i = 0; i < this.inputSize; i++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        if (Math.random() < rate) this.weightsIH[i][h] += (Math.random() * 2 - 1) * amount;
      }
    }
    for (let h = 0; h < this.hiddenSize; h++) {
      for (let o = 0; o < this.outputSize; o++) {
        if (Math.random() < rate) this.weightsHO[h][o] += (Math.random() * 2 - 1) * amount;
      }
    }
  }

  serialize() {
    return { weightsIH: this.weightsIH, weightsHO: this.weightsHO };
  }

  deserialize(data) {
    if (data.weightsIH) this.weightsIH = data.weightsIH;
    if (data.weightsHO) this.weightsHO = data.weightsHO;
  }
}

/**
 * Chemical state system for agents
 */
class ChemicalSystem {
  constructor() {
    this.state = {
      dopamine: 50,
      stress: 0,
      hunger: 0,
      social: 0,
      curiosity: 50,
      fatigue: 0
    };
  }

  tick() {
    this.state.hunger += 1;
    this.state.social += 0.5;
    this.state.fatigue += 0.5 + (this.state.stress * 0.01);
    this.state.curiosity += 0.5 - (this.state.fatigue * 0.01);
    this.state.stress -= 0.5 + (this.state.dopamine * 0.01);
    this.state.dopamine -= 1;
    this.clamp();
  }

  clamp() {
    Object.keys(this.state).forEach(key => {
      this.state[key] = Math.max(0, Math.min(100, this.state[key]));
    });
  }

  serialize() {
    return this.state;
  }

  deserialize(data) {
    if (data) this.state = { ...this.state, ...data };
  }
}

/**
 * Geographic Agent - AI agent positioned on real-world coordinates
 */
class GeoAgent {
  constructor(id, type, lat, lon, name = null) {
    this.id = id;
    this.type = type;
    this.name = name || `${type}_${id.substring(0, 4)}`;
    this.position = { lat, lon };
    this.target = null;
    this.state = 'IDLE';
    this.age = 0;
    this.generation = 1;
    
    // Chemical state
    this.chemicals = new ChemicalSystem();
    
    // Neural brain
    this.brain = new GeoAgentBrain();
    this.lastInputs = [];
    this.lastHidden = [];
    this.lastOutputs = [];
    this.lastActionIndex = -1;
    
    // Stats
    this.hp = 100;
    this.maxHp = 100;
    this.energy = 100;
    this.twag = Math.floor(Math.random() * 50) + 10;
    this.kills = 0;
    this.deaths = 0;
    this.traits = this._generateTraits();
    this.activityLog = [`Spawned at ${lat.toFixed(2)}, ${lon.toFixed(2)}`];
    
    // Type-specific stats
    this._initTypeStats();
    
    // Movement
    this.speed = 0.0005; // Degrees per tick (roughly 50-100m)
    this.cooldown = 0;
    
    // Entity reference for Cesium
    this.entityId = null;
  }
  
  _generateTraits() {
    const possible = ['Aggressive', 'Cautious', 'Greedy', 'Generous', 'Curious', 'Lazy', 'Energetic', 'Sociable', 'Loner'];
    const traits = [];
    traits.push(possible[Math.floor(Math.random() * possible.length)]);
    let second = possible[Math.floor(Math.random() * possible.length)];
    while (second === traits[0]) second = possible[Math.floor(Math.random() * possible.length)];
    traits.push(second);
    return traits;
  }
  
  _initTypeStats() {
    switch (this.type) {
      case AGENT_TYPES.WARRIOR:
        this.maxHp = 120; this.attack = 15; this.defense = 10; this.speed = 0.0004;
        break;
      case AGENT_TYPES.TRADER:
        this.maxHp = 80; this.attack = 5; this.defense = 5; this.speed = 0.0006; this.twag += 100;
        break;
      case AGENT_TYPES.THIEF:
        this.maxHp = 70; this.attack = 12; this.defense = 3; this.speed = 0.0008;
        break;
      case AGENT_TYPES.MAGE:
        this.maxHp = 50; this.attack = 25; this.defense = 2; this.speed = 0.0003;
        break;
      case AGENT_TYPES.WORKER:
        this.maxHp = 100; this.attack = 8; this.defense = 8; this.speed = 0.0005;
        break;
      case AGENT_TYPES.BERSERKER:
        this.maxHp = 150; this.attack = 20; this.defense = 5; this.speed = 0.0007;
        break;
    }
    this.hp = this.maxHp;
  }
  
  log(msg) {
    this.activityLog.unshift(`[${Math.floor(this.age)}] ${msg}`);
    if (this.activityLog.length > 20) this.activityLog.pop();
  }
  
  tick(envThreat, envReward, nearbyEntities) {
    this.age++;
    this.chemicals.tick();
    if (this.cooldown > 0) this.cooldown--;
    
    // Gather inputs
    const inputs = [
      this.chemicals.state.hunger / 100,
      envThreat,
      this.chemicals.state.social / 100,
      this.chemicals.state.fatigue / 100,
      this.chemicals.state.curiosity / 100
    ];
    
    // Neural forward pass
    const { hidden, outputs } = this.brain.forward(inputs);
    this.lastInputs = inputs;
    this.lastHidden = hidden;
    this.lastOutputs = outputs;
    
    // Action selection with noise
    let chosenAction = 0;
    let maxVal = -Infinity;
    const noiseLevel = (this.chemicals.state.stress / 100) * 0.2 + (this.chemicals.state.curiosity / 100) * 0.1;
    
    for (let i = 0; i < outputs.length; i++) {
      const val = outputs[i] + (Math.random() * noiseLevel);
      if (val > maxVal) {
        maxVal = val;
        chosenAction = i;
      }
    }
    
    this.lastActionIndex = chosenAction;
    const actionName = AGENT_ACTIONS[chosenAction];
    
    // Execute action
    let internalReward = this._executeAction(actionName, nearbyEntities);
    const totalReward = internalReward + envReward;
    
    // Train brain
    this.brain.train(inputs, hidden, chosenAction, totalReward);
    
    // Movement toward target
    if (this.target && this.state !== 'SLEEPING') {
      this._moveTowardTarget();
    }
    
    return {
      action: actionName,
      reward: totalReward,
      position: this.position
    };
  }
  
  _executeAction(action, nearbyEntities) {
    let reward = 0;
    
    switch (action) {
      case 'Eat':
        if (this.chemicals.state.hunger > 50) reward += 10;
        else reward -= 5;
        this.chemicals.state.hunger = 0;
        this.chemicals.state.dopamine += 10;
        this.chemicals.state.fatigue += 5;
        this.log('Ate food');
        break;
        
      case 'Sleep':
        if (this.chemicals.state.fatigue > 50) reward += 10;
        this.chemicals.state.fatigue = 0;
        this.chemicals.state.stress -= 20;
        this.chemicals.state.hunger += 10;
        this.state = 'SLEEPING';
        this.log('Sleeping');
        setTimeout(() => { this.state = 'IDLE'; }, 5000);
        break;
        
      case 'Socialize':
        if (this.chemicals.state.social > 50) reward += 10;
        this.chemicals.state.social = 0;
        this.chemicals.state.dopamine += 15;
        if (nearbyEntities && nearbyEntities.length > 0) {
          this.log(`Socialized with ${nearbyEntities.length} entities`);
        }
        break;
        
      case 'Explore':
        if (this.chemicals.state.curiosity > 50) reward += 10;
        this.chemicals.state.curiosity = 0;
        this.chemicals.state.dopamine += 10;
        // Pick random nearby location
        this.target = {
          lat: this.position.lat + (Math.random() - 0.5) * 0.01,
          lon: this.position.lon + (Math.random() - 0.5) * 0.01
        };
        this.state = 'EXPLORING';
        break;
        
      case 'Flee':
        if (this.chemicals.state.stress > 50) reward += 20;
        this.chemicals.state.stress -= 20;
        this.chemicals.state.fatigue += 15;
        // Run away from current position in random direction
        this.target = {
          lat: this.position.lat + (Math.random() - 0.5) * 0.02,
          lon: this.position.lon + (Math.random() - 0.5) * 0.02
        };
        this.state = 'FLEEING';
        this.speed = Math.min(this.speed * 2, 0.002);
        break;
        
      case 'Idle':
        this.chemicals.state.fatigue -= 5;
        this.chemicals.state.curiosity += 5;
        this.state = 'IDLE';
        this.target = null;
        break;
    }
    
    this.chemicals.clamp();
    return reward;
  }
  
  _moveTowardTarget() {
    if (!this.target) return;
    
    const dLat = this.target.lat - this.position.lat;
    const dLon = this.target.lon - this.position.lon;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    
    if (dist < 0.0001) {
      this.state = 'IDLE';
      this.target = null;
      return;
    }
    
    this.position.lat += (dLat / dist) * this.speed;
    this.position.lon += (dLon / dist) * this.speed;
  }
  
  // Real-world data interaction
  checkEnvironmentalThreats(weatherData, trafficData) {
    let threat = 0;
    
    // Weather threat
    if (weatherData) {
      if (weatherData.windSpeed > 80) threat += 0.3;
      if (weatherData.temp < -20) threat += 0.2;
      if (weatherData.precipitation > 50) threat += 0.1;
    }
    
    // Traffic threat (for traders/workers)
    if (this.type === AGENT_TYPES.TRADER || this.type === AGENT_TYPES.WORKER) {
      if (trafficData && trafficData.congestion > 0.8) threat += 0.2;
    }
    
    return Math.min(threat, 1.0);
  }
  
  checkRewards(nearbyPOIs) {
    let reward = 0;
    
    // Traders get reward near commercial areas
    if (this.type === AGENT_TYPES.TRADER && nearbyPOIs) {
      const shops = nearbyPOIs.filter(p => p.type === 'shop');
      reward += shops.length * 5;
    }
    
    // Warriors get reward near conflict
    if (this.type === AGENT_TYPES.WARRIOR) {
      reward += this.kills * 10;
    }
    
    return reward;
  }
  
  save() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      generation: this.generation,
      position: this.position,
      traits: this.traits,
      chemicals: this.chemicals.serialize(),
      brain: this.brain.serialize(),
      stats: {
        hp: this.hp,
        maxHp: this.maxHp,
        attack: this.attack || 10,
        defense: this.defense || 5,
        kills: this.kills,
        deaths: this.deaths,
        twag: this.twag
      }
    };
  }
  
  load(data) {
    if (!data) return;
    this.generation = (data.generation || 0) + 1;
    this.traits = data.traits || this.traits;
    if (data.chemicals) this.chemicals.deserialize(data.chemicals);
    if (data.brain) this.brain.deserialize(data.brain);
    if (data.stats) {
      this.hp = data.stats.hp || this.hp;
      this.maxHp = data.stats.maxHp || this.maxHp;
      this.kills = data.stats.kills || 0;
      this.deaths = data.stats.deaths || 0;
      this.twag = data.stats.twag || this.twag;
    }
    this.log(`Reborn as Gen ${this.generation}`);
  }
}

/**
 * Agent Manager - Manages all agents on the globe
 */
class GothamAgentManager {
  constructor(viewer, entitySystem) {
    this.viewer = viewer;
    this.entitySystem = entitySystem;
    this.agents = new Map();
    this.tickRate = 1000; // 1 second
    this.maxAgents = 50;
    
    // Agent icons (will be generated)
    this.icons = {};
    this._generateIcons();
    
    this._startTicking();
    console.log('[AGENT MANAGER] Geo-agent system initialized');
  }
  
  _generateIcons() {
    // Generate colored dots for each agent type
    Object.values(AGENT_TYPES).forEach(type => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      
      const colors = {
        warrior: '#ff4444',
        trader: '#44ff44',
        thief: '#ffaa00',
        mage: '#aa44ff',
        worker: '#44aaff',
        berserker: '#ff0088'
      };
      
      ctx.fillStyle = colors[type] || '#ffffff';
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      this.icons[type] = canvas.toDataURL();
    });
  }
  
  _startTicking() {
    setInterval(() => this._tickAll(), this.tickRate);
  }
  
  _tickAll() {
    const nearbyData = this._getNearbyRealWorldData();
    
    this.agents.forEach((agent, id) => {
      // Check environmental conditions
      const threat = agent.checkEnvironmentalThreats(
        nearbyData.weather,
        nearbyData.traffic
      );
      
      // Check for rewards
      const reward = agent.checkRewards(nearbyData.pois);
      
      // Get nearby entities for social
      const nearby = this._getNearbyAgents(agent);
      
      // Tick the agent
      const result = agent.tick(threat, reward, nearby);
      
      // Update Cesium entity position
      this._updateEntityPosition(agent);
      
      // Check for agent death and respawn
      if (agent.hp <= 0) {
        this._respawnAgent(agent);
      }
    });
  }
  
  _getNearbyRealWorldData() {
    // Get data from entity system
    const data = {
      weather: null,
      traffic: null,
      pois: []
    };
    
    if (this.entitySystem && this.entitySystem.dataCache) {
      const cache = this.entitySystem.dataCache;
      if (cache.weather && cache.weather.length > 0) {
        data.weather = cache.weather[0];
      }
      if (cache.traffic) {
        const total = cache.traffic.length;
        data.traffic = { congestion: Math.min(total / 100, 1.0), count: total };
      }
    }
    
    return data;
  }
  
  _getNearbyAgents(agent) {
    const nearby = [];
    this.agents.forEach((other, id) => {
      if (id === agent.id) return;
      const dist = this._haversine(
        agent.position.lat, agent.position.lon,
        other.position.lat, other.position.lon
      );
      if (dist < 0.5) nearby.push(other); // Within 500m
    });
    return nearby;
  }
  
  _updateEntityPosition(agent) {
    if (!agent.entityId) {
      // Create new entity
      const id = `agent-${agent.id}`;
      const entity = new Cesium.Entity({
        id: id,
        position: new Cesium.CallbackProperty(() => {
          return Cesium.Cartesian3.fromDegrees(
            agent.position.lon,
            agent.position.lat,
            100
          );
        }, false),
        billboard: {
          image: this.icons[agent.type],
          scale: 0.8,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: 3000
        },
        label: {
          text: agent.name,
          font: '10px "Share Tech Mono"',
          fillColor: Cesium.Color.WHITE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: 3000
        }
      });
      
      this.viewer.entities.add(entity);
      agent.entityId = id;
    }
    
    // Update label with state
    const entity = this.viewer.entities.getById(agent.entityId);
    if (entity && entity.label) {
      entity.label.text = `${agent.name} [${agent.state}]`;
    }
  }
  
  spawnAgent(type, lat, lon, name = null) {
    if (this.agents.size >= this.maxAgents) {
      console.warn('[AGENT MANAGER] Max agents reached');
      return null;
    }
    
    const id = Math.random().toString(36).substring(2, 9);
    const agent = new GeoAgent(id, type, lat, lon, name);
    this.agents.set(id, agent);
    
    console.log(`[AGENT MANAGER] Spawned ${agent.name} at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    return agent;
  }
  
  spawnAgentCluster(count, centerLat, centerLon, radiusKm = 5) {
    const types = Object.values(AGENT_TYPES);
    const spawned = [];
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      // Random position within radius
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (radiusKm / 111); // Convert km to degrees
      const lat = centerLat + Math.sin(angle) * dist;
      const lon = centerLon + Math.cos(angle) * dist / Math.cos(centerLat * Math.PI / 180);
      
      const agent = this.spawnAgent(type, lat, lon);
      if (agent) spawned.push(agent);
    }
    
    return spawned;
  }
  
  _respawnAgent(agent) {
    const soul = agent.save();
    
    // Remove old entity
    if (agent.entityId) {
      const entity = this.viewer.entities.getById(agent.entityId);
      if (entity) this.viewer.entities.remove(entity);
    }
    
    // Create new agent at same location
    const newAgent = new GeoAgent(
      agent.id,
      agent.type,
      agent.position.lat,
      agent.position.lon,
      agent.name
    );
    newAgent.load(soul);
    newAgent.deaths++;
    
    this.agents.set(agent.id, newAgent);
    console.log(`[AGENT MANAGER] ${newAgent.name} respawned as Gen ${newAgent.generation}`);
  }
  
  removeAgent(id) {
    const agent = this.agents.get(id);
    if (agent && agent.entityId) {
      const entity = this.viewer.entities.getById(agent.entityId);
      if (entity) this.viewer.entities.remove(entity);
    }
    this.agents.delete(id);
  }
  
  getAgent(id) {
    return this.agents.get(id);
  }
  
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  
  getAgentsByType(type) {
    return this.getAllAgents().filter(a => a.type === type);
  }
  
  // External interaction API
  praise(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.chemicals.state.dopamine = Math.min(100, agent.chemicals.state.dopamine + 30);
      agent.chemicals.state.stress = Math.max(0, agent.chemicals.state.stress - 20);
      agent.log('Praised by Overseer');
    }
  }
  
  punish(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.chemicals.state.stress = Math.min(100, agent.chemicals.state.stress + 40);
      agent.chemicals.state.dopamine = Math.max(0, agent.chemicals.state.dopamine - 20);
      agent.log('Punished by Overseer');
    }
  }
  
  feed(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.chemicals.state.hunger = 0;
      agent.chemicals.state.dopamine = Math.min(100, agent.chemicals.state.dopamine + 10);
      agent.log('Fed by Overseer');
    }
  }
  
  scare(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.chemicals.state.stress = 100;
      agent._executeAction('Flee', []);
      agent.log('Terrified by Overseer');
    }
  }
  
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  exportStats() {
    const stats = {
      total: this.agents.size,
      byType: {},
      byState: {},
      totalTwag: 0,
      totalKills: 0
    };
    
    this.agents.forEach(agent => {
      stats.byType[agent.type] = (stats.byType[agent.type] || 0) + 1;
      stats.byState[agent.state] = (stats.byState[agent.state] || 0) + 1;
      stats.totalTwag += agent.twag;
      stats.totalKills += agent.kills;
    });
    
    return stats;
  }
}

window.GothamAgentManager = GothamAgentManager;
window.GeoAgent = GeoAgent;
window.AGENT_TYPES = AGENT_TYPES;
