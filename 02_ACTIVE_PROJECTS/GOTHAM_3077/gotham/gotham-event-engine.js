/**
 * GOTHAM 3077 - Event Engine v1.0
 * Anomaly detection and automated alert generation
 * Monitors all data feeds for unusual patterns
 */

class GothamEventEngine {
  constructor(entitySystem, hud) {
    this.entitySystem = entitySystem;
    this.hud = hud;
    this.eventHistory = [];
    this.baselines = new Map(); // Normal patterns per area/type
    this.activeAlerts = new Map();
    this.detectionRules = this._initRules();
    
    // Alert management
    this.alertTTL = 300000;        // 5 minutes
    this.alertCooldown = new Map(); // Cooldown tracking per alert type/location
    this.maxAlerts = 100;          // Hard limit for activeAlerts
    this.cooldownPeriod = 60000;   // 60 seconds between same alerts
    
    // Detection thresholds
    this.thresholds = {
      trafficSpike: 2.0,      // 2x normal traffic
      velocityAnomaly: 300,   // Aircraft > 300 m/s (~670 mph, realistic max)
      altitudeAnomaly: 13000, // Aircraft > 13km (commercial ceiling)
      clusterRadius: 0.5,     // km
      clusterMinCount: 5,     // Min entities for cluster alert
      seismicThreshold: 4.0,  // Magnitude
      stagnationTime: 300000  // 5 minutes without movement
    };
    
    // Don't auto-start - wait for enableAlerts() call after HUD is ready
    // this._startMonitoring();
    this._startCleanup();
    console.log('[EVENT ENGINE] Anomaly detection ready (awaiting enableAlerts)');
  }
  
  _initRules() {
    return {
      // Traffic anomaly: Sudden density spike
      trafficAnomaly: (data) => this._detectTrafficSpike(data),
      
      // Velocity anomaly: Object moving too fast
      velocityAnomaly: (data) => this._detectVelocityAnomaly(data),
      
      // Cluster formation: Multiple objects gathering
      clusterFormation: (data) => this._detectClusters(data),
      
      // Route deviation: Aircraft off normal corridors
      routeDeviation: (data) => this._detectRouteDeviation(data),
      
      // Stagnation: Object not moving when it should
      stagnation: (data) => this._detectStagnation(data),
      
      // Seismic: Earthquake magnitude spike
      seismicEvent: (data) => this._detectSeismicEvent(data),
      
      // Weather: Severe weather formation
      weatherAlert: (data) => this._detectWeatherAlert(data),
      
      // Air proximity: Aircraft too close
      airProximity: (data) => this._detectAirProximity(data)
    };
  }
  
  // Main monitoring loop
  _startMonitoring() {
    setInterval(() => this._runDetection(), 10000); // Check every 10 seconds
  }
  
  // Cleanup old alerts every minute
  _startCleanup() {
    setInterval(() => this._cleanupOldAlerts(), 60000);
  }
  
  _cleanupOldAlerts() {
    const now = Date.now();
    let cleaned = 0;
    
    // Remove expired alerts
    for (const [id, alert] of this.activeAlerts) {
      if (now - alert.lastSeen > this.alertTTL) {
        this.activeAlerts.delete(id);
        cleaned++;
      }
    }
    
    // Enforce hard limit - remove oldest
    if (this.activeAlerts.size > this.maxAlerts) {
      const sorted = Array.from(this.activeAlerts.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < sorted.length - this.maxAlerts; i++) {
        this.activeAlerts.delete(sorted[i][0]);
        cleaned++;
      }
    }
    
    // Clean up old cooldown entries
    for (const [key, time] of this.alertCooldown) {
      if (now - time > this.cooldownPeriod) {
        this.alertCooldown.delete(key);
      }
    }
    
    if (cleaned > 0) {
      console.log(`[EVENT ENGINE] Cleaned ${cleaned} old alerts`);
    }
  }
  
  _runDetection() {
    if (!this.entitySystem || !this.entitySystem.entityMeta) return;
    
    const data = this._collectCurrentData();
    
    // Run all detection rules
    Object.entries(this.detectionRules).forEach(([ruleName, ruleFn]) => {
      try {
        const alerts = ruleFn(data);
        if (alerts && alerts.length > 0) {
          alerts.forEach(alert => this._processAlert(alert));
        }
      } catch (e) {
        console.error(`[EVENT ENGINE] Rule ${ruleName} failed:`, e);
      }
    });
  }
  
