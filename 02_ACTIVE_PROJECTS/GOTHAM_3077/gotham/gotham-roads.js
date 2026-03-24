/**
 * GOTHAM 3077 - TITAN ROAD NETWORK v1.0
 * OSM road data pipeline with particle traffic flow visualization
 * Integrates with 3D tiles for street-level detail
 */

class RoadNetwork {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.enabled = false;
    this.roadEntities = null;
    this.particleSystem = null;
    this.trafficLayer = null;
    this.spatialIndex = new Map();
    
    // Configuration
    this.config = {
      minZoom: 14, // Show roads when camera below ~10km
      maxZoom: 22,
      particleDensity: options.particleDensity || 100,
      particleSpeed: options.particleSpeed || 1.0,
      roadWidth: options.roadWidth || 8,
      cacheZoomLevels: [12, 14, 16],
      ...options
    };
    
    // Road classifications
    this.roadTypes = {
      motorway: { color: '#00a8ff', width: 12, zIndex: 10 },
      trunk: { color: '#00d2ff', width: 10, zIndex: 9 },
      primary: { color: '#00f0ff', width: 8, zIndex: 8 },
      secondary: { color: '#88f0ff', width: 6, zIndex: 7 },
      tertiary: { color: '#aaddff', width: 4, zIndex: 6 },
      residential: { color: '#ccddff', width: 2, zIndex: 5 }
    };
    
    // Traffic state
    this.trafficData = new Map();
    this.activeParticles = [];
    this.cameraHeight = 10000000;
    this.visibleQuadkeys = new Set();
    
    // Bind to camera changes
    this._setupCameraTracking();
    
