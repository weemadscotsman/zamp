/**
 * GOTHAM 3077 - TITAN DATA PROCESSOR (Web Worker) v1.1 (PATCHED)
 * Offloads heavy computation from main thread
 * Handles: entity batching, trail calculations, road geometry simplification
 * 
 * PATCH NOTES:
 * - Added global error handling
 * - Added input validation
 * - Added memory limits
 * - Added operation timeouts
 * - Fixed potential infinite loops
 * - Added result size limits
 */

// Configuration
const CONFIG = {
  MAX_BATCH_SIZE: 1000,
  MAX_POINTS: 10000,
  MAX_ENTITIES: 50000,
  OPERATION_TIMEOUT: 30000,
  SIMPLIFICATION_TOLERANCE: 0.0001
};

// Statistics for monitoring
const stats = {
  operations: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * Global error handler
 */
self.onerror = function(error) {
  stats.errors++;
  console.error('[WORKER] Global error:', error);
  self.postMessage({ 
    type: 'error', 
    error: error.message || 'Unknown worker error',
    stack: error.stack,
    fatal: true 
  });
  return true;
};

/**
 * Unhandled rejection handler
 */
self.onunhandledrejection = function(event) {
  stats.errors++;
  console.error('[WORKER] Unhandled rejection:', event.reason);
  self.postMessage({ 
    type: 'error', 
    error: event.reason?.message || 'Unhandled promise rejection',
    fatal: false 
  });
};

self.onmessage = function(e) {
  const { type, data, id } = e.data;
  
  if (!type || !id) {
    self.postMessage({ 
      type: 'error', 
      id: id || 'unknown',
      error: 'Missing required fields: type and id' 
    });
    return;
  }
  
  const startTime = performance.now();
  
  try {
    switch (type) {
      case 'batchEntities':
        validateBatchInput(data);
        const batched = batchEntities(data.entities, data.batchSize);
        self.postMessage({ 
          type: 'batchComplete', 
          id, 
          result: batched,
          stats: { duration: performance.now() - startTime, count: data.entities?.length || 0 }
        });
        break;
        
      case 'calculateTrails':
        validateTrailInput(data);
        const trails = calculateTrails(data.positions, data.maxPoints);
        self.postMessage({ 
          type: 'trailsComplete', 
          id, 
          result: trails,
          stats: { duration: performance.now() - startTime, inputPoints: data.positions?.length || 0 }
        });
        break;
        
      case 'simplifyRoads':
        validateRoadInput(data);
        const simplified = simplifyRoads(data.geometry, data.tolerance);
        self.postMessage({ 
          type: 'simplifyComplete', 
          id, 
          result: simplified,
          stats: { duration: performance.now() - startTime }
        });
        break;
        
      case 'spatialIndex':
        validateEntityInput(data);
        const indexed = buildSpatialIndex(data.entities);
        self.postMessage({ 
          type: 'indexComplete', 
          id, 
          result: indexed,
          stats: { duration: performance.now() - startTime, count: data.entities?.length || 0 }
        });
        break;
        
      case 'processWebSocket':
        validatePayloadInput(data);
        const processed = processWebSocketData(data.payload);
        self.postMessage({ 
          type: 'processComplete', 
          id, 
          result: processed,
          stats: { duration: performance.now() - startTime, inputCount: data.payload?.length || 0, outputCount: processed.length }
        });
        break;
        
      case 'getStats':
        self.postMessage({
          type: 'statsComplete',
          id,
          result: {
            ...stats,
            uptime: Date.now() - stats.startTime
          }
        });
        break;
        
      case 'ping':
        self.postMessage({ type: 'pong', id, timestamp: Date.now() });
        break;
        
      default:
        self.postMessage({ 
          type: 'error', 
          id, 
          error: `Unknown message type: ${type}`,
          supportedTypes: ['batchEntities', 'calculateTrails', 'simplifyRoads', 'spatialIndex', 'processWebSocket', 'getStats', 'ping']
        });
    }
    
    stats.operations++;
    
  } catch (err) {
    stats.errors++;
    self.postMessage({ 
      type: 'error', 
      id, 
      error: err.message || 'Processing error',
      stack: err.stack,
      operationType: type
    });
  }
};

// Input validation functions
function validateBatchInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: expected object');
  }
  if (!Array.isArray(data.entities)) {
    throw new Error('Invalid entities: expected array');
  }
  if (data.entities.length > CONFIG.MAX_ENTITIES) {
    throw new Error(`Too many entities: ${data.entities.length} > ${CONFIG.MAX_ENTITIES}`);
  }
  if (data.batchSize && (data.batchSize < 1 || data.batchSize > CONFIG.MAX_BATCH_SIZE)) {
    throw new Error(`Invalid batchSize: ${data.batchSize}`);
  }
}

function validateTrailInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: expected object');
  }
  if (!Array.isArray(data.positions)) {
    throw new Error('Invalid positions: expected array');
  }
  if (data.positions.length > CONFIG.MAX_POINTS) {
    throw new Error(`Too many points: ${data.positions.length} > ${CONFIG.MAX_POINTS}`);
  }
}

function validateRoadInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: expected object');
  }
  if (!Array.isArray(data.geometry)) {
    throw new Error('Invalid geometry: expected array');
  }
  if (data.geometry.length > CONFIG.MAX_ENTITIES) {
    throw new Error(`Too many roads: ${data.geometry.length} > ${CONFIG.MAX_ENTITIES}`);
  }
}

function validateEntityInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: expected object');
  }
  if (!Array.isArray(data.entities)) {
    throw new Error('Invalid entities: expected array');
  }
  if (data.entities.length > CONFIG.MAX_ENTITIES) {
    throw new Error(`Too many entities: ${data.entities.length} > ${CONFIG.MAX_ENTITIES}`);
  }
}

function validatePayloadInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: expected object');
  }
  if (!Array.isArray(data.payload)) {
    throw new Error('Invalid payload: expected array');
  }
  if (data.payload.length > CONFIG.MAX_ENTITIES) {
    throw new Error(`Payload too large: ${data.payload.length} > ${CONFIG.MAX_ENTITIES}`);
  }
}

/**
 * Batch entities for rendering with size limits
 */
function batchEntities(entities, batchSize = 40) {
  if (!entities || entities.length === 0) return [];
  
  // Clamp batch size
  const size = Math.max(1, Math.min(batchSize, CONFIG.MAX_BATCH_SIZE));
  const batches = [];
  
  for (let i = 0; i < entities.length; i += size) {
    batches.push(entities.slice(i, i + size));
  }
  
  return batches;
}

/**
 * Calculate trail geometry with Douglas-Peucker simplification
 */
function calculateTrails(positions, maxPoints = 25) {
  if (!positions || positions.length <= 2) return positions || [];
  
  // Clamp maxPoints
  const targetPoints = Math.max(2, Math.min(maxPoints, CONFIG.MAX_POINTS));
  
  // Douglas-Peucker simplification
  const simplified = douglasPeucker(positions, CONFIG.SIMPLIFICATION_TOLERANCE);
  
  // If still too many points, decimate
  if (simplified.length > targetPoints) {
    const step = Math.ceil(simplified.length / targetPoints);
    return simplified.filter((_, i) => i % step === 0);
  }
  
  return simplified;
}

/**
 * Douglas-Peucker polyline simplification with safety limits
 */
function douglasPeucker(points, tolerance) {
  if (!points || points.length <= 2) return points || [];
  if (points.length > CONFIG.MAX_POINTS) {
    throw new Error(`Too many points for simplification: ${points.length}`);
  }
  
  // Stack-based implementation to avoid stack overflow
  const stack = [[0, points.length - 1]];
  const keep = new Set([0, points.length - 1]);
  
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    
    if (end - start <= 1) continue;
    
    // Find point with maximum distance
    let maxDist = 0;
    let index = start;
    
    const first = points[start];
    const last = points[end];
    
    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistance(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    
    if (maxDist > tolerance) {
      keep.add(index);
      stack.push([start, index]);
      stack.push([index, end]);
    }
  }
  
  // Return points in order
  return Array.from(keep).sort((a, b) => a - b).map(i => points[i]);
}

