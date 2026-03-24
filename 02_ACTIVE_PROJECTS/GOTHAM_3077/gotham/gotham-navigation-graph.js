/**
 * GOTHAM 3077 - NAVIGATION GRAPH & PATHFINDING v1.0
 * A* Pathfinding for Agents across Tiles, Roads, and Buildings
 */
class NavigationGraph {
  constructor() {
    this.nodes = new Map();
    console.log('[NAVIGATION] Graph online');
  }

  addNode(id, lat, lon, type = 'waypoint') {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, lat, lon, type, edges: [] });
    }
  }

  addEdge(id1, id2, cost = 1) {
    if (this.nodes.has(id1) && this.nodes.has(id2)) {
      this.nodes.get(id1).edges.push({ targetId: id2, cost });
      this.nodes.get(id2).edges.push({ targetId: id1, cost });
    }
  }

  _heuristic(nodeA, nodeB) {
    const toRad = Math.PI / 180;
    const dLat = (nodeB.lat - nodeA.lat) * toRad;
    const dLon = (nodeB.lon - nodeA.lon) * toRad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(nodeA.lat * toRad) * Math.cos(nodeB.lat * toRad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  findPath(startId, goalId) {
    if (!this.nodes.has(startId) || !this.nodes.has(goalId)) return null;

    const openSet = [startId];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    for (let key of this.nodes.keys()) {
      gScore.set(key, Infinity);
      fScore.set(key, Infinity);
    }

    gScore.set(startId, 0);
    fScore.set(startId, this._heuristic(this.nodes.get(startId), this.nodes.get(goalId)));

    while (openSet.length > 0) {
      let currentId = openSet.reduce((min, node) => fScore.get(node) < fScore.get(min) ? node : min, openSet[0]);

      if (currentId === goalId) {
        return this._reconstructPath(cameFrom, currentId);
      }

      openSet.splice(openSet.indexOf(currentId), 1);
      const current = this.nodes.get(currentId);

      for (let edge of current.edges) {
        const tentativeGScore = gScore.get(currentId) + edge.cost;
        if (tentativeGScore < gScore.get(edge.targetId)) {
          cameFrom.set(edge.targetId, currentId);
          gScore.set(edge.targetId, tentativeGScore);
          fScore.set(edge.targetId, tentativeGScore + this._heuristic(this.nodes.get(edge.targetId), this.nodes.get(goalId)));
          
          if (!openSet.includes(edge.targetId)) {
            openSet.push(edge.targetId);
          }
        }
      }
    }
    return null;
  }

  _reconstructPath(cameFrom, currentId) {
    const path = [currentId];
    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId);
      path.unshift(currentId);
    }
    return path.map(id => this.nodes.get(id));
  }
}
window.gothamNavigation = new NavigationGraph();
