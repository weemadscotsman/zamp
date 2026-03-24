/**
 * GOTHAM 3077 - HUD Control System v49.0
 * v49.0 - TOTAL SUPREME COMMAND - FIXED WIRED OVERLAYS
 */

class GothamHUD {
  constructor (viewer, shaders, entitySystem) {
    this.viewer = viewer
    this.shaders = shaders
    this.entitySystem = entitySystem
    this._isDestroyed = false
    this._telemetryInterval = null
    this._recordingInterval = null
    this._eventListeners = []

    // State
    this.isRecording = false
    this.isPlaying = false
    this.recordedFrames = []
    this.playIndex = 0
    this.fieldAlerts = []
    this.logLines = []
    this.incidentStats = { hazards: 0, air: 0, space: 0, sea: 0 }
    this.isCamLocked = false
    
    // Logic Hooks State
    this.hooks = {
      autoZoom: false,
      voiceAlerts: true,
      secureUplink: true,
      autoCCTV: false,
      spawnAgents: false
    }

    // BUTTON TO API MAPPING
    this.apiMapping = {
      'gtog-air': { endpoint: '/api/live-data/fast', types: ['flight', 'military'], description: 'ADS-B & Military Transponders' },
      'gtop-air': { endpoint: '/api/live-data/fast', types: ['flight', 'military'], description: 'ADS-B & Military Transponders' },
      'gtog-sat': { endpoint: '/api/live-data/fast', types: ['satellite'], description: 'NORAD Orbital Elements' },
      'gtop-sat': { endpoint: '/api/live-data/fast', types: ['satellite'], description: 'NORAD Orbital Elements' },
      'gtog-sea': { endpoint: '/api/live-data/fast', types: ['ship', 'maritime', 'buoy'], description: 'AIS Vessel Tracking' },
      'gtop-sea': { endpoint: '/api/live-data/fast', types: ['ship', 'maritime', 'buoy'], description: 'AIS Vessel Tracking' },
      'gtog-land': { endpoint: '/api/live-data/slow', types: ['traffic'], description: 'Global Traffic Congestion' },
      'gtop-land': { endpoint: '/api/live-data/slow', types: ['traffic'], description: 'Global Traffic Congestion' },
      'gtog-rail': { endpoint: '/api/live-data/fast', types: ['transit'], description: 'Rail & Transit Networks' },
      'gtop-rail': { endpoint: '/api/live-data/fast', types: ['transit'], description: 'Rail & Transit Networks' },
      'gtog-cctv': { endpoint: '/api/live-data/fast', types: ['cctv'], description: 'Public & OSINT Optics' },
      'gtop-cctv': { endpoint: '/api/live-data/fast', types: ['cctv'], description: 'Public & OSINT Optics' },
      'gtog-hazard': { endpoint: '/api/live-data/slow', types: ['earthquake', 'volcano', 'wildfire', 'gdacs'], description: 'Global Disaster Feeds' },
      'gtop-hazard': { endpoint: '/api/live-data/slow', types: ['earthquake', 'volcano', 'wildfire', 'gdacs'], description: 'Global Disaster Feeds' },
      'gtog-env': { endpoint: '/api/live-data/slow', types: ['weather', 'airquality', 'water'], description: 'Meteorological & Eco Data' },
      'gtop-env': { endpoint: '/api/live-data/slow', types: ['weather', 'airquality', 'water'], description: 'Meteorological & Eco Data' },
      'gtog-intel': { endpoint: '/api/live-data/slow', types: ['crime', 'news', 'frontline'], description: 'Intelligence Aggregation' },
      'gtop-intel': { endpoint: '/api/live-data/slow', types: ['crime', 'news', 'frontline'], description: 'Intelligence Aggregation' },
      'gtog-space': { endpoint: '/api/live-data/slow', types: ['neo', 'fireball', 'star', 'meteor'], description: 'Deep Space Anomalies' },
      'gtop-space': { endpoint: '/api/live-data/slow', types: ['neo', 'fireball', 'star', 'meteor'], description: 'Deep Space Anomalies' },
      'gtog-mesh': { endpoint: null, types: ['cityMesh'], description: 'Urban Network Topology' },
      'gtop-mesh': { endpoint: null, types: ['cityMesh'], description: 'Urban Network Topology' },
      'gtog-github': { endpoint: '/api/live-data/slow', types: ['github'], description: 'Developer Telemetry' },
      'gtop-github': { endpoint: '/api/live-data/slow', types: ['github'], description: 'Developer Telemetry' },
      'gtog-vectors': { endpoint: '/api/live-data/fast', types: ['vector'], description: 'AI Vector Embeddings' },
      'gtop-vectors': { endpoint: '/api/live-data/fast', types: ['vector'], description: 'AI Vector Embeddings' },
      'gtog-ships': { endpoint: '/api/live-data/fast', types: ['ship'], description: 'Maritime Tracking' },
      'gtog-news': { endpoint: '/api/live-data/slow', types: ['news'], description: 'Global News Sentiment' },
      'gtog-frontlines': { endpoint: '/api/live-data/slow', types: ['frontline'], description: 'Conflict Zones' },
      'gtog-outages': { endpoint: '/api/live-data/slow', types: ['outage'], description: 'Network Outages' },
      'gtog-infra': { endpoint: '/api/live-data/slow', types: ['infrastructure'], description: 'Critical Infrastructure' },
      'gtog-infrastructure': { endpoint: '/api/live-data/slow', types: ['infrastructure'], description: 'Critical Infrastructure' },
      'gtop-infra': { endpoint: '/api/live-data/slow', types: ['infrastructure'], description: 'Critical Infrastructure' },
      'gtog-kiwi': { endpoint: '/api/live-data/slow', types: ['kiwisdr'], description: 'Radio Receiver Network' },
      'gtog-jamming': { endpoint: '/api/live-data/slow', types: ['jamming'], description: 'GPS Jamming Detection' },
      'gtog-defense': { endpoint: '/api/live-data/slow', types: ['financial'], description: 'Defense Market Telemetry' },
      'gtog-ufo': { endpoint: '/api/live-data/slow', types: ['alien'], description: 'UFO/UAP Incident Tracker' }
    }

    // ALL layers OFF by default — user activates what they want
    this.layerVisibility = {
      flight: false, satellite: false, traffic: false,
      transit: false, sea: false, cctv: false,
      hazard: false, environment: false, intel: false,
      cityMesh: false, space: false, github: false,
      infrastructure: false, vectors: false,
      ship: false, news: false, frontline: false, outage: false,
      kiwisdr: false, jamming: false, financial: false, alien: false,
      night: false
    }

    this._initSettings()
    this._createHUD()
    this._bindKeys()
    this._startTelemetry()
    this._startRecordingLoop()
    this._initChaosListeners()

    this._cameraMoveHandler = () => { if (!this.isPlaying) this._syncCameraDisplay(); }
    this.viewer.camera.moveEnd.addEventListener(this._cameraMoveHandler)

    console.log('[GOTHAM] HUD v49.0 - SUPREME COMMAND READY')
    // Layers load on-demand when user clicks buttons (no auto-enable)
    // setTimeout(() => this._autoEnableLayers(), 2000);
  }

