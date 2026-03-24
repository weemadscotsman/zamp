/**
 * WORLDVIEW COMPLETE INTEGRATION - GOTHAM 3077 OPTIMIZED
 * Full-featured adaptation with performance optimizations
 *
 * OPTIMIZATIONS:
 * - Removed CallbackProperty animations (FPS killers)
 * - Replaced with CSS-based pulsing effects
 * - GPU particle system for effects
 * - Efficient trail rendering
 */

class WorldviewComplete {
  constructor (viewer, options = {}) {
    this.viewer = viewer
    this.options = {
      eonetEnabled: true,
      gibsEnabled: true,
      timelineEnabled: true,
      animationEnabled: true,
      compareEnabled: true,
      gifExportEnabled: true,
      imageExportEnabled: true,
      tourEnabled: true,
      smartHandoffEnabled: true,
      locationSearchEnabled: true,
      measureEnabled: true,
      projectionEnabled: true,
      notificationsEnabled: true,
      orbitPredictionEnabled: true,
      chartingEnabled: true,
      ...options
    }

    // NASA APIs
    this.EONET_API = 'https://eonet.gsfc.nasa.gov/api/v3'
    this.GIBS_URL = '/proxy/gibs/wmts/epsg4326/best'
    this.CMR_API = 'https://cmr.earthdata.nasa.gov/search'
    this.NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

    // State
    this.events = []
    this.activeLayers = new Map()
    this.layerOrder = []
    this.timeState = {
      current: new Date(),
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
      playing: false,
      speed: 1,
      interval: 'day',
      zoom: 3
    }
    this.compareState = {
      active: false,
      mode: 'swipe',
      position: 50,
      layerA: null,
      layerB: null
    }
    this.measureState = {
      active: false,
      mode: 'distance',
      points: [],
      entities: []
    }
    this.projection = 'geographic'
    this.notifications = []
    this.tours = []
    this.currentTour = null
    this.orbitPredictions = []

    // GIBS Layer catalog
    this.GIBS_CATALOG = this._initializeGIBSCatalog()

    // Initialize
    this._init()
  }

  _init () {
    console.log('[WORLDVIEW3077] Initializing...')

    // Only init EONET client-side if not using Gotham server (which fetches it)
    if (this.options.eonetEnabled && !window.gothamServerMode) this._initEONET()
    if (this.options.timelineEnabled) this._initTimeline()
    // Animation disabled - using Gotham 3077 particle system instead
    // if (this.options.animationEnabled) this._initAnimation();
    if (this.options.compareEnabled) this._initCompare()
    if (this.options.measureEnabled) this._initMeasure()
    if (this.options.smartHandoffEnabled) this._initSmartHandoff()
    if (this.options.locationSearchEnabled) this._initLocationSearch()
    if (this.options.orbitPredictionEnabled) this._initOrbitPrediction()
    if (this.options.tourEnabled) this._initTours()
    if (this.options.notificationsEnabled) this._initNotifications()

    // Initialize trajectory system for vector field visualization
    if (this.options.trajectoryEnabled !== false && window.TrajectoryFieldSystem) {
      this.trajectorySystem = new TrajectoryFieldSystem(this.viewer, this)
      console.log('[WORLDVIEW3077] Trajectory system initialized')
    }

    this._setupKeyboardShortcuts()

    console.log('[WORLDVIEW3077] Ready')
  }

