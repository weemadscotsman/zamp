/**
 * GOTHAM 3077 - OMNI-EYE Entity System v34.0
 * v34.0 - PERFORMANCE & MEMORY OPTIMIZATION PATCH
 * - Fixed memory leaks in entity creation/destruction
 * - Optimized batch rendering for 1000+ entities
 * - Added proper entity lifecycle management
 * - Fixed camera tracking smoothness
 * - Added performance monitoring
 */

class Gotham3077System {
  constructor (viewer) {
    this.viewer = viewer
    this.entityMeta = new Map()
    // TITAN Spatial Index for viewport-aware rendering
    this.spatialIndex = (typeof SpatialIndex !== 'undefined') ? new SpatialIndex() : null;
    this.visibleEntities = new Set()
    this.lodLevel = 0
    this.dataCache = {}
    this.selectedEntity = null
    this._lastRender = 0
    this._renderThrottle = 800  // Reduced from 1500 for better responsiveness
    this._batchSize = 100  // Increased from 40 for better throughput
    this._drainDelay = 16  // Reduced from 100 for 60fps target

    this._entityIds = new Map()
    this._movingEntities = new Map()
    this._trailPositions = new Map()
    this._flightOrigins = new Map()
    this._trackingEntity = null
    this._satOrbits = new Map()
    this._roadCorridors = []
    this._roadFlowSprites = []

    this.SAFE_POS = Cesium.Cartesian3.fromDegrees(0, 0, 0)
    this._isRendering = false
    this._isDestroyed = false
    this._frameId = 0

    // Performance monitoring
    this._perfStats = {
      lastFrameTime: 0,
      frameCount: 0,
      fps: 60,
      entityCount: 0,
      renderTime: 0,
      memoryEstimate: 0
    }

    // Icons
    this._planeIcon = this._createAirplaneIcon('#00f0ff', '#004466')
    this._milIcon = this._createAirplaneIcon('#ff00ff', '#660044')
    this._transitIcon = this._createTransitIcon('#33ff99')
    this._trafficIcon = this._createCarIcon('#ffaa00')
    this._headlightIcon = this._createLightIcon('#ffffff', true)
    this._taillightIcon = this._createLightIcon('#ff3300', false)

    // Traffic Flow Sprite System (Primitive for performance)
    this._trafficSprites = new Cesium.BillboardCollection({ scene: this.viewer.scene })
    this.viewer.scene.primitives.add(this._trafficSprites)

    // Cached event handlers for cleanup
    this._eventHandlers = []
    this._postRenderHandler = null
    this._clockTickHandler = null
    this._keyState = {}

    this._setupClickHandler()
    this._setupSmoothAnimation()
    this._setupAreaMonitor()
    this._setupKeyboardControls()
    this._startPerformanceMonitoring()

    // SAFE CAMERA LIMITS
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500

    // Bind methods for consistent callbacks
    this._boundPostRender = this._onPostRender.bind(this)
    this._boundClockTick = this._onClockTick.bind(this)
    this._boundKeyDown = this._onKeyDown.bind(this)
    this._boundKeyUp = this._onKeyUp.bind(this)
  }

  // ── Lifecycle Management ──────────────────────────────────

