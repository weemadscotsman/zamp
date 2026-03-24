/**
 * gotham-world-influence.js
 * World modification system - Upgrade 3: Self-Modifying Environment
 * Agents permanently alter the world, creating persistent infrastructure
 */

/**
 * Default storage implementation using localStorage
 * @type {Object}
 */
const DefaultStorage = {
  getItem: (key) => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key, value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};

/**
 * Base class for all world influence nodes
 * @abstract
 */
class WorldNode {
  /**
   * @param {string} id - Unique identifier
   * @param {string} type - Node type
   * @param {Object} config - Configuration object
   */
  constructor(id, type, config) {
    this.id = id;
    this.type = type;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.creator = config.creator || null;
    this.data = { ...config };
    this.visualEntity = null;
    this.active = true;
  }

  /**
   * Update node properties
   * @param {Object} changes - Properties to update
   */
  update(changes) {
    Object.assign(this.data, changes);
    this.updatedAt = Date.now();
    this.onUpdate(changes);
  }

  /**
   * Called when node is updated - override in subclasses
   * @param {Object} changes - Changes made
   */
  onUpdate(changes) {}

  /**
   * Called each simulation tick - override in subclasses
   * @param {number} deltaTime - Time since last tick (ms)
   */
  tick(deltaTime) {}

  /**
   * Serialize node to plain object
   * @returns {Object} Serialized node
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      creator: this.creator,
      data: JSON.parse(JSON.stringify(this.data)),
      active: this.active
    };
  }

  /**
   * Get visual representation config for Cesium
   * @returns {Object|null} Visual config
   */
  getVisualConfig() {
    return null;
  }

  /**
   * Calculate distance from a point (if applicable)
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {number} Distance in meters
   */
  distanceFrom(lat, lon) {
    return Infinity;
  }

  /**
   * Check if point is within influence area
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} radius - Radius in meters
   * @returns {boolean}
   */
  isInArea(lat, lon, radius) {
    return this.distanceFrom(lat, lon) <= radius;
  }

  /**
   * Destroy the node
   */
  destroy() {
    this.active = false;
    this.onDestroy();
  }

  /**
   * Called when node is destroyed - override in subclasses
   */
  onDestroy() {}

  /**
   * Calculate haversine distance between two coordinates (static utility)
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lon1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lon2 - Longitude of point 2
   * @returns {number} Distance in meters
   * @static
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

/**
 * TradePost - Agent-built market for trade
 */
class TradePost extends WorldNode {
  /**
   * @param {string} id - Unique identifier
   * @param {Object} config - Configuration
   * @param {Object} config.location - {lat, lon}
   * @param {string} config.creator - Agent ID
   */
  constructor(id, config) {
    super(id, 'TradePost', config);
    this.data.inventory = config.inventory || new Map();
    this.data.traffic = config.traffic || 0;
    this.data.prosperity = config.prosperity || 0.5;
    this.lastTick = Date.now();
  }

  /**
   * @override
   */
  onUpdate(changes) {
    if (changes.prosperity !== undefined) {
      this.data.prosperity = Math.max(0, Math.min(1, changes.prosperity));
    }
    if (changes.inventory !== undefined) {
      this.data.inventory = changes.inventory instanceof Map
        ? changes.inventory
        : new Map(Object.entries(changes.inventory));
    }
  }

  /**
   * @override
   */
  tick(deltaTime) {
    const decayRate = 0.0001;
    this.data.prosperity = Math.max(0, this.data.prosperity - decayRate * deltaTime / 1000);
    this.lastTick = Date.now();
  }

  /**
   * Record a trade transaction
   * @param {string} good - Good type
   * @param {number} quantity - Amount traded
   * @param {number} value - TWAG value
   */
  recordTrade(good, quantity, value) {
    const current = this.data.inventory.get(good) || { quantity: 0, trades: 0 };
    current.quantity += quantity;
    current.trades += 1;
    this.data.inventory.set(good, current);
    this.data.traffic += 1;
    this.data.prosperity = Math.min(1, this.data.prosperity + value * 0.001);
    this.updatedAt = Date.now();
  }

  /**
   * Get total trade value
   * @returns {number} Trade volume metric
   */
  getTradeVolume() {
    let volume = 0;
    for (const [good, data] of this.data.inventory) {
      volume += Math.abs(data.quantity);
    }
    return volume;
  }

  /**
   * @override
   */
  distanceFrom(lat, lon) {
    const loc = this.data.location;
    return this.haversineDistance(lat, lon, loc.lat, loc.lon);
  }

  /**
   * @override
   */
  getVisualConfig() {
    return {
      type: 'billboard',
      position: this.data.location,
      image: 'shop-icon',
      scale: 0.3 + this.data.prosperity * 0.7,
      color: this.getProsperityColor(),
      label: `Trade Post (${Math.round(this.data.prosperity * 100)}%)`,
      id: this.id
    };
  }

