/**
 * GOTHAM 3077 - Satellite Coverage System v1.0
 * Calculates and visualizes satellite ground footprints
 */

class SatelliteCoverageSystem {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.coverageEntities = new Map();
    this.satellites = new Map();
    
    // Configuration
    this.earthRadius = 6371; // km
    this.showCoverage = true;
    this.showGaps = true;
    this.coverageOpacity = 0.3;
    this.updateInterval = 5000; // 5 seconds
    
    // Coverage types
    this.coverageTypes = {
      IMAGING: { color: Cesium.Color.CYAN, angle: 15 },
      COMMUNICATION: { color: Cesium.Color.GREEN, angle: 60 },
      NAVIGATION: { color: Cesium.Color.YELLOW, angle: 45 },
      INTERNET: { color: Cesium.Color.BLUE, angle: 60 }
    };
    
    // Start update loop
    this._startUpdateLoop();
  }
  
  /**
   * Add satellite to tracking
   */
  addSatellite(satId, tle1, tle2, type = 'IMAGING') {
    // Parse TLE using satellite.js
    const satrec = satellite.twoline2satrec(tle1, tle2);
    
    this.satellites.set(satId, {
      id: satId,
      satrec,
      type,
      coverage: this.coverageTypes[type] || this.coverageTypes.IMAGING
    });
    
    // Create coverage entity
    this._createCoverageEntity(satId);
  }
  
  /**
   * Remove satellite
   */
  removeSatellite(satId) {
    const entity = this.coverageEntities.get(satId);
    if (entity) {
      this.viewer.entities.remove(entity);
      this.coverageEntities.delete(satId);
    }
    this.satellites.delete(satId);
  }
  
  /**
   * Calculate coverage radius from altitude
   */
  calculateCoverageRadius(altitudeKm, fieldOfViewDeg = 60) {
    // Simple cone geometry
    // coverage angle from nadir point
    const earthRadius = this.earthRadius;
    const totalRadius = earthRadius + altitudeKm;
    
    // Maximum coverage angle
    const maxAngle = Math.acos(earthRadius / totalRadius) * (180 / Math.PI);
    
    // Actual coverage is limited by sensor FOV or horizon, whichever is smaller
    const coverageAngle = Math.min(fieldOfViewDeg / 2, maxAngle);
    
    // Ground radius in km
    const groundRadius = earthRadius * Math.sin(coverageAngle * Math.PI / 180);
    
    return {
      radiusKm: groundRadius,
      angle: coverageAngle,
      maxPossible: maxAngle
    };
  }
  
  /**
   * Get current satellite position
   */
  getSatellitePosition(satId, date = new Date()) {
    const sat = this.satellites.get(satId);
    if (!sat) return null;
    
    const positionAndVelocity = satellite.propagate(sat.satrec, date);
    
    if (!positionAndVelocity.position) return null;
    
    // Convert to lat/lon/alt
    const gmst = satellite.gstime(date);
    const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    
    return {
      lat: satellite.degreesLat(position.latitude),
      lon: satellite.degreesLong(position.longitude),
      alt: position.height
    };
  }
  
  /**
   * Create or update coverage entity
   */
  _createCoverageEntity(satId) {
    const entity = this.viewer.entities.add({
      id: `coverage-${satId}`,
      show: this.showCoverage
    });
    
    this.coverageEntities.set(satId, entity);
    return entity;
  }
  
  /**
   * Update all coverage displays
   */
  updateAll() {
    const now = new Date();
    
    for (const [satId, sat] of this.satellites) {
      const pos = this.getSatellitePosition(satId, now);
      if (!pos) continue;
      
      const coverage = this.calculateCoverageRadius(pos.alt, sat.coverage.angle);
      this._updateCoverageDisplay(satId, pos, coverage, sat.coverage.color);
    }
    
    // Update gap analysis
    if (this.showGaps) {
      this._updateGapAnalysis();
    }
  }
  
  /**
   * Update single coverage display
   */
  _updateCoverageDisplay(satId, position, coverage, color) {
    const entity = this.coverageEntities.get(satId);
    if (!entity) return;
    
    const radiusMeters = Math.max(50000, coverage.radiusKm * 1000); // Cesium minimum ~12.5m, use 50km floor

    // Update ellipse
    entity.position = Cesium.Cartesian3.fromDegrees(position.lon, position.lat, 0);
    entity.ellipse = {
      semiMajorAxis: radiusMeters,
      semiMinorAxis: radiusMeters,
      material: color.withAlpha(this.coverageOpacity),
      outline: true,
      outlineColor: color,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    };
    
    // Update label with altitude
    entity.label = {
      text: `${satId}\n${Math.round(position.alt)}km`,
      font: '10px "Share Tech Mono"',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -10)
    };
  }
  
  /**
   * Calculate coverage gaps
   */
  _updateGapAnalysis() {
    // Simplified: sample points on globe and check if covered
    // In real implementation, use spatial indexing
    
    const gaps = [];
    const now = new Date();
    
    // Sample grid (simplified - just check major cities)
    const cities = [
      { name: 'London', lat: 51.5, lon: 0 },
      { name: 'NYC', lat: 40.7, lon: -74 },
      { name: 'Tokyo', lat: 35.7, lon: 139.7 },
      { name: 'Sydney', lat: -33.9, lon: 151.2 }
    ];
    
    for (const city of cities) {
      let covered = false;
      let bestSat = null;
      let bestSignal = 0;
      
      for (const [satId, sat] of this.satellites) {
        const pos = this.getSatellitePosition(satId, now);
        if (!pos) continue;
        
        const distance = this._haversine(city.lat, city.lon, pos.lat, pos.lon);
        const coverage = this.calculateCoverageRadius(pos.alt, sat.coverage.angle);
        
        if (distance <= coverage.radiusKm) {
          covered = true;
          // Signal strength based on center proximity
          const signal = 1 - (distance / coverage.radiusKm);
          if (signal > bestSignal) {
            bestSignal = signal;
            bestSat = satId;
          }
        }
      }
      
      if (!covered) {
        gaps.push({
          location: city,
          severity: 'HIGH'
        });
      }
    }
    
    // Emit gap event if any found
    if (gaps.length > 0) {
      if (window.gothamEventBus) {
        window.gothamEventBus.emit('COV_GAP', { gaps, timestamp: now });
      }
    }
  }
  
  /**
   * Haversine distance calculation
   */
  _haversine(lat1, lon1, lat2, lon2) {
    const R = this.earthRadius;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  /**
   * Start update loop
   */
  _startUpdateLoop() {
    setInterval(() => this.updateAll(), this.updateInterval);
  }
  
  /**
   * Toggle coverage display
   */
  toggleCoverage(show) {
    this.showCoverage = show !== undefined ? show : !this.showCoverage;
    
    for (const [satId, entity] of this.coverageEntities) {
      entity.show = this.showCoverage;
    }
  }
  
  /**
   * Toggle gap analysis
   */
  toggleGaps(show) {
    this.showGaps = show !== undefined ? show : !this.showGaps;
  }
  
  /**
   * Set coverage opacity
   */
  setOpacity(opacity) {
    this.coverageOpacity = Math.max(0, Math.min(1, opacity));
    this.updateAll();
  }
  
  /**
   * Get coverage stats
   */
  getStats() {
    const now = new Date();
    let totalCoverage = 0;
    
    for (const [satId, sat] of this.satellites) {
      const pos = this.getSatellitePosition(satId, now);
      if (pos) {
        const coverage = this.calculateCoverageRadius(pos.alt, sat.coverage.angle);
        totalCoverage += Math.PI * coverage.radiusKm * coverage.radiusKm; // km²
      }
    }
    
    return {
      trackedSatellites: this.satellites.size,
      totalCoverageAreaKm2: Math.round(totalCoverage),
      earthCoveragePercent: Math.min(100, (totalCoverage / (4 * Math.PI * this.earthRadius * this.earthRadius)) * 100).toFixed(2)
    };
  }
  
  /**
   * Export coverage data
   */
  exportCoverage() {
    const data = [];
    const now = new Date();
    
    for (const [satId, sat] of this.satellites) {
      const pos = this.getSatellitePosition(satId, now);
      if (pos) {
        const coverage = this.calculateCoverageRadius(pos.alt, sat.coverage.angle);
        data.push({
          satId,
          position: pos,
          coverage,
          type: sat.type
        });
      }
    }
    
    return data;
  }

  /**
   * Connect to live satellite data feed
   * Listens for gotham-data events and auto-adds/updates satellites
   */
  connectToDataFeed() {
    window.addEventListener('gotham-data', (e) => {
      const data = e.detail;
      if (!data || !data.satellites) return;

      for (const sat of data.satellites) {
        // Only process satellites with TLE data
        if (!sat.tle1 || !sat.tle2) continue;

        const satId = sat.id || sat.name || `sat-${sat.noradId}`;

        if (this.satellites.has(satId)) {
          // Update existing — re-parse TLE in case it changed
          try {
            const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
            this.satellites.get(satId).satrec = satrec;
          } catch (e) { /* stale TLE, keep old */ }
        } else {
          // Determine type from satellite data
          let type = 'IMAGING';
          const nameLower = (sat.name || '').toLowerCase();
          if (nameLower.includes('starlink') || nameLower.includes('oneweb')) type = 'INTERNET';
          else if (nameLower.includes('gps') || nameLower.includes('glonass') || nameLower.includes('galileo')) type = 'NAVIGATION';
          else if (nameLower.includes('goes') || nameLower.includes('meteo') || nameLower.includes('noaa')) type = 'IMAGING';
          else if (nameLower.includes('iridium') || nameLower.includes('inmarsat')) type = 'COMMUNICATION';

          try {
            this.addSatellite(satId, sat.tle1, sat.tle2, type);
          } catch (e) {
            // Invalid TLE, skip
          }
        }
      }
    });

    console.log('[SatelliteCoverageSystem] Connected to live data feed');
  }
}

// Expose
window.SatelliteCoverageSystem = SatelliteCoverageSystem;

console.log('[SatelliteCoverageSystem] v1.1 loaded - Ground footprint visualization + live feed');
