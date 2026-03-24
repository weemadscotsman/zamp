/**
 * WorldScaleManager for Gotham 3077 v2.0
 * Handles seamless zoom-based switching between Cesium globe and Tile World
 * v2.0 - Added proper cleanup and error boundaries
 * 
 * Threshold Logic:
 * - Tile World (< 500m): Detailed tactical view with agent simulation
 * - Region View (500m - 1000m): Transitional zone
 * - City View (1000m - 10000m): Named districts visible on globe
 * - Planet View (> 10000m): Full globe view
 */

class WorldScaleManager {
    /**
     * @param {Cesium.Viewer} viewer - Cesium.js viewer instance
     * @param {Object} options - Configuration options
     * @param {number} options.tileThreshold - Height to switch to tile world (default: 500m)
     * @param {number} options.regionThreshold - Height for region zoom level (default: 1000m)
     * @param {number} options.planetThreshold - Height for planet zoom level (default: 10000m)
     */
    constructor(viewer, options = {}) {
        this.viewer = viewer;
        this._isDestroyed = false;
        
        // Thresholds for zoom level transitions
        this.tileThreshold = options.tileThreshold || 500;
        this.regionThreshold = options.regionThreshold || 1000;
        this.planetThreshold = options.planetThreshold || 10000;
        
        // Current state tracking
        this.currentMode = 'planet';
        this.tileWorld = null;
        this.activeSector = null;
        
        // DOM elements
        this.tileCanvas = null;
        this.zoomIndicator = null;
        
        // Track camera change handler for cleanup
        this._boundCameraChange = this._onCameraChange.bind(this);
        
        // Error tracking
        this._errorCount = 0;
        this._maxErrors = 5;

        // Initialize
        try {
            this._createTileCanvas();
            this._createZoomIndicator();
            this._bindCameraListener();
            
            // Initial state check
            this._onCameraChange();
        } catch (error) {
            console.error('[WorldScaleManager] Initialization error:', error);
        }
    }
    
    /**
     * Creates the hidden canvas element for Tile World rendering.
     * Positioned above Cesium with full-screen coverage.
     * @private
     */
    _createTileCanvas() {
        this.tileCanvas = document.createElement('canvas');
        this.tileCanvas.id = 'tile-world-canvas';
        this.tileCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 100;
            display: none;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        `;
        document.body.appendChild(this.tileCanvas);
    }
    
    /**
     * Creates a visual indicator showing current zoom level.
     * Useful for debugging and user feedback.
     * @private
     */
    _createZoomIndicator() {
        this.zoomIndicator = document.createElement('div');
        this.zoomIndicator.id = 'zoom-level-indicator';
        this.zoomIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff9f;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            border: 1px solid #00ff9f;
            border-radius: 4px;
            z-index: 1000;
            pointer-events: none;
        `;
        document.body.appendChild(this.zoomIndicator);
    }
    
    /**
     * Binds to Cesium camera change events to monitor zoom level.
     * Debounced to prevent excessive updates during smooth camera movements.
     * @private
     */
    _bindCameraListener() {
        if (this.viewer && this.viewer.camera) {
            this.viewer.camera.changed.addEventListener(this._boundCameraChange);
            // Also listen to percentage changed for smoother transitions
            this.viewer.camera.percentageChanged = 0.01;
        }
    }
    
    /**
     * Main camera change handler.
     * Determines current zoom mode based on camera height and
     * triggers appropriate transitions.
     * @private
     */
    _onCameraChange() {
        if (this._isDestroyed) return;
        if (!this.viewer || !this.viewer.camera) return;
        
        // Error boundary - disable after too many errors
        if (this._errorCount >= this._maxErrors) {
            if (this._errorCount === this._maxErrors) {
                console.error('[WorldScaleManager] Max errors reached, disabling manager');
                this._errorCount++;
            }
            return;
        }
        
        try {
            // Get current camera position
            const height = this.viewer.camera.positionCartographic.height;
            const center = this.viewer.camera.positionCartographic;
            const lat = Cesium.Math.toDegrees(center.latitude);
            const lon = Cesium.Math.toDegrees(center.longitude);
            
            // Determine if we should be in tile world mode
            const shouldBeInTileMode = height < this.tileThreshold;
            
            // Handle mode transitions
            if (shouldBeInTileMode && this.currentMode !== 'tile') {
                this._enterTileWorld(lat, lon);
            } else if (!shouldBeInTileMode && this.currentMode === 'tile') {
                this._exitTileWorld();
            }
            
            // Update zoom indicator
            this._updateZoomIndicator(height);
        } catch (error) {
            this._errorCount++;
            console.error('[WorldScaleManager] Camera change error:', error);
        }
    }
    