  _initSettings() {
    if (this.shaders) {
      this.shaders.setSetting('intensity', 0.6); 
      this.shaders.setSetting('exposure', 1.0); 
      this.shaders.setSetting('contrast', 1.0); 
    }
    this.viewer.scene.fog.density = 0.0001; 
  }

  _initChaosListeners () {
    this._chaosAlertHandler = (e) => {
      if (this._isDestroyed) return
      this.fieldAlerts.unshift(e.detail);
      if (this.fieldAlerts.length > 50) this.fieldAlerts.pop();
      if (this.hooks.autoZoom && e.detail.location) this._zoomToAlert(e.detail.location);
      this.incidentStats.hazards++;
      this._sysLog(`ALERT: ${e.detail.message.substring(0, 30)}...`);
    }
    window.addEventListener('chaos-alert-dispatched', this._chaosAlertHandler);
  }

  _sysLog(msg) {
    if (this._isDestroyed) return
    const el = document.getElementById('ghud-sys-logs');
    if (!el) return;
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logLines.unshift(`[${time}] ${msg}`);
    if (this.logLines.length > 40) this.logLines.pop();
    el.innerHTML = this.logLines.join('<br>');
  }

  toggleLayer (type, id) {
    if (this._isDestroyed) return
    this.layerVisibility[type] = !this.layerVisibility[type];
    const isVisible = this.layerVisibility[type];
    
    const api = this.apiMapping[id];
    if (api && isVisible) {
      this._sysLog(`SYNC: ${api.description}`);
      if (window.shadowBrokerBridge) {
        if (api.endpoint && api.endpoint.includes('fast')) window.shadowBrokerBridge._fetchFastData();
        else if (api.endpoint) window.shadowBrokerBridge._fetchSlowData();
      }
    }

    const groupTypes = {
      hazard: ['earthquake', 'volcano', 'wildfire', 'gdacs', 'alert'],
      environment: ['weather', 'airquality', 'water', 'spacewx', 'river', 'carbon'],
      intel: ['crime', 'news', 'frontline', 'kiwisdr', 'financial', 'alien', 'jamming'],
      flight: ['flight', 'military'],
      sea: ['buoy', 'tide', 'maritime', 'ship'],
      transit: ['transit', 'bikeshare', 'evcharger'],
      satellite: ['satellite'],
      traffic: ['traffic'],
      cctv: ['cctv'],
      space: ['neo', 'fireball', 'star', 'meteor'],
      github: ['github'],
      infrastructure: ['infrastructure', 'outage'],
      vectors: ['vector'],
      // Individual sub-layer toggles
      ship: ['ship'], news: ['news'], frontline: ['frontline'],
      outage: ['outage'], kiwisdr: ['kiwisdr'], jamming: ['jamming'],
      financial: ['financial'], alien: ['alien']
    };
    const matchTypes = groupTypes[type] || [type];
    
    if (type === 'cityMesh') {
      const primitives = this.viewer.scene.primitives;
      for (let i = 0; i < primitives.length; i++) {
        const p = primitives.get(i); if (p instanceof Cesium.Cesium3DTileset) p.show = isVisible;
      }
    } else if (isVisible && this.entitySystem) {
      this.entitySystem._createEntitiesForTypes(matchTypes, type);
    }
    
    this.viewer.entities.values.forEach(e => {
      const meta = this.entitySystem?.entityMeta?.get(e.id);
      if (meta && matchTypes.indexOf(meta.type) !== -1) {
        e.show = isVisible;
        ['trail-', 'origin-', 'tether-', 'orbit-'].forEach(p => { 
          const ex = this.viewer.entities.getById(p + e.id); if (ex) ex.show = isVisible; 
        });
      }
    });
    
    this._toggleBtn(id, isVisible);
    const partnerId = id.startsWith('gtog-') ? id.replace('gtog-', 'gtop-') : id.replace('gtop-', 'gtog-');
    // infra special case
    if (id === 'gtog-infra' || id === 'gtog-infrastructure') this._toggleBtn('gtop-infra', isVisible);
    if (id === 'gtop-infra') { this._toggleBtn('gtog-infra', isVisible); this._toggleBtn('gtog-infrastructure', isVisible); }
    
    this._toggleBtn(partnerId, isVisible);
  }

