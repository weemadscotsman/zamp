/**
 * GOTHAM 3077 - Scenario Engine v1.0
 * "What-if" disaster and event simulation system
 */

class ScenarioEngine {
  constructor(options = {}) {
    this.eventBus = options.eventBus || window.gothamEventBus;
    this.worldState = options.worldState || null;
    this.activeScenarios = new Map();
    this.scenarioHistory = [];
    this.isRunning = false;
    
    // Built-in scenarios
    this.scenarioTemplates = new Map([
      ['satellite_collision', this._satelliteCollisionScenario()],
      ['traffic_collapse', this._trafficCollapseScenario()],
      ['power_outage', this._powerOutageScenario()],
      ['cyber_attack', this._cyberAttackScenario()],
      ['earthquake', this._earthquakeScenario()],
      ['viral_outbreak', this._viralOutbreakScenario()],
      ['solar_flare', this._solarFlareScenario()],
      ['kessler_syndrome', this._kesslerSyndromeScenario()]
    ]);
    
    // Bind methods
    this.tick = this.tick.bind(this);
  }
  
  /**
   * Start scenario engine
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._tickLoop();
    console.log('[ScenarioEngine] Started');
  }
  
  /**
   * Stop scenario engine
   */
  stop() {
    this.isRunning = false;
  }
  
  /**
   * Main tick loop
   */
  _tickLoop() {
    if (!this.isRunning) return;
    this.tick();
    setTimeout(() => this._tickLoop(), 1000);
  }
  
  /**
   * Process one tick
   */
  tick() {
    const now = Date.now();
    
    for (const [scenarioId, scenario] of this.activeScenarios) {
      // Check triggers
      this._checkTriggers(scenario, now);
      
      // Apply ongoing effects
      this._applyEffects(scenario);
      
      // Check end conditions
      if (this._checkEndConditions(scenario, now)) {
        this.endScenario(scenarioId);
      }
    }
  }
  
