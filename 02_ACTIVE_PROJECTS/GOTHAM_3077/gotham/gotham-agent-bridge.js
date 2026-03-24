/**
 * AgentCesiumBridge - Maps agents from the OmniTown framework to Cesium entities
 * @module gotham/gotham-agent-bridge
 */

/**
 * @typedef {Object} Agent
 * @property {string} id - Unique agent identifier
 * @property {string} name - Agent display name
 * @property {string} type - Agent type (warrior, trader, thief, mage, worker, berserker)
 * @property {number} latitude - Current latitude
 * @property {number} longitude - Current longitude
 * @property {string} state - Current agent state
 * @property {Object} stats - Agent statistics
 */

/**
 * Agent type color mapping
 * @constant {Object.<string, string>}
 */
const AGENT_COLORS = {
  warrior: '#ff4444',
  trader: '#22c55e',
  thief: '#f97316',
  mage: '#a855f7',
  worker: '#3b82f6',
  berserker: '#ec4899',
};

/**
 * Agent type display names
 * @constant {Object.<string, string>}
 */
const AGENT_TYPE_NAMES = {
  warrior: 'Warrior',
  trader: 'Trader',
  thief: 'Thief',
  mage: 'Mage',
  worker: 'Worker',
  berserker: 'Berserker',
};

/**
 * Maximum visible agents for performance
 * @constant {number}
 */
const MAX_VISIBLE_AGENTS = 500;

/**
 * Minimum update interval in milliseconds
 * @constant {number}
 */
const UPDATE_INTERVAL = 500;

/**
 * Billboard size in pixels
 * @constant {number}
 */
const BILLBOARD_SIZE = 32;

/**
 * Main bridge class for mapping agents to Cesium entities
 */
class AgentCesiumBridge {
  /**
   * Creates an AgentCesiumBridge instance
   * @param {Object} viewer - Cesium Viewer instance
   * @param {Object} entitySystem - Entity management system reference
   */
  _initCommandListener() {
      window.addEventListener('gotham-agent-command', (e) => {
        const data = e.detail;
        if (data && data.command) {
          this.processAgentCommand(data.command, data.agentId);
        }
      });
      console.log('[AGENT BRIDGE] Command listener initialized');
    }

    processAgentCommand(cmd, agentId) {
      console.log(`[AGENT BRIDGE] Received command from ${agentId}:`, cmd);
      const text = (cmd.text || '').toLowerCase();
      
      // Alien specific checks
      if (text.includes('guide') && (text.includes('alien') || text.includes('ufo'))) {
         this._sysLog("SOCKET: INITIATING FIRST CONTACT / GUIDANCE PROTOCOL");
         this.viewer.camera.flyTo({ 
           destination: Cesium.Cartesian3.fromDegrees(-115.81, 37.24, 50000), // Area 51
           duration: 4
         });
         return;
      }
      
      // Pan to specific regions
      if (text.includes('ukraine')) {
        this.viewer.camera.flyTo({ 
          destination: Cesium.Cartesian3.fromDegrees(31.16, 48.37, 1200000),
          duration: 3
        });
        if (window.gothamHUD) window.gothamHUD.layerVisibility.intel = true;
      } else if (text.includes('taiwan')) {
        this.viewer.camera.flyTo({ 
          destination: Cesium.Cartesian3.fromDegrees(120.96, 23.69, 1000000),
          duration: 3
        });
        if (window.gothamHUD) window.gothamHUD.layerVisibility.intel = true;
      } else if (text.includes('red sea') || text.includes('suez')) {
        this.viewer.camera.flyTo({ 
          destination: Cesium.Cartesian3.fromDegrees(38.0, 20.0, 1500000),
          duration: 3
        });
        if (window.gothamHUD) window.gothamHUD.layerVisibility.sea = true;
      }
      
      // Filter/Highlight specific layers
      if (text.includes('show') || text.includes('highlight')) {
        if (text.includes('flights')) {
          if (window.gothamHUD) {
            window.gothamHUD.layerVisibility.flight = true;
            this._sysLog("AGENT CMD: HIGHLIGHTING FLIGHT NETWORK");
          }
        if (text.includes('alien') || text.includes('ufo') || text.includes('confused')) {
          if (window.gothamHUD) {
            window.gothamHUD.layerVisibility.intel = true; // mapped alien to intel
            // Also explicitly toggle aliens
            const btn = document.getElementById('gtog-aliens');
            if (btn && !btn.style.color.includes('fff')) btn.click();
            this._sysLog("SOCKET: HIGHLIGHTING ALIEN / UFO ACTIVITY");
          }
        }
  
        }
        if (text.includes('ships')) {
          if (window.gothamHUD) {
            window.gothamHUD.layerVisibility.sea = true;
            this._sysLog("AGENT CMD: HIGHLIGHTING MARITIME FEEDS");
          }
        }
      }
    }