  /**
   * Get color based on prosperity
   * @returns {Object} RGBA color
   */
  getProsperityColor() {
    const p = this.data.prosperity;
    if (p > 0.7) return { r: 0.2, g: 0.8, b: 0.2, a: 1 };
    if (p > 0.4) return { r: 0.8, g: 0.8, b: 0.2, a: 1 };
    return { r: 0.8, g: 0.4, b: 0.2, a: 1 };
  }

  /**
   * @override
   */
  serialize() {
    const base = super.serialize();
    base.data.inventory = Array.from(this.data.inventory.entries());
    return base;
  }

  /**
   * Deserialize TradePost
   * @param {Object} data - Serialized data
   * @returns {TradePost}
   */
  static deserialize(data) {
    const config = { ...data.data, creator: data.creator };
    const post = new TradePost(data.id, config);
    post.createdAt = data.createdAt;
    post.updatedAt = data.updatedAt;
    post.active = data.active;
    if (Array.isArray(data.data.inventory)) {
      post.data.inventory = new Map(data.data.inventory);
    }
    return post;
  }
}

/**
 * Territory - Claimed area by an agent
 */
class Territory extends WorldNode {
  /**
   * @param {string} id - Unique identifier
   * @param {Object} config - Configuration
   * @param {Object} config.bounds - {north, south, east, west}
   * @param {string} config.owner - Agent ID
   */
  constructor(id, config) {
    super(id, 'Territory', config);
    this.data.strength = config.strength || 1;
    this.data.contested = config.contested || false;
    this.data.claimHistory = config.claimHistory || [{ agent: config.creator, time: Date.now() }];
  }

  /**
   * @override
   */
  onUpdate(changes) {
    if (changes.strength !== undefined) {
      this.data.strength = Math.max(0, changes.strength);
    }
    if (changes.bounds !== undefined) {
      this.data.bounds = changes.bounds;
    }
  }

  /**
   * @override
   */
  tick(deltaTime) {
    if (this.data.contested) {
      this.data.strength = Math.max(0, this.data.strength - 0.001 * deltaTime / 1000);
    }
  }

  /**
   * Check if point is within territory bounds
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {boolean}
   */
  contains(lat, lon) {
    const b = this.data.bounds;
    return lat <= b.north && lat >= b.south && lon >= b.west && lon <= b.east;
  }

  /**
   * @override
   */
  distanceFrom(lat, lon) {
    if (this.contains(lat, lon)) return 0;
    const b = this.data.bounds;
    const centerLat = (b.north + b.south) / 2;
    const centerLon = (b.east + b.west) / 2;
    return WorldNode.haversineDistance(lat, lon, centerLat, centerLon);
  }

  /**
   * Get territory color based on owner type/strength
   * @returns {Object} RGBA color
   */
  getTerritoryColor() {
    const alpha = 0.3 + (this.data.strength / 10) * 0.3;
    if (this.data.contested) {
      return { r: 0.8, g: 0.2, b: 0.2, a: alpha };
    }
    return { r: 0.2, g: 0.4, b: 0.8, a: alpha };
  }

  /**
   * Calculate haversine distance
   * @private
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * @override
   */
  serialize() {
    const base = super.serialize();
    base.data.owner = this.data.owner;
    return base;
  }

  /**
   * Deserialize Territory
   * @param {Object} data - Serialized data
   * @returns {Territory}
   */
  static deserialize(data) {
    const config = { ...data.data, creator: data.creator };
    const territory = new Territory(data.id, config);
    territory.createdAt = data.createdAt;
    territory.updatedAt = data.updatedAt;
    territory.active = data.active;
    return territory;
  }
}

/**
 * SafeHouse - Rest and recovery location
 */
class SafeHouse extends WorldNode {
  /**
   * @param {string} id - Unique identifier
   * @param {Object} config - Configuration
   * @param {Object} config.location - {lat, lon}
   * @param {string} [config.owner] - Agent ID or null for public
   * @param {number} [config.capacity=5] - Max agents
   * @param {number} [config.comfort=1.0] - Recovery speed multiplier
   */
  constructor(id, config) {
    super(id, 'SafeHouse', config);
    this.data.owner = config.owner || null;
    this.data.capacity = config.capacity || 5;
    this.data.comfort = config.comfort || 1.0;
    this.data.occupants = new Set();
    this.data.totalVisits = 0;
  }

  /**
   * @override
   */
  onUpdate(changes) {
    if (changes.comfort !== undefined) {
      this.data.comfort = Math.max(0.1, Math.min(3, changes.comfort));
    }
    if (changes.capacity !== undefined) {
      this.data.capacity = Math.max(1, changes.capacity);
    }
  }

