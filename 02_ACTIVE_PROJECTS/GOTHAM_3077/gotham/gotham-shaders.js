/**
 * GOTHAM 3077 - Visual Mode System v39.0
 * v39.0 - PERFORMANCE OPTIMIZATION PATCH
 * - Added visibility-aware shader updates
 * - Optimized uniform callbacks with caching
 * - Added proper cleanup method
 * - Throttled clock for inactive tabs
 */

class GothamShaders {
  constructor (viewer) {
    this.viewer = viewer
    this.activeMode = 'normal'
    this.stages = {}
    this.time = 0
    this.settings = {
      intensity: 0.6,
      scanlines: 0.12,
      curvature: 0.25,
      noise: 0.15,
      pixelation: 0,
      chroma: 0.003,
      grain: 0.1,
      glitch: 0,
      exposure: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      bloomIntensity: 0.4,
      vignetteIntensity: 0.6,
      sharpenAmount: 0.5
    }

    // Performance tracking
    this._isDestroyed = false
    this._lastFrameTime = 0
    this._frameSkip = 0
    this._visibilityHandler = null
    this._animationId = null
    this._isVisible = true

    // Uniform cache to prevent GC pressure
    this._uniformCache = {}

    this._createAllStages()
    this._startClock()
    this._setupVisibilityHandler()
    console.log('[GOTHAM] Shaders v39.0 - Performance Optimized')
  }