  _collectCurrentData() {
    const data = {
      flights: [],
      traffic: [],
      transit: [],
      earthquakes: [],
      weather: [],
      byArea: new Map()
    };
    
    this.entitySystem.entityMeta.forEach((meta, id) => {
      const d = meta.data;
      if (!d.lat || !d.lon) return;
      
      // Add to type arrays
      if (meta.type === 'flight' || meta.type === 'military') {
        data.flights.push({ id, ...d, type: meta.type });
      } else if (meta.type === 'traffic') {
        data.traffic.push({ id, ...d });
      } else if (meta.type === 'transit') {
        data.transit.push({ id, ...d });
      } else if (meta.type === 'earthquake') {
        data.earthquakes.push({ id, ...d });
      } else if (meta.type === 'weather') {
        data.weather.push({ id, ...d });
      }
      
      // Group by geographic area (0.5 degree grid)
      const areaKey = `${Math.floor(d.lat * 2) / 2},${Math.floor(d.lon * 2) / 2}`;
      if (!data.byArea.has(areaKey)) {
        data.byArea.set(areaKey, { lat: d.lat, lon: d.lon, entities: [] });
      }
      data.byArea.get(areaKey).entities.push({ id, type: meta.type, ...d });
    });
    
    return data;
  }
  
  // DETECTION RULES
  
  _detectTrafficSpike(data) {
    const alerts = [];
    
    data.byArea.forEach((area, key) => {
      const trafficCount = area.entities.filter(e => e.type === 'traffic').length;
      
      // Get or establish baseline
      if (!this.baselines.has(key)) {
        this.baselines.set(key, { traffic: trafficCount, samples: 1 });
        return;
      }
      
      const baseline = this.baselines.get(key);
      baseline.samples++;
      
      // Update rolling average
      if (baseline.samples < 10) {
        baseline.traffic = (baseline.traffic * (baseline.samples - 1) + trafficCount) / baseline.samples;
        return;
      }
      
      // Check for spike
      if (trafficCount > baseline.traffic * this.thresholds.trafficSpike && trafficCount > 10) {
        alerts.push({
          type: 'traffic_spike',
          severity: trafficCount > baseline.traffic * 3 ? 'critical' : 'warning',
          location: { lat: area.lat, lon: area.lon },
          message: `Traffic density spike: ${trafficCount} vehicles (normal: ${Math.round(baseline.traffic)})`,
          entities: area.entities.filter(e => e.type === 'traffic').map(e => e.id)
        });
      }
    });
    
    return alerts;
  }
  
  _detectVelocityAnomaly(data) {
    const alerts = [];
    
    data.flights.forEach(flight => {
      if (flight.velocity && flight.velocity > this.thresholds.velocityAnomaly) {
        alerts.push({
          type: 'velocity_anomaly',
          severity: 'warning',
          location: { lat: flight.lat, lon: flight.lon },
          message: `${flight.callsign || 'Aircraft'} velocity anomaly: ${Math.round(flight.velocity)} m/s`,
          entityId: flight.id
        });
      }
      
      if (flight.alt && flight.alt > this.thresholds.altitudeAnomaly) {
        alerts.push({
          type: 'altitude_anomaly',
          severity: 'info',
          location: { lat: flight.lat, lon: flight.lon },
          message: `${flight.callsign || 'Aircraft'} high altitude: ${Math.round(flight.alt / 1000)}km`,
          entityId: flight.id
        });
      }
    });
    
    return alerts;
  }
  
  _detectClusters(data) {
    const alerts = [];
    
    data.byArea.forEach((area, key) => {
      const aircraft = area.entities.filter(e => e.type === 'flight' || e.type === 'military');
      
      if (aircraft.length >= this.thresholds.clusterMinCount) {
        // Check if this is a new cluster (not already alerted)
        const clusterId = `cluster-${key}`;
        if (!this.activeAlerts.has(clusterId)) {
          alerts.push({
            type: 'aircraft_cluster',
            severity: aircraft.length > 10 ? 'critical' : 'warning',
            location: { lat: area.lat, lon: area.lon },
            message: `Aircraft cluster detected: ${aircraft.length} contacts`,
            entities: aircraft.map(e => e.id),
            clusterId: clusterId
          });
        }
      }
    });
    
    return alerts;
  }
  
