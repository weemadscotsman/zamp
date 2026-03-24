/**
 * gotham-sector-manager.js
 * Sectorization optimization for the Gotham agent simulation.
 * Divides the planet into grid sectors, only simulates agents near the camera,
 * freezes distant ones to save CPU.
 */

/**
 * Default sector configuration
 * @constant {Object}
 */
const SECTOR_DEFAULTS = {
  sectorSizeKm: 2,
  maxActiveRadius: 50,
  edgeRadiusMultiplier: 1.5,
  fullTickRateMs: 1000,
  edgeTickRateMs: 5000,
  altitudeScaleFactor: 0.00005,
  minActiveSectors: 4,
  maxActiveSectors: 200,
  updateIntervalMs: 2000
};

class SectorManager {
  /**
   * Creates a SectorManager instance.
   * @param {Object} viewer - Cesium Viewer instance
   * @param {Object} [options={}] - Configuration options
   */
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.config = { ...SECTOR_DEFAULTS, ...options };

    /** @type {Set<string>} Currently active (full-tick) sector keys */
    this._activeSectors = new Set();

    /** @type {Set<string>} Edge sectors (reduced tick rate) */
    this._edgeSectors = new Set();

    /** @type {Object|null} Last known camera position { lat, lon, alt } */
    this._lastCameraPos = null;

    /** @type {number} Last sector update timestamp */
    this._lastUpdateTime = 0;

    /** @type {Map<string, number>} Sector key -> last tick timestamp for edge sectors */
    this._edgeTickTimestamps = new Map();

    /** @type {number} Total agents tracked */
    this._totalAgents = 0;

    /** @type {number} Active agents (in active/edge sectors) */
    this._activeAgents = 0;

    /** @type {number} Frozen agents */
    this._frozenAgents = 0;

    this._startUpdateLoop();
    console.log('[SectorManager] Initialized with sector size:', this.config.sectorSizeKm, 'km');
  }

  /**
   * Hashes lat/lon to a sector grid key.
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @returns {string} Sector key
   */
  _getSectorKey(lat, lon) {
    const degreesPerSector = this.config.sectorSizeKm / 111;
    const sectorX = Math.floor(lon / degreesPerSector);
    const sectorY = Math.floor(lat / degreesPerSector);
    return `${sectorX},${sectorY}`;
  }

  /**
   * Gets camera position from Cesium viewer.
   * @returns {Object|null} { lat, lon, alt } or null
   * @private
   */
  _getCameraPosition() {
    try {
      if (!this.viewer || !this.viewer.camera) return null;

      const carto = this.viewer.camera.positionCartographic;
      if (!carto) return null;

      return {
        lat: Cesium.Math.toDegrees(carto.latitude),
        lon: Cesium.Math.toDegrees(carto.longitude),
        alt: carto.height
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Calculates the active radius in sectors based on camera altitude.
   * Zoomed in = small radius (few sectors), zoomed out = larger radius.
   * @param {number} altitude - Camera altitude in meters
   * @returns {number} Radius in number of sectors
   * @private
   */
  _calculateActiveRadius(altitude) {
    const baseRadius = Math.max(
      this.config.minActiveSectors,
      Math.min(
        this.config.maxActiveSectors,
        Math.sqrt(altitude * this.config.altitudeScaleFactor) * 10
      )
    );
    return Math.ceil(baseRadius);
  }

  /**
   * Updates which sectors are active based on current camera position.
   * Called periodically by the update loop.
   * @private
   */
  _updateActiveSectors() {
    const camPos = this._getCameraPosition();
    if (!camPos) return;

    this._lastCameraPos = camPos;
    this._activeSectors.clear();
    this._edgeSectors.clear();

    const degreesPerSector = this.config.sectorSizeKm / 111;
    const centerSectorX = Math.floor(camPos.lon / degreesPerSector);
    const centerSectorY = Math.floor(camPos.lat / degreesPerSector);

    const activeRadius = this._calculateActiveRadius(camPos.alt);
    const edgeRadius = Math.ceil(activeRadius * this.config.edgeRadiusMultiplier);

    for (let dy = -edgeRadius; dy <= edgeRadius; dy++) {
      for (let dx = -edgeRadius; dx <= edgeRadius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const key = `${centerSectorX + dx},${centerSectorY + dy}`;

        if (dist <= activeRadius) {
          this._activeSectors.add(key);
        } else if (dist <= edgeRadius) {
          this._edgeSectors.add(key);
        }
      }
    }
  }

  /**
   * Starts the periodic sector update loop.
   * @private
   */
  _startUpdateLoop() {
    const update = () => {
      const now = Date.now();
      if (now - this._lastUpdateTime >= this.config.updateIntervalMs) {
        this._updateActiveSectors();
        this._lastUpdateTime = now;
      }
      this._updateRAF = requestAnimationFrame(update);
    };
    this._updateRAF = requestAnimationFrame(update);
  }

  /**
   * Returns the set of active sector keys.
   * @returns {Set<string>}
   */
  getActiveSectors() {
    return this._activeSectors;
  }

  /**
   * Determines whether an agent at the given position should be ticked.
   * Returns 'active' (full tick), 'edge' (reduced tick), or 'frozen'.
   * @param {number} lat - Agent latitude
   * @param {number} lon - Agent longitude
   * @returns {string} 'active', 'edge', or 'frozen'
   */
  getAgentTickState(lat, lon) {
    const key = this._getSectorKey(lat, lon);

    if (this._activeSectors.has(key)) {
      return 'active';
    }
    if (this._edgeSectors.has(key)) {
      return 'edge';
    }
    return 'frozen';
  }

  /**
   * Checks if an agent should be fully simulated this tick.
   * Active agents always tick. Edge agents tick at reduced rate. Frozen agents skip.
   * @param {number} lat - Agent latitude
   * @param {number} lon - Agent longitude
   * @returns {boolean} Whether the agent should be processed this tick
   */
  isAgentActive(lat, lon) {
    const state = this.getAgentTickState(lat, lon);

    if (state === 'active') return true;
    if (state === 'frozen') return false;

    // Edge sector: throttled tick rate
    const key = this._getSectorKey(lat, lon);
    const now = Date.now();
    const lastTick = this._edgeTickTimestamps.get(key) || 0;

    if (now - lastTick >= this.config.edgeTickRateMs) {
      this._edgeTickTimestamps.set(key, now);
      return true;
    }
    return false;
  }

  /**
   * Returns statistics about the sector system.
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      totalSectors: this._activeSectors.size + this._edgeSectors.size,
      activeSectors: this._activeSectors.size,
      edgeSectors: this._edgeSectors.size,
      cameraPosition: this._lastCameraPos,
      activeRadius: this._lastCameraPos
        ? this._calculateActiveRadius(this._lastCameraPos.alt)
        : 0,
      config: {
        sectorSizeKm: this.config.sectorSizeKm,
        maxActiveRadius: this.config.maxActiveRadius
      }
    };
  }

  /**
   * Disposes of the sector manager and stops the update loop.
   */
  dispose() {
    if (this._updateRAF) {
      cancelAnimationFrame(this._updateRAF);
      this._updateRAF = null;
    }
    this._activeSectors.clear();
    this._edgeSectors.clear();
    this._edgeTickTimestamps.clear();
    console.log('[SectorManager] Disposed');
  }
}

window.SectorManager = SectorManager;
