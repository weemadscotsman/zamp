/**
 * GOTHAM 3077 - TITAN SPATIAL INDEX v1.0
 * Quadtree-based spatial indexing for viewport-aware entity management
 * Implements LOD system with 4 levels based on camera distance
 */

class SpatialIndex {
  constructor(options = {}) {
    this.maxObjects = options.maxObjects || 50;
    this.maxLevels = options.maxLevels || 8;
    this.levels = [];
    this.root = new QuadtreeNode(0, -180, -90, 360, 180, this.maxObjects, this.maxLevels);
    this.entityMap = new Map(); // Quick lookup by ID
    this.tileCache = new Map(); // Cache for tile-based queries
    
    // Camera state
    this.cameraPosition = null;
    this.cameraHeight = 10000000; // meters
    this.visibleBounds = null;
    
    console.log('[SPATIAL INDEX] TITAN Spatial System Online');
  }
  
  /**
   * Insert entity into spatial index
   */
  insert(entity) {
    if (!entity.id || typeof entity.lon !== 'number' || typeof entity.lat !== 'number') {
      console.warn('[SPATIAL INDEX] Invalid entity:', entity);
      return false;
    }
    
    // Remove from old position if updating
    if (this.entityMap.has(entity.id)) {
      this.remove(entity.id);
    }
    
    // Insert into quadtree
    this.root.insert(entity);
    this.entityMap.set(entity.id, entity);
    
    return true;
  }
  
  /**
   * Remove entity by ID
   */
  remove(id) {
    const entity = this.entityMap.get(id);
    if (!entity) return false;
    
    this.root.remove(entity);
    this.entityMap.delete(id);
    return true;
  }
  
  /**
   * Update entity position (efficient reinsert)
   */
  update(entity) {
    if (!entity.id) return false;
    
    const existing = this.entityMap.get(entity.id);
    if (existing) {
      // Quick bounds check - if still in same rough area, skip tree update
      const dx = Math.abs(entity.lon - existing.lon);
      const dy = Math.abs(entity.lat - existing.lat);
      
      if (dx < 0.01 && dy < 0.01) {
        // Just update the entity data
        Object.assign(existing, entity);
        return true;
      }
      
      // Full reinsert
      this.remove(entity.id);
    }
    
    return this.insert(entity);
  }
  
  /**
   * Query entities within bounds
   */
  query(bounds) {
    return this.root.query(bounds);
  }
  
  /**
   * Get entities near a point with radius
   */
  queryRadius(lon, lat, radiusKm) {
    // Convert km to degrees (approximate)
    const radiusDeg = radiusKm / 111;
    const bounds = {
      x: lon - radiusDeg,
      y: lat - radiusDeg,
      width: radiusDeg * 2,
      height: radiusDeg * 2
    };
    
    const entities = this.query(bounds);
    
    // Filter by actual distance
    return entities.filter(e => {
      const dx = e.lon - lon;
      const dy = e.lat - lat;
      const dist = Math.sqrt(dx * dx + dy * dy) * 111;
      return dist <= radiusKm;
    });
  }
  
  /**
   * Get entities for current camera view
   */
  getVisibleEntities(camera, options = {}) {
    const { bufferPercent = 20 } = options;
    
    // Update camera state
    this.cameraPosition = camera.position;
    this.cameraHeight = camera.height;
    
    // Calculate visible rectangle with buffer
    const rect = this._getCameraRectangle(camera);
    if (!rect) return [];
    
    // Apply buffer
    const bufferX = rect.width * (bufferPercent / 100);
    const bufferY = rect.height * (bufferPercent / 100);
    
    const bounds = {
      x: rect.west - bufferX,
      y: rect.south - bufferY,
      width: rect.width + bufferX * 2,
      height: rect.height + bufferY * 2
    };
    
    this.visibleBounds = bounds;
    
    // Query quadtree
    let entities = this.query(bounds);
    
    // Apply LOD filtering
    entities = this._applyLOD(entities, camera);
    
    return entities;
  }
  