  _detectRouteDeviation(data) {
    // Simplified: Check for aircraft near ground (potential issue)
    const alerts = [];
    
    data.flights.forEach(flight => {
      if (flight.alt && flight.alt < 1000 && flight.velocity > 50) {
        // Low and fast - might be landing or potential issue
        if (!flight.callsign?.includes('EMERGENCY')) {
          alerts.push({
            type: 'low_altitude',
            severity: 'info',
            location: { lat: flight.lat, lon: flight.lon },
            message: `${flight.callsign || 'Aircraft'} low altitude transit: ${Math.round(flight.alt)}m`,
            entityId: flight.id
          });
        }
      }
    });
    
    return alerts;
  }
  
  _detectStagnation(data) {
    const alerts = [];
    const now = Date.now();
    
    data.traffic.forEach(vehicle => {
      const moving = this.entitySystem._movingEntities.get(vehicle.id);
      if (moving && moving.velocity < 1) {
        const stagnantTime = now - moving.lastUpdate;
        if (stagnantTime > this.thresholds.stagnationTime) {
          alerts.push({
            type: 'vehicle_stagnation',
            severity: 'info',
            location: { lat: vehicle.lat, lon: vehicle.lon },
            message: `Vehicle stagnant for ${Math.round(stagnantTime / 60000)} minutes`,
            entityId: vehicle.id
          });
        }
      }
    });
    
    return alerts;
  }
  
  _detectSeismicEvent(data) {
    const alerts = [];
    
    data.earthquakes.forEach(quake => {
      if (quake.magnitude && quake.magnitude > this.thresholds.seismicThreshold) {
        alerts.push({
          type: 'seismic_event',
          severity: quake.magnitude > 6 ? 'critical' : quake.magnitude > 5 ? 'warning' : 'info',
          location: { lat: quake.lat, lon: quake.lon },
          message: `Earthquake M${quake.magnitude} detected`,
          entityId: quake.id,
          magnitude: quake.magnitude
        });
      }
    });
    
    return alerts;
  }
  
  _detectWeatherAlert(data) {
    const alerts = [];
    
    data.weather.forEach(wx => {
      if (wx.windSpeed && wx.windSpeed > 80) {
        alerts.push({
          type: 'severe_weather',
          severity: 'warning',
          location: { lat: wx.lat, lon: wx.lon },
          message: `High wind alert: ${Math.round(wx.windSpeed)} km/h`,
          entityId: wx.id
        });
      }
      
      if (wx.temp && wx.temp < -30) {
        alerts.push({
          type: 'extreme_cold',
          severity: 'warning',
          location: { lat: wx.lat, lon: wx.lon },
          message: `Extreme cold: ${Math.round(wx.temp)}°C`,
          entityId: wx.id
        });
      }
    });
    
    return alerts;
  }
  
  _detectAirProximity(data) {
    const alerts = [];
    const minDistance = 5; // km
    
    // Check all flight pairs
    for (let i = 0; i < data.flights.length; i++) {
      for (let j = i + 1; j < data.flights.length; j++) {
        const f1 = data.flights[i];
        const f2 = data.flights[j];
        
        const distance = this._haversine(f1.lat, f1.lon, f2.lat, f2.lon);
        
        if (distance < minDistance) {
          const altDiff = Math.abs((f1.alt || 0) - (f2.alt || 0));
          if (altDiff < 300) { // Within 300m vertically
            const pairId = `proximity-${[f1.id, f2.id].sort().join('-')}`;
            
            if (!this.activeAlerts.has(pairId)) {
              alerts.push({
                type: 'air_proximity',
                severity: distance < 2 ? 'critical' : 'warning',
                location: { lat: (f1.lat + f2.lat) / 2, lon: (f1.lon + f2.lon) / 2 },
                message: `Air proximity: ${f1.callsign || 'UNK'} and ${f2.callsign || 'UNK'} (${Math.round(distance)}km)`,
                entities: [f1.id, f2.id],
                pairId: pairId
              });
            }
          }
        }
      }
    }
    
    return alerts;
  }
  
