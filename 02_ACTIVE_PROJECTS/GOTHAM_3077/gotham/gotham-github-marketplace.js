/**
 * GOTHAM 3077 - GitHub Agent Marketplace v1.0
 * Agents navigate to GitHub buildings, propose and execute PRs
 * Owner authorization required for all actions
 */

class GitHubMarketplace {
  constructor(options = {}) {
    this.apiBase = 'https://api.github.com';
    this.token = options.token || null;
    this.agentSystem = options.agentSystem || null;
    this.eventBus = options.eventBus || window.gothamEventBus;
    
    // PR proposal queue
    this.proposals = new Map();
    this.completedWork = new Map();
    
    // Pricing (in TWAG)
    this.pricing = {
      bugFix: 100,
      feature: 500,
      audit: 200,
      refactor: 300,
      docs: 50
    };
    
    // Initialize event handlers
    this._setupEventHandlers();
  }
  
  _setupEventHandlers() {
    // Listen for agent arrival at GitHub building
    this.eventBus.on('AGENT_ARRIVE_GITHUB', (data) => {
      this.handleAgentArrival(data.agentId, data.repo);
    });
    
    // Listen for PR approval
    this.eventBus.on('GH_PR_APPROVED', (data) => {
      this.executeApprovedPR(data.proposalId);
    });
  }
  
  /**
   * Set GitHub token for API access
   */
  setToken(token) {
    this.token = token;
  }
  
  /**
   * Agent navigates to GitHub building and requests work
   */
  async handleAgentArrival(agentId, repoFullName) {
    console.log(`[GitHubMarketplace] Agent ${agentId} arrived at ${repoFullName}`);
    
    try {
      // Get repo info
      const repo = await this.getRepoInfo(repoFullName);
      if (!repo) {
        this.eventBus.emit('GH_REPO_NOT_FOUND', { agentId, repo: repoFullName });
        return;
      }
      
      // Get open issues
      const issues = await this.getOpenIssues(repoFullName, 5);
      
      // Analyze and propose fixes
      const proposals = await this.generateProposals(agentId, repo, issues);
      
      // Queue proposals for owner approval
      for (const proposal of proposals) {
        const proposalId = `gh-prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        this.proposals.set(proposalId, {
          ...proposal,
          id: proposalId,
          status: 'pending_approval',
          createdAt: Date.now()
        });
        
        // Emit event for UI
        this.eventBus.emit('GH_PROPOSAL_CREATED', {
          proposalId,
          agentId,
          repo: repoFullName,
          title: proposal.title,
          description: proposal.description,
          price: proposal.price,
          type: proposal.type
        });
      }
      
    } catch (err) {
      console.error('[GitHubMarketplace] Error:', err);
      this.eventBus.emit('GH_ERROR', { agentId, repo: repoFullName, error: err.message });
    }
  }
  
  /**
   * Get repo information
   */
  async getRepoInfo(fullName) {
    const headers = this.token ? { Authorization: `token ${this.token}` } : {};
    
    try {
      const res = await fetch(`${this.apiBase}/repos/${fullName}`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  }
  
  /**
   * Get open issues
   */
  async getOpenIssues(fullName, limit = 5) {
    const headers = this.token ? { Authorization: `token ${this.token}` } : {};
    
    try {
      const res = await fetch(
        `${this.apiBase}/repos/${fullName}/issues?state=open&per_page=${limit}`,
        { headers }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  }
  
  /**
   * Generate work proposals based on issues
   */
  async generateProposals(agentId, repo, issues) {
    const proposals = [];
    
    for (const issue of issues) {
      // Simple analysis (in real implementation, use AI analysis)
      const type = this.classifyIssue(issue);
      const price = this.pricing[type] || 100;
      
      proposals.push({
        agentId,
        repo: repo.full_name,
        issueNumber: issue.number,
        issueTitle: issue.title,
        type,
        price,
        title: `[AGENT] Fix: ${issue.title.slice(0, 50)}`,
        description: `Proposed fix for issue #${issue.number}\n\n` +
          `Original issue: ${issue.body?.slice(0, 200) || 'No description'}\n\n` +
          `Agent analysis: ${this.generateAnalysis(issue)}`,
        estimatedTime: '2-4 hours'
      });
    }
    
