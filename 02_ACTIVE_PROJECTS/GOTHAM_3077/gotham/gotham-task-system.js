/**
 * GOTHAM 3077 - AGENT TASK SYSTEM v1.0
 * Handles multi-step sequential tasks for AI agents.
 */

class AgentTaskSystem {
  constructor() {
    console.log('[TASK SYSTEM] Online');
    // Listen for requests on the global bus
    if (window.gothamBus) {
      window.gothamBus.on('ASSIGN_TASK', (payload) => this.assignTask(payload.agentId, payload.task));
    }
  }

  assignTask(agentId, taskSequence) {
    if (!window.gothamWorldState) return;
    
    // Find agent in state
    let agent = window.gothamWorldState.state.agents.find(a => a.id === agentId);
    if (!agent) {
      // Create stub if missing
      agent = { id: agentId, taskQueue: [] };
      window.gothamWorldState.state.agents.push(agent);
    }
    
    // Assign the new sequence
    agent.taskQueue = Array.isArray(taskSequence) ? taskSequence : [taskSequence];
    
    if (window.gothamBus) {
      window.gothamBus.emit('TASK_ASSIGNED', { agentId, sequenceLength: agent.taskQueue.length });
    }
  }

  tickAgent(agent) {
    if (!agent.taskQueue || agent.taskQueue.length === 0) return;

    const task = agent.taskQueue[0];
    let isComplete = false;

    // Task Execution Logic
    switch(task.type) {
      case 'MOVE_TO_REPO':
        isComplete = this._executeMove(agent, task.target);
        break;
      case 'AUDIT_CODE':
        isComplete = this._executeAudit(agent, task.target);
        break;
      case 'SUBMIT_PR':
        isComplete = this._executePR(agent, task.target);
        break;
      default:
        isComplete = true; // Skip unknown tasks
    }

    // Move to next step if complete
    if (isComplete) {
      agent.taskQueue.shift();
      if (window.gothamBus) {
        window.gothamBus.emit('TASK_STEP_COMPLETE', { agentId: agent.id, remaining: agent.taskQueue.length, taskType: task.type });
      }
    }
  }

  // --- Mock Execution Logic (To be wired into OmniTown pathfinding) ---

  _executeMove(agent, targetLatLon) {
    // In reality, this interfaces with A* graph.
    // For now, simple simulated movement step.
    agent.status = 'MOVING';
    return Math.random() > 0.8; // 20% chance to arrive per tick
  }

  _executeAudit(agent, targetRepo) {
    agent.status = 'AUDITING';
    if (window.gothamBus) {
      window.gothamBus.emit('WORLD_EVENT', { message: `Agent ${agent.id} is auditing ${targetRepo}` });
    }
    return Math.random() > 0.9; // 10% chance to finish per tick
  }

  _executePR(agent, targetRepo) {
    agent.status = 'SUBMITTING PR';
    if (window.gothamBus) {
      window.gothamBus.emit('WORLD_EVENT', { message: `Agent ${agent.id} submitted PR to ${targetRepo}` });
    }
    return true; // Instant completion
  }
}

window.gothamTaskSystem = new AgentTaskSystem();