  /**
   * @override
   */
  tick(deltaTime) {
    if (this.data.occupants.size > 0) {
      this.data.totalVisits += this.data.occupants.size * deltaTime / 1000;
    }
  }

  /**
   * Add occupant to safe house
   * @param {string} agentId - Agent entering
   * @returns {boolean} Success
   */
  enter(agentId) {
    if (this.data.occupants.size >= this.data.capacity) {
      return false;
    }
    this.data.occupants.add(agentId);
    this.updatedAt = Date.now();
    return true;
  }

  /**
   * Remove occupant from safe house
   * @param {string} agentId - Agent leaving
   */
  leave(agentId) {
    this.data.occupants.delete(agentId);
    this.updatedAt = Date.now();
  }

  /**
   * Check if agent can enter
   * @param {string} agentId - Agent to check
   * @returns {boolean}
   */
  canEnter(agentId) {
    if (this.data.occupants.size >= this.data.capacity) return false;
    if (this.data.owner === null) return true;
    if (this.data.owner === agentId) return true;
    return false;
  }

  /**
   * Get recovery rate for this safe house
   * @returns {number} Recovery multiplier
   */
  getRecoveryRate() {
    const occupancyBonus = 1 - (this.data.occupants.size / this.data.capacity) * 0.3;
    return this.data.comfort * occupancyBonus;
  }

  /**
   * @override
   */
  distanceFrom(lat, lon) {
    const loc = this.data.location;
    return WorldNode.haversineDistance(lat, lon, loc.lat, loc.lon);
  }

  /**
   * @override
   */
  getVisualConfig() {
    const isOccupied = this.data.occupants.size > 0;
    return {
      type: 'billboard',
      position: this.data.location,
      image: 'house-icon',
      scale: 0.4 + (this.data.comfort * 0.3),
      color: isOccupied ? { r: 0.2, g: 0.9, b: 0.2, a: 1 } : { r: 0.6, g: 0.6, b: 0.6, a: 1 },
      glow: isOccupied,
      glowColor: { r: 0.2, g: 1, b: 0.2, a: 0.5 },
      glowSize: 20,
      label: `Safe House (${this.data.occupants.size}/${this.data.capacity})`,
      id: this.id
    };
  }

  /**
   * @override
   */
  serialize() {
    const base = super.serialize();
    base.data.occupants = Array.from(this.data.occupants);
    base.data.owner = this.data.owner;
    return base;
  }

  /**
   * Deserialize SafeHouse
   * @param {Object} data - Serialized data
   * @returns {SafeHouse}
   */
  static deserialize(data) {
    const config = { ...data.data, creator: data.creator };
    const house = new SafeHouse(data.id, config);
    house.createdAt = data.createdAt;
    house.updatedAt = data.updatedAt;
    house.active = data.active;
    if (Array.isArray(data.data.occupants)) {
      house.data.occupants = new Set(data.data.occupants);
    }
    return house;
  }
}

/**
 * Route - Established travel path between locations
 */
class Route extends WorldNode {
  /**
   * @param {string} id - Unique identifier
   * @param {Object} config - Configuration
   * @param {Object} config.from - Start {lat, lon}
   * @param {Object} config.to - End {lat, lon}
   * @param {Array} [config.waypoints=[]] - Intermediate points
   * @param {number} [config.safety=0.5] - Safety rating 0-1
   */
  constructor(id, config) {
    super(id, 'Route', config);
    this.data.from = config.from;
    this.data.to = config.to;
    this.data.waypoints = config.waypoints || [];
    this.data.safety = config.safety || 0.5;
    this.data.usage = config.usage || 0;
    this.data.totalDistance = this.calculateDistance();
    this.usageHistory = [];
  }

  /**
   * @override
   */
  onUpdate(changes) {
    if (changes.safety !== undefined) {
      this.data.safety = Math.max(0, Math.min(1, changes.safety));
    }
    if (changes.waypoints !== undefined) {
      this.data.waypoints = changes.waypoints;
      this.data.totalDistance = this.calculateDistance();
    }
  }

  /**
   * @override
   */
  tick(deltaTime) {
    const decayRate = 0.0005;
    this.data.usage = Math.max(0, this.data.usage - decayRate * deltaTime / 1000);
  }

  /**
   * Record usage of this route
   * @param {string} agentId - Agent using route
   */
  recordUsage(agentId) {
    this.data.usage += 1;
    this.usageHistory.push({ agent: agentId, time: Date.now() });
    if (this.usageHistory.length > 100) {
      this.usageHistory.shift();
    }
    this.updatedAt = Date.now();
  }