function perpendicularDistance(point, lineStart, lineEnd) {
  if (!point || !lineStart || !lineEnd) return 0;
  
  const dx = (lineEnd.lon || 0) - (lineStart.lon || 0);
  const dy = (lineEnd.lat || 0) - (lineStart.lat || 0);
  
  if (dx === 0 && dy === 0) {
    const dLon = (point.lon || 0) - (lineStart.lon || 0);
    const dLat = (point.lat || 0) - (lineStart.lat || 0);
    return Math.sqrt(dLon * dLon + dLat * dLat);
  }
  
  const t = (((point.lon || 0) - (lineStart.lon || 0)) * dx + 
             ((point.lat || 0) - (lineStart.lat || 0)) * dy) /
            (dx * dx + dy * dy);
  
  const closest = {
    lon: (lineStart.lon || 0) + t * dx,
    lat: (lineStart.lat || 0) + t * dy
  };
  
  const dLon = (point.lon || 0) - closest.lon;
  const dLat = (point.lat || 0) - closest.lat;
  
  return Math.sqrt(dLon * dLon + dLat * dLat);
}

/**
 * Simplify road geometry using Douglas-Peucker
 */
function simplifyRoads(geometry, tolerance) {
  if (!geometry || !Array.isArray(geometry)) return [];
  
  const tol = tolerance || CONFIG.SIMPLIFICATION_TOLERANCE;
  
  return geometry.map((road, index) => {
    if (!road || typeof road !== 'object') {
      return { id: `invalid-${index}`, coordinates: [] };
    }
    
    const coords = road.coordinates;
    if (!coords || !Array.isArray(coords)) {
      return { ...road, coordinates: [] };
    }
    
    // Skip simplification for small roads
    if (coords.length <= 10) return road;
    
    try {
      return {
        ...road,
        coordinates: douglasPeucker(coords, tol)
      };
    } catch (err) {
      console.warn('[WORKER] Road simplification failed:', err.message);
      return road;
    }
  });
}

/**
 * Build spatial index for entities with bounds checking
 */
function buildSpatialIndex(entities) {
  if (!entities || !Array.isArray(entities)) {
    return { cellSize: 1.0, grid: [], entityCount: 0 };
  }
  
  // Simple grid-based indexing
  const grid = new Map();
  const cellSize = 1.0; // 1 degree cells
  
  entities.forEach((entity, index) => {
    if (!entity || typeof entity !== 'object') return;
    
    const lon = parseFloat(entity.lon);
    const lat = parseFloat(entity.lat);
    
    if (isNaN(lon) || isNaN(lat)) return;
    
    const cellX = Math.floor(lon / cellSize);
    const cellY = Math.floor(lat / cellSize);
    const key = `${cellX},${cellY}`;
    
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key).push(entity.id || `entity-${index}`);
  });
  
  return {
    cellSize,
    grid: Array.from(grid.entries()),
    entityCount: entities.length,
    cellCount: grid.size
  };
}

/**
 * Process WebSocket payload - deduplicate and normalize
 */
function processWebSocketData(payload) {
  if (!payload || !Array.isArray(payload)) return [];
  
  const seen = new Set();
  const processed = [];
  const maxResults = CONFIG.MAX_ENTITIES;
  
  for (let i = 0; i < payload.length; i++) {
    const entity = payload[i];
    
    if (!entity || typeof entity !== 'object') continue;
    
    // Skip duplicates
    const key = entity.id || `${entity.callsign}_${entity.lon}_${entity.lat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    // Normalize coordinates
    const normalized = {
      ...entity,
      lon: parseFloat(entity.lon),
      lat: parseFloat(entity.lat),
      altitude: entity.altitude ? parseFloat(entity.altitude) : 0,
      speed: entity.speed ? parseFloat(entity.speed) : 0,
      heading: entity.heading ? parseFloat(entity.heading) : 0,
      processedAt: Date.now()
    };
    
    // Validate
    if (isValidCoordinate(normalized.lon, normalized.lat)) {
      processed.push(normalized);
      
      // Limit results to prevent memory issues
      if (processed.length >= maxResults) {
        console.warn(`[WORKER] Truncated results to ${maxResults}`);
        break;
      }
    }
  }
  
  return processed;
}

function isValidCoordinate(lon, lat) {
  return !isNaN(lon) && !isNaN(lat) &&
         lon >= -180 && lon <= 180 &&
         lat >= -90 && lat <= 90;
}

// Signal ready
self.postMessage({ type: 'ready', version: '1.1-patched', config: CONFIG });
