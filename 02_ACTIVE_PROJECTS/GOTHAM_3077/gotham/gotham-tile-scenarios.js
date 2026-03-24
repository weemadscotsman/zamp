/**
 * GOTHAM 3077 - Tile World Scenario Bridge v1.0
 * Connects Scenario Engine disasters to Tile World agents
 * Earthquakes, power outages, viral outbreaks affect agents directly
 */

class TileScenarioBridge {
  constructor(tileWorld, scenarioEngine, eventBus) {
    this.tileWorld = tileWorld;
    this.scenarioEngine = scenarioEngine;
    this.eventBus = eventBus || window.gothamEventBus;
    this.activeEffects = new Map();
    
    this._setupEventListeners();
    console.log('[TileScenarioBridge] Connected to scenario engine');
  }
  
  _setupEventListeners() {
    // Listen for scenario events
    this.eventBus.on('SCEN_TRIGGER', (data) => {
      this._handleScenarioTrigger(data);
    });
    
    this.eventBus.on('SCEN_EFFECT', (data) => {
      this._handleScenarioEffect(data);
    });
    
    // Specific disaster events
    this.eventBus.on('AGENT_PANIC', (data) => {
      this._triggerAgentPanic(data);
    });
    
    this.eventBus.on('BUILDING_DAMAGE', (data) => {
      this._damageBuildings(data);
    });
    
    this.eventBus.on('SPAWN_DEBRIS', (data) => {
      this._spawnDebris(data);
    });
    
    this.eventBus.on('AGENT_INFECT', (data) => {
      this._infectAgents(data);
    });
    
    this.eventBus.on('COVERAGE_GAP', (data) => {
      this._communicationBlackout(data);
    });
    
    this.eventBus.on('ECONOMIC_SHOCK', (data) => {
      this._economicCrisis(data);
    });
  }
  
  /**
   * Handle scenario trigger
   */
  _handleScenarioTrigger(data) {
    const { scenarioId, triggerId, triggerName } = data;
    console.log(`[TileScenarioBridge] Scenario ${scenarioId}: ${triggerName}`);
    
    // Flash screen edge red for critical events
    if (triggerName.includes('Impact') || triggerName.includes('Cascade')) {
      this._flashAlert('critical');
    }
  }
  
  /**
   * Handle scenario effect
   */
  _handleScenarioEffect(data) {
    const { type, scenario, ...params } = data;
    
    switch (type) {
      case 'EARTHQUAKE':
        this._earthquake(params);
        break;
      case 'POWER_OUTAGE':
        this._powerOutage(params);
        break;
      case 'TRAFFIC_COLLAPSE':
        this._trafficCollapse(params);
        break;
      case 'CYBER_ATTACK':
        this._cyberAttack(params);
        break;
    }
  }
  
  /**
   * EARTHQUAKE: Agents panic, buildings damaged, some agents die
   */
  _earthquake(params = {}) {
    const { magnitude = 5.0, epicenter } = params;
    const severity = magnitude > 7 ? 'critical' : magnitude > 5 ? 'high' : 'medium';
    
    console.log(`[TileScenarioBridge] EARTHQUAKE M${magnitude} in tile world!`);
    
    // Shake effect on canvas
    this._shakeScreen(1000, severity);
    
    // Affect agents
    for (const agent of this.tileWorld.agents) {
      // All agents panic
      agent.chemicals.stress = 100;
      agent.chemicals.dopamine -= 30;
      agent.state = 'fleeing';
      
      // Chance of injury based on severity
      const injuryChance = severity === 'critical' ? 0.3 : severity === 'high' ? 0.15 : 0.05;
      if (Math.random() < injuryChance) {
        agent.hp -= Math.floor(Math.random() * 50) + 20;
        agent.memory.push({
          type: 'injured_in_earthquake',
          magnitude,
          timestamp: Date.now()
        });
      }
      
      // Chance of death (rare)
      if (severity === 'critical' && Math.random() < 0.05) {
        agent.hp = 0;
        this._createTombstone(agent);
      }
    }
    
    // Spawn rubble/debris tiles
    this._spawnRubble(Math.floor(magnitude * 2));
    
    // Aftershock warning
    if (severity === 'critical') {
      setTimeout(() => {
        this._aftershock(magnitude * 0.7);
      }, 30000); // 30 seconds later
    }
    
    // Emit to HUD
    this.eventBus.emit('TILEWORLD_EVENT', {
      type: 'earthquake',
      magnitude,
      severity,
      affectedAgents: this.tileWorld.agents.length
    });
  }
  
  /**
   * Aftershock (weaker earthquake)
   */
  _aftershock(magnitude) {
    console.log(`[TileScenarioBridge] AFTERSHOCK M${magnitude.toFixed(1)}!`);
    this._shakeScreen(500, 'low');
    
    for (const agent of this.tileWorld.agents) {
      agent.chemicals.stress = Math.min(100, agent.chemicals.stress + 20);
    }
  }
  
