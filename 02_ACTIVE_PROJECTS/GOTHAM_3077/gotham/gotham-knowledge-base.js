/**
 * gotham-knowledge-base.js
 * Agent Knowledge Base system for Gotham 3077
 * Integrates web search capabilities with agent memory systems
 * Provides fact storage, retrieval, and lifecycle management
 *
 * @module gotham/gotham-knowledge-base
 * @requires ./gotham-agent-memory.js
 *
 * @example
 * // Create knowledge base instance
 * const kb = new AgentKnowledgeBase();
 *
 * // Search for information
 * const facts = await kb.search('quantum computing');
 *
 * // Get relevant facts for a topic
 * const relevant = kb.getRelevantFacts('technology', 3);
 *
 * // Check statistics
 * const stats = kb.getStats();
 * console.log(`Stored ${stats.totalFacts} facts from ${stats.uniqueSources} sources`);
 */

/**
 * Generate a unique fact ID
 * @private
 * @returns {string} Unique identifier
 */
function generateFactId() {
  return `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * AgentKnowledgeBase class
 * Manages web-sourced knowledge for agents with persistent storage
 */
class AgentKnowledgeBase {
  /**
   * Creates a new AgentKnowledgeBase instance
   * Initializes empty fact and source storage maps
   *
   * @example
   * const kb = new AgentKnowledgeBase();
   * console.log('Knowledge base ready');
   */
  constructor() {
    /**
     * Stores facts indexed by unique ID
     * @type {Map<string, Object>}
     * @property {string} content - The fact content/text
     * @property {string} source - Source URL
     * @property {number} confidence - Confidence score (0-1)
     * @property {number} timestamp - When fact was added (ms since epoch)
     */
    this.facts = new Map();

    /**
     * Tracks which sources have contributed facts
     * @type {Map<string, Set<string>>}
     * Maps source URL to set of fact IDs from that source
     */
    this.sources = new Map();

    console.log('[AgentKnowledgeBase] Initialized');
  }

  /**
   * Performs web search and stores results as facts
   * Searches the web API and converts results to storable facts
   *
   * @async
   * @param {string} query - Search query string
   * @returns {Promise<Array<Object>>} Array of search results with added factIds
   * @throws {Error} If search request fails
   *
   * @example
   * const results = await kb.search('artificial intelligence');
   * results.forEach(r => console.log(r.snippet));
   */
  async search(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(`/api/search?q=${encodedQuery}&limit=5`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || data || [];

      // Store each result as a fact
      for (const result of results) {
        const factId = generateFactId();
        const fact = {
          content: result.snippet || result.content || result.title || 'No content',
          source: result.url || result.source || 'unknown',
          confidence: 0.7,
          timestamp: Date.now(),
          query: query,
          title: result.title || null
        };

        this.facts.set(factId, fact);

        // Track source
        const sourceUrl = fact.source;
        if (!this.sources.has(sourceUrl)) {
          this.sources.set(sourceUrl, new Set());
        }
        this.sources.get(sourceUrl).add(factId);

        // Attach factId to result for reference
        result.factId = factId;
      }

      console.log(`[AgentKnowledgeBase] Stored ${results.length} facts for query: "${query}"`);
      return results;

    } catch (error) {
      console.error('[AgentKnowledgeBase] Search error:', error);
      throw error;
    }
  }

  /**
   * Retrieves facts relevant to a topic using keyword matching
   * Performs case-insensitive search against all stored facts
   *
   * @param {string} topic - Topic to search for
   * @param {number} [limit=5] - Maximum number of facts to return
   * @returns {Array<Object>} Matching facts sorted by relevance
   *
   * @example
   * const facts = kb.getRelevantFacts('machine learning', 3);
   * facts.forEach(f => console.log(f.content));
   */
  getRelevantFacts(topic, limit = 5) {
    if (!topic || typeof topic !== 'string') {
      return [];
    }

    const keywords = topic.toLowerCase().split(/\s+/);
    const scored = [];

    for (const [factId, fact] of this.facts) {
      const content = (fact.content || '').toLowerCase();
      const title = (fact.title || '').toLowerCase();
      const query = (fact.query || '').toLowerCase();

      // Calculate relevance score based on keyword matches
      let score = 0;
      for (const keyword of keywords) {
        if (content.includes(keyword)) score += 1;
        if (title.includes(keyword)) score += 2;
        if (query.includes(keyword)) score += 3;
      }

      // Boost by confidence
      score *= (fact.confidence || 0.5);

      if (score > 0) {
        scored.push({
          factId,
          ...fact,
          relevanceScore: score
        });
      }
    }

    // Sort by relevance score descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored.slice(0, limit);
  }

  /**
   * Gets all facts from a specific source URL
   * Useful for verifying information from trusted sources
   *
   * @param {string} url - Source URL to filter by
   * @returns {Array<Object>} Facts from the specified source
   *
   * @example
   * const wikiFacts = kb.getFactsBySource('https://en.wikipedia.org/wiki/AI');
   */
  getFactsBySource(url) {
    if (!url || typeof url !== 'string') {
      return [];
    }

    const factIds = this.sources.get(url);
    if (!factIds) {
      return [];
    }

    const facts = [];
    for (const factId of factIds) {
      const fact = this.facts.get(factId);
      if (fact) {
        facts.push({
          factId,
          ...fact
        });
      }
    }

    // Sort by timestamp (newest first)
    return facts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Removes facts older than specified age
   * Default cleanup removes facts older than 24 hours
   *
   * @param {number} [maxAgeMs=86400000] - Maximum age in milliseconds (default: 24 hours)
   * @returns {number} Number of facts removed
   *
   * @example
   * // Clear facts older than 1 hour
   * const removed = kb.clearOldFacts(60 * 60 * 1000);
   * console.log(`Cleared ${removed} old facts`);
   */
  clearOldFacts(maxAgeMs = 86400000) {
    const cutoff = Date.now() - maxAgeMs;
    const toRemove = [];

    for (const [factId, fact] of this.facts) {
      if (fact.timestamp < cutoff) {
        toRemove.push(factId);
      }
    }

    // Remove from facts map and sources map
    for (const factId of toRemove) {
      const fact = this.facts.get(factId);
      this.facts.delete(factId);

      if (fact && fact.source) {
        const sourceFacts = this.sources.get(fact.source);
        if (sourceFacts) {
          sourceFacts.delete(factId);
          if (sourceFacts.size === 0) {
            this.sources.delete(fact.source);
          }
        }
      }
    }

    if (toRemove.length > 0) {
      console.log(`[AgentKnowledgeBase] Cleared ${toRemove.length} old facts`);
    }

    return toRemove.length;
  }

  /**
   * Gets statistics about the knowledge base
   * Includes counts, source diversity, and age information
   *
   * @returns {Object} Statistics object
   * @property {number} totalFacts - Total number of stored facts
   * @property {number} uniqueSources - Number of unique source URLs
   * @property {number|null} oldestFact - Timestamp of oldest fact (null if empty)
   * @property {number|null} newestFact - Timestamp of newest fact (null if empty)
   *
   * @example
   * const stats = kb.getStats();
   * console.log(`${stats.totalFacts} facts from ${stats.uniqueSources} sources`);
   */
  getStats() {
    const timestamps = [];
    for (const fact of this.facts.values()) {
      timestamps.push(fact.timestamp);
    }

    return {
      totalFacts: this.facts.size,
      uniqueSources: this.sources.size,
      oldestFact: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestFact: timestamps.length > 0 ? Math.max(...timestamps) : null
    };
  }

  /**
   * Gets a specific fact by ID
   *
   * @param {string} factId - Fact identifier
   * @returns {Object|null} Fact object or null if not found
   */
  getFact(factId) {
    return this.facts.get(factId) || null;
  }

  /**
   * Manually adds a fact to the knowledge base
   * Useful for adding verified facts from other sources
   *
   * @param {string} content - Fact content
   * @param {string} source - Source URL or identifier
   * @param {number} [confidence=0.8] - Confidence score (0-1)
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {string} The generated fact ID
   */
  addFact(content, source, confidence = 0.8, metadata = {}) {
    const factId = generateFactId();
    const fact = {
      content,
      source,
      confidence: Math.max(0, Math.min(1, confidence)),
      timestamp: Date.now(),
      ...metadata
    };

    this.facts.set(factId, fact);

    if (!this.sources.has(source)) {
      this.sources.set(source, new Set());
    }
    this.sources.get(source).add(factId);

    return factId;
  }

  /**
   * Clears all facts from the knowledge base
   * Use with caution - irreversible operation
   */
  clear() {
    const count = this.facts.size;
    this.facts.clear();
    this.sources.clear();
    console.log(`[AgentKnowledgeBase] Cleared ${count} facts`);
  }
}

// =============================================================================
// AGENT INTEGRATION
// =============================================================================

/**
 * Extends an agent object with knowledge base capabilities
 * Adds the considerKnowledge method to the agent
 *
 * @param {Object} agent - Agent object to extend
 * @param {AgentKnowledgeBase} knowledgeBase - Knowledge base instance
 * @returns {Object} The extended agent (same reference)
 *
 * @example
 * const agent = simulation.spawnAgent('mage', 40.7, -74.0);
 * extendAgentWithKnowledge(agent, kb);
 *
 * // Now agent can use knowledge base
 * const facts = await agent.considerKnowledge('magic spells');
 */
function extendAgentWithKnowledge(agent, knowledgeBase) {
  if (!agent || !knowledgeBase) {
    throw new Error('Agent and knowledgeBase are required');
  }

  // Store reference to knowledge base on agent
  agent.knowledgeBase = knowledgeBase;

  /**
   * Searches knowledge base for information and stores results in agent memory
   * Updates agent chemicals based on curiosity/dopamine reward
   *
   * @async
   * @param {string} topic - Topic to research
   * @returns {Promise<Array<Object>|null>} Facts found or null if none
   *
   * @example
   * // Agent researches a topic
   * const facts = await agent.considerKnowledge('ancient ruins');
   * if (facts) {
   *   console.log(`Agent learned ${facts.length} facts`);
   * }
   */
  agent.considerKnowledge = async function(topic) {
    if (!this.knowledgeBase) {
      console.warn(`[Agent ${this.id}] No knowledge base attached`);
      return null;
    }

    const facts = await this.knowledgeBase.search(topic);

    if (facts.length > 0) {
      // Ensure agent has memory array
      if (!this.memory) {
        this.memory = [];
      }

      // Handle both array memory (simple) and structured memory (from createAgentMemory)
      if (Array.isArray(this.memory)) {
        this.memory.push({
          type: 'knowledge_acquired',
          topic,
          facts: facts.map(f => f.snippet || f.content || f.title || 'Unknown'),
          timestamp: Date.now()
        });
      } else if (this.memory.event && typeof this.memory.event.recordEvent === 'function') {
        // Use structured event memory if available
        this.memory.event.recordEvent('knowledge_acquired', this.position, 0.6, {
          topic,
          factCount: facts.length,
          factIds: facts.map(f => f.factId)
        });
      }

      // Update chemicals - curiosity satisfied, dopamine reward
      if (!this.chemicals) {
        this.chemicals = {
          dopamine: 0.5,
          cortisol: 0.1,
          oxytocin: 0.3,
          adrenaline: 0,
          serotonin: 0.5,
          curiosity: 50 // Default curiosity level
        };
      }

      // Curiosity decreases as knowledge is acquired
      this.chemicals.curiosity = Math.max(0, (this.chemicals.curiosity || 50) - 20);

      // Dopamine increases from learning reward
      this.chemicals.dopamine = Math.min(100, (this.chemicals.dopamine || 0.5) + 10);

      console.log(`[Agent ${this.id}] Acquired ${facts.length} facts about "${topic}"`);
      return facts;
    }

    return null;
  };

  /**
   * Gets relevant facts from knowledge base without searching
   * Uses existing stored facts
   *
   * @param {string} topic - Topic to find facts for
   * @param {number} [limit=3] - Maximum facts to return
   * @returns {Array<Object>} Relevant facts
   */
  agent.recallKnowledge = function(topic, limit = 3) {
    if (!this.knowledgeBase) {
      return [];
    }
    return this.knowledgeBase.getRelevantFacts(topic, limit);
  };

  return agent;
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
  window.AgentKnowledgeBase = AgentKnowledgeBase;
  window.extendAgentWithKnowledge = extendAgentWithKnowledge;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AgentKnowledgeBase,
    extendAgentWithKnowledge
  };
}

// =============================================================================
// EXAMPLE USAGE (for documentation)
// =============================================================================

/**
 * Example: Setting up knowledge base for agent system
 *
 * ```javascript
 * // Create global knowledge base
 * const globalKnowledge = new AgentKnowledgeBase();
 *
 * // Spawn agent and extend with knowledge capabilities
 * const agent = simulation.spawnAgent('mage', 40.7128, -74.0060);
 * extendAgentWithKnowledge(agent, globalKnowledge);
 *
 * // Agent researches topics
 * async function researchLoop() {
 *   // Search for information
 *   const facts = await agent.considerKnowledge('quantum computing');
 *
 *   // Later, recall relevant facts
 *   const relevant = agent.recallKnowledge('quantum', 2);
 *
 *   // Check knowledge base stats
 *   console.log(globalKnowledge.getStats());
 *
 *   // Clear old facts periodically
 *   setInterval(() => {
 *     globalKnowledge.clearOldFacts(24 * 60 * 60 * 1000);
 *   }, 60 * 60 * 1000);
 * }
 *
 * researchLoop();
 * ```
 */