  _initializeGIBSCatalog () {
    return {
      events: {
        title: '◉ Natural Events',
        layers: [
          { id: 'VIIRS_SNPP_Thermal_Anomalies_375m_All', name: 'VIIRS Thermal Anomalies (375m)', matrixSet: '250m', format: 'png', description: 'Active fires and thermal anomalies from VIIRS' },
          { id: 'MODIS_Terra_Thermal_Anomalies_All', name: 'MODIS Terra Thermal Anomalies', matrixSet: '250m', format: 'png', description: 'Active fires from MODIS Terra' },
          { id: 'MODIS_Aqua_Thermal_Anomalies_All', name: 'MODIS Aqua Thermal Anomalies', matrixSet: '250m', format: 'png', description: 'Active fires from MODIS Aqua' }
        ]
      },
      weather: {
        title: '◉ Weather',
        layers: [
          { id: 'IMERG_Precipitation_Rate', name: 'IMERG Precipitation Rate', matrixSet: '2km', format: 'png', description: 'Global precipitation from GPM IMERG' },
          { id: 'AIRS_Precipitation_Day', name: 'AIRS Precipitation (Day)', matrixSet: '2km', format: 'png', description: 'Precipitation from AIRS instrument' }
        ]
      },
      atmosphere: {
        title: '◉ Atmosphere',
        layers: [
          { id: 'MODIS_Terra_Aerosol', name: 'MODIS Terra Aerosol Optical Depth', matrixSet: '2km', format: 'png', description: 'Atmospheric aerosol concentration' },
          { id: 'MODIS_Aqua_Aerosol', name: 'MODIS Aqua Aerosol Optical Depth', matrixSet: '2km', format: 'png', description: 'Atmospheric aerosol concentration' },
          { id: 'OMI_SO2_Middle_Troposphere', name: 'OMI SO2 (Middle Troposphere)', matrixSet: '2km', format: 'png', description: 'Sulfur dioxide concentration' },
          { id: 'TEMPO_NO2_L3', name: 'TEMPO NO2', matrixSet: '2km', format: 'png', description: 'High-resolution NO2 from TEMPO' }
        ]
      },
      land: {
        title: '◉ Land',
        layers: [
          { id: 'VIIRS_SNPP_DayNightBand_ENCC', name: 'VIIRS Day/Night Band', matrixSet: '500m', format: 'png', description: 'Nighttime lights and cloud cover' },
          { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', name: 'MODIS Terra True Color', matrixSet: '250m', format: 'jpeg', description: 'Daily true color imagery' },
          { id: 'MODIS_Aqua_CorrectedReflectance_TrueColor', name: 'MODIS Aqua True Color', matrixSet: '250m', format: 'jpeg', description: 'Daily true color imagery' },
          { id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', name: 'VIIRS True Color', matrixSet: '250m', format: 'jpeg', description: 'Daily true color from VIIRS' }
        ]
      },
      cryosphere: {
        title: '◉ Ice & Snow',
        layers: [
          { id: 'MODIS_Terra_NDSI_Snow_Cover', name: 'MODIS Terra Snow Cover (NDSI)', matrixSet: '500m', format: 'png', description: 'Daily snow cover' },
          { id: 'AMSR2_Sea_Ice_Concentration_12km', name: 'AMSR2 Sea Ice Concentration', matrixSet: '2km', format: 'png', description: '12km resolution sea ice' }
        ]
      },
      ocean: {
        title: '◉ Ocean',
        layers: [
          { id: 'MODIS_Aqua_Chlorophyll_A', name: 'MODIS Aqua Chlorophyll-a', matrixSet: '1km', format: 'png', description: 'Ocean chlorophyll concentration' },
          { id: 'GHRSST_L4_MUR_Sea_Surface_Temperature', name: 'MUR Sea Surface Temperature', matrixSet: '1km', format: 'png', description: 'Multi-scale ultra-high resolution SST' }
        ]
      },
      reference: {
        title: '◉ Reference',
        layers: [
          { id: 'Reference_Features', name: 'Reference Features', matrixSet: '250m', format: 'png', description: 'Place names and features' },
          { id: 'Reference_Labels', name: 'Reference Labels', matrixSet: '250m', format: 'png', description: 'Text labels' },
          { id: 'Coastlines', name: 'Coastlines', matrixSet: '250m', format: 'png', description: 'Global coastlines' }
        ]
      }
    }
  }

  _initEONET () {
    console.log('[WORLDVIEW3077] Initializing EONET...')

    this.eonetDataSource = new Cesium.CustomDataSource('EONET_Events')
    this.viewer.dataSources.add(this.eonetDataSource)

    this.fetchEONETEvents()
    setInterval(() => this.fetchEONETEvents(), 300000)

    this.eventCategories = {
      wildfires: { icon: '◉', color: '#ff0033', label: 'Wildfire' },
      severeStorms: { icon: '◉', color: '#00f0ff', label: 'Severe Storm' },
      volcanoes: { icon: '◉', color: '#ff0033', label: 'Volcano' },
      icebergs: { icon: '◉', color: '#00f0ff', label: 'Iceberg' },
      drought: { icon: '◉', color: '#ff9500', label: 'Drought' },
      dustHaze: { icon: '◉', color: '#8b9bb4', label: 'Dust/Haze' },
      floods: { icon: '◉', color: '#00f0ff', label: 'Flood' },
      landslides: { icon: '◉', color: '#8b9bb4', label: 'Landslide' },
      manmade: { icon: '◉', color: '#ff0033', label: 'Man-made' },
      snow: { icon: '◉', color: '#ffffff', label: 'Snow' },
      waterColor: { icon: '◉', color: '#00f0ff', label: 'Water Color' },
      seaLakeIce: { icon: '◉', color: '#00f0ff', label: 'Sea/Lake Ice' },
      earthquakes: { icon: '◉', color: '#ff0033', label: 'Earthquake' }
    }
  }

  async fetchEONETEvents (options = {}) {
    try {
      const params = new URLSearchParams({
        status: options.status || 'all',
        limit: options.limit || 100,
        ...(options.days && { days: options.days }),
        ...(options.category && { category: options.category })
      })

      const response = await fetch(`${this.EONET_API}/events?${params}`)
      const data = await response.json()

      this.events = data.events || []
      this._renderEONETEvents()

      window.dispatchEvent(new CustomEvent('worldview-eonet-updated', {
        detail: { count: this.events.length, events: this.events }
      }))

      return this.events
    } catch (error) {
      console.error('[WORLDVIEW3077] EONET error:', error)
      this._notify('error', 'Failed to fetch EONET events')
      return []
    }
  }

  _renderEONETEvents () {
    this.eonetDataSource.entities.removeAll()

    this.events.forEach(event => {
      const category = event.categories?.[0]?.id || 'unknown'
      const config = this.eventCategories[category] || { icon: '◉', color: '#00f0ff', label: 'Unknown' }
      const geometry = event.geometry?.[0]
      if (!geometry) return

      const color = Cesium.Color.fromCssColorString(config.color)
      const coords = geometry.coordinates

      if (geometry.type === 'Point') {
        // Optimized static marker (no CallbackProperty)
        this.eonetDataSource.entities.add({
          id: `eonet-${event.id}`,
          position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1]),
          point: {
            pixelSize: 12,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1e5, 2, 5e6, 0.5)
          },
          ellipse: {
            semiMinorAxis: 30000,
            semiMajorAxis: 30000,
            material: color.withAlpha(0.2),
            outline: true,
            outlineColor: color.withAlpha(0.5),
            outlineWidth: 1
          },
          label: {
            text: `${config.icon} ${event.title.substring(0, 25)}`,
            font: 'bold 11px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            show: true
          },
          properties: {
            type: 'eonet',
            category,
            event
          }
        })

        // Event trail if multiple geometries
        if (event.geometry.length > 1) {
          const trailPositions = event.geometry.map(g =>
            Cesium.Cartesian3.fromDegrees(g.coordinates[0], g.coordinates[1])
          )

          this.eonetDataSource.entities.add({
            id: `eonet-trail-${event.id}`,
            polyline: {
              positions: trailPositions,
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.5,
                color: color.withAlpha(0.6)
              })
            }
          })
        }
      }
    })
  }

  filterEONETByCategory (categories) {
    if (!categories || categories.length === 0) {
      this._renderEONETEvents()
      return
    }

    const filtered = this.events.filter(e =>
      e.categories?.some(c => categories.includes(c.id))
    )

    const originalEvents = this.events
    this.events = filtered
    this._renderEONETEvents()
    this.events = originalEvents

    window.dispatchEvent(new CustomEvent('worldview-eonet-filtered', {
      detail: { count: filtered.length }
    }))
  }

  flyToEONETEvent (eventId) {
    const event = this.events.find(e => e.id === eventId)
    if (!event || !event.geometry?.[0]) return

    const coords = event.geometry[0].coordinates
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], 500000),
      orientation: { heading: 0, pitch: -0.5 }
    })
  }

  _initTimeline () {
    console.log('[WORLDVIEW3077] Initializing Timeline...')

    this.viewer.clock.shouldAnimate = false
    this.viewer.clock.multiplier = 3600

    this.timeScales = [
      { id: 'year', label: 'Year', ms: 365 * 24 * 60 * 60 * 1000 },
      { id: 'month', label: 'Month', ms: 30 * 24 * 60 * 60 * 1000 },
      { id: 'day', label: 'Day', ms: 24 * 60 * 60 * 1000 },
      { id: 'hour', label: 'Hour', ms: 60 * 60 * 1000 },
      { id: 'minute', label: 'Minute', ms: 60 * 1000 }
    ]

    this.viewer.clock.onTick.addEventListener((clock) => {
      if (this.timeState.playing) {
        this._onTimelineTick(clock.currentTime)
      }
    })
  }

  setTimeRange (start, end) {
    this.timeState.start = start
    this.timeState.end = end

    this.viewer.clock.startTime = Cesium.JulianDate.fromDate(start)
    this.viewer.clock.stopTime = Cesium.JulianDate.fromDate(end)
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(start)

    window.dispatchEvent(new CustomEvent('worldview-time-range', {
      detail: { start, end }
    }))
  }

  setTimeScale (scale) {
    const scaleConfig = this.timeScales.find(s => s.id === scale)
    if (!scaleConfig) return

    this.timeState.interval = scale

    const multipliers = {
      year: 86400 * 365,
      month: 86400 * 30,
      day: 86400,
      hour: 3600,
      minute: 60
    }
    this.viewer.clock.multiplier = multipliers[scale] || 3600

    window.dispatchEvent(new CustomEvent('worldview-timescale-changed', {
      detail: { scale }
    }))
  }

  playAnimation () {
    this.timeState.playing = true
    this.viewer.clock.shouldAnimate = true

    window.dispatchEvent(new CustomEvent('worldview-animation-state', {
      detail: { playing: true }
    }))
  }

  pauseAnimation () {
    this.timeState.playing = false
    this.viewer.clock.shouldAnimate = false

    window.dispatchEvent(new CustomEvent('worldview-animation-state', {
      detail: { playing: false }
    }))
  }

  setAnimationSpeed (speed) {
    this.timeState.speed = speed
    this.viewer.clock.multiplier = 3600 * speed

    window.dispatchEvent(new CustomEvent('worldview-animation-speed', {
      detail: { speed }
    }))
  }

  seekTime (date) {
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(date)
    this.timeState.current = date
    this._updateTimeDependentLayers(date)

    window.dispatchEvent(new CustomEvent('worldview-time-seek', {
      detail: { time: date }
    }))
  }

  _onTimelineTick (julianDate) {
    const date = Cesium.JulianDate.toDate(julianDate)
    this.timeState.current = date
    this._updateTimeDependentLayers(date)

    window.dispatchEvent(new CustomEvent('worldview-timeline-tick', {
      detail: { time: date }
    }))
  }

  _updateTimeDependentLayers (date) {
    // Update layer imagery parameters based on time
    this.activeLayers.forEach((layerInfo, layerId) => {
      if (layerInfo.timeEnabled) {
        // Cesium WMTS imagery providers handle time via URL parameters
      }
    })
  }

  stepTime (direction) {
    const scale = this.timeScales.find(s => s.id === this.timeState.interval)
    const delta = direction === 'forward' ? scale.ms : -scale.ms
    const newTime = new Date(this.timeState.current.getTime() + delta)
    this.seekTime(newTime)
  }

  addLayer (layerId, options = {}) {
    let layerDef = null
    let category = null

    for (const [catKey, catValue] of Object.entries(this.GIBS_CATALOG)) {
      const found = catValue.layers.find(l => l.id === layerId)
      if (found) {
        layerDef = found
        category = catKey
        break
      }
    }

    if (!layerDef) {
      console.warn(`[WORLDVIEW3077] Layer not found: ${layerId}`)
      return null
    }

    if (this.activeLayers.has(layerId)) {
      console.warn(`[WORLDVIEW3077] Layer already active: ${layerId}`)
      return this.activeLayers.get(layerId).layer
    }

    const provider = new Cesium.WebMapTileServiceImageryProvider({
      url: this.GIBS_URL,
      layer: layerId,
      style: 'default',
      format: layerDef.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      tileMatrixSetID: layerDef.matrixSet,
      maximumLevel: 12,
      credit: new Cesium.Credit('NASA GIBS'),
      ...options.providerOptions
    })

    const imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider)
    imageryLayer.alpha = options.opacity || 0.85
    imageryLayer.show = options.visible !== false

    const layerInfo = {
      id: layerId,
      layer: imageryLayer,
      provider,
      definition: layerDef,
      category,
      opacity: options.opacity || 0.85,
      visible: options.visible !== false,
      timeEnabled: true,
      added: new Date()
    }

    this.activeLayers.set(layerId, layerInfo)
    this.layerOrder.push(layerId)

    window.dispatchEvent(new CustomEvent('worldview-layer-added', {
      detail: { layerId, info: layerInfo }
    }))

    this._notify('success', `Added layer: ${layerDef.name}`)
    return layerInfo
  }

  removeLayer (layerId) {
    const layerInfo = this.activeLayers.get(layerId)
    if (!layerInfo) return

    this.viewer.imageryLayers.remove(layerInfo.layer)
    this.activeLayers.delete(layerId)
    this.layerOrder = this.layerOrder.filter(id => id !== layerId)

    window.dispatchEvent(new CustomEvent('worldview-layer-removed', {
      detail: { layerId }
    }))
  }

  setLayerOpacity (layerId, opacity) {
    const layerInfo = this.activeLayers.get(layerId)
    if (!layerInfo) return

    layerInfo.opacity = opacity
    layerInfo.layer.alpha = opacity
  }

  setLayerVisibility (layerId, visible) {
    const layerInfo = this.activeLayers.get(layerId)
    if (!layerInfo) return

    layerInfo.visible = visible
    layerInfo.layer.show = visible
  }

  moveLayer (layerId, direction) {
    const index = this.layerOrder.indexOf(layerId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index + 1 : index - 1
    if (newIndex < 0 || newIndex >= this.layerOrder.length) return;

    [this.layerOrder[index], this.layerOrder[newIndex]] =
    [this.layerOrder[newIndex], this.layerOrder[index]]

    const layerInfo = this.activeLayers.get(layerId)
    const otherLayerId = this.layerOrder[index]
    const otherLayerInfo = this.activeLayers.get(otherLayerId)

    if (layerInfo && otherLayerInfo) {
      this.viewer.imageryLayers.raise(layerInfo.layer)
    }
  }

  getActiveLayers () {
    return Array.from(this.activeLayers.entries()).map(([id, info]) => ({
      id,
      name: info.definition.name,
      category: info.category,
      opacity: info.opacity,
      visible: info.visible,
      added: info.added
    }))
  }

  getLayerCatalog () {
    return this.GIBS_CATALOG
  }

  _initCompare () {
    console.log('[WORLDVIEW3077] Initializing Compare Mode...')
    this.compareDataSource = new Cesium.CustomDataSource('Compare_Lines')
    this.viewer.dataSources.add(this.compareDataSource)
  }

  enableCompare (mode = 'swipe') {
    this.compareState.active = true
    this.compareState.mode = mode

    if (mode === 'swipe') {
      this._setupSwipeCompare()
    } else if (mode === 'spy') {
      this._setupSpyCompare()
    } else if (mode === 'opacity') {
      this._setupOpacityCompare()
    }

    window.dispatchEvent(new CustomEvent('worldview-compare-enabled', {
      detail: { mode }
    }))
  }

  disableCompare () {
    this.compareState.active = false

    this.activeLayers.forEach(info => {
      info.layer.alpha = info.opacity
    })

    this.compareDataSource.entities.removeAll()

    window.dispatchEvent(new CustomEvent('worldview-compare-disabled'))
  }

  setComparePosition (percent) {
    this.compareState.position = percent

    if (this.compareState.mode === 'opacity') {
      if (this.compareState.layerA && this.compareState.layerB) {
        const layerA = this.activeLayers.get(this.compareState.layerA)
        const layerB = this.activeLayers.get(this.compareState.layerB)

        if (layerA && layerB) {
          layerA.layer.alpha = layerA.opacity * (1 - percent / 100)
          layerB.layer.alpha = layerB.opacity * (percent / 100)
        }
      }
    }
  }

  setCompareLayers (layerA, layerB) {
    this.compareState.layerA = layerA
    this.compareState.layerB = layerB
  }

  _setupSwipeCompare () {
    this.compareDataSource.entities.removeAll()

    // Create static line entity (updated on camera move, not per-frame)
    const lineEntity = this.compareDataSource.entities.add({
      id: 'compare-line',
      polyline: {
        positions: [Cesium.Cartesian3.fromDegrees(0,0,0), Cesium.Cartesian3.fromDegrees(0,0,0)],
        width: 3,
        material: Cesium.Color.CYAN
      }
    })

    // Update on camera change (event-driven, not CallbackProperty)
    const updateLine = () => {
      const cartographic = this.viewer.camera.positionCartographic
      lineEntity.polyline.positions = [
        Cesium.Cartesian3.fromRadians(cartographic.longitude - 1, cartographic.latitude, 0),
        Cesium.Cartesian3.fromRadians(cartographic.longitude + 1, cartographic.latitude, 0)
      ]
    }

    // Listen for camera changes
    this.viewer.camera.changed.addEventListener(updateLine)

    // Initial update
    updateLine()

    // Store for cleanup
    this._compareLineUpdater = updateLine
  }

  _setupSpyCompare () {
    this._notify('info', 'Spyglass mode requires custom Cesium shader implementation')
  }

  _setupOpacityCompare () {
    if (this.compareState.layerA && this.compareState.layerB) {
      this.setComparePosition(50)
    }
  }

  _initMeasure () {
    console.log('[WORLDVIEW3077] Initializing Measurement Tools...')

    this.measureDataSource = new Cesium.CustomDataSource('Measurements')
    this.viewer.dataSources.add(this.measureDataSource)

    this.measureHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas)
  }

  startMeasurement (mode = 'distance') {
    this.measureState.active = true
    this.measureState.mode = mode
    this.measureState.points = []

    this.measureHandler.setInputAction((click) => {
      const ray = this.viewer.camera.getPickRay(click.position)
      const position = this.viewer.scene.globe.pick(ray, this.viewer.scene)

      if (position) {
        this._addMeasurePoint(position)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.measureHandler.setInputAction(() => {
      this.finishMeasurement()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    window.dispatchEvent(new CustomEvent('worldview-measure-started', {
      detail: { mode }
    }))
  }

  stopMeasurement () {
    this.measureState.active = false
    this.measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.measureHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  _addMeasurePoint (position) {
    this.measureState.points.push(position)

    const cartographic = Cesium.Cartographic.fromCartesian(position)
    const lon = Cesium.Math.toDegrees(cartographic.longitude)
    const lat = Cesium.Math.toDegrees(cartographic.latitude)

    this.measureDataSource.entities.add({
      position,
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString('#39ff14'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
      },
      label: {
        text: `${this.measureState.points.length}`,
        font: 'bold 14px "Share Tech Mono", monospace',
        fillColor: Cesium.Color.fromCssColorString('#39ff14'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    })

    if (this.measureState.points.length > 1) {
      this._updateMeasureLines()
    }
  }

  _updateMeasureLines () {
    const oldLines = this.measureDataSource.entities.values.filter(
      e => e.id && e.id.startsWith('measure-line')
    )
    oldLines.forEach(e => this.measureDataSource.entities.remove(e))

    const points = this.measureState.points

    if (this.measureState.mode === 'distance') {
      this.measureDataSource.entities.add({
        id: 'measure-line',
        polyline: {
          positions: points,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString('#39ff14')
          }),
          clampToGround: true
        }
      })

      let totalDistance = 0
      for (let i = 1; i < points.length; i++) {
        totalDistance += Cesium.Cartesian3.distance(points[i - 1], points[i])
      }

      window.dispatchEvent(new CustomEvent('worldview-measure-update', {
        detail: {
          mode: 'distance',
          points: points.length,
          distance: totalDistance,
          distanceKm: (totalDistance / 1000).toFixed(2)
        }
      }))
    }
  }

  finishMeasurement () {
    this.stopMeasurement()

    window.dispatchEvent(new CustomEvent('worldview-measure-finished', {
      detail: {
        mode: this.measureState.mode,
        points: this.measureState.points
      }
    }))
  }

  clearMeasurements () {
    this.measureDataSource.entities.removeAll()
    this.measureState.points = []
  }

  _initLocationSearch () {
    console.log('[WORLDVIEW3077] Initializing Location Search...')
  }

  async searchLocation (query) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: 5
      })

      const response = await fetch(`${this.NOMINATIM_URL}?${params}`)
      const results = await response.json()

      window.dispatchEvent(new CustomEvent('worldview-search-results', {
        detail: { query, results }
      }))

      return results
    } catch (error) {
      console.error('[WORLDVIEW3077] Search error:', error)
      return []
    }
  }

  flyToLocation (lon, lat, height = 50000) {
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: { heading: 0, pitch: -0.5 }
    })
  }

  _initSmartHandoff () {
    console.log('[WORLDVIEW3077] Initializing Smart Handoff...')
  }

  async searchCMR (options = {}) {
    const params = new URLSearchParams({
      collection_concept_id: options.collectionId || '',
      temporal: options.temporal || '',
      bounding_box: options.bbox || '-180,-90,180,90',
      page_size: options.limit || 20
    })

    try {
      const response = await fetch(`${this.CMR_API}/granules.json?${params}`)
      const data = await response.json()
      return data.feed?.entry || []
    } catch (error) {
      console.error('[WORLDVIEW3077] CMR search error:', error)
      return []
    }
  }

  generateDownloadLinks (layerId, bbox, temporal) {
    return {
      earthdata: `https://search.earthdata.nasa.gov/search/granules?p=${layerId}`,
      cmr: `${this.CMR_API}/granules.json?short_name=${layerId}`,
      gibs: `${this.GIBS_URL}/${layerId}/default/{time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`
    }
  }

  async exportImage (options = {}) {
    const canvas = this.viewer.canvas

    await new Promise(resolve => {
      this.viewer.scene.postRender.addEventListener(resolve)
    })

    const dataUrl = canvas.toDataURL('image/png')

    if (options.download) {
      const link = document.createElement('a')
      link.download = `gotham3077-${new Date().toISOString()}.png`
      link.href = dataUrl
      link.click()
    }

    return dataUrl
  }

  async createGIF (options = {}) {
    const {
      frames = 10,
      interval = 1000,
      width = 800,
      height = 600
    } = options

    this._notify('info', `Creating GIF with ${frames} frames...`)

    const frames_data = []
    const timeStep = interval * this.timeScales.find(s => s.id === this.timeState.interval).ms

    for (let i = 0; i < frames; i++) {
      const frameTime = new Date(this.timeState.start.getTime() + (i * timeStep))
      this.seekTime(frameTime)

      await new Promise(resolve => setTimeout(resolve, 500))

      const dataUrl = await this.exportImage()
      frames_data.push(dataUrl)
    }

    this.seekTime(this.timeState.current)

    this._notify('success', `Captured ${frames} frames for GIF`)

    return frames_data
  }

  switchProjection (projectionId) {
    const projections = {
      geographic: {
        id: 'geographic',
        name: 'Geographic',
        projection: new Cesium.GeographicProjection()
      },
      arctic: {
        id: 'arctic',
        name: 'Arctic Polar Stereographic',
        projection: new Cesium.WebMercatorProjection()
      },
      antarctic: {
        id: 'antarctic',
        name: 'Antarctic Polar Stereographic',
        projection: new Cesium.WebMercatorProjection()
      }
    }

    const proj = projections[projectionId]
    if (!proj) return

    this.projection = projectionId

    const views = {
      geographic: { lon: 0, lat: 20, height: 15000000 },
      arctic: { lon: 0, lat: 90, height: 10000000 },
      antarctic: { lon: 0, lat: -90, height: 10000000 }
    }

    const view = views[projectionId]
    this.flyToLocation(view.lon, view.lat, view.height)

    window.dispatchEvent(new CustomEvent('worldview-projection-changed', {
      detail: { projection: projectionId }
    }))
  }

  _initOrbitPrediction () {
    console.log('[WORLDVIEW3077] Initializing Orbit Prediction...')

    this.orbitDataSource = new Cesium.CustomDataSource('Orbit_Predictions')
    this.viewer.dataSources.add(this.orbitDataSource)
  }

  predictOrbit (tleLine1, tleLine2, name, options = {}) {
    if (!window.satellite) {
      console.warn('[WORLDVIEW3077] satellite.js required')
      return null
    }

    const satrec = window.satellite.twoline2satrec(tleLine1, tleLine2)
    const now = new Date()
    const positions = []
    const groundTrack = []

    const hours = options.hours || 3
    const steps = options.steps || 180

    for (let i = 0; i < steps; i++) {
      const time = new Date(now.getTime() + (i * hours * 3600000 / steps))
      const pv = window.satellite.propagate(satrec, time)

      if (pv.position) {
        const gmst = window.satellite.gstime(time)
        const pos = window.satellite.eciToGeodetic(pv.position, gmst)

        const lon = pos.longitude * 180 / Math.PI
        const lat = pos.latitude * 180 / Math.PI
        const height = pos.height * 1000

        positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, height))
        groundTrack.push(Cesium.Cartesian3.fromDegrees(lon, lat, 100))
      }
    }

    this.orbitDataSource.entities.add({
      id: `orbit-${name}`,
      polyline: {
        positions,
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString('#00f0ff')
        })
      }
    })

    this.orbitDataSource.entities.add({
      id: `ground-${name}`,
      polyline: {
        positions: groundTrack,
        width: 1,
        material: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.3),
        clampToGround: true
      }
    })

    for (let i = 6; i < steps; i += 12) {
      this.orbitDataSource.entities.add({
        id: `marker-${name}-${i}`,
        position: positions[i],
        point: {
          pixelSize: 5,
          color: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.5)
        },
        label: {
          text: `+${Math.round(i * hours / steps * 60)}m`,
          font: '10px "Share Tech Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#00f0ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          pixelOffset: new Cesium.Cartesian2(0, -10)
        }
      })
    }

    return { name, positions }
  }

  clearOrbits () {
    this.orbitDataSource.entities.removeAll()
  }

  _initTours () {
    console.log('[WORLDVIEW3077] Initializing Tour System...')

    this.tours = [
      {
        id: 'intro',
        title: 'Introduction to GOTHAM 3077',
        description: 'Learn the basics of the neural interface',
        steps: [
          { target: '.gotham-header', text: 'Welcome to GOTHAM 3077 - Neural Link Established' },
          { target: '.side-panel.left', text: 'Access sensor arrays and data layers here' },
          { target: '#wv-main-panel', text: 'NASA Worldview integration provides satellite imagery' },
          { target: '.terminal', text: 'Live telemetry feed shows real-time detections' }
        ]
      },
      {
        id: 'fires',
        title: 'Monitoring Wildfires',
        description: 'Track active wildfires using thermal imagery',
        steps: [
          { action: () => this.addLayer('VIIRS_SNPP_Thermal_Anomalies_375m_All'), text: 'Loading thermal anomalies layer...' },
          { action: () => this.fetchEONETEvents({ category: 'wildfires' }), text: 'Fetching active wildfire events...' },
          { text: 'Wildfires are shown as pulsing markers. Click for details.' }
        ]
      }
    ]
  }

  startTour (tourId) {
    const tour = this.tours.find(t => t.id === tourId)
    if (!tour) return

    this.currentTour = {
      ...tour,
      currentStep: 0
    }

    this._showTourStep()

    window.dispatchEvent(new CustomEvent('worldview-tour-started', {
      detail: { tourId }
    }))
  }

  nextTourStep () {
    if (!this.currentTour) return

    this.currentTour.currentStep++

    if (this.currentTour.currentStep >= this.currentTour.steps.length) {
      this.endTour()
    } else {
      this._showTourStep()
    }
  }

  _showTourStep () {
    const step = this.currentTour.steps[this.currentTour.currentStep]

    if (step.action) {
      step.action()
    }

    window.dispatchEvent(new CustomEvent('worldview-tour-step', {
      detail: {
        step: this.currentTour.currentStep + 1,
        total: this.currentTour.steps.length,
        text: step.text,
        target: step.target
      }
    }))
  }

  endTour () {
    this.currentTour = null
    window.dispatchEvent(new CustomEvent('worldview-tour-ended'))
  }

  getTours () {
    return this.tours.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description
    }))
  }

  _initNotifications () {
    console.log('[WORLDVIEW3077] Initializing Notifications...')
  }

  _notify (type, message, duration = 5000) {
    const notification = {
      id: Date.now(),
      type,
      message,
      time: new Date()
    }

    this.notifications.push(notification)

    if (this.notifications.length > 50) {
      this.notifications.shift()
    }

    window.dispatchEvent(new CustomEvent('worldview-notification', {
      detail: notification
    }))

    setTimeout(() => {
      this.removeNotification(notification.id)
    }, duration)

    return notification
  }

  removeNotification (id) {
    this.notifications = this.notifications.filter(n => n.id !== id)

    window.dispatchEvent(new CustomEvent('worldview-notification-removed', {
      detail: { id }
    }))
  }

  getNotifications () {
    return this.notifications
  }

  _setupKeyboardShortcuts () {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault()
        this.timeState.playing ? this.pauseAnimation() : this.playAnimation()
      }

      if (e.code === 'ArrowLeft' && e.ctrlKey) {
        this.stepTime('backward')
      }
      if (e.code === 'ArrowRight' && e.ctrlKey) {
        this.stepTime('forward')
      }

      if (e.code === 'KeyC' && e.ctrlKey) {
        e.preventDefault()
        this.compareState.active ? this.disableCompare() : this.enableCompare()
      }

      if (e.code === 'KeyM' && e.ctrlKey) {
        e.preventDefault()
        this.measureState.active ? this.stopMeasurement() : this.startMeasurement()
      }

      if (e.code === 'KeyS' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        this.exportImage({ download: true })
      }
    })
  }

  getState () {
    return {
      time: this.timeState,
      compare: this.compareState,
      measure: this.measureState,
      projection: this.projection,
      layers: this.getActiveLayers(),
      events: this.events.length,
      notifications: this.notifications.length
    }
  }

  destroy () {
    this.pauseAnimation()
    this.stopMeasurement()
    this.disableCompare()
    this.clearOrbits()
    this.clearMeasurements()

    if (this.eonetDataSource) {
      this.viewer.dataSources.remove(this.eonetDataSource)
    }
    if (this.orbitDataSource) {
      this.viewer.dataSources.remove(this.orbitDataSource)
    }
    if (this.measureDataSource) {
      this.viewer.dataSources.remove(this.measureDataSource)
    }
    if (this.compareDataSource) {
      this.viewer.dataSources.remove(this.compareDataSource)
    }

    this.activeLayers.forEach((info, id) => {
      this.removeLayer(id)
    })

    if (this.measureHandler) {
      this.measureHandler.destroy()
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorldviewComplete
}

window.WorldviewComplete = WorldviewComplete
