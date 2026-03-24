/**
 * GOTHAM 3077 - ShadowBroker Data Bridge v1.0
 * Integrates ShadowBroker OSINT feeds with viewport-based loading
 */

class ShadowBrokerBridge {
  constructor(viewer, entitySystem) {
    this.viewer = viewer;
    this.entitySystem = entitySystem;
    this._isDestroyed = false;
    
    // API endpoints
    this.API_BASE = '';
    this.FAST_ENDPOINT = `${this.API_BASE}/api/live-data/fast`;
    this.SLOW_ENDPOINT = `${this.API_BASE}/api/live-data/slow`;
    
    // Polling intervals (ms)
    this.FAST_INTERVAL = 15000;  // 15s for moving entities
    this.SLOW_INTERVAL = 300000; // 5min for static data
    
    // State
    this._fastTimer = null;
    this._slowTimer = null;
    this._viewportTimer = null;
    this._lastViewport = null;
    this._isLoading = false;
    
    // Cache for deduplication
    this._dataCache = new Map();
    
    this._init();
  }

  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    
    if (this._fastTimer) clearInterval(this._fastTimer);
    if (this._slowTimer) clearInterval(this._slowTimer);
    if (this._viewportTimer) clearTimeout(this._viewportTimer);
    
    console.log('[SHADOWBROKER] Bridge destroyed');
  }

  _init() {
    // Initial data load
    this._fetchFastData();
    this._fetchSlowData();
    
    // Start polling
    this._fastTimer = setInterval(() => this._fetchFastData(), this.FAST_INTERVAL);
    this._slowTimer = setInterval(() => this._fetchSlowData(), this.SLOW_INTERVAL);
    
    // Viewport-based loading
    this._setupViewportListener();
    
    console.log('[SHADOWBROKER] Bridge initialized');
  }

  _setupViewportListener() {
    // Listen for camera movement end
    this.viewer.camera.moveEnd.addEventListener(() => {
      // Debounce viewport updates
      if (this._viewportTimer) clearTimeout(this._viewportTimer);
      this._viewportTimer = setTimeout(() => {
        this._onViewportChange();
      }, 500);
    });
  }

  _onViewportChange() {
    if (this._isDestroyed || this._isLoading) return;
    
    const rect = this._getViewportBounds();
    if (!rect) return;
    
    // Only reload if viewport changed significantly (>10%)
    if (this._lastViewport && this._viewportOverlap(rect, this._lastViewport) > 0.9) {
      return;
    }
    
    this._lastViewport = rect;
    this._fetchFastData(rect);
    // Slow data updates less frequently, don't fetch on every viewport change
  }

  _getViewportBounds() {
    try {
      const rect = this.viewer.camera.computeViewRectangle();
      if (!rect) return null;
      
      return {
        s: Cesium.Math.toDegrees(rect.south),
        w: Cesium.Math.toDegrees(rect.west),
        n: Cesium.Math.toDegrees(rect.north),
        e: Cesium.Math.toDegrees(rect.east)
      };
    } catch (e) {
      console.warn('[SHADOWBROKER] Could not compute viewport:', e);
      return null;
    }
  }

  _viewportOverlap(a, b) {
    // Simple overlap calculation for debouncing
    const latOverlap = Math.max(0, Math.min(a.n, b.n) - Math.max(a.s, b.s));
    const lonOverlap = Math.max(0, Math.min(a.e, b.e) - Math.max(a.w, b.w));
    const aArea = (a.n - a.s) * (a.e - a.w);
    const overlapArea = latOverlap * lonOverlap;
    return aArea > 0 ? overlapArea / aArea : 0;
  }

  async _fetchFastData(viewport = null) {
    if (this._isLoading) return;
    this._isLoading = true;

    try {
      // Try Python backend endpoint first
      let url = this.FAST_ENDPOINT;
      if (viewport) {
        url += `?s=${viewport.s.toFixed(4)}&w=${viewport.w.toFixed(4)}&n=${viewport.n.toFixed(4)}&e=${viewport.e.toFixed(4)}`;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this._processFastData(data);

    } catch (err) {
      console.warn('[SHADOWBROKER] Fast data fetch failed, using bbox fallback:', err.message);
      // Fallback: use server.cjs /api/bbox which has ALL data from DataStore
      try {
        const vp = viewport || this._getViewportBounds();
        if (vp) {
          const bboxUrl = `/api/bbox?west=${vp.w.toFixed(4)}&south=${vp.s.toFixed(4)}&east=${vp.e.toFixed(4)}&north=${vp.n.toFixed(4)}&zoom=5`;
          const fallbackRes = await fetch(bboxUrl, { signal: AbortSignal.timeout(8000) });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            this._dispatchToEntitySystem(data);
            console.log('[SHADOWBROKER] Bbox fallback delivered data');
          }
        } else {
          // No viewport yet - fetch full snapshot
          const fallbackRes = await fetch('/api/data', { signal: AbortSignal.timeout(8000) });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            this._dispatchToEntitySystem(data);
            console.log('[SHADOWBROKER] Full snapshot fallback delivered data');
          }
        }
      } catch (fallbackErr) {
        console.warn('[SHADOWBROKER] Fallback also failed:', fallbackErr.message);
      }
    } finally {
      this._isLoading = false;
    }
  }

  async _fetchSlowData() {
    try {
      const viewport = this._getViewportBounds();
      let url = this.SLOW_ENDPOINT;
      if (viewport) {
        url += `?s=${viewport.s.toFixed(4)}&w=${viewport.w.toFixed(4)}&n=${viewport.n.toFixed(4)}&e=${viewport.e.toFixed(4)}`;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this._processSlowData(data);

    } catch (err) {
      console.warn('[SHADOWBROKER] Slow data fetch failed, using bbox fallback:', err.message);
      // Fallback: use server.cjs /api/bbox
      try {
        const vp = this._getViewportBounds();
        if (vp) {
          const bboxUrl = `/api/bbox?west=${vp.w.toFixed(4)}&south=${vp.s.toFixed(4)}&east=${vp.e.toFixed(4)}&north=${vp.n.toFixed(4)}&zoom=5`;
          const fallbackRes = await fetch(bboxUrl, { signal: AbortSignal.timeout(8000) });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            this._dispatchToEntitySystem(data);
            console.log('[SHADOWBROKER] Slow bbox fallback delivered data');
          }
        }
      } catch (fallbackErr) {
        console.warn('[SHADOWBROKER] Slow fallback also failed:', fallbackErr.message);
      }
    }
  }

  _processFastData(data) {
    if (!data || !this.entitySystem) return;

    // Map backend keys to frontend data keys
    const mapped = {
      flights: [...(data.commercial_flights || []), ...(data.private_flights || []), ...(data.private_jets || [])],
      military: data.military_flights || [],
      ships: data.ships || [],
      cctv: data.cctv || [],
      satellites: data.satellites || [],
      transit: data.transit || [],
      neos: data.neos || [],
      stars: data.stars || [],
      meteors: data.meteors || [],
      aliens: [...(data.ufo_sightings || []), ...(data.alien_activity || [])],
      gps_jamming: data.gps_jamming || [],
      traffic: data.traffic || []
    };

    // Add UAVs to military
    if (data.uavs && data.uavs.length > 0) {
      mapped.military = [...mapped.military, ...data.uavs];
    }

    // Add tracked flights if present
    if (data.tracked_flights && data.tracked_flights.length > 0) {
      mapped.tracked_flights = data.tracked_flights;
    }
    
    // Dispatch to entity system
    this._dispatchToEntitySystem(mapped);
    
    // Log stats
    const counts = Object.entries(mapped)
      .filter(([_, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ');
    console.log('[SHADOWBROKER] Fast data:', counts);
  }

  _processSlowData(data) {
    if (!data || !this.entitySystem) return;

    // Map backend keys to frontend data keys
    // NOTE: Entity system _updateLayers expects specific key names
    const mapped = {
      news: data.news || [],
      stocks: data.stocks ? [data.stocks] : [],
      oil: data.oil ? [data.oil] : [],
      earthquakes: data.earthquakes || [],
      frontlines: data.frontlines ? (Array.isArray(data.frontlines) ? data.frontlines : [data.frontlines]) : [],
      gdacs: data.gdacs || data.gdelt || [],
      kiwisdr: data.kiwisdr || [],
      internet_outages: data.internet_outages || [],
      wildfires: data.firms_fires || data.wildfires || [],
      datacenters: data.datacenters || [],
      military_bases: data.military_bases || [],
      power_plants: data.power_plants || [],
      weather: Array.isArray(data.weather) ? data.weather : (data.weather ? [data.weather] : []),
      spacewx: Array.isArray(data.space_weather) ? data.space_weather : (data.space_weather ? [data.space_weather] : []),
      neos: data.neos || [],
      stars: data.stars || [],
      meteors: data.meteors || [],
      traffic: data.traffic || [],
      aliens: data.aliens || data.ufo_sightings || []
    };
    
    // Dispatch to entity system
    this._dispatchToEntitySystem(mapped);
    
    // Log stats
    const counts = Object.entries(mapped)
      .filter(([_, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ');
    console.log('[SHADOWBROKER] Slow data:', counts);
  }

  _dispatchToEntitySystem(data) {
    // Merge with entity system's data cache
    if (this.entitySystem.dataCache) {
      Object.assign(this.entitySystem.dataCache, data);
    } else {
      this.entitySystem.dataCache = data;
    }
    
    // Trigger layer update
    this.entitySystem._updateLayers(data);
    
    // Dispatch event for other systems
    window.dispatchEvent(new CustomEvent('gotham-data', { detail: data }));
  }

  // Public API for manual refresh
  refresh() {
    this._fetchFastData(this._getViewportBounds());
    this._fetchSlowData();
  }

  // Get current viewport stats
  getStats() {
    const viewport = this._getViewportBounds();
    return {
      viewport: viewport,
      lastUpdate: this.entitySystem?.dataCache?.last_updated || null,
      isLoading: this._isLoading
    };
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShadowBrokerBridge };
}