  /**
   * POWER OUTAGE: Buildings dark, agents confused, economy stops
   */
  _powerOutage(params = {}) {
    const { duration = 300000 } = params; // 5 minutes default
    
    console.log('[TileScenarioBridge] POWER OUTAGE in tile world!');
    
    // Darken canvas
    this.tileWorld.powerOutage = true;
    
    // Agents confused (can't work)
    for (const agent of this.tileWorld.agents) {
      if (agent.class === 'worker') {
        agent.state = 'idle';
        agent.chemicals.curiosity -= 10;
      }
      agent.chemicals.stress += 15;
    }
    
    // Restore power after duration
    setTimeout(() => {
      this.tileWorld.powerOutage = false;
      console.log('[TileScenarioBridge] Power restored');
      
      this.eventBus.emit('TILEWORLD_EVENT', {
        type: 'power_restored',
        timestamp: Date.now()
      });
    }, duration);
    
    this.eventBus.emit('TILEWORLD_EVENT', {
      type: 'power_outage',
      duration,
      affectedAgents: this.tileWorld.agents.filter(a => a.class === 'worker').length
    });
  }
  
  /**
   * TRAFFIC COLLAPSE: Agents stuck, can't move efficiently
   */
  _trafficCollapse(params = {}) {
    console.log('[TileScenarioBridge] TRAFFIC COLLAPSE in tile world!');
    
    // Mark tiles as congested
    this.tileWorld.trafficJam = true;
    
    // All agents frustrated
    for (const agent of this.tileWorld.agents) {
      agent.chemicals.stress = Math.min(100, agent.chemicals.stress + 40);
      agent.chemicals.dopamine -= 20;
      
      // Slow down movement
      agent.moveSpeed = 0.5;
    }
    
    // Clear after 2 minutes
    setTimeout(() => {
      this.tileWorld.trafficJam = false;
      for (const agent of this.tileWorld.agents) {
        agent.moveSpeed = 1.0;
      }
    }, 120000);
  }
  
  /**
   * CYBER ATTACK: GitHub/building systems down, traders can't trade
   */
  _cyberAttack(params = {}) {
    console.log('[TileScenarioBridge] CYBER ATTACK in tile world!');
    
    // Trading posts shut down
    this.tileWorld.cyberAttack = true;
    
    // Traders and thieves affected
    for (const agent of this.tileWorld.agents) {
      if (agent.class === 'trader' || agent.class === 'thief') {
        agent.canTrade = false;
        agent.chemicals.stress += 25;
        agent.state = 'confused';
      }
    }
    
    // Restore after 3 minutes
    setTimeout(() => {
      this.tileWorld.cyberAttack = false;
      for (const agent of this.tileWorld.agents) {
        agent.canTrade = true;
      }
    }, 180000);
  }
  
  /**
   * VIRAL OUTBREAK: Agents get sick, spread disease
   */
  _infectAgents(params = {}) {
    const { count = 1 } = params;
    
    // Infect random agents
    for (let i = 0; i < count; i++) {
      if (this.tileWorld.agents.length > 0) {
        const agent = this.tileWorld.agents[Math.floor(Math.random() * this.tileWorld.agents.length)];
        agent.infected = true;
        agent.infectionTime = Date.now();
        agent.chemicals.stress += 30;
        
        console.log(`[TileScenarioBridge] Agent ${agent.id} infected!`);
      }
    }
    
    // Start spread loop
    this._startInfectionSpread();
  }
  
  /**
   * Disease spread simulation
   */
  _startInfectionSpread() {
    const spreadInterval = setInterval(() => {
      const infected = this.tileWorld.agents.filter(a => a.infected);
      const healthy = this.tileWorld.agents.filter(a => !a.infected && !a.immune);
      
      // Spread to nearby healthy agents
      for (const sick of infected) {
        for (const healthy of this.tileWorld.agents) {
          if (!healthy.infected && !healthy.immune) {
            const dist = this._distance(sick, healthy);
            if (dist < 50 && Math.random() < 0.1) { // 10% chance if close
              healthy.infected = true;
              healthy.infectionTime = Date.now();
              console.log(`[TileScenarioBridge] Agent ${healthy.id} infected!`);
            }
          }
        }
        
        // Agent dies or recovers after 60 seconds
        if (Date.now() - sick.infectionTime > 60000) {
          if (Math.random() < 0.1) {
            // 10% death rate
            sick.hp = 0;
          } else {
            // Recovery
            sick.infected = false;
            sick.immune = true;
          }
        }
      }
      
      // Stop if no more infected
      if (infected.length === 0) {
        clearInterval(spreadInterval);
      }
    }, 5000);
  }
  
  /**
   * AGENT PANIC: All agents flee randomly
   */
  _triggerAgentPanic(params = {}) {
    const { severity = 'medium', radius = 100 } = params;
    
    console.log(`[TileScenarioBridge] AGENT PANIC (${severity})!`);
    
    for (const agent of this.tileWorld.agents) {
      agent.chemicals.stress = 100;
      agent.chemicals.adrenaline = 100;
      agent.state = 'panicking';
      
      // Flee in random direction
      agent.targetX = agent.x + (Math.random() - 0.5) * radius;
      agent.targetY = agent.y + (Math.random() - 0.5) * radius;
    }
  }
  