  _createHUD () {
    const top = document.getElementById('gotham-hud-top');
    if (top) top.innerHTML = `<button class="panel-lock-btn" id="ghud-lock-top" style="right:10px;top:10px;">🔒</button>
      <div style="display:flex; gap:20px; padding:15px 20px;">
        <div style="flex:2">
          <div class="section-header">LAYER CONTROL</div>
          <div style="display:flex; gap:4px; flex-wrap:wrap">
            ${this._btn('AIR', 'gtop-air', false)} ${this._btn('SAT', 'gtop-sat', false)} ${this._btn('SEA', 'gtop-sea', false)}
            ${this._btn('LAND', 'gtop-land', false)} ${this._btn('RAIL', 'gtop-rail', false)} ${this._btn('CCTV', 'gtop-cctv', false)}
            ${this._btn('HAZARD', 'gtop-hazard', false)} ${this._btn('ENV', 'gtop-env', false)} ${this._btn('INTEL', 'gtop-intel', false)}
            ${this._btn('INFRA', 'gtop-infra', false)} ${this._btn('SPACE', 'gtop-space', false)} ${this._btn('MESH', 'gtop-mesh', false)} ${this._btn('GITHUB', 'gtop-github', false)} ${this._btn('VECTORS', 'gtop-vectors', false)}
          </div>
        </div>
        <div style="flex:1">
          <div class="section-header" style="color:#ff00ff">LOGIC HOOKS</div>
          <div style="display:flex; gap:4px">
            ${this._btn('ZOOM', 'gtop-zoom', false)} ${this._btn('VOICE', 'gtop-voice', true)} ${this._btn('SECURE', 'gtop-secure', true)} ${this._btn('CCTV', 'gtop-cctv-hook', false)}
          </div>
          <div style="font-size:9px; color:#666; margin-top:8px">FPS: <span id="gtop-fps">0</span> | IOH_KEY: <span id="ghud-ion-key">0x7F...A2</span></div>
        </div>
      </div>`;

    const left = document.getElementById('gotham-hud-left');
    if (left) left.innerHTML = `<button class="panel-lock-btn" id="ghud-lock-left" style="right:10px;top:10px;">🔒</button>
      <div class="panel-content">
        <div class="panel-block" style="background:rgba(0,240,255,0.05)"><div style="color:#00f0ff;font-size:24px;font-weight:bold;letter-spacing:6px">GOTHAM 3077</div><div id="ghud-load-progress" style="color:#0f8;font-size:9px">SYSTEMS NOMINAL</div></div>
        
        <div class="panel-block">
          <div class="section-header">🔲 TACTICAL NETWORKS</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px">
            ${this._btn('AIR/MILITARY', 'gtog-air', false)} ${this._btn('SATELLITES', 'gtog-sat', false)}
            ${this._btn('SEA/BUOYS', 'gtog-sea', false)} ${this._btn('LAND TRAFFIC', 'gtog-land', false)}
            ${this._btn('TRANSIT/RAIL', 'gtog-rail', false)} ${this._btn('CCTV FEEDS', 'gtog-cctv', false)}
            ${this._btn('HAZARD DECK', 'gtog-hazard', false)} ${this._btn('ENVIRONMENT', 'gtog-env', false)}
            ${this._btn('INTEL/CRIME', 'gtog-intel', false)} ${this._btn('SPACE INTEL', 'gtog-space', false)}
            ${this._btn('CITY MESH', 'gtog-mesh', false)} ${this._btn('NIGHT MODE', 'gtog-night', false)}
            ${this._btn('GITHUB DEVS', 'gtog-github', false)} ${this._btn('VECTORS', 'gtog-vectors', false)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff6600">🛸 SHADOWBROKER NETWORKS</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px">
            ${this._btn('SHIPS/AIS', 'gtog-ships', false)} ${this._btn('NEWS/GDELT', 'gtog-news', false)}
            ${this._btn('FRONTLINES', 'gtog-frontlines', false)} ${this._btn('OUTAGES', 'gtog-outages', false)}
            ${this._btn('INFRASTRUCTURE', 'gtog-infra', false)} ${this._btn('KIWISDR', 'gtog-kiwi', false)}
            ${this._btn('JAMMING', 'gtog-jamming', false)} ${this._btn('DEFENSE', 'gtog-defense', false)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#00ff88">🛸 ALIEN CONTACT PROTOCOL</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px">
            ${this._btn('UFO TRACKER', 'gtog-ufo', false)} ${this._btn('GUIDE ENTITY', 'gtog-alien-guide', false)} ${this._btn('PING SIGNAL', 'gtog-alien-ping', false)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">🤖 AGENT ORCHESTRATION</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px">
            ${this._btn('AGENT_01', 'agent-01', true)} ${this._btn('AGENT_02', 'agent-02', false)} ${this._btn('AGENT_03', 'agent-03', false)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header">📈 MACRO INTENT FLOW</div>
          <div class="intent-graph"><svg id="ghud-intent-svg" width="100%" height="100%" preserveAspectRatio="none"><path d="M0,50 Q 25,20 50,50 T 100,50" stroke="#00f0ff" fill="none"/></svg></div>
          <div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;color:#666"><span>INTENT DIRECTION</span><span id="ghud-intent-val" style="color:#0f8">88%</span></div>
        </div>

        <div class="panel-block">
          <div class="section-header">🌫️ ENVIRONMENTAL CONTROL</div>
          ${this._slider('Fog Density', 'ghud-fog', 0.0001, 0, 0.005, 0.00005)}
          ${this._slider('Atmo Bright', 'ghud-atmo-br', 0, -1, 1, 0.05)}
          ${this._slider('Atmo Hue', 'ghud-atmo-hue', 0, 0, 360, 1)}
          ${this._slider('Saturation', 'ghud-saturation', 1.0, 0, 3, 0.05)}
        </div>
        <div class="panel-block">
          <div class="section-header">⚙️ SYSTEM PERFORMANCE</div>
          ${this._slider('Terrain LOD Bias', 'ghud-lod', 1.0, 0.1, 10, 0.1)}
          ${this._slider('Entity Batch Size', 'ghud-batch', 30, 10, 100, 5)}
          ${this._slider('Drain Delay (ms)', 'ghud-drain', 100, 50, 1000, 50)}
        </div>
        <div class="panel-block">
          <div class="section-header">🎯 CONFLICT ZONE QUICK‑ZOOM</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px">
            ${this._btn('UKRAINE', 'zoom-ukraine', false)} ${this._btn('TAIWAN', 'zoom-taiwan', false)} ${this._btn('RED SEA', 'zoom-redsea', false)}
          </div>
        </div>
      </div>`;

    const right = document.getElementById('gotham-hud-right');
    if (right) right.innerHTML = `<button class="panel-lock-btn" id="ghud-lock-right" style="right:10px;top:10px;">🔒</button>
      <div class="panel-content">
        <div class="panel-block" style="background:rgba(255,0,255,0.05)"><div style="color:#ff00ff;font-size:22px;font-weight:bold;letter-spacing:5px">🧠 INTEL DECK</div></div>
        
        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">🔍 FORENSIC ANALYSIS</div>
          <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:8px">
            <span>ANOMALY INDEX: <b id="ghud-anomaly-idx" style="color:#f44">0.42</b></span>
            <span>INTENT CONFIDENCE: <b id="ghud-intent-conf" style="color:#0f8">0.89</b></span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px">
            ${this._btn('NEURAL TRACE', 'ghud-neural-trace', false)}
            ${this._btn('VOL SCAN', 'ghud-vol-scan', false)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">🎯 TARGET ANALYTICS</div>
          <div id="ghud-entity-title" style="color:#fff; font-weight:bold; font-size:13px; margin-bottom:4px">STATUS: NO LOCK</div>
          <div id="ghud-entity-body" style="font-size:11px; color:#888;">Awaiting target acquisition...</div>
          ${this._btn('CAMERA LOCK', 'gtog-camlock', false)}
        </div>

        <div class="panel-block" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.3)">
          <div class="section-header" style="color:#00f0ff">🛜 OSINT MODULE</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px">
            ${this._btn('USERNAME SCAN', 'sens-osint-username', false)}
            ${this._btn('CVE LOOKUP', 'sens-osint-cve', false)}
            ${this._btn('VIP TRACK', 'sens-osint-vip', false)}
            ${this._btn('BREACH CHECK', 'sens-osint-breach', false)}
            ${this._btn('INTERNET OUTAGES', 'sens-osint-outages', false)}
            ${this._btn('FRONTLINES', 'sens-osint-frontlines', false)}
          </div>
          <div style="margin-top:8px;text-align:center">
            <button id="sens-osint" class="btn-toggle" style="border-color:rgba(0,240,255,0.8);color:#fff;width:100%;padding:8px;cursor:pointer;border-radius:4px;font-family:inherit;font-size:11px;letter-spacing:2px;background:rgba(0,240,255,0.15);">🛜 OPEN FULL OSINT MODULE</button>
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">🛰️ EXPANDED SENSOR ARRAY</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px">
            ${this._btn('LIDAR', 'sens-lidar', false)} ${this._btn('RADAR', 'sens-radar', false)} ${this._btn('SONAR', 'sens-sonar', false)}
            ${this._btn('MASINT', 'sens-masint', false)} ${this._btn('ELINT', 'sens-elint', false)} ${this._btn('COMINT', 'sens-comint', false)}
            ${this._btn('IMINT', 'sens-imint', false)} ${this._btn('FISINT', 'sens-fisint', false)} ${this._btn('ACINT', 'sens-acint', false)}
            ${this._btn('OSINT', 'sens-osint', true)} ${this._btn('GEOINT', 'sens-geoint', true)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">🌈 MULTI-SPECTRAL ANALYSIS</div>
          ${['UV','VIS','NIR','MIR','FIR','MW'].map(b => `<div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:4px"><span>${b}</span><div class="band-meter"><div class="band-fill" style="width:50%"></div></div><span>50%</span></div>`).join('')}
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">📡 SIGNAL INTELLIGENCE</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; font-size:9px; color:#888; margin-bottom:8px">
            <div>2.4 GHz ISM: <span style="color:#0f8">LOCKED</span></div>
            <div>5.8 GHz UAV: <span style="color:#666">SCAN...</span></div>
            <div>1575 MHz GPS: <span style="color:#0f8">NOMINAL</span></div>
            <div>1090 MHz ADS-B: <span style="color:#0f8">LOCKED</span></div>
          </div>
          <div class="sub-header">📉 SIGINT SPECTROGRAPH</div>
          <div class="spectrograph" id="ghud-spectrograph"></div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">🔗 LOGIC HOOKS</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px">
            ${this._btn('AUTO ZOOM', 'ghook-zoom', false)} ${this._btn('VOICE ALERT', 'ghook-voice', true)}
            ${this._btn('SECURE UPLINK', 'ghook-secure', true)} ${this._btn('AUTO CCTV', 'ghook-cctv', false)} ${this._btn('SPAWN AGENTS', 'ghook-spawn', false)}
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">📊 MAGNITUDE MONITOR</div>
          <div id="ghud-mag-chart" style="display:flex; align-items:flex-end; height:40px; gap:2px"></div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">📈 INCIDENT STATISTICS</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:10px">
            <div style="border-left:2px solid #f44; padding-left:5px">HAZARDS: <b id="ghud-stat-hazard">0</b></div>
            <div style="border-left:2px solid #0f8; padding-left:5px">AIR: <b id="ghud-stat-air">0</b></div>
            <div style="border-left:2px solid #00f0ff; padding-left:5px">ORBITAL: <b id="ghud-stat-space">0</b></div>
            <div style="border-left:2px solid #ff00ff; padding-left:5px">MARITIME: <b id="ghud-stat-sea">0</b></div>
          </div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#ff00ff">DATA FEEDS</div>
          <div id="ghud-data-feeds" style="max-height:150px; overflow-y:auto; font-size:10px"></div>
        </div>

        <div class="panel-block" style="background:rgba(255,0,0,0.05)">
          <div class="section-header" style="color:#f44">🚨 GLOBAL THREAT LOG</div>
          <div id="ghud-field-alerts-list" style="max-height:150px; overflow-y:auto"></div>
        </div>

        <div class="panel-block">
          <div class="section-header" style="color:#0f8">🟢 SIGNAL INTERCEPT</div>
          <div id="ghud-sys-logs" style="font-size:9px; color:#00aa66; height:100px; overflow-y:auto; background:rgba(0,20,0,0.2); padding:8px;">[SYS] KERNEL STABILIZED...</div>
        </div>
      </div>`;

    const bottom = document.getElementById('gotham-hud-bottom');
    if (bottom) bottom.innerHTML = `<button class="panel-lock-btn" id="ghud-lock-bottom" style="right:10px;top:-30px;">🔒</button>
      <div style="flex:1.5; border-right:1px solid rgba(255,255,255,0.05); padding-right:15px">
        <div class="section-header" style="color:#0f8">🧿 OPTICAL MATRIX</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:4px">
          ${['NORMAL','CRT','INFRARED','NIGHT','MATRIX','CEL','PIXEL','RADAR','DRONE','THERMAL','X-RAY','BLUEPRINT','AMBER','HOLO','FORENSIC','NEUTRAL','SPECTRE','SIGNAL'].map(m => this._btn(m, 'gmode-'+m.toLowerCase().replace(' ',''), m==='NORMAL')).join('')}
        </div>
        <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:10px">
          ${this._slider('Exposure', 'ghud-exposure', 1.0, 0.1, 4, 0.1)}
          ${this._slider('Contrast', 'ghud-contrast', 1.0, 0.5, 2, 0.05)}
        </div>
      </div>
      <div style="flex:1.2; border-right:1px solid rgba(255,255,255,0.05); padding-right:15px">
        <div class="section-header" style="color:#0f8">🎬 ADVANCED CINEMATICS (PRO)</div>
        <div class="sub-header">🎞️ FILM STOCK</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px">
          ${['KODAK V3','FUJI ETERNA','ILFORD D','CINE 800T'].map(f => this._btn(f, 'film-'+f.toLowerCase().split(' ')[0], false)).join('')}
        </div>
        <div class="sub-header" style="margin-top:10px">📷 LENS FX</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px">
          ${['ANA','FISH','TILT','BOKEH','VIG','FLARE'].map(l => this._btn(l, 'lens-'+l.toLowerCase(), l==='VIG')).join('')}
        </div>
        <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px">
          ${this._slider('Shadows', 'ghud-shadows', 1.0, 0, 2, 0.05)}
          ${this._slider('Blur', 'ghud-blur', 0, 0, 10, 0.1)}
          ${this._slider('Angle', 'ghud-angle', 0, -45, 45, 1)}
        </div>
      </div>
      <div style="flex:1; border-right:1px solid rgba(255,255,255,0.05); padding-right:15px">
        <div class="section-header" style="color:#0f8">📡 SIGNAL ENGINE</div>
        ${this._slider('Gain', 'ghud-intensity', 0.6, 0, 2, 0.01)}
        ${this._slider('Instab', 'ghud-glitch', 0, 0, 1, 0.01)}
        ${this._slider('Bleed', 'ghud-chroma', 0.003, 0, 0.02, 0.0005)}
        ${this._slider('Noise', 'ghud-noise', 0.15, 0, 1, 0.01)}
        ${this._slider('Scan', 'ghud-scanlines', 0.2, 0, 1, 0.01)}
        ${this._slider('Grain', 'ghud-grain', 0.1, 0, 1, 0.01)}
        ${this._slider('Bloom', 'ghud-bloom', 0.4, 0, 2, 0.01)}
      </div>
      <div style="flex:0.8">
        <div class="section-header" style="color:#0f8">✍️ SCRIBE</div>
        <div style="display:flex; gap:4px; margin-bottom:10px">${this._btn('NOW','gtime-now',true)} ${this._btn('-1H','gtime-1h',false)} ${this._btn('-24H','gtime-24h',false)}</div>
        <div class="section-header" style="color:#0f8">▶️ SEQUENCER</div>
        <div style="display:flex; gap:4px">${this._btn('REC','ghud-rec-btn')} ${this._btn('PLAY','ghud-play-btn')}</div>
        <div id="ghud-rec-indicator" style="font-size:9px; color:#444; margin-top:8px; text-align:center">● STANDBY</div>
        <div class="section-header" style="color:#0f8; margin-top:10px">🎨 CINEMATIC PRESETS</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px">
          ${['NOIR','CYBERPUNK','TACTICAL','THERMAL_PRO'].map(p => this._btn(p, 'pre-'+p.toLowerCase().replace('_',''), false)).join('')}
        </div>
      </div>`;

    this._initPanelLocks()
    this._wireButtons()
  }

  _btn (text, id, active) {
    var border = active ? 'rgba(0,240,255,0.8)' : 'rgba(255,255,255,0.15)'
    return `<div id="${id}" class="btn-toggle" style="border-color:${border}; color:${active?'#fff':'#666'}">${text}</div>`
  }

  _slider (label, id, value, min, max, step) {
    return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;color:#ccc;font-size:10px;margin-bottom:2px"><span>${label}</span><span id="${id}-val" style="color:#00f0ff">${value}</span></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="width:100%"></div>`
  }

