/**
 * TRAJECTORY FIELDS - Vector Flow Visualization
 * Animated particle flow systems for atmospheric and oceanic currents
 *
 * Supports:
 * - Wind patterns (GFS, GEOS models)
 * - Ocean currents (OSCAR, HYCOM)
 * - Atmospheric rivers
 * - Particle dispersion tracks
 * - Real-time vector field animation
 */

class TrajectoryFieldSystem {
  constructor (viewer, worldview) {
    this.viewer = viewer
    this.worldview = worldview

    // Data sources for vector fields
    this.DATA_SOURCES = {
      // Wind - Global Forecast System
      GFS_WIND: {
        id: 'GFS_Wind_Vectors',
        name: 'GFS Wind Vectors',
        url: '/proxy/gibs/wms/epsg4326/best/wms.cgi',
        layer: 'GFS_Wind_Vectors',
        type: 'wind',
        category: 'atmosphere'
      },
      // Ocean surface currents
      OSCAR_CURRENTS: {
        id: 'OSCAR_Sea_Surface_Currents',
        name: 'OSCAR Ocean Currents',
        url: '/proxy/gibs/wmts/epsg4326/best',
        layer: 'OSCAR_Sea_Surface_Currents',
        type: 'ocean',
        category: 'ocean'
      },
      // GEOS atmospheric winds
      GEOS_WIND: {
        id: 'GEOS_Wind_Vectors',
        name: 'GEOS Wind Vectors',
        url: '/proxy/gibs/wms/epsg4326/best/wms.cgi',
        layer: 'GEOS_Wind_Vectors',
        type: 'wind',
        category: 'atmosphere'
      },
      // Sea surface currents
      HYCOM_CURRENTS: {
        id: 'HYCOM_Sea_Surface_Height',
        name: 'HYCOM Currents',
        url: '/proxy/gibs/wmts/epsg4326/best',
        layer: 'HYCOM_Sea_Surface_Height',
        type: 'ocean',
        category: 'ocean'
      }
    }

    // Active field configurations
    this.activeFields = new Map()

    // Particle systems
    this.particleSystems = new Map()
    this.particleDataSources = new Map()

    // Animation state
    this.animationTime = 0
    this.isAnimating = false
    this.animationSpeed = 1.0

    // Grid resolution for vector fields
    this.gridResolution = { lat: 2, lon: 2 } // degrees

    // Initialize
    this._init()
  }

  _init () {
    console.log('[TRAJECTORY] Initializing vector field system...')

    // Create main data source for trajectory lines
    this.trajectoryDataSource = new Cesium.CustomDataSource('Trajectory_Fields')
    this.viewer.dataSources.add(this.trajectoryDataSource)

    // Start animation loop
    this._startAnimationLoop()

    // Listen for time changes
    window.addEventListener('worldview-timeline-tick', (e) => {
      this._onTimeUpdate(e.detail.time)
    })
  }

  /**
   * Create a trajectory field from wind/current data
   */
  async createTrajectoryField (fieldId, options = {}) {
    const config = this.DATA_SOURCES[fieldId]
    if (!config) {
      console.warn(`[TRAJECTORY] Unknown field: ${fieldId}`)
      return null
    }

    console.log(`[TRAJECTORY] Creating field: ${config.name}`)

    // Field configuration
    const fieldConfig = {
      id: fieldId,
      name: config.name,
      type: config.type,
      category: config.category,
      particleCount: options.particleCount || 2000,
      particleLife: options.particleLife || 100,
      particleSpeed: options.particleSpeed || 1.0,
      colorScale: options.colorScale || this._getDefaultColorScale(config.type),
      lineWidth: options.lineWidth || 2,
      trailLength: options.trailLength || 20,
      fadeTrail: options.fadeTrail !== false,
      animated: options.animated !== false,
      ...config
    }

    // Create particle system
    const particleSystem = this._createParticleSystem(fieldConfig)

    // Create trajectory lines
    const trajectoryLines = this._createTrajectoryLines(fieldConfig)

    // Store active field
    this.activeFields.set(fieldId, {
      config: fieldConfig,
      particleSystem,
      trajectoryLines,
      created: new Date()
    })

    // Dispatch event
    window.dispatchEvent(new CustomEvent('trajectory-field-created', {
      detail: { fieldId, config: fieldConfig }
    }))

    return fieldConfig
  }