  _alienStyle(e, d) {
      // 🛸 Alien / UFO Tracking
      var type = (d.type || 'unknown').toLowerCase();
      var isHighStrangeness = d.confusion_level >= 8;
      
      if (!e.point && !e.billboard && !e.ellipse) {
        if (type === 'triangle' || type === 'tr-3b') {
          // Matte black rotates slowly
          e.point = new Cesium.PointGraphics({
            pixelSize: 12,
            color: Cesium.Color.BLACK,
            outlineColor: Cesium.Color.CYAN,
            outlineWidth: 1
          });
        } else if (type === 'orb' || type === 'sphere') {
          // Gold / Orange flickers
          e.point = new Cesium.PointGraphics({
            pixelSize: new Cesium.CallbackProperty(() => {
              return 8 + Math.random() * 4;
            }, false),
            color: Cesium.Color.ORANGE,
            outlineColor: Cesium.Color.YELLOW,
            outlineWidth: 2
          });
        } else if (type === 'fast_mover') {
          // Electric blue streak
          e.point = new Cesium.PointGraphics({
            pixelSize: 10,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLUE,
            outlineWidth: 2
          });
        } else {
          // Classic Disc / Default - Silver pulsing glow
          e.point = new Cesium.PointGraphics({
            pixelSize: new Cesium.CallbackProperty(() => {
              return 10 + Math.sin(Date.now() / 200) * 3;
            }, false),
            color: Cesium.Color.SILVER,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          });
        }
        
        // High Strangeness - Magenta animated radiation rings
        if (isHighStrangeness) {
          e.ellipse = new Cesium.EllipseGraphics({
            semiMinorAxis: new Cesium.CallbackProperty(() => {
              return 20000 + (Date.now() % 2000) * 10;
            }, false),
            semiMajorAxis: new Cesium.CallbackProperty(() => {
              return 20000 + (Date.now() % 2000) * 10;
            }, false),
            material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
              var alpha = 1.0 - ((Date.now() % 2000) / 2000);
              return Cesium.Color.MAGENTA.withAlpha(alpha * 0.5);
            }, false)),
            height: 5000
          });
        }
      }
      
      if (!e.label) {
        e.label = new Cesium.LabelGraphics({
          text: (d.name || 'UNKNOWN ANOMALY').toUpperCase() + (isHighStrangeness ? ' ⚠️' : ''),
          font: '10px "Share Tech Mono"',
          fillColor: isHighStrangeness ? Cesium.Color.MAGENTA : Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000000)
        });
      }
    }

  destroy() {
    if (this._isDestroyed) return
    this._isDestroyed = true

    console.log('[GOTHAM] Entity System destroying...')

    // Remove all event listeners
    this._eventHandlers.forEach(handler => {
      if (handler.element && handler.type && handler.fn) {
        handler.element.removeEventListener(handler.type, handler.fn)
      }
    })
    this._eventHandlers = []

    // Remove postRender listener
    if (this._postRenderHandler) {
      this.viewer.scene.postRender.removeEventListener(this._postRenderHandler)
    }

    // Remove clock tick listener
    if (this._clockTickHandler) {
      this.viewer.clock.onTick.removeEventListener(this._clockTickHandler)
    }

    // Remove keyboard listeners
    document.removeEventListener('keydown', this._boundKeyDown)
    document.removeEventListener('keyup', this._boundKeyUp)

    // Clear all trails
    this._trailPositions.clear()

    // Remove all entities we created
    this._entityIds.forEach((ids, prefix) => {
      ids.forEach(id => {
        this._removeEntityAndChildren(id)
      })
    })

    // Remove traffic sprites
    if (this._trafficSprites) {
      this.viewer.scene.primitives.remove(this._trafficSprites)
      this._trafficSprites.destroy()
    }

    // Clear all maps
    this.entityMeta.clear()
    this._entityIds.clear()
    this._movingEntities.clear()
    this._satOrbits.clear()
    this._roadCorridors = []
    this._roadFlowSprites = []

    console.log('[GOTHAM] Entity System destroyed')
  }

  _removeEntityAndChildren(id) {
    const entity = this.viewer.entities.getById(id)
    if (entity) {
      this.viewer.entities.remove(entity)
    }
    
    // Remove related entities
    const relatedPrefixes = ['trail-', 'origin-', 'tether-', 'orbit-']
    relatedPrefixes.forEach(prefix => {
      const related = this.viewer.entities.getById(prefix + id)
      if (related) this.viewer.entities.remove(related)
    })

    this.entityMeta.delete(id)
    this._movingEntities.delete(id)
    this._trailPositions.delete(id)
  }

  // ── Icons ────────────────────────────────────────────────

  _createLightIcon (color, isHeadlight) {
    try {
      var c = document.createElement('canvas'); c.width = 16; c.height = 16; var ctx = c.getContext('2d')
      var gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
      gradient.addColorStop(0, color); gradient.addColorStop(0.4, color + 'aa'); gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(8, 8, 8, 0, Math.PI * 2); ctx.fill()
      return c.toDataURL()
    } catch (e) { return undefined }
  }

  _createAirplaneIcon (fill, stroke) {
    try {
      var c = document.createElement('canvas'); c.width = 64; c.height = 64; var ctx = c.getContext('2d')
      ctx.translate(32, 32); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(3, -18); ctx.lineTo(3, -8); ctx.lineTo(24, -2); ctx.lineTo(24, 2); ctx.lineTo(3, 0); ctx.lineTo(3, 14); ctx.lineTo(10, 20); ctx.lineTo(10, 23); ctx.lineTo(3, 20); ctx.lineTo(2, 26); ctx.lineTo(0, 24); ctx.lineTo(-2, 26); ctx.lineTo(-3, 20); ctx.lineTo(-10, 23); ctx.lineTo(-10, 20); ctx.lineTo(-3, 14); ctx.lineTo(-3, 0); ctx.lineTo(-24, 2); ctx.lineTo(-24, -2); ctx.lineTo(-3, -8); ctx.lineTo(-3, -18); ctx.closePath(); ctx.fill(); ctx.stroke()
      return c.toDataURL()
    } catch (e) { return undefined }
  }

  _createTransitIcon (fill) {
    try {
      var c = document.createElement('canvas'); c.width = 32; c.height = 32; var ctx = c.getContext('2d')
      ctx.fillStyle = fill; ctx.strokeStyle = '#005522'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(6, 4, 20, 24, 4); ctx.fill(); ctx.stroke()
      return c.toDataURL()
    } catch (e) { return undefined }
  }

  _createCarIcon (fill) {
    try {
      var c = document.createElement('canvas'); c.width = 32; c.height = 32; var ctx = c.getContext('2d')
      ctx.fillStyle = fill; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(16, 2); ctx.lineTo(22, 6); ctx.lineTo(24, 12); ctx.lineTo(24, 22); ctx.lineTo(22, 28); ctx.lineTo(10, 28); ctx.lineTo(8, 22); ctx.lineTo(8, 12); ctx.lineTo(10, 6); ctx.closePath(); ctx.fill(); ctx.stroke()
      return c.toDataURL()
    } catch (e) { return undefined }
  }

  // ── Interaction ──────────────────────────────────────────

  _setupClickHandler () {
    var self = this; var handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas)
    this._eventHandlers.push({ element: this.viewer.canvas, type: 'click', fn: handler })
    
    handler.setInputAction((click) => {
      if (self._isDestroyed) return
      
      var picked = self.viewer.scene.pick(click.position)
      if (Cesium.defined(picked) && picked.id) {
        var eid = typeof picked.id === 'string' ? picked.id : (picked.id.id || '')
        var meta = self.entityMeta.get(eid)
        if (meta) {
          self.selectedEntity = eid; self._showInfoPanel(meta.type, meta.data)
          var entity = self.viewer.entities.getById(eid)
          if (entity && meta.data.lat != null) {
            self.viewer.flyTo(entity, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), 10000)
            }).then(() => {
              if (self.selectedEntity === eid) self.viewer.trackedEntity = entity;
            });
          }
        }
      } else {
        self.viewer.trackedEntity = undefined;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  _setupKeyboardControls () {
    document.addEventListener('keydown', this._boundKeyDown)
    document.addEventListener('keyup', this._boundKeyUp)
    this._clockTickHandler = this.viewer.clock.onTick.addEventListener(this._boundClockTick)
  }

  _onKeyDown(e) {
    if (!e.target.matches('input,textarea')) this._keyState[e.code] = true
  }

  _onKeyUp(e) {
    this._keyState[e.code] = false
  }

  _onClockTick() {
    if (this._isDestroyed) return
    const keys = this._keyState
    
    // Break tracking on movement
    if (this.viewer.trackedEntity && (keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'])) {
      this.viewer.trackedEntity = undefined;
      return;
    }
    
    if (this.viewer.trackedEntity) return;
    
    var cam = this.viewer.camera
    var rate = Math.max(cam.positionCartographic.height * 0.000005, 0.0005)
    if (keys['ArrowLeft'] || keys['KeyA']) cam.rotateLeft(rate)
    if (keys['ArrowRight'] || keys['KeyD']) cam.rotateRight(rate)
    if (keys['ArrowUp'] || keys['KeyW']) cam.rotateUp(rate * 0.5)
    if (keys['ArrowDown'] || keys['KeyS']) cam.rotateDown(rate * 0.5)
  }

  // ── Update Loop ──────────────────────────────────────────

  _setupSmoothAnimation () {
    this._postRenderHandler = this.viewer.scene.postRender.addEventListener(this._boundPostRender)
  }

  _onPostRender() {
    if (this._isDestroyed) return
    
    var now = Date.now()
    var dt = (now - this._perfStats.lastFrameTime) / 1000
    this._perfStats.lastFrameTime = now
    this._perfStats.frameCount++
    
    if (dt > 1 || dt < 0.005) return // Ignore massive jumps or tiny steps
    
    this._frameId++
    
    // Distribute work across frames
    if (this._frameId % 2 === 0 && typeof satellite !== 'undefined') {
      this._updateSatellitePositions()
    }
    
    this._updateMovingEntities(dt)
    
    if (this._frameId % 3 === 0) {
      this._updateTrafficFlow(dt)
    }
  }

  _updateSatellitePositions() {
    const now = new Date()
    this.entityMeta.forEach((meta, key) => {
      if (meta.type === 'satellite' && meta.data.tle1) {
        try {
          // Cache satrec for performance
          let satrec = meta.data._cachedSatrec;
          if (!satrec) {
            satrec = satellite.twoline2satrec(meta.data.tle1, meta.data.tle2);
            meta.data._cachedSatrec = satrec;
          }
          
          var pv = satellite.propagate(satrec, now)
          if (pv && pv.position) {
            var gmst = satellite.gstime(now)
            var geo = satellite.eciToGeodetic(pv.position, gmst)
            if (geo) {
              meta.data.posCartesian = Cesium.Cartesian3.fromDegrees(
                satellite.degreesLong(geo.longitude), 
                satellite.degreesLat(geo.latitude), 
                geo.height * 1000
              )
            }
          }
        } catch (e) {}
      }
    })
  }

  _updateMovingEntities(dt) {
    this._movingEntities.forEach((data, key) => {
      var h = (data.heading || 0) * Math.PI / 180
      var dist = (data.velocity || 0) * dt
      data.lat += (dist * Math.cos(h)) / 111320
      data.lon += (dist * Math.sin(h)) / (111320 * Math.cos(data.lat * Math.PI / 180))
      data.posCartesian = Cesium.Cartesian3.fromDegrees(data.lon, data.lat, data.alt)
    })
  }

  _updateTrafficFlow(dt) {
    var flowEnabled = this.viewer.camera.positionCartographic.height < 15000 && window.gothamHUD?.layerVisibility?.traffic
    if (!flowEnabled) {
      for (let j = 0; j < this._trafficSprites.length; j++) {
        this._trafficSprites.get(j).show = false
      }
      return;
    }
    
    if (this._roadCorridors.length === 0) return
    if (this._roadFlowSprites.length !== this._roadCorridors.length * 20) {
      this._rebuildTrafficSprites()
    }
    
    var spriteIdx = 0
    var cam = this.viewer.camera.positionCartographic
    var cLat = Cesium.Math.toDegrees(cam.latitude)
    var cLon = Cesium.Math.toDegrees(cam.longitude)

    this._roadFlowSprites.forEach(s => {
      var cor = this._roadCorridors[s.corIdx]
      if (!cor) return;
      
      var hRad = s.h * Math.PI / 180
      var moveDist = s.v * dt
      s.lat += (moveDist * Math.cos(hRad)) / 111320
      s.lon += (moveDist * Math.sin(hRad)) / (111320 * Math.cos(cor.lat * Math.PI / 180))

      if (Math.abs(s.lat - cor.lat) > cor.spread || Math.abs(s.lon - cor.lon) > cor.spread) {
        s.lat = cor.lat; s.lon = cor.lon;
      }
      
      let b = this._trafficSprites.get(spriteIdx)
      if (!b) b = this._trafficSprites.add()

      var distKm = this._haversine(s.lat, s.lon, cLat, cLon)
      var inView = distKm < 50

      if (inView) {
        b.position = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 15)
        b.image = (s.color === 'white') ? this._headlightIcon : this._taillightIcon
        b.show = true
        b.scale = 0.4
      } else {
        b.show = false
      }
      spriteIdx++
    })
  }

  _rebuildTrafficSprites() {
    this._roadFlowSprites = []
    this._roadCorridors.forEach((cor, idx) => {
      for (let k = 0; k < 20; k++) {
        this._roadFlowSprites.push({
          lat: cor.lat + (Math.random()-0.5)*cor.spread,
          lon: cor.lon + (Math.random()-0.5)*cor.spread,
          h: cor.heading || 0,
          v: 10 + Math.random()*20,
          color: Math.random() > 0.4 ? 'white' : 'red',
          corIdx: idx
        })
      }
    })
  }

  // ── Core Entity Processing ─────────────────────────────────

  _updateLayers (data) {
    if (this._isDestroyed) return
    var now = Date.now()
    if (now - this._lastRender < this._renderThrottle) return
    this._lastRender = now
    this.dataCache = data

    var self = this
    
    // Group processing into batches to avoid frame drops
    var queue = []
    
    // Define all data feeds and their render functions
    var feeds = [
      ['flights', 'flight', 'fl', self._flightStyle],
      ['military', 'military', 'mil', self._milStyle],
      ['satellites', 'satellite', 'sat', self._renderSatBatch],
      ['traffic', 'traffic', 'traf', self._trafficStyle],
      ['transit', 'transit', 'trn', self._transitStyle],
      ['cctv', 'cctv', 'cam', self._cctvStyle],
      ['crime', 'crime', 'crm', self._crimeStyle],
      ['earthquakes', 'earthquake', 'quake', self._quakeStyle],
      ['volcanoes', 'volcano', 'volc', self._volcanoStyle],
      ['wildfires', 'wildfire', 'fire', self._fireStyle],
      ['weather', 'weather', 'wx', self._wxStyle],
      ['gdacs', 'gdacs', 'gdacs', self._gdacsStyle],
      ['airquality', 'airquality', 'aq', self._aqStyle],
      ['bikeshare', 'bikeshare', 'bk', self._bikeStyle],
      ['buoys', 'buoy', 'buoy', self._buoyStyle],
      ['water', 'water', 'wtr', self._waterStyle],
      ['spacewx', 'spacewx', 'swx', self._spacewxStyle],
      ['evchargers', 'evcharger', 'ev', self._evStyle],
      ['riverlevels', 'river', 'riv', self._riverStyle],
      ['tides', 'tide', 'tide', self._tideStyle],
      ['neos', 'neo', 'neo', self._neoStyle],
      ['fireballs', 'fireball', 'meteor', self._fireballStyle],
      ['carbon', 'carbon', 'co2', self._carbonStyle],
      ['github', 'github', 'gh', self._githubStyle],
      // ShadowBroker Integrations
      ['ships', 'ship', 'ship', self._shipStyle],
      ['news', 'news', 'news', self._newsStyle],
      ['frontlines', 'frontline', 'front', self._frontlineStyle],
      ['internet_outages', 'outage', 'out', self._outageStyle],
      ['datacenters', 'infrastructure', 'infra', self._infraStyle],
      ['power_plants', 'infrastructure', 'pwr', self._infraStyle],
      ['military_bases', 'infrastructure', 'base', self._infraStyle],
      ['kiwisdr', 'kiwisdr', 'kiwi', self._kiwisdrStyle],
      ['stocks', 'financial', 'fin', self._financialStyle],
      ['oil', 'financial', 'oil', self._financialStyle],
      ['gps_jamming', 'jamming', 'jam', self._jammingStyle],
      ['aliens', 'alien', 'ufo', self._alienStyle],
      ['stars', 'star', 'star', self._starStyle.bind(self)],
      ['meteors', 'meteor', 'met', self._meteorStyle.bind(self)]
    ]

    var visMap = {
      flight: 'flight',
      military: 'flight',
      satellite: 'satellite',
      traffic: 'traffic',
      transit: 'transit',
      cctv: 'cctv',
      earthquake: 'hazard',
      volcano: 'hazard',
      wildfire: 'hazard',
      gdacs: 'hazard',
      weather: 'environment',
      airquality: 'environment',
      crime: 'intel',
      buoy: 'sea',
      tide: 'sea',
      neo: 'space',
      ship: 'sea',
      news: 'intel',
      frontline: 'intel',
      outage: 'infrastructure',
      infrastructure: 'infrastructure'
    }

    // Prepare queue based on visibility
    feeds.forEach((f) => {
      var vGroup = visMap[f[1]] || f[1]
      var isVis = window.gothamHUD?.layerVisibility?.[vGroup] === true
      if (isVis && Array.isArray(data[f[0]])) {
        queue.push({
          items: data[f[0]],
          type: f[1],
          prefix: f[2],
          styleFn: f[3],
          isVisible: isVis
        })
      } else if (!isVis) {
        self._hidePrefix(f[2])
      }
    })

    this._processQueue(queue)
  }

  _createEntitiesForTypes(entityTypes, groupName) {
    if (this._isDestroyed || !this.dataCache) return;
    
    // Map of backend data keys to internal entity types
    const dataKeyMap = {
      'flights': ['flight'],
      'military': ['military'],
      'satellites': ['satellite'],
      'ships': ['ship'],
      'maritime': ['ship', 'buoy'], // Fallback map
      'earthquakes': ['earthquake'],
      'wildfires': ['wildfire'],
      'news': ['news'],
      'frontlines': ['frontline'],
      'outages': ['outage'],
      'internet_outages': ['outage'], // Alias
      'infrastructure': ['infrastructure'],
      'datacenters': ['infrastructure'], // Alias
      'kiwisdr': ['kiwisdr'],
      'gps_jamming': ['jamming'],
      'jamming': ['jamming'], // Alias
      'aliens': ['alien'],
      'ufo_sightings': ['alien'], // Alias
      'neos': ['neo'],
      'fireballs': ['fireball'],
      'stars': ['star'],
      'meteors': ['meteor'],
      'traffic': ['traffic'],
      'transit': ['transit'],
      'bikeshare': ['bikeshare'],
      'cctv': ['cctv'],
      'weather': ['weather'],
      'airquality': ['airquality'],
      'gdacs': ['gdacs'],
      'volcanoes': ['volcano'],
      'crime': ['crime'],
      'buoys': ['buoy'],
      'water': ['water'],
      'spacewx': ['spacewx'],
      'evchargers': ['evcharger'],
      'riverlevels': ['river'],
      'tides': ['tide'],
      'carbon': ['carbon'],
      'github': ['github'],
      'stocks': ['financial'],
      'oil': ['financial']
    };

    // Find which data keys we need based on requested types
    const keysToProcess = [];
    Object.entries(dataKeyMap).forEach(([dataKey, types]) => {
      const match = types.some(t => entityTypes.includes(t));
      if (match && this.dataCache[dataKey] && Array.isArray(this.dataCache[dataKey])) {
        keysToProcess.push(dataKey);
      }
    });

    if (keysToProcess.length === 0) return;

    console.log(`[GOTHAM] Manual override creating entities for ${groupName} (${keysToProcess.join(', ')})`);

    keysToProcess.forEach(dataKey => {
      const items = this.dataCache[dataKey];
      // Get unique entities to prevent duplication
      const uniqueItems = Array.from(new Map(items.map(item => [item.id || item.callsign || item.name, item])).values());
      
      const entityType = dataKeyMap[dataKey][0]; // Primary type for this data
      
      console.log(`[ENTITY SYSTEM] Processing ${items.length} items from ${dataKey} as type ${entityType}`);
      
      // Process items in optimized batches
      let idx = 0;
      const batchSize = this._batchSize;
      
      const processBatch = () => {
        if (this._isDestroyed) return
        
        const end = Math.min(idx + batchSize, items.length);
        for (let i = idx; i < end; i++) {
          const d = items[i];
          
          // Handle GeoJSON features (frontlines, etc.)
          if (d.geometry && d.geometry.type) {
            const uid = d.id || (d.properties && d.properties.name) || `geo-${i}`;
            const prefix = entityType.substring(0, 3);
            const key = `${prefix}-${uid}`;
            if (this.viewer.entities.getById(key)) continue;
            try {
              this.entityMeta.set(key, { type: entityType, data: d });
              const e = new Cesium.Entity({ id: key });
              this.viewer.entities.add(e);
              const styleFn = this[`_${entityType}Style`] || this._defaultStyle;
              styleFn.call(this, e, d);
              e.show = true;
            } catch (err) { console.warn('[ENTITY SYSTEM] Error creating GeoJSON entity:', err); }
            continue;
          }
          
          const lat = d.lat || d.latitude;
          const lon = d.lon || d.longitude || d.lng;
          if (lat === undefined || lon === undefined) continue;
          
          // Generate consistent ID
          const uid = d.id || d.callsign || d.name || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
          const prefix = entityType.substring(0, 3);
          const key = `${prefix}-${uid}`;
          
          // Check if entity already exists
          if (this.viewer.entities.getById(key)) continue;
          
          // Create new entity
          try {
            this.entityMeta.set(key, { type: entityType, data: d });
            const e = new Cesium.Entity({ id: key });
            this.viewer.entities.add(e);
            
            // Apply appropriate style
            const styleFn = this[`_${entityType}Style`] || this._defaultStyle;
            styleFn.call(this, e, d);
            
            // Set height reference based on type
            const isSurface = ['traffic', 'transit', 'cctv', 'crime', 'earthquake', 'volcano', 'wildfire', 'weather', 'airquality', 'buoy', 'water', 'evcharger', 'river', 'tide', 'ship', 'news', 'outage', 'infrastructure', 'kiwisdr', 'financial'].includes(entityType);
            const alt = ['flight', 'military'].includes(entityType) ? Math.max(d.alt || 10000, 500) : 150;
            
            if (e.billboard) { 
              e.billboard.disableDepthTestDistance = 3000; 
              e.billboard.heightReference = isSurface ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE;
            }
            if (e.point) { 
              e.point.disableDepthTestDistance = 3000; 
              e.point.heightReference = isSurface ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE;
            }
            if (e.label) { 
              e.label.disableDepthTestDistance = 3000; 
              e.label.heightReference = isSurface ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE;
            }
            
            // Set position
            e.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
            e.show = true;
            
            // Track moving entities
            if (['flight', 'military', 'transit', 'traffic'].includes(entityType)) {
              this._movingEntities.set(key, { 
                lat: lat, lon: lon, alt: alt, 
                posCartesian: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
                velocity: d.velocity || 5, 
                heading: d.heading || 0, 
                lastUpdate: Date.now() 
              });
            }
          } catch (err) {
            console.warn('[ENTITY SYSTEM] Error creating entity:', err);
          }
        }
        
        idx = end;
        if (idx < items.length) {
          requestAnimationFrame(processBatch);
        } else {
          console.log(`[ENTITY SYSTEM] Finished creating entities for ${dataKey}`);
        }
      };
      
      processBatch();
    });
  }
  
  _defaultStyle(e, d) {
    if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 6, color: Cesium.Color.CYAN });
  }

  _hidePrefix (prefix) {
    var ids = this._entityIds.get(prefix); if (!ids) return
    ids.forEach(id => {
      var e = this.viewer.entities.getById(id); if (e) e.show = false
      var tr = this.viewer.entities.getById('trail-' + id); if (tr) tr.show = false
      var or = this.viewer.entities.getById('orbit-' + id); if (or) or.show = false
    })
  }

  _processQueue(queue) {
    if (this._isDestroyed || queue.length === 0) {
      this._isRendering = false
      return
    }
    this._isRendering = true
    
    let qIdx = 0
    const processNextType = () => {
      if (this._isDestroyed) return
      if (qIdx >= queue.length) {
        this._isRendering = false
        return
      }
      
      var task = queue[qIdx]
      // Pre-filter duplicates to reduce processing load
      const uniqueItems = Array.from(new Map(task.items.map(item => [item.id || item.callsign || item.name || `${item.lat}-${item.lon}`, item])).values());
      
      if (task.type === "satellite") {
        this._renderSatBatch(uniqueItems, () => {
          qIdx++
          setTimeout(processNextType, this._drainDelay)
        }, task.isVisible)
      } else {
        this._renderSimpleBatch(uniqueItems, task.type, task.prefix, task.styleFn, () => {
          qIdx++
          setTimeout(processNextType, this._drainDelay)
        }, task.isVisible)
      }
    }
    processNextType()
  }

  _renderSimpleBatch (items, type, prefix, styleFn, onComplete, isVisible) {
    var self = this; 
    var currentIds = new Set(); 
    var idx = 0; 
    var batchSize = this._batchSize
    
    // Pre-allocate trail color to avoid GC
    const trailColor = type === 'military' ? Cesium.Color.MAGENTA.withAlpha(0.6) : 
                       type === 'flight' ? Cesium.Color.CYAN.withAlpha(0.4) : 
                       type === 'transit' ? Cesium.Color.fromCssColorString('#33ff99').withAlpha(0.5) : 
                       Cesium.Color.fromCssColorString('#ffaa00').withAlpha(0.5);
    const trailWidth = (type === 'military' || type === 'flight') ? 2 : 1.5;
    const maxTrailLength = type === 'military' ? 25 : 15;
    
    var nextBatch = () => {
      if (this._isDestroyed) return
      var end = Math.min(idx + batchSize, items.length)
      for (let i = idx; i < end; i++) {
        try {
          const d = items[i];
          const lat = d.lat || d.latitude;
          const lon = d.lon || d.longitude || d.lng;
          if (lat === undefined || lon === undefined) continue;
          
          // STRICT ID GENERATION
          const uid = d.id || d.callsign || d.name || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
          const key = `${prefix}-${uid}`;
          
          currentIds.add(key); self.entityMeta.set(key, { type: type, data: d })
          
          let e = self.viewer.entities.getById(key)
          if (!e) {
            e = new Cesium.Entity({ id: key })
            self.viewer.entities.add(e)
          }
          
          const isSurface = ['traffic', 'transit', 'cctv', 'crime', 'earthquake', 'volcano', 'wildfire', 'weather', 'airquality', 'buoy', 'water', 'evcharger', 'river', 'tide', 'fireball', 'ship', 'news', 'outage', 'infrastructure', 'kiwisdr', 'financial'].includes(type)
          const alt = type === 'flight' || type === 'military' ? Math.max(d.alt || 10000, 500) : 150 
          const pos = Cesium.Cartesian3.fromDegrees(lon, lat, alt)
          if (isNaN(pos.x) || pos.x === 0) continue

          e.show = isVisible; styleFn.call(self, e, d)
          
          if (e.billboard) { e.billboard.disableDepthTestDistance = 3000; e.billboard.heightReference = isSurface ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE }
          if (e.label) { e.label.disableDepthTestDistance = 3000; e.label.heightReference = isSurface ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE; e.label.show = true }
          if (e.point) { e.point.disableDepthTestDistance = 3000; e.point.heightReference = isSurface ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE }

          // Only create CallbackProperty once per entity
          if (!e.position || !e.position._isGothamCB) {
            e.position = new Cesium.CallbackProperty(() => {
              const me = self._movingEntities.get(key); return (me && me.posCartesian) ? me.posCartesian : pos
            }, false); 
            e.position._isGothamCB = true
            e.position._gothamKey = key  // Store key for debugging
          }

          // Track moving entities
          if (['flight', 'military', 'transit', 'traffic'].includes(type)) {
            self._movingEntities.set(key, { lat: lat, lon: lon, alt: alt, posCartesian: pos, velocity: d.velocity || 5, heading: d.heading || 0, lastUpdate: Date.now() })
            
            // Trails - optimized
            let trail = self._trailPositions.get(key);
            if (!trail) {
              trail = [];
              self._trailPositions.set(key, trail);
            }
            if (!isNaN(pos.x)) trail.push(pos);
            if (trail.length > maxTrailLength) trail.shift();
            
            // Create/update trail entity only when needed
            let trailId = 'trail-' + key; 
            let te = self.viewer.entities.getById(trailId);
            if (!te && trail.length > 2) {
              // Create new trail entity with static show property (no CallbackProperty for show)
              te = self.viewer.entities.add({ 
                id: trailId, 
                show: isVisible,
                polyline: { 
                  positions: new Cesium.CallbackProperty(() => {
                    var t = self._trailPositions.get(key); 
                    return (t && t.length >= 2) ? t : [self.SAFE_POS, self.SAFE_POS];
                  }, false), 
                  width: trailWidth, 
                  material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.15, color: trailColor }),
                  disableDepthTestDistance: 3000
                } 
              });
            } else if (te) { 
              te.show = isVisible;
            }

            // Tethers for flights and military
            if (type === 'flight' || type === 'military') {
              let tetherId = 'tether-' + key; 
              let teth = self.viewer.entities.getById(tetherId);
              if (!teth) {
                const tetherColor = type === 'military' ? Cesium.Color.MAGENTA : Cesium.Color.CYAN;
                teth = self.viewer.entities.add({ 
                  id: tetherId, 
                  show: false, // Hidden by default, shown on selection
                  polyline: { 
                    positions: new Cesium.CallbackProperty(() => {
                      var me = self._movingEntities.get(key);
                      if (!me || !me.posCartesian || isNaN(me.posCartesian.x) || isNaN(me.lat)) {
                        return [self.SAFE_POS, self.SAFE_POS];
                      }
                      return [Cesium.Cartesian3.fromDegrees(me.lon, me.lat, 0), me.posCartesian];
                    }, false), 
                    width: 1, 
                    material: tetherColor.withAlpha(0.2),
                    disableDepthTestDistance: 3000
                  } 
                });
              }
            }
          }
        } catch (err) { 
          console.warn('[ENTITY SYSTEM] Error in batch render:', err);
        }
      }
      idx = end; 
      if (idx < items.length) {
        requestAnimationFrame(nextBatch); 
      } else { 
        // Cleanup old entities
        var oldIds = self._entityIds.get(prefix) || new Set();
        oldIds.forEach((id) => { 
          if (!currentIds.has(id)) { 
            self._removeEntityAndChildren(id);
          } 
        });
        self._entityIds.set(prefix, currentIds); 
        onComplete() 
      }
    }; 
    nextBatch()
  }

  _renderSatBatch (sats, onComplete, isVisible) {
    var self = this; var currentIds = new Set(); var idx = 0; var batchSize = this._batchSize
    var nextBatch = () => {
      if (this._isDestroyed) return
      var end = Math.min(idx + batchSize, sats.length)
      for (let i = idx; i < end; i++) {
        try {
          const s = sats[i]; const key = 'sat-' + (s.id || s.name || `sat-${i}`)
          currentIds.add(key); self.entityMeta.set(key, { type: 'satellite', data: s })
          
          let e = self.viewer.entities.getById(key)
          if (!e) { e = new Cesium.Entity({ id: key }); self.viewer.entities.add(e) }
          
          if (!e.position || !e.position._isGothamCB) {
            e.position = new Cesium.CallbackProperty(() => {
              const meta = self.entityMeta.get(key); 
              return (meta && meta.data.posCartesian) ? meta.data.posCartesian : Cesium.Cartesian3.fromDegrees(0,0,400000)
            }, false); 
            e.position._isGothamCB = true
          }
          
          e.show = isVisible; 
          if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 5, color: Cesium.Color.YELLOW, disableDepthTestDistance: 3000 })
          if (!e.label) e.label = new Cesium.LabelGraphics({ text: s.name, font: '8px "Share Tech Mono"', fillColor: Cesium.Color.YELLOW, pixelOffset: new Cesium.Cartesian2(8,0), disableDepthTestDistance: 3000 })

          // Satellite Coverage Footprint
          if (!e.ellipse) {
            var altKm = s.alt || 400;
            var coverageRadius = altKm * 1000 * Math.tan(Cesium.Math.toRadians(25)); // 25-degree field of view
            if (coverageRadius < 100000) coverageRadius = 100000;
            
            var footprintColor = Cesium.Color.CYAN.withAlpha(0.05);
            var outlineColor = Cesium.Color.CYAN.withAlpha(0.2);
            
            if (altKm > 2000 && altKm < 35000) {
              footprintColor = Cesium.Color.fromCssColorString('#4488ff').withAlpha(0.05);
              outlineColor = Cesium.Color.fromCssColorString('#4488ff').withAlpha(0.2);
            } else if (altKm >= 35000) {
              footprintColor = Cesium.Color.YELLOW.withAlpha(0.05);
              outlineColor = Cesium.Color.YELLOW.withAlpha(0.2);
            }

            e.ellipse = new Cesium.EllipseGraphics({
              semiMajorAxis: coverageRadius,
              semiMinorAxis: coverageRadius,
              material: new Cesium.ColorMaterialProperty(footprintColor),
              outline: true,
              outlineColor: outlineColor,
              outlineWidth: 1,
              // Only show footprint when zoomed out far enough to see it properly
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(2000000, Number.MAX_VALUE)
            });
          }

          // Orbital Rings - create once
          let orbitId = 'orbit-' + key;
          let orb = self.viewer.entities.getById(orbitId);
          if (!orb && s.tle1 && typeof satellite !== 'undefined') {
            var satrec = satellite.twoline2satrec(s.tle1, s.tle2);
            var points = self._generateFullOrbit(satrec);
            var altKm = s.alt || 400;
            var ringColor = Cesium.Color.CYAN.withAlpha(0.25);
            if (altKm > 2000 && altKm < 35000) ringColor = Cesium.Color.fromCssColorString('#4488ff').withAlpha(0.25);
            if (altKm >= 35000) ringColor = Cesium.Color.YELLOW.withAlpha(0.35);

            self.viewer.entities.add({
              id: orbitId,
              show: isVisible,
              polyline: {
                positions: points,
                width: 1,
                material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.15, color: ringColor }),
                disableDepthTestDistance: 3000
              }
            });
          } else if (orb) { 
            orb.show = isVisible; 
          }
        } catch (err) {
          console.warn('[ENTITY SYSTEM] Error rendering satellite:', err);
        }
      }
      idx = end; 
      if (idx < sats.length) {
        requestAnimationFrame(nextBatch); 
      } else { 
        // Cleanup old satellites
        var oldIds = self._entityIds.get('sat') || new Set();
        oldIds.forEach((id) => { 
          if (!currentIds.has(id)) { 
            self._removeEntityAndChildren(id);
          } 
        });
        self._entityIds.set('sat', currentIds); 
        onComplete() 
      }
    }; 
    nextBatch()
  }

  _generateFullOrbit(satrec) {
    if (typeof satellite === 'undefined') return [];
    var points = [];
    var now = new Date();
    // Reduced from 100 to 50 points for better performance
    for (var i = 0; i <= 50; i += 2) {
      var time = new Date(now.getTime() + i * 120000); // 2 minute intervals
      try {
        var posVel = satellite.propagate(satrec, time);
        if (posVel && posVel.position) {
          var gmst = satellite.gstime(time);
          var posGd = satellite.eciToGeodetic(posVel.position, gmst);
          points.push(Cesium.Cartesian3.fromDegrees(
            satellite.degreesLong(posGd.longitude),
            satellite.degreesLat(posGd.latitude),
            posGd.height * 1000
          ));
        }
      } catch (e) {}
    }
    return points.length > 1 ? points : [this.SAFE_POS, this.SAFE_POS];
  }

  // ── Style ──────────────────────────────────────────

  _showInfoPanel (t, d) {
    var title = document.getElementById('ghud-entity-title'); 
    var body = document.getElementById('ghud-entity-body')
    if (!title || !body) return
    title.textContent = t.toUpperCase(); title.style.color = '#00f0ff'
    var html = '<table style="width:100%;font-size:11px">'
    Object.keys(d).forEach(k => { if (typeof d[k] !== 'object' && k !== 'posCartesian' && !k.startsWith('_')) html += `<tr><td style="color:#666">${k}</td><td>${d[k]}</td></tr>` })
    body.innerHTML = html + '</table>'
  }

  _starStyle (e, d) {
    // 🌌 Deep Space Transients - Pulsing white/cyan stars
    if (!e.point) {
      e.point = new Cesium.PointGraphics({
        pixelSize: new Cesium.CallbackProperty(() => {
          return 4 + Math.sin(Date.now() / 300) * 2;
        }, false),
        color: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.CYAN,
        outlineWidth: 1,
        disableDepthTestDistance: 5000000
      });
    }
    if (!e.label) {
      e.label = new Cesium.LabelGraphics({
        text: (d.name || 'TRANSIENT').toUpperCase(),
        font: '9px "Share Tech Mono"',
        fillColor: Cesium.Color.CYAN,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(1000000, 10000000)
      });
    }
  }

  _meteorStyle (e, d) {
    // 🌠 Atmospheric Meteors - Bright streaks with tails
    if (!e.point) {
      e.point = new Cesium.PointGraphics({
        pixelSize: 6,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      });
    }
    // Meteor Trail
    if (d.lat != null && d.lon != null) {
      const key = 'meteor-' + d.id;
      let trail = this._trailPositions.get(key);
      if (!trail) {
        trail = [];
        this._trailPositions.set(key, trail);
        // Generate a fake entry trail for visual effect
        const startPos = Cesium.Cartesian3.fromDegrees(d.lon - 0.5, d.lat + 0.5, 100000);
        const endPos = Cesium.Cartesian3.fromDegrees(d.lon, d.lat, 80000);
        trail.push(startPos, endPos);
      }

      let trailId = 'trail-' + key;
      if (!this.viewer.entities.getById(trailId)) {
        this.viewer.entities.add({
          id: trailId,
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
                var t = this._trailPositions.get(key);
                return (t && t.length >= 2) ? t : [this.SAFE_POS, this.SAFE_POS];
            }, false),
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.WHITE.withAlpha(0.6) })
          }
        });
      }
    }
  }

  _flightStyle (e, d) { 
    if (!e.billboard) {
      e.billboard = new Cesium.BillboardGraphics({ image: this._planeIcon, scale: 0.5, alignedAxis: Cesium.Cartesian3.UNIT_Z }) 
      e.billboard.rotation = new Cesium.CallbackProperty(() => {
        var me = this._movingEntities.get(e.id);
        return Cesium.Math.toRadians(-(me ? me.heading : d.heading || 0));
      }, false)
    }
  }
  _milStyle (e, d) { 
    if (!e.billboard) {
      e.billboard = new Cesium.BillboardGraphics({ image: this._milIcon, scale: 0.6, alignedAxis: Cesium.Cartesian3.UNIT_Z }) 
      e.billboard.rotation = new Cesium.CallbackProperty(() => {
        var me = this._movingEntities.get(e.id);
        return Cesium.Math.toRadians(-(me ? me.heading : d.heading || 0));
      }, false)
    }
  }
  _transitStyle (e, d) { if (!e.billboard) e.billboard = new Cesium.BillboardGraphics({ image: this._transitIcon, scale: 0.6 }) }
  _trafficStyle (e, d) { if (!e.billboard) e.billboard = new Cesium.BillboardGraphics({ image: this._trafficIcon, scale: 0.4 }) }
  _cctvStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 8, color: Cesium.Color.CYAN }) }
  _crimeStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 5, color: Cesium.Color.RED }) }
  _quakeStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 10, color: Cesium.Color.RED }) }
  _volcanoStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 12, color: Cesium.Color.ORANGE }) }
  _fireStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 8, color: Cesium.Color.YELLOW }) }
  _wxStyle (e, d) { if (!e.label) e.label = new Cesium.LabelGraphics({ text: d.temp + 'C', font: '10px', fillColor: Cesium.Color.CYAN }) }
  _buoyStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 6, color: Cesium.Color.BLUE }) }
  _aqStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 6, color: Cesium.Color.fromCssColorString('#66ddaa') }) }
  _bikeStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 4, color: Cesium.Color.fromCssColorString('#44ff88') }) }
  _waterStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 6, color: Cesium.Color.fromCssColorString('#4488ff') }) }
  _spacewxStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 7, color: Cesium.Color.MAGENTA }) }
  _evStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 4, color: Cesium.Color.fromCssColorString('#44ffaa') }) }
  _riverStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 6, color: Cesium.Color.fromCssColorString('#2299ff') }) }
  _tideStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 7, color: Cesium.Color.fromCssColorString('#00ddcc') }) }
  _neoStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 8, color: Cesium.Color.ORANGE }) }
  _fireballStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 10, color: Cesium.Color.RED }) }
  _gdacsStyle (e, d) { if (!e.point) e.point = new Cesium.PointGraphics({ pixelSize: 10, color: Cesium.Color.fromCssColorString('#ff0066') }) }
  _carbonStyle (e, d) {
    if (!e.point) {
      var idx = (d.index || '').toLowerCase()
      var c = idx === 'very high' ? Cesium.Color.RED : idx === 'high' ? Cesium.Color.ORANGE : idx === 'moderate' ? Cesium.Color.YELLOW : Cesium.Color.fromCssColorString('#44ff88')
      e.point = new Cesium.PointGraphics({ pixelSize: 8, color: c })
    }
  }
  _alertStyle (e, d) { 
    if (!e.point) {
      var s = (d.severity || '').toLowerCase();
      var c = Cesium.Color.YELLOW;
      if (s.includes('extreme') || s.includes('critical')) c = Cesium.Color.RED;
      else if (s.includes('severe') || s.includes('warning')) c = Cesium.Color.ORANGE;
      else if (s.includes('watch')) c = Cesium.Color.YELLOW;
      else c = Cesium.Color.LIME;
      e.point = new Cesium.PointGraphics({ pixelSize: 10, color: c, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 })
      e.label = new Cesium.LabelGraphics({ text: '!', font: '14px bold', fillColor: c }) 
    }
  }

  // ╭──────────────────────────────────────────────────────────
  // SHADOWBROKER OSINT STYLE FUNCTIONS
  // ╰──────────────────────────────────────────────────────────

  _shipStyle (e, d) {
      // AIS vessels - anchor/boat icon + AIS trail
      if (!e.billboard) {
        e.billboard = new Cesium.BillboardGraphics({
          image: this._createShipIcon(d.ship_type || 'vessel'),
          scale: 0.5,
          alignedAxis: Cesium.Cartesian3.UNIT_Z
        });
        e.billboard.rotation = new Cesium.CallbackProperty(() => {
          var me = this._movingEntities.get(e.id);
          return Cesium.Math.toRadians(-(me ? me.heading : d.heading || 0));  
        }, false);
      }
      if (!e.label && d.name) {
        e.label = new Cesium.LabelGraphics({
          text: d.name.substring(0, 12),
          font: '10px "Share Tech Mono"',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000)
        });
      }
      // AIS Trail logic
      if (d.lat != null && d.lon != null) {
        const key = 'ship-' + (d.id || d.mmsi || d.name);
        const pos = Cesium.Cartesian3.fromDegrees(d.lon, d.lat);
        let trail = this._trailPositions.get(key);
        if (!trail) {
          trail = [];
          this._trailPositions.set(key, trail);
        }
        if (!isNaN(pos.x)) trail.push(pos);
        if (trail.length > 50) trail.shift();

        let trailId = 'trail-' + key;
        let te = this.viewer.entities.getById(trailId);
        if (!te && trail.length >= 2) {
          this.viewer.entities.add({
            id: trailId,
            polyline: {
              positions: new Cesium.CallbackProperty(() => {
                var t = this._trailPositions.get(key);
                return (t && t.length >= 2) ? t : [this.SAFE_POS, this.SAFE_POS];
              }, false),
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.1, color: Cesium.Color.CYAN.withAlpha(0.4) }),
              disableDepthTestDistance: 3000
            }
          });
        } else if (te) {
          te.show = e.show;
        }
      }
  }

  _newsStyle (e, d) {
    // Geopolitical events - newspaper icon with risk-score color
    if (!e.billboard) {
      var risk = (d.risk_score || d.severity || 0);
      var color = risk > 70 ? Cesium.Color.RED : risk > 40 ? Cesium.Color.ORANGE : Cesium.Color.YELLOW;
      e.billboard = new Cesium.BillboardGraphics({ 
        image: this._createNewsIcon(color), 
        scale: 0.6,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      });
    }
    if (!e.label && d.title) {
      e.label = new Cesium.LabelGraphics({ 
        text: d.title.substring(0, 20) + (d.title.length > 20 ? '...' : ''), 
        font: '9px "Share Tech Mono"',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -25),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000)
      });
    }
  }

  _frontlineStyle (e, d) {
      // Conflict frontlines - GeoJSON polygon/polyline with red outline + pulsing border
      if (d.geometry && d.geometry.type === 'Polygon') {
        if (!e.polygon) {
          var coords = d.geometry.coordinates[0];
          var positions = coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1]));
          e.polygon = new Cesium.PolygonGraphics({
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: Cesium.Color.RED.withAlpha(0.15),
            outline: true,
            outlineColor: new Cesium.CallbackProperty(() => {
              var pulse = Math.sin(Date.now() / 300) * 0.5 + 0.5;
              return Cesium.Color.RED.withAlpha(0.5 + pulse * 0.5);
            }, false),
            outlineWidth: new Cesium.CallbackProperty(() => {
              return 2 + Math.sin(Date.now() / 300) * 2;
            }, false),
            height: 100
          });
        }
      } else if (d.geometry && d.geometry.type === 'LineString') {
        if (!e.polyline) {
          var coords = d.geometry.coordinates;
          if (coords && coords.length >= 2) {
            var positions = coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1]));
            e.polyline = new Cesium.PolylineGraphics({
              positions: positions,
              width: new Cesium.CallbackProperty(() => {
                return 3 + Math.sin(Date.now() / 300) * 2;
              }, false),
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.25,
                color: Cesium.Color.RED
              })
            });
          }
        }
      }
      if (!e.label && d.name) {
        e.label = new Cesium.LabelGraphics({
          text: d.name.toUpperCase(),
          font: '10px bold "Share Tech Mono"',
          fillColor: Cesium.Color.RED,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -30)
        });
      }
  }

  _outageStyle (e, d) {
    // Internet outages - pulsating red circle
    if (!e.point) {
      e.point = new Cesium.PointGraphics({ 
        pixelSize: 15, 
        color: Cesium.Color.RED.withAlpha(0.6),
        outlineColor: Cesium.Color.DARKRED,
        outlineWidth: 2
      });
    }
    // Pulsating effect using CallbackProperty
    if (!e.ellipse) {
      e.ellipse = new Cesium.EllipseGraphics({
        semiMinorAxis: new Cesium.CallbackProperty(() => {
          var pulse = 5000 + Math.sin(Date.now() / 500) * 2000;
          return pulse;
        }, false),
        semiMajorAxis: new Cesium.CallbackProperty(() => {
          var pulse = 5000 + Math.sin(Date.now() / 500) * 2000;
          return pulse;
        }, false),
        material: Cesium.Color.RED.withAlpha(0.1),
        outline: true,
        outlineColor: Cesium.Color.RED.withAlpha(0.3),
        height: 0
      });
    }
    if (!e.label && d.location) {
      e.label = new Cesium.LabelGraphics({ 
        text: 'OUTAGE: ' + d.location.substring(0, 15), 
        font: '9px "Share Tech Mono"',
        fillColor: Cesium.Color.RED,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -30)
      });
    }
  }

  _infraStyle (e, d) {
    // Fixed infrastructure - building icon + category color
    var category = d.category || d.type || 'facility';
    var color = Cesium.Color.CYAN;
    if (category.includes('datacenter') || category.includes('data_center')) color = Cesium.Color.fromCssColorString('#00f0ff');
    else if (category.includes('military') || category.includes('base')) color = Cesium.Color.fromCssColorString('#ff0044');
    else if (category.includes('power') || category.includes('plant')) color = Cesium.Color.fromCssColorString('#ffaa00');
    
    if (!e.billboard) {
      e.billboard = new Cesium.BillboardGraphics({ 
        image: this._createBuildingIcon(color), 
        scale: 0.5,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      });
    }
    if (!e.label && d.name) {
      e.label = new Cesium.LabelGraphics({ 
        text: d.name.substring(0, 18), 
        font: '9px "Share Tech Mono"',
        fillColor: color,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000)
      });
    }
  }

  _kiwisdrStyle (e, d) {
    // KiwiSDR nodes - radio tower icon
    if (!e.billboard) {
      e.billboard = new Cesium.BillboardGraphics({ 
        image: this._createRadioTowerIcon(), 
        scale: 0.6,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      });
    }
    if (!e.label && d.frequency) {
      e.label = new Cesium.LabelGraphics({ 
        text: d.frequency + ' MHz', 
        font: '9px "Share Tech Mono"',
        fillColor: Cesium.Color.MAGENTA,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -25)
      });
    }
  }

  _financialStyle (e, d) {
    // Defense stocks/oil - scrolling ticker style (static billboard)
    var isOil = d.commodity || d.type === 'oil';
    var color = isOil ? Cesium.Color.fromCssColorString('#ffaa00') : Cesium.Color.fromCssColorString('#00ff88');
    var symbol = d.symbol || d.ticker || 'STK';
    var value = d.price || d.value || 0;
    var change = d.change || 0;
    var changeStr = change >= 0 ? '+' + change.toFixed(2) : change.toFixed(2);
    
    if (!e.billboard) {
      e.billboard = new Cesium.BillboardGraphics({ 
        image: this._createTickerIcon(color, isOil), 
        scale: 0.5,
        verticalOrigin: Cesium.VerticalOrigin.CENTER
      });
    }
    if (!e.label) {
      e.label = new Cesium.LabelGraphics({ 
        text: symbol + ' $' + value.toFixed(2) + ' (' + changeStr + '%)', 
        font: '10px "Share Tech Mono"',
        fillColor: change >= 0 ? Cesium.Color.GREEN : Cesium.Color.RED,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000)
      });
    }
  }

  // Icon generators for ShadowBroker styles
  _createShipIcon (shipType) {
    var canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#004466';
    ctx.lineWidth = 2;
    // Simple ship shape
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(28, 20);
    ctx.lineTo(24, 28);
    ctx.lineTo(8, 28);
    ctx.lineTo(4, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return canvas.toDataURL();
  }

  _createNewsIcon (color) {
    var canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 24;
    var ctx = canvas.getContext('2d');
    var c = color.toCssColorString ? color.toCssColorString() : color;
    ctx.fillStyle = c;
    // Newspaper shape
    ctx.fillRect(4, 4, 16, 16);
    ctx.fillStyle = '#000';
    ctx.fillRect(6, 6, 12, 2);
    ctx.fillRect(6, 10, 12, 2);
    ctx.fillRect(6, 14, 8, 2);
    return canvas.toDataURL();
  }

  _createBuildingIcon (color) {
    var canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 24;
    var ctx = canvas.getContext('2d');
    var c = color.toCssColorString ? color.toCssColorString() : color;
    ctx.fillStyle = c;
    // Building shape
    ctx.fillRect(6, 6, 12, 18);
    ctx.fillStyle = '#000';
    ctx.fillRect(8, 8, 3, 3);
    ctx.fillRect(13, 8, 3, 3);
    ctx.fillRect(8, 14, 3, 3);
    ctx.fillRect(13, 14, 3, 3);
    return canvas.toDataURL();
  }

  _createRadioTowerIcon () {
    var canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 24;
    var ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    // Tower
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(6, 22);
    ctx.moveTo(12, 4);
    ctx.lineTo(18, 22);
    ctx.moveTo(8, 14);
    ctx.lineTo(16, 14);
    ctx.moveTo(10, 18);
    ctx.lineTo(14, 18);
    ctx.stroke();
    // Signal waves
    ctx.strokeStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(12, 4, 6, -Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 4, 10, -Math.PI, 0);
    ctx.stroke();
    return canvas.toDataURL();
  }

  _createTickerIcon (color, isOil) {
    var canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 24;
    var ctx = canvas.getContext('2d');
    var c = color.toCssColorString ? color.toCssColorString() : color;
    ctx.fillStyle = c;
    if (isOil) {
      // Oil drop
      ctx.beginPath();
      ctx.arc(12, 16, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(12, 4);
      ctx.lineTo(8, 10);
      ctx.lineTo(16, 10);
      ctx.closePath();
      ctx.fill();
    } else {
      // Dollar/stock
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 12, 12);
    }
    return canvas.toDataURL();
  }

  // ╭──────────────────────────────────────────────────────────

  _githubStyle(e, d) {
    // 3D extruded building — height = commit activity
    var height = Math.max(50, Math.min(2000, (d.commits || 10) * 2));

    // Color by activity status
    var color;
    if (d.status === 'active') color = Cesium.Color.fromCssColorString('#00ff88');      // green
    else if (d.status === 'stale') color = Cesium.Color.fromCssColorString('#ffaa00');   // amber
    else color = Cesium.Color.fromCssColorString('#6644ff');          
                    // purple/dormant

    if (!e.polygon) {
      // Create building footprint (~200m to avoid Cesium arc minimum)
      var size = 0.002;
      e.polygon = new Cesium.PolygonGraphics({
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          d.lon - size, d.lat - size,
          d.lon + size, d.lat - size,
          d.lon + size, d.lat + size,
          d.lon - size, d.lat + size
        ]),
        extrudedHeight: height,
        height: 0,
        material: color.withAlpha(0.8),
        outline: true,
        outlineColor: color,
        outlineWidth: 1,
        arcType: Cesium.ArcType.NONE
      });
    }

    if (!e.label) {
      var text = d.login;
      if (d.topRepo) text += '\n' + d.topRepo;
      if (d.topRepoStars) text += ' ★' + (d.topRepoStars > 1000 ? Math.round(d.topRepoStars/1000) + 'k' : d.topRepoStars);

      e.label = new Cesium.LabelGraphics({
        text: text,
        font: '10px "Share Tech Mono"',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
        disableDepthTestDistance: 5000
      });
    }

    // Register as a Job Site in the World Knowledge Map for agents
    if (window.WorldKnowledgeMap && window.WorldKnowledgeMap.instance) {
      const wkm = window.WorldKnowledgeMap.instance;
      wkm.addToCollective('resources', e.id, {
        lat: d.lat,
        lon: d.lon,
        type: 'job_site',
        repoData: d,
        agentId: 'SYSTEM'
      });
    }
  }

  getStats () {
    var counts = {}; this.entityMeta.forEach(v => counts[v.type] = (counts[v.type] || 0) + 1)
    return { 
      total: this.entityMeta.size, 
      byType: counts,
      fps: this._perfStats.fps,
      memoryEstimate: this._perfStats.memoryEstimate
    }
  }

  async _fetchViewportData() {
      if (this._isDestroyed) return;
      const viewer = this.viewer;
      const camera = viewer.camera;
      const canvas = viewer.canvas;
      
      // Get view bounds (simplified)
      const rect = camera.computeViewRectangle();
      if (!rect) return;
      
      const west = Cesium.Math.toDegrees(rect.west);
      const south = Cesium.Math.toDegrees(rect.south);
      const east = Cesium.Math.toDegrees(rect.east);
      const north = Cesium.Math.toDegrees(rect.north);
      
      const zoom = Math.floor(Math.log2(40075016 / Math.max(1, camera.positionCartographic.height)));
      
      try {
        const url = `/api/bbox?west=${west}&south=${south}&east=${east}&north=${north}&zoom=${zoom}`;
        const response = await fetch(url);
        const data = await response.json();
        this._updateLayers(data);

        // Update backend viewport for AIS choking
        fetch('/api/viewport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ s: south, w: west, n: north, e: east })
        }).catch(() => {});
      } catch (err) {
        // console.warn('[VIEWPORT] Fetch failed:', err);
      }    }

  _setupAreaMonitor () {
    var self = this; var lastCheck = 0
    const moveHandler = () => {
      var now = Date.now(); if (now - lastCheck < 2000) return; lastCheck = now
      try { if (self.viewer.camera.positionCartographic.height < 500000) self._updateAreaPanel(); self._fetchViewportData(); } catch (e) {}
    }
    this.viewer.camera.moveEnd.addEventListener(moveHandler)
  }

  _updateAreaPanel () {
    var body = document.getElementById('ghud-telemetry-list'); if (!body) return
    var cam = this.viewer.camera.positionCartographic; var cLat = Cesium.Math.toDegrees(cam.latitude); var cLon = Cesium.Math.toDegrees(cam.longitude)
    var radius = Math.min(cam.height / 50000, 10); var counts = {}; var cats = {}; var total = 0
    this.entityMeta.forEach((m) => {
      if (!m.data || m.data.lat == null) return
      if (Math.abs(m.data.lat - cLat) < radius && Math.abs(m.data.lon - cLon) < radius) { 
        counts[m.type] = (counts[m.type] || 0) + 1; 
        if (m.data.category) cats[m.data.category] = (cats[m.data.category] || 0) + 1;
        total++ 
      }
    })
    var html = `<div class="data-row" style="color:#0f8; font-weight:bold"><span>AREA NODES:</span><span>${total}</span></div>`
    Object.keys(counts).forEach(t => { html += `<div class="data-row"><span>${t.toUpperCase()}</span><span>${counts[t]}</span></div>` })
    if (Object.keys(cats).length > 0) {
      html += `<div class="section-header" style="margin-top:10px; font-size:9px; border-color:rgba(0,255,255,0.1)">CATEGORIES</div>`
      Object.keys(cats).forEach(c => { html += `<div class="data-row"><span>${c.toUpperCase()}</span><span>${cats[c]}</span></div>` })
    }
    body.innerHTML = html
  }

  // ── Performance Monitoring ─────────────────────────────────

  _startPerformanceMonitoring() {
    let lastFpsUpdate = Date.now()
    
    setInterval(() => {
      if (this._isDestroyed) return
      
      const now = Date.now()
      const elapsed = (now - lastFpsUpdate) / 1000
      
      // Calculate FPS
      this._perfStats.fps = Math.round(this._perfStats.frameCount / elapsed)
      this._perfStats.frameCount = 0
      lastFpsUpdate = now
      
      // Estimate memory (entity count as proxy)
      this._perfStats.entityCount = this.entityMeta.size
      this._perfStats.memoryEstimate = Math.round(
        (this.entityMeta.size * 2) + 
        (this._movingEntities.size * 0.5) +
        (this._trailPositions.size * 0.3)
      )
      
      // Log performance warnings
      if (this._perfStats.fps < 30) {
        console.warn(`[GOTHAM] Low FPS detected: ${this._perfStats.fps}`);
      }
    }, 1000)
  }

  getPerformanceStats() {
    return { ...this._perfStats }
  }
}

window.Gotham3077System = Gotham3077System
