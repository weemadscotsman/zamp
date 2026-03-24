/**
 * WorldStreamingController Integration Tests
 * Tests the seamless zoom transition and event propagation
 */

class WorldStreamingTestSuite {
  constructor() {
    this.tests = [];
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * Register a test
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('=== WorldStreamingController Integration Tests ===\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        this.results.push({ name: test.name, status: 'PASS' });
        console.log(`✓ ${test.name}`);
      } catch (error) {
        this.failed++;
        this.results.push({ name: test.name, status: 'FAIL', error: error.message });
        console.log(`✗ ${test.name}: ${error.message}`);
      }
    }

    console.log(`\n=== Results: ${this.passed} passed, ${this.failed} failed ===`);
    return this.results;
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  /**
   * Assert equals
   */
  assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
}

// Create test suite
const tests = new WorldStreamingTestSuite();

// ============================================
// EventBus Tests
// ============================================

tests.test('EventBus: Basic subscription and emission', () => {
  const bus = new WorldStreamingEventBus();
  let received = false;
  
  bus.on('test', (data) => {
    received = data.value;
  });
  
  bus.emit('test', { value: true });
  
  tests.assert(received === true, 'Event should be received');
});

tests.test('EventBus: Multiple subscribers', () => {
  const bus = new WorldStreamingEventBus();
  let count = 0;
  
  bus.on('test', () => count++);
  bus.on('test', () => count++);
  
  bus.emit('test', {});
  
  tests.assertEquals(count, 2, 'Both subscribers should be called');
});

tests.test('EventBus: Once subscription', () => {
  const bus = new WorldStreamingEventBus();
  let count = 0;
  
  bus.once('test', () => count++);
  
  bus.emit('test', {});
  bus.emit('test', {});
  
  tests.assertEquals(count, 1, 'Once subscriber should only be called once');
});

tests.test('EventBus: Unsubscribe', () => {
  const bus = new WorldStreamingEventBus();
  let count = 0;
  
  const unsubscribe = bus.on('test', () => count++);
  unsubscribe();
  
  bus.emit('test', {});
  
  tests.assertEquals(count, 0, 'Unsubscribed handler should not be called');
});

tests.test('EventBus: Stop propagation', () => {
  const bus = new WorldStreamingEventBus();
  let secondCalled = false;
  
  bus.on('test', (data, event) => {
    event.stopPropagation();
  }, { priority: 1 });
  
  bus.on('test', () => {
    secondCalled = true;
  }, { priority: 0 });
  
  bus.emit('test', {});
  
  tests.assert(!secondCalled, 'Lower priority handler should not be called after stopPropagation');
});

tests.test('EventBus: Event history', () => {
  const bus = new WorldStreamingEventBus();
  
  bus.emit('test1', { a: 1 });
  bus.emit('test2', { b: 2 });
  
  const history = bus.getHistory(null, 10);
  
  tests.assert(history.length >= 2, 'History should contain events');
});

// ============================================
// BiomeMapper Tests
// ============================================

tests.test('BiomeMapper: Returns biome for coordinates', () => {
  const mapper = new BiomeMapper();
  const biome = mapper.getBiome(40.7128, -74.0060); // NYC
  
  tests.assert(biome.climateZone, 'Should have climate zone');
  tests.assert(biome.biome, 'Should have biome type');
  tests.assert(typeof biome.urbanDensity === 'number', 'Should have urban density');
});

tests.test('BiomeMapper: Caches results', () => {
  const mapper = new BiomeMapper();
  const biome1 = mapper.getBiome(40.7128, -74.0060);
  const biome2 = mapper.getBiome(40.7128, -74.0060);
  
  tests.assertEquals(biome1.biome, biome2.biome, 'Cached biome should match');
});

tests.test('BiomeMapper: Detects urban areas', () => {
  const mapper = new BiomeMapper();
  const nyc = mapper.getBiome(40.7128, -74.0060);
  const rural = mapper.getBiome(45.0, -100.0); // Rural US
  
  tests.assert(nyc.urbanDensity > rural.urbanDensity, 'NYC should have higher urban density than rural area');
});

tests.test('BiomeMapper: Climate zones by latitude', () => {
  const mapper = new BiomeMapper();
  
  const equator = mapper.getBiome(0, 0);
  const temperate = mapper.getBiome(45, 0);
  const polar = mapper.getBiome(80, 0);
  
  tests.assertEquals(equator.climateZone, 'tropical', 'Equator should be tropical');
  tests.assertEquals(temperate.climateZone, 'temperate', '45° should be temperate');
  tests.assertEquals(polar.climateZone, 'polar', '80° should be polar');
});

// ============================================
// DeterministicSeeder Tests
// ============================================

tests.test('Seeder: Generates consistent agents for same location', () => {
  const seeder = new DeterministicSeeder();
  const locationData = { population: 100000, urbanDensity: 0.8 };
  
  const seed1 = seeder.generateAgents(40.7128, -74.0060, locationData);
  const seed2 = seeder.generateAgents(40.7128, -74.0060, locationData);
  
  tests.assertEquals(seed1.geohash, seed2.geohash, 'Geohash should be identical');
  tests.assertEquals(seed1.count, seed2.count, 'Agent count should be identical');
  tests.assertEquals(seed1.agents.length, seed2.agents.length, 'Agent arrays should have same length');
});

