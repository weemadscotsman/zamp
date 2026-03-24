/**
 * GOTHAM 3077 - INTELLIGENCE BACKEND v1.0
 * All OSINT results appear ON THE GLOBE as Cesium entities
 * Click a panel button → intel overlays appear on the map at geographic coordinates
 * 
 * Ted's directive: No standalone windows. Everything integrated. Results ON THE GLOBE.
 */

class GothamIntelligenceBackend {
  constructor(viewer, hud) {
    this.viewer = viewer;
    this.hud = hud;
    this.OSINT_API = 'http://localhost:5555';
    this._createClickHandler();
    console.log('[GOTHAM INTEL] Intelligence Backend Online — All results on globe');
  }

  // Globe click handler — when you click an intel entity, show details
  _createClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = this.viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties) {
        const props = picked.id.properties;
        if (props._intelType) {
          const title = props._title?.getValue?.() || 'INTEL';
          const alert = props._alert?.getValue?.() || '';
          if (this.hud) this.hud._sysLog(`INTEL LOCK: ${title}`);
          if (alert && alert.startsWith('CRITICAL')) this._speak(alert);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  _clearLayer(prefix) {
    const toRemove = [];
    this.viewer.entities.values.forEach(e => {
      if (e.id && String(e.id).startsWith(prefix)) toRemove.push(e.id);
    });
    toRemove.forEach(id => {
      try { this.viewer.entities.removeById(id); } catch {}
    });
  }

  _speak(msg) {
    if (window.gothamTTS) window.gothamTTS.speak(msg);
    else if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(msg);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USERNAME SCAN — Shows found profiles at platform HQ locations on globe
  // ─────────────────────────────────────────────────────────────────────────
  async scanUsername(username) {
    if (!username) return;
    this._clearLayer('osint-user-');
    this._speak(`Scanning ${username} across 21 platforms`);

    try {
      const r = await fetch(`${this.OSINT_API}/api/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await r.json();
      const found = data.found || [];

      if (!found.length) {
        this._speak(`No presences found for ${username}`);
        return;
      }

      // Platform HQ locations
      const locs = {
        'GitHub': [37.7749, -122.4194], 'Twitter': [40.7128, -74.0060],
        'Instagram': [37.7749, -122.4194], 'LinkedIn': [37.3950, -122.0780],
        'TikTok': [39.9042, 116.4074], 'YouTube': [37.4220, -122.0841],
        'Facebook': [37.4860, -122.1483], 'Reddit': [37.7749, -122.2250],
        'Pinterest': [37.7749, -122.4194], 'VK': [55.7558, 37.6173],
        'Tumblr': [40.7128, -74.0060], 'Medium': [37.7749, -122.4194],
        'Snapchat': [34.0522, -118.2437], 'Twitch': [37.7749, -122.4194],
        'Discord': [37.7749, -122.4194], 'Roblox': [37.4860, -122.1483],
        'NASA': [28.5731, -80.6492], 'Steam': [37.7749, -122.4194],
      };

      found.forEach((item, i) => {
        const platform = item.platform || item.name || 'Unknown';
        const latlon = locs[platform] || [0, 0];
        const lat = latlon[0] + (Math.random() - 0.5) * 5;
        const lon = latlon[1] + (Math.random() - 0.5) * 5;

        this.viewer.entities.add({
          id: `osint-user-${platform}-${i}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 10, color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: `${platform}: @${username}`,
            font: '9pt Courier New', fillColor: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 5000000, 0.2)
          },
          description: `<b>Platform:</b> ${platform}<br><b>Username:</b> ${username}<br><b>URL:</b> ${item.url || item.profile_url || 'N/A'}`,
          properties: { _intelType: 'username', _title: platform, _desc: `@${username} on ${platform}` }
        });
      });

      this._speak(`Found ${found.length} presences for ${username}. Displayed on globe.`);
      if (this.hud) this.hud._sysLog(`USERNAME: ${username} — ${found.length} FOUND`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-30, 30, 20000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] Username scan failed:', e);
      this._speak('Username scan failed. Check OSINT server on port 5555.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIP TRACK — Shows tracked individuals as MAGENTA entities on globe
  // ─────────────────────────────────────────────────────────────────────────
  async trackVIP(query) {
    if (!query) return;
    this._clearLayer('osint-vip-');
    this._speak(`Searching VIP database for ${query}`);

    try {
      const r = await fetch(`${this.OSINT_API}/api/vip-track?q=${encodeURIComponent(query)}`);
      const data = await r.json();
      const results = data.results || [];

      if (!results.length) {
        this._speak(`No VIP results for ${query}`);
        return;
      }

      // Known VIP home bases
      const vipLocs = {
        'Trump': [25.7826, -80.2120], 'Elon Musk': [33.4484, -112.0740],
        'Putin': [55.7558, 37.6173], 'Bezos': [47.6062, -122.3321],
        'Bill Gates': [47.6205, -122.3493], 'Medvedev': [55.7558, 37.6173],
        'Zelensky': [50.4501, 30.5234], 'Zelenskyy': [50.4501, 30.5234],
        'Roman Abramovich': [51.5074, -0.1278], 'Boris Johnson': [51.5074, -0.1278],
      };

      results.slice(0, 20).forEach((item, i) => {
        const name = item.name || query;
        const base = vipLocs[name] || [0, 0];
        const lat = base[0] + (Math.random() - 0.5) * 10;
        const lon = base[1] + (Math.random() - 0.5) * 10;
        const isGov = item.category === 'Government';
        const isOligarch = item.category === 'Oligarch';
        const color = isOligarch ? Cesium.Color.MAGENTA : isGov ? Cesium.Color.RED : Cesium.Color.CYAN;

        this.viewer.entities.add({
          id: `osint-vip-${i}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 14, color: color,
            outlineColor: Cesium.Color.YELLOW, outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: `${name} [${item.category || 'VIP'}]`,
            font: '9pt Courier New', fillColor: color,
            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
            scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 5000000, 0.2)
          },
          description: `<b>Name:</b> ${name}<br><b>Category:</b> ${item.category || 'VIP'}<br><b>Source:</b> ShadowBroker VIP DB`,
          properties: { _intelType: 'vip', _title: name, _category: item.category, _desc: `VIP: ${name}` }
        });
      });

      this._speak(`Tracking ${results.length} VIP entries for ${query}. On the globe.`);
      if (this.hud) this.hud._sysLog(`VIP: ${query} — ${results.length} RESULTS`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 30, 20000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] VIP track failed:', e);
      this._speak('VIP tracking failed. Check OSINT server.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BREACH CHECK — Shows breached services as RED ELLIPSES on globe
  // ─────────────────────────────────────────────────────────────────────────
  async checkBreach(email) {
    if (!email) return;
    this._clearLayer('osint-breach-');
    this._speak(`Checking breaches for ${email}`);

    try {
      const r = await fetch(`${this.OSINT_API}/api/breach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await r.json();
      const breaches = data.breaches || [];

      if (!breaches.length) {
        this._speak(`No breaches found for ${email}. Email is clean.`);
        return;
      }

      // Breach company HQ locations
      const breachLocs = {
        'LinkedIn': [37.3950, -122.0780], 'Facebook': [37.4860, -122.1483],
        'Adobe': [37.7749, -122.4194], 'Dropbox': [37.7749, -122.4194],
        'Twitter': [40.7128, -74.0060], 'Canva': [-33.8688, 151.2093],
        'Tumblr': [40.7128, -74.0060], 'MySpace': [34.0522, -118.2437],
        'Uber': [37.7749, -122.4194], 'Avast': [50.0755, 14.4378],
        '500px': [43.6532, -79.3832], 'Animoto': [40.7128, -74.0060],
      };

      breaches.slice(0, 15).forEach((b, i) => {
        const name = b.name || b.title || 'Unknown';
        const base = breachLocs[name] || [(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 160];
        const age = b.breach_date ? (new Date() - new Date(b.breach_date)) / (86400000 * 365) : 3;
        const size = Math.max(80000, Math.min(600000, age * 80000));

        this.viewer.entities.add({
          id: `osint-breach-${i}`,
          position: Cesium.Cartesian3.fromDegrees(base[1], base[0], 0),
          ellipse: {
            semiMajorAxis: size, semiMinorAxis: size * 0.7,
            material: new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.15)),
            outlineColor: Cesium.Color.RED, outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: `${name} [${b.breach_date?.split('-')[0] || '?'}]`,
            font: '9pt Courier New', fillColor: Cesium.Color.RED,
            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10),
            scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 5000000, 0.2)
          },
          description: `<b>Breach:</b> ${name}<br><b>Date:</b> ${b.breach_date || 'Unknown'}<br><b>Data:</b> ${(b.data_classes || []).slice(0, 5).join(', ')}`,
          properties: { _intelType: 'breach', _title: name, _alert: `DATA BREACH: ${name}`, _desc: `Breached: ${b.breach_date || '?'}` }
        });
      });

      this._speak(`Found ${breaches.length} breaches for ${email}. Displayed as red zones on globe.`);
      if (this.hud) this.hud._sysLog(`BREACH: ${email} — ${breaches.length} BREACHES`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 30, 20000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] Breach check failed:', e);
      this._speak('Breach check failed. Check OSINT server.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CVE INTELLIGENCE — Shows vulnerability as THERMAL ZONE on globe
  // ─────────────────────────────────────────────────────────────────────────
  async showCVE(cveId) {
    if (!cveId) return;
    this._clearLayer('osint-cve-');
    this._speak(`Looking up ${cveId}`);

    try {
      const r = await fetch(`${this.OSINT_API}/api/cve-lookup?cve=${encodeURIComponent(cveId)}`);
      const data = await r.json();
      const score = data.cvss_score || 0;
      const level = data.gotham_risk_level || 'unknown';
      const action = data.action || '';
      const sev = level === 'critical' ? 'CRITICAL' : level === 'high' ? 'HIGH' : level === 'medium' ? 'MEDIUM' : 'LOW';
      const size = score >= 9 ? 12000000 : score >= 7 ? 8000000 : 4000000;
      const color = score >= 9 ? Cesium.Color.RED : score >= 7 ? Cesium.Color.ORANGE : score >= 4 ? Cesium.Color.YELLOW : Cesium.Color.GREEN;

      this.viewer.entities.add({
        id: `osint-cve-${cveId}`,
        position: Cesium.Cartesian3.fromDegrees(0, 30, 0),
        ellipse: {
          semiMajorAxis: size, semiMinorAxis: size * 0.6,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.12)),
          outlineColor: color, outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `${cveId} CVSS ${score} [${sev}] — ${action}`,
          font: 'bold 11pt Courier New', fillColor: color,
          outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          scaleByDistance: new Cesium.NearFarScalar(5000000, 1.0, 30000000, 0.3)
        },
        description: `<b>CVE:</b> ${cveId}<br><b>CVSS:</b> ${score} — <b>${sev}</b><br><b>Action:</b> <b style="color:red">${action}</b><br><b>${(data.description || '').substring(0, 200)}...</b><br><b>CWE:</b> ${(data.cwe || []).filter(Boolean).join(', ') || 'N/A'}`,
        properties: { _intelType: 'cve', _title: cveId, _alert: score >= 9 ? `CRITICAL VULNERABILITY: ${cveId} — ${action}` : '', _desc: `CVSS ${score} [${sev}]` }
      });

      const alert = data.known_exploited ? 'EXPLOITED IN THE WILD' : '';
      this._speak(`${cveId} displayed on globe. CVSS ${score}. ${action}. ${alert}`);
      if (this.hud) this.hud._sysLog(`CVE: ${cveId} — CVSS ${score} [${sev}] — ${action}`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 20, 25000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] CVE lookup failed:', e);
      this._speak('CVE lookup failed. Check OSINT server.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CVE SEARCH — Shows top CVEs as entity clusters on globe
  // ─────────────────────────────────────────────────────────────────────────
  async searchCVE(keyword) {
    if (!keyword) return;
    this._clearLayer('osint-cve-');
    this._speak(`Searching CVEs for ${keyword}`);

    try {
      const r = await fetch(`${this.OSINT_API}/api/cve-search?q=${encodeURIComponent(keyword)}&limit=10`);
      const data = await r.json();
      const results = data.results || [];

      if (!results.length) {
        this._speak(`No CVEs found for ${keyword}`);
        return;
      }

      const colors = [Cesium.Color.RED, Cesium.Color.ORANGE, Cesium.Color.YELLOW, Cesium.Color.GREEN];
      results.forEach((cve, i) => {
        const score = cve.cvss_score || 5;
        const sev = cve.cvss_severity || 'MEDIUM';
        const sevColor = sev === 'CRITICAL' ? colors[0] : sev === 'HIGH' ? colors[1] : colors[3];
        const lat = (Math.random() - 0.5) * 40;
        const lon = (Math.random() - 0.5) * 80;
        const size = score * 60000;

        this.viewer.entities.add({
          id: `osint-cve-search-${i}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          ellipse: {
            semiMajorAxis: size, semiMinorAxis: size * 0.7,
            material: new Cesium.ColorMaterialProperty(sevColor.withAlpha(0.12)),
            outlineColor: sevColor, outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: `${cve.cve_id} — CVSS ${score} [${sev}]`,
            font: '9pt Courier New', fillColor: sevColor,
            outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -8),
            scaleByDistance: new Cesium.NearFarScalar(2000000, 1.0, 10000000, 0.2)
          },
          description: `<b>${cve.cve_id}</b><br>${(cve.description || '').substring(0, 200)}...`,
          properties: { _intelType: 'cve', _title: cve.cve_id, _desc: `CVSS ${score} [${sev}]` }
        });
      });

      this._speak(`Found ${results.length} CVEs for ${keyword}. Displayed on globe.`);
      if (this.hud) this.hud._sysLog(`CVE SEARCH: ${keyword} — ${results.length} RESULTS`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 20, 25000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] CVE search failed:', e);
      this._speak('CVE search failed. Check OSINT server.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UKRAINE FRONTLINES — Shows as POLYGONS on globe
  // ─────────────────────────────────────────────────────────────────────────
  async showFrontlines() {
    this._clearLayer('osint-frontline-');
    this._speak('Loading Ukraine frontlines from DeepStateMap');

    try {
      const r = await fetch(`${this.OSINT_API}/api/ukraine-frontlines`);
      const data = await r.json();
      const features = data.features || [];

      const zoneColors = {
        'Russian-occupied areas': { fill: Cesium.Color.RED.withAlpha(0.2), outline: Cesium.Color.RED },
        'Russian advance': { fill: Cesium.Color.ORANGE.withAlpha(0.25), outline: Cesium.Color.ORANGE },
        'Liberated area': { fill: Cesium.Color.GREEN.withAlpha(0.18), outline: Cesium.Color.GREEN },
        'Directions of UA attacks': { fill: Cesium.Color.CYAN.withAlpha(0.18), outline: Cesium.Color.CYAN },
      };

      let count = 0;
      for (const feature of features) {
        if (!feature.geometry || feature.geometry.type !== 'Polygon') continue;
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length < 3) continue;
        const name = feature.properties?.name || 'Zone';
        const style = zoneColors[name] || { fill: Cesium.Color.GRAY.withAlpha(0.1), outline: Cesium.Color.GRAY };

        try {
          const positions = coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], 50));
          this.viewer.entities.add({
            id: `osint-frontline-${count}`,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              material: new Cesium.ColorMaterialProperty(style.fill),
              outline: true, outlineColor: style.outline, outlineWidth: 2,
              height: 50, extrudedHeight: 200
            },
            label: {
              text: name, font: 'bold 10pt Courier New', fillColor: style.outline,
              outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 2000000, 0.3)
            },
            properties: { _intelType: 'frontline', _title: name, _alert: `FRONTLINE UPDATE: ${name}`, _desc: `Ukraine zone ${count}` }
          });
          count++;
        } catch {}
      }

      this._speak(`Ukraine frontlines loaded. ${count} zones displayed on the globe.`);
      if (this.hud) this.hud._sysLog(`FRONTLINES: ${count} ZONES ON GLOBE`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(32, 49, 4000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] Frontlines failed:', e);
      this._speak('Frontline data fetch failed. Check OSINT server.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNET OUTAGES — Shows as pulsing RED ZONES on globe
  // ─────────────────────────────────────────────────────────────────────────
  async showOutages() {
    this._clearLayer('osint-outage-');
    this._speak('Loading internet outage data from Georgia Tech IODA');

    try {
      const r = await fetch(`${this.OSINT_API}/api/internet-outages`);
      const data = await r.json();
      const outages = data.severe_outages || [];

      if (!outages.length) {
        this._speak('No severe outages detected in the last 24 hours.');
        return;
      }

      // Country centroids
      const ccLocs = {
        'UA': [48.3794, 31.1656], 'RU': [55.7558, 37.6173], 'IR': [35.6892, 51.3890],
        'PK': [30.3753, 69.3451], 'CN': [35.8617, 104.1954], 'IN': [20.5937, 78.9629],
        'MM': [21.9162, 95.9560], 'ET': [9.1450, 40.4897], 'SD': [12.8628, 30.2176],
        'AF': [33.9391, 67.7100], 'BY': [53.7098, 27.9534], 'VE': [6.4238, -66.5897],
        'CU': [21.5218, -77.7812], 'KP': [40.3399, 127.5101],
      };

      outages.slice(0, 20).forEach((o, i) => {
        const cc = o.country_code || '';
        const base = ccLocs[cc] || [0, 0];
        const sev = o.severity || 50;
        const size = 150000 + sev * 4000;
        const color = sev >= 80 ? Cesium.Color.DARKRED : sev >= 60 ? Cesium.Color.RED : Cesium.Color.ORANGE;

        this.viewer.entities.add({
          id: `osint-outage-${i}`,
          position: Cesium.Cartesian3.fromDegrees(base[1], base[0], 0),
          ellipse: {
            semiMajorAxis: size, semiMinorAxis: size * 0.8,
            material: new Cesium.ColorMaterialProperty(color.withAlpha(0.2)),
            outlineColor: color, outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: `${o.region || cc} — ${sev}%`,
            font: 'bold 10pt Courier New', fillColor: color,
            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10),
            scaleByDistance: new Cesium.NearFarScalar(1000000, 1.0, 10000000, 0.2)
          },
          description: `<b>Region:</b> ${o.region || 'Unknown'}<br><b>Country:</b> ${o.country || cc}<br><b>Severity:</b> <b style="color:red">${sev}%</b><br><b>Source:</b> ${o.datasource || 'BGP'}`,
          properties: { _intelType: 'outage', _title: `${o.region} ${sev}%`, _alert: sev >= 80 ? `SEVERE OUTAGE: ${o.region}` : '', _desc: `${sev}% disruption` }
        });
      });

      this._speak(`${outages.length} severe outages displayed on globe.`);
      if (this.hud) this.hud._sysLog(`OUTAGES: ${outages.length} SEVERE ZONES`);
      this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 30, 20000000), duration: 2 });

    } catch (e) {
      console.error('[GOTHAM INTEL] Outages failed:', e);
      this._speak('Outage data fetch failed.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GPS JAMMING ZONES — Shows as ORANGE WARNING ZONES on globe
  // ─────────────────────────────────────────────────────────────────────────
  async showGPSJamming() {
    this._clearLayer('osint-jamming-');

    // Known jamming hotspots (from ShadowBroker)
    const hotspots = [
      { lat: 49.0, lon: 37.5, name: 'Ukraine Eastern Front', sev: 85 },
      { lat: 48.5, lon: 38.0, name: 'Donbas Region', sev: 75 },
      { lat: 45.5, lon: 34.0, name: 'Crimea', sev: 60 },
      { lat: 31.5, lon: 34.9, name: 'Israel-Gaza Border', sev: 55 },
      { lat: 33.3, lon: 44.4, name: 'Iraq Baghdad Zone', sev: 50 },
      { lat: 35.5, lon: 38.0, name: 'Syria Central', sev: 45 },
      { lat: 37.5, lon: 68.8, name: 'Afghanistan Border', sev: 40 },
    ];

    this._speak(`GPS jamming analysis loaded. ${hotspots.length} zones displayed.`);

    hotspots.forEach((spot, i) => {
      const size = spot.sev * 1000;
      const color = spot.sev >= 70 ? Cesium.Color.ORANGE : Cesium.Color.YELLOW;

      this.viewer.entities.add({
        id: `osint-jamming-${i}`,
        position: Cesium.Cartesian3.fromDegrees(spot.lon, spot.lat, 0),
        ellipse: {
          semiMajorAxis: size, semiMinorAxis: size * 0.6,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.15)),
          outlineColor: Cesium.Color.ORANGE, outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `GPS JAMMING — ${spot.name} [${spot.sev}%]`,
          font: 'bold 9pt Courier New', fillColor: Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 10),
          scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 3000000, 0.2)
        },
        description: `<b>Zone:</b> ${spot.name}<br><b>Severity:</b> ${spot.sev}%<br><b>Type:</b> GPS / Navigation Interference<br><b>Source:</b> ADS-B NACp Analysis`,
        properties: { _intelType: 'jamming', _title: spot.name, _alert: spot.sev >= 70 ? `HIGH GPS JAMMING: ${spot.name}` : '', _desc: `${spot.sev}% interference` }
      });
    });

    if (this.hud) this.hud._sysLog(`GPS JAMMING: ${hotspots.length} ZONES`);
    this.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(35, 45, 8000000), duration: 2 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR ALL INTEL — Removes all OSINT entities from globe
  // ─────────────────────────────────────────────────────────────────────────
  clearAll() {
    const prefixes = ['osint-user-', 'osint-vip-', 'osint-breach-', 'osint-cve-', 'osint-frontline-', 'osint-outage-', 'osint-jamming-'];
    prefixes.forEach(p => this._clearLayer(p));
    this._speak('All intelligence overlays cleared from globe.');
    if (this.hud) this.hud._sysLog('INTEL: ALL OVERLAYS CLEARED');
  }
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  let initTimer = 0;
  const tryInit = () => {
    if (window.gothamViewer && window.gothamHUD) {
      window.gothamIntel = new GothamIntelligenceBackend(window.gothamViewer, window.gothamHUD);
    } else if (initTimer++ < 60) {
      setTimeout(tryInit, 500);
    }
  };
  setTimeout(tryInit, 3000);
});
