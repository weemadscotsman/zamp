/**
 * GOTHAM 3077 - Globe Bootstrap v3.5
 * v3.5 - TTS QUEUE FIX
 * Fixed TTS cutting off by implementing sequential speech queue.
 */
(function () {
  'use strict'

  async function boot () {
    if (window._gothamBooted) return;
    window._gothamBooted = true;
    
    const term = document.getElementById('boot-terminal')
    const bar = document.getElementById('boot-progress-bar')
    const status = document.getElementById('boot-status-text')
    const overlay = document.getElementById('gotham-boot-overlay')

    function log(msg, color) {
      if (!term) return;
      const div = document.createElement('div');
      div.textContent = '> ' + msg;
      if (color) div.style.color = color;
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }

    function setProgress(pct, text) {
      if (bar) bar.style.width = pct + '%';
      if (status) status.textContent = text + ': ' + pct + '%';
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    // STAGE 0: DEPENDENCY CHECK
    log('VERIFYING SYSTEM DEPENDENCIES...');
    if (typeof Cesium === 'undefined') {
      log('WARNING: CESIUM KERNEL NOT FOUND, DOWNLOADING...', '#ffaa00');
      try {
        await new Promise((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/js/widgets.css';
          document.head.appendChild(link);

          const script = document.createElement('script');
          script.src = '/js/Cesium.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (err) {
        log('CRITICAL ERROR: CESIUM KERNEL DOWNLOAD FAILED', '#f44');
        setProgress(0, 'FAILED');
        return;
      }
    }
    log('CESIUM KERNEL DETECTED', '#0f8');

    // STAGE 1: COMMANDER AUTHORIZATION
    log('AWAITING COMMANDER AUTHORIZATION...', '#ffaa00');
    
    const initBtn = document.createElement('div');
    initBtn.id = 'boot-init-trigger';
    initBtn.style.cssText = 'margin-top:20px; padding:15px; border:2px solid #00f0ff; color:#00f0ff; text-align:center; cursor:pointer; font-weight:bold; letter-spacing:4px; animation: blink 2s infinite; background: rgba(0,240,255,0.1);';
    initBtn.textContent = 'INITIALIZE SUPREME COMMAND';
    if (term && term.parentNode) term.parentNode.appendChild(initBtn);

    await new Promise(resolve => {
      initBtn.addEventListener('click', () => {
        initBtn.style.display = 'none';
        resolve();
      });
    });

    // STAGE 2: TTS INITIALIZATION with QUEUE
    let ttsVoice = null;
    let ttsQueue = [];
    let ttsSpeaking = false;

    function initTTS() {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      ttsVoice = voices.find(v => v.lang === 'en-GB' && v.name.includes('Female')) || 
                 voices.find(v => v.lang === 'en-GB') || 
                 voices[0];
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = initTTS;
      initTTS();
    }

    // TTS Queue system - speaks messages sequentially without cutting off
    function processTTSQueue() {
      console.log("[TTS] Processing queue, length:", ttsQueue.length, "speaking:", ttsSpeaking);
      if (ttsSpeaking || ttsQueue.length === 0) return;
      
      ttsSpeaking = true;
      const msg = ttsQueue.shift();
      
      try {
        const utterance = new SpeechSynthesisUtterance(msg);
        if (ttsVoice) utterance.voice = ttsVoice;
        utterance.pitch = 1.1;
        utterance.rate = 0.95;
        
        utterance.onend = () => {
          ttsSpeaking = false;
          setTimeout(() => processTTSQueue(), 50);
        };
        
        utterance.onerror = () => {
          ttsSpeaking = false;
          processTTSQueue();
        };
        
        window.speechSynthesis.speak(utterance);
        console.log("[TTS] Speaking utterance");
      } catch(e) {
        ttsSpeaking = false;
        processTTSQueue();
      }
    }

    function speak(msg) {
      console.log("[TTS] Queueing:", msg.substring(0, 30) + "...");
      if (!window.speechSynthesis || !msg) return;
      ttsQueue.push(msg);
      processTTSQueue();
    }

    // STAGE 3: ION & GOOGLE KEYS
    log('VERIFYING SYSTEM ENCRYPTION KEYS...');
    speak('Verifying system encryption keys.');
    try {
      const res = await fetch('/api/cesium-token', { signal: AbortSignal.timeout(5000) });
      const d = await res.json();
      
      // Apply Cesium Ion Token
      if (d.token) Cesium.Ion.defaultAccessToken = d.token;
      
      // Apply Google Maps API Key
      if (d.googleKey) {
        Cesium.GoogleMaps.defaultApiKey = d.googleKey;
        // Optimize request scheduling for Google Tiles
        Cesium.RequestScheduler.requestsByServer["tile.googleapis.com:443"] = 18;
      }
      
      log('ACCESS KEYS GRANTED', '#0f8');
    } catch (e) {
      log('WARNING: AUTH TIMEOUT, USING LOCAL CACHE', '#f80');
    }
    setProgress(15, 'NETWORK');
    await wait(800);

    // STAGE 4: WORLD ENGINE
    log('SPAWNING OPTIMIZED WORLD ENGINE...');
    speak('Spawning optimized 3D world engine.');
    let viewer;
    try {
      viewer = new Cesium.Viewer('cesiumContainer', {
        baseLayerPicker: false, geocoder: false, homeButton: false,
        sceneModePicker: false, selectionIndicator: false, navigationHelpButton: false,
        animation: false, timeline: false, fullscreenButton: false,
        vrButton: false, infoBox: false, shadows: false, shouldAnimate: true,
        requestRenderMode: false,
        msaaSamples: 4,
        tileCacheSize: 1000,
        terrain: Cesium.Terrain.fromWorldTerrain({ requestWaterMask: true, requestVertexNormals: true })
      });

      viewer.scene.globe.preloadAncestors = true;
      viewer.scene.globe.preloadSiblings = true;
      viewer.scene.globe.maximumScreenSpaceError = 2.0; 
      viewer.scene.globe.enableLighting = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500;

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-40, 20, 18000000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
      });

      window.gothamViewer = viewer;
      window.gothamGlobe = { viewer: viewer };
      log('ENGINE STABILIZED', '#0f8');
    } catch (e) {
      log('CRITICAL ENGINE FAILURE', '#f44');
      console.error(e);
      return;
    }
    setProgress(35, 'ENGINE');
    await wait(800);

    // STAGE 5: VIEWPORT & OPTICS
    log('MAPPING CIRCULAR VIEWPORT...');
    speak('Mapping circular viewport.');
    if (typeof GothamViewport !== 'undefined') {
      try {
        window.gothamViewport = new GothamViewport(viewer);
        log('RETICLE LOCK ACQUIRED', '#0f8');
      } catch (e) {
        log('VIEWPORT INITIALIZATION PARTIAL', '#f80');
      }
    }
    setProgress(45, 'OPTICS');
    await wait(800);

    // STAGE 6: CITY MESH
    log('INJECTING CITY MESH [GOOGLE 3D]...');
    speak('Injecting city mesh structure.');
    try {
      // Use the Cesium built-in helper which uses GoogleMaps.defaultApiKey
      const tileset = await Promise.race([
        Cesium.createGooglePhotorealistic3DTileset(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000))
      ]);
      
      // Ensure attributions are shown as required by Google
      tileset.showCreditsOnScreen = true;
      
      viewer.scene.primitives.add(tileset);
      log('CITY MESH PIPELINE ACTIVE', '#0f8');
    } catch (e) {
      log('INFO: GOOGLE 3D BYPASSED (TIMEOUT OR NO KEY)', '#f80');
      console.warn('[GOTHAM] Google 3D Tiles failed:', e);
    }
    setProgress(60, 'RENDERER');
    await wait(800);

    // STAGE 7: LOGIC & SHADERS
    log('BOOTING OMNI-EYE LOGIC...');
    speak('Booting omni-eye logic.');
    let gothamSystem = null;
    if (typeof Gotham3077System !== 'undefined') {
      try {
        gothamSystem = new Gotham3077System(viewer);
        window.gothamSystem = gothamSystem;
        log('ENTITY SYNC READY', '#0f8');
        
        // Initialize ShadowBroker Bridge
        if (typeof ShadowBrokerBridge !== 'undefined') {
          window.shadowBrokerBridge = new ShadowBrokerBridge(viewer, gothamSystem);
          log('SHADOWBROKER ONLINE', '#0f8');
        }
      } catch (e) {
        log('ENTITY SYSTEM PARTIAL', '#f80');
        console.error(e);
      }
    }
    setProgress(70, 'LOGIC');
    await wait(800);

    log('CALIBRATING VISUAL MODES...');
    speak('Calibrating visual modes.');
    if (typeof GothamShaders !== 'undefined') {
      try {
        window.gothamShaders = new GothamShaders(viewer);
        log('SHADERS ONLINE', '#0f8');
      } catch (e) {
        log('SHADER SYSTEM PARTIAL', '#f80');
      }
    }
    setProgress(80, 'SHADERS');
    await wait(800);

    // STAGE 8: HUD & COMMS
    log('SPAWNING SUPREME COMMAND HUD...');
    speak('Spawning supreme command interface.');
    if (typeof GothamHUD !== 'undefined' && window.gothamShaders) {
      try {
        window.gothamHUD = new GothamHUD(viewer, window.gothamShaders, gothamSystem);
        log('HUD v40.0 CONNECTED', '#0f8');
      } catch (e) {
        log('HUD PARTIAL', '#f80');
        console.error(e);
      }
    }
    setProgress(85, 'HUD');
    await wait(800);

    // STAGE 8a: EVENT ENGINE, PREDICTION ENGINE & AI ANALYST
    log('ACTIVATING INTELLIGENCE SYSTEMS...');
    speak('Activating intelligence systems.');
    
    // Initialize Event Engine (with HUD reference for layer-aware alerts)
    if (typeof GothamEventEngine !== 'undefined' && gothamSystem && window.gothamHUD) {
      try {
        window.gothamEventEngine = new GothamEventEngine(gothamSystem, window.gothamHUD);
        window.gothamEventEngine.enableAlerts();
        log('EVENT ENGINE ONLINE', '#0f8');
      } catch (e) {
        log('EVENT ENGINE PARTIAL', '#f80');
        console.error(e);
      }
    }
    
    // Initialize Prediction Engine
    if (typeof GothamPredictionEngine !== 'undefined' && gothamSystem) {
      try {
        window.gothamPredictionEngine = new GothamPredictionEngine(gothamSystem);
        log('PREDICTION ENGINE ONLINE', '#0f8');
      } catch (e) {
        log('PREDICTION ENGINE PARTIAL', '#f80');
        console.error(e);
      }
    }
    
    // Initialize AI Analyst
    if (typeof GothamAIAnalyst !== 'undefined' && gothamSystem && window.gothamHUD) {
      try {
        window.gothamAIAnalyst = new GothamAIAnalyst(
          gothamSystem,
          window.gothamEventEngine,
          window.gothamPredictionEngine,
          window.gothamHUD
        );
        log('AI ANALYST ONLINE', '#0f8');
        speak('AI analyst autonomous analysis active.');
      } catch (e) {
        log('AI ANALYST PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(600);

    // STAGE 8b: ACCOUNTABILITY ENGINE (Public Cameras + UFO Tracking)
    log('ACTIVATING ACCOUNTABILITY ENGINE...');
    speak('Activating accountability engine.');
    if (typeof accountabilityEngine !== 'undefined' && viewer && window.gothamHUD) {
      try {
        window.gothamAccountability = new accountabilityEngine(viewer, window.gothamHUD);
        await window.gothamAccountability.init();
        log('ACCOUNTABILITY ENGINE ONLINE', '#0f8');
        speak('Public camera and UFO tracking active.');
      } catch (e) {
        log('ACCOUNTABILITY PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(400);

    // STAGE 8a.5: ROAD NETWORK
    log('INITIALIZING ROAD NETWORK...');
    speak('Initializing road network.');
    if (typeof RoadNetwork !== 'undefined' && viewer) {
      try {
        window.gothamRoads = new RoadNetwork(viewer);
        log('ROAD NETWORK ONLINE', '#0f8');
      } catch (e) {
        log('ROAD NETWORK PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(400);

    // STAGE 8b: WORLDVIEW + TRAJECTORY FIELDS
    log('INITIALIZING WORLDVIEW SUBSYSTEMS...');
    speak('Initializing worldview subsystems.');
    if (typeof WorldviewComplete !== 'undefined') {
      try {
        window.gothamWorldview = new WorldviewComplete(viewer);
        log('WORLDVIEW COMPLETE ONLINE', '#0f8');
      } catch (e) {
        log('WORLDVIEW PARTIAL', '#f80');
        console.error(e);
      }
    }
    if (typeof TrajectoryFieldSystem !== 'undefined' && window.gothamWorldview) {
      try {
        window.gothamTrajectory = new TrajectoryFieldSystem(viewer, window.gothamWorldview);
        log('TRAJECTORY FIELDS ONLINE', '#0f8');
      } catch (e) {
        log('TRAJECTORY FIELDS PARTIAL', '#f80');
        console.error(e);
      }
    }
    setProgress(88, 'SUBSYSTEMS');
    await wait(400);

    // STAGE 8c: WORLD STREAMING CONTROLLER
    log('INITIALIZING WORLD STREAMING LAYER...');
    speak('Initializing world streaming layer.');
    if (typeof WorldStreamingController !== 'undefined') {
      try {
        window.worldStreaming = new WorldStreamingController(viewer, {
          tileThreshold: 500,
          transitionZone: 200,
          regionThreshold: 1000,
          planetThreshold: 10000
        });
        
        // Connect to existing systems
        if (window.gothamHUD) {
          window.worldStreaming.on('tileworld:entered', (data) => {
            window.gothamHUD._sysLog(`Sector entry: ${data.biome.biome} biome`);
          });
          
          window.worldStreaming.on('mode:changed', (data) => {
            window.gothamHUD._sysLog(`View mode: ${data.to}`);
          });
        }
        
        // Listen for propagated events
        window.worldStreaming.on('tileworld:event', (data) => {
          if (data.type === 'seismic' && window.gothamHUD) {
            window.gothamHUD._sysLog(`SEISMIC ALERT: M${data.magnitude}`);
          }
        });
        
        log('WORLD STREAMING ONLINE', '#0f8');
        speak('World streaming layer active. Seamless zoom transition ready.');
      } catch (e) {
        log('WORLD STREAMING PARTIAL', '#f80');
        console.error(e);
      }
    }
    setProgress(92, 'SUBSYSTEMS');
    await wait(400);

    // STAGE 8d: CORE INFRASTRUCTURE SYSTEMS
    log('INITIALIZING CORE INFRASTRUCTURE...');
    speak('Initializing core infrastructure systems.');
    
    // Global Event Bus
    if (typeof GothamEventBus !== 'undefined') {
      try {
        window.gothamEventBus = window.gothamEventBus || new GothamEventBus();
        window.gothamBus = window.gothamEventBus; // Alias for task system
        log('EVENT BUS v2.0 ONLINE', '#0f8');
      } catch (e) {
        log('EVENT BUS PARTIAL', '#f80');
      }
    }
    await wait(200);
    
    // TITAN Cache System
    if (typeof GothamCache !== 'undefined') {
      try {
        window.gothamCache = new GothamCache();
        log('TITAN CACHE ONLINE', '#0f8');
      } catch (e) {
        log('TITAN CACHE PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(200);
    
    // TITAN Spatial Index
    if (typeof SpatialIndex !== 'undefined') {
      try {
        window.gothamSpatial = new SpatialIndex();
        log('SPATIAL INDEX ONLINE', '#0f8');
      } catch (e) {
        log('SPATIAL INDEX PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(200);
    
    // World State Database
    if (typeof WorldStateDatabase !== 'undefined') {
      try {
        window.worldStateDB = new WorldStateDatabase({ eventBus: window.gothamEventBus });
        log('WORLD STATE DB ONLINE', '#0f8');
      } catch (e) {
        log('WORLD STATE DB PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(200);
    
    // Satellite Coverage System
    if (typeof SatelliteCoverageSystem !== 'undefined' && viewer) {
      try {
        window.satCoverage = new SatelliteCoverageSystem(viewer);
        log('SATELLITE COVERAGE ONLINE', '#0f8');
      } catch (e) {
        log('SATELLITE COVERAGE PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(200);
    
    // Performance Monitor
    if (typeof GothamPerformanceMonitor !== 'undefined' && viewer) {
      try {
        window.gothamPerfMonitor = new GothamPerformanceMonitor(viewer, {
          targetFPS: 60,
          warningThreshold: 30
        });
        log('PERFORMANCE MONITOR ONLINE', '#0f8');
      } catch (e) {
        log('PERFORMANCE MONITOR PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(200);
    
    // Scenario Engine
    if (typeof ScenarioEngine !== 'undefined') {
      try {
        window.scenarioEngine = new ScenarioEngine({ 
          eventBus: window.gothamEventBus,
          worldState: window.worldStateDB 
        });
        window.scenarioEngine.start();
        log('SCENARIO ENGINE ONLINE', '#0f8');
        speak('Disaster simulation ready. 8 scenarios loaded.');
      } catch (e) {
        log('SCENARIO ENGINE PARTIAL', '#f80');
        console.error(e);
      }
    }
    await wait(200);
    
    // GitHub Marketplace
    if (typeof GitHubMarketplace !== 'undefined') {
      try {
        window.githubMarketplace = new GitHubMarketplace({
          eventBus: window.gothamEventBus,
          agentSystem: window.agentController
        });
        log('GITHUB MARKETPLACE ONLINE', '#0f8');
        speak('Agent work marketplace active.');
      } catch (e) {
        log('GITHUB MARKETPLACE PARTIAL', '#f80');
        console.error(e);
      }
    }
    setProgress(94, 'INFRASTRUCTURE');
    await wait(400);

    log('ESTABLISHING DATA UPLINK...');
    speak('Establishing data uplink.');
    window.addEventListener('gotham-data', function (e) {
      if (gothamSystem) {
        try {
          gothamSystem._updateLayers(e.detail);
        } catch (err) {
          console.warn('[GOTHAM] Layer update error:', err);
        }
      }
    });

    // Flush any buffered WebSocket data that arrived before we were ready
    if (window._gothamFlushDataBuffer) {
      console.log('[GOTHAM] Flushing buffered WebSocket data...');
      window._gothamFlushDataBuffer();
    }

    // Data flows via WebSocket in index.html → gotham-data event → _updateLayers
    // Also trigger initial viewport fetch + periodic polling as backup
    if (gothamSystem && gothamSystem._fetchViewportData) {
      setTimeout(() => {
        console.log('[GOTHAM] Initial viewport data fetch');
        gothamSystem._fetchViewportData();
      }, 3000);

      // Periodic fallback poll every 30s
      setInterval(() => {
        if (gothamSystem && !gothamSystem._isDestroyed) {
          gothamSystem._fetchViewportData();
        }
      }, 30000);
    }



    log('UPLINK STABLE', '#0f8');
    setProgress(95, 'COMMS');
    await wait(800);

    // STAGE 9: FINALIZATION
    log('ATTACHING OSM BASE LAYER...');
    speak('Attaching global overlays.');
    try {
      viewer.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({
        url : 'https://a.tile.openstreetmap.org/'
      }));
    } catch (e) { log('INFO: OSM PARTIAL LOAD'); }
    await wait(500);
    speak('System ready. Welcome back, Commander. All tactical feeds are stabilized, and planetary monitoring is online.');
    log('SYSTEM READY. WELCOME COMMANDER.', '#0ff');
    setProgress(100, 'READY');

    setTimeout(() => {
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 1000);
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