tests.test('Seeder: Generates different agents for different locations', () => {
  const seeder = new DeterministicSeeder();
  const locationData = { population: 100000 };
  
  const seed1 = seeder.generateAgents(40.7128, -74.0060, locationData);
  const seed2 = seeder.generateAgents(51.5074, -0.1278, locationData); // London
  
  tests.assert(seed1.geohash !== seed2.geohash, 'Geohashes should be different');
});

tests.test('Seeder: Agent count scales with population', () => {
  const seeder = new DeterministicSeeder();
  
  const small = seeder.generateAgents(40, -74, { population: 10000 });
  const large = seeder.generateAgents(40, -74, { population: 1000000 });
  
  tests.assert(large.count > small.count, 'Larger population should have more agents');
});

tests.test('Seeder: Agents have valid types', () => {
  const seeder = new DeterministicSeeder();
  const result = seeder.generateAgents(40, -74, { population: 100000 });
  
  const validTypes = ['warrior', 'trader', 'thief', 'mage', 'worker', 'berserker'];
  
  for (const agent of result.agents) {
    tests.assert(validTypes.includes(agent.type), `Agent type ${agent.type} should be valid`);
    tests.assert(agent.id, 'Agent should have ID');
    tests.assert(agent.stats, 'Agent should have stats');
    tests.assert(agent.personality, 'Agent should have personality');
  }
});

tests.test('Seeder: Geohash encoding', () => {
  const seeder = new DeterministicSeeder();
  const geohash = seeder.encodeGeohash(40.7128, -74.0060, 6);
  
  tests.assertEquals(geohash.length, 6, 'Geohash should have requested precision');
  tests.assert(/^[0-9a-z]+$/.test(geohash), 'Geohash should be alphanumeric');
});

// ============================================
// Integration Tests
// ============================================

tests.test('Integration: Mode transitions emit events', async () => {
  // Mock viewer
  const mockViewer = {
    camera: {
      positionCartographic: {
        height: 1000000,
        latitude: 0.7, // ~40°
        longitude: -1.3 // ~-74°
      },
      changed: { addEventListener: () => {} },
      percentageChanged: 0
    },
    container: document.createElement('div')
  };

  const controller = new WorldStreamingController(mockViewer);
  let modeChanged = false;
  
  controller.on('mode:changed', () => {
    modeChanged = true;
  });

  // Simulate camera change to tile mode
  mockViewer.camera.positionCartographic.height = 400; // Below tile threshold
  controller._onCameraChange();
  
  // Cleanup
  controller.dispose();
  
  // Note: Mode change is async, so we check the transition started
  tests.assert(controller.isTransitioning || modeChanged || controller.currentMode === 'tile', 
    'Mode transition should occur');
});

tests.test('Integration: Event propagation rules work', () => {
  const mockViewer = {
    camera: {
      positionCartographic: { height: 1000000, latitude: 0, longitude: 0 },
      changed: { addEventListener: () => {} }
    },
    container: document.createElement('div')
  };

  const controller = new WorldStreamingController(mockViewer);
  let propagated = false;
  
  controller.on('regional:event', () => {
    propagated = true;
  });

  controller.propagateEvent('planetary', 'earthquake', {
    magnitude: 5.5,
    lat: 40,
    lon: -74
  });

  controller.dispose();
  
  tests.assert(propagated, 'Event should propagate to regional level');
});

tests.test('Integration: Agent state caching', () => {
  const mockViewer = {
    camera: {
      positionCartographic: { height: 1000000, latitude: 0, longitude: 0 },
      changed: { addEventListener: () => {} }
    },
    container: document.createElement('div')
  };

  const controller = new WorldStreamingController(mockViewer);
  const testState = { agents: [{ id: 'test1', hp: 100 }] };
  
  controller.cacheAgentState('dr5r9', testState);
  const cached = controller.getCachedAgentState('dr5r9');
  
  controller.dispose();
  
  tests.assert(cached !== null, 'Should retrieve cached state');
  tests.assertEquals(cached.agents[0].id, 'test1', 'Cached data should match');
});

// ============================================
// Performance Tests
// ============================================

tests.test('Performance: Biome mapping is fast', () => {
  const mapper = new BiomeMapper();
  const start = performance.now();
  
  // Map 100 locations
  for (let i = 0; i < 100; i++) {
    mapper.getBiome(i, i);
  }
  
  const duration = performance.now() - start;
  
  tests.assert(duration < 100, `Biome mapping should be fast (took ${duration.toFixed(2)}ms)`);
});

tests.test('Performance: Seeder generates agents quickly', () => {
  const seeder = new DeterministicSeeder();
  const locationData = { population: 1000000, urbanDensity: 0.8 };
  
  const start = performance.now();
  
  seeder.generateAgents(40.7128, -74.0060, locationData);
  
  const duration = performance.now() - start;
  
  tests.assert(duration < 50, `Seeding should be fast (took ${duration.toFixed(2)}ms)`);
});

// ============================================
// Run Tests
// ============================================

// Export test runner
window.WorldStreamingTests = {
  run: () => tests.runAll(),
  suite: tests
};

// Auto-run if in test mode
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorldStreamingTestSuite, tests };
} else {
  console.log('WorldStreaming tests loaded. Run with: WorldStreamingTests.run()');
}