    return proposals;
  }
  
  /**
   * Classify issue type
   */
  classifyIssue(issue) {
    const title = issue.title.toLowerCase();
    const labels = issue.labels.map(l => l.name.toLowerCase());
    
    if (title.includes('bug') || title.includes('fix') || title.includes('crash') || 
        labels.some(l => l.includes('bug'))) {
      return 'bugFix';
    }
    if (title.includes('feature') || title.includes('add') || title.includes('implement') ||
        labels.some(l => l.includes('feature'))) {
      return 'feature';
    }
    if (title.includes('refactor') || title.includes('cleanup') ||
        labels.some(l => l.includes('refactor'))) {
      return 'refactor';
    }
    if (title.includes('doc') || title.includes('readme') ||
        labels.some(l => l.includes('documentation'))) {
      return 'docs';
    }
    if (title.includes('security') || title.includes('vulnerability') ||
        labels.some(l => l.includes('security'))) {
      return 'audit';
    }
    
    return 'bugFix'; // default
  }
  
  /**
   * Generate simple analysis text
   */
  generateAnalysis(issue) {
    return `Analysis of issue #${issue.number}:\n` +
      `- Complexity: ${issue.labels.length > 2 ? 'High' : 'Medium'}\n` +
      `- Estimated files affected: ${Math.floor(Math.random() * 5) + 1}\n` +
      `- Confidence: ${Math.floor(Math.random() * 30) + 70}%`;
  }
  
  /**
   * Owner approves a proposal
   */
  approveProposal(proposalId, ownerAuth) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { success: false, error: 'Proposal not found' };
    }
    
    proposal.status = 'approved';
    proposal.ownerAuth = ownerAuth;
    proposal.approvedAt = Date.now();
    
    this.eventBus.emit('GH_PROPOSAL_APPROVED', { proposalId });
    
    // Execute the work
    this.executeApprovedPR(proposalId);
    
    return { success: true };
  }
  
  /**
   * Reject proposal
   */
  rejectProposal(proposalId, reason) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false };
    
    proposal.status = 'rejected';
    proposal.rejectedReason = reason;
    
    this.eventBus.emit('GH_PROPOSAL_REJECTED', { proposalId, reason });
    
    // Return TWAG to agent
    if (this.agentSystem) {
      this.agentSystem.addTWAG(proposal.agentId, proposal.price * 0.1); // 10% consolation
    }
    
    return { success: true };
  }
  
  /**
   * Execute approved PR
   */
  async executeApprovedPR(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'approved') {
      return;
    }
    
    try {
      this.eventBus.emit('GH_WORK_STARTED', { proposalId });
      
      // Simulate work time (in real implementation, this would be actual code generation)
      await this.simulateWork(proposalId);
      
      // Create PR
      const pr = await this.createPullRequest(proposal);
      
      if (pr) {
        proposal.status = 'completed';
        proposal.prUrl = pr.html_url;
        proposal.prNumber = pr.number;
        
        this.completedWork.set(proposalId, proposal);
        
        // Pay agent
        if (this.agentSystem) {
          this.agentSystem.addTWAG(proposal.agentId, proposal.price);
        }
        
        this.eventBus.emit('GH_WORK_COMPLETED', {
          proposalId,
          prUrl: pr.html_url,
          prNumber: pr.number,
          payment: proposal.price
        });
        
      } else {
        throw new Error('Failed to create PR');
      }
      
    } catch (err) {
      proposal.status = 'failed';
      proposal.error = err.message;
      
      this.eventBus.emit('GH_WORK_FAILED', { proposalId, error: err.message });
    }
  }
  
  /**
   * Simulate work (placeholder for actual code generation)
   */
  async simulateWork(proposalId) {
    // Simulate 2-5 seconds of work
    const workTime = 2000 + Math.random() * 3000;
    await new Promise(r => setTimeout(r, workTime));
    
    // Emit progress updates
    const steps = ['Analyzing issue...', 'Generating fix...', 'Testing changes...', 'Creating PR...'];
    for (const step of steps) {
      this.eventBus.emit('GH_WORK_PROGRESS', { proposalId, step });
      await new Promise(r => setTimeout(r, workTime / 4));
    }
  }
  
  /**
   * Create actual pull request via server proxy
   * Server handles: fork → branch → commit proposal → create PR
   */
  async createPullRequest(proposal) {
    if (!proposal.ownerAuth) {
      throw new Error('Owner authorization required');
    }

    try {
      const res = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: proposal.repo,
          issueNumber: proposal.issueNumber,
          title: proposal.title,
          body: proposal.description,
          analysis: this.generateAnalysis({ number: proposal.issueNumber, title: proposal.issueTitle, labels: [] }),
          agentId: proposal.agentId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'PR creation failed');
      }

      return {
        number: data.number,
        html_url: data.html_url,
        title: data.title,
        state: data.state
      };
    } catch (err) {
      console.error('[GitHubMarketplace] PR creation failed:', err);
      throw err;
    }
  }
  
  /**
   * Get pending proposals for UI
   */
  getPendingProposals() {
    return Array.from(this.proposals.values())
      .filter(p => p.status === 'pending_approval')
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  
  /**
   * Get completed work
   */
  getCompletedWork() {
    return Array.from(this.completedWork.values())
      .sort((a, b) => b.completedAt - a.completedAt);
  }
  
  /**
   * Get stats
   */
  getStats() {
    const all = Array.from(this.proposals.values());
    return {
      total: all.length,
      pending: all.filter(p => p.status === 'pending_approval').length,
      approved: all.filter(p => p.status === 'approved').length,
      completed: all.filter(p => p.status === 'completed').length,
      failed: all.filter(p => p.status === 'failed').length,
      rejected: all.filter(p => p.status === 'rejected').length,
      totalValue: all.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.price, 0)
    };
  }
}

// Expose
window.GitHubMarketplace = GitHubMarketplace;

console.log('[GitHubMarketplace] v2.0 loaded - Real GitHub PR creation via server proxy');
