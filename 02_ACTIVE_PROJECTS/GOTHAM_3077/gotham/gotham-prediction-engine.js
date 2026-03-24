/**
 * GOTHAM 3077 - Prediction Engine v1.0
 * Forecasting system for trajectory prediction, traffic modeling, and trend analysis
 * Enables temporal projection capabilities
 */

class GothamPredictionEngine {
  constructor(entitySystem) {
    this.entitySystem = entitySystem;
    this.history = new Map(); // Entity position history
    this.models = new Map();  // Trained prediction models
    this.predictions = new Map(); // Current predictions
    this.maxHistoryLength = 100; // Keep last 100 positions
    
    // Prediction settings
    this.settings = {
      flightPredictionMinutes: 30,
      trafficPredictionMinutes: 15,
      weatherPredictionHours: 3,
      satellitePredictionMinutes: 60,
      confidenceThreshold: 0.7
    };
    
    this._startCollection();
    console.log('[PREDICTION ENGINE] Forecasting system online');
  }
  
  // Collect historical data for prediction
  _startCollection() {
    // Record positions every 5 seconds
    setInterval(() => this._recordSnapshot(), 5000);
    
    // Update predictions every 10 seconds
    setInterval(() => this._updatePredictions(), 10000);
  }
  
  _recordSnapshot() {
    if (!this.entitySystem || !this.entitySystem.entityMeta) return;
    
    const timestamp = Date.now();
    
    this.entitySystem.entityMeta.forEach((meta, id) => {
      if (!meta.data || !meta.data.lat || !meta.data.lon) return;
      
      // Only track moving entities
      if (!['flight', 'military', 'traffic', 'transit', 'satellite'].includes(meta.type)) return;
      
      if (!this.history.has(id)) {
        this.history.set(id, []);
      }
      
      const history = this.history.get(id);
      history.push({
        timestamp,
        lat: meta.data.lat,
        lon: meta.data.lon,
        alt: meta.data.alt || 0,
        velocity: meta.data.velocity || 0,
        heading: meta.data.heading || 0
      });
      
      // Trim history
      if (history.length > this.maxHistoryLength) {
        history.shift();
      }
    });
  }
  
  _updatePredictions() {
    this.history.forEach((history, id) => {
      if (history.length < 3) return;
      
      const meta = this.entitySystem.entityMeta.get(id);
      if (!meta) return;
      
      let prediction;
      
      switch (meta.type) {
        case 'flight':
        case 'military':
          prediction = this._predictAircraft(id, history, meta);
          break;
        case 'satellite':
          prediction = this._predictSatellite(id, history, meta);
          break;
        case 'traffic':
          prediction = this._predictTraffic(id, history, meta);
          break;
        case 'transit':
          prediction = this._predictTransit(id, history, meta);
          break;
      }
      
      if (prediction) {
        this.predictions.set(id, prediction);
      }
    });
    
    // Dispatch predictions updated event
    window.dispatchEvent(new CustomEvent('gotham-predictions-updated', {
      detail: { count: this.predictions.size }
    }));
  }
  
  // Aircraft trajectory prediction using linear extrapolation with heading
  _predictAircraft(id, history, meta) {
    const recent = history.slice(-5); // Last 5 points
    if (recent.length < 2) return null;
    
    const current = recent[recent.length - 1];
    const prev = recent[0];
    
    // Calculate velocity components
    const dt = (current.timestamp - prev.timestamp) / 1000; // seconds
    if (dt < 1) return null;
    
    // Use heading and velocity for prediction
    const headingRad = (current.heading || 0) * Math.PI / 180;
    const velocity = current.velocity || 0;
    
    // Predict positions at 5, 15, 30 minutes
    const predictions = [];
    const intervals = [5, 15, 30];
    
    intervals.forEach(minutes => {
      const distanceM = velocity * minutes * 60; // meters traveled
      const distanceDeg = distanceM / 111320; // Convert to degrees (approximate)
      
      const predLat = current.lat + Math.cos(headingRad) * distanceDeg;
      const predLon = current.lon + Math.sin(headingRad) * distanceDeg / Math.cos(current.lat * Math.PI / 180);
      
      predictions.push({
        minutes,
        lat: predLat,
        lon: predLon,
        alt: current.alt,
        confidence: this._calculateConfidence(recent, minutes)
      });
    });
    
    return {
      type: 'aircraft',
      entityId: id,
      callsign: meta.data.callsign || 'UNK',
      current: { lat: current.lat, lon: current.lon, alt: current.alt },
      predictions,
      timestamp: Date.now()
    };
  }
  
