/**
 * GOTHAM 3077 - AGENT ECONOMY v1.0
 * TWAG Token Flow and Resource Distribution
 */
class AgentEconomy {
  constructor() {
    console.log('[ECONOMY] System online');
    if (window.gothamBus) {
      window.gothamBus.on('TASK_STEP_COMPLETE', (payload) => this._rewardAgent(payload));
    }
  }

  _rewardAgent(payload) {
    if (!window.gothamWorldState) return;
    const state = window.gothamWorldState.state;
    const agent = state.agents.find(a => a.id === payload.agentId);
    
    if (agent && payload.taskType === 'SUBMIT_PR') {
      const reward = 50 + Math.floor(Math.random() * 50); // 50-100 TWAG
      agent.twag = (agent.twag || 0) + reward;
      state.economy.totalVolume += reward;
      state.economy.transactions.push({
        time: Date.now(),
        agent: agent.id,
        amount: reward,
        type: 'EARN_PR_MERGE'
      });
      
      if (window.gothamBus) {
        window.gothamBus.emit('ECONOMY_TRANSACTION', { agent: agent.id, amount: reward });
      }
    }
  }
}
window.gothamEconomy = new AgentEconomy();
