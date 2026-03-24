/**
 * @fileoverview GoalStack - Hierarchical goal management system for GOTHAM 3077.
 * Part of Phase 1 AI Social Dynamics upgrade.
 * Integrates with BehaviorGraph for HTN planning and AgentMemory for persistence.
 */

/**
 * Goal priority levels.
 * @enum {string}
 */
const GoalPriority = {
  URGENT: 'urgent',     // Immediate threats/needs (e.g., avoid danger)
  SHORT_TERM: 'short',  // Next 1-3 actions (e.g., gather resource)
  LONG_TERM: 'long'     // Strategic objectives (e.g., conquer territory)
};

/**
 * Goal status.
 * @enum {string}
 */
const GoalStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABANDONED: 'abandoned'
};

/**
 * Represents a single goal in the stack.
 */
class Goal {
  /**
   * Create a new Goal.
   * @param {string} id - Unique identifier.
   * @param {string} type - Goal type (e.g., 'SURVIVE', 'PROFIT').
   * @param {Object} config - Goal configuration.
   * @param {string} config.description - Human-readable description.
   * @param {GoalPriority} config.priority - Priority level.
   * @param {Object} config.params - Goal-specific parameters.
   * @param {Function} [config.condition] - Condition to check goal completion.
   * @param {Function} [config.failureCondition] - Condition to mark goal as failed.
   * @param {number} [config.timeout] - Timeout in milliseconds.
   */
  constructor(id, type, config = {}) {
    this.id = id;
    this.type = type;
    this.description = config.description || '';
    this.priority = config.priority || GoalPriority.SHORT_TERM;
    this.params = config.params || {};
    this.condition = config.condition || (() => false);
    this.failureCondition = config.failureCondition || (() => false);
    this.timeout = config.timeout || null;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.status = GoalStatus.PENDING;
    this.plan = null; // Reference to BehaviorGraph plan
    this.progress = 0; // 0 to 1
    this.memoryKey = `goal_${id}`;
  }

  /**
   * Update goal status based on current world state.
   * @param {Object} agent - The agent instance.
   * @param {Object} worldState - Current world state.
   * @returns {boolean} True if status changed.
   */
  update(agent, worldState) {
    this.updatedAt = Date.now();
    let changed = false;

    // Check timeout
    if (this.timeout && Date.now() - this.createdAt > this.timeout) {
      if (this.status !== GoalStatus.FAILED) {
        this.status = GoalStatus.FAILED;
        changed = true;
      }
      return changed;
    }

    // Check failure condition
    if (this.failureCondition(agent, worldState)) {
      if (this.status !== GoalStatus.FAILED) {
        this.status = GoalStatus.FAILED;
        changed = true;
      }
      return changed;
    }

    // Check completion condition
    if (this.condition(agent, worldState)) {
      if (this.status !== GoalStatus.COMPLETED) {
        this.status = GoalStatus.COMPLETED;
        this.progress = 1;
        changed = true;
      }
      return changed;
    }

    // If goal is active, update progress (optional)
    if (this.status === GoalStatus.ACTIVE && this.plan) {
      // Simple progress estimation based on plan steps completed
      // This can be enhanced with actual plan tracking
      this.progress = Math.min(0.9, this.progress + 0.01);
    }
    return changed;
  }

  /**
   * Activate this goal.
   */
  activate() {
    this.status = GoalStatus.ACTIVE;
    this.updatedAt = Date.now();
  }

  /**
   * Mark goal as completed.
   */
  complete() {
    this.status = GoalStatus.COMPLETED;
    this.progress = 1;
    this.updatedAt = Date.now();
  }

  /**
   * Mark goal as failed.
   */
  fail() {
    this.status = GoalStatus.FAILED;
    this.updatedAt = Date.now();
  }

  /**
   * Abandon goal.
   */
  abandon() {
    this.status = GoalStatus.ABANDONED;
    this.updatedAt = Date.now();
  }

  /**
   * Serialize goal for storage.
   * @returns {Object} Serialized representation.
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      priority: this.priority,
      params: this.params,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      progress: this.progress,
      timeout: this.timeout
    };
  }

  /**
   * Deserialize goal from storage.
   * @param {Object} data - Serialized data.
   * @returns {Goal} New Goal instance.
   */
  static deserialize(data) {
    const goal = new Goal(data.id, data.type, {
      description: data.description,
      priority: data.priority,
      params: data.params,
      timeout: data.timeout
    });
    goal.createdAt = data.createdAt;
    goal.updatedAt = data.updatedAt;
    goal.status = data.status;
    goal.progress = data.progress;
    return goal;
  }
}

