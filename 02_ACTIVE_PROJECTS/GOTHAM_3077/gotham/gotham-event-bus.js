/**
 * GOTHAM 3077 - Global Event Bus v2.0
 * System-wide event coordination for all modules
 * Extends WorldStreamingEventBus with additional features
 */

class GothamEventBus {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistory = 1000;
    this.debugMode = false;
    this.middleware = [];
    this.stats = {
      eventsEmitted: 0,
      eventsHandled: 0,
      errors: 0
    };
    
    // Event categories for filtering
    this.categories = {
      SYSTEM: ['SYS_BOOT', 'SYS_SHUTDOWN', 'SYS_ERROR'],
      TELEMETRY: ['TEL_FLIGHT', 'TEL_SATELLITE', 'TEL_WEATHER', 'TEL_TRAFFIC'],
      AGENT: ['AGENT_SPAWN', 'AGENT_ACTION', 'AGENT_DEATH', 'AGENT_TRADE'],
      GITHUB: ['GH_PR_CREATED', 'GH_PR_MERGED', 'GH_REPO_VISIT'],
      SCENARIO: ['SCEN_TRIGGER', 'SCEN_EFFECT', 'SCEN_END'],
      COVERAGE: ['COV_UPDATE', 'COV_GAP', 'COV_RESTORE']
    };
    
    // Start stats reporting
    this._startStatsReporting();
  }
  
  /**
   * Subscribe to an event
   */
  on(event, callback, options = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const listener = {
      callback,
      options,
      id: Math.random().toString(36).slice(2),
      created: Date.now(),
      errorCount: 0
    };
    
    this.listeners.get(event).push(listener);
    
    // Sort by priority (higher first)
    this.listeners.get(event).sort((a, b) => 
      (b.options.priority || 0) - (a.options.priority || 0)
    );
    
    if (this.debugMode) {
      console.log(`[EventBus] + '${event}' (listeners: ${this.listeners.get(event).length})`);
    }
    
    return () => this.off(event, callback);
  }
  
  /**
   * Subscribe once
   */
  once(event, callback) {
    return this.on(event, callback, { once: true });
  }
  
  /**
   * Subscribe to all events in a category
   */
  onCategory(category, callback) {
    const events = this.categories[category] || [];
    const unsubscribers = events.map(event => this.on(event, callback));
    
    return () => unsubscribers.forEach(unsub => unsub());
  }
  
  /**
   * Unsubscribe
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.callback === callback);
    if (index > -1) {
      listeners.splice(index, 1);
      if (this.debugMode) {
        console.log(`[EventBus] - '${event}' (listeners: ${listeners.length})`);
      }
    }
  }
  
  /**
   * Add middleware (intercept/modify events)
   */
  use(middlewareFn) {
    this.middleware.push(middlewareFn);
  }
  
  /**
   * Emit event
   */
  emit(event, data, metadata = {}) {
    // Run middleware
    let processedData = data;
    for (const mw of this.middleware) {
      try {
        processedData = mw(event, processedData, metadata) || processedData;
      } catch (err) {
        console.error(`[EventBus] Middleware error:`, err);
      }
    }
    
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) {
      return false;
    }
    
    const eventData = {
      event,
      data: processedData,
      source: metadata.source || 'unknown',
      timestamp: metadata.timestamp || Date.now(),
      id: Math.random().toString(36).slice(2)
    };
    
    // Add to history
    this.eventHistory.push(eventData);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
    
    // Notify listeners with error isolation
    const toRemove = [];
    for (const listener of listeners) {
      try {
        listener.callback(eventData.data, eventData);
        this.stats.eventsHandled++;
        listener.errorCount = 0; // Reset on success

        if (listener.options.once) {
          toRemove.push(listener);
        }
      } catch (err) {
        this.stats.errors++;
        listener.errorCount = (listener.errorCount || 0) + 1;
        console.error(`[EventBus] Error in '${event}' handler (fault #${listener.errorCount}):`, err);

        // Auto-remove handlers that fail 5+ times consecutively
        if (listener.errorCount >= 5) {
          console.warn(`[EventBus] Removing faulty handler for '${event}' after ${listener.errorCount} consecutive errors`);
          toRemove.push(listener);
        }
      }
    }

    // Remove once listeners and faulty listeners
    toRemove.forEach(listener => {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    });
    
    this.stats.eventsEmitted++;
    
    if (this.debugMode) {
      console.log(`[EventBus] → '${event}' (${listeners.length} handlers)`);
    }
    
    return true;
  }
  
  /**
   * Emit with delay
   */
  emitDelayed(event, data, delayMs, metadata = {}) {
    setTimeout(() => this.emit(event, data, metadata), delayMs);
  }
  
  /**
   * Get event history
   */
  getHistory(eventFilter = null, limit = 100) {
    let history = this.eventHistory;
    
    if (eventFilter) {
      history = history.filter(e => e.event === eventFilter);
    }
    
    return history.slice(-limit);
  }
  
  /**
   * Get listeners for event
   */
  getListeners(event) {
    return this.listeners.get(event) || [];
  }
  
  /**
   * Get all active events
   */
  getActiveEvents() {
    return Array.from(this.listeners.keys()).filter(event => 
      this.listeners.get(event).length > 0
    );
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      activeEvents: this.getActiveEvents().length,
      totalListeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      historySize: this.eventHistory.length
    };
  }
  
  /**
   * Clear history
   */
  clearHistory() {
    this.eventHistory = [];
  }
  
  /**
   * Enable/disable debug
   */
  setDebug(enabled) {
    this.debugMode = enabled;
  }
  
  /**
   * Reset all
   */
  reset() {
    this.listeners.clear();
    this.eventHistory = [];
    this.middleware = [];
    this.stats = { eventsEmitted: 0, eventsHandled: 0, errors: 0 };
  }
  
  /**
   * Auto-report stats
   */
  _startStatsReporting() {
    setInterval(() => {
      if (this.stats.eventsEmitted > 0 && this.debugMode) {
        console.log('[EventBus Stats]', this.getStats());
      }
    }, 60000);
  }
}

// Create global instance
window.GothamEventBus = GothamEventBus;
window.gothamEventBus = new GothamEventBus();

// Legacy compatibility - also expose as EventBus
window.EventBus = GothamEventBus;

console.log('[GothamEventBus] v2.0 initialized - System-wide event coordination active');