  destroy() {
    if (this._isDestroyed) return
    this._isDestroyed = true

    console.log('[GOTHAM] Shaders destroying...')

    // Stop animation frame
    if (this._animationId) {
      cancelAnimationFrame(this._animationId)
    }

    // Remove visibility handler
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler)
    }

    // Remove all post process stages
    const ps = this.viewer.scene.postProcessStages
    Object.keys(this.stages).forEach(key => {
      const stage = this.stages[key]
      if (stage) {
        ps.remove(stage)
        // Note: Cesium doesn't have a destroy method for PostProcessStage
      }
    })

    this.stages = {}
    console.log('[GOTHAM] Shaders destroyed')
  }

  _setupVisibilityHandler() {
    this._visibilityHandler = () => {
      this._isVisible = !document.hidden
      if (!this._isVisible) {
        // Pause expensive operations when tab is hidden
        console.log('[GOTHAM] Tab hidden - pausing shader updates')
      }
    }
    document.addEventListener('visibilitychange', this._visibilityHandler)
  }

  _createAllStages () {
    var v = this.viewer
    var ps = v.scene.postProcessStages

    // 1. Unified Uniforms for the Master Pipeline - with caching
    const self = this
    const masterUniforms = {
      u_time: () => self.time,
      u_intensity: () => self.settings.intensity,
      u_exposure: () => self.settings.exposure,
      u_contrast: () => self.settings.contrast,
      u_saturation: () => self.settings.saturation,
      u_vignette: () => self.settings.vignetteIntensity,
      u_noise: () => self.settings.noise,
      u_grain: () => self.settings.grain,
      u_glitch: () => self.settings.glitch,
      u_chroma: () => self.settings.chroma,
      u_sharpen: () => self.settings.sharpenAmount
    };

    // 2. Mode-Specific Stages (Disabled by default)
    const modeUniforms = {
      u_time: () => self.time,
      u_intensity: () => self.settings.intensity,
      u_curvature: () => self.settings.curvature,
      u_scanlines: () => self.settings.scanlines,
      u_pixelation: () => self.settings.pixelation
    };

    // Create all shader stages
    const stageConfigs = [
      ['crt', this._crtShader()],
      ['nvg', this._nvgShader()],
      ['flir', this._flirShader()],
      ['anime', this._animeShader()],
      ['pixelart', this._pixelartShader()],
      ['matrix', this._matrixShader()],
      ['edges', this._edgesShader()],
      ['drone', this._droneShader()],
      ['thermal_hq', this._thermalHQShader()],
      ['xray', this._xrayShader()],
      ['blueprint', this._blueprintShader()],
      ['amber', this._amberShader()],
      ['holo', this._holoShader()],
      ['glitchart', this._glitchartShader()],
      ['depth', this._depthShader()]
    ];

    stageConfigs.forEach(([name, shader]) => {
      this.stages[name] = ps.add(new Cesium.PostProcessStage({
        name: `g_mode_${name}`,
        fragmentShader: shader,
        uniforms: modeUniforms
      }));
    });

    Object.keys(this.stages).forEach(k => this.stages[k].enabled = false);
    console.log('[GOTHAM] PostProcess stages created:', Object.keys(this.stages).join(', '), '| Total:', Object.keys(this.stages).length);

    // 3. MASTER OPTICAL SUITE (Always Enabled)
    this.stages.master = ps.add(new Cesium.PostProcessStage({
      name: 'g_master_suite',
      fragmentShader: this._masterShader(),
      uniforms: masterUniforms
    }));
    this.stages.master.enabled = true;

    // 4. BLOOM (Always Enabled)
    this.stages.bloom = ps.add(new Cesium.PostProcessStage({
      name: 'g_bloom_suite',
      fragmentShader: this._bloomShader(),
      uniforms: { u_bloomIntensity: () => self.settings.bloomIntensity }
    }));
    this.stages.bloom.enabled = true;
  }

  setMode (mode) {
    // Disable all mode stages efficiently
    Object.keys(this.stages).forEach(k => {
      if(k !== 'master' && k !== 'bloom' && this.stages[k]) {
        this.stages[k].enabled = false
      }
    });
    
    this.activeMode = mode;
    
    if (this.stages[mode]) {
      this.stages[mode].enabled = true;
      console.log('[GOTHAM] MODE ACTIVE:', mode.toUpperCase());
    } else if (mode !== 'normal') {
      console.error('[GOTHAM] MODE NOT FOUND:', mode, '| Available:', Object.keys(this.stages).join(', '));
    }
  }

  setSetting (k, v) { 
    this.settings[k] = v; 
  }

  _startClock () {
    var self = this;
    let lastTime = performance.now();
    
    function tick () { 
      if (self._isDestroyed) return;
      
      // Skip frames when tab is hidden or under heavy load
      if (!self._isVisible) {
        self._animationId = requestAnimationFrame(tick);
        return;
      }
      
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      
      // Cap delta to prevent jumps after tab activation
      const cappedDelta = Math.min(delta, 0.1);
      
      self.time += cappedDelta; 
      self._animationId = requestAnimationFrame(tick); 
    }
    
    this._animationId = requestAnimationFrame(tick);
  }

  // --- GLSL KERNELS ---

  _masterShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_exposure;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_vignette;
      uniform float u_noise;
      uniform float u_grain;
      uniform float u_glitch;
      uniform float u_chroma;
      uniform float u_sharpen;
      uniform float u_intensity;

      float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        vec2 uv = v_textureCoordinates;
        
        // 1. Real-time Glitch Shift
        if (u_glitch > 0.0) {
          float gTime = floor(u_time * 10.0);
          if (rand(vec2(gTime, 1.0)) > (1.0 - u_glitch * 0.15)) {
            uv.x += (rand(vec2(uv.y, gTime)) - 0.5) * 0.08 * u_glitch;
          }
        }

        // 2. Chromatic Aberration
        float ab = u_chroma * u_intensity;
        vec3 col = vec3(
          texture(colorTexture, uv + vec2(ab, 0.0)).r,
          texture(colorTexture, uv).g,
          texture(colorTexture, uv - vec2(ab, 0.0)).b
        );

        // 3. Sharpen Filter
        if (u_sharpen > 0.0) {
          vec2 px = vec2(0.001, 0.001);
          vec3 blur = (
            texture(colorTexture, uv + vec2(px.x, 0.0)).rgb +
            texture(colorTexture, uv - vec2(px.x, 0.0)).rgb +
            texture(colorTexture, uv + vec2(0.0, px.y)).rgb +
            texture(colorTexture, uv - vec2(0.0, px.y)).rgb
          ) * 0.25;
          col = mix(col, col + (col - blur) * 0.5, u_sharpen);
        }

        // 4. Exposure & Contrast
        col *= u_exposure;
        col = (col - 0.5) * u_contrast + 0.5;

        // 5. Saturation
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(lum), col, u_saturation);

        // 6. Signal Noise & Grain
        float n = rand(uv + u_time) * (u_noise + u_grain) * 0.25;
        col += n;

        // 7. Vignette Falloff
        float d = distance(uv, vec2(0.5));
        col *= 1.0 - d * u_vignette * 2.0;

        out_FragColor = vec4(col, 1.0);
      }
    `;
  }

  _crtShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_intensity;

      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c = uv - 0.5;
        float d = dot(c, c);
        uv = uv + c * d * u_curvature;

        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { out_FragColor = vec4(0,0,0,1); return; }
        vec3 col = texture(colorTexture, uv).rgb;
        col *= vec3(0.8, 1.1, 0.7);
        col -= sin(uv.y * 1000.0) * u_scanlines * 0.5 * u_intensity;
        out_FragColor = vec4(col, 1.0);
      }
    `;
  }

  _nvgShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_intensity;
      
      void main() {
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        lum = pow(lum, 0.6) * 1.5;
        vec3 nvg = vec3(lum * 0.1, lum * 1.0, lum * 0.2);
        nvg *= 0.9 + 0.1 * sin(v_textureCoordinates.y * 600.0);
        out_FragColor = vec4(mix(col, nvg, u_intensity), 1.0);
      }
    `;
  }

  _flirShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_intensity;
      
      vec3 thermal(float t) {
        if (t < 0.3) return mix(vec3(0,0,0.5), vec3(0,0.8,0.2), t/0.3);
        if (t < 0.7) return mix(vec3(0,0.8,0.2), vec3(1,0.8,0), (t-0.3)/0.4);
        return mix(vec3(1,0.8,0), vec3(1,1,1), (t-0.7)/0.3);
      }
      
      void main() {
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        float temp = dot(col, vec3(0.3, 0.59, 0.11));
        vec3 flir = thermal(clamp(temp, 0.0, 1.0));
        out_FragColor = vec4(mix(col, flir, u_intensity), 1.0);
      }
    `;
  }

  _matrixShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      
      float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec3 col = texture(colorTexture, uv).rgb;
        float lum = dot(col, vec3(0.3, 0.59, 0.11));
        vec3 matrix = vec3(0.1, 0.9, 0.2) * lum;
        float rain = sin(uv.y * 40.0 + u_time * 5.0 + rand(vec2(floor(uv.x*80.0)))*10.0) * 0.5 + 0.5;
        matrix += vec3(0.1, 0.8, 0.2) * rain * 0.3;
        out_FragColor = vec4(mix(col, matrix, u_intensity), 1.0);
      }
    `;
  }

  _animeShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_intensity;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec3 col = texture(colorTexture, uv).rgb;
        float steps = 5.0 - (u_intensity * 3.0);
        vec3 anime = floor(col * steps) / steps;
        float px = 1.0 / 1024.0;
        float edge = length(texture(colorTexture, uv+px).rgb - texture(colorTexture, uv-px).rgb);
        if (edge > 0.2 * (1.1 - u_intensity)) anime *= 0.0;
        out_FragColor = vec4(mix(col, anime, u_intensity), 1.0);
      }
    `;
  }

  _pixelartShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_pixelation;
      uniform float u_intensity;
      
      void main() {
        vec2 uvOrig = v_textureCoordinates;
        float p = 4.0 + u_pixelation * 30.0;
        vec2 uv = floor(uvOrig * (1024.0/p)) * (p/1024.0);
        vec3 col = texture(colorTexture, uvOrig).rgb;
        vec3 pixel = texture(colorTexture, uv).rgb;
        pixel = floor(pixel * 8.0) / 8.0;
        out_FragColor = vec4(mix(col, pixel, u_intensity), 1.0);
      }
    `;
  }

  _edgesShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        float px = 1.0 / 1024.0;
        vec3 c = texture(colorTexture, uv).rgb;
        vec3 t = texture(colorTexture, uv + vec2(0,px)).rgb;
        vec3 r = texture(colorTexture, uv + vec2(px,0)).rgb;
        float edge = length(c-t) + length(c-r);
        vec3 edges = vec3(0, 0.8, 0.3) * edge * 10.0;
        float sweep = fract(u_time * 0.2);
        if (abs(distance(uv, vec2(0.5)) - sweep) < 0.01) edges += vec3(0,1,0.5) * 0.5;
        out_FragColor = vec4(mix(c, edges, u_intensity), 1.0);
      }
    `;
  }

  // --- v38.0 NEW TACTICAL MODES ---

  _droneShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      void main() {
        vec2 uvOrig = v_textureCoordinates;
        vec2 uv = uvOrig;
        vec2 c = uv - 0.5;
        float d = dot(c, c);
        uv = uv + c * d * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        vec3 col = texture(colorTexture, uvOrig).rgb;
        vec3 processed = texture(colorTexture, uv).rgb;
        vec3 drone = processed * vec3(0.9, 1.0, 0.9);
        float grid = step(0.98, fract(uv.x * 40.0)) + step(0.98, fract(uv.y * 25.0));
        drone += vec3(0.0, 0.5, 0.15) * grid * 0.2;
        float crossH = step(abs(uv.y - 0.5), 0.0015);
        float crossV = step(abs(uv.x - 0.5), 0.0015);
        drone += vec3(0.0, 0.8, 0.3) * (crossH + crossV) * 0.4;
        drone -= sin(uv.y * 800.0) * u_scanlines * 0.3;
        drone *= 0.92 + 0.08 * sin(u_time * 2.0);
        out_FragColor = vec4(mix(col, drone, u_intensity), 1.0);
      }
    `;
  }

  _thermalHQShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      vec3 thermalHQ(float t) {
        if (t < 0.15) return mix(vec3(0.0,0.0,0.1), vec3(0.0,0.0,0.6), t/0.15);
        if (t < 0.35) return mix(vec3(0.0,0.0,0.6), vec3(0.4,0.0,0.8), (t-0.15)/0.2);
        if (t < 0.5) return mix(vec3(0.4,0.0,0.8), vec3(0.8,0.0,0.4), (t-0.35)/0.15);
        if (t < 0.65) return mix(vec3(0.8,0.0,0.4), vec3(1.0,0.5,0.0), (t-0.5)/0.15);
        if (t < 0.85) return mix(vec3(1.0,0.5,0.0), vec3(1.0,0.9,0.0), (t-0.65)/0.2);
        return mix(vec3(1.0,0.9,0.0), vec3(1.0,1.0,1.0), (t-0.85)/0.15);
      }
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        vec3 processed = texture(colorTexture, uv).rgb;
        float temp = dot(processed, vec3(0.299, 0.587, 0.114));
        temp = pow(temp, 0.8);
        vec3 therm = thermalHQ(clamp(temp, 0.0, 1.0));
        therm -= sin(uv.y * 800.0) * u_scanlines * 0.25;
        therm += sin(u_time * 0.5) * 0.01;
        out_FragColor = vec4(mix(col, therm, u_intensity), 1.0);
      }
    `;
  }

  _xrayShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        vec3 processed = texture(colorTexture, uv).rgb;
        float lum = dot(processed, vec3(0.299, 0.587, 0.114));
        lum = 1.0 - pow(lum, 0.7);
        vec3 xray = vec3(lum * 0.6, lum * 0.8, lum * 1.4);
        xray += vec3(0.03, 0.05, 0.12);
        xray -= sin(uv.y * 600.0 + u_time * 2.0) * u_scanlines * 0.2;
        out_FragColor = vec4(mix(col, xray, u_intensity), 1.0);
      }
    `;
  }

  _blueprintShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        float px = 1.0 / 1024.0;
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        vec3 cc = texture(colorTexture, uv).rgb;
        vec3 ct = texture(colorTexture, uv + vec2(0, px)).rgb;
        vec3 cr = texture(colorTexture, uv + vec2(px, 0)).rgb;
        float edge = length(cc - ct) + length(cc - cr);
        float gridX = step(0.98, fract(uv.x * 50.0));
        float gridY = step(0.98, fract(uv.y * 30.0));
        float grid = max(gridX, gridY) * 0.2;
        vec3 bg = vec3(0.04, 0.08, 0.22);
        vec3 line = vec3(0.6, 0.85, 1.0);
        vec3 blueprint = bg + line * edge * 8.0 + vec3(0.15, 0.25, 0.5) * grid;
        blueprint -= sin(uv.y * 800.0) * u_scanlines * 0.2;
        out_FragColor = vec4(mix(col, blueprint, u_intensity), 1.0);
      }
    `;
  }

  _amberShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        vec3 processed = texture(colorTexture, uv).rgb;
        float lum = dot(processed, vec3(0.299, 0.587, 0.114));
        lum = pow(lum, 0.85) * 1.5;
        vec3 amber = vec3(lum * 1.2, lum * 0.85, lum * 0.3);
        amber -= sin(uv.y * 800.0 + u_time) * u_scanlines * 0.3;
        out_FragColor = vec4(mix(col, amber, u_intensity), 1.0);
      }
    `;
  }

  _holoShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        vec3 processed = texture(colorTexture, uv).rgb;
        float lum = dot(processed, vec3(0.299, 0.587, 0.114));
        vec3 holo = vec3(0.1, 0.5, 0.9) * lum * 1.5;
        holo += vec3(0.0, 0.25, 0.5) * sin(uv.y * 200.0 + u_time * 3.0) * 0.2;
        float scanline = sin(uv.y * 600.0 + u_time * 5.0) * 0.5 + 0.5;
        holo *= 0.8 + 0.2 * scanline;
        holo -= sin(uv.y * 800.0) * u_scanlines * 0.3;
        float flicker = rand(vec2(floor(u_time * 30.0))) > 0.93 ? 0.6 : 1.0;
        holo *= flicker;
        holo += vec3(0.0, 0.2, 0.4) * pow(1.0 - abs(uv.y - 0.5) * 2.0, 3.0) * 0.4;
        out_FragColor = vec4(mix(col, holo, u_intensity), 1.0);
      }
    `;
  }

  _glitchartShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        float t = floor(u_time * 8.0);
        float block = floor(uv.y * 20.0);
        if (rand(vec2(block, t)) > (1.0 - u_intensity * 0.5)) {
          uv.x += (rand(vec2(block, t + 1.0)) - 0.5) * 0.25 * u_intensity;
        }
        if (rand(vec2(t, 3.0)) > 0.8) {
          float band = step(0.0, sin(uv.y * 40.0 + t * 7.0)) * 0.5;
          uv.x += band * 0.06 * u_intensity;
        }
        vec3 col = vec3(
          texture(colorTexture, uv + vec2(0.006 * u_intensity, 0.0)).r,
          texture(colorTexture, uv).g,
          texture(colorTexture, uv - vec2(0.006 * u_intensity, 0.0)).b
        );
        col = floor(col * (4.0 + u_intensity * 4.0)) / (4.0 + u_intensity * 4.0);
        col -= sin(uv.y * 800.0) * u_scanlines * 0.3;
        if (rand(vec2(uv.y * 100.0, t)) > 0.95) col = vec3(1.0) - col;
        out_FragColor = vec4(col, 1.0);
      }
    `;
  }

  _depthShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_curvature;
      uniform float u_scanlines;
      uniform float u_pixelation;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec2 c2 = uv - 0.5;
        uv = uv + c2 * dot(c2,c2) * u_curvature * 0.6;
        float pxSz = 4.0 + u_pixelation * 30.0;
        uv = floor(uv * (1024.0 / pxSz)) * (pxSz / 1024.0);
        vec3 col = texture(colorTexture, v_textureCoordinates).rgb;
        vec3 processed = texture(colorTexture, uv).rgb;
        float lum = dot(processed, vec3(0.299, 0.587, 0.114));
        vec3 near = vec3(0.1, 1.0, 0.4);
        vec3 mid = vec3(0.2, 0.5, 1.0);
        vec3 far = vec3(0.6, 0.1, 0.8);
        vec3 depth;
        if (lum > 0.5) depth = mix(mid, near, (lum - 0.5) * 2.0);
        else depth = mix(far, mid, lum * 2.0);
        depth *= 1.5;
        depth -= sin(uv.y * 800.0 + u_time * 0.5) * u_scanlines * 0.2;
        float dd = distance(uv, vec2(0.5));
        depth *= 1.0 - dd * 0.5;
        out_FragColor = vec4(mix(col, depth, u_intensity), 1.0);
      }
    `;
  }

  _bloomShader () {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_bloomIntensity;
      
      void main() {
        vec2 uv = v_textureCoordinates;
        vec4 col = texture(colorTexture, uv);
        vec4 blur = vec4(0.0);
        float step = 2.0 / 1024.0;
        for(int x=-2; x<=2; x++) for(int y=-2; y<=2; y++) blur += texture(colorTexture, uv + vec2(x,y)*step);
        blur /= 25.0;
        out_FragColor = col + blur * u_bloomIntensity;
      }
    `;
  }
}

window.GothamShaders = GothamShaders;