  /**
   * Get travel speed bonus
   * @returns {number} Speed multiplier (1.0 = normal)
   */
  getSpeedBonus() {
    const usageBonus = Math.min(0.5, this.data.usage * 0.01);
    const safetyPenalty = (1 - this.data.safety) * 0.3;
    return 1 + usageBonus - safetyPenalty;
  }

  /**
   * Get all points in route
   * @returns {Array} Array of {lat, lon}
   */
  getPath() {
    return [this.data.from, ...this.data.waypoints, this.data.to];
  }

  /**
   * Calculate total route distance
   * @returns {number} Distance in meters
   */
  calculateDistance() {
    const path = this.getPath();
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      total += WorldNode.haversineDistance(
        path[i].lat, path[i].lon,
        path[i + 1].lat, path[i + 1].lon
      );
    }
    return total;
  }

  /**
   * Check if route passes near a point
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} threshold - Distance threshold in meters
   * @returns {boolean}
   */
  passesNear(lat, lon, threshold = 1000) {
    const path = this.getPath();
    for (let i = 0; i < path.length - 1; i++) {
      const dist = this.pointToSegmentDistance(
        lat, lon,
        path[i].lat, path[i].lon,
        path[i + 1].lat, path[i + 1].lon
      );
      if (dist <= threshold) return true;
    }
    return false;
  }

  /**
   * @override
   */
  distanceFrom(lat, lon) {
    if (this.passesNear(lat, lon, 1000)) return 0;
    const path = this.getPath();
    let minDist = Infinity;
    for (const point of path) {
      const dist = WorldNode.haversineDistance(lat, lon, point.lat, point.lon);
      minDist = Math.min(minDist, dist);
    }
    return minDist;
  }

  /**
   * Calculate distance from point to line segment
   * @private
   */
  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    return WorldNode.haversineDistance(px, py, xx, yy);
  }

  /**
   * @override
   */
  getVisualConfig() {
    const thickness = 2 + Math.min(8, this.data.usage * 0.1);
    return {
      type: 'polyline',
      positions: this.getPath(),
      width: thickness,
      material: {
        color: this.getSafetyColor(),
        dashLength: 16,
        dashPattern: 255
      },
      clampToGround: true,
      id: this.id
    };
  }

  /**
   * Get color based on safety rating
   * @returns {Object} RGBA color
   */
  getSafetyColor() {
    const s = this.data.safety;
    if (s > 0.7) return { r: 0.2, g: 0.8, b: 0.2, a: 0.8 };
    if (s > 0.4) return { r: 0.9, g: 0.9, b: 0.2, a: 0.8 };
    return { r: 0.9, g: 0.2, b: 0.2, a: 0.8 };
  }

  /**
   * @override
   */
  serialize() {
    const base = super.serialize();
    base.usageHistory = this.usageHistory.slice(-20);
    return base;
  }

  /**
   * Deserialize Route
   * @param {Object} data - Serialized data
   * @returns {Route}
   */
  static deserialize(data) {
    const config = { ...data.data, creator: data.creator };
    const route = new Route(data.id, config);
    route.createdAt = data.createdAt;
    route.updatedAt = data.updatedAt;
    route.active = data.active;
    if (data.usageHistory) {
      route.usageHistory = data.usageHistory;
    }
    return route;
  }
}

/**
 * EventSite - Location of significant historical event
 */
class EventSite extends WorldNode {
  /**
   * @param {string} id - Unique identifier
   * @param {Object} config - Configuration
   * @param {Object} config.location - {lat, lon}
   * @param {string} config.eventType - Type: 'battle', 'discovery', 'disaster'
   * @param {number} config.significance - Importance 0-1
   * @param {string} [config.description] - Event description
   */
  constructor(id, config) {
    super(id, 'EventSite', config);
    this.data.eventType = config.eventType || config.type || 'unknown';
    this.data.timestamp = config.timestamp || Date.now();
    this.data.significance = Math.max(0, Math.min(1, config.significance || 0.5));
    this.data.description = config.description || '';
    this.data.memorial = true;
    this.data.visitors = 0;
    this.data.lastVisitor = null;
  }

  /**
   * @override
   */
  onUpdate(changes) {
    if (changes.significance !== undefined) {
      this.data.significance = Math.max(0, Math.min(1, changes.significance));
    }
    if (changes.memorial !== undefined) {
      this.data.memorial = changes.memorial;
    }
  }

  /**
   * @override
   */
  tick(deltaTime) {
    const age = Date.now() - this.data.timestamp;
    const fadeThreshold = 7 * 24 * 60 * 60 * 1000;
    if (age > fadeThreshold && !this.data.memorial) {
      this.data.significance *= 0.999;
    }
  }

  /**
   * Record a visitor to this site
   * @param {string} agentId - Visiting agent
   */
  recordVisit(agentId) {
    this.data.visitors += 1;
    this.data.lastVisitor = { agent: agentId, time: Date.now() };
    this.updatedAt = Date.now();
  }