  /**
   * BUILDING DAMAGE: Destroy buildings, agents near buildings hurt
   */
  _damageBuildings(params = {}) {
    const { severity = 'medium' } = params;
    
    // Find building tiles and damage them
    for (let y = 0; y < this.tileWorld.tilesY; y++) {
      for (let x = 0; x < this.tileWorld.tilesX; x++) {
        const tile = this.tileWorld.tiles[y][x];
        if (tile.type === 'building') {
          tile.damaged = true;
          tile.hp = (tile.hp || 100) - (severity === 'critical' ? 80 : 40);
          
          // Agents near damaged building get hurt
          for (const agent of this.tileWorld.agents) {
            const dist = Math.sqrt(
              Math.pow(agent.x - x * this.tileWorld.tileSize, 2) +
              Math.pow(agent.y - y * this.tileWorld.tileSize, 2)
            );
            if (dist < 50) {
              agent.hp -= 20;
            }
          }
        }
      }
    }
  }
  
  /**
   * SPAWN DEBRIS: Add rubble/obstacle tiles
   */
  _spawnDebris(params = {}) {
    const { count = 10 } = params;
    
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * this.tileWorld.tilesX);
      const y = Math.floor(Math.random() * this.tileWorld.tilesY);
      
      if (this.tileWorld.tiles[y] && this.tileWorld.tiles[y][x]) {
        this.tileWorld.tiles[y][x].type = 'debris';
        this.tileWorld.tiles[y][x].passable = false;
      }
    }
  }
  
  /**
   * Create tombstone for dead agent
   */
  _createTombstone(agent) {
    const tx = Math.floor(agent.x / this.tileWorld.tileSize);
    const ty = Math.floor(agent.y / this.tileWorld.tileSize);
    
    if (this.tileWorld.tiles[ty] && this.tileWorld.tiles[ty][tx]) {
      this.tileWorld.tiles[ty][tx].tombstone = {
        agentName: agent.id,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Communication blackout (satellites down)
   */
  _communicationBlackout(params = {}) {
    console.log('[TileScenarioBridge] Communication blackout!');
    
    // Agents can't communicate (no social actions)
    for (const agent of this.tileWorld.agents) {
      agent.canCommunicate = false;
    }
    
    // Restore after duration
    const duration = params.duration || 300000;
    setTimeout(() => {
      for (const agent of this.tileWorld.agents) {
        agent.canCommunicate = true;
      }
    }, duration);
  }
  
  /**
   * Economic crisis (TWAG value crashes)
   */
  _economicCrisis(params = {}) {
    const { magnitude = 0.2 } = params;
    
    console.log(`[TileScenarioBridge] Economic crisis! -${(magnitude * 100).toFixed(0)}%`);
    
    // All agents lose wealth
    for (const agent of this.tileWorld.agents) {
      agent.twag = Math.floor(agent.twag * (1 - magnitude));
      agent.chemicals.stress += 30;
    }
    
    // Prices spike
    this.tileWorld.economicCrisis = true;
    this.tileWorld.priceMultiplier = 2.0;
    
    // Recovery after 5 minutes
    setTimeout(() => {
      this.tileWorld.economicCrisis = false;
      this.tileWorld.priceMultiplier = 1.0;
    }, 300000);
  }
  
  /**
   * Screen shake effect
   */
  _shakeScreen(duration, severity) {
    const intensity = severity === 'critical' ? 10 : severity === 'high' ? 5 : 2;
    const startTime = Date.now();
    
    const shake = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        this.tileWorld.shakeOffset = { x: dx, y: dy };
        requestAnimationFrame(shake);
      } else {
        this.tileWorld.shakeOffset = { x: 0, y: 0 };
      }
    };
    
    shake();
  }
  
  /**
   * Flash alert border
   */
  _flashAlert(severity) {
    const color = severity === 'critical' ? '#ff0000' : '#ffaa00';
    this.tileWorld.alertFlash = color;
    
    setTimeout(() => {
      this.tileWorld.alertFlash = null;
    }, 3000);
  }
  
  /**
   * Distance between two agents
   */
  _distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  }
  
  /**
   * Get current disaster status
   */
  getStatus() {
    return {
      powerOutage: this.tileWorld.powerOutage,
      trafficJam: this.tileWorld.trafficJam,
      cyberAttack: this.tileWorld.cyberAttack,
      economicCrisis: this.tileWorld.economicCrisis,
      infectedCount: this.tileWorld.agents.filter(a => a.infected).length,
      deadCount: this.tileWorld.agents.filter(a => a.hp <= 0).length
    };
  }
}

// Expose
window.TileScenarioBridge = TileScenarioBridge;
console.log('[TileScenarioBridge] v1.0 loaded');
