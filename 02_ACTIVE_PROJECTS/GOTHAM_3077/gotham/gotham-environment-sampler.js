/**
 * EnvironmentSampler - Samples real-world data from Gotham data feeds
 * and converts it to neural network inputs for agents.
 */

/**
 * Maximum traffic density for normalization
 * @constant {number}
 */
const NORMALIZATION_MAX_TRAFFIC = 100;

/**
 * Grid size for spatial hashing in kilometers
 * @constant {number}
 */
const GRID_SIZE_KM = 0.1;

/**
 * Rate at which fatigue decays over time
 * @constant {number}
 */
const FATIGUE_DECAY_RATE = 0.95;

/**
 * Threshold for stress-related neural inputs
 * @constant {number}
 */
const STRESS_THRESHOLD = 0.3;

class EnvironmentSampler {
  /**
   * Creates an EnvironmentSampler instance.
   * @param {Object} entitySystem - Reference to the entity data store
   * @param {Object} dataCache - Reference to the data cache system
   */
  constructor(entitySystem, dataCache) {
    this.entitySystem = entitySystem;
    this.dataCache = dataCache;
    this.samplingRadiusKm = 10;
    this.updateIntervalMs = 5000;
    this.spatialHash = new Map();
    this.cacheTimestamp = new Map();
    this.agentLastPositions = new Map();
    this.cacheExpiryMs = 5000;
    this.cacheDistanceThresholdKm = 1;
    this.enableCacheEvents = true;
  }

  /**
   * Samples the environment at a given location.
   * Returns cached data if within cache parameters.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Environment object with real, simulated, and normalized data
   */
  sampleEnvironment(lat, lon) {
    const cacheKey = this._getCacheKey(lat, lon);
    const cachedData = this._getCachedData(cacheKey, lat, lon);
    if (cachedData) {
      return cachedData;
    }

    const weather = this.getWeatherConditions(lat, lon);
    const trafficDensity = this.calculateTrafficDensity(lat, lon, this.samplingRadiusKm);
    const threats = this.detectThreats(lat, lon);
    const nearbyAgents = this.findNearbyAgents(lat, lon, this.samplingRadiusKm);
    const economicActivity = this.getEconomicActivity(lat, lon);

    const environment = {
      real: {
        weather: weather || { temp: 20, windSpeed: 0, precipitation: 0, severity: 0 },
        traffic: {
          density: trafficDensity,
          congestionLevel: this._calculateCongestionLevel(trafficDensity),
          avgSpeed: this._calculateAverageSpeed(trafficDensity)
        },
        threats: threats,
        events: this._getRecentEvents(lat, lon)
      },
      simulated: {
        // EXTENSION HOOK: Agent-created markets will be injected here
        // Future: Query market registry for agent-established trading posts
        markets: [],
        // EXTENSION HOOK: Agent territories will be tracked here
        // Future: Check territory ownership from social system
        territories: []
      },
      normalized: this._normalizeToNeuralInputs({
        trafficDensity,
        weather,
        threats,
        nearbyAgents,
        lat,
        lon
      })
    };

    this._cacheData(cacheKey, lat, lon, environment);
    this._dispatchCacheEvent('environment-sampled', { cacheKey, lat, lon, environment });
    return environment;
  }

  /**
   * Calculates traffic density around a location.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} radius - Radius in kilometers
   * @returns {number} Traffic entity count
   */
  calculateTrafficDensity(lat, lon, radius) {
    try {
      const entities = this._getEntitiesInRadius(lat, lon, radius);
      const trafficEntities = entities.filter(e => e.type === 'traffic' || e.type === 'vehicle');;
      return trafficEntities.length;
    } catch (error) {
      console.error('Error calculating traffic density:', error);
      return 0;
    }
  }