  _processAlert(alert) {
    // Deduplicate
    const alertId = alert.clusterId || alert.pairId || alert.entityId || `${alert.type}-${Math.round(alert.location.lat * 10) / 10}-${Math.round(alert.location.lon * 10) / 10}`;
    
    if (this.activeAlerts.has(alertId)) {
      const existing = this.activeAlerts.get(alertId);
      existing.lastSeen = Date.now();
      return;
    }
    
    // Cooldown check - prevent spam
    const cooldownKey = `${alert.type}-${Math.round(alert.location.lat)}-${Math.round(alert.location.lon)}`;
    const lastAlert = this.alertCooldown.get(cooldownKey);
    if (lastAlert && Date.now() - lastAlert < this.cooldownPeriod) {
      return; // Still in cooldown
    }
    
    // New alert
    alert.id = alertId;
    alert.timestamp = Date.now();
    alert.lastSeen = Date.now();
    this.activeAlerts.set(alertId, alert);
    this.eventHistory.push(alert);
    this.alertCooldown.set(cooldownKey, Date.now());
    
    // Dispatch to HUD with limit enforcement
    if (this.hud) {
      this.hud.fieldAlerts.unshift(alert);
      if (this.hud.fieldAlerts.length > 50) this.hud.fieldAlerts.pop(); // Enforce limit
      this.hud.incidentStats.hazards++;
      this.hud._sysLog(`ALERT: ${alert.message}`);
      
      // Auto-zoom if enabled
      if (this.hud.hooks.autoZoom && alert.location) {
        this.hud._zoomToAlert(alert.location);
      }
      
      // Voice alert if enabled
      if (this.hud.hooks.voiceAlerts && window.speechSynthesis) {
        this._speakAlert(alert);
      }
    }
    
    // Dispatch event for other systems
    window.dispatchEvent(new CustomEvent('gotham-alert', { detail: alert }));
    
    console.log(`[EVENT ENGINE] Alert: ${alert.type} - ${alert.message}`);
  }
  
  _speakAlert(alert) {
    // SAFETY: Don't speak if HUD isn't ready
    if (!this.hud || !this.hud.layerVisibility || !this.hud.hooks) {
      return;
    }
    
    // Map alert types to HUD layer types
    const alertToLayerMap = {
      // Flight / Air
      'velocity_anomaly': 'flight',
      'altitude_anomaly': 'flight',
      'low_altitude': 'flight',
      'aircraft_cluster': 'flight',
      'air_proximity': 'flight',
      'flight': 'flight',
      'military': 'flight',
      
      // Traffic / Land
      'vehicle_stagnation': 'traffic',
      'traffic': 'traffic',
      'transit': 'transit',
      
      // Sea
      'vessel': 'sea',
      'buoy': 'sea',
      'maritime': 'sea',
      
      // Hazard / Environment
      'seismic_event': 'hazard',
      'severe_weather': 'hazard',
      'extreme_cold': 'hazard',
      'earthquake': 'hazard',
      'wildfire': 'hazard',
      'volcano': 'hazard',
      'hazard': 'hazard',
      
      // Weather
      'weather': 'environment',
      'air_quality': 'environment',
      'environment': 'environment',
      
      // Crime / Intel
      'crime': 'intel',
      'suspicious': 'intel',
      'intel': 'intel',
      
      // Space
      'satellite': 'space',
      'collision': 'space',
      'debris': 'space',
      'space': 'space',
      
      // CCTV
      'cctv': 'cctv',
      'surveillance': 'cctv',
      
      // GitHub
      'github': 'github',
      'pr_created': 'github',
      'repo_alert': 'github'
    };
    
    // Get the corresponding layer for this alert type
    const layerType = alertToLayerMap[alert.type] || 'flight';
    
    // Check if this specific layer is enabled in the HUD
    const layerEnabled = this.hud && this.hud.layerVisibility && this.hud.layerVisibility[layerType];
    
    // Also check master voice alerts switch
    const voiceEnabled = this.hud && this.hud.hooks && this.hud.hooks.voiceAlerts;
    
    // Only speak if BOTH master voice is ON AND the specific layer is ON
    if (!voiceEnabled || !layerEnabled) {
      return; // Don't narrate this alert
    }
    
    const severityPrefix = alert.severity === 'critical' ? 'CRITICAL ALERT' : alert.severity === 'warning' ? 'Warning' : 'Notice';
    const msg = `${severityPrefix}: ${alert.message}`;
    
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.rate = alert.severity === 'critical' ? 1.1 : 1.0;
    utterance.pitch = alert.severity === 'critical' ? 1.2 : 1.0;
    window.speechSynthesis.speak(utterance);
  }
  
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }
  
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }
  
  clearAlert(alertId) {
    this.activeAlerts.delete(alertId);
  }

  enableAlerts() {
    // Delay start to ensure HUD and all systems are fully initialized
    setTimeout(() => {
      this._startMonitoring();
      this._startCleanup();
      console.log('[EVENT ENGINE] Alerts enabled and monitoring active');
    }, 2000); // 2 second delay after login
  }
}

window.GothamEventEngine = GothamEventEngine;