    /**
     * Transitions from globe view to tile world view.
     * Fetches location data, initializes tile world simulation,
     * and manages visual transition effects.
     * 
     * @param {number} lat - Latitude of camera center
     * @param {number} lon - Longitude of camera center
     * @private
     */
    _enterTileWorld(lat, lon) {
        if (this._isDestroyed) return;
        
        try {
            console.log(`[WorldScaleManager] Entering Tile World at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
            
            // Store active sector coordinates
            this.activeSector = { lat, lon };
            
            // Fetch location data for procedural generation
            const locationData = this._fetchLocationData(lat, lon);
            
            // Check if TileWorldEngine exists before trying to use it
            if (typeof TileWorldEngine === 'undefined') {
                console.warn('[WorldScaleManager] TileWorldEngine not available');
                return;
            }
            
            // Create tile world engine instance
            this.tileWorld = new TileWorldEngine({
                canvas: this.tileCanvas,
                location: locationData,
                seed: `${lat},${lon}`
            });
            
            // Generate the world
            this.tileWorld.generate();
            
            // Spawn agents based on population density
            const agentCount = Math.min(100, Math.max(10, Math.floor(locationData.population / 1000)));
            this.tileWorld.spawnAgents(agentCount);
            
            // Visual transition: fade out Cesium
            const cesiumContainer = this.viewer.container;
            cesiumContainer.style.transition = 'opacity 0.5s ease';
            cesiumContainer.style.opacity = '0';
            cesiumContainer.style.pointerEvents = 'none';
            
            // Show tile canvas
            this.tileCanvas.style.display = 'block';
            this.tileCanvas.style.opacity = '0';
            
            // Fade in tile world
            requestAnimationFrame(() => {
                this.tileCanvas.style.transition = 'opacity 0.5s ease';
                this.tileCanvas.style.opacity = '1';
            });
            
            // Start simulation
            this.tileWorld.start();
            
            // Update state
            this.currentMode = 'tile';
            
            // Pause global updates to save resources
            if (window.gothamSystem) {
                window.gothamSystem.pauseUpdates = true;
            }
            
            // Dispatch event for other systems
            window.dispatchEvent(new CustomEvent('tile-world-entered', {
                detail: { lat, lon, location: locationData }
            }));
        } catch (error) {
            this._errorCount++;
            console.error('[WorldScaleManager] Error entering tile world:', error);
            // Attempt recovery
            this._exitTileWorld();
        }
    }
    
    /**
     * Transitions from tile world back to globe view.
     * Saves agent state, cleans up tile world resources,
     * and restores Cesium visibility.
     * @private
     */
    _exitTileWorld() {
        if (this._isDestroyed) return;
        
        try {
            console.log('[WorldScaleManager] Exiting Tile World');
            
            if (!this.tileWorld) return;
            
            // Save agent state for persistence
            if (this.activeSector) {
                try {
                    const agentState = this.tileWorld.getAgentState();
                    const storageKey = `gotham-agents-${this.activeSector.lat.toFixed(2)},${this.activeSector.lon.toFixed(2)}`;
                    localStorage.setItem(storageKey, JSON.stringify({
                        timestamp: Date.now(),
                        agents: agentState
                    }));
                } catch (e) {
                    console.warn('[WorldScaleManager] Could not save agent state:', e);
                }
            }
            
            // Destroy tile world instance
            try {
                this.tileWorld.destroy();
            } catch (e) {
                console.warn('[WorldScaleManager] Error destroying tile world:', e);
            }
            this.tileWorld = null;
            
            // Hide tile canvas
            this.tileCanvas.style.opacity = '0';
            setTimeout(() => {
                if (this.tileCanvas) {
                    this.tileCanvas.style.display = 'none';
                }
            }, 500);
            
            // Fade in Cesium
            const cesiumContainer = this.viewer.container;
            cesiumContainer.style.opacity = '1';
            cesiumContainer.style.pointerEvents = 'auto';
            
            // Update state
            this.currentMode = 'planet';
            this.activeSector = null;
            
            // Resume global updates
            if (window.gothamSystem) {
                window.gothamSystem.pauseUpdates = false;
            }
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('tile-world-exited'));
        } catch (error) {
            this._errorCount++;
            console.error('[WorldScaleManager] Error exiting tile world:', error);
        }
    }
    
    /**
     * Fetches location data for procedural generation.
     * Currently returns mock data; in production, this would
     * query a geolocation API or local database.
     * 
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Object} Location data with name, population, biome
     * @private
     */
    _fetchLocationData(lat, lon) {
        // Determine biome based on latitude
        let biome = 'temperate';
        if (Math.abs(lat) > 66.5) {
            biome = 'arctic';
        } else if (Math.abs(lat) < 23.5) {
            biome = 'tropical';
        } else if (Math.abs(lat) > 35) {
            biome = 'continental';
        }
        
        // Generate mock city data
        // In production, this would query actual geolocation data
        const cityNames = ['Neo-Tokyo', 'New Shanghai', 'Euro-City', 'Pan-America', 'Siberia Prime'];
        const name = cityNames[Math.floor(Math.abs(lon + lat) % cityNames.length)];
        
        // Population based on latitude (more people in temperate zones)
        let populationMultiplier = 1;
        if (biome === 'temperate') populationMultiplier = 2;
        if (biome === 'arctic') populationMultiplier = 0.3;
        
        const population = Math.floor(
            (100000 + Math.random() * 900000) * populationMultiplier
        );
        
        return {
            name,
            population,
            biome,
            coordinates: { lat, lon },
            techLevel: Math.floor(Math.random() * 5) + 1,
            faction: Math.random() > 0.5 ? 'corporate' : 'independent'
        };
    }
    
    /**
     * Updates the zoom level indicator UI and dispatches
     * zoom level change events for other systems.
     * 
     * @param {number} height - Camera height in meters
     * @private
     */
    _updateZoomIndicator(height) {
        if (!this.zoomIndicator) return;
        
        let level, levelName;
        
        if (height < this.tileThreshold) {
            level = 'tactical';
            levelName = 'TACTICAL VIEW';
        } else if (height < this.regionThreshold) {
            level = 'region';
            levelName = 'REGION VIEW';
        } else if (height < this.planetThreshold) {
            level = 'city';
            levelName = 'CITY VIEW';
        } else {
            level = 'planet';
            levelName = 'PLANET VIEW';
        }
        
        // Update indicator text
        this.zoomIndicator.textContent = `${levelName} | ${height.toFixed(0)}m`;
        
        // Color coding based on level
        const colors = {
            tactical: '#ff3366',
            region: '#ff9933',
            city: '#33ccff',
            planet: '#00ff9f'
        };
        this.zoomIndicator.style.borderColor = colors[level];
        this.zoomIndicator.style.color = colors[level];
        
        // Dispatch zoom level change event
        window.dispatchEvent(new CustomEvent('zoom-level-changed', {
            detail: { level, height, threshold: this[`${level}Threshold`] }
        }));
    }
    
    /**
     * Returns the current zoom mode.
     * @returns {string} Current mode: 'tile' or 'planet'
     */
    getCurrentMode() {
        return this.currentMode;
    }
    
    /**
     * Returns the active sector if in tile mode.
     * @returns {Object|null} Sector coordinates or null
     */
    getActiveSector() {
        return this.activeSector;
    }
    
    /**
     * Returns the current tile world instance.
     * @returns {TileWorldEngine|null} Active tile world or null
     */
    getTileWorld() {
        return this.tileWorld;
    }
    
    /**
     * Forcefully switches to tile world at specific coordinates.
     * Bypasses normal zoom threshold logic.
     * 
     * @param {number} lat - Target latitude
     * @param {number} lon - Target longitude
     */
    forceEnterTileWorld(lat, lon) {
        if (this.currentMode === 'tile') {
            this._exitTileWorld();
        }
        this._enterTileWorld(lat, lon);
    }
    
    /**
     * Forcefully exits tile world and returns to globe view.
     */
    forceExitTileWorld() {
        if (this.currentMode === 'tile') {
            this._exitTileWorld();
        }
    }
    
    /**
     * Cleans up all resources and event listeners.
     * Call this before destroying the manager.
     */
    destroy() {
        if (this._isDestroyed) return;
        this._isDestroyed = true;
        
        console.log('[WorldScaleManager] Destroying...');

        // Remove camera listener
        if (this.viewer && this.viewer.camera) {
            this.viewer.camera.changed.removeEventListener(this._boundCameraChange);
        }
        
        // Exit tile world if active
        if (this.currentMode === 'tile') {
            this._exitTileWorld();
        }
        
        // Remove DOM elements
        if (this.tileCanvas && this.tileCanvas.parentNode) {
            this.tileCanvas.parentNode.removeChild(this.tileCanvas);
        }
        if (this.zoomIndicator && this.zoomIndicator.parentNode) {
            this.zoomIndicator.parentNode.removeChild(this.zoomIndicator);
        }
        
        // Clear references
        this.tileCanvas = null;
        this.zoomIndicator = null;
        this.tileWorld = null;
        this.viewer = null;
        
        console.log('[WorldScaleManager] Destroyed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldScaleManager;
}

// Global access for browser
if (typeof window !== 'undefined') {
    window.WorldScaleManager = WorldScaleManager;
}