  /**
   * Calculate LOD level based on camera height
   */
  getLODLevel(height) {
    if (height > 10000000) return 0; // > 10,000km - dots only
    if (height > 5000000) return 1;  // 5,000-10,000km - icons
    if (height > 1000000) return 2;  // 1,000-5,000km - icons + labels
    if (height > 100000) return 3;   // 100-1,000km - full metadata
    return 4; // < 100km - everything + trails
  }
  
  /**
   * Apply LOD filtering to entity list
   */
  _applyLOD(entities, camera) {
    const lod = this.getLODLevel(camera.height);
    const cameraLon = camera.position?.lon || 0;
    const cameraLat = camera.position?.lat || 0;
    
    return entities.map(entity => {
      const distance = this._haversine(cameraLon, cameraLat, entity.lon, entity.lat);
      
      // Determine render detail level
      let detail = lod;
      
      // Boost detail for tracked entities
      if (entity.tracked) detail = Math.max(detail, 3);
      
      // Reduce detail for distant entities even at low camera height
      if (distance > 500) detail = Math.min(detail, 1);
      if (distance > 1000) detail = 0;
      
      return {
        ...entity,
        lod: detail,
        render: {
          showLabel: detail >= 2,
          showMetadata: detail >= 3,
          showTrail: detail >= 4,
          showTether: detail >= 3 && entity.altitude > 100,
          iconScale: detail === 0 ? 0.5 : detail === 1 ? 0.8 : 1.0
        }
      };
    });
  }
  
  /**
   * Get camera rectangle in lat/lon
   */
  _getCameraRectangle(camera) {
    if (!camera.viewRectangle) return null;
    
    const rect = camera.viewRectangle;
    return {
      west: Cesium.Math.toDegrees(rect.west),
      south: Cesium.Math.toDegrees(rect.south),
      east: Cesium.Math.toDegrees(rect.east),
      north: Cesium.Math.toDegrees(rect.north),
      width: Cesium.Math.toDegrees(rect.east - rect.west),
      height: Cesium.Math.toDegrees(rect.north - rect.south)
    };
  }
  
  /**
   * Haversine distance in km
   */
  _haversine(lon1, lat1, lon2, lat2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  /**
   * Get quadkey for lat/lon at zoom level
   */
  getQuadkey(lon, lat, zoom) {
    let x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    let y = Math.floor((90 - lat) / 180 * Math.pow(2, zoom));
    let quadkey = '';
    
    for (let i = zoom; i > 0; i--) {
      let digit = 0;
      const mask = 1 << (i - 1);
      if ((x & mask) !== 0) digit += 1;
      if ((y & mask) !== 0) digit += 2;
      quadkey += digit;
    }
    
    return quadkey;
  }
  
  /**
   * Get tile bounds from quadkey
   */
  getTileBounds(quadkey) {
    let x = 0, y = 0;
    const zoom = quadkey.length;
    
    for (let i = 0; i < zoom; i++) {
      const digit = parseInt(quadkey[i]);
      const mask = 1 << (zoom - 1 - i);
      if (digit & 1) x |= mask;
      if (digit & 2) y |= mask;
    }
    
    const n = Math.pow(2, zoom);
    const west = x / n * 360 - 180;
    const east = (x + 1) / n * 360 - 180;
    const north = 90 - y / n * 180;
    const south = 90 - (y + 1) / n * 180;
    
    return { west, east, north, south, zoom };
  }
  
  /**
   * Get all entities for a list of tiles
   */
  getEntitiesForTiles(quadkeys) {
    const results = new Set();
    
    for (const quadkey of quadkeys) {
      // Check cache
      if (this.tileCache.has(quadkey)) {
        const cached = this.tileCache.get(quadkey);
        cached.entities.forEach(e => results.add(e));
        continue;
      }
      
      // Query fresh
      const bounds = this.getTileBounds(quadkey);
      const entities = this.query({
        x: bounds.west,
        y: bounds.south,
        width: bounds.east - bounds.west,
        height: bounds.north - bounds.south
      });
      
      // Cache result
      this.tileCache.set(quadkey, {
        entities,
        timestamp: Date.now()
      });
      
      entities.forEach(e => results.add(e));
    }
    
    // Cleanup old cache entries
    this._cleanupTileCache();

    return Array.from(results);
  }

  /**
   * Cleanup old tile cache entries
   */
  _cleanupTileCache() {
    const maxAge = 5000;
    const now = Date.now();

    for (const [key, cached] of this.tileCache) {
      if (now - cached.timestamp > maxAge) {
        this.tileCache.delete(key);
      }
    }
  }

  /**
   * Get total entity count
   */
  getCount() {
    return this.entityMap.size;
  }

  /**
   * Clear all entities
   */
  clear() {
    this.root = new QuadtreeNode(0, -180, -90, 360, 180, this.maxObjects, this.maxLevels);
    this.entityMap.clear();
    this.tileCache.clear();
  }
}

/**
 * QuadtreeNode - Internal node for spatial subdivision
 */
class QuadtreeNode {
  constructor(level, x, y, width, height, maxObjects, maxLevels) {
    this.level = level;
    this.bounds = { x, y, width, height };
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.objects = [];
    this.children = null;
  }