  /**
   * Create animated particle system
   */
  _createParticleSystem (config) {
    const particles = []
    const dataSource = new Cesium.CustomDataSource(`Particles_${config.id}`)
    this.viewer.dataSources.add(dataSource)
    this.particleDataSources.set(config.id, dataSource)

    // Generate initial particle positions
    for (let i = 0; i < config.particleCount; i++) {
      const particle = this._createParticle(config, i)
      particles.push(particle)

      // Add to Cesium with static position (updated via batch)
      const entity = dataSource.entities.add({
        id: `particle-${config.id}-${i}`,
        position: Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, 10000),
        point: {
          pixelSize: config.lineWidth,
          color: Cesium.Color.CYAN.withAlpha(0.6),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 0.5,
          scaleByDistance: new Cesium.NearFarScalar(10000, 2.0, 10000000, 0.5)
        }
      })

      particle.entity = entity
    }

    // Setup batched update instead of per-entity CallbackProperty
    this._setupParticleBatchUpdate(config.id, particles, dataSource)

    return {
      particles,
      dataSource
    }
  }

  /**
   * Setup batched particle updates (replaces CallbackProperty for performance)
   */
  _setupParticleBatchUpdate (fieldId, particles, dataSource) {
    let lastUpdate = 0
    const updateInterval = 100 // Update every 100ms instead of every frame

    const updateFn = (scene, time) => {
      const now = Date.now()
      if (now - lastUpdate < updateInterval) return
      lastUpdate = now

      // Batch update all particles
      particles.forEach(particle => {
        if (!particle.entity) return

        // Update position based on vector field
        const newPos = this._updateParticlePosition(particle, time)
        particle.entity.position = newPos

        // Update color based on speed
        const newColor = this._getParticleColor(particle, particle.colorScale)
        particle.entity.point.color = newColor
      })
    }

    // Register with scene postRender (batched, not per-entity)
    this.viewer.scene.postRender.addEventListener(updateFn)

    // Store for cleanup
    if (!this._particleUpdaters) this._particleUpdaters = new Map()
    this._particleUpdaters.set(fieldId, updateFn)
  }

  /**
   * Setup batched updates for river particles (replaces CallbackProperty)
   */
  _setupRiverParticleUpdate (riverId, particles, positions) {
    let lastUpdate = 0
    const updateInterval = 100 // 100ms updates

    const updateFn = (scene, time) => {
      const now = Date.now()
      if (now - lastUpdate < updateInterval) return
      lastUpdate = now

      const secondsOfDay = time.secondsOfDay

      particles.forEach(p => {
        if (!p.entity) return

        // Calculate progress along river path
        const progress = ((secondsOfDay * 0.1) + p.offset) % 1
        const index = Math.floor(progress * (positions.length - 1))
        p.entity.position = positions[index] || positions[0]
      })
    }

    // Register with scene postRender
    this.viewer.scene.postRender.addEventListener(updateFn)

    // Store for cleanup
    if (!this._riverUpdaters) this._riverUpdaters = new Map()
    this._riverUpdaters.set(riverId, updateFn)
  }

  /**
   * Create a single particle
   */
  _createParticle (config, index) {
    // Random position (weighted towards mid-latitudes for wind)
    let lat, lon

    if (config.type === 'wind') {
      // Wind is stronger in mid-latitudes
      lat = (Math.random() - 0.5) * 140 // -70 to 70
      lon = (Math.random() - 0.5) * 360
    } else {
      // Ocean currents - more uniform
      lat = (Math.random() - 0.5) * 160 // -80 to 80
      lon = (Math.random() - 0.5) * 360
    }

    return {
      id: index,
      lat,
      lon,
      altitude: config.type === 'wind' ? 10000 + Math.random() * 50000 : 100,
      velocity: { u: 0, v: 0 },
      life: Math.random() * config.particleLife,
      maxLife: config.particleLife,
      history: [],
      age: 0
    }
  }

  /**
   * Update particle position based on vector field
   */
  _updateParticlePosition (particle, time) {
    // Get vector at current position
    const vector = this._getVectorAtPosition(particle.lat, particle.lon, particle.altitude)

    // Update velocity with smoothing
    particle.velocity.u += (vector.u - particle.velocity.u) * 0.1
    particle.velocity.v += (vector.v - particle.velocity.v) * 0.1

    // Move particle
    const speed = Math.sqrt(particle.velocity.u ** 2 + particle.velocity.v ** 2)
    const scale = 0.001 * (speed > 0 ? 1 : 0)

    particle.lon += particle.velocity.u * scale
    particle.lat += particle.velocity.v * scale

    // Wrap around
    if (particle.lon > 180) particle.lon -= 360
    if (particle.lon < -180) particle.lon += 360
    if (particle.lat > 90) particle.lat = 90
    if (particle.lat < -90) particle.lat = -90

    // Update history for trails
    particle.history.push({ lat: particle.lat, lon: particle.lon, time })
    if (particle.history.length > 20) {
      particle.history.shift()
    }

    // Age and respawn
    particle.age++
    if (particle.age > particle.maxLife || speed < 0.1) {
      this._respawnParticle(particle)
    }

    return Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, particle.altitude)
  }

  /**
   * Get vector at position (simplified model)
   */
  _getVectorAtPosition (lat, lon, altitude) {
    // This would fetch real data from GFS/OSCAR
    // For now, generate realistic flow patterns

    const time = this.animationTime * 0.001

    // Trade winds (easterlies in tropics)
    if (Math.abs(lat) < 30) {
      return {
        u: -5 - Math.sin(lat * 0.1) * 3 + Math.sin(time + lon * 0.01) * 2,
        v: Math.cos(time * 0.5 + lat * 0.1) * 2
      }
    }

    // Westerlies in mid-latitudes
    if (Math.abs(lat) < 60) {
      return {
        u: 10 + Math.sin(lat * 0.05) * 5 + Math.cos(time + lon * 0.02) * 3,
        v: Math.sin(time * 0.3 + lon * 0.01) * 4
      }
    }

    // Polar easterlies
    return {
      u: -3 + Math.sin(time + lat * 0.1) * 2,
      v: Math.cos(time * 0.4) * 1
    }
  }

  /**
   * Respawn particle at new random location
   */
  _respawnParticle (particle) {
    const newParticle = this._createParticle(
      this.activeFields.get(particle.fieldId)?.config || {},
      particle.id
    )

    particle.lat = newParticle.lat
    particle.lon = newParticle.lon
    particle.altitude = newParticle.altitude
    particle.velocity = { u: 0, v: 0 }
    particle.age = 0
    particle.history = []
  }

  /**
   * Get particle color based on speed
   */
  _getParticleColor (particle, colorScale) {
    const speed = Math.sqrt(particle.velocity.u ** 2 + particle.velocity.v ** 2)

    // Normalize speed (0-20 m/s typical for wind)
    const normalized = Math.min(speed / 15, 1)

    // Interpolate color
    const color = this._interpolateColor(colorScale, normalized)
    return Cesium.Color.fromCssColorString(color)
  }

  /**
   * Create trajectory lines (static flow lines)
   */
  _createTrajectoryLines (config) {
    const lines = []

    // Create flow lines along common paths
    const lineCount = 50

    for (let i = 0; i < lineCount; i++) {
      const startLat = (Math.random() - 0.5) * 120
      const startLon = (Math.random() - 0.5) * 360

      // Generate line following flow
      const positions = this._generateFlowLine(startLat, startLon, config)

      if (positions.length > 2) {
        const line = this.trajectoryDataSource.entities.add({
          id: `flowline-${config.id}-${i}`,
          polyline: {
            positions,
            width: config.lineWidth,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.fromCssColorString(config.colorScale[0.5])
            }),
            arcType: Cesium.ArcType.NONE
          }
        })

        lines.push(line)
      }
    }

    return lines
  }

  /**
   * Generate a flow line following vector field
   */
  _generateFlowLine (startLat, startLon, config) {
    const positions = []
    let lat = startLat
    let lon = startLon

    for (let step = 0; step < 50; step++) {
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, config.type === 'wind' ? 20000 : 100))

      const vector = this._getVectorAtPosition(lat, lon, 0)
      const scale = 0.5

      lon += vector.u * scale
      lat += vector.v * scale

      // Stop if out of bounds
      if (Math.abs(lat) > 85) break
    }

    return positions
  }

  /**
   * Start animation loop
   */
  _startAnimationLoop () {
    if (this._animationFrameId) return // Prevent multiple loops

    this.isAnimating = true
    let lastTime = performance.now()

    const animate = (currentTime) => {
      if (!this.isAnimating) return

      const deltaTime = currentTime - lastTime
      if (deltaTime >= 16) { // Cap at ~60fps
        this.animationTime += this.animationSpeed
        lastTime = currentTime
      }

      this._animationFrameId = requestAnimationFrame(animate)
    }

    this._animationFrameId = requestAnimationFrame(animate)
  }

  /**
   * Handle time updates from timeline
   */
  _onTimeUpdate (time) {
    // Update field data based on time
    this.activeFields.forEach((field, id) => {
      // In real implementation, would fetch new vector data
      // for the current time from GFS/OSCAR
    })
  }

  /**
   * Set animation speed
   */
  setAnimationSpeed (speed) {
    this.animationSpeed = speed

    window.dispatchEvent(new CustomEvent('trajectory-speed-changed', {
      detail: { speed }
    }))
  }

  /**
   * Remove a trajectory field
   */
  removeTrajectoryField (fieldId) {
    const field = this.activeFields.get(fieldId)
    if (!field) return

    // Remove particle system
    if (field.particleSystem && field.particleSystem.dataSource) {
      this.viewer.dataSources.remove(field.particleSystem.dataSource)
      this.particleDataSources.delete(fieldId)
    }

    // Remove trajectory lines
    if (field.trajectoryLines) {
      field.trajectoryLines.forEach(line => {
        this.trajectoryDataSource.entities.remove(line)
      })
    }

    this.activeFields.delete(fieldId)

    window.dispatchEvent(new CustomEvent('trajectory-field-removed', {
      detail: { fieldId }
    }))
  }

  /**
   * Get list of available fields
   */
  getAvailableFields () {
    return Object.entries(this.DATA_SOURCES).map(([key, config]) => ({
      id: key,
      ...config
    }))
  }

  /**
   * Get active fields
   */
  getActiveFields () {
    return Array.from(this.activeFields.entries()).map(([id, field]) => ({
      id,
      name: field.config.name,
      type: field.config.type,
      particleCount: field.config.particleCount,
      created: field.created
    }))
  }

  /**
   * Update field parameters
   */
  updateFieldParameters (fieldId, params) {
    const field = this.activeFields.get(fieldId)
    if (!field) return

    Object.assign(field.config, params)

    // Recreate if particle count changed significantly
    if (params.particleCount && Math.abs(params.particleCount - field.config.particleCount) > 100) {
      this.removeTrajectoryField(fieldId)
      this.createTrajectoryField(fieldId, field.config)
    }
  }

  /**
   * Get default color scale
   */
  _getDefaultColorScale (type) {
    if (type === 'wind') {
      return {
        0.0: '#313695', // Low - dark blue
        0.2: '#4575b4',
        0.4: '#74add1',
        0.6: '#fdae61', // Medium - orange
        0.8: '#f46d43',
        1.0: '#d73027' // High - red
      }
    } else {
      return {
        0.0: '#2c7bb6', // Low - blue
        0.3: '#abd9e9',
        0.5: '#ffffbf', // Medium - yellow
        0.7: '#fdae61',
        1.0: '#d7191c' // High - red
      }
    }
  }

  /**
   * Interpolate color from scale
   */
  _interpolateColor (scale, value) {
    const stops = Object.keys(scale).map(parseFloat).sort((a, b) => a - b)

    // Find surrounding stops
    let lower = stops[0]
    let upper = stops[stops.length - 1]

    for (let i = 0; i < stops.length - 1; i++) {
      if (value >= stops[i] && value <= stops[i + 1]) {
        lower = stops[i]
        upper = stops[i + 1]
        break
      }
    }

    // Return exact match or interpolate
    if (lower === upper) return scale[lower]

    const ratio = (value - lower) / (upper - lower)
    return this._blendColors(scale[lower], scale[upper], ratio)
  }

  /**
   * Blend two hex colors
   */
  _blendColors (color1, color2, ratio) {
    const hex2rgb = (hex) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    })

    const c1 = hex2rgb(color1)
    const c2 = hex2rgb(color2)

    const r = Math.round(c1.r + (c2.r - c1.r) * ratio)
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio)
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio)

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  /**
   * Create atmospheric river visualization
   */
  createAtmosphericRiver (points, options = {}) {
    const id = `atm-river-${Date.now()}`

    const positions = points.map(p =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.altitude || 5000)
    )

    // Main river line
    const river = this.trajectoryDataSource.entities.add({
      id,
      polyline: {
        positions,
        width: options.width || 8,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.5,
          color: Cesium.Color.fromCssColorString(options.color || '#00bfff')
        }),
        arcType: Cesium.ArcType.GEODESIC
      }
    })

    // Animated flow particles along river (batched updates, not CallbackProperty)
    const particleCount = options.particles || 50
    const riverParticles = []

    for (let i = 0; i < particleCount; i++) {
      const entity = this.trajectoryDataSource.entities.add({
        id: `${id}-particle-${i}`,
        position: positions[0], // Initial position
        point: {
          pixelSize: 6,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1
        }
      })
      riverParticles.push({ entity, index: i, offset: i / particleCount })
    }

    // Batched update for river particles (replaces CallbackProperty)
    this._setupRiverParticleUpdate(id, riverParticles, positions)

    return id
  }

  /**
   * Create dispersion plume (for volcanic ash, smoke, etc.)
   */
  createDispersionPlume (origin, options = {}) {
    const id = `plume-${Date.now()}`
    const { lat, lon, altitude = 0 } = origin

    const particles = []
    const particleCount = options.particles || 500
    const spread = options.spread || 10 // degrees

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * spread
      const alt = altitude + Math.random() * (options.height || 10000)

      const pLat = lat + Math.sin(angle) * distance
      const pLon = lon + Math.cos(angle) * distance

      particles.push(Cesium.Cartesian3.fromDegrees(pLon, pLat, alt))
    }

    // Create point cloud
    const plume = this.trajectoryDataSource.entities.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
      ellipse: {
        semiMinorAxis: spread * 111000, // convert to meters
        semiMajorAxis: spread * 111000,
        height: altitude,
        extrudedHeight: altitude + (options.height || 10000),
        material: Cesium.Color.fromCssColorString(options.color || '#888888').withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(options.color || '#888888')
      }
    })

    return id
  }

  /**
   * Clear all trajectory fields
   */
  clearAll () {
    this.activeFields.forEach((field, id) => {
      this.removeTrajectoryField(id)
    })

    this.trajectoryDataSource.entities.removeAll()
  }

  /**
   * Export current field state
   */
  exportState () {
    return {
      activeFields: this.getActiveFields(),
      animationSpeed: this.animationSpeed,
      animationTime: this.animationTime
    }
  }

  /**
   * Cleanup
   */
  destroy () {
    this.isAnimating = false
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId)
      this._animationFrameId = null
    }
    this.clearAll()
    this.viewer.dataSources.remove(this.trajectoryDataSource)
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrajectoryFieldSystem
}