  // Satellite orbit prediction using SGP4 propagation
  _predictSatellite(id, history, meta) {
    if (!meta.data.tle1 || !meta.data.tle2 || typeof satellite === 'undefined') {
      return null;
    }
    
    try {
      const satrec = satellite.twoline2satrec(meta.data.tle1, meta.data.tle2);
      const predictions = [];
      const intervals = [15, 30, 60]; // minutes
      
      intervals.forEach(minutes => {
        const future = new Date(Date.now() + minutes * 60000);
        const pv = satellite.propagate(satrec, future);
        
        if (pv && pv.position) {
          const gmst = satellite.gstime(future);
          const geo = satellite.eciToGeodetic(pv.position, gmst);
          
          predictions.push({
            minutes,
            lat: satellite.degreesLat(geo.latitude),
            lon: satellite.degreesLong(geo.longitude),
            alt: geo.height,
            confidence: 0.95 // High confidence for orbital mechanics
          });
        }
      });
      
      return {
        type: 'satellite',
        entityId: id,
        name: meta.data.name,
        current: { lat: meta.data.lat, lon: meta.data.lon },
        predictions,
        timestamp: Date.now()
      };
    } catch (e) {
      return null;
    }
  }
  
  // Traffic flow prediction using trend analysis
  _predictTraffic(id, history, meta) {
    const recent = history.slice(-10);
    if (recent.length < 5) return null;
    
    // Analyze velocity trend
    const velocities = recent.map(h => h.velocity || 0);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    
    // Calculate congestion likelihood
    const congestionThreshold = 20; // km/h
    const isCongested = avgVelocity < congestionThreshold;
    
    // Predict future position (traffic moves slowly or not at all)
    const current = recent[recent.length - 1];
    const headingRad = (current.heading || 0) * Math.PI / 180;
    
    const predictions = [];
    const intervals = [5, 10, 15];
    
    intervals.forEach(minutes => {
      // In congestion, vehicles move much less
      const speedFactor = isCongested ? 0.3 : 1.0;
      const distanceM = (avgVelocity * speedFactor) * minutes * 60;
      const distanceDeg = distanceM / 111320;
      
      const predLat = current.lat + Math.cos(headingRad) * distanceDeg;
      const predLon = current.lon + Math.sin(headingRad) * distanceDeg / Math.cos(current.lat * Math.PI / 180);
      
      predictions.push({
        minutes,
        lat: predLat,
        lon: predLon,
        congestion: isCongested,
        velocity: avgVelocity * speedFactor,
        confidence: isCongested ? 0.8 : 0.6
      });
    });
    
    return {
      type: 'traffic',
      entityId: id,
      current: { lat: current.lat, lon: current.lon },
      predictions,
      congestionLikelihood: isCongested ? 'high' : 'low',
      timestamp: Date.now()
    };
  }
  