/**
 * GoalStack manages hierarchical goals for an agent.
 */
class GoalStack {
  /**
   * Create a new GoalStack.
   * @param {string} agentId - Associated agent ID.
   * @param {BehaviorGraph} behaviorGraph - Behavior graph for planning.
   * @param {AgentMemory} agentMemory - Agent memory for persistence.
   */
  constructor(agentId, behaviorGraph, agentMemory) {
    this.agentId = agentId;
    this.behaviorGraph = behaviorGraph;
    this.agentMemory = agentMemory;
    this.urgentGoals = [];
    this.shortTermGoals = [];
    this.longTermGoals = [];
    this.activeGoal = null;
    this.history = []; // Completed/failed/abandoned goals
    this.maxHistory = 100;
  }

  /**
   * Push a new goal onto the appropriate stack.
   * @param {Goal} goal - The goal to push.
   */
  pushGoal(goal) {
    switch (goal.priority) {
      case GoalPriority.URGENT:
        this.urgentGoals.push(goal);
        break;
      case GoalPriority.SHORT_TERM:
        this.shortTermGoals.push(goal);
        break;
      case GoalPriority.LONG_TERM:
        this.longTermGoals.push(goal);
        break;
      default:
        this.shortTermGoals.push(goal);
    }
    this._saveToMemory();
  }

  /**
   * Pop the highest-priority goal (urgent > short > long).
   * @returns {Goal|null} The goal or null if none.
   */
  popGoal() {
    if (this.urgentGoals.length > 0) {
      return this.urgentGoals.shift();
    }
    if (this.shortTermGoals.length > 0) {
      return this.shortTermGoals.shift();
    }
    if (this.longTermGoals.length > 0) {
      return this.longTermGoals.shift();
    }
    return null;
  }

  /**
   * Get the current active goal.
   * @returns {Goal|null} Active goal.
   */
  getActiveGoal() {
    return this.activeGoal;
  }

  /**
   * Set the active goal and generate a plan via HTN decomposition.
   * @param {Goal} goal - The goal to activate.
   * @returns {boolean} True if successful.
   */
  setActiveGoal(goal) {
    if (!goal || goal.status !== GoalStatus.PENDING) {
      return false;
    }
    // Decompose goal into plan using HTN
    const plan = this._decomposeGoal(goal);
    if (!plan) {
      console.warn(`[GoalStack] Could not decompose goal ${goal.id}`);
      return false;
    }
    goal.plan = plan;
    goal.activate();
    this.activeGoal = goal;
    this._saveToMemory();
    return true;
  }

  /**
   * Update all goals and manage goal lifecycle.
   * @param {Object} agent - Agent instance.
   * @param {Object} worldState - Current world state.
   */
  update(agent, worldState) {
    // Update active goal
    if (this.activeGoal) {
      const changed = this.activeGoal.update(agent, worldState);
      if (changed) {
        if (this.activeGoal.status === GoalStatus.COMPLETED) {
          this._moveToHistory(this.activeGoal);
          this.activeGoal = null;
        } else if (this.activeGoal.status === GoalStatus.FAILED) {
          this._moveToHistory(this.activeGoal);
          this.activeGoal = null;
        }
      }
    }

    // If no active goal, try to activate next goal
    if (!this.activeGoal) {
      const nextGoal = this.popGoal();
      if (nextGoal) {
        this.setActiveGoal(nextGoal);
      }
    }

    // Update other pending goals (optional decay, priority shifts)
    this._updateGoalPriorities(agent, worldState);
    this._saveToMemory();
  }

  /**
   * Decompose a goal into a plan using HTN and the behavior graph.
   * @private
   * @param {Goal} goal - The goal to decompose.
   * @returns {Object|null} Plan object (sequence of nodes) or null.
   */
  _decomposeGoal(goal) {
    // Try to find a matching goal node in the behavior graph
    const goalNodeId = this._findGoalNode(goal.type);
    if (!goalNodeId) {
      console.warn(`[GoalStack] No goal node found for type ${goal.type}`);
      return null;
    }

    // Find current state node (could be a special "current" node)
    const startNodeId = 'current'; // This should be mapped to agent's current state
    // For now, use a default start node; we need to map agent state to graph node.
    // This is a simplification; actual implementation requires state-to-node mapping.
    const start = startNodeId;
    const goalNode = goalNodeId;

    // Use behavior graph's pathfinding to generate plan
    const path = this.behaviorGraph.findPath(start, goalNode, {
      agentState: goal.params
    });
    if (!path || path.length === 0) {
      return null;
    }

    // Convert path to plan
    const plan = {
      goalId: goal.id,
      nodes: path.map(nodeId => this.behaviorGraph.nodes.get(nodeId)),
      currentStep: 0,
      createdAt: Date.now()
    };
    return plan;
  }

