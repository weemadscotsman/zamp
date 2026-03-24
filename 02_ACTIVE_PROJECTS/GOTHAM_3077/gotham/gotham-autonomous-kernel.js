/**
 * GOTHAM 3077 - Autonomous Intelligence Kernel v41.0
 * PORTED FROM SERVER.JS - TOTAL DEVICE AUTONOMY
 */

class AutonomousKernel {
  constructor() {
    this.data = {
      flights: [], military: [], satellites: [], neos: [], fireballs: [],
      earthquakes: [], wildfires: [], volcanoes: [], traffic: [], transit: [],
      weather: [], maritime: [], gdacs: [], cctv: [], crime: [], airquality: [],
      alerts: [], bikeshare: [], buoys: [], water: [], spacewx: [], evchargers: [],
      riverlevels: [], tides: [], carbon: [], corridors: []
    };
    this.intervals = {
      FLIGHTS: 15000, EARTHQUAKES: 60000, SATELLITES: 60000,
      TRAFFIC: 20000, NASA_EVENTS: 90000, WEATHER: 300000,
      CCTV: 120000, SPACE_INTEL: 300000
    };
    console.log('[GOTHAM] Autonomous Kernel Online');
    this.init();
  }

  async init() {
    this.initRoads();
    this.startFetchCycles();
    // Broadcast every 3 seconds instead of 1 to reduce UI pressure
    setInterval(() => this.broadcast(), 3000);
  }

  initRoads() {
    // Ported from server.js: Major road corridors
    this.data.corridors = [
      { name: 'A1 East', lat: 55.9490, lon: -3.1100, spread: 0.03, heading: 70, count: 15 },
      { name: 'A8 West', lat: 55.9470, lon: -3.2800, spread: 0.04, heading: 260, count: 15 },
      { name: 'M4 London', lat: 51.4900, lon: -0.3000, spread: 0.05, heading: 270, count: 20 },
      { name: 'Tower Bridge', lat: 51.5030, lon: -0.0760, spread: 0.01, heading: 180, count: 10 }
      // ... Additional corridors loaded on the fly
    ];
  }

  startFetchCycles() {
    this.fetchOpenSky();
    this.fetchUSGS();
    this.fetchNASA();
    
    setInterval(() => this.fetchOpenSky(), this.intervals.FLIGHTS);
    setInterval(() => this.fetchUSGS(), this.intervals.EARTHQUAKES);
  }

  async fetchOpenSky() {
    try {
      const res = await fetch('/api/flights');
      const flights = await res.json();
      if (!Array.isArray(flights)) return;
      this.data.flights = flights;
      console.log('[KERNEL] FLIGHT_SYNC: ' + flights.length);
    } catch (e) {
      console.warn('[KERNEL] Flight sync failed via proxy');
    }
  }

  async fetchUSGS() {
    try {
      const res = await fetch('/api/earthquakes');
      const earthquakes = await res.json();
      this.data.earthquakes = earthquakes;
    } catch (e) {}
  }

  async fetchNASA() {
    try {
      const res = await fetch('/api/nasa-cad');
      const d = await res.json();
      if (d.data) {
        this.data.neos = d.data.slice(0, 10).map((n, i) => ({
          id: 'neo-'+n[0], name: n[0], lat: Math.sin(i)*40, lon: (i/10)*360-180, alt: 400000, type: 'ASTEROID'
        }));
      }
    } catch (e) {
      console.warn('[KERNEL] NASA sync failed via proxy');
    }
  }

  broadcast() {
    window.dispatchEvent(new CustomEvent('gotham-data', { detail: this.data }));
  }
}

window.gothamAutonomous = new AutonomousKernel();