  _wireButtons () {
    const s = this;
    const click = (id, fn) => { 
      const el = document.getElementById(id); 
      if (el) { 
        el.addEventListener('click', fn); 
        this._eventListeners.push({ element: el, type: 'click', handler: fn }); 
      }
    }
    const slider = (id, fn) => { 
      const el = document.getElementById(id), valEl = document.getElementById(id + '-val'); 
      if (el) { 
        const h = () => { const v = parseFloat(el.value); fn(v); if (valEl) valEl.textContent = v; }; 
        el.addEventListener('input', h); 
        this._eventListeners.push({ element: el, type: 'input', handler: h }); 
      } 
    }

    const layers = [['air', 'flight'], ['sat', 'satellite'], ['sea', 'sea'], ['land', 'traffic'], ['rail', 'transit'], ['cctv', 'cctv'], ['hazard', 'hazard'], ['env', 'environment'], ['intel', 'intel'], ['space', 'space'], ['mesh', 'cityMesh'], ['github', 'github'], ['vectors', 'vectors'], ['infra', 'infrastructure']];
    layers.forEach(([sh, full]) => { 
      click('gtog-'+sh, () => s.toggleLayer(full, 'gtog-'+sh)); 
      click('gtop-'+sh, () => s.toggleLayer(full, 'gtop-'+sh)); 
    });

    // Secondary layer buttons — map to correct layerVisibility key + entity types
    const secondaryMap = {
      'ships':    { visKey: 'ship',     types: ['ship'] },
      'news':     { visKey: 'news',     types: ['news'] },
      'frontlines': { visKey: 'frontline', types: ['frontline'] },
      'outages':  { visKey: 'outage',   types: ['outage'] },
      'infrastructure': { visKey: 'infrastructure', types: ['infrastructure'] },
      'infra':    { visKey: 'infrastructure', types: ['infrastructure'] },
      'kiwi':     { visKey: 'kiwisdr',  types: ['kiwisdr'] },
      'jamming':  { visKey: 'jamming',  types: ['jamming'] },
      'defense':  { visKey: 'financial', types: ['financial'] },
      'ufo':      { visKey: 'alien',    types: ['alien'] }
    };
    Object.entries(secondaryMap).forEach(([id, cfg]) => {
      click('gtog-'+id, () => s.toggleLayer(cfg.visKey, 'gtog-'+id));
    });
    click('zoom-ukraine', () => s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(31.1656, 48.3794, 1000000) }));
    click('zoom-taiwan', () => s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(120.9605, 23.6978, 1000000) }));
    click('zoom-redsea', () => s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(40.0, 20.0, 2000000) }));

    const toggleHook = (hook, btn1, btn2) => {
      s.hooks[hook] = !s.hooks[hook];
      s._toggleBtn(btn1, s.hooks[hook]);
      if (btn2) s._toggleBtn(btn2, s.hooks[hook]);
      s._sysLog(`HOOK: ${hook.toUpperCase()} ${s.hooks[hook] ? 'ENGAGED' : 'OFFLINE'}`);
    }
    click('ghook-zoom', () => toggleHook('autoZoom', 'ghook-zoom', 'gtop-zoom'));
    click('gtop-zoom', () => toggleHook('autoZoom', 'ghook-zoom', 'gtop-zoom'));
    click('ghook-voice', () => toggleHook('voiceAlerts', 'ghook-voice', 'gtop-voice'));
    click('ghook-secure', () => toggleHook('secureUplink', 'ghook-secure', 'gtop-secure'));
    click('ghook-cctv', () => toggleHook('autoCCTV', 'ghook-cctv', 'gtop-cctv-hook'));
    click('ghook-spawn', () => {
      if (window.agentController) {
        const c = s.viewer.camera.positionCartographic;
        for(let i=0; i<10; i++) window.agentController.spawnAgent('warrior', Cesium.Math.toDegrees(c.latitude)+(Math.random()-0.5)*0.1, Cesium.Math.toDegrees(c.longitude)+(Math.random()-0.5)*0.1);
        s._sysLog('LOGIC_HOOK: AGENTS DEPLOYED');
      }
    });

    ['agent-01','agent-02','agent-03'].forEach(id => click(id, () => { ['agent-01','agent-02','agent-03'].forEach(aid => s._toggleBtn(aid, false)); s._toggleBtn(id, true); s._sysLog(`AGENT_UPLINK: ${id.toUpperCase()}`); }));

    const modes = ['normal','crt','infrared','night','matrix','cel','pixel','radar','drone','thermal','x-ray','blueprint','amber','holo','forensic','neutral','spectre','signal'];
    modes.forEach(m => click('gmode-'+m, () => { 
      modes.forEach(mm => s._toggleBtn('gmode-'+mm, false)); s._toggleBtn('gmode-'+m, true); 
      if(s.shaders) s.shaders.setMode(m==='infrared'?'flir':(m==='night'?'nvg':(m==='cel'?'anime':(m==='pixel'?'pixelart':(m==='radar'?'edges':(m==='thermal'?'thermal_hq':m)))))); 
    }));

    slider('ghud-intensity', v => s.shaders.setSetting('intensity', v));
    slider('ghud-scanlines', v => s.shaders.setSetting('scanlines', v));
    slider('ghud-noise', v => s.shaders.setSetting('noise', v));
    slider('ghud-exposure', v => s.shaders.setSetting('exposure', v));
    slider('ghud-contrast', v => s.shaders.setSetting('contrast', v));
    slider('ghud-fog', v => s.viewer.scene.fog.density = v);
    slider('ghud-atmo-br', v => s.viewer.scene.globe.atmosphereBrightnessShift = v);
    slider('ghud-atmo-hue', v => s.viewer.scene.globe.atmosphereHueShift = v / 360);
    slider('ghud-lod', v => s.viewer.scene.globe.terrainDetailLimit = v);
    slider('ghud-batch', v => { if(window.gothamSystem) window.gothamSystem._batchSize = v; });
    slider('ghud-drain', v => { if(window.gothamSystem) window.gothamSystem._drainDelay = v; });

    click('ghud-rec-btn', () => s.toggleRecording());
    click('ghud-play-btn', () => s.togglePlayback());

    // Night mode toggle
    click('gtog-night', () => {
      s.layerVisibility.night = !s.layerVisibility.night;
      s._toggleBtn('gtog-night', s.layerVisibility.night);
      if (s.shaders) s.shaders.setMode(s.layerVisibility.night ? 'nvg' : 'normal');
      s._sysLog('NIGHT MODE ' + (s.layerVisibility.night ? 'ENGAGED' : 'OFF'));
    });

    // Alien guide / ping (visual effect triggers)
    click('gtog-alien-guide', () => { s._toggleBtn('gtog-alien-guide', true); s._sysLog('ALIEN GUIDE: Scanning anomalous signals...'); setTimeout(() => s._toggleBtn('gtog-alien-guide', false), 3000); });
    click('gtog-alien-ping', () => { s._toggleBtn('gtog-alien-ping', true); s._sysLog('ALIEN PING: Broadcasting on all frequencies...'); setTimeout(() => s._toggleBtn('gtog-alien-ping', false), 3000); });

    // Camera lock
    click('gtog-camlock', () => {
      const locked = !!s.viewer.scene.screenSpaceCameraController.enableInputs;
      s.viewer.scene.screenSpaceCameraController.enableInputs = !locked;
      s._toggleBtn('gtog-camlock', locked);
      s._sysLog('CAMERA ' + (locked ? 'LOCKED' : 'UNLOCKED'));
    });

    // Neural trace / vol scan (sensor visualization triggers)
    click('ghud-neural-trace', () => { s._toggleBtn('ghud-neural-trace', true); s._sysLog('NEURAL TRACE: Active'); setTimeout(() => s._toggleBtn('ghud-neural-trace', false), 5000); });
    click('ghud-vol-scan', () => { s._toggleBtn('ghud-vol-scan', true); s._sysLog('VOLUMETRIC SCAN: Sweeping...'); setTimeout(() => s._toggleBtn('ghud-vol-scan', false), 5000); });

    // Sensor array buttons — toggle visual indicators + log
    ['lidar','radar','sonar','masint','elint','comint','sigint','humint','geoint','acint'].forEach(id => {
      click('sens-'+id, () => {
        const el = document.getElementById('sens-'+id);
        const active = el && el.classList.toggle('active');
        s._toggleBtn('sens-'+id, active);
        s._sysLog('SENSOR: ' + id.toUpperCase() + ' ' + (active ? 'ONLINE' : 'OFFLINE'));
      });
    });

    // OSINT overlay — opens the full OSINT panel
    click('sens-osint', () => {
      if (!window.gothamOSINTOverlay) {
        window.gothamOSINTOverlay = new GothamOSINTOverlay();
      }
      window.gothamOSINTOverlay.toggle();
      s._sysLog('OSINT MODULE: ' + (document.getElementById('gotham-osint-overlay')?.style.display !== 'none' ? 'OPENED' : 'CLOSED'));
    });

    // Quick OSINT tab buttons — open overlay and switch to specific tab
    const osintTabMap = {
      'sens-osint-username': 'username',
      'sens-osint-cve': 'cve',
      'sens-osint-vip': 'vip',
      'sens-osint-breach': 'breach',
      'sens-osint-outages': 'outages',
      'sens-osint-frontlines': 'frontlines',
    };
    Object.entries(osintTabMap).forEach(([btnId, tabName]) => {
      click(btnId, () => {
        if (!window.gothamOSINTOverlay) {
          window.gothamOSINTOverlay = new GothamOSINTOverlay();
        }
        window.gothamOSINTOverlay.show();
        // Switch to the specific tab
        const tabBtn = document.querySelector(`.osint-tab[data-tab="${tabName}"]`);
        if (tabBtn) tabBtn.click();
        s._sysLog('OSINT: ' + tabName.toUpperCase() + ' PANEL');
      });
    });

    // Film stock buttons
    ['kodak','ilford','fuji','cine'].forEach(id => {
      click('film-'+id, () => {
        ['kodak','ilford','fuji','cine'].forEach(fid => s._toggleBtn('film-'+fid, false));
        s._toggleBtn('film-'+id, true);
        const filmMap = { kodak: 'amber', ilford: 'neutral', fuji: 'normal', cine: 'cel' };
        if (s.shaders && filmMap[id]) s.shaders.setMode(filmMap[id]);
        s._sysLog('FILM: ' + id.toUpperCase());
      });
    });

    // Lens FX buttons — IDs match HTML: ana, fish, tilt, bokeh, vig, flare
    ['ana','fish','tilt','bokeh','vig','flare'].forEach(id => {
      click('lens-'+id, () => {
        ['ana','fish','tilt','bokeh','vig','flare'].forEach(lid => s._toggleBtn('lens-'+lid, false));
        s._toggleBtn('lens-'+id, true);
        s._sysLog('LENS: ' + id.toUpperCase());
      });
    });

    // SCRIBE time buttons
    click('gtime-now', () => { s.viewer.clock.currentTime = Cesium.JulianDate.now(); s._sysLog('TIME: NOW'); s._toggleBtn('gtime-now', true); s._toggleBtn('gtime-1h', false); s._toggleBtn('gtime-24h', false); });
    click('gtime-1h', () => { s.viewer.clock.currentTime = Cesium.JulianDate.addHours(Cesium.JulianDate.now(), -1, new Cesium.JulianDate()); s._sysLog('TIME: -1H'); s._toggleBtn('gtime-now', false); s._toggleBtn('gtime-1h', true); s._toggleBtn('gtime-24h', false); });
    click('gtime-24h', () => { s.viewer.clock.currentTime = Cesium.JulianDate.addHours(Cesium.JulianDate.now(), -24, new Cesium.JulianDate()); s._sysLog('TIME: -24H'); s._toggleBtn('gtime-now', false); s._toggleBtn('gtime-1h', false); s._toggleBtn('gtime-24h', true); });

    // Cinematic presets
    click('pre-orbit', () => { s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 } }); s._sysLog('PRESET: ORBITAL'); });
    click('pre-street', () => { const c = s.viewer.camera.positionCartographic; s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), 500), orientation: { heading: s.viewer.camera.heading, pitch: Cesium.Math.toRadians(-15), roll: 0 } }); s._sysLog('PRESET: STREET'); });
    click('pre-flyby', () => { const c = s.viewer.camera.positionCartographic; s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), 5000), orientation: { heading: Cesium.Math.toRadians(45), pitch: Cesium.Math.toRadians(-30), roll: 0 }, duration: 3 }); s._sysLog('PRESET: FLYBY'); });
    click('pre-recon', () => { const c = s.viewer.camera.positionCartographic; s.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), 50000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 } }); s._sysLog('PRESET: RECON'); });
  }

  _startTelemetry () {
    this._telemetryInterval = setInterval(() => {
      if (this._isDestroyed || !this.entitySystem) return;
      const stats = this.entitySystem.getStats();
      const fpsEl = document.getElementById('gtop-fps'); if (fpsEl) fpsEl.textContent = stats.fps;
      
      const intentSvg = document.getElementById('ghud-intent-svg');
      if (intentSvg) {
        const path = intentSvg.querySelector('path');
        let d = 'M0,50'; for(let i=1; i<=10; i++) d += ` L${i*10},${40+Math.random()*20}`;
        path.setAttribute('d', d);
        const intentVal = document.getElementById('ghud-intent-val');
        if (intentVal) intentVal.textContent = (80+Math.random()*15).toFixed(0)+'%';
      }

      const spectro = document.getElementById('ghud-spectrograph');
      if (spectro) {
        let h = ''; for(let i=0; i<40; i++) h += `<div class="spectro-bar" style="left:${i*2.5}%; height:${5+Math.random()*90}%; width:2%"></div>`;
        spectro.innerHTML = h;
      }

      const magChart = document.getElementById('ghud-mag-chart');
      if (magChart) {
        magChart.innerHTML += `<div class="chart-bar" style="width:4px; background:#ff00ff; height:${(1+Math.random()*5)*15}%"></div>`;
        if (magChart.children.length > 20) magChart.removeChild(magChart.firstChild);
      }

      const hEl = document.getElementById('ghud-stat-hazard'); if (hEl) hEl.textContent = this.fieldAlerts.length;
      const aEl = document.getElementById('ghud-stat-air'); if (aEl) aEl.textContent = stats.byType.flight || 0;
      const sEl = document.getElementById('ghud-stat-space'); if (sEl) sEl.textContent = stats.byType.satellite || 0;
      const mEl = document.getElementById('ghud-stat-sea'); if (mEl) mEl.textContent = stats.byType.buoy || 0;

      const feedContainer = document.getElementById('ghud-data-feeds');
      if (feedContainer) {
        feedContainer.innerHTML = Object.entries(stats.byType).map(([k,v]) => `<div class="feed-item" style="border-left:2px solid ${v>0?'#0f8':'#444'}"><span>${k.toUpperCase()}</span><span>${v}</span></div>`).join('');
      }

      const alertContainer = document.getElementById('ghud-field-alerts-list');
      if (alertContainer) {
        alertContainer.innerHTML = this.fieldAlerts.slice(0, 5).map(a => `<div class="alert-item" onclick="window.gothamHUD._zoomToAlert('${a.location}')"><div>${a.message}</div></div>`).join('');
      }
    }, 1000)
  }

  _startRecordingLoop() {}
  toggleRecording() { this.isRecording = !this.isRecording; this._toggleBtn('ghud-rec-btn', this.isRecording); }
  togglePlayback() { this.isPlaying = !this.isPlaying; this._toggleBtn('ghud-play-btn', this.isPlaying); }
  _zoomToAlert (loc) { 
    if (!loc) return;
    let p = typeof loc === 'string' ? loc.split(',') : [loc.lat, loc.lon];
    this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(parseFloat(p[1]), parseFloat(p[0]), 15000), duration: 1.5 }); 
  }
  _toggleBtn (id, active) { const el = document.getElementById(id); if (el) { el.style.borderColor = active ? 'rgba(0,240,255,0.8)' : 'rgba(255,255,255,0.15)'; el.style.color = active ? '#fff' : '#666'; } }
  _syncCameraDisplay() {
    const c = this.viewer.camera.positionCartographic; if (!c) return;
    this._sysLog(`POS: ${Cesium.Math.toDegrees(c.latitude).toFixed(4)}, ${Cesium.Math.toDegrees(c.longitude).toFixed(4)}`);
  }
  _bindKeys () {
    // H key handled by index.html panel toggle system using .collapsed class
  }
  _initPanelLocks() {
    ['left', 'right', 'bottom', 'top'].forEach(p => {
      const panel = document.getElementById('gotham-hud-' + p);
      const lockBtn = document.getElementById('ghud-lock-' + p);
      if (!panel || !lockBtn) return;
      lockBtn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('locked'); lockBtn.textContent = panel.classList.contains('locked') ? '🔒' : '🔓'; });
    });
  }
  _autoEnableLayers(retryCount) {
    if (!this.entitySystem || !this.entitySystem._createEntitiesForTypes) return;
    const groupTypes = { hazard:['earthquake','volcano','wildfire','gdacs','alert'], environment:['weather','airquality','water','spacewx','river','carbon'], intel:['crime','news','frontline','kiwisdr','financial','alien','jamming'], flight:['flight','military'], sea:['buoy','tide','maritime','ship'], transit:['transit','bikeshare','evcharger'], satellite:['satellite'], traffic:['traffic'], cctv:['cctv'], space:['neo','fireball','star','meteor'], github:['github'], infrastructure:['infrastructure','outage'], vectors:['vector'], ship:['ship'], news:['news'], frontline:['frontline'], outage:['outage'], kiwisdr:['kiwisdr'], jamming:['jamming'], financial:['financial'], alien:['alien'] };

    // Check if dataCache has any data
    const cache = this.entitySystem.dataCache;
    const hasData = cache && Object.keys(cache).some(k => Array.isArray(cache[k]) && cache[k].length > 0);

    if (!hasData && (retryCount || 0) < 10) {
      // No data yet — retry in 3 seconds (data may still be loading)
      console.log('[HUD] No data in cache yet, retrying auto-enable in 3s (attempt ' + ((retryCount || 0) + 1) + ')');
      setTimeout(() => this._autoEnableLayers((retryCount || 0) + 1), 3000);
      return;
    }

    Object.entries(this.layerVisibility).forEach(([layer, enabled]) => { if (enabled && layer !== 'cityMesh') { const matchTypes = groupTypes[layer] || [layer]; this.entitySystem._createEntitiesForTypes(matchTypes, layer); } });
    console.log('[HUD] Auto-enable layers complete, cache keys:', cache ? Object.keys(cache).filter(k => Array.isArray(cache[k]) && cache[k].length > 0).join(', ') : 'empty');
  }
}

window.GothamHUD = GothamHUD;