  /**
   * Load and start a scenario
   */
  loadScenario(scenarioType, options = {}) {
    const template = this.scenarioTemplates.get(scenarioType);
    if (!template) {
      console.error(`[ScenarioEngine] Unknown scenario type: ${scenarioType}`);
      return null;
    }
    
    const scenarioId = `scen-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const scenario = {
      ...template,
      id: scenarioId,
      type: scenarioType,
      status: 'active',
      startTime: Date.now(),
      options,
      data: {}, // Runtime data
      triggered: new Set()
    };
    
    this.activeScenarios.set(scenarioId, scenario);
    
    // Emit start event
    this.eventBus.emit('SCEN_START', {
      scenarioId,
      type: scenarioType,
      name: scenario.name,
      description: scenario.description
    });
    
    console.log(`[ScenarioEngine] Started: ${scenario.name} (${scenarioId})`);
    return scenarioId;
  }
  
  /**
   * End a scenario
   */
  endScenario(scenarioId) {
    const scenario = this.activeScenarios.get(scenarioId);
    if (!scenario) return;
    
    scenario.status = 'ended';
    scenario.endTime = Date.now();
    
    // Move to history
    this.activeScenarios.delete(scenarioId);
    this.scenarioHistory.push(scenario);
    
    // Keep only last 50
    if (this.scenarioHistory.length > 50) {
      this.scenarioHistory.shift();
    }
    
    // Emit end event
    this.eventBus.emit('SCEN_END', {
      scenarioId,
      type: scenario.type,
      duration: scenario.endTime - scenario.startTime,
      effects: Array.from(scenario.triggered)
    });
    
    console.log(`[ScenarioEngine] Ended: ${scenario.name}`);
  }
  
  /**
   * Check scenario triggers
   */
  _checkTriggers(scenario, now) {
    for (const trigger of scenario.triggers) {
      if (scenario.triggered.has(trigger.id)) continue;
      
      let shouldTrigger = false;
      
      switch (trigger.type) {
        case 'TIME':
          const elapsed = now - scenario.startTime;
          shouldTrigger = elapsed >= trigger.value;
          break;
          
        case 'RANDOM':
          shouldTrigger = Math.random() < trigger.value;
          break;
          
        case 'EVENT':
          // Check if specific event occurred
          // (Would need event history integration)
          break;
          
        case 'CONDITION':
          // Check world state condition
          shouldTrigger = this._checkCondition(trigger.condition);
          break;
      }
      
      if (shouldTrigger) {
        scenario.triggered.add(trigger.id);
        this._executeTriggerActions(scenario, trigger);
      }
    }
  }
  
  /**
   * Execute trigger actions
   */
  _executeTriggerActions(scenario, trigger) {
    for (const action of trigger.actions) {
      this._executeAction(scenario, action);
    }
    
    this.eventBus.emit('SCEN_TRIGGER', {
      scenarioId: scenario.id,
      triggerId: trigger.id,
      triggerName: trigger.name
    });
  }
  
  /**
   * Execute single action
   */
  _executeAction(scenario, action) {
    switch (action.type) {
      case 'SPAWN_DEBRIS':
        this.eventBus.emit('SPAWN_ENTITY', {
          type: 'debris',
          count: action.count || 100,
          scenario: scenario.id
        });
        break;
        
      case 'DESTROY_SATELLITE':
        this.eventBus.emit('DESTROY_SATELLITE', {
          target: action.target || 'random',
          count: action.count || 1,
          scenario: scenario.id
        });
        break;
        
      case 'AGENT_PANIC':
        this.eventBus.emit('AGENT_PANIC', {
          severity: action.severity || 'medium',
          radius: action.radius || 100,
          scenario: scenario.id
        });
        break;
        
      case 'COVERAGE_GAP':
        this.eventBus.emit('COV_GAP', {
          duration: action.duration || '1h',
          region: action.region || 'random',
          scenario: scenario.id
        });
        break;
        
      case 'BUILDING_DAMAGE':
        this.eventBus.emit('BUILDING_DAMAGE', {
          building: action.building || 'random',
          severity: action.severity || 'medium',
          scenario: scenario.id
        });
        break;
        
      case 'GITHUB_OUTAGE':
        this.eventBus.emit('GITHUB_OUTAGE', {
          duration: action.duration || '30m',
          repos: action.repos || [],
          scenario: scenario.id
        });
        break;
        
      case 'ECONOMIC_SHOCK':
        this.eventBus.emit('ECONOMIC_SHOCK', {
          magnitude: action.magnitude || 0.2,
          type: action.shockType || 'crash',
          scenario: scenario.id
        });
        break;
    }
  }
  
  /**
   * Apply ongoing effects
   */
  _applyEffects(scenario) {
    for (const effect of scenario.ongoingEffects || []) {
      // Apply based on interval
      const now = Date.now();
      const lastApplied = effect.lastApplied || 0;
      
      if (now - lastApplied >= (effect.interval || 5000)) {
        this._executeAction(scenario, effect);
        effect.lastApplied = now;
      }
    }
  }
  
  /**
   * Check end conditions
   */
  _checkEndConditions(scenario, now) {
    if (!scenario.endConditions) return false;
    
    for (const condition of scenario.endConditions) {
      switch (condition.type) {
        case 'TIME_LIMIT':
          if (now - scenario.startTime >= condition.value) return true;
          break;
          
        case 'ALL_TRIGGERS':
          if (scenario.triggered.size >= scenario.triggers.length) return true;
          break;
          
        case 'CONDITION':
          if (this._checkCondition(condition.condition)) return true;
          break;
      }
    }
    
    return false;
  }
  
  /**
   * Check world condition
   */
  _checkCondition(condition) {
    // Would integrate with world state
    return false;
  }
  
  // ============== SCENARIO TEMPLATES ==============
  
  _satelliteCollisionScenario() {
    return {
      name: 'Satellite Collision',
      description: 'Two satellites collide, creating debris field',
      triggers: [
        { id: 'collision', type: 'TIME', value: 5000, name: 'Impact', actions: [
          { type: 'DESTROY_SATELLITE', target: 'random', count: 2 },
          { type: 'SPAWN_DEBRIS', count: 500 }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 60000 }]
    };
  }
  
  _trafficCollapseScenario() {
    return {
      name: 'Traffic Gridlock',
      description: 'Major city experiences complete traffic collapse',
      triggers: [
        { id: 'jam', type: 'TIME', value: 0, name: 'Gridlock', actions: [
          { type: 'AGENT_PANIC', severity: 'low', radius: 50 }
        ]},
        { id: 'spread', type: 'TIME', value: 30000, name: 'Spread', actions: [
          { type: 'AGENT_PANIC', severity: 'high', radius: 100 }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 120000 }]
    };
  }
  
  _powerOutageScenario() {
    return {
      name: 'Power Outage',
      description: 'Regional blackout affects city infrastructure',
      triggers: [
        { id: 'blackout', type: 'TIME', value: 0, name: 'Blackout', actions: [
          { type: 'COVERAGE_GAP', duration: '2h', region: 'city' },
          { type: 'AGENT_PANIC', severity: 'medium', radius: 75 }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 300000 }]
    };
  }
  
  _cyberAttackScenario() {
    return {
      name: 'Cyber Attack',
      description: 'GitHub infrastructure compromised',
      triggers: [
        { id: 'breach', type: 'TIME', value: 0, name: 'Breach', actions: [
          { type: 'GITHUB_OUTAGE', duration: '1h', repos: ['major'] }
        ]},
        { id: 'spread', type: 'TIME', value: 60000, name: 'Propagation', actions: [
          { type: 'GITHUB_OUTAGE', duration: '2h', repos: ['all'] },
          { type: 'ECONOMIC_SHOCK', magnitude: 0.3, shockType: 'crash' }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 600000 }]
    };
  }
  
  _earthquakeScenario() {
    return {
      name: 'Earthquake',
      description: 'Seismic event damages buildings and infrastructure',
      triggers: [
        { id: 'quake', type: 'TIME', value: 0, name: 'Impact', actions: [
          { type: 'BUILDING_DAMAGE', severity: 'high', building: 'random' },
          { type: 'AGENT_PANIC', severity: 'high', radius: 200 }
        ]},
        { id: 'aftershock', type: 'TIME', value: 45000, name: 'Aftershock', actions: [
          { type: 'BUILDING_DAMAGE', severity: 'medium', building: 'damaged' }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 300000 }]
    };
  }
  
  _viralOutbreakScenario() {
    return {
      name: 'Viral Outbreak',
      description: 'Agents become infected and spread disease',
      triggers: [
        { id: 'patient_zero', type: 'TIME', value: 0, name: 'Patient Zero', actions: [
          { type: 'AGENT_INFECT', count: 1 }
        ]}
      ],
      ongoingEffects: [
        { type: 'SPREAD_INFECTION', interval: 10000 }
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 600000 }]
    };
  }
  
  _solarFlareScenario() {
    return {
      name: 'Solar Flare',
      description: 'Geomagnetic storm disrupts satellites',
      triggers: [
        { id: 'flare', type: 'TIME', value: 0, name: 'Impact', actions: [
          { type: 'COVERAGE_GAP', duration: '6h', region: 'polar' }
        ]},
        { id: 'sat_damage', type: 'TIME', value: 120000, name: 'Satellite Damage', actions: [
          { type: 'DESTROY_SATELLITE', target: 'random', count: 3 }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 86400000 }]
    };
  }
  
  _kesslerSyndromeScenario() {
    return {
      name: 'Kessler Syndrome',
      description: 'Cascading satellite collisions create debris belt',
      triggers: [
        { id: 'initial', type: 'TIME', value: 0, name: 'Initial Collision', actions: [
          { type: 'DESTROY_SATELLITE', count: 5 },
          { type: 'SPAWN_DEBRIS', count: 2000 }
        ]},
        { id: 'cascade1', type: 'TIME', value: 60000, name: 'Cascade Wave 1', actions: [
          { type: 'DESTROY_SATELLITE', count: 10 },
          { type: 'SPAWN_DEBRIS', count: 5000 }
        ]},
        { id: 'cascade2', type: 'TIME', value: 120000, name: 'Cascade Wave 2', actions: [
          { type: 'DESTROY_SATELLITE', count: 20 },
          { type: 'SPAWN_DEBRIS', count: 10000 }
        ]}
      ],
      endConditions: [{ type: 'TIME_LIMIT', value: 600000 }]
    };
  }
  
  /**
   * Create custom scenario
   */
  createCustomScenario(name, description, triggers, endConditions) {
    const id = `custom-${Date.now()}`;
    this.scenarioTemplates.set(id, {
      name,
      description,
      triggers,
      endConditions
    });
    return id;
  }
  
  /**
   * Get active scenarios
   */
  getActiveScenarios() {
    return Array.from(this.activeScenarios.values());
  }
  
  /**
   * Get scenario history
   */
  getHistory() {
    return this.scenarioHistory;
  }
  
  /**
   * Get available templates
   */
  getTemplates() {
    return Array.from(this.scenarioTemplates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description
    }));
  }
}

// Expose
window.ScenarioEngine = ScenarioEngine;

console.log('[ScenarioEngine] v1.0 loaded - 8 disaster scenarios ready');