  /**
   * Get age of event in days
   * @returns {number} Days since event
   */
  getAgeInDays() {
    return (Date.now() - this.data.timestamp) / (24 * 60 * 60 * 1000);
  }

  /**
   * Check if event should persist as memorial
   * @returns {boolean}
   */
  shouldPersist() {
    return this.data.memorial || this.data.significance > 0.7 || this.data.visitors > 10;
  }

  /**
   * @override
   */
  distanceFrom(lat, lon) {
    const loc = this.data.location;
    return WorldNode.haversineDistance(lat, lon, loc.lat, loc.lon);
  }

  /**
   * @override
   */
  getVisualConfig() {
    const age = this.getAgeInDays();
    const fadeAmount = Math.max(0.3, 1 - age / 30);
    return {
      type: 'billboard',
      position: this.data.location,
      image: this.getEventIcon(),
      scale: 0.3 + this.data.significance * 0.4,
      color: {
        r: 1,
        g: 1,
        b: 1,
        a: fadeAmount
      },
      label: this.getEventLabel(),
      id: this.id,
      eyeOffset: { x: 0, y: 0, z: -100 }
    };
  }

  /**
   * Get icon based on event type
   * @returns {string} Icon name
   */
  getEventIcon() {
    const icons = {
      battle: 'battle-icon',
      discovery: 'discovery-icon',
      disaster: 'disaster-icon',
      unknown: 'event-icon'
    };
    return icons[this.data.eventType] || icons.unknown;
  }

  /**
   * Get label for event
   * @returns {string}
   */
  getEventLabel() {
    const typeNames = {
      battle: 'Battle Site',
      discovery: 'Discovery Site',
      disaster: 'Disaster Site'
    };
    const typeName = typeNames[this.data.eventType] || 'Event Site';
    const days = Math.floor(this.getAgeInDays());
    return `${typeName} (${days}d ago)`;
  }

  /**
   * @override
   */
  serialize() {
    const base = super.serialize();
    base.data.type = this.data.eventType;
    return base;
  }

  /**
   * Deserialize EventSite
   * @param {Object} data - Serialized data
   * @returns {EventSite}
   */
  static deserialize(data) {
    const config = { 
      ...data.data, 
      creator: data.creator,
      type: data.data.type || data.data.eventType
    };
    const site = new EventSite(data.id, config);
    site.createdAt = data.createdAt;
    site.updatedAt = data.updatedAt;
    site.active = data.active;
    return site;
  }
}

/**
 * WorldInfluence - Main controller for world modification system
 */
class WorldInfluence {
  /**
   * @param {Object} viewer - Cesium viewer instance
   * @param {Object} entitySystem - Entity management system
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.storage] - Custom storage implementation (must implement getItem, setItem, removeItem)
   * @param {string} [options.persistenceKey='gotham-world-influences'] - Storage key
   * @param {boolean} [options.autoStart=true] - Whether to start ticking automatically
   */
  constructor(viewer, entitySystem, options = {}) {
    WorldInfluence._validateConstructor(viewer, entitySystem, options);

    this.viewer = viewer;
    this.entitySystem = entitySystem;
    this.influences = new Map();
    this.influenceTypes = new Map();
    this.visualEntities = new Map();
    this.eventListeners = new Map();
    this.tickInterval = null;
    this.storage = options.storage || DefaultStorage;
    this.persistenceKey = options.persistenceKey || 'gotham-world-influences';

    this.registerDefaultTypes();
    this.loadFromStorage();

    if (options.autoStart !== false) {
      this.startTicking();
    }
  }

  /**
   * Validates constructor arguments
   * @param {Object} viewer - Cesium viewer instance
   * @param {Object} entitySystem - Entity management system
   * @param {Object} options - Configuration options
   * @throws {Error} If validation fails
   * @private
   */
  static _validateConstructor(viewer, entitySystem, options) {
    if (!viewer) {
      throw new Error('Cesium viewer is required');
    }
    if (!entitySystem) {
      throw new Error('Entity system is required');
    }
    if (typeof entitySystem.getAgent !== 'function') {
      throw new Error('Entity system must have getAgent method');
    }

    if (options.storage) {
      const required = ['getItem', 'setItem', 'removeItem'];
      for (const method of required) {
        if (typeof options.storage[method] !== 'function') {
          throw new Error(`Custom storage must implement ${method} method`);
        }
      }
    }
  }

  /**
   * Register default influence types
   * @private
   */
  registerDefaultTypes() {
    this.registerInfluenceType('TradePost', TradePost);
    this.registerInfluenceType('Territory', Territory);
    this.registerInfluenceType('SafeHouse', SafeHouse);
    this.registerInfluenceType('Route', Route);
    this.registerInfluenceType('EventSite', EventSite);
  }