  /**
   * Find a goal node in the behavior graph matching goal type.
   * @private
   * @param {string} goalType - Goal type (e.g., 'SURVIVE').
   * @returns {string|null} Node ID or null.
   */
  _findGoalNode(goalType) {
    // Look for a node with type 'GOAL' and matching config
    for (const [nodeId, node] of this.behaviorGraph.nodes) {
      if (node.type === 'GOAL' && node.config.goalType === goalType) {
        return nodeId;
      }
    }
    // Fallback: node id equals goalType
    if (this.behaviorGraph.nodes.has(goalType)) {
      return goalType;
    }
    return null;
  }

  /**
   * Move goal to history, trimming if needed.
   * @private
   * @param {Goal} goal - Goal to archive.
   */
  _moveToHistory(goal) {
    this.history.push(goal.serialize());
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Update goal priorities based on changing world state.
   * @private
   * @param {Object} agent - Agent instance.
   * @param {Object} worldState - Current world state.
   */
  _updateGoalPriorities(agent, worldState) {
    // Example: promote urgent goals based on threats
    // This can be expanded with more sophisticated logic
    for (const goal of this.shortTermGoals) {
      if (goal.type === 'SURVIVE' && worldState.threatLevel > 5) {
        goal.priority = GoalPriority.URGENT;
        // Move to urgent stack
        this.shortTermGoals = this.shortTermGoals.filter(g => g !== goal);
        this.urgentGoals.push(goal);
      }
    }
  }

  /**
   * Save goal stack state to agent memory.
   * @private
   */
  _saveToMemory() {
    const data = {
      urgentGoals: this.urgentGoals.map(g => g.serialize()),
      shortTermGoals: this.shortTermGoals.map(g => g.serialize()),
      longTermGoals: this.longTermGoals.map(g => g.serialize()),
      activeGoal: this.activeGoal ? this.activeGoal.serialize() : null,
      history: this.history
    };
    // Use agent memory to store; for now, use a simple key.
    // TODO: integrate with AgentMemory's persistence
    if (this.agentMemory && this.agentMemory.saveGoalStack) {
      this.agentMemory.saveGoalStack(this.agentId, data);
    } else {
      // Fallback to localStorage or in-memory
      localStorage.setItem(`goalstack_${this.agentId}`, JSON.stringify(data));
    }
  }

  /**
   * Load goal stack state from agent memory.
   * @returns {boolean} True if loaded.
   */
  loadFromMemory() {
    let data;
    if (this.agentMemory && this.agentMemory.loadGoalStack) {
      data = this.agentMemory.loadGoalStack(this.agentId);
    } else {
      const stored = localStorage.getItem(`goalstack_${this.agentId}`);
      data = stored ? JSON.parse(stored) : null;
    }
    if (!data) return false;

    this.urgentGoals = data.urgentGoals.map(d => Goal.deserialize(d));
    this.shortTermGoals = data.shortTermGoals.map(d => Goal.deserialize(d));
    this.longTermGoals = data.longTermGoals.map(d => Goal.deserialize(d));
    this.activeGoal = data.activeGoal ? Goal.deserialize(data.activeGoal) : null;
    this.history = data.history;
    return true;
  }

  /**
   * Clear all goals.
   */
  clear() {
    this.urgentGoals = [];
    this.shortTermGoals = [];
    this.longTermGoals = [];
    this.activeGoal = null;
    this.history = [];
    this._saveToMemory();
  }

  /**
   * Get statistics about goals.
   * @returns {Object} Stats.
   */
  getStats() {
    return {
      urgent: this.urgentGoals.length,
      shortTerm: this.shortTermGoals.length,
      longTerm: this.longTermGoals.length,
      active: this.activeGoal ? 1 : 0,
      history: this.history.length
    };
  }
}

// Export
window.GoalStack = GoalStack;
window.Goal = Goal;
window.GoalPriority = GoalPriority;
window.GoalStatus = GoalStatus;