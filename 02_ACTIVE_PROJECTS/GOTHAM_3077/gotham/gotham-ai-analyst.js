/**
 * GOTHAM 3077 - AI Analyst Agent v1.0
 * Autonomous intelligence analysis system
 * Provides automated observations, insights, and natural language reporting
 */

class GothamAIAnalyst {
  constructor(entitySystem, eventEngine, predictionEngine, hud) {
    this.entitySystem = entitySystem;
    this.eventEngine = eventEngine;
    this.predictionEngine = predictionEngine;
    this.hud = hud;
    
    this.observations = [];
    this.insights = [];
    this.isSpeaking = false;
    this.speechQueue = [];
    
    // Personality settings
    this.personality = {
      formality: 0.7,      // 0=casual, 1=formal military
      verbosity: 0.5,      // 0=terse, 1=verbose
      alertThreshold: 0.6  // Minimum severity to voice alert
    };
    
    this._startAnalysisLoop();
    console.log('[AI ANALYST] Autonomous analysis online');
  }
  
  _startAnalysisLoop() {
    // Generate observations every 15 seconds
    setInterval(() => this._generateObservations(), 15000);
    
    // Generate insights every 30 seconds
    setInterval(() => this._generateInsights(), 30000);
    
    // Periodic status report every 2 minutes
    setInterval(() => this._statusReport(), 120000);
    
    // Listen for events
    window.addEventListener('gotham-alert', (e) => {
      this._analyzeAlert(e.detail);
    });
  }
  
  _generateObservations() {
    if (!this.entitySystem) return;
    
    const stats = this.entitySystem.getStats();
    const observations = [];
    
    // Traffic density observation
    if (stats.byType.traffic > 50) {
      observations.push({
        type: 'traffic_density',
        priority: stats.byType.traffic > 100 ? 'high' : 'normal',
        message: `High surface traffic density detected: ${stats.byType.traffic} vehicles`,
        insight: this._generateTrafficInsight(stats.byType.traffic)
      });
    }
    
    // Air traffic observation
    if (stats.byType.flight > 20) {
      observations.push({
        type: 'air_activity',
        priority: stats.byType.flight > 40 ? 'high' : 'normal',
        message: `Elevated air traffic: ${stats.byType.flight} contacts`,
        insight: this._generateAirInsight(stats.byType.flight)
      });
    }
    
    // Satellite observation
    if (stats.byType.satellite > 100) {
      observations.push({
        type: 'orbital_activity',
        priority: 'normal',
        message: `Tracking ${stats.byType.satellite} orbital objects`,
        insight: 'Orbital traffic within normal parameters'
      });
    }
    
    // Check for anomalies in entity distribution
    const total = stats.total;
    if (total > 500) {
      observations.push({
        type: 'system_load',
        priority: total > 1000 ? 'high' : 'normal',
        message: `System tracking ${total} entities`,
        insight: total > 1000 ? 'Recommend filter refinement' : 'Tracking load optimal'
      });
    }
    
    // Store observations
    observations.forEach(obs => {
      obs.timestamp = Date.now();
      this.observations.push(obs);
    });
    
    // Keep only last 100 observations
    if (this.observations.length > 100) {
      this.observations = this.observations.slice(-100);
    }
    
    // Voice high priority observations (only for enabled layers)
    observations.filter(o => o.priority === 'high').forEach(obs => {
      // Map observation type to layer
      const layerMap = {
        'traffic': 'traffic',
        'aircraft': 'flight',
        'satellite': 'space',
        'vessel': 'sea',
        'weather': 'environment',
        'seismic': 'hazard'
      };
      const layerType = layerMap[obs.type] || null;
      this._speak(`${obs.message}. ${obs.insight}`, false, layerType);
    });
  }
  
