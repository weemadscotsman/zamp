/**
 * GOTHAM 3077 - Performance Monitor v1.0
 * Real-time FPS and memory monitoring for 24/7 operation
 */

class GothamPerformanceMonitor {
  constructor(viewer) {
    this.viewer = viewer;
    this._isDestroyed = false;
    
    // Performance metrics
    this.metrics = {
      fps: 60,
      frameTime: 16.67,
      entityCount: 0,
      drawCalls: 0,
      triangles: 0,
      memoryMB: 0,
      gpuMemoryMB: 0
    };
    
    // Thresholds for warnings
    this.thresholds = {
      minFps: 30,
      maxFrameTime: 33.33, // 30fps equivalent
      maxEntities: 2000,
      maxMemoryMB: 512
    };
    
    // History for trend analysis
    this.history = {
      fps: new Array(60).fill(60),
      memory: new Array(60).fill(0)
    };
    
    // Alert callbacks
    this._alertCallbacks = [];
    
    // Frame tracking
    this._lastFrameTime = performance.now();
    this._frameCount = 0;
    this._monitorInterval = null;
    
    // Start monitoring
    this._startMonitoring();
    
    console.log('[GOTHAM] Performance Monitor initialized');
  }
  
  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
    }
    
    this._alertCallbacks = [];
    console.log('[GOTHAM] Performance Monitor destroyed');
  }
  
  /**
   * Register an alert callback
   * @param {Function} callback - Function to call when performance degrades
   */
  onAlert(callback) {
    this._alertCallbacks.push(callback);
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Get performance history
   */
  getHistory() {
    return {
      fps: [...this.history.fps],
      memory: [...this.history.memory]
    };
  }
  
  /**
   * Check if performance is acceptable for 24/7 operation
   */
  isHealthy() {
    return (
      this.metrics.fps >= this.thresholds.minFps &&
      this.metrics.frameTime <= this.thresholds.maxFrameTime &&
      this.metrics.memoryMB <= this.thresholds.maxMemoryMB
    );
  }
  
  /**
   * Start the monitoring loop
   * @private
   */
  _startMonitoring() {
    // Frame counter
    const countFrame = () => {
      if (this._isDestroyed) return;
      this._frameCount++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);
    
    // Metrics update interval (every second)
    this._monitorInterval = setInterval(() => {
      if (this._isDestroyed) return;
      this._updateMetrics();
    }, 1000);
  }
  
  /**
   * Update all performance metrics
   * @private
   */
  _updateMetrics() {
    const now = performance.now();
    
    // Calculate FPS
    this.metrics.fps = this._frameCount;
    this.metrics.frameTime = this._frameCount > 0 ? 1000 / this._frameCount : 16.67;
    
    // Update history
    this.history.fps.shift();
    this.history.fps.push(this.metrics.fps);
    
    // Reset frame counter
    this._frameCount = 0;
    
    // Get entity count if available
    if (window.gothamSystem) {
      const stats = window.gothamSystem.getStats();
      this.metrics.entityCount = stats.total || 0;
    }
    
    // Get WebGL stats if available
    this._updateWebGLStats();
    
    // Estimate memory usage
    this._updateMemoryStats();
    
    // Check thresholds and alert if needed
    this._checkThresholds();
  }
  
  /**
   * Update WebGL rendering statistics
   * @private
   */
  _updateWebGLStats() {
    try {
      const scene = this.viewer.scene;
      if (scene) {
        // These are approximate and depend on Cesium internals
        this.metrics.drawCalls = scene.frameState?.commandList?.length || 0;
        
        // Get GPU memory if available
        if (scene.globe && scene.globe._surface) {
          const tiles = scene.globe._surface._tilesToRender;
          let triCount = 0;
          if (tiles) {
            tiles.forEach(tile => {
              if (tile.data && tile.data.vertexArray) {
                triCount += tile.data.vertexArray.numberOfVertices / 3;
              }
            });
          }
          this.metrics.triangles = triCount;
        }
      }
    } catch (e) {
      // Silently fail - these are diagnostics
    }
  }
  
  /**
   * Update memory statistics
   * @private
   */
  _updateMemoryStats() {
    // Estimate memory based on entities and scene complexity
    let memoryEstimate = 50; // Base memory in MB
    
    // Add entity memory estimate
    memoryEstimate += this.metrics.entityCount * 0.05;
    
    // Add geometry memory estimate
    memoryEstimate += this.metrics.triangles * 0.00001;
    
    this.metrics.memoryMB = Math.round(memoryEstimate * 10) / 10;
    
    // Update history
    this.history.memory.shift();
    this.history.memory.push(this.metrics.memoryMB);
    
    // Try to get actual JS heap size if available
    if (performance.memory) {
      this.metrics.memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10;
    }
  }
  
  /**
   * Check if any metrics exceed thresholds
   * @private
   */
  _checkThresholds() {
    const alerts = [];
    
    if (this.metrics.fps < this.thresholds.minFps) {
      alerts.push({
        type: 'fps',
        severity: 'warning',
        message: `Low FPS: ${this.metrics.fps} (target: ${this.thresholds.minFps}+)`,
        value: this.metrics.fps,
        threshold: this.thresholds.minFps
      });
    }
    
    if (this.metrics.memoryMB > this.thresholds.maxMemoryMB) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `High memory usage: ${this.metrics.memoryMB}MB (limit: ${this.thresholds.maxMemoryMB}MB)`,
        value: this.metrics.memoryMB,
        threshold: this.thresholds.maxMemoryMB
      });
    }
    
    if (this.metrics.entityCount > this.thresholds.maxEntities) {
      alerts.push({
        type: 'entities',
        severity: 'warning',
        message: `High entity count: ${this.metrics.entityCount} (limit: ${this.thresholds.maxEntities})`,
        value: this.metrics.entityCount,
        threshold: this.thresholds.maxEntities
      });
    }
    
    // Notify callbacks
    if (alerts.length > 0) {
      this._alertCallbacks.forEach(cb => {
        try {
          cb(alerts);
        } catch (e) {
          console.error('[PerformanceMonitor] Alert callback error:', e);
        }
      });
    }
  }
  
  /**
   * Generate a performance report
   */
  generateReport() {
    const avgFps = this.history.fps.reduce((a, b) => a + b, 0) / this.history.fps.length;
    const minFps = Math.min(...this.history.fps);
    const maxFps = Math.max(...this.history.fps);
    
    return {
      current: { ...this.metrics },
      fpsStats: {
        average: Math.round(avgFps * 10) / 10,
        min: minFps,
        max: maxFps,
        stability: Math.round((1 - (maxFps - minFps) / avgFps) * 100)
      },
      health: this.isHealthy() ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Log performance report to console
   */
  logReport() {
    const report = this.generateReport();
    console.log('[GOTHAM] Performance Report:', report);
    return report;
  }
}

window.GothamPerformanceMonitor = GothamPerformanceMonitor;
