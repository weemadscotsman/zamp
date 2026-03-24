/**
 * GOTHAM 3077 - Viewport Overlay v2.0
 * Manages full-screen HUD overlays, target vectoring, and branding.
 * v2.0 - Added proper cleanup and performance optimizations
 */

class GothamViewport {
  constructor(viewer) {
    this.viewer = viewer;
    this._isDestroyed = false;
    this.container = document.getElementById('cesiumContainer');
    if (!this.container) return;

    // Store bound handlers for cleanup
    this._boundResize = this._onResize.bind(this);
    this._boundPostRender = this._onPostRender.bind(this);

    // Ensure full screen wrapper
    let wrapper = document.getElementById('viewport-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'viewport-wrapper';
      wrapper.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; overflow:hidden; z-index:1;';
      this.container.parentNode.insertBefore(wrapper, this.container);
      wrapper.appendChild(this.container);
      
      this.container.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; clip-path:none;';
    }
    this.wrapper = wrapper;

    // Overlay for SVG and Labels
    this.overlay = document.createElement('div');
    this.overlay.id = 'viewport-overlay';
    this.overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10;';
    this.wrapper.appendChild(this.overlay);

    this.createLabel();
    this.createCrosshairs();

    // ── Target Vectoring ────────────────────────────────
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = this.overlay.querySelector('svg');
    this.vectorLayer = document.createElementNS(svgNS, 'g');
    this.vectorLayer.id = 'viewport-vectors';
    if (svg) svg.appendChild(this.vectorLayer);
    
    this.targetLine = this._createLine(svgNS, '50%', '0%', '50%', '50%', '#00ff88', '0', '2,2');
    this.targetLine.setAttribute('stroke-width', '2');
    this.targetLine.setAttribute('filter', 'url(#reticle-glow)');
    if (this.vectorLayer) this.vectorLayer.appendChild(this.targetLine);

    // Dynamic Updates - store handlers for cleanup
    window.addEventListener('resize', this._boundResize);
    this._postRenderHandler = viewer.scene.postRender.addEventListener(this._boundPostRender);
  }

  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    console.log('[GOTHAM] Viewport destroying...');

    // Remove event listeners
    window.removeEventListener('resize', this._boundResize);
    
    // Remove postRender listener
    if (this._postRenderHandler) {
      this.viewer.scene.postRender.removeEventListener(this._postRenderHandler);
    }

    // Remove DOM elements
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    console.log('[GOTHAM] Viewport destroyed');
  }

  _onResize() {
    this.updateClip();
  }

  _onPostRender() {
    if (this._isDestroyed) return;
    this.updateClip();
    this.updateVectors();
  }

  createLabel() {
    const labelDiv = document.createElement('div');
    labelDiv.id = 'worldview-label';
    labelDiv.style.cssText = 'position:absolute; top:40px; left:50%; transform:translateX(-50%); color:#00f0ff; font-family:"Share Tech Mono",monospace; font-size:28px; font-weight:bold; text-shadow:0 0 15px rgba(0,240,255,0.8); z-index:20; letter-spacing:8px; textAlign:center;';
    labelDiv.innerHTML = 'GOTHAM 3077<br><span style="font-size:12px; color:#88aaff; letter-spacing:2px; opacity:0.8;">NO PLACE LEFT BEHIND</span>';
    this.overlay.appendChild(labelDiv);
  }

  createCrosshairs() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'viewport-crosshairs';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute; top:0; left:0; z-index:15;';

    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', 'reticle-glow');
    filter.innerHTML = '<feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>';
    defs.appendChild(filter);
    svg.appendChild(defs);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('id', 'reticle-group');
    g.setAttribute('filter', 'url(#reticle-glow)');

    // Scope Ring
    const scope = this._createCircle(svgNS, '50%', '50%', '45%', 'none', '0.1', '#00f0ff', '1');
    scope.setAttribute('stroke-dasharray', '5,15');

    // Crosshair Lines
    const hLine = this._createLine(svgNS, '0%', '50%', '100%', '50%', '#00f0ff', '0.2', '4,4');
    const vLine = this._createLine(svgNS, '50%', '0%', '50%', '100%', '#00f0ff', '0.2', '4,4');
    
    // Central Reticle
    const c1 = this._createCircle(svgNS, '50%', '50%', '4', '#00f0ff', '1');
    const c2 = this._createCircle(svgNS, '50%', '50%', '60', 'none', '0.2', '#00f0ff', '1');
    c2.setAttribute('stroke-dasharray', '15,5');

    g.appendChild(scope);
    g.appendChild(hLine);
    g.appendChild(vLine);
    g.appendChild(c1);
    g.appendChild(c2);
    svg.appendChild(g);
    this.overlay.appendChild(svg);
  }

  _createLine(ns, x1, y1, x2, y2, color, opacity, dash) {
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', color); l.setAttribute('stroke-width', '1'); l.setAttribute('opacity', opacity);
    if (dash) l.setAttribute('stroke-dasharray', dash);
    return l;
  }

  _createCircle(ns, cx, cy, r, fill, opacity, stroke, strokeWidth) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', fill); c.setAttribute('opacity', opacity);
    if (stroke) c.setAttribute('stroke', stroke);
    if (strokeWidth) c.setAttribute('stroke-width', strokeWidth);
    return c;
  }

  updateClip() {
    if (this.container) this.container.style.clipPath = 'none';
  }

  updateVectors() {
    if (this._isDestroyed) return;
    
    // Throttle vector updates to every 2nd frame for performance
    if (!this._vectorUpdateThrottle) this._vectorUpdateThrottle = 0;
    this._vectorUpdateThrottle++;
    if (this._vectorUpdateThrottle % 2 !== 0) return;
    
    if (!window.gothamSystem || !window.gothamSystem.selectedEntity) {
      if (this.targetLine) this.targetLine.setAttribute('opacity', '0');
      return;
    }
    
    const entity = this.viewer.entities.getById(window.gothamSystem.selectedEntity);
    if (!entity || !entity.position) {
      if (this.targetLine) this.targetLine.setAttribute('opacity', '0');
      return;
    }
    
    const pos = entity.position.getValue(this.viewer.clock.currentTime);
    if (!pos) {
      if (this.targetLine) this.targetLine.setAttribute('opacity', '0');
      return;
    }
    
    const screenPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, pos);
    if (!screenPos) {
      if (this.targetLine) this.targetLine.setAttribute('opacity', '0');
      return;
    }
    
    // Only update if position changed significantly (reduces DOM thrashing)
    if (this._lastScreenPos) {
      const dx = Math.abs(screenPos.x - this._lastScreenPos.x);
      const dy = Math.abs(screenPos.y - this._lastScreenPos.y);
      if (dx < 2 && dy < 2) return; // Skip small movements
    }
    this._lastScreenPos = { x: screenPos.x, y: screenPos.y };
    
    this.targetLine.setAttribute('x1', '50%');
    this.targetLine.setAttribute('y1', '0%');
    this.targetLine.setAttribute('x2', screenPos.x + 'px');
    this.targetLine.setAttribute('y2', screenPos.y + 'px');
    this.targetLine.setAttribute('opacity', '0.8');
  }
}

window.GothamViewport = GothamViewport;