  _generateInsights() {
    if (!this.entitySystem || !this.predictionEngine) return;
    
    const insights = [];
    
    // Analyze predictions for potential conflicts
    const predictions = this.predictionEngine.getPredictedPositions(15);
    const conflicts = this._detectPotentialConflicts(predictions);
    
    if (conflicts.length > 0) {
      conflicts.forEach(conflict => {
        insights.push({
          type: 'conflict_prediction',
          severity: conflict.severity,
          message: `Potential conflict: ${conflict.entity1} and ${conflict.entity2} in ${conflict.timeToConflict} minutes`,
          recommendation: 'Monitor closely'
        });
      });
    }
    
    // Analyze traffic patterns
    const trafficPred = this.predictionEngine.getPredictionsByType('traffic');
    const congestedAreas = trafficPred.filter(p => p.congestionLikelihood === 'high');
    
    if (congestedAreas.length > 5) {
      insights.push({
        type: 'congestion_forecast',
        severity: 'warning',
        message: `Congestion building in ${congestedAreas.length} zones`,
        recommendation: 'Advise alternate routing'
      });
    }
    
    // Store insights
    insights.forEach(i => {
      i.timestamp = Date.now();
      this.insights.push(i);
    });
    
    // Voice critical insights (only for enabled layers)
    insights.filter(i => i.severity === 'critical').forEach(i => {
      // Map insight type to layer
      const layerMap = {
        'conflict_prediction': 'flight',
        'congestion_forecast': 'traffic',
        'collision_prediction': 'space',
        'weather_alert': 'environment',
        'seismic_alert': 'hazard'
      };
      const layerType = layerMap[i.type] || null;
      this._speak(`Critical insight: ${i.message}`, true, layerType);
    });
  }
  
  _detectPotentialConflicts(predictions) {
    const conflicts = [];
    const minDistance = 2; // km
    
    for (let i = 0; i < predictions.length; i++) {
      for (let j = i + 1; j < predictions.length; j++) {
        const p1 = predictions[i];
        const p2 = predictions[j];
        
        // Only check aircraft
        if (p1.type !== 'aircraft' || p2.type !== 'aircraft') continue;
        
        const dist = this._haversine(p1.lat, p1.lon, p2.lat, p2.lon);
        
        if (dist < minDistance) {
          conflicts.push({
            entity1: p1.callsign,
            entity2: p2.callsign,
            distance: dist,
            timeToConflict: 15,
            severity: dist < 1 ? 'critical' : 'warning'
          });
        }
      }
    }
    
    return conflicts;
  }
  
  _analyzeAlert(alert) {
    const analysis = {
      alert: alert,
      assessment: this._assessThreat(alert),
      recommendation: this._generateRecommendation(alert),
      timestamp: Date.now()
    };
    
    // Voice critical analysis (with layer check)
    if (alert.severity === 'critical' && this.hud?.hooks?.voiceAlerts) {
      const msg = `Critical alert. ${alert.message}. ${analysis.recommendation}`;
      
      // Map alert type to layer
      const layerMap = {
        'velocity_anomaly': 'flight',
        'altitude_anomaly': 'flight',
        'low_altitude': 'flight',
        'aircraft_cluster': 'flight',
        'air_proximity': 'flight',
        'traffic_spike': 'traffic',
        'vehicle_stagnation': 'traffic',
        'seismic_event': 'hazard',
        'severe_weather': 'hazard',
        'extreme_cold': 'hazard'
      };
      const layerType = layerMap[alert.type] || null;
      
      this._speak(msg, true, layerType);
    }
    
    return analysis;
  }
  
  _assessThreat(alert) {
    const threatLevels = {
      'traffic_spike': 'operational',
      'velocity_anomaly': 'investigate',
      'aircraft_cluster': 'monitor',
      'air_proximity': 'critical',
      'seismic_event': 'environmental',
      'severe_weather': 'environmental'
    };
    
    return threatLevels[alert.type] || 'unknown';
  }
  
  _generateRecommendation(alert) {
    const recommendations = {
      'traffic_spike': 'Monitor for incident development',
      'velocity_anomaly': 'Verify flight plan deviation',
      'aircraft_cluster': 'Coordinate with ATC',
      'air_proximity': 'Immediate separation required',
      'seismic_event': 'Monitor for aftershocks',
      'severe_weather': 'Advise aircraft to divert'
    };
    
    return recommendations[alert.type] || 'Continue monitoring';
  }
  