  /**
   * Retrieves weather conditions for the nearest weather station.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object|null} Weather data object
   */
  getWeatherConditions(lat, lon) {
    try {
      if (!this.dataCache) {
        return null;
      }
      const weatherData = this.dataCache.getWeatherData?.(lat, lon);
      if (weatherData) {
        return {
          temp: weatherData.temperature || 20,
          windSpeed: weatherData.windSpeed || 0,
          precipitation: weatherData.precipitation || 0,
          severity: this._calculateWeatherSeverity(weatherData)
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting weather conditions:', error);
      return null;
    }
  }

  /**
   * Detects threats near a location.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Array} Array of threat objects
   */
  detectThreats(lat, lon) {
    try {
      const threats = [];
      const entities = this._getEntitiesInRadius(lat, lon, this.samplingRadiusKm);

      for (const entity of entities) {
        if (entity.type === 'earthquake') {
          threats.push({
            type: 'earthquake',
            distance: this._calculateDistance(lat, lon, entity.lat, entity.lon),
            severity: entity.magnitude || 1
          });
        } else if (entity.type === 'crime') {
          threats.push({
            type: 'crime',
            distance: this._calculateDistance(lat, lon, entity.lat, entity.lon),
            severity: entity.severity || 1
          });
        } else if (entity.type === 'alert') {
          threats.push({
            type: entity.alertType || 'general',
            distance: this._calculateDistance(lat, lon, entity.lat, entity.lon),
            severity: entity.severity || 1
          });
        }
      }

      // EXTENSION HOOK: Future threat detection for agent conflicts
      // Future: Check for agent territory disputes, trade conflicts

      return threats;
    } catch (error) {
      console.error('Error detecting threats:', error);
      return [];
    }
  }

  /**
   * Finds other agents within a radius.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} radius - Radius in kilometers
   * @returns {Array} Array of nearby agent objects
   */
  findNearbyAgents(lat, lon, radius) {
    try {
      const entities = this._getEntitiesInRadius(lat, lon, radius);
      const agents = entities.filter(e => e.type === 'agent');
      return agents.map(agent => ({
        id: agent.id,
        distance: this._calculateDistance(lat, lon, agent.lat, agent.lon),
        // EXTENSION HOOK: Social network graph connections
        // Future: Include relationship strength, trust level, trade history
        relationship: null
      }));
    } catch (error) {
      console.error('Error finding nearby agents:', error);
      return [];
    }
  }

  /**
   * Counts economic activity (traders/businesses) near a location.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {number} Count of economic entities
   */
  getEconomicActivity(lat, lon) {
    try {
      const entities = this._getEntitiesInRadius(lat, lon, this.samplingRadiusKm);
      const economicEntities = entities.filter(e =>
        e.type === 'trader' || e.type === 'business' || e.type === 'market'
      );;

      // EXTENSION HOOK: Economic zone detection
      // Future: Weight by zone type (financial district, residential, etc.)

      return economicEntities.length;
    } catch (error) {
      console.error('Error getting economic activity:', error);
      return 0;
    }
  }

  /**
   * Normalizes raw environment data to 0-1 range for neural network inputs.
   * @param {Object} data - Raw environment data
   * @returns {Array} Normalized values [hunger, fatigue, social_need, curiosity, stress]
   * @private
   */
  _normalizeToNeuralInputs(data) {
    const trafficDensity = data.trafficDensity || 0;
    const weather = data.weather || { severity: 0 };
    const threats = data.threats || [];
    const nearbyAgents = data.nearbyAgents || [];
    const hour = new Date().getHours();

    const hunger = Math.min(trafficDensity / NORMALIZATION_MAX_TRAFFIC, 1);

    const timeOfDayFactor = this._calculateTimeOfDayFatigue(hour);
    const fatigue = Math.min(timeOfDayFactor + (weather.severity || 0) * 0.3, 1);

    const socialNeed = Math.max(0, 1 - (nearbyAgents.length / 20));

    const curiosity = this._calculateCuriosity(data);

    const threatCount = threats.length;
    const weatherAlert = weather.severity > 0.7;
    const stress = Math.min((threatCount / 10) + (weatherAlert ? 0.5 : 0), 1);

    return [
      this._clamp(hunger),
      this._clamp(fatigue),
      this._clamp(socialNeed),
      this._clamp(curiosity),
      this._clamp(stress)
    ];
  }

  /**
   * Retrieves cached data if valid.
   * @param {string} cacheKey - Cache key
   * @param {number} lat - Current latitude
   * @param {number} lon - Current longitude
   * @returns {Object|null} Cached data or null
   * @private
   */
  _getCachedData(cacheKey, lat, lon) {
    const cached = this.spatialHash.get(cacheKey);
    const timestamp = this.cacheTimestamp.get(cacheKey);
    const lastPos = this.agentLastPositions.get(cacheKey);

    if (!cached || !timestamp) {
      return null;
    }

    const now = Date.now();
    if (now - timestamp > this.cacheExpiryMs) {
      return null;
    }

    if (lastPos) {
      const distance = this._calculateDistance(lat, lon, lastPos.lat, lastPos.lon);
      if (distance > this.cacheDistanceThresholdKm) {
        return null;
      }
    }

    return cached;
  }

  /**
   * Stores data in cache.
   * @param {string} cacheKey - Cache key
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} data - Data to cache
   * @private
   */
  _cacheData(cacheKey, lat, lon, data) {
    this.spatialHash.set(cacheKey, data);
    this.cacheTimestamp.set(cacheKey, Date.now());
    this.agentLastPositions.set(cacheKey, { lat, lon });
  }

  /**
   * Generates a cache key for spatial hashing.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {string} Cache key
   * @private
   */
  _getCacheKey(lat, lon) {
    const gridLat = Math.floor(lat / GRID_SIZE_KM);
    const gridLon = Math.floor(lon / GRID_SIZE_KM);
    return `${gridLat},${gridLon}`;
  }

  /**
   * Dispatches a CustomEvent for cache updates
   * @param {string} eventType - Event type name
   * @param {Object} detail - Event detail data
   * @private
   */
  _dispatchCacheEvent(eventType, detail) {
    if (this.enableCacheEvents && typeof window !== 'undefined' && window.document) {
      const event = new CustomEvent(eventType, { detail });
      window.dispatchEvent(event);
    }
  }

  /**
   * Gets entities within a radius using entity system.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} radius - Radius in kilometers
   * @returns {Array} Array of entities
   * @private
   */
  _getEntitiesInRadius(lat, lon, radius) {
    if (!this.entitySystem) {
      return [];
    }
    return this.entitySystem.queryRadius?.(lat, lon, radius) || [];
  }

  /**
   * Calculates distance between two coordinates in km.
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in kilometers
   * @private
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this._toRadians(lat2 - lat1);
    const dLon = this._toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRadians(lat1)) * Math.cos(this._toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts degrees to radians.
   * @param {number} degrees - Degrees
   * @returns {number} Radians
   * @private
   */
  _toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculates congestion level from traffic density.
   * @param {number} density - Traffic density
   * @returns {number} Congestion level 0-1
   * @private
   */
  _calculateCongestionLevel(density) {
    return Math.min(density / 50, 1);
  }

  /**
   * Calculates average speed from traffic density.
   * @param {number} density - Traffic density
   * @returns {number} Average speed in km/h
   * @private
   */
  _calculateAverageSpeed(density) {
    const baseSpeed = 60;
    return Math.max(5, baseSpeed - (density * 0.5));
  }

  /**
   * Calculates weather severity score.
   * @param {Object} weatherData - Weather data
   * @returns {number} Severity 0-1
   * @private
   */
  _calculateWeatherSeverity(weatherData) {
    let severity = 0;
    if (weatherData.windSpeed > 50) severity += 0.4;
    if (weatherData.precipitation > 10) severity += 0.3;
    if (weatherData.temperature < -10 || weatherData.temperature > 40) severity += 0.3;
    return Math.min(severity, 1);
  }

  /**
   * Calculates fatigue factor based on time of day.
   * @param {number} hour - Current hour (0-23)
   * @returns {number} Fatigue factor 0-1
   * @private
   */
  _calculateTimeOfDayFatigue(hour) {
    if (hour >= 2 && hour <= 5) return 0.8;
    if (hour >= 22 || hour <= 1) return 0.6;
    if (hour >= 14 && hour <= 16) return 0.3;
    return 0.1;
  }

  /**
   * Calculates curiosity value.
   * @param {Object} data - Environment data
   * @returns {number} Curiosity 0-1
   * @private
   */
  _calculateCuriosity(data) {
    const baseCuriosity = 0.5;
    const discoveryBonus = (data.nearbyAgents?.length || 0) > 0 ? 0.1 : 0;
    const decay = 0.02;
    return Math.max(0, baseCuriosity - decay + discoveryBonus);
  }

  /**
   * Gets recent events near a location.
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Array} Array of recent events
   * @private
   */
  _getRecentEvents(lat, lon) {
    if (!this.dataCache) {
      return [];
    }
    const events = this.dataCache.getRecentEvents?.(lat, lon, this.samplingRadiusKm) || [];
    const cutoff = Date.now() - (this.updateIntervalMs * 2);
    return events.filter(e => e.timestamp > cutoff).map(e => ({
      type: e.type,
      timestamp: e.timestamp
    }));;
  }

  /**
   * Clamps a value between 0 and 1.
   * @param {number} value - Value to clamp
   * @returns {number} Clamped value
   * @private
   */
  _clamp(value) {
    return Math.max(0, Math.min(1, value));
  }
}

if (typeof window !== 'undefined') {
  window.EnvironmentSampler = EnvironmentSampler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnvironmentSampler;
}
