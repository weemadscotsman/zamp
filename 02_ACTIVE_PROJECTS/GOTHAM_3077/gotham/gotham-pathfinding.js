/**
 * GOTHAM 3077 - A* Pathfinding System v1.0
 * Intelligent navigation for tile world agents
 */

class PathfindingSystem {
  constructor(tileWorld) {
    this.tileWorld = tileWorld;
    this.tileSize = tileWorld.tileSize;
    this.debug = false;
  }
  
  /**
   * Find path from start to goal using A* algorithm
   * @param {Object} start - {x, y} in tile coordinates
   * @param {Object} goal - {x, y} in tile coordinates
   * @returns {Array|null} Array of {x, y} path nodes or null if no path
   */
  findPath(start, goal) {
    // Validate inputs
    if (!this._isValidTile(start.x, start.y) || !this._isValidTile(goal.x, goal.y)) {
      return null;
    }
    
    // Check if goal is walkable
    if (!this._isWalkable(goal.x, goal.y)) {
      // Try to find nearest walkable tile
      const nearest = this._findNearestWalkable(goal.x, goal.y);
      if (nearest) {
        goal = nearest;
      } else {
        return null;
      }
    }
    
    // A* algorithm
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const startKey = this._key(start.x, start.y);
    const goalKey = this._key(goal.x, goal.y);
    
    openSet.enqueue(start, 0);
    gScore.set(startKey, 0);
    fScore.set(startKey, this._heuristic(start, goal));
    
    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();
      const currentKey = this._key(current.x, current.y);
      
      // Reached goal
      if (currentKey === goalKey) {
        return this._reconstructPath(cameFrom, current);
      }
      
      closedSet.add(currentKey);
      
      // Check neighbors
      const neighbors = this._getNeighbors(current.x, current.y);
      
      for (const neighbor of neighbors) {
        const neighborKey = this._key(neighbor.x, neighbor.y);
        
        if (closedSet.has(neighborKey)) {
          continue;
        }
        
        const tentativeG = gScore.get(currentKey) + this._distance(current, neighbor);
        
        if (!openSet.has(neighbor) || tentativeG < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          fScore.set(neighborKey, tentativeG + this._heuristic(neighbor, goal));
          
          if (!openSet.has(neighbor)) {
            openSet.enqueue(neighbor, fScore.get(neighborKey));
          }
        }
      }
    }
    