  /**
   * Register a new influence type
   * @param {string} type - Type identifier
   * @param {Function} WorldNodeClass - Class extending WorldNode
   */
  registerInfluenceType(type, WorldNodeClass) {
    if (!(WorldNodeClass.prototype instanceof WorldNode)) {
      throw new Error(`Type ${type} must extend WorldNode`);
    }
    this.influenceTypes.set(type, WorldNodeClass);
  }

  /**
   * Create a new world influence
   * @param {string} type - Influence type
   * @param {Object} config - Configuration for the influence
   * @returns {WorldNode|null} Created influence or null if failed
   */
  createInfluence(type, config) {
    const WorldNodeClass = this.influenceTypes.get(type);
    if (!WorldNodeClass) {
      console.error(`Unknown influence type: ${type}`);
      return null;
    }

    if (!this.validateCreationCost(type, config)) {
      return null;
    }

    const id = this.generateId();
    const influence = new WorldNodeClass(id, config);
    
    this.influences.set(id, influence);
    this.createVisual(influence);
    this.saveToStorage();
    
    this.broadcastEvent('influence:created', {
      id,
      type,
      creator: config.creator,
      location: this.getInfluenceLocation(influence)
    });

    return influence;
  }

  /**
   * Destroy a world influence
   * @param {string} id - Influence ID
   * @returns {boolean} Success
   */
  destroyInfluence(id) {
    const influence = this.influences.get(id);
    if (!influence) return false;

    influence.destroy();
    this.removeVisual(id);
    this.influences.delete(id);
    this.saveToStorage();

    this.broadcastEvent('influence:destroyed', {
      id,
      type: influence.type,
      creator: influence.creator
    });

    return true;
  }

  /**
   * Modify an existing influence
   * @param {string} id - Influence ID
   * @param {Object} changes - Properties to change
   * @returns {WorldNode|null} Updated influence or null
   */
  modifyInfluence(id, changes) {
    const influence = this.influences.get(id);
    if (!influence) return null;

    influence.update(changes);
    this.updateVisual(influence);
    this.saveToStorage();

    this.broadcastEvent('influence:modified', {
      id,
      type: influence.type,
      changes
    });

    return influence;
  }

  /**
   * Get influence by ID
   * @param {string} id - Influence ID
   * @returns {WorldNode|undefined}
   */
  getInfluence(id) {
    return this.influences.get(id);
  }

  /**
   * Get all influences within an area
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude
   * @param {number} radius - Radius in meters
   * @returns {Array<WorldNode>} Influences in area
   */
  getInfluencesInArea(lat, lon, radius) {
    const results = [];
    for (const influence of this.influences.values()) {
      if (influence.active && influence.isInArea(lat, lon, radius)) {
        results.push(influence);
      }
    }
    return results.sort((a, b) => {
      return a.distanceFrom(lat, lon) - b.distanceFrom(lat, lon);
    });
  }

  /**
   * Get all influences created by an agent
   * @param {string} agentId - Agent ID
   * @returns {Array<WorldNode>} Agent's influences
   */
  getInfluencesByAgent(agentId) {
    const results = [];
    for (const influence of this.influences.values()) {
      if (influence.creator === agentId) {
        results.push(influence);
      }
    }
    return results;
  }

  /**
   * Get influences by type
   * @param {string} type - Influence type
   * @returns {Array<WorldNode>} Influences of type
   */
  getInfluencesByType(type) {
    const results = [];
    for (const influence of this.influences.values()) {
      if (influence.type === type) {
        results.push(influence);
      }
    }
    return results;
  }

  /**
   * Get global influence statistics
   * @returns {Object} Statistics object
   */
  getGlobalInfluenceStats() {
    const stats = {
      total: this.influences.size,
      byType: {},
      totalProsperity: 0,
      tradeVolume: 0,
      contestedTerritories: 0,
      activeRoutes: 0,
      occupiedSafeHouses: 0,
      recentEvents: 0
    };

    for (const influence of this.influences.values()) {
      if (!influence.active) continue;

      stats.byType[influence.type] = (stats.byType[influence.type] || 0) + 1;

      switch (influence.type) {
      case 'TradePost':
        stats.totalProsperity += influence.data.prosperity || 0;
        stats.tradeVolume += influence.getTradeVolume ? influence.getTradeVolume() : 0;
        break;
      case 'Territory':
        if (influence.data.contested) stats.contestedTerritories++;
        break;
      case 'Route':
        if (influence.data.usage > 0) stats.activeRoutes++;
        break;
      case 'SafeHouse':
        if (influence.data.occupants && influence.data.occupants.size > 0) {
          stats.occupiedSafeHouses++;
        }
        break;
      case 'EventSite':
        if (influence.getAgeInDays && influence.getAgeInDays() < 7) {
          stats.recentEvents++;
        }
        break;
      }
    }

    stats.avgProsperity = stats.byType.TradePost 
      ? stats.totalProsperity / stats.byType.TradePost 
      : 0;

    return stats;
  }

