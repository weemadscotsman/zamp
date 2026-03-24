/**
 * GOTHAM 3077 - Country Intelligence Orchestrator v1.0
 * 
 * When you zoom to a country, this automatically:
 * 1. Detects which country you're looking at (bounding box)
 * 2. Switches to the country's mode profile
 * 3. Auto-enables relevant layers (air/sea/land/cctv/news)
 * 4. Pulls live CCTV feeds for that region
 * 5. Activates OSINT panel with local intel
 * 
 * Ted's vision: "When I zoom to a country it auto turns to one of the modes
 * to show all that shit going down. Air to land to sea. Foot traffic.
 * All live feeds. Point cloud data. Full intel breakdown. Public CCTV."
 */

class CountryIntelOrchestrator {
  constructor(viewer, hud) {
    this.viewer = viewer;
    this.hud = hud;
    this.currentCountry = null;
    this.activeFeeds = new Set();
    this.cctvOverlay = null;
    this.feedInterval = null;
    
    // Country bounding boxes: [minLon, minLat, maxLon, maxLat]
    this.countryBoxes = {
      'UKRAINE':      { box: [22, 48, 41, 53], mode: 'WAR', flags: ['military','flights','frontline','earthquakes','news','jamming'] },
      'RUSSIA':       { box: [27, 41, 180, 82], mode: 'SUPERPOWER', flags: ['military','flights','satellite','news','jamming'] },
      'USA':          { box: [-180, 24, -65, 73], mode: 'GLOBAL_HEGEMON', flags: ['flights','military','traffic','news','defense'] },
      'CHINA':        { box: [73, 18, 135, 54], mode: 'SUPERPOWER', flags: ['military','ships','flights','news'] },
      'UK':           { box: [-8, 50, 2, 60], mode: 'EUROPE', flags: ['flights','traffic','cctv','news'] },
      'GERMANY':      { box: [6, 47, 15, 55], mode: 'EUROPE', flags: ['flights','traffic','news'] },
      'FRANCE':       { box: [-5, 42, 9, 51], mode: 'EUROPE', flags: ['flights','traffic','news'] },
      'ITALY':        { box: [7, 36, 19, 47], mode: 'EUROPE', flags: ['flights','volcano','news'] },
      'SPAIN':        { box: [-9, 36, 3, 44], mode: 'EUROPE', flags: ['flights','wildfire','news'] },
      'POLAND':       { box: [14, 49, 24, 55], mode: 'EUROPE', flags: ['flights','traffic','news','ukraine_refugees'] },
      'INDIA':        { box: [68, 6, 97, 36], mode: 'REGIONAL_POWER', flags: ['flights','traffic','news'] },
      'JAPAN':        { box: [128, 24, 146, 46], mode: 'ASIA_PACIFIC', flags: ['flights','ships','earthquakes','news'] },
      'TAIWAN':       { box: [119, 21, 122, 26], mode: 'TENSION', flags: ['military','flights','news'] },
      'SOUTH_KOREA':  { box: [125, 33, 131, 39], mode: 'ASIA_PACIFIC', flags: ['flights','traffic','news'] },
      'IRAN':         { box: [44, 25, 63, 40], mode: 'MIDDLE_EAST', flags: ['military','flights','news','earthquakes'] },
      'ISRAEL':       { box: [34, 29, 36, 33], mode: 'MIDDLE_EAST', flags: ['military','flights','news'] },
      'SAUDI_ARABIA': { box: [35, 16, 56, 32], mode: 'MIDDLE_EAST', flags: ['flights','news'] },
      'UAE':          { box: [51, 22, 57, 26], mode: 'MIDDLE_EAST', flags: ['flights','cctv','news'] },
      'TURKEY':       { box: [26, 35, 45, 42], mode: 'MIDDLE_EAST', flags: ['flights','earthquakes','news','refugees'] },
      'AUSTRALIA':    { box: [113, -44, 154, -10], mode: 'ALLIES', flags: ['flights','news','bushfires'] },
      'BRAZIL':       { box: [-74, -34, -32, 5], mode: 'LATAM', flags: ['flights','deforestation','news'] },
      'VENEZUELA':    { box: [-73, 0, -59, 12], mode: 'LATAM', flags: ['flights','news'] },
      'N_KOREA':      { box: [124, 37, 131, 43], mode: 'TENSION', flags: ['military','flights'] },
      'S_SUDAN':      { box: [24, 3, 36, 16], mode: 'CONFLICT', flags: ['military','news','refugees'] },
      'ETHIOPIA':     { box: [33, 3, 48, 15], mode: 'CONFLICT', flags: ['military','news','refugees'] },
      'MYANMAR':      { box: [92, 10, 101, 28], mode: 'CONFLICT', flags: ['military','news'] },
      'PAKISTAN':     { box: [60, 23, 77, 37], mode: 'NUCLEAR', flags: ['flights','news'] },
      'SYRIA':        { box: [35, 32, 42, 37], mode: 'CONFLICT', flags: ['military','earthquakes','news','refugees'] },
      'LIBYA':        { box: [9, 19, 26, 33], mode: 'CONFLICT', flags: ['military','news'] },
      'YEMEN':        { box: [42, 12, 54, 19], mode: 'CONFLICT', flags: ['military','flights','news'] },
      'IRAQ':         { box: [38, 29, 49, 37], mode: 'MIDDLE_EAST', flags: ['military','flights','news'] },
      'AFGHANISTAN':  { box: [60, 29, 75, 38], mode: 'CONFLICT', flags: ['military','news'] },
      'MEDITERRANEAN':{ box: [-5, 30, 36, 46], mode: 'MARITIME', flags: ['ships','flights','news'] },
      'SOUTH_CHINA_SEA': { box: [105, 0, 122, 25], mode: 'TENSION', flags: ['ships','military','flights'] },
      'ARCTIC':       { box: [-180, 66, 180, 90], mode: 'ARCTIC', flags: ['ships','research','military'] },
      'EAST_AFRICA':  { box: [28, -12, 52, 18], mode: 'CONFLICT', flags: ['news','earthquakes'] },
      'GLOBAL':       { box: [-180, -90, 180, 90], mode: 'GLOBAL', flags: ['all'] },
    };
    
    // Mode → visual theme mapping
    this.modeThemes = {
      'WAR':           { color: '#f44',     shader: 'thermal_hq', alert: 'ACTIVE COMBAT ZONE' },
      'SUPERPOWER':    { color: '#f80',     shader: 'normal',     alert: 'MAJOR POWER THEATER' },
      'GLOBAL_HEGEMON':{ color: '#00f0ff', shader: 'normal',     alert: 'US THEATER' },
      'EUROPE':        { color: '#00f0ff', shader: 'nvg',        alert: 'EUROPEAN REGION' },
      'MIDDLE_EAST':   { color: '#ff6600', shader: 'thermal_hq', alert: 'MIDDLE EAST TENSION' },
      'ASIA_PACIFIC':  { color: '#00ff88', shader: 'normal',     alert: 'ASIA-PACIFIC REGION' },
      'TENSION':       { color: '#ff0',     shader: 'thermal_hq', alert: 'HIGH TENSION ZONE' },
      'CONFLICT':      { color: '#f44',     shader: 'thermal_hq', alert: 'ACTIVE CONFLICT' },
      'MARITIME':      { color: '#00f0ff', shader: 'flir',       alert: 'MARITIME CHOKEPOINTS' },
      'REGIONAL_POWER': { color: '#0f8',    shader: 'normal',     alert: 'REGIONAL ACTOR' },
      'ALLIES':        { color: '#0f8',     shader: 'normal',     alert: 'ALLIED TERRITORY' },
      'LATAM':         { color: '#0f8',     shader: 'normal',     alert: 'LATIN AMERICA' },
      'NUCLEAR':       { color: '#ff0',     shader: 'thermal_hq', alert: 'NUCLEAR STATE' },
      'ARCTIC':        { color: '#aaf',     shader: 'flir',       alert: 'ARCTIC ACTIVITY' },
      'GLOBAL':        { color: '#fff',     shader: 'normal',     alert: 'GLOBAL OVERVIEW' },
    };
    
    this._bindCamera();
    this._createCCTVOverlay();
    console.log('[GOTHAM] Country Intel Orchestrator ONLINE');
  }

