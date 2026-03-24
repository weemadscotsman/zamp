/**
 * GOTHAM 3077 - PUBLIC CAMERA ACCOUNTABILITY ENGINE v1.0
 * 
 * Ted's Vision: "We grab the feed of every publicly facing and available camera
 * for free rather than what they're doing with public surveillance.
 * We take the free feeds and use it for the deck to let everyone access every camera
 * that is available everywhere all at once. When they click, if it's available publicly,
 * we have it. It auto-maps and auto-opens when AI detects conflict or news in related areas.
 * And we can record it all in the cinematics for replayability and accountability."
 * 
 * THE SURVEILLANCE STATE TURNED INSIDE OUT.
 * What they built to watch us... we build to watch THEM watch us.
 */

class AccountabilityEngine {
  constructor(viewer, hud) {
    this.viewer = viewer;
    this.hud = hud;
    this.cameras = new Map(); // id -> camera data
    this.activeFeeds = new Map(); // id -> active video element
    this.recordings = new Map(); // id -> recording state
    this.recordingDir = 'E:/god folder/recordings/'; // TODO: make configurable
    this.ffmpegPath = 'ffmpeg'; // assumes ffmpeg in PATH
    
    // Public camera sources - organized by type and region
    this.cameraSources = {
      // Webcam directories (these aggregate public webcams)
      directories: [
        { name: 'EarthCam', baseUrl: 'https://www.earthcam.com', searchPattern: '/api/cams.php' },
        { name: 'WebcamTravel', baseUrl: 'https://www.webcamtravel.com', searchPattern: '/api' },
        { name: 'Opentopia', baseUrl: 'http://www.opentopia.com', searchPattern: '/webcams' },
        { name: 'Insecam', baseUrl: 'http://www.insecam.org', searchPattern: '/en' },
      ],
      
      // YouTube Live Stream sources (public events, traffic, tourist cams)
      youtubeChannels: [
        // UK
        { channelId: 'UCK1mLh8O给了nL_4R0JlZq7w', name: 'London Live', city: 'London', lat: 51.508, lon: -0.128 },
        { channelId: 'UCY2tFP2leJ9xVTqO0qJ6KxQ', name: 'Edinburgh Camera', city: 'Edinburgh', lat: 55.949, lon: -3.200 },
        // USA
        { channelId: 'UChpDFH9cL46_7DsWIp7SUZQ', name: 'NYC Live', city: 'New York', lat: 40.758, lon: -73.985 },
        { channelId: 'UCaJ6Y6t8Y5bN8J8a_wJMRjg', name: 'LA Live', city: 'Los Angeles', lat: 34.052, lon: -118.244 },
        // Japan
        { channelId: 'UCPDXXX', name: 'Tokyo Live', city: 'Tokyo', lat: 35.676, lon: 139.650 },
        // France
        { channelId: 'UC3PJQKBxX9N8t4_9G8J-W8Q', name: 'Paris Live', city: 'Paris', lat: 48.857, lon: 2.295 },
        // Ukraine
        { channelId: 'UCzC5JeSyYzhhKMSWoO2B-xQ', name: 'Kyiv Live', city: 'Kyiv', lat: 50.450, lon: 30.524 },
      ],
      
      // Traffic camera APIs (public DOT feeds)
      trafficCams: {
        'uk': [
          { name: 'M25 Traffic', url: 'https://api.serrafael.com/HighwaysEngland/CCTV', region: 'UK' },
          { name: 'TfL Cameras', url: 'https://api.tfl.gov.uk/Place/Neighbourhood', region: 'London' },
        ],
        'usa': [
          { name: '511 Traffic', url: 'https://api.511.org/occ/cameras', region: 'California' },
          { name: 'NYC DOT', url: 'https://data.cityofnewyork.us/api/views', region: 'New York' },
        ],
        'europe': [
          { name: 'Amsterdam Traffic', url: 'https://data.amsterdam.nl', region: 'Amsterdam' },
          { name: 'Berlin Traffic', url: 'https://daten.berlin.de', region: 'Berlin' },
        ]
      },
      
      // Known public streaming locations (tourist cams, wildlife, etc)
      knownLocations: {
        'UK': [
          { name: 'London - Trafalgar Square', lat: 51.508, lon: -0.128, url: 'https://www.youtube.com/watch?v=2Bk1E9I9Wd8', type: 'youtube' },
          { name: 'London - Tower Bridge', lat: 51.505, lon: -0.075, url: 'https://www.youtube.com/watch?v=AY2QXXFK8U0', type: 'youtube' },
          { name: 'Edinburgh - Castle', lat: 55.949, lon: -3.200, url: null, type: 'placeholder' },
          { name: 'Bristol', lat: 51.455, lon: -2.585, url: null, type: 'placeholder' },
          { name: 'Manchester', lat: 53.481, lon: -2.237, url: null, type: 'placeholder' },
          { name: 'Liverpool', lat: 53.408, lon: -2.991, url: null, type: 'placeholder' },
          { name: 'Birmingham', lat: 52.486, lon: -1.889, url: null, type: 'placeholder' },
        ],
        'USA': [
          { name: 'NYC - Times Square', lat: 40.758, lon: -73.985, url: 'https://www.youtube.com/watch?v=BagJjl3Gt9I', type: 'youtube' },
          { name: 'NYC - Statue of Liberty', lat: 40.689, lon: -74.045, url: null, type: 'placeholder' },
          { name: 'Las Vegas Strip', lat: 36.114, lon: -115.173, url: 'https://www.youtube.com/watch?v=0f5U4Vw1Rvc', type: 'youtube' },
          { name: 'San Francisco - Bay', lat: 37.819, lon: -122.478, url: null, type: 'placeholder' },
          { name: 'Miami Beach', lat: 25.790, lon: -80.130, url: null, type: 'placeholder' },
          { name: 'Seattle - Space Needle', lat: 47.620, lon: -122.349, url: null, type: 'placeholder' },
          { name: 'Chicago - Lakefront', lat: 41.882, lon: -87.623, url: null, type: 'placeholder' },
          { name: 'New Orleans - French Quarter', lat: 29.958, lon: -90.065, url: null, type: 'placeholder' },
        ],
        'UKRAINE': [
          { name: 'Kyiv - Independence Square', lat: 50.450, lon: 30.524, url: null, type: 'placeholder' },
          { name: 'Kyiv - Rohna', lat: 50.509, lon: 30.787, url: null, type: 'placeholder' },
          { name: 'Odesa - Port', lat: 46.485, lon: 30.710, url: null, type: 'placeholder' },
          { name: 'Lviv - Rynna Square', lat: 49.840, lon: 24.032, url: null, type: 'placeholder' },
          { name: 'Kharkiv - Freedom Square', lat: 50.006, lon: 36.230, url: null, type: 'placeholder' },
        ],
        'RUSSIA': [
          { name: 'Moscow - Red Square', lat: 55.754, lon: 37.620, url: null, type: 'placeholder' },
          { name: 'St. Petersburg', lat: 59.931, lon: 30.360, url: null, type: 'placeholder' },
          { name: 'Vladivostok', lat: 43.134, lon: 131.911, url: null, type: 'placeholder' },
        ],
        'CHINA': [
          { name: 'Beijing - Tiananmen', lat: 39.904, lon: 116.391, url: null, type: 'placeholder' },
          { name: 'Shanghai - Bund', lat: 31.239, lon: 121.491, url: null, type: 'placeholder' },
          { name: 'Hong Kong - Victoria Harbour', lat: 22.285, lon: 114.158, url: 'https://www.youtube.com/watch?v=Ryyqx1E9T4w', type: 'youtube' },
          { name: 'Shenzhen', lat: 22.543, lon: 114.063, url: null, type: 'placeholder' },
        ],
        'TAIWAN': [
          { name: 'Taipei - 101', lat: 25.034, lon: 121.564, url: null, type: 'placeholder' },
          { name: 'Keelung', lat: 25.128, lon: 121.742, url: null, type: 'placeholder' },
          { name: 'Kaohsiung', lat: 22.627, lon: 120.301, url: null, type: 'placeholder' },
        ],
        'JAPAN': [
          { name: 'Tokyo - Shibuya Crossing', lat: 35.659, lon: 139.700, url: null, type: 'placeholder' },
          { name: 'Tokyo - Tower', lat: 35.658, lon: 139.745, url: null, type: 'placeholder' },
          { name: 'Osaka - Dotonbori', lat: 34.669, lon: 135.500, url: null, type: 'placeholder' },
          { name: 'Mt. Fuji', lat: 35.361, lon: 138.727, url: null, type: 'placeholder' },
          { name: 'Kyoto - Fushimi Inari', lat: 34.967, lon: 135.773, url: null, type: 'placeholder' },
          { name: 'Nagasaki', lat: 32.744, lon: 129.874, url: null, type: 'placeholder' },
        ],
        'MIDDLE_EAST': [
          { name: 'Dubai - Burj Khalifa', lat: 25.197, lon: 55.274, url: null, type: 'placeholder' },
          { name: 'Dubai - Marina', lat: 25.078, lon: 55.137, url: null, type: 'placeholder' },
          { name: 'Tel Aviv', lat: 32.085, lon: 34.782, url: null, type: 'placeholder' },
          { name: 'Istanbul - Hagia Sophia', lat: 41.009, lon: 28.979, url: null, type: 'placeholder' },
        ],
        'EUROPE': [
          { name: 'Paris - Eiffel Tower', lat: 48.858, lon: 2.294, url: 'https://www.youtube.com/watch?v=1UBarNv0Yw4', type: 'youtube' },
          { name: 'Paris - Champs-Elysees', lat: 48.870, lon: 2.308, url: null, type: 'placeholder' },
          { name: 'Rome - Colosseum', lat: 41.890, lon: 12.492, url: null, type: 'placeholder' },
          { name: 'Venice - Grand Canal', lat: 45.440, lon: 12.315, url: null, type: 'placeholder' },
          { name: 'Berlin - Brandenburg Gate', lat: 52.516, lon: 13.378, url: null, type: 'placeholder' },
          { name: 'Amsterdam - Dam Square', lat: 52.373, lon: 4.893, url: null, type: 'placeholder' },
          { name: 'Barcelona - Sagrada Familia', lat: 41.403, lon: 2.174, url: null, type: 'placeholder' },
          { name: 'Prague - Old Town', lat: 50.087, lon: 14.421, url: null, type: 'placeholder' },
          { name: 'Vienna', lat: 48.208, lon: 16.374, url: null, type: 'placeholder' },
          { name: 'Athens - Acropolis', lat: 37.971, lon: 23.726, url: null, type: 'placeholder' },
        ],
        'ASIA_PACIFIC': [
          { name: 'Sydney - Opera House', lat: -33.856, lon: 151.215, url: 'https://www.youtube.com/watch?v=yP4qTttrjJ0', type: 'youtube' },
          { name: 'Sydney - Harbour Bridge', lat: -33.852, lon: 151.211, url: null, type: 'placeholder' },
          { name: 'Melbourne', lat: -37.813, lon: 144.963, url: null, type: 'placeholder' },
          { name: 'Singapore - Marina Bay', lat: 1.283, lon: 103.859, url: null, type: 'placeholder' },
          { name: 'Seoul - Gyeongbokgung', lat: 37.579, lon: 126.977, url: null, type: 'placeholder' },
          { name: 'Bangkok - Grand Palace', lat: 13.750, lon: 100.491, url: null, type: 'placeholder' },
          { name: 'Mumbai - Gateway', lat: 18.922, lon: 72.835, url: null, type: 'placeholder' },
        ],
        'AFRICA': [
          { name: 'Cairo - Pyramids', lat: 29.979, lon: 31.134, url: null, type: 'placeholder' },
          { name: 'Cape Town - Table Mountain', lat: -33.963, lon: 18.410, url: null, type: 'placeholder' },
          { name: 'Nairobi', lat: -1.292, lon: 36.822, url: null, type: 'placeholder' },
          { name: 'Lagos', lat: 6.524, lon: 3.379, url: null, type: 'placeholder' },
        ],
        'SOUTH_AMERICA': [
          { name: 'Rio - Copacabana', lat: -22.971, lon: -43.182, url: null, type: 'placeholder' },
          { name: 'Rio - Christ Redeemer', lat: -22.952, lon: -43.210, url: null, type: 'placeholder' },
          { name: 'Buenos Aires', lat: -34.604, lon: -58.382, url: null, type: 'placeholder' },
          { name: 'Lima - Plaza Mayor', lat: -12.046, lon: -77.043, url: null, type: 'placeholder' },
          { name: 'Bogota', lat: 4.711, lon: -74.072, url: null, type: 'placeholder' },
        ],
      }
    };
    
    // Initialize
    this._loadCameras();
    this._createOverlay();
    this._bindEvents();
    
    console.log('[GOTHAM ACCOUNTABILITY] Engine Online — Every public camera, everyone\'s eyes');
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CAMERA LOADING & DISCOVERY
  // ─────────────────────────────────────────────────────────────────────────
  
  async _loadCameras() {
    // Load all known locations
    for (const [region, cameras] of Object.entries(this.cameraSources.knownLocations)) {
      cameras.forEach((cam, idx) => {
        const id = `cam-${region.toLowerCase().replace(' ', '_')}-${idx}`;
        this.cameras.set(id, {
          id,
          name: cam.name,
          lat: cam.lat,
          lon: cam.lon,
          url: cam.url,
          type: cam.type, // 'youtube', 'placeholder', 'rtsp', 'hls'
          region,
          status: cam.url ? 'available' : 'pending',
          lastChecked: null,
        });
      });
    }
    
    // Add YouTube channel cameras
    this.cameraSources.youtubeChannels.forEach((ch, idx) => {
      const id = `cam-youtube-${idx}`;
      this.cameras.set(id, {
        id,
        name: ch.name,
        lat: ch.lat,
        lon: ch.lon,
        url: ch.url || `https://www.youtube.com/channel/${ch.channelId}/live`,
        type: 'youtube',
        region: ch.city,
        status: 'available',
        lastChecked: null,
      });
    });
    
    console.log(`[ACCOUNTABILITY] Loaded ${this.cameras.size} cameras`);
  }
  
  async discoverCameras() {
    // Scrape public camera directories
    const discovered = [];
    
    // TODO: Implement scrapers for:
    // - insecam.org (unsecured IP cameras)
    // - opentopia.com (webcam directory)
    // - webcamtravel.com (travel webcams)
    // - EarthCam network
    
    // For now, use known locations
    return discovered;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // GLOBE ENTITIES
  // ─────────────────────────────────────────────────────────────────────────
  
  showCamerasOnGlobe() {
    this.cameras.forEach((cam, id) => {
      if (cam.type === 'placeholder') {
        // Show as hollow circle - camera exists but no feed
        this.viewer.entities.add({
          id: `accountability-${id}`,
          position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 0),
          point: {
            pixelSize: 12,
            color: Cesium.Color.YELLOW.withAlpha(0.5),
            outlineColor: Cesium.Color.YELLOW,
            outlineWidth: 2,
          },
          label: {
            text: cam.name,
            font: '12px sans-serif',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10),
            show: false, // show on hover
          },
          description: `Camera: ${cam.name}<br>Region: ${cam.region}<br>Status: ${cam.status}<br>Type: ${cam.type}`,
        });
      } else {
        // Show as solid dot - live feed available
        this.viewer.entities.add({
          id: `accountability-${id}`,
          position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 0),
          point: {
            pixelSize: 15,
            color: Cesium.Color.LIME,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: cam.name,
            font: '12px sans-serif',
            fillColor: Cesium.Color.LIME,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10),
            show: false,
          },
          description: `LIVE: ${cam.name}<br>Region: ${cam.region}<br>Type: ${cam.type}<br><button onclick="window.gothamAccountability?.openFeed('${id}')">WATCH</button>`,
        });
      }
    });
    
    console.log(`[ACCOUNTABILITY] ${this.cameras.size} cameras added to globe`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // FEED PLAYBACK
  // ─────────────────────────────────────────────────────────────────────────
  
  async openFeed(cameraId) {
    const cam = this.cameras.get(cameraId);
    if (!cam) return;
    
    if (cam.type === 'placeholder') {
      this._sysLog(`NO FEED: ${cam.name} - not publicly available`);
      return;
    }
    
    // Create video element
    const video = document.createElement('video');
    video.id = `feed-${cameraId}`;
    video.autoplay = true;
    video.playsinline = true;
    video.muted = true; // must be muted for autoplay
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;';
    
    if (cam.type === 'youtube') {
      // Use YouTube IFrame API
      this._openYouTubeFeed(cameraId, cam);
    } else {
      // Direct stream (HLS, RTSP, etc)
      video.src = cam.url;
      video.onerror = () => {
        this._sysLog(`FEED ERROR: ${cam.name}`);
      };
    }
    
    this.activeFeeds.set(cameraId, video);
    this._showFeedOverlay(cam);
    this._sysLog(`FEED ACTIVE: ${cam.name}`);
  }
  
  _openYouTubeFeed(cameraId, cam) {
    // Create iframe for YouTube live
    const container = document.getElementById(`accountability-overlay`);
    if (!container) return;
    
    // Extract video ID from URL or use channel live
    let videoId = '';
    if (cam.url.includes('watch?v=')) {
      videoId = cam.url.split('watch?v=')[1].split('&')[0];
    } else if (cam.url.includes('youtube.com/channel/')) {
      // For channel live, we'd need to fetch the live video ID
      // For now, use known live stream IDs
      videoId = this._getYouTubeLiveId(cam.url);
    }
    
    if (!videoId) {
      this._sysLog(`YOUTUBE ERROR: Could not get live ID for ${cam.name}`);
      return;
    }
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
    iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    
    // Replace overlay content
    const content = container.querySelector('.feed-content');
    if (content) {
      content.innerHTML = '';
      content.appendChild(iframe);
    }
  }
  
  _getYouTubeLiveId(channelUrl) {
    // Known YouTube live stream IDs for public cameras
    const knownLiveIds = {
      'London Live': '2Bk1E9I9Wd8',
      'NYC Live': 'BagJjl3Gt9I',
      'Las Vegas Strip': '0f5U4Vw1Rvc',
      'Paris - Eiffel Tower': '1UBarNv0Yw4',
      'Sydney Opera House': 'yP4qTttrjJ0',
    };
    
    const cam = this.cameras.get(channelUrl);
    if (cam && knownLiveIds[cam.name]) {
      return knownLiveIds[cam.name];
    }
    
    // TODO: YouTube Data API call to get live stream ID from channel
    return null;
  }
  
  closeFeed(cameraId) {
    const video = this.activeFeeds.get(cameraId);
    if (video) {
      video.pause();
      video.src = '';
      video.remove();
      this.activeFeeds.delete(cameraId);
    }
    
    const overlay = document.getElementById('accountability-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    this._sysLog(`FEED CLOSED`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // AI-TRIGGERED ACTIVATION
  // ─────────────────────────────────────────────────────────────────────────
  
  activateForRegion(region) {
    // When AI detects conflict/news in a region, activate relevant cameras
    const regionCams = Array.from(this.cameras.values()).filter(c => c.region === region);
    
    if (regionCams.length === 0) {
      this._sysLog(`NO CAMERAS: ${region}`);
      return;
    }
    
    // Open first available camera in region
    const available = regionCams.find(c => c.type !== 'placeholder');
    if (available) {
      this.openFeed(available.id);
      this._speak(`Activating cameras in ${region}`);
    } else {
      this._sysLog(`NO LIVE FEEDS: ${region} cameras pending`);
    }
    
    // Highlight all region cameras on globe
    regionCams.forEach(cam => {
      const entity = this.viewer.entities.getById(`accountability-${cam.id}`);
      if (entity) {
        entity.point.color = Cesium.Color.RED;
        entity.point.pixelSize = 20;
      }
    });
  }
  
  deactivateForRegion(region) {
    // When leaving region, close feeds and reset colors
    const regionCams = Array.from(this.cameras.values()).filter(c => c.region === region);
    
    regionCams.forEach(cam => {
      const entity = this.viewer.entities.getById(`accountability-${cam.id}`);
      if (entity) {
        entity.point.color = cam.type === 'placeholder' ? Cesium.Color.YELLOW.withAlpha(0.5) : Cesium.Color.LIME;
        entity.point.pixelSize = cam.type === 'placeholder' ? 12 : 15;
      }
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  
  async startRecording(cameraId) {
    const cam = this.cameras.get(cameraId);
    if (!cam || cam.type === 'placeholder') {
      this._sysLog(`CANNOT RECORD: ${cam?.name || 'Unknown'} - no feed available`);
      return false;
    }
    
    if (this.recordings.has(cameraId)) {
      this._sysLog(`ALREADY RECORDING: ${cam.name}`);
      return false;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${cam.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.mp4`;
    
    // For YouTube feeds, we'd need to capture the iframe
    // This is a simplified version - full implementation would use:
    // - puppeteer/playwright to capture iframe
    // - or ffmpeg with screen capture
    // - or a proxy server to capture the stream
    
    this.recordings.set(cameraId, {
      filename,
      startTime: Date.now(),
      status: 'recording',
    });
    
    this._sysLog(`RECORDING: ${cam.name} → ${filename}`);
    this._speak(`Recording started: ${cam.name}`);
    
    return true;
  }
  
  stopRecording(cameraId) {
    const recording = this.recordings.get(cameraId);
    if (!recording) return null;
    
    const duration = Date.now() - recording.startTime;
    const cam = this.cameras.get(cameraId);
    
    this.recordings.delete(cameraId);
    this._sysLog(`RECORDING STOPPED: ${cam.name} (${Math.round(duration/1000)}s)`);
    this._speak(`Recording stopped: ${cam.name}`);
    
    return {
      filename: recording.filename,
      duration,
      camera: cam.name,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // OVERLAY UI
  // ─────────────────────────────────────────────────────────────────────────
  
  _createOverlay() {
    // Create main accountability overlay container
    const overlay = document.createElement('div');
    overlay.id = 'accountability-overlay';
    overlay.innerHTML = `
      <div class="accountability-header">
        <span class="title">📹 ACCOUNTABILITY FEED</span>
        <div class="controls">
          <button class="rec-btn" onclick="window.gothamAccountability?.toggleRecording()">⏺ REC</button>
          <button class="close-btn" onclick="window.gothamAccountability?.closeActiveFeed()">✕</button>
        </div>
      </div>
      <div class="feed-content">
        <div class="placeholder">
          <div class="icon">📷</div>
          <div class="text">Select a camera on the globe or from the list</div>
          <div class="subtext">Click any camera marker to activate its feed</div>
        </div>
      </div>
      <div class="camera-list" id="cam-list"></div>
    `;
    
    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = `
      #accountability-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 480px;
        height: 360px;
        background: rgba(0,0,0,0.95);
        border: 2px solid rgba(0,240,255,0.5);
        border-radius: 12px;
        z-index: 9999;
        display: none;
        flex-direction: column;
        font-family: 'Courier New', monospace;
        overflow: hidden;
      }
      #accountability-overlay.active { display: flex; }
      .accountability-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0,240,255,0.1);
        border-bottom: 1px solid rgba(0,240,255,0.3);
      }
      .accountability-header .title {
        color: #00f0ff;
        font-size: 12px;
        font-weight: bold;
        letter-spacing: 1px;
      }
      .accountability-header .controls { display: flex; gap: 8px; }
      .accountability-header button {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.3);
        color: #fff;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
      }
      .accountability-header button:hover { background: rgba(255,255,255,0.2); }
      .accountability-header .rec-btn.recording {
        background: rgba(255,0,0,0.5);
        border-color: #f00;
        animation: pulse 1s infinite;
      }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      .feed-content {
        flex: 1;
        position: relative;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .feed-content .placeholder {
        text-align: center;
        color: rgba(255,255,255,0.5);
      }
      .feed-content .placeholder .icon { font-size: 48px; margin-bottom: 8px; }
      .feed-content .placeholder .text { font-size: 14px; }
      .feed-content .placeholder .subtext { font-size: 11px; margin-top: 4px; opacity: 0.7; }
      .camera-list {
        max-height: 120px;
        overflow-y: auto;
        padding: 8px;
        background: rgba(0,0,0,0.5);
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px;
      }
      .camera-list-item {
        padding: 6px 8px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px;
        font-size: 10px;
        cursor: pointer;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .camera-list-item:hover { background: rgba(0,240,255,0.2); border-color: #00f0ff; }
      .camera-list-item .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0f0;
      }
      .camera-list-item .dot.pending { background: #ff0; }
      .camera-list-item .dot.offline { background: #666; }
    `;
    
    document.head.appendChild(styles);
    document.body.appendChild(overlay);
    
    // Populate camera list
    this._updateCameraList();
  }
  
  _showFeedOverlay(cam) {
    const overlay = document.getElementById('accountability-overlay');
    if (!overlay) return;
    
    overlay.classList.add('active');
    
    // Update header with camera name
    const title = overlay.querySelector('.title');
    if (title) title.textContent = `📹 ${cam.name}`;
    
    // Clear feed content
    const content = overlay.querySelector('.feed-content');
    if (content) {
      content.innerHTML = `<div class="placeholder"><div class="icon">📹</div><div class="text">Loading ${cam.name}...</div></div>`;
    }
  }
  
  _updateCameraList() {
    const list = document.getElementById('cam-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    this.cameras.forEach((cam, id) => {
      const item = document.createElement('div');
      item.className = 'camera-list-item';
      item.onclick = () => this.openFeed(id);
      
      const dotClass = cam.type === 'placeholder' ? 'pending' : 'dot';
      const dot = cam.type === 'placeholder' ? 'pending' : '';
      
      item.innerHTML = `
        <span class="dot ${dot}"></span>
        <span>${cam.name}</span>
      `;
      
      list.appendChild(item);
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING CONTROLS
  // ─────────────────────────────────────────────────────────────────────────
  
  toggleRecording() {
    const activeId = Array.from(this.activeFeeds.keys())[0];
    if (!activeId) {
      this._sysLog('NO FEED TO RECORD');
      return;
    }
    
    if (this.recordings.has(activeId)) {
      this.stopRecording(activeId);
      document.querySelector('.rec-btn')?.classList.remove('recording');
    } else {
      this.startRecording(activeId);
      document.querySelector('.rec-btn')?.classList.add('recording');
    }
  }
  
  closeActiveFeed() {
    const activeId = Array.from(this.activeFeeds.keys())[0];
    if (activeId) this.closeFeed(activeId);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENT BINDINGS
  // ─────────────────────────────────────────────────────────────────────────
  
  _bindEvents() {
    // Bind to country intel orchestrator if exists
    if (window.gothamCountryIntel) {
      // Country enter → activate cameras
      const originalCheck = window.gothamCountryIntel._checkCountry.bind(window.gothamCountryIntel);
      window.gothamCountryIntel._checkCountry = () => {
        originalCheck();
        const country = window.gothamCountryIntel.currentCountry;
        if (country) {
          this.activateForRegion(country);
        }
      };
    }
    
    // Bind to globe click handler for camera selection
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = this.viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && String(picked.id.id).startsWith('accountability-')) {
        const cameraId = picked.id.id.replace('accountability-', '');
        this.openFeed(cameraId);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    console.log('[ACCOUNTABILITY] Events bound');
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  
  _sysLog(msg) {
    console.log(`[ACCOUNTABILITY] ${msg}`);
    if (this.hud?._sysLog) this.hud._sysLog(msg);
  }
  
  _speak(msg) {
    if (window.gothamTTS) window.gothamTTS.speak(msg);
    else if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(msg);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  }
  
  // Get all cameras
  getCameras() {
    return Array.from(this.cameras.values());
  }
  
  // Get cameras by region
  getCamerasByRegion(region) {
    return Array.from(this.cameras.values()).filter(c => c.region === region);
  }
  
  // Get recording status
  isRecording(cameraId) {
    return this.recordings.has(cameraId);
  }
  
  // Get all recordings
  getRecordings() {
    return Array.from(this.recordings.entries()).map(([id, rec]) => ({
      cameraId: id,
      ...rec
    }));
  }
}

// Export for global access
window.accountabilityEngine = accountabilityEngine;