  /**
   * Check if an agent can create an influence
   * @param {string} agentId - Agent ID
   * @param {string} type - Influence type
   * @param {Object} config - Creation config
   * @returns {boolean}
   */
  canAgentCreate(agentId, type, config) {
    const agent = this.entitySystem?.getAgent?.(agentId);
    if (!agent) return false;

    switch (type) {
    case 'TradePost':
      return this.canCreateTradePost(agent, config);
    case 'Territory':
      return this.canCreateTerritory(agent, config);
    case 'SafeHouse':
      return this.canCreateSafeHouse(agent, config);
    case 'Route':
      return this.canCreateRoute(agent, config);
    case 'EventSite':
      return this.canCreateEventSite(agent, config);
    default:
      return true;
    }
  }

  /**
   * Check if agent can create TradePost
   * @private
   */
  canCreateTradePost(agent, config) {
    const twag = agent.resources?.TWAG || agent.twag || 0;
    return twag >= 100 && agent.traits?.includes?.('trader');
  }

  /**
   * Check if agent can create Territory
   * @private
   */
  canCreateTerritory(agent, config) {
    const victories = agent.stats?.victories || 0;
    return victories >= 3 && agent.traits?.includes?.('warrior');
  }

  /**
   * Check if agent can create SafeHouse
   * @private
   */
  canCreateSafeHouse(agent, config) {
    return (agent.resources?.materials || 0) >= 50;
  }

  /**
   * Check if agent can create Route
   * @private
   */
  canCreateRoute(agent, config) {
    const pathCount = config.frequency || 0;
    return pathCount >= 5;
  }

  /**
   * Check if agent can create EventSite
   * @private
   */
  canCreateEventSite(agent, config) {
    const significance = config.significance || 0;
    return significance >= 0.5;
  }

  /**
   * Validate and deduct creation cost
   * @private
   */
  validateCreationCost(type, config) {
    const costs = {
      TradePost: { TWAG: 100, time: 300 },
      Territory: { TWAG: 200, time: 600 },
      SafeHouse: { materials: 50, time: 400 },
      Route: { time: 100 },
      EventSite: { time: 0 }
    };

    const cost = costs[type];
    if (!cost) return true;

    const creator = config.creator;
    if (!creator) return false;

    if (cost.TWAG && creator.resources?.TWAG < cost.TWAG) return false;
    if (cost.materials && creator.resources?.materials < cost.materials) return false;

    return true;
  }

  /**
   * Create visual representation for influence
   * @private
   */
  createVisual(influence) {
    const config = influence.getVisualConfig();
    if (!config || !this.viewer) return;

    const entity = this.createCesiumEntity(config);
    if (entity) {
      this.visualEntities.set(influence.id, entity);
    }
  }

  /**
   * Update visual representation
   * @private
   */
  updateVisual(influence) {
    this.removeVisual(influence.id);
    this.createVisual(influence);
  }

  /**
   * Remove visual representation
   * @private
   */
  removeVisual(id) {
    const entity = this.visualEntities.get(id);
    if (entity && this.viewer) {
      this.viewer.entities.remove(entity);
      this.visualEntities.delete(id);
    }
  }

  /**
   * Create Cesium entity from config
   * @private
   */
  createCesiumEntity(config) {
    if (!this.viewer) return null;

    const entityConfig = { id: config.id };

    switch (config.type) {
    case 'billboard':
      entityConfig.position = Cesium.Cartesian3.fromDegrees(
        config.position.lon,
        config.position.lat,
        config.position.height || 0
      );
      entityConfig.billboard = {
        image: config.image,
        scale: config.scale,
        color: new Cesium.Color(config.color.r, config.color.g, config.color.b, config.color.a),
        eyeOffset: config.eyeOffset 
          ? new Cesium.Cartesian3(config.eyeOffset.x, config.eyeOffset.y, config.eyeOffset.z)
          : Cesium.Cartesian3.ZERO
      };
      if (config.label) {
        entityConfig.label = {
          text: config.label,
          pixelOffset: new Cesium.Cartesian2(0, -30),
          fillColor: Cesium.Color.WHITE
        };
      }
      break;

    case 'polygon':
      entityConfig.polygon = {
        hierarchy: new Cesium.PolygonHierarchy(
          config.hierarchy.map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat))
        ),
        material: new Cesium.Color(
          config.material.r, 
          config.material.g, 
          config.material.b, 
          config.material.a
        ),
        outline: config.outline,
        outlineColor: new Cesium.Color(
          config.outlineColor.r,
          config.outlineColor.g,
          config.outlineColor.b,
          config.outlineColor.a
        ),
        outlineWidth: config.outlineWidth
      };
      break;