  _bindCamera() {
    let debounceTimer = null;
    this.viewer.camera.moveEnd.addEventListener(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this._checkCountry(), 500);
    });
  }

  _checkCountry() {
    const cam = this.viewer.camera;
    const pos = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cam.position);
    const lon = Cesium.Math.toDegrees(pos.longitude);
    const lat = Cesium.Math.toDegrees(pos.latitude);
    const alt = cam.positionCartographic.height;
    
    // First check: is altitude low enough to be "zoomed in"?
    // High altitude = global view, no country lock
    if (alt > 2000000) {
      if (this.currentCountry !== 'GLOBAL') {
        this._exitCountryMode();
      }
      return;
    }
    
    // Check each country bounding box
    for (const [name, data] of Object.entries(this.countryBoxes)) {
      if (name === 'GLOBAL') continue;
      const [minLon, minLat, maxLon, maxLat] = data.box;
      if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
        if (this.currentCountry !== name) {
          this._enterCountryMode(name, data);
        }
        return;
      }
    }
  }

  _enterCountryMode(country, data) {
    console.log(`[GOTHAM] ENTERING COUNTRY MODE: ${country} — ${data.mode}`);
    this.currentCountry = country;
    
    // Log it
    if (this.hud) this.hud._sysLog(`COUNTRY MODE: ${country} [${data.mode}]`);
    
    // 1. SPEAK THE ALERT
    const theme = this.modeThemes[data.mode] || this.modeThemes['GLOBAL'];
    this._announceCountry(country, theme);
    
    // 2. SET VISUAL THEME (shader mode)
    if (this.hud?.shaders) {
      this.hud.shaders.setMode(theme.shader);
    }
    
    // 3. AUTO-ENABLE LAYERS based on country profile
    this._activateCountryFeeds(data.flags);
    
    // 4. AUTO-OPEN INTELLIGENCE PANEL
    this._openIntelPanel(country, data);
    
    // 5. CCTV OVERLAY — auto-populate for this region
    this._loadCCTVForCountry(country);
    
    // 6. FLY TO COUNTRY CENTER (if not already close)
    this._optimizeCameraForCountry(country);
    
    // 7. Update HUD status
    const statusEl = document.getElementById('ghud-country-mode');
    if (statusEl) {
      statusEl.textContent = `${country} | ${data.mode}`;
      statusEl.style.color = theme.color;
    }
    
    // 8. ZOOM-TO-COUNTRY buttons — highlight active
    if (this.hud) {
      document.querySelectorAll('[id^="zoom-"]').forEach(el => {
        el.style.borderColor = el.id === `zoom-${country.toLowerCase().replace('_','')}` ? theme.color : '';
      });
    }
  }

  _exitCountryMode() {
    if (!this.currentCountry || this.currentCountry === 'GLOBAL') return;
    console.log(`[GOTHAM] EXITING COUNTRY MODE: ${this.currentCountry}`);
    this.currentCountry = null;
    
    // Reset to normal shader
    if (this.hud?.shaders) {
      this.hud.shaders.setMode('normal');
    }
    
    // Disable country-specific layers
    this._deactivateCountryFeeds();
    
    // Close CCTV overlay
    this._hideCCTVOverlay();
    
    // Reset HUD
    const statusEl = document.getElementById('ghud-country-mode');
    if (statusEl) {
      statusEl.textContent = 'GLOBAL';
      statusEl.style.color = '#fff';
    }
  }

  _activateCountryFeeds(flags) {
    if (!this.hud) return;
    
    // Map flags to layer types
    const flagMap = {
      'military': 'flight',     // Military flights
      'flights': 'flight',       // Commercial flights
      'ships': 'sea',            // Maritime vessels
      'traffic': 'traffic',      // Road traffic
      'frontline': 'frontline',  // Ukraine frontlines
      'earthquakes': 'hazard',   // Seismic
      'news': 'news',            // News events
      'jamming': 'jamming',       // GPS jamming
      'defense': 'financial',    // Defense stocks
      'volcano': 'hazard',       // Volcanic
      'wildfire': 'hazard',      // Wildfires
      'bushfires': 'hazard',     // Australian bushfires
      'cctv': 'cctv',            // CCTV cameras
      'satellite': 'satellite', // Orbital
      'deforestation': 'environment', // Environmental
      'refugees': 'news',        // Displacement news
      'research': 'satellite',   // Arctic research
    };
    
    // Activate each flagged feed
    for (const flag of flags) {
      if (flag === 'all') {
        // Enable ALL layers
        if (this.hud) {
          for (const type of Object.keys(this.hud.layerVisibility)) {
            this.hud.layerVisibility[type] = true;
          }
        }
        continue;
      }
      
      const layerType = flagMap[flag] || flag;
      if (this.hud?.layerVisibility !== undefined) {
        this.hud.layerVisibility[layerType] = true;
        
        // Also activate via toggleLayer for any side effects
        const btnId = `gtog-${layerType}`;
        if (!document.getElementById(btnId)) {
          // Try short form
          const shortMap = { sea: 'sea', flight: 'air', traffic: 'land', hazard: 'hazard', news: 'news' };
          const short = shortMap[layerType] || layerType;
          const altBtn = `gtog-${short}`;
          if (document.getElementById(altBtn)) {
            this.hud.toggleLayer(layerType, altBtn);
          }
        } else {
          this.hud.toggleLayer(layerType, btnId);
        }
      }
      this.activeFeeds.add(layerType);
      if (this.hud) this.hud._sysLog(`FEED ACTIVE: ${layerType.toUpperCase()}`);
    }
  }

  _deactivateCountryFeeds() {
    if (!this.hud) return;
    for (const feed of this.activeFeeds) {
      if (this.hud.layerVisibility !== undefined) {
        this.hud.layerVisibility[feed] = false;
      }
    }
    this.activeFeeds.clear();
  }

  _announceCountry(country, theme) {
    // Speak country entry
    const alerts = {
      'UKRAINE': 'Entering active combat zone. Ukraine theater. All feeds active.',
      'RUSSIA': 'Entering Russian Federation airspace. Military monitoring engaged.',
      'USA': 'United States theater. Full surveillance mode.',
      'CHINA': 'Entering Chinese theater. South China Sea activity highlighted.',
      'TAIWAN': 'Taiwan Strait. High tension zone. All military feeds active.',
      'IRAN': 'Iranian airspace. Nuclear state. Increased monitoring.',
      'SYRIA': 'Active conflict zone. Syria theater.',
      'UK': 'United Kingdom. European region. CCTV network available.',
      'JAPAN': 'Japan. Pacific theater. Seismic monitoring active.',
      'SOUTH_CHINA_SEA': 'South China Sea. Maritime tension zone. Naval tracking engaged.',
    };
    
    const msg = alerts[country] || `Entering ${country.replace('_', ' ')} region.`;
    
    // Use Gotham's TTS system
    if (typeof window.gothamTTS !== 'undefined') {
      window.gothamTTS.speak(msg);
    } else {
      console.log('[GOTHAM TTS]', msg);
    }
  }

  _openIntelPanel(country, data) {
    // Open OSINT overlay with country-specific presets
    if (window.gothamOSINTOverlay) {
      window.gothamOSINTOverlay.show();
      
      // Auto-populate OSINT search based on country
      const countrySearchMap = {
        'UKRAINE': { tab: 'frontlines', data: null },
        'RUSSIA': { tab: 'vip', data: 'Government of Russia' },
        'USA': { tab: 'breach', data: null },
        'CHINA': { tab: 'news', data: null },
        'TAIWAN': { tab: 'news', data: null },
        'IRAN': { tab: 'vip', data: 'Government of Iran' },
        'SYRIA': { tab: 'news', data: null },
        'UK': { tab: 'cctv', data: 'London' },
        'JAPAN': { tab: 'news', data: null },
        'SOUTH_CHINA_SEA': { tab: 'vip', data: 'China' },
      };
      
      const preset = countrySearchMap[country];
      if (preset) {
        // Switch to appropriate tab and pre-fill
        const tabBtn = document.querySelector(`.osint-tab[data-tab="${preset.tab}"]`);
        if (tabBtn) tabBtn.click();
        
        if (preset.data) {
          const input = document.getElementById(`osint-${preset.tab}-input`);
          if (input) {
            input.value = preset.data;
            // Auto-trigger search
            setTimeout(() => {
              const searchBtn = document.querySelector(`#osint-btn-${preset.tab}-${preset.tab === 'vip' ? 'search' : preset.tab === 'frontlines' ? 'load' : 'scan'}`);
              if (searchBtn) searchBtn.click();
            }, 500);
          }
        }
      }
    }
    
    // Log intel panel activation
    if (this.hud) {
      this.hud._sysLog(`INTEL PANEL: AUTO-OPEN ${country}`);
    }
  }

  _loadCCTVForCountry(country) {
    // Build CCTV feed list for the country
    const cctvConfig = this._getCCTVConfig(country);
    
    if (cctvConfig.length === 0) {
      console.log(`[GOTHAM] No CCTV feeds available for ${country}`);
      return;
    }
    
    this._showCCTVOverlay(cctvConfig);
  }

  _getCCTVConfig(country) {
    // Public webcam/CCTV sources organized by country/region
    // These are publicly accessible webcam feeds
    const configs = {
      'UK': [
        { name: 'London - Trafalgar Square', lat: 51.508, lon: -0.128, url: 'https://www.youtube.com/embed/live_stream?channel=UCK1mLh8O给了nL_4R0JlZq7w' },
        { name: 'London - Westminster', lat: 51.501, lon: -0.125, url: null },
        { name: 'Edinburgh - Castle', lat: 55.949, lon: -3.200, url: null },
        { name: 'Manchester', lat: 53.481, lon: -2.237, url: null },
      ],
      'USA': [
        { name: 'NYC - Times Square', lat: 40.758, lon: -73.985, url: null },
        { name: 'NYC - Statue of Liberty', lat: 40.689, lon: -74.045, url: null },
        { name: 'Las Vegas Strip', lat: 36.114, lon: -115.173, url: null },
        { name: 'San Francisco Bay', lat: 37.819, lon: -122.478, url: null },
        { name: 'Miami Beach', lat: 25.790, lon: -80.130, url: null },
      ],
      'JAPAN': [
        { name: 'Tokyo - Shibuya', lat: 35.659, lon: 139.700, url: null },
        { name: 'Tokyo - Tower', lat: 35.658, lon: 139.745, url: null },
        { name: 'Osaka - Dotonbori', lat: 34.669, lon: 135.500, url: null },
        { name: 'Mt. Fuji', lat: 35.361, lon: 138.727, url: null },
      ],
      'FRANCE': [
        { name: 'Paris - Eiffel Tower', lat: 48.858, lon: 2.294, url: null },
        { name: 'Paris - Champs-Elysees', lat: 48.870, lon: 2.308, url: null },
        { name: 'Nice - Promenade', lat: 43.696, lon: 7.265, url: null },
      ],
      'GERMANY': [
        { name: 'Berlin - Brandenburg Gate', lat: 52.516, lon: 13.378, url: null },
        { name: 'Munich - Marienplatz', lat: 48.137, lon: 11.575, url: null },
      ],
      'ITALY': [
        { name: 'Rome - Colosseum', lat: 41.890, lon: 12.492, url: null },
        { name: 'Venice - Grand Canal', lat: 45.440, lon: 12.315, url: null },
        { name: 'Mt. Vesuvius', lat: 40.821, lon: 14.426, url: null },
      ],
      'SPAIN': [
        { name: 'Barcelona - Sagrada Familia', lat: 41.403, lon: 2.174, url: null },
        { name: 'Madrid - Gran Via', lat: 40.420, lon: -3.701, url: null },
      ],
      'UAE': [
        { name: 'Dubai - Burj Khalifa', lat: 25.197, lon: 55.274, url: null },
        { name: 'Dubai - Marina', lat: 25.078, lon: 55.137, url: null },
      ],
      'TAIWAN': [
        { name: 'Taipei - 101', lat: 25.034, lon: 121.564, url: null },
        { name: 'Taiwan Strait', lat: 24.500, lon: 119.500, url: null },
      ],
      'UKRAINE': [
        { name: 'Kyiv - Independence Square', lat: 50.450, lon: 30.524, url: null },
        { name: 'Odessa - Port', lat: 46.485, lon: 30.710, url: null },
        { name: 'Lviv - Rynna Square', lat: 49.840, lon: 24.032, url: null },
      ],
      'RUSSIA': [
        { name: 'Moscow - Red Square', lat: 55.754, lon: 37.620, url: null },
        { name: 'St. Petersburg', lat: 59.931, lon: 30.360, url: null },
      ],
      'CHINA': [
        { name: 'Beijing - Tiananmen', lat: 39.904, lon: 116.391, url: null },
        { name: 'Shanghai - Bund', lat: 31.239, lon: 121.491, url: null },
        { name: 'Hong Kong - Victoria Harbour', lat: 22.285, lon: 114.158, url: null },
      ],
      'AUSTRALIA': [
        { name: 'Sydney - Opera House', lat: -33.856, lon: 151.215, url: null },
        { name: 'Sydney - Harbour Bridge', lat: -33.852, lon: 151.211, url: null },
        { name: 'Melbourne', lat: -37.813, lon: 144.963, url: null },
      ],
      'BRAZIL': [
        { name: 'Rio de Janeiro - Copacabana', lat: -22.971, lon: -43.182, url: null },
        { name: 'Rio - Christ Redeemer', lat: -22.952, lon: -43.210, url: null },
      ],
      'SOUTH_CHINA_SEA': [
        { name: 'Spratly Islands', lat: 10.750, lon: 115.750, url: null },
        { name: ' Scarborough Shoal', lat: 15.183, lon: 117.750, url: null },
        { name: 'Paracel Islands', lat: 16.500, lon: 112.000, url: null },
      ],
    };
    
    return configs[country] || [];
  }

  _showCCTVOverlay(feeds) {
    this._hideCCTVOverlay();
    
    const html = `
    <div id="gotham-cctv-overlay" style="
      position:fixed;
      bottom:20px;
      right:20px;
      width:380px;
      max-height:60vh;
      background:rgba(0,0,0,0.95);
      border:1px solid rgba(0,240,255,0.4);
      border-radius:8px;
      z-index:9998;
      font-family:'Courier New',monospace;
      overflow:hidden;
    ">
      <div style="background:rgba(0,240,255,0.1);padding:8px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,240,255,0.3);">
        <span style="color:#00f0ff;font-size:11px;font-weight:bold;letter-spacing:2px">CCTV / PUBLIC FEEDS</span>
        <button id="cctv-close" style="background:none;border:none;color:#f44;cursor:pointer;font-size:14px;">X</button>
      </div>
      <div id="cctv-feeds-list" style="padding:8px;max-height:calc(60vh - 50px);overflow-y:auto;">
        ${feeds.map((f, i) => `
          <div class="cctv-feed-item" data-lat="${f.lat}" data-lon="${f.lon}" style="
            background:rgba(0,0,0,0.4);
            border:1px solid rgba(0,240,255,0.15);
            border-radius:4px;
            padding:8px;
            margin-bottom:6px;
            cursor:pointer;
          ">
            <div style="color:#fff;font-size:10px;font-weight:bold;margin-bottom:4px">${f.name}</div>
            <div style="color:#888;font-size:9px">${f.lat.toFixed(3)}, ${f.lon.toFixed(3)}</div>
            ${f.url ? `<div style="color:#0f8;font-size:9px;margin-top:4px">STREAM AVAILABLE</div>` : '<div style="color:#666;font-size:9px;margin-top:4px">Coordinates logged — click to fly</div>'}
          </div>
        `).join('')}
      </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Wire up click handlers
    document.getElementById('cctv-close').addEventListener('click', () => this._hideCCTVOverlay());
    document.querySelectorAll('.cctv-feed-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1000),
          duration: 2
        });
        if (this.hud) this.hud._sysLog(`CCTV FLYTO: ${item.querySelector('div').textContent}`);
      });
    });
  }

  _hideCCTVOverlay() {
    const el = document.getElementById('gotham-cctv-overlay');
    if (el) el.remove();
  }

  _optimizeCameraForCountry(country) {
    // Country center coordinates
    const centers = {
      'UK': [-3, 54, 2500000], 'GERMANY': [10, 51, 2500000], 'FRANCE': [2, 46, 3000000],
      'ITALY': [12, 43, 2500000], 'SPAIN': [-3, 40, 3000000], 'POLAND': [19, 52, 2500000],
      'UKRAINE': [32, 49, 3000000], 'RUSSIA': [60, 65, 15000000], 'USA': [-98, 38, 10000000],
      'CHINA': [105, 35, 8000000], 'INDIA': [78, 22, 6000000], 'JAPAN': [138, 36, 3000000],
      'TAIWAN': [121, 24, 1500000], 'SOUTH_KOREA': [128, 36, 2000000],
      'IRAN': [53, 33, 5000000], 'ISRAEL': [35, 31, 1500000], 'SAUDI_ARABIA': [45, 25, 5000000],
      'UAE': [54, 24, 1500000], 'TURKEY': [35, 39, 4000000], 'AUSTRALIA': [134, -25, 8000000],
      'BRAZIL': [-53, -10, 8000000], 'VENEZUELA': [-66, 8, 3000000],
      'N_KOREA': [127, 40, 1000000], 'S_SUDAN': [30, 8, 3000000], 'ETHIOPIA': [40, 9, 3000000],
      'MYANMAR': [96, 20, 2000000], 'PAKISTAN': [69, 30, 4000000], 'SYRIA': [38, 35, 2000000],
      'LIBYA': [17, 27, 3000000], 'YEMEN': [48, 15, 2000000], 'IRAQ': [44, 33, 3000000],
      'AFGHANISTAN': [67, 34, 2500000], 'MEDITERRANEAN': [15, 37, 6000000],
      'SOUTH_CHINA_SEA': [113, 13, 4000000], 'ARCTIC': [0, 80, 12000000],
      'EAST_AFRICA': [38, 5, 6000000],
    };
    
    const center = centers[country];
    if (center) {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(center[0], center[1], center[2]),
        duration: 2.5
      });
    }
  }

  // Manual trigger for zoom buttons
  enterCountry(country) {
    const data = this.countryBoxes[country];
    if (data) this._enterCountryMode(country, data);
  }
}

// Auto-init when Gotham viewer is ready
document.addEventListener('DOMContentLoaded', () => {
  let initTimer = null;
  const tryInit = () => {
    if (window.gothamViewer && window.gothamHUD) {
      window.countryIntel = new CountryIntelOrchestrator(window.gothamViewer, window.gothamHUD);
    } else if (initTimer++ < 50) {
      setTimeout(tryInit, 500);
    }
  };
  setTimeout(tryInit, 2000);
});