    console.log('[ROAD NETWORK] TITAN Road System initialized');
  }
  
  /**
   * Enable road network visualization
   */
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    
    // Create primitive collections
    this.roadEntities = this.viewer.scene.primitives.add(
      new Cesium.PolylineCollection()
    );
    
    this.trafficLayer = this.viewer.scene.primitives.add(
      new Cesium.BillboardCollection()
    );
    
    // Initialize particle system
    this._initParticleSystem();
    
    // Load visible roads
    this._updateVisibleRoads();
    
    console.log('[ROAD NETWORK] Enabled');
  }
  
  /**
   * Disable and cleanup
   */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    
    if (this.roadEntities) {
      this.viewer.scene.primitives.remove(this.roadEntities);
      this.roadEntities = null;
    }
    
    if (this.trafficLayer) {
      this.viewer.scene.primitives.remove(this.trafficLayer);
      this.trafficLayer = null;
    }
    
    this._destroyParticleSystem();
    this.spatialIndex.clear();
    
    console.log('[ROAD NETWORK] Disabled');
  }
  
  /**
   * Setup camera tracking for LOD updates
   */
  _setupCameraTracking() {
    this.viewer.camera.changed.addEventListener(() => {
      if (!this.enabled) return;
      
      const height = this.viewer.camera.positionCartographic.height;
      this.cameraHeight = height;
      
      // Toggle based on zoom
      if (height < 10000 && !this.roadEntities) {
        this._updateVisibleRoads();
      } else if (height >= 15000 && this.roadEntities) {
        this._clearRoads();
      }
    });
  }
  
  /**
   * Initialize particle system for traffic flow
   */
  _initParticleSystem() {
    // Create particle texture (simple dot)
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Draw glowing dot
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(0, 160, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    this.particleTexture = new Cesium.Texture({
      context: this.viewer.scene.context,
      source: canvas
    });
  }
  
  _destroyParticleSystem() {
    if (this.particleTexture) {
      this.particleTexture.destroy();
      this.particleTexture = null;
    }
  }
  
  /**
   * Load road geometry from OSM or cache
   */
  async loadRoadsForBounds(west, south, east, north, zoom) {
    const quadkey = this._getQuadkeyForBounds(west, south, east, north, zoom);
    
    // Check cache first
    if (window.gothamCache) {
      const cached = await window.gothamCache.getRoadGeometry(quadkey);
      if (cached && Date.now() - cached.lastUpdated < 7 * 24 * 60 * 60 * 1000) {
        return cached.geometry;
      }
    }
    
    // Fetch from OSM Overpass API
    const roads = await this._fetchOSMRoads(west, south, east, north);
    
    // Simplify and cache
    const simplified = this._simplifyRoads(roads);
    
    if (window.gothamCache) {
      await window.gothamCache.setRoadGeometry(quadkey, {
        coordinates: simplified,
        bounds: { west, south, east, north }
      });
    }
    
    return simplified;
  }
  
  /**
   * Fetch roads from OSM Overpass API
   */
  async _fetchOSMRoads(west, south, east, north) {
    // Overpass QL query for UK roads
    const query = `
      [out:json][timeout:25];
      (
        way["highway"="motorway"](${south},${west},${north},${east});
        way["highway"="trunk"](${south},${west},${north},${east});
        way["highway"="primary"](${south},${west},${north},${east});
        way["highway"="secondary"](${south},${west},${north},${east});
        way["highway"="tertiary"](${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;
    `;
    
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      if (!response.ok) throw new Error('Overpass API error');
      
      const data = await response.json();
      return this._parseOSMData(data);
    } catch (err) {
      console.warn('[ROAD NETWORK] OSM fetch failed:', err);
      return [];
    }
  }
  
  /**
   * Parse OSM JSON to road segments
   */
  _parseOSMData(data) {
    const nodes = new Map();
    const roads = [];
    
    // Index nodes
    data.elements.forEach(el => {
      if (el.type === 'node') {
        nodes.set(el.id, { lon: el.lon, lat: el.lat });
      }
    });
    
    // Parse ways
    data.elements.forEach(el => {
      if (el.type === 'way' && el.nodes) {
        const coordinates = el.nodes
          .map(nodeId => nodes.get(nodeId))
          .filter(n => n);
        
        if (coordinates.length >= 2) {
          roads.push({
            id: el.id,
            type: el.tags?.highway || 'unclassified',
            name: el.tags?.name,
            ref: el.tags?.ref,
            coordinates,
            oneway: el.tags?.oneway === 'yes',
            lanes: parseInt(el.tags?.lanes) || 1
          });
        }
      }
    });
    
    return roads;
  }
  
  /**
   * Simplify road geometry
   */
  _simplifyRoads(roads) {
    return roads.map(road => {
      // Apply Douglas-Peucker simplification
      const tolerance = road.type === 'motorway' ? 0.0001 : 0.0005;
      const simplified = this._douglasPeucker(road.coordinates, tolerance);
      
      return {
        ...road,
        coordinates: simplified
      };
    });
  }
  
  _douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points;
    
    const stack = [[0, points.length - 1]];
    const keep = new Set([0, points.length - 1]);
    
    while (stack.length > 0) {
      const [start, end] = stack.pop();
      let maxDist = 0;
      let index = -1;
      
      const startPt = points[start];
      const endPt = points[end];
      
      for (let i = start + 1; i < end; i++) {
        const dist = this._pointToLineDistance(points[i], startPt, endPt);
        if (dist > maxDist) {
          maxDist = dist;
          index = i;
        }
      }
      
      if (maxDist > tolerance && index !== -1) {
        keep.add(index);
        stack.push([start, index]);
        stack.push([index, end]);
      }
    }
    
    return Array.from(keep).sort((a, b) => a - b).map(i => points[i]);
  }
  
  _pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.lon - lineStart.lon;
    const B = point.lat - lineStart.lat;
    const C = lineEnd.lon - lineStart.lon;
    const D = lineEnd.lat - lineStart.lat;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;
    if (param < 0) {
      xx = lineStart.lon;
      yy = lineStart.lat;
    } else if (param > 1) {
      xx = lineEnd.lon;
      yy = lineEnd.lat;
    } else {
      xx = lineStart.lon + param * C;
      yy = lineStart.lat + param * D;
    }

    const dx = point.lon - xx;
    const dy = point.lat - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update visible roads based on camera position
   */
  _updateVisibleRoads() {
    if (!this.enabled) return;

    try {
      const carto = this.viewer.camera.positionCartographic;
      if (!carto) return;

      const height = carto.height;
      if (height > 15000) return; // Too far out

      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);

      // Calculate visible area based on camera height
      const span = height / 111000; // rough degrees
      const bounds = {
        west: lon - span,
        south: lat - span,
        east: lon + span,
        north: lat + span
      };

      const zoom = this._getZoomFromHeight(height);
      this.loadRoadsForBounds(bounds.west, bounds.south, bounds.east, bounds.north, zoom)
        .then(roads => {
          if (roads && roads.length > 0) {
            this._renderRoads(roads);
          }
        })
        .catch(err => console.warn('[ROAD NETWORK] Update failed:', err));
    } catch (err) {
      console.warn('[ROAD NETWORK] Camera query failed:', err);
    }
  }

  /**
   * Clear rendered roads
   */
  _clearRoads() {
    if (this.roadEntities) {
      this.roadEntities.removeAll();
    }
    this.spatialIndex.clear();
  }

  /**
   * Render road segments as polylines
   */
  _renderRoads(roads) {
    if (!this.roadEntities) return;

    this.roadEntities.removeAll();

    for (const road of roads) {
      if (!road.coordinates || road.coordinates.length < 2) continue;

      const roadStyle = this.roadTypes[road.type] || this.roadTypes.residential;
      const positions = [];

      for (const coord of road.coordinates) {
        positions.push(coord.lon, coord.lat);
      }

      try {
        this.roadEntities.add({
          positions: Cesium.Cartesian3.fromDegreesArray(positions),
          width: roadStyle.width,
          material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.fromCssColorString(roadStyle.color).withAlpha(0.7)
          })
        });
      } catch (e) {
        // Skip invalid geometries
      }
    }
  }

  /**
   * Get zoom level from camera height
   */
  _getZoomFromHeight(height) {
    if (height < 500) return 18;
    if (height < 1000) return 17;
    if (height < 2000) return 16;
    if (height < 5000) return 15;
    if (height < 10000) return 14;
    return 13;
  }

  /**
   * Get quadkey for given bounds
   */
  _getQuadkeyForBounds(west, south, east, north, zoom) {
    const centerLon = (west + east) / 2;
    const centerLat = (south + north) / 2;

    let x = Math.floor((centerLon + 180) / 360 * Math.pow(2, zoom));
    let y = Math.floor((90 - centerLat) / 180 * Math.pow(2, zoom));
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
   * Update traffic data for a road segment
   */
  updateTraffic(roadId, trafficLevel) {
    this.trafficData.set(roadId, {
      level: trafficLevel,
      timestamp: Date.now()
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      cameraHeight: this.cameraHeight,
      roadSegments: this.spatialIndex.size,
      trafficDataPoints: this.trafficData.size,
      visibleQuadkeys: this.visibleQuadkeys.size
    };
  }
}

window.RoadNetwork = RoadNetwork;