  _statusReport() {
    if (!this.entitySystem || !this.hud) return;
    
    const stats = this.entitySystem.getStats();
    const activeAlerts = this.eventEngine ? this.eventEngine.getActiveAlerts().length : 0;
    
    const report = {
      entities: stats.total,
      byType: stats.byType,
      activeAlerts: activeAlerts,
      systemStatus: this._determineSystemStatus(stats, activeAlerts)
    };
    
    // Log to HUD
    this.hud._sysLog(`STATUS: ${report.systemStatus} | Entities: ${report.entities} | Alerts: ${report.activeAlerts}`);
    
    // Voice if significant (system-level, no layer filter)
    if (report.activeAlerts > 5 || report.entities > 1000) {
      this._speak(`Status update. System tracking ${report.entities} entities with ${report.activeAlerts} active alerts.`, false, null);
    }
    
    return report;
  }
  
  _determineSystemStatus(stats, alertCount) {
    if (alertCount > 10) return 'ELEVATED';
    if (stats.total > 2000) return 'HIGH_LOAD';
    if (alertCount > 5) return 'ATTENTION';
    return 'NOMINAL';
  }
  
  _generateTrafficInsight(count) {
    if (count > 200) return 'Significant congestion expected. Recommend mass transit.';
    if (count > 100) return 'Heavy traffic conditions. Plan alternate routes.';
    return 'Moderate traffic flow.';
  }
  
  _generateAirInsight(count) {
    if (count > 50) return 'High density airspace. Enhanced monitoring active.';
    if (count > 30) return 'Increased aerial activity noted.';
    return 'Normal air traffic patterns.';
  }
  
  _speak(message, isUrgent = false, layerType = null) {
    if (!window.speechSynthesis) return;
    
    // Check master voice alerts switch
    if (!this.hud?.hooks?.voiceAlerts) return;
    
    // If layer type specified, check if that layer is enabled
    if (layerType && this.hud?.layerVisibility) {
      const layerEnabled = this.hud.layerVisibility[layerType];
      if (!layerEnabled) return; // Don't speak if layer is off
    }
    
    this.speechQueue.push({ message, isUrgent });
    this._processSpeechQueue();
  }
  
  _processSpeechQueue() {
    if (this.isSpeaking || this.speechQueue.length === 0) return;
    
    this.isSpeaking = true;
    const { message, isUrgent } = this.speechQueue.shift();
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = isUrgent ? 1.1 : 1.0;
    utterance.pitch = isUrgent ? 1.1 : 1.0;
    utterance.volume = isUrgent ? 1.0 : 0.9;
    
    // Use a more authoritative voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang === 'en-GB' && v.name.includes('Male')) ||
                          voices.find(v => v.lang === 'en-US' && v.name.includes('Google US English')) ||
                          voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.onend = () => {
      this.isSpeaking = false;
      setTimeout(() => this._processSpeechQueue(), 100);
    };
    
    utterance.onerror = () => {
      this.isSpeaking = false;
      this._processSpeechQueue();
    };
    
    window.speechSynthesis.speak(utterance);
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
  
  // Public API
  query(question) {
    // Simple natural language query handler
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.includes('traffic')) {
      const stats = this.entitySystem.getStats();
      return `Current traffic: ${stats.byType.traffic || 0} vehicles tracked.`;
    }
    
    if (lowerQ.includes('alert') || lowerQ.includes('incident')) {
      const alerts = this.eventEngine ? this.eventEngine.getActiveAlerts() : [];
      return `There are ${alerts.length} active alerts. ${alerts.map(a => a.message).join('. ')}`;
    }
    
    if (lowerQ.includes('aircraft') || lowerQ.includes('flight')) {
      const stats = this.entitySystem.getStats();
      return `Tracking ${stats.byType.flight || 0} aircraft contacts.`;
    }
    
    if (lowerQ.includes('status') || lowerQ.includes('system')) {
      const report = this._statusReport();
      return `System status: ${report.systemStatus}. ${report.entities} entities tracked.`;
    }
    
    return 'Query not understood. Try: traffic, alerts, aircraft, or status.';
  }
  
  getObservations(limit = 10) {
    return this.observations.slice(-limit);
  }
  
  getInsights(limit = 10) {
    return this.insights.slice(-limit);
  }
}

window.GothamAIAnalyst = GothamAIAnalyst;