    _sysLog(msg) {
      if (window.gothamHUD) window.gothamHUD._sysLog(msg);
    }

  constructor(viewer, entitySystem) {
    if (!viewer) {
      throw new Error('Cesium viewer is required');
    }
    if (!entitySystem) {
      throw new Error('Entity system is required');
    }

    this.viewer = viewer;
    this.entitySystem = entitySystem;

    /** @type {Map<string, string>} Maps agent ID to Cesium entity ID */
    this.agentEntities = new Map();

    /** @type {Map<string, HTMLCanvasElement>} Stores generated billboard images for agent types */
    this.agentBillboards = new Map();

    /** @type {number} Last position update timestamp */
    this.lastUpdateTime = 0;

    /** @type {Set<string>} Agents pending position updates */
    this.pendingUpdates = new Set();

    /** @type {Object|null} BillboardCollection for batch rendering */
    this.billboardCollection = null;

    /** @type {Map<string, Object>} Billboard ID to agent mapping */
    this.billboardToAgent = new Map();

    /** @type {Map<string, number>} Active highlight timeout IDs */
    this._highlightTimeouts = new Map();
    this._initCommandListener();

    this._initializeBillboardCollection();
    this._preGenerateBillboards();
    this._startUpdateLoop();
  }

  /**
   * Initializes the BillboardCollection for performance
   * @private
   */
  _initializeBillboardCollection() {
    try {
      if (this.viewer.scene && this.viewer.scene.primitives) {
        this.billboardCollection = this.viewer.scene.primitives.add(
          new Cesium.BillboardCollection()
        );
      }
    } catch (error) {
      console.warn('Failed to initialize BillboardCollection:', error);
    }
  }

  /**
   * Pre-generates billboard canvases for all agent types
   * @private
   */
  _preGenerateBillboards() {
    Object.keys(AGENT_COLORS).forEach((type) => {
      const canvas = this._createAgentIcon(type);
      this.agentBillboards.set(type, canvas);
    });
  }

  /**
   * Creates a circular icon canvas for an agent type
   * @param {string} agentType - The agent type
   * @returns {HTMLCanvasElement} The generated canvas
   * @private
   */
  _createAgentIcon(agentType) {
    const canvas = document.createElement('canvas');
    canvas.width = BILLBOARD_SIZE;
    canvas.height = BILLBOARD_SIZE;
    const ctx = canvas.getContext('2d');

    const color = AGENT_COLORS[agentType] || AGENT_COLORS.worker;
    const center = BILLBOARD_SIZE / 2;
    const radius = (BILLBOARD_SIZE / 2) - 2;

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    return canvas;
  }

  /**
   * Starts the throttled update loop
   * @private
   */
  _startUpdateLoop() {
    const updateLoop = () => {
      const now = Date.now();
      if (now - this.lastUpdateTime >= UPDATE_INTERVAL) {
        this._processPendingUpdates();
        this.lastUpdateTime = now;
      }
      requestAnimationFrame(updateLoop);
    };
    requestAnimationFrame(updateLoop);
  }

  /**
   * Processes all pending position updates
   * @private
   */
  _processPendingUpdates() {
    if (this.pendingUpdates.size === 0) return;

    try {
      this.pendingUpdates.forEach((agentId) => {
        this._applyPositionUpdate(agentId);
      });
      this.pendingUpdates.clear();
    } catch (error) {
      console.error('Error processing pending updates:', error);
    }
  }

  /**
   * Applies a single position update
   * @param {string} agentId - The agent ID
   * @private
   */
  _applyPositionUpdate(agentId) {
    const entityId = this.agentEntities.get(agentId);
    if (!entityId) return;

    const entity = this.viewer.entities.getById(entityId);
    if (!entity) return;

    const agent = this.entitySystem.getAgent(agentId);
    if (!agent) return;

    if (entity.position) {
      entity.position = Cesium.Cartesian3.fromDegrees(
        agent.longitude,
        agent.latitude,
        0
      );
    }
  }

