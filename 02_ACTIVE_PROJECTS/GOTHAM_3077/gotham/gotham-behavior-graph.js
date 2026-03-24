/**
 * @fileoverview BehaviorGraph - Behavior composition system for the Gotham engine.
 * Enables complex action chains instead of single atomic actions through directed graphs.
 * Part of Upgrade 2: Emergent Skill System.
 */

/** @typedef {string} NodeId */
/** @typedef {string} AgentId */

/**
 * @typedef {Object} ActionNode
 * @property {NodeId} id - Unique identifier
 * @property {('PRIMITIVE'|'COMPOSITE'|'CONDITIONAL'|'GOAL')} type - Node type
 * @property {Function} action - The action to execute
 * @property {Function} preconditions - Function returning boolean
 * @property {Function} effects - Function applying state changes
 * @property {number} cost - Action cost for pathfinding
 * @property {Object} config - Additional configuration
 */

/**
 * @typedef {Object} Edge
 * @property {NodeId} from - Source node
 * @property {NodeId} to - Target node
 * @property {Function} [condition] - Optional transition condition
 * @property {number} weight - Edge weight for pathfinding
 */

/**
 * @typedef {Object} Plan
 * @property {ActionNode[]} nodes - Sequence of actions
 * @property {number} totalCost - Estimated total cost
 * @property {number} createdAt - Timestamp
 */

/**
 * BehaviorGraph - Directed graph for action composition and planning.
 * Nodes represent actions/states, edges represent valid transitions.
 */
/**
 * Maximum number of outcomes to store in the learning map
 * @constant {number}
 */
const MAX_OUTCOMES_SIZE = 10000;

class BehaviorGraph {
  /**
   * Creates a new BehaviorGraph instance.
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.enableLearning=true] - Enable plan learning
   * @param {number} [options.maxPlanLength=50] - Maximum plan length
   * @param {number} [options.replanThreshold=0.3] - Threshold for forced replanning
   * @param {boolean} [options.enableEvents=true] - Enable CustomEvent dispatching
   */
  constructor(options = {}) {
    /** @type {Map<NodeId, ActionNode>} */
    this.nodes = new Map();

    /** @type {Map<NodeId, Edge[]>} */
    this.edges = new Map();

    /** @type {Map<string, number>} */
    this.outcomes = new Map();

    /** @type {boolean} */
    this.enableLearning = options.enableLearning !== false;

    /** @type {number} */
    this.maxPlanLength = options.maxPlanLength || 50;

    /** @type {number} */
    this.replanThreshold = options.replanThreshold || 0.3;

    /** @type {boolean} */
    this.enableEvents = options.enableEvents !== false;

    /** @type {Object} */
    this.actionLibrary = this._initializeActionLibrary();

    /** @type {number} */
    this._patternId = 0;
  }

  /**
   * Adds a node to the behavior graph.
   * @param {NodeId} id - Unique node identifier
   * @param {('PRIMITIVE'|'COMPOSITE'|'CONDITIONAL'|'GOAL')} type - Node type
   * @param {Object} config - Node configuration
   * @param {Function} config.action - Action function
   * @param {Function} [config.preconditions] - Precondition checker
   * @param {Function} [config.effects] - Effect applier
   * @param {number} [config.cost=1] - Action cost
   * @returns {BehaviorGraph} This instance for chaining
   */
  addNode(id, type, config) {
    if (this.nodes.has(id)) {
      throw new Error(`Node '${id}' already exists in graph`);
    }
    
    const node = {
      id,
      type,
      action: config.action,
      preconditions: config.preconditions || (() => true),
      effects: config.effects || (() => {}),
      cost: config.cost || 1,
      config: config.config || {}
    };
    
    this.nodes.set(id, node);
    this.edges.set(id, []);
    
    return this;
  }