    case 'polyline':
      entityConfig.polyline = {
        positions: config.positions.map(p => 
          Cesium.Cartesian3.fromDegrees(p.lon, p.lat)
        ),
        width: config.width,
        material: new Cesium.PolylineDashMaterialProperty({
          color: new Cesium.Color(
            config.material.color.r,
            config.material.color.g,
            config.material.color.b,
            config.material.color.a
          ),
          dashLength: config.material.dashLength,
          dashPattern: config.material.dashPattern
        }),
        clampToGround: config.clampToGround
      };
      break;
    }

    return this.viewer.entities.add(entityConfig);
  }

  /**
   * Get location from influence for event broadcasting
   * @private
   */
  getInfluenceLocation(influence) {
    if (influence.data.location) {
      return influence.data.location;
    }
    if (influence.data.bounds) {
      const b = influence.data.bounds;
      return {
        lat: (b.north + b.south) / 2,
        lon: (b.east + b.west) / 2
      };
    }
    if (influence.data.from) {
      return influence.data.from;
    }
    return null;
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }

  /**
   * Broadcast event to listeners
   * @private
   */
  broadcastEvent(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Event listener error for ${event}:`, e);
        }
      });
    }
  }

  /**
   * Start simulation ticking
   * @private
   */
  startTicking() {
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const deltaTime = now - (this.lastTick || now);
      this.lastTick = now;
      this.tick(deltaTime);
    }, 1000);
  }

  /**
   * Stop simulation ticking
   */
  stopTicking() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Process tick for all influences
   * @param {number} deltaTime - Time since last tick
   */
  tick(deltaTime) {
    for (const influence of this.influences.values()) {
      if (influence.active) {
        influence.tick(deltaTime);
      }
    }
  }

  /**
   * Save influences to storage
   */
  saveToStorage() {
    try {
      const data = Array.from(this.influences.values())
        .filter(i => i.active)
        .map(i => i.serialize());
      this.storage.setItem(this.persistenceKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save influences:', e);
    }
  }

  /**
   * Load influences from storage
   */
  loadFromStorage() {
    try {
      const data = this.storage.getItem(this.persistenceKey);
      if (!data) return;

      const influences = JSON.parse(data);
      influences.forEach(item => {
        const WorldNodeClass = this.influenceTypes.get(item.type);
        if (WorldNodeClass && WorldNodeClass.deserialize) {
          const influence = WorldNodeClass.deserialize(item);
          this.influences.set(influence.id, influence);
          this.createVisual(influence);
        }
      });
    } catch (e) {
      console.error('Failed to load influences:', e);
    }
  }

  /**
   * Export influences for server sync
   * @returns {Object} Export data
   */
  exportForSync() {
    return {
      timestamp: Date.now(),
      influences: Array.from(this.influences.values())
        .filter(i => i.active)
        .map(i => i.serialize())
    };
  }

  /**
   * Import influences from server sync
   * @param {Object} data - Sync data
   */
  importFromSync(data) {
    if (!data || !data.influences) return;

    data.influences.forEach(item => {
      const existing = this.influences.get(item.id);
      if (!existing) {
        const WorldNodeClass = this.influenceTypes.get(item.type);
        if (WorldNodeClass && WorldNodeClass.deserialize) {
          const influence = WorldNodeClass.deserialize(item);
          this.influences.set(influence.id, influence);
          this.createVisual(influence);
        }
      } else if (item.updatedAt > existing.updatedAt) {
        Object.assign(existing.data, item.data);
        existing.updatedAt = item.updatedAt;
        this.updateVisual(existing);
      }
    });

    this.saveToStorage();
  }

  /**
   * Clear all influences
   */
  clear() {
    for (const id of this.influences.keys()) {
      this.removeVisual(id);
    }
    this.influences.clear();
    this.saveToStorage();
  }

  /**
   * Generate unique ID
   * @private
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose of the system
   */
  dispose() {
    this.stopTicking();
    this.clear();
    this.eventListeners.clear();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WorldInfluence,
    WorldNode,
    TradePost,
    Territory,
    SafeHouse,
    Route,
    EventSite
  };
}

// Global export for browser
if (typeof window !== 'undefined') {
  window.WorldInfluence = WorldInfluence;
  window.WorldNode = WorldNode;
  window.TradePost = TradePost;
  window.Territory = Territory;
  window.SafeHouse = SafeHouse;
  window.Route = Route;
  window.EventSite = EventSite;
}