  /**
   * Creates a Cesium billboard entity for an agent
   * @param {Agent} agent - The agent to create an entity for
   * @returns {string|null} The created entity ID or null on failure
   */
  createAgentEntity(agent) {
    try {
      if (!agent || !agent.id) {
        throw new Error('Invalid agent object');
      }

      if (this.agentEntities.has(agent.id)) {
        console.warn(`Entity already exists for agent ${agent.id}`);
        return this.agentEntities.get(agent.id);
      }

      if (this.agentEntities.size >= MAX_VISIBLE_AGENTS) {
        console.warn('Maximum visible agents reached');
        return null;
      }

      const canvas = this.agentBillboards.get(agent.type) ||
        this.agentBillboards.get('worker');

      const entity = this.viewer.entities.add({
        id: `agent-${agent.id}`,
        position: Cesium.Cartesian3.fromDegrees(
          agent.longitude,
          agent.latitude,
          0
        ),
        billboard: {
          image: canvas,
          width: BILLBOARD_SIZE,
          height: BILLBOARD_SIZE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        },
        label: {
          text: `${agent.name}\n${agent.state}`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, -BILLBOARD_SIZE),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
        },
        properties: {
          agentId: agent.id,
          agentType: agent.type,
        },
      });

      this.agentEntities.set(agent.id, entity.id);

      this._dispatchAgentEvent('agent-created', {
        agentId: agent.id,
        entityId: entity.id,
        type: agent.type,
        position: { lat: agent.latitude, lon: agent.longitude }
      });

      // EXTENSION HOOK: Memory visualization will attach here
      // Future: entity.memoryVisualization = this._createMemoryOverlay(agent);

      // EXTENSION HOOK: BehaviorGraph inspection will attach here
      // Future: entity.behaviorGraph = this._createBehaviorGraphOverlay(agent);

      // EXTENSION HOOK: WorldInfluence visualization will attach here
      // Future: entity.influenceZone = this._createInfluenceVisualization(agent);

      return entity.id;
    } catch (error) {
      console.error('Failed to create agent entity:', error);
      return null;
    }
  }

  /**
   * Updates an agent's entity position from agent's lat/lon
   * @param {Agent} agent - The agent with updated position
   */
  updateAgentPosition(agent) {
    try {
      if (!agent || !agent.id) {
        throw new Error('Invalid agent object');
      }

      if (!this.agentEntities.has(agent.id)) {
        this.createAgentEntity(agent);
        return;
      }

      this.pendingUpdates.add(agent.id);
    } catch (error) {
      console.error('Failed to update agent position:', error);
    }
  }

  /**
   * Removes an agent's entity from the globe
   * @param {string} agentId - The agent ID to remove
   * @returns {boolean} True if removed successfully
   */
  removeAgentEntity(agentId) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required');
      }

      const entityId = this.agentEntities.get(agentId);
      if (!entityId) {
        return false;
      }

      const entity = this.viewer.entities.getById(entityId);
      if (entity) {
        // EXTENSION HOOK: Clean up Memory visualization here
        // Future: this._cleanupMemoryOverlay(entity);

        // EXTENSION HOOK: Clean up BehaviorGraph inspection here
        // Future: this._cleanupBehaviorGraphOverlay(entity);

        // EXTENSION HOOK: Clean up WorldInfluence visualization here
        // Future: this._cleanupInfluenceVisualization(entity);

        this.viewer.entities.remove(entity);
      }

      this.agentEntities.delete(agentId);
      this.pendingUpdates.delete(agentId);

      this._clearHighlightTimeout(agentId);

      this._dispatchAgentEvent('agent-removed', {
        agentId: agentId,
        entityId: entityId
      });

      return true;
    } catch (error) {
      console.error('Failed to remove agent entity:', error);
      return false;
    }
  }

  /**
   * Opens an info panel with agent statistics
   * @param {Agent} agent - The agent to display details for
   */
  showAgentDetails(agent) {
    try {
      if (!agent || !agent.id) {
        throw new Error('Invalid agent object');
      }

      const infoPanel = this._getOrCreateInfoPanel();

      const typeName = AGENT_TYPE_NAMES[agent.type] || 'Unknown';
      const color = AGENT_COLORS[agent.type] || AGENT_COLORS.worker;

      infoPanel.innerHTML = `
        <div class="agent-info-header" style="border-left-color: ${color}">
          <h3>${agent.name}</h3>
          <span class="agent-type">${typeName}</span>
        </div>
        <div class="agent-info-content">
          <div class="info-row">
            <span class="info-label">ID:</span>
            <span class="info-value">${agent.id}</span>
          </div>
          <div class="info-row">
            <span class="info-label">State:</span>
            <span class="info-value">${agent.state}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Position:</span>
            <span class="info-value">${agent.latitude.toFixed(6)}, ${agent.longitude.toFixed(6)}</span>
          </div>
          ${this._formatStats(agent.stats)}
        </div>
      `;

      infoPanel.style.display = 'block';

      // EXTENSION HOOK: Memory panel integration point
      // Future: this._attachMemoryPanel(agent, infoPanel);

      // EXTENSION HOOK: BehaviorGraph panel integration point
      // Future: this._attachBehaviorGraphPanel(agent, infoPanel);

      // EXTENSION HOOK: WorldInfluence panel integration point
      // Future: this._attachInfluencePanel(agent, infoPanel);
    } catch (error) {
      console.error('Failed to show agent details:', error);
    }
  }

  /**
   * Gets or creates the info panel element
   * @returns {HTMLElement} The info panel element
   * @private
   */
  _getOrCreateInfoPanel() {
    let panel = document.getElementById('agent-info-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'agent-info-panel';
      panel.className = 'agent-info-panel';
      document.body.appendChild(panel);
    }
    return panel;
  }

  /**
   * Formats agent stats for display
   * @param {Object} stats - Agent statistics
   * @returns {string} HTML string for stats
   * @private
   */
  _formatStats(stats) {
    if (!stats || typeof stats !== 'object') {
      return '';
    }

    const rows = Object.entries(stats)
      .map(([key, value]) => `
        <div class="info-row">
          <span class="info-label">${key}:</span>
          <span class="info-value">${value}</span>
        </div>
      `)
      .join('');

    return rows ? `<div class="stats-section">${rows}</div>` : '';
  }

  /**
   * Temporarily highlights an agent entity
   * @param {string} agentId - The agent ID to highlight
   * @param {string|Object} color - Highlight color (hex string or Cesium.Color)
   */
  highlightAgent(agentId, color = '#ffff00') {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required');
      }

      const entityId = this.agentEntities.get(agentId);
      if (!entityId) {
        console.warn(`No entity found for agent ${agentId}`);
        return;
      }

      const entity = this.viewer.entities.getById(entityId);
      if (!entity || !entity.billboard) {
        return;
      }

      const originalScale = entity.billboard.scale || 1.0;

      let cesiumColor;
      if (typeof color === 'string') {
        cesiumColor = Cesium.Color.fromCssColorString(color);
      } else {
        cesiumColor = color;
      }

      entity.billboard.color = cesiumColor;
      entity.billboard.scale = 1.5;

      this._clearHighlightTimeout(agentId);

      const timeoutId = setTimeout(() => {
        try {
          const currentEntity = this.viewer.entities.getById(entityId);
          if (currentEntity && currentEntity.billboard) {
            currentEntity.billboard.color = Cesium.Color.WHITE;
            currentEntity.billboard.scale = originalScale;
          }
          this._highlightTimeouts.delete(agentId);
        } catch (e) {
          console.warn('Error resetting highlight:', e);
        }
      }, 2000);

      this._highlightTimeouts.set(agentId, timeoutId);
    } catch (error) {
      console.error('Failed to highlight agent:', error);
    }
  }

  /**
   * Clears highlight timeout for an agent
   * @param {string} agentId - The agent ID
   * @private
   */
  _clearHighlightTimeout(agentId) {
    const existingTimeout = this._highlightTimeouts.get(agentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this._highlightTimeouts.delete(agentId);
    }
  }

  /**
   * Dispatches a CustomEvent for agent lifecycle events
   * @param {string} eventType - Event type name
   * @param {Object} detail - Event detail data
   * @private
   */
  _dispatchAgentEvent(eventType, detail) {
    if (typeof window !== 'undefined' && window.document) {
      const event = new CustomEvent(eventType, { detail });
      window.dispatchEvent(event);
    }
  }

  /**
   * Gets the Cesium entity ID for an agent
   * @param {string} agentId - The agent ID
   * @returns {string|undefined} The entity ID
   */
  getEntityId(agentId) {
    return this.agentEntities.get(agentId);
  }

  /**
   * Gets all tracked agent IDs
   * @returns {string[]} Array of agent IDs
   */
  getAllAgentIds() {
    return Array.from(this.agentEntities.keys());
  }

  /**
   * Clears all agent entities from the globe
   */
  clearAll() {
    try {
      this.agentEntities.forEach((entityId, agentId) => {
        this.removeAgentEntity(agentId);
      });
      this.agentEntities.clear();
      this.pendingUpdates.clear();
    } catch (error) {
      console.error('Failed to clear all agents:', error);
    }
  }

  /**
   * Disposes of the bridge and cleans up resources
   */
  dispose() {
    try {
      this.clearAll();

      this._highlightTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      this._highlightTimeouts.clear();

      if (this.billboardCollection) {
        this.viewer.scene.primitives.remove(this.billboardCollection);
        this.billboardCollection = null;
      }

      this.agentBillboards.clear();
      this.billboardToAgent.clear();
    } catch (error) {
      console.error('Error during disposal:', error);
    }
  }
}

window.AgentCesiumBridge = AgentCesiumBridge;
window.AGENT_COLORS = AGENT_COLORS;
window.AGENT_TYPE_NAMES = AGENT_TYPE_NAMES;