  insert(entity) {
    if (this.children) {
      const index = this._getIndex(entity);
      if (index !== -1) {
        this.children[index].insert(entity);
        return;
      }
    }

    this.objects.push(entity);

    if (this.objects.length > this.maxObjects && this.level < this.maxLevels && !this.children) {
      this._split();

      let i = 0;
      while (i < this.objects.length) {
        const idx = this._getIndex(this.objects[i]);
        if (idx !== -1) {
          this.children[idx].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }

  remove(entity) {
    const objIndex = this.objects.findIndex(e => e.id === entity.id);
    if (objIndex !== -1) {
      this.objects.splice(objIndex, 1);
      return true;
    }

    if (this.children) {
      const index = this._getIndex(entity);
      if (index !== -1) {
        return this.children[index].remove(entity);
      }
      for (const child of this.children) {
        if (child.remove(entity)) return true;
      }
    }

    return false;
  }

  query(bounds) {
    const results = [];

    if (!this._intersects(bounds)) {
      return results;
    }

    for (const obj of this.objects) {
      if (obj.lon >= bounds.x && obj.lon <= bounds.x + bounds.width &&
          obj.lat >= bounds.y && obj.lat <= bounds.y + bounds.height) {
        results.push(obj);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        results.push(...child.query(bounds));
      }
    }

    return results;
  }

  _split() {
    const halfW = this.bounds.width / 2;
    const halfH = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    const nextLevel = this.level + 1;

    this.children = [
      new QuadtreeNode(nextLevel, x, y + halfH, halfW, halfH, this.maxObjects, this.maxLevels),
      new QuadtreeNode(nextLevel, x + halfW, y + halfH, halfW, halfH, this.maxObjects, this.maxLevels),
      new QuadtreeNode(nextLevel, x, y, halfW, halfH, this.maxObjects, this.maxLevels),
      new QuadtreeNode(nextLevel, x + halfW, y, halfW, halfH, this.maxObjects, this.maxLevels)
    ];
  }

  _getIndex(entity) {
    const midX = this.bounds.x + this.bounds.width / 2;
    const midY = this.bounds.y + this.bounds.height / 2;

    const isTop = entity.lat >= midY;
    const isLeft = entity.lon < midX;

    if (isTop && isLeft) return 0;
    if (isTop && !isLeft) return 1;
    if (!isTop && isLeft) return 2;
    if (!isTop && !isLeft) return 3;

    return -1;
  }

  _intersects(bounds) {
    return !(bounds.x > this.bounds.x + this.bounds.width ||
             bounds.x + bounds.width < this.bounds.x ||
             bounds.y > this.bounds.y + this.bounds.height ||
             bounds.y + bounds.height < this.bounds.y);
  }
}

window.SpatialIndex = SpatialIndex;
window.QuadtreeNode = QuadtreeNode;