  /**
   * Adds an edge connecting two nodes.
   * @param {NodeId} from - Source node id
   * @param {NodeId} to - Target node id
   * @param {Function} [condition] - Optional transition condition
   * @param {number} [weight=1] - Edge weight for pathfinding
   * @returns {BehaviorGraph} This instance for chaining
   */
  addEdge(from, to, condition, weight = 1) {
    if (!this.nodes.has(from)) {
      throw new Error(`Source node '${from}' does not exist`);
    }
    if (!this.nodes.has(to)) {
      throw new Error(`Target node '${to}' does not exist`);
    }
    
    const edgeList = this.edges.get(from);
    edgeList.push({
      from,
      to,
      condition: condition || (() => true),
      weight
    });
    
    return this;
  }

  /**
   * Removes a node and all connected edges.
   * @param {NodeId} id - Node to remove
   * @returns {boolean} True if removed
   */
  removeNode(id) {
    if (!this.nodes.has(id)) {
      return false;
    }
    
    this.nodes.delete(id);
    this.edges.delete(id);
    
    for (const [nodeId, edgeList] of this.edges) {
      this.edges.set(
        nodeId,
        edgeList.filter(e => e.to !== id)
      );
    }
    
    return true;
  }

  /**
   * Finds optimal path using A* algorithm.
   * @param {NodeId} start - Starting node
   * @param {NodeId} goal - Goal node
   * @param {Object} [context] - Additional context for heuristic
   * @returns {NodeId[]|null} Path array or null if no path
   */
  findPath(start, goal, context = {}) {
    if (!this.nodes.has(start) || !this.nodes.has(goal)) {
      return null;
    }
    
    if (start === goal) {
      return [start];
    }
    
    const openSet = new Set([start]);
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    gScore.set(start, 0);
    fScore.set(start, this._heuristic(start, goal, context));
    
    while (openSet.size > 0) {
      let current = null;
      let lowestF = Infinity;
      
      for (const node of openSet) {
        const f = fScore.get(node) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = node;
        }
      }
      
      if (current === goal) {
        return this._reconstructPath(cameFrom, current);
      }
      
      openSet.delete(current);
      closedSet.add(current);
      
      const edges = this.edges.get(current) || [];
      
      for (const edge of edges) {
        if (closedSet.has(edge.to)) {
          continue;
        }
        
        const neighbor = edge.to;
        const tentativeG = (gScore.get(current) ?? Infinity) + 
          this.nodes.get(current).cost + edge.weight;
        
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tentativeG >= (gScore.get(neighbor) ?? Infinity)) {
          continue;
        }
        
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + this._heuristic(neighbor, goal, context));
      }
    }
    
    return null;
  }

  /**
   * Constructs an action plan for an agent to achieve a goal.
   * @param {Object} agent - Agent with current state
   * @param {NodeId} goal - Target goal node
   * @returns {Plan|null} Action plan or null
   */
  constructPlan(agent, goal) {
    const startNode = this._findStartNode(agent);
    if (!startNode) {
      return null;
    }
    
    const path = this.findPath(startNode, goal, { agent });
    if (!path) {
      return null;
    }
    
    const planNodes = path.map(id => this.nodes.get(id));
    const validNodes = planNodes.filter((node, index) => {
      if (index === 0) return true;
      return this.evaluatePreconditions(agent, node);
    });
    
    if (validNodes.length === 0) {
      return null;
    }
    
    const totalCost = validNodes.reduce((sum, node) => sum + node.cost, 0);
    
    const plan = {
      nodes: validNodes,
      totalCost,
      createdAt: Date.now()
    };

    agent.currentPlan = plan;
    agent.planIndex = 0;

    this._dispatchPlanEvent('plan-constructed', {
      agentId: agent.id,
      planNodeIds: validNodes.map(n => n.id),
      totalCost
    });

    return plan;
  }

  /**
   * Executes the current step in agent's plan.
   * @param {Object} agent - Agent executing the plan
   * @returns {Object} Execution result
   */
  executeStep(agent) {
    if (!agent.currentPlan || !agent.currentPlan.nodes) {
      return { success: false, reason: 'no_plan' };
    }
    
    const { nodes } = agent.currentPlan;
    
    if (agent.planIndex >= nodes.length) {
      this.recordOutcome(agent.currentPlan, true, 1.0);
      this._dispatchPlanEvent('plan-completed', {
        agentId: agent.id,
        planNodeIds: nodes.map(n => n.id)
      });
      agent.currentPlan = null;
      agent.planIndex = 0;
      return { success: true, complete: true };
    }
    
    const currentNode = nodes[agent.planIndex];
    
    if (!this.evaluatePreconditions(agent, currentNode)) {
      const newPlan = this.constructPlan(agent, nodes[nodes.length - 1].id);
      if (!newPlan) {
        return { success: false, reason: 'precondition_failed', node: currentNode.id };
      }
      return { success: true, replanned: true };
    }
    
    try {
      const result = currentNode.action(agent, currentNode.config);
      
      if (result && result.success !== false) {
        this.applyEffects(agent, currentNode);
        agent.planIndex++;

        const isComplete = agent.planIndex >= nodes.length;
        if (isComplete) {
          this._dispatchPlanEvent('plan-completed', {
            agentId: agent.id,
            planNodeIds: nodes.map(n => n.id)
          });
        }

        return {
          success: true,
          node: currentNode.id,
          complete: isComplete,
          result
        };
      } else {
        this._dispatchPlanEvent('plan-step-failed', {
          agentId: agent.id,
          nodeId: currentNode.id,
          reason: 'action_failed'
        });
        return {
          success: false,
          reason: 'action_failed',
          node: currentNode.id,
          result
        };
      }
    } catch (error) {
      this._dispatchPlanEvent('plan-step-failed', {
        agentId: agent.id,
        nodeId: currentNode.id,
        reason: 'exception',
        error: error.message
      });
      return {
        success: false,
        reason: 'exception',
        node: currentNode.id,
        error: error.message
      };
    }
  }

  /**
   * Evaluates if preconditions are met for a node.
   * @param {Object} agent - Agent to check
   * @param {ActionNode} node - Node to evaluate
   * @returns {boolean} True if preconditions satisfied
   */
  evaluatePreconditions(agent, node) {
    try {
      return node.preconditions(agent, node.config) !== false;
    } catch {
      return false;
    }
  }

  /**
   * Applies node effects to agent state.
   * @param {Object} agent - Agent to modify
   * @param {ActionNode} node - Node whose effects to apply
   */
  applyEffects(agent, node) {
    try {
      node.effects(agent, node.config);
    } catch (error) {
      // Effect application failed, ignore
    }
  }

  /**
   * FIXED: Records plan execution outcome for learning.
   * Success DECREASES edge weight (lower cost = preferred),
   * Failure INCREASES edge weight (higher cost = avoided).
   * @param {Plan} plan - Executed plan
   * @param {boolean} success - Whether plan succeeded
   * @param {number} reward - Reward value
   */
  recordOutcome(plan, success, reward) {
    if (!this.enableLearning || !plan) {
      return;
    }

    const planKey = plan.nodes.map(n => n.id).join('->');
    const current = this.outcomes.get(planKey) || { count: 0, success: 0, reward: 0, timestamp: Date.now() };

    current.count++;
    current.success += success ? 1 : 0;
    current.reward += reward;
    current.timestamp = Date.now();

    this._pruneOutcomesIfNeeded();
    this.outcomes.set(planKey, current);

    // FIXED: Success = decrease weight (prefer this path), Failure = increase weight (avoid this path)
    // Scale adjustment by reward magnitude
    const delta = success ? -0.1 * Math.abs(reward) : 0.2 * Math.abs(reward);
    this.adjustEdgeWeights(plan, delta);
  }

  /**
   * FIXED: Prunes oldest/lowest success rate outcomes when size exceeds MAX_OUTCOMES_SIZE
   * @private
   */
  _pruneOutcomesIfNeeded() {
    if (this.outcomes.size < MAX_OUTCOMES_SIZE) {
      return;
    }

    const entries = Array.from(this.outcomes.entries());
    
    // Sort by success rate (worst first) then by timestamp (oldest first)
    entries.sort((a, b) => {
      const rateA = a[1].count > 0 ? a[1].success / a[1].count : 0;
      const rateB = b[1].count > 0 ? b[1].success / b[1].count : 0;
      if (rateA !== rateB) return rateA - rateB;
      return (a[1].timestamp || 0) - (b[1].timestamp || 0);
    });
    
    // Remove bottom 10%
    const toRemoveCount = Math.ceil(MAX_OUTCOMES_SIZE * 0.1);
    const toRemove = entries.slice(0, toRemoveCount);
    for (const [key] of toRemove) {
      this.outcomes.delete(key);
    }
  }

  /**
   * Dispatches a CustomEvent for plan execution events
   * @param {string} eventType - Event type name
   * @param {Object} detail - Event detail data
   * @private
   */
  _dispatchPlanEvent(eventType, detail) {
    if (this.enableEvents && typeof window !== 'undefined' && window.document) {
      const event = new CustomEvent(`behaviorgraph:${eventType}`, { detail });
      window.dispatchEvent(event);
    }
  }

  /**
   * Adjusts edge weights based on plan outcome.
   * @param {Plan} plan - The plan executed
   * @param {number} delta - Weight adjustment
   */
  adjustEdgeWeights(plan, delta) {
    if (!plan || !plan.nodes) {
      return;
    }
    
    const nodeIds = plan.nodes.map(n => n.id);
    
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const from = nodeIds[i];
      const to = nodeIds[i + 1];
      
      const edges = this.edges.get(from) || [];
      const edge = edges.find(e => e.to === to);
      
      if (edge) {
        edge.weight = Math.max(0.1, edge.weight + delta);
      }
    }
  }

  /**
   * Discovers new composite patterns from repeated sequences.
   * @param {ActionNode[]} observedActions - Sequence to analyze
   * @returns {NodeId|null} New composite node id or null
   */
  discoverNewPattern(observedActions) {
    if (observedActions.length < 3) {
      return null;
    }
    
    const sequenceKey = observedActions.map(a => a.id).join(',');
    const pattern = this.outcomes.get(sequenceKey);
    
    if (pattern && pattern.count >= 3 && pattern.success / pattern.count > 0.7) {
      this._patternId++;
      const compositeId = `composite_${this._patternId}`;
      
      const compositeAction = (agent, config) => {
        for (const action of observedActions) {
          const result = action.action(agent, action.config);
          if (!result || result.success === false) {
            return { success: false, failedAt: action.id };
          }
        }
        return { success: true };
      };
      
      this.addNode(compositeId, 'COMPOSITE', {
        action: compositeAction,
        cost: observedActions.reduce((sum, a) => sum + a.cost, 0) * 0.8,
        preconditions: observedActions[0].preconditions,
        effects: observedActions[observedActions.length - 1].effects
      });
      
      return compositeId;
    }
    
    return null;
  }

  /**
   * Gets action from the predefined library.
   * @param {string} name - Action name
   * @returns {Function} Action function
   */
  getAction(name) {
    return this.actionLibrary[name];
  }

  /**
   * Creates a composite subgraph for common behaviors.
   * @param {NodeId} id - Composite node id
   * @param {NodeId[]} sequence - Node sequence
   * @returns {BehaviorGraph} This instance
   */
  createComposite(id, sequence) {
    const nodes = sequence.map(sid => this.nodes.get(sid)).filter(Boolean);
    
    if (nodes.length === 0) {
      throw new Error('Cannot create composite from empty sequence');
    }
    
    const compositeAction = (agent, config) => {
      if (!agent._compositeState) {
        agent._compositeState = { index: 0 };
      }
      
      const state = agent._compositeState;
      
      while (state.index < nodes.length) {
        const node = nodes[state.index];
        
        if (!this.evaluatePreconditions(agent, node)) {
          return { success: false, reason: 'precondition_failed', at: node.id };
        }
        
        const result = node.action(agent, config);
        
        if (!result || result.success === false) {
          return { success: false, reason: 'action_failed', at: node.id };
        }
        
        this.applyEffects(agent, node);
        state.index++;
        
        if (result.async) {
          return { success: true, pending: true };
        }
      }
      
      delete agent._compositeState;
      return { success: true };
    };
    
    this.addNode(id, 'COMPOSITE', {
      action: compositeAction,
      cost: nodes.reduce((sum, n) => sum + n.cost, 0) * 0.9
    });
    
    return this;
  }

  /**
   * Validates graph structure.
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    for (const [id, node] of this.nodes) {
      if (!node.action || typeof node.action !== 'function') {
        errors.push(`Node '${id}' missing action function`);
      }
    }
    
    for (const [from, edges] of this.edges) {
      for (const edge of edges) {
        if (!this.nodes.has(edge.to)) {
          errors.push(`Edge from '${from}' references non-existent node '${edge.to}'`);
        }
      }
    }
    
    const unreachable = [];
    const visited = new Set();
    const stack = Array.from(this.nodes.keys()).slice(0, 1);
    
    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      
      const edges = this.edges.get(current) || [];
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          stack.push(edge.to);
        }
      }
    }
    
    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        unreachable.push(id);
      }
    }
    
    if (unreachable.length > 0) {
      warnings.push(`Unreachable nodes: ${unreachable.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      nodeCount: this.nodes.size,
      edgeCount: Array.from(this.edges.values()).reduce((sum, e) => sum + e.length, 0)
    };
  }

  /**
   * Heuristic function for A* pathfinding.
   * @private
   */
  _heuristic(node, goal, context) {
    const nodeData = this.nodes.get(node);
    const goalData = this.nodes.get(goal);
    
    if (nodeData.type === 'GOAL' || node === goal) {
      return 0;
    }
    
    let h = 1;
    
    if (context && context.agent) {
      const agent = context.agent;
      if (nodeData.config && nodeData.config.location && agent.location) {
        const dx = nodeData.config.location.lat - agent.location.lat;
        const dy = nodeData.config.location.lon - agent.location.lon;
        h += Math.sqrt(dx * dx + dy * dy) * 0.1;
      }
    }
    
    return h;
  }

  /**
   * Reconstructs path from A* search.
   * @private
   */
  _reconstructPath(cameFrom, current) {
    const path = [current];
    
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    
    return path;
  }

  /**
   * FIXED: Finds appropriate start node for agent with proper edge case handling.
   * @private
   * @returns {string|null} Start node ID or null if no valid start node found
   */
  _findStartNode(agent) {
    // If agent has a current plan, continue from current step
    if (agent.currentPlan && agent.planIndex > 0 && agent.currentPlan.nodes) {
      const currentNode = agent.currentPlan.nodes[agent.planIndex];
      if (currentNode && this.nodes.has(currentNode.id)) {
        return currentNode.id;
      }
    }
    
    // Find first primitive node that matches preconditions
    for (const [id, node] of this.nodes) {
      if (node.type === 'PRIMITIVE' && this.evaluatePreconditions(agent, node)) {
        return id;
      }
    }
    
    // Fallback: return first IDLE-like node or any primitive node
    for (const [id, node] of this.nodes) {
      if (node.type === 'PRIMITIVE') {
        return id;
      }
    }
    
    // Last resort: return any node
    const firstNode = this.nodes.keys().next();
    if (!firstNode.done) {
      return firstNode.value;
    }
    
    // No nodes available
    console.warn('[BehaviorGraph] No start node available - graph may be empty');
    return null;
  }

  /**
   * Initializes the predefined action library.
   * @private
   * @returns {Object} Action library
   */
  _initializeActionLibrary() {
    return {
      /**
       * Navigate to a specific location.
       * @param {Object} agent - Moving agent
       * @param {Object} config - Target coordinates
       * @param {number} config.lat - Target latitude
       * @param {number} config.lon - Target longitude
       */
      moveTo: (agent, config) => {
        if (!agent.location) {
          return { success: false, reason: 'no_location' };
        }
        
        const { lat, lon } = config;
        const dx = lat - agent.location.lat;
        const dy = lon - agent.location.lon;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 0.001) {
          return { success: true, arrived: true };
        }
        
        const speed = agent.speed || 1;
        const moveRatio = Math.min(1, speed / distance);
        
        agent.location.lat += dx * moveRatio;
        agent.location.lon += dy * moveRatio;
        
        return {
          success: true,
          moved: true,
          remaining: distance * (1 - moveRatio)
        };
      },

      /**
       * Execute search pattern in an area.
       * @param {Object} agent - Exploring agent
       * @param {Object} config - Search parameters
       * @param {Object} config.center - Center coordinates
       * @param {number} config.radius - Search radius
       */
      exploreArea: (agent, config) => {
        const { center, radius } = config;
        
        if (!agent._exploreState) {
          agent._exploreState = {
            angle: 0,
            found: []
          };
        }
        
        const state = agent._exploreState;
        state.angle += Math.PI / 4;
        
        const newLat = center.lat + Math.cos(state.angle) * radius;
        const newLon = center.lon + Math.sin(state.angle) * radius;
        
        agent.location = { lat: newLat, lon: newLon };
        
        if (agent.world && agent.world.query) {
          const nearby = agent.world.query(agent.location, radius * 0.5);
          state.found.push(...nearby);
        }
        
        if (state.angle >= Math.PI * 2) {
          const result = { success: true, found: state.found };
          delete agent._exploreState;
          return result;
        }
        
        return { success: true, pending: true, progress: state.angle / (Math.PI * 2) };
      },

      /**
       * Search for a specific resource type.
       * @param {Object} agent - Searching agent
       * @param {Object} config - Search parameters
       * @param {string} config.type - Resource type
       */
      findResource: (agent, config) => {
        const { type } = config;
        
        if (!agent.world || !agent.world.findResources) {
          return { success: false, reason: 'no_world' };
        }
        
        const resources = agent.world.findResources(type, agent.location, 100);
        
        if (resources.length === 0) {
          return { success: false, reason: 'not_found' };
        }
        
        const nearest = resources.reduce((best, r) => {
          const d1 = agent.world.distance(agent.location, r.location);
          const d2 = agent.world.distance(agent.location, best.location);
          return d1 < d2 ? r : best;
        });
        
        agent.targetResource = nearest;
        
        return { success: true, found: nearest };
      },

      /**
       * Execute trade with another agent.
       * @param {Object} agent - Trading agent
       * @param {Object} config - Trade parameters
       * @param {AgentId} config.agentId - Target agent
       */
      tradeWith: (agent, config) => {
        const { agentId } = config;
        
        if (!agent.world || !agent.world.getAgent) {
          return { success: false, reason: 'no_world' };
        }
        
        const target = agent.world.getAgent(agentId);
        if (!target) {
          return { success: false, reason: 'target_not_found' };
        }
        
        if (agent.inventory && target.inventory) {
          return { success: true, traded: true };
        }
        
        return { success: false, reason: 'no_inventory' };
      },

      /**
       * Calculate and execute escape route.
       * @param {Object} agent - Fleeing agent
       * @param {Object} config - Threat information
       * @param {Object} config.location - Threat location
       */
      avoidThreat: (agent, config) => {
        const { location } = config;
        
        if (!agent.location || !location) {
          return { success: false, reason: 'no_location' };
        }
        
        const dx = agent.location.lat - location.lat;
        const dy = agent.location.lon - location.lon;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 0.001) {
          const escapeAngle = Math.random() * Math.PI * 2;
          agent.location.lat += Math.cos(escapeAngle) * 0.01;
          agent.location.lon += Math.sin(escapeAngle) * 0.01;
        } else {
          const escapeDist = Math.min(0.1, distance);
          agent.location.lat += (dx / distance) * escapeDist;
          agent.location.lon += (dy / distance) * escapeDist;
        }
        
        return { success: true, escaped: true };
      },

      /**
       * Rest and recover at a location.
       * @param {Object} agent - Resting agent
       * @param {Object} config - Rest location
       * @param {Object} config.location - Coordinates
       */
      restAt: (agent, config) => {
        if (agent.energy !== undefined) {
          agent.energy = Math.min(100, (agent.energy || 0) + 20);
        }
        
        if (agent.health !== undefined) {
          agent.health = Math.min(100, (agent.health || 0) + 5);
        }
        
        agent.state = 'resting';
        
        return { success: true, recovered: true };
      },

      /**
       * Scout a route for safety.
       * @param {Object} agent - Scouting agent
       * @param {Object} config - Route endpoints
       * @param {Object} config.from - Start coordinates
       * @param {Object} config.to - End coordinates
       */
      scoutRoute: (agent, config) => {
        const { from, to } = config;
        
        if (!agent._scoutState) {
          agent._scoutState = { progress: 0, threats: [] };
        }
        
        const state = agent._scoutState;
        state.progress += 0.2;
        
        const t = Math.min(1, state.progress);
        agent.location = {
          lat: from.lat + (to.lat - from.lat) * t,
          lon: from.lon + (to.lon - from.lon) * t
        };
        
        if (agent.world && agent.world.queryThreats) {
          const threats = agent.world.queryThreats(agent.location, 50);
          state.threats.push(...threats);
        }
        
        if (state.progress >= 1) {
          const result = {
            success: true,
            safe: state.threats.length === 0,
            threats: state.threats
          };
          delete agent._scoutState;
          return result;
        }
        
        return { success: true, pending: true, progress: t };
      },

      /**
       * Gather intelligence about an area.
       * @param {Object} agent - Gathering agent
       * @param {Object} config - Target location
       * @param {Object} config.location - Coordinates to investigate
       */
      gatherIntel: (agent, config) => {
        const { location } = config;
        
        if (!agent.knowledge) {
          agent.knowledge = {};
        }
        
        if (!agent._intelState) {
          agent._intelState = { observations: [], ticks: 0 };
        }
        
        const state = agent._intelState;
        state.ticks++;
        
        if (agent.world && agent.world.observe) {
          const observation = agent.world.observe(location, 30);
          state.observations.push(observation);
        }
        
        if (state.ticks >= 3) {
          const intel = {
            location,
            timestamp: Date.now(),
            observations: state.observations,
            summary: this._summarizeObservations(state.observations)
          };
          
          const key = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
          agent.knowledge[key] = intel;
          
          delete agent._intelState;
          return { success: true, intel };
        }
        
        return { success: true, pending: true };
      }
    };
  }

  /**
   * Summarizes observations for intel gathering.
   * @private
   */
  _summarizeObservations(observations) {
    const summary = {
      agentCount: 0,
      resourceTypes: new Set(),
      threatLevel: 0
    };
    
    for (const obs of observations) {
      if (obs.agents) summary.agentCount += obs.agents.length;
      if (obs.resources) {
        for (const r of obs.resources) {
          summary.resourceTypes.add(r.type);
        }
      }
      if (obs.threats) summary.threatLevel += obs.threats.length;
    }
    
    return {
      agentCount: summary.agentCount,
      resourceTypes: Array.from(summary.resourceTypes),
      threatLevel: Math.min(10, summary.threatLevel)
    };
  }
}

/**
 * Predefined behavior goal types for neural selection.
 * @enum {string}
 */
BehaviorGraph.GOALS = {
  SURVIVE: 'survive',
  PROFIT: 'profit',
  EXPLORE: 'explore',
  SOCIALIZE: 'socialize',
  DEFEND: 'defend',
  CONQUER: 'conquer'
};

/**
 * Predefined action node types.
 * @enum {string}
 */
BehaviorGraph.NODE_TYPES = {
  PRIMITIVE: 'PRIMITIVE',
  COMPOSITE: 'COMPOSITE',
  CONDITIONAL: 'CONDITIONAL',
  GOAL: 'GOAL'
};

window.BehaviorGraph = BehaviorGraph;