    // No path found
    return null;
  }
  
  /**
   * Heuristic: Manhattan distance (good for grid-based movement)
   */
  _heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  
  /**
   * Distance between two tiles (always 1 for orthogonal, ~1.4 for diagonal)
   */
  _distance(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    
    // Diagonal movement cost is sqrt(2)
    if (dx === 1 && dy === 1) {
      return 1.414;
    }
    return 1;
  }
  
  /**
   * Get walkable neighbors of a tile
   */
  _getNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      { x: 0, y: -1 }, // North
      { x: 1, y: 0 },  // East
      { x: 0, y: 1 },  // South
      { x: -1, y: 0 }, // West
      // Diagonals (comment out for 4-directional movement)
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 }
    ];
    
    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      
      if (this._isWalkable(nx, ny)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    
    return neighbors;
  }
  
  /**
   * Check if tile is walkable
   */
  _isWalkable(x, y) {
    if (!this._isValidTile(x, y)) {
      return false;
    }
    
    const tile = this.tileWorld.tiles[y][x];
    
    // Not walkable if:
    if (tile.type === 'water') return false;
    if (tile.type === 'rock') return false;
    if (tile.type === 'debris') return false;
    if (tile.type === 'building' && tile.damaged) return false;
    if (tile.passable === false) return false;
    
    return true;
  }
  
  /**
   * Check if tile coordinates are valid
   */
  _isValidTile(x, y) {
    return x >= 0 && x < this.tileWorld.tilesX && 
           y >= 0 && y < this.tileWorld.tilesY;
  }
  
  /**
   * Find nearest walkable tile
   */
  _findNearestWalkable(x, y) {
    const maxRadius = 5;
    
    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) === r) {
            const nx = x + dx;
            const ny = y + dy;
            if (this._isWalkable(nx, ny)) {
              return { x: nx, y: ny };
            }
          }
        }
      }
    }
    return null;
  }
  
  /**
   * Reconstruct path from cameFrom map
   */
  _reconstructPath(cameFrom, current) {
    const path = [current];
    let currentKey = this._key(current.x, current.y);
    
    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey);
      path.unshift(current);
      currentKey = this._key(current.x, current.y);
    }
    
    return path;
  }
  
  /**
   * Create unique key for tile coordinates
   */
  _key(x, y) {
    return `${x},${y}`;
  }
  
  /**
   * Find path for agent to target (pixel coordinates)
   */
  findPathForAgent(agent, targetX, targetY) {
    const startTile = this._pixelToTile(agent.x, agent.y);
    const goalTile = this._pixelToTile(targetX, targetY);
    
    return this.findPath(startTile, goalTile);
  }
  
  /**
   * Convert pixel coordinates to tile coordinates
   */
  _pixelToTile(px, py) {
    return {
      x: Math.floor(px / this.tileSize),
      y: Math.floor(py / this.tileSize)
    };
  }
  
  /**
   * Convert tile coordinates to pixel coordinates (center)
   */
  _tileToPixel(tx, ty) {
    return {
      x: tx * this.tileSize + this.tileSize / 2,
      y: ty * this.tileSize + this.tileSize / 2
    };
  }
  
  /**
   * Find nearest resource of type
   */
  findNearestResource(agent, resourceType) {
    const start = this._pixelToTile(agent.x, agent.y);
    let nearest = null;
    let nearestDist = Infinity;
    
    for (let y = 0; y < this.tileWorld.tilesY; y++) {
      for (let x = 0; x < this.tileWorld.tilesX; x++) {
        const tile = this.tileWorld.tiles[y][x];
        if (tile.resource && tile.resource.type === resourceType) {
          const dist = Math.abs(start.x - x) + Math.abs(start.y - y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = { x, y };
          }
        }
      }
    }
    
    if (nearest) {
      return this.findPath(start, nearest);
    }
    return null;
  }
  
  /**
   * Find path to nearest building of type
   */
  findNearestBuilding(agent, buildingType) {
    const start = this._pixelToTile(agent.x, agent.y);
    let nearest = null;
    let nearestDist = Infinity;
    
    for (let y = 0; y < this.tileWorld.tilesY; y++) {
      for (let x = 0; x < this.tileWorld.tilesX; x++) {
        const tile = this.tileWorld.tiles[y][x];
        if (tile.building && tile.building.type === buildingType) {
          const dist = Math.abs(start.x - x) + Math.abs(start.y - y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = { x, y };
          }
        }
      }
    }
    
    if (nearest) {
      return this.findPath(start, nearest);
    }
    return null;
  }
  
  /**
   * Flee from danger (find path away from threat)
   */
  findFleePath(agent, threatX, threatY, fleeDistance = 5) {
    const start = this._pixelToTile(agent.x, agent.y);
    const threat = this._pixelToTile(threatX, threatY);
    
    // Find point in opposite direction
    const dx = start.x - threat.x;
    const dy = start.y - threat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return null;
    
    const fleeX = Math.round(start.x + (dx / dist) * fleeDistance);
    const fleeY = Math.round(start.y + (dy / dist) * fleeDistance);
    
    // Clamp to valid tiles
    const goal = {
      x: Math.max(0, Math.min(this.tileWorld.tilesX - 1, fleeX)),
      y: Math.max(0, Math.min(this.tileWorld.tilesY - 1, fleeY))
    };
    
    return this.findPath(start, goal);
  }
  
  /**
   * Check if line of sight is clear (for ranged combat)
   */
  hasLineOfSight(x1, y1, x2, y2) {
    const tiles = this._getLineTiles(x1, y1, x2, y2);
    for (const tile of tiles) {
      if (!this._isWalkable(tile.x, tile.y)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get all tiles along a line (Bresenham's line algorithm)
   */
  _getLineTiles(x1, y1, x2, y2) {
    const tiles = [];
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
      tiles.push({ x: x1, y: y1 });
      
      if (x1 === x2 && y1 === y2) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y1 += sy;
      }
    }
    
    return tiles;
  }
  
  /**
   * Debug: Visualize path on canvas
   */
  debugDrawPath(ctx, path, color = '#00ff00') {
    if (!path || path.length < 2) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < path.length; i++) {
      const pixel = this._tileToPixel(path[i].x, path[i].y);
      if (i === 0) {
        ctx.moveTo(pixel.x, pixel.y);
      } else {
        ctx.lineTo(pixel.x, pixel.y);
      }
    }
    
    ctx.stroke();
    
    // Draw nodes
    for (const node of path) {
      const pixel = this._tileToPixel(node.x, node.y);
      ctx.fillStyle = color;
      ctx.fillRect(pixel.x - 2, pixel.y - 2, 4, 4);
    }
  }
}

/**
 * Priority Queue for A* algorithm
 */
class PriorityQueue {
  constructor() {
    this.items = [];
    this.itemSet = new Set();
  }
  
  enqueue(item, priority) {
    this.items.push({ item, priority });
    this.itemSet.add(this._key(item));
    this._sort();
  }
  
  dequeue() {
    const item = this.items.shift();
    if (item) {
      this.itemSet.delete(this._key(item.item));
      return item.item;
    }
    return null;
  }
  
  isEmpty() {
    return this.items.length === 0;
  }
  
  has(item) {
    return this.itemSet.has(this._key(item));
  }
  
  _sort() {
    this.items.sort((a, b) => a.priority - b.priority);
  }
  
  _key(item) {
    return `${item.x},${item.y}`;
  }
}

// Expose
window.PathfindingSystem = PathfindingSystem;
window.PriorityQueue = PriorityQueue;
console.log('[PathfindingSystem] v1.0 loaded - A* navigation ready');