  // Transit prediction using route adherence
  _predictTransit(id, history, meta) {
    // Transit vehicles follow fixed routes more predictably
    const recent = history.slice(-5);
    if (recent.length < 3) return null;
    
    const current = recent[recent.length - 1];
    
    // Calculate average heading from recent positions
    let totalHeading = 0;
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].lon - recent[i-1].lon;
      const dy = recent[i].lat - recent[i-1].lat;
      totalHeading += Math.atan2(dx, dy) * 180 / Math.PI;
    }
    const avgHeading = totalHeading / (recent.length - 1);
    const headingRad = avgHeading * Math.PI / 180;
    
    const velocity = current.velocity || 30; // Default 30 km/h for transit
    
    const predictions = [];
    const intervals = [5, 10, 15];
    
    intervals.forEach(minutes => {
      const distanceM = velocity * minutes * 60;
      const distanceDeg = distanceM / 111320;
      
      const predLat = current.lat + Math.cos(headingRad) * distanceDeg;
      const predLon = current.lon + Math.sin(headingRad) * distanceDeg / Math.cos(current.lat * Math.PI / 180);
      
      predictions.push({
        minutes,
        lat: predLat,
        lon: predLon,
        confidence: 0.75 // Transit is fairly predictable
      });
    });
    
    return {
      type: 'transit',
      entityId: id,
      current: { lat: current.lat, lon: current.lon },
      predictions,
      timestamp: Date.now()
    };
  }
  
  _calculateConfidence(history, minutesAhead) {
    // More data = higher confidence
    // More time ahead = lower confidence
    const dataQuality = Math.min(history.length / 10, 1.0);
    const timeDecay = Math.max(0, 1 - minutesAhead / 60);
    return dataQuality * timeDecay * 0.9;
  }
  
  // Get prediction for a specific entity
  getPrediction(entityId) {
    return this.predictions.get(entityId);
  }
  
  // Get all predictions of a specific type
  getPredictionsByType(type) {
    const result = [];
    this.predictions.forEach((pred, id) => {
      if (pred.type === type) result.push(pred);
    });
    return result;
  }
  
  // Get predicted positions for a time offset (in minutes)
  getPredictedPositions(minutesOffset) {
    const positions = [];
    this.predictions.forEach((pred, id) => {
      const point = pred.predictions.find(p => p.minutes === minutesOffset);
      if (point && point.confidence >= this.settings.confidenceThreshold) {
        positions.push({
          entityId: id,
          type: pred.type,
          callsign: pred.callsign || pred.name,
          lat: point.lat,
          lon: point.lon,
          alt: point.alt,
          confidence: point.confidence
        });
      }
    });
    return positions;
  }
  
  // Predict traffic density for an area
  predictAreaDensity(lat, lon, radiusKm, minutesOffset) {
    const positions = this.getPredictedPositions(minutesOffset);
    const nearby = positions.filter(p => {
      const dist = this._haversine(lat, lon, p.lat, p.lon);
      return dist <= radiusKm;
    });
    
    return {
      center: { lat, lon },
      radius: radiusKm,
      minutesOffset,
      predictedCount: nearby.length,
      byType: nearby.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {}),
      averageConfidence: nearby.length > 0 
        ? nearby.reduce((a, p) => a + p.confidence, 0) / nearby.length 
        : 0
    };
  }
  
  // Render prediction trails on globe
  renderPredictionTrails(viewer, options = {}) {
    const { color = Cesium.Color.CYAN, width = 2 } = options;
    
    this.predictions.forEach((pred, id) => {
      if (pred.predictions.length < 2) return;
      
      const positions = pred.predictions.map(p => 
        Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt || 10000)
      );
      
      // Add current position at start
      positions.unshift(Cesium.Cartesian3.fromDegrees(
        pred.current.lon, 
        pred.current.lat, 
        pred.current.alt || 10000
      ));
      
      const entityId = `prediction-trail-${id}`;
      let entity = viewer.entities.getById(entityId);
      
      if (!entity) {
        viewer.entities.add({
          id: entityId,
          polyline: {
            positions: positions,
            width: width,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              color: color.withAlpha(0.6)
            }),
            disableDepthTestDistance: 3000
          }
        });
      } else {
        entity.polyline.positions = positions;
      }
    });
  }
  
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // Export prediction data for external analysis
  exportPredictions() {
    return {
      timestamp: Date.now(),
      count: this.predictions.size,
      predictions: Array.from(this.predictions.entries()).map(([id, pred]) => ({
        id,
        ...pred
      }))
    };
  }
}

window.GothamPredictionEngine = GothamPredictionEngine;
