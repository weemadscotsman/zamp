/**
 * Agent System Benchmark and Test Suite
 * Tests neural network, chemical system, performance, and evolution
 */

// Test results collector
const TestResults = {
  passed: 0,
  failed: 0,
  tests: [],
  
  log(testName, passed, message = '') {
    this.tests.push({ name: testName, passed, message });
    if (passed) {
      this.passed++;
      console.log(`✓ ${testName}`);
    } else {
      this.failed++;
      console.error(`✗ ${testName}: ${message}`);
    }
  },
  
  summary() {
    const total = this.passed + this.failed;
    console.log(`\n=== Test Summary ===`);
    console.log(`Passed: ${this.passed}/${total}`);
    console.log(`Failed: ${this.failed}/${total}`);
    return this.failed === 0;
  }
};

/**
 * Test Neural Network Math
 */
function testNeuralNetwork() {
  console.log('\n=== Testing Neural Network ===');
  
  if (typeof AgentNeuralNetwork === 'undefined') {
    TestResults.log('Neural Network Class Exists', false, 'AgentNeuralNetwork not found');
    return;
  }
  
  // Test 1: Network creation
  try {
    const nn = new AgentNeuralNetwork();
    TestResults.log('Network Creation', true);
  } catch (e) {
    TestResults.log('Network Creation', false, e.message);
    return;
  }
  
  // Test 2: Forward pass
  try {
    const nn = new AgentNeuralNetwork();
    const inputs = new Float32Array([0.5, 0.3, 0.8, 0.2, 0.1, 0.9, 0.4, 0.6, 0.7, 0.2, 0.3, 0.5]);
    const outputs = nn.forward(inputs);
    
    if (outputs.length === 9) {
      TestResults.log('Forward Pass Output Size', true);
    } else {
      TestResults.log('Forward Pass Output Size', false, `Expected 9, got ${outputs.length}`);
    }
    
    // Check outputs are in valid range (0-1 due to sigmoid)
    const allValid = outputs.every(o => o >= 0 && o <= 1);
    TestResults.log('Output Range [0,1]', allValid, 'Outputs outside valid range');
  } catch (e) {
    TestResults.log('Forward Pass', false, e.message);
  }
  
  // Test 3: Training (single weight update)
  try {
    const nn = new AgentNeuralNetwork();
    const inputs = new Float32Array([0.5, 0.3, 0.8, 0.2, 0.1, 0.9, 0.4, 0.6, 0.7, 0.2, 0.3, 0.5]);
    const { hidden, outputs } = nn.forward(inputs);
    const action = 0;
    const reward = 0.5;
    
    const weightsBefore = nn.weightsHO[0][0];
    nn.train(inputs, hidden, action, reward);
    const weightsAfter = nn.weightsHO[0][0];
    
    if (weightsBefore !== weightsAfter) {
      TestResults.log('Training Weight Update', true);
    } else {
      TestResults.log('Training Weight Update', false, 'Weights did not change');
    }
  } catch (e) {
    TestResults.log('Training', false, e.message);
  }
  
  // Test 4: Mutation
  try {
    const nn = new AgentNeuralNetwork();
    const weightsBefore = nn.weightsIH[0][0];
    nn.mutate(1.0, 0.5); // High rate and amount
    const weightsAfter = nn.weightsIH[0][0];
    
    if (weightsBefore !== weightsAfter) {
      TestResults.log('Mutation', true);
    } else {
      TestResults.log('Mutation', false, 'Weights did not change');
    }
  } catch (e) {
    TestResults.log('Mutation', false, e.message);
  }
  
  // Test 5: Weight serialization
  try {
    const nn = new AgentNeuralNetwork();
    const weights = nn.getWeights();
    
    const hasAllWeights = weights.weightsIH && weights.weightsHO && 
                          weights.biasH && weights.biasO;
    TestResults.log('Weight Serialization', hasAllWeights, 'Missing weight components');
  } catch (e) {
    TestResults.log('Weight Serialization', false, e.message);
  }
  
  // Test 6: Weight inheritance
  try {
    const nn1 = new AgentNeuralNetwork();
    const weights = nn1.getWeights();
    const nn2 = new AgentNeuralNetwork({ inheritedWeights: weights, inheritFactor: 0.5 });
    
    TestResults.log('Weight Inheritance', true);
  } catch (e) {
    TestResults.log('Weight Inheritance', false, e.message);
  }
}

/**
 * Test Chemical System
 */
function testChemicalSystem() {
  console.log('\n=== Testing Chemical System ===');
  
  if (typeof AgentChemicalSystem === 'undefined') {
    TestResults.log('Chemical System Class Exists', false, 'AgentChemicalSystem not found');
    return;
  }
  
  // Test 1: System creation
  try {
    const chem = new AgentChemicalSystem();
    TestResults.log('Chemical System Creation', true);
  } catch (e) {
    TestResults.log('Chemical System Creation', false, e.message);
    return;
  }
  
  // Test 2: All 6 chemicals exist
  try {
    const chem = new AgentChemicalSystem();
    const expected = ['dopamine', 'stress', 'hunger', 'social', 'curiosity', 'fatigue'];
    const allExist = expected.every(key => chem.state[key] !== undefined);
    TestResults.log('All 6 Chemicals Exist', allExist, 'Missing chemicals');
  } catch (e) {
    TestResults.log('Chemical Check', false, e.message);
  }
  
  // Test 3: Values are clamped
  try {
    const chem = new AgentChemicalSystem();
    chem.state.dopamine = 200;
    chem.clamp();
    TestResults.log('Chemical Clamping', chem.state.dopamine <= 1, 'Value not clamped to max');
  } catch (e) {
    TestResults.log('Chemical Clamping', false, e.message);
  }
  
  // Test 4: Update changes values
  try {
    const chem = new AgentChemicalSystem();
    const dopamineBefore = chem.state.dopamine;
    chem.update(1.0);
    const dopamineAfter = chem.state.dopamine;
    
    // Dopamine should decay
    TestResults.log('Chemical Update', dopamineAfter !== dopamineBefore, 'No change after update');
  } catch (e) {
    TestResults.log('Chemical Update', false, e.message);
  }
  
  // Test 5: Apply deltas
  try {
    const chem = new AgentChemicalSystem();
    const dopamineBefore = chem.state.dopamine;
    chem.applyDelta('dopamine', 0.2);
    const dopamineAfter = chem.state.dopamine;
    
    TestResults.log('Apply Deltas', dopamineAfter > dopamineBefore, 'Delta not applied');
  } catch (e) {
    TestResults.log('Apply Deltas', false, e.message);
  }
  
  // Test 6: Stress level calculation
  try {
    const chem = new AgentChemicalSystem();
    chem.state.stress = 0.5;
    const stressLevel = chem.getStressLevel();
    
    TestResults.log('Stress Level Calculation', stressLevel >= 0 && stressLevel <= 1, 'Invalid stress level');
  } catch (e) {
    TestResults.log('Stress Level Calculation', false, e.message);
  }
  
  // Test 7: Serialization
  try {
    const chem = new AgentChemicalSystem();
    const data = chem.serialize();
    const chem2 = new AgentChemicalSystem();
    chem2.deserialize(data);
    
    const match = Object.keys(chem.state).every(key => chem.state[key] === chem2.state[key]);
    TestResults.log('Serialization', match, 'State mismatch after deserialization');
  } catch (e) {
    TestResults.log('Serialization', false, e.message);
  }
}

/**
 * Test Memory System
 */
function testMemorySystem() {
  console.log('\n=== Testing Memory System ===');
  
  if (typeof createAgentMemory === 'undefined') {
    TestResults.log('Memory System Exists', false, 'createAgentMemory not found');
    return;
  }
  
  // Test 1: Memory creation
  try {
    const memory = createAgentMemory('test-agent');
    TestResults.log('Memory Creation', true);
  } catch (e) {
    TestResults.log('Memory Creation', false, e.message);
    return;
  }
  
  // Test 2: Spatial memory
  try {
    const memory = createAgentMemory('test-agent');
    memory.spatial.rememberLocation(40.7, -74.0, 'resource', 0.8);
    const nearby = memory.spatial.recallNearby(40.7, -74.0, 0.1);
    
    TestResults.log('Spatial Memory', nearby.length > 0, 'No memories recalled');
  } catch (e) {
    TestResults.log('Spatial Memory', false, e.message);
  }
  
  // Test 3: Memory bounds
  try {
    const memory = createAgentMemory('test-agent');
    // Add many memories
    for (let i = 0; i < 600; i++) {
      memory.spatial.rememberLocation(i * 0.01, i * 0.01, 'test', 0.5);
    }
    const size = memory.spatial.size();
    TestResults.log('Memory Bounds', size <= 500, `Memory size ${size} exceeds limit`);
  } catch (e) {
    TestResults.log('Memory Bounds', false, e.message);
  }
  
  // Test 4: Event memory with bounds
  try {
    const memory = createAgentMemory('test-agent');
    for (let i = 0; i < 250; i++) {
      memory.event.recordEvent('test', { lat: 0, lon: 0 }, 0.5);
    }
    const eventCount = memory.event.events.length;
    TestResults.log('Event Memory Bounds', eventCount <= 200, `Event count ${eventCount} exceeds limit`);
  } catch (e) {
    TestResults.log('Event Memory Bounds', false, e.message);
  }
}

/**
 * Test Behavior Graph
 */
function testBehaviorGraph() {
  console.log('\n=== Testing Behavior Graph ===');
  
  if (typeof BehaviorGraph === 'undefined') {
    TestResults.log('Behavior Graph Exists', false, 'BehaviorGraph not found');
    return;
  }
  
  // Test 1: Graph creation
  try {
    const graph = new BehaviorGraph();
    TestResults.log('Behavior Graph Creation', true);
  } catch (e) {
    TestResults.log('Behavior Graph Creation', false, e.message);
    return;
  }
  
  // Test 2: Node addition
  try {
    const graph = new BehaviorGraph();
    graph.addNode('idle', 'PRIMITIVE', {
      action: () => ({ success: true }),
      cost: 1
    });
    TestResults.log('Add Node', graph.nodes.has('idle'), 'Node not added');
  } catch (e) {
    TestResults.log('Add Node', false, e.message);
  }
  
  // Test 3: Edge addition and pathfinding
  try {
    const graph = new BehaviorGraph();
    graph.addNode('idle', 'PRIMITIVE', { action: () => ({ success: true }), cost: 1 });
    graph.addNode('move', 'PRIMITIVE', { action: () => ({ success: true }), cost: 2 });
    graph.addEdge('idle', 'move');
    
    const path = graph.findPath('idle', 'move');
    TestResults.log('Path Finding', path !== null && path.length === 2, 'Path not found');
  } catch (e) {
    TestResults.log('Path Finding', false, e.message);
  }
  
  // Test 4: Learning (edge weight adjustment)
  try {
    const graph = new BehaviorGraph();
    graph.addNode('idle', 'PRIMITIVE', { action: () => ({ success: true }), cost: 1 });
    graph.addNode('move', 'PRIMITIVE', { action: () => ({ success: true }), cost: 2 });
    graph.addEdge('idle', 'move', null, 1.0);
    
    const edgeBefore = graph.edges.get('idle')[0].weight;
    
    // Record success - should decrease weight (make path preferred)
    const plan = { nodes: [graph.nodes.get('idle'), graph.nodes.get('move')] };
    graph.recordOutcome(plan, true, 1.0);
    
    const edgeAfter = graph.edges.get('idle')[0].weight;
    TestResults.log('Learning (Success)', edgeAfter < edgeBefore, 'Weight should decrease on success');
  } catch (e) {
    TestResults.log('Learning', false, e.message);
  }
  
  // Test 5: Empty graph handling
  try {
    const graph = new BehaviorGraph();
    const startNode = graph._findStartNode({});
    TestResults.log('Empty Graph Handling', startNode === null, 'Should return null for empty graph');
  } catch (e) {
    TestResults.log('Empty Graph Handling', false, e.message);
  }
}

/**
 * Performance Benchmark
 */
async function runPerformanceBenchmark() {
  console.log('\n=== Performance Benchmark ===');
  
  if (typeof AgentNeuralNetwork === 'undefined') {
    console.log('Neural network not available, skipping benchmark');
    return;
  }
  
  const iterations = 10000;
  
  // Neural Network Benchmark
  {
    const nn = new AgentNeuralNetwork();
    const inputs = new Float32Array([0.5, 0.3, 0.8, 0.2, 0.1, 0.9, 0.4, 0.6, 0.7, 0.2, 0.3, 0.5]);
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      nn.forward(inputs);
    }
    const duration = performance.now() - start;
    
    const opsPerSecond = (iterations / (duration / 1000)).toFixed(0);
    console.log(`Neural Forward Pass: ${duration.toFixed(2)}ms for ${iterations} iterations (${opsPerSecond} ops/sec)`);
    
    // Target: 60fps = 16.67ms per frame
    const timePerAgent = duration / iterations;
    const estimatedMaxAgents = Math.floor(16.67 / timePerAgent);
    console.log(`Estimated max agents at 60fps: ${estimatedMaxAgents}`);
  }
  
  // Chemical System Benchmark
  if (typeof AgentChemicalSystem !== 'undefined') {
    const chem = new AgentChemicalSystem();
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      chem.update(0.1);
    }
    const duration = performance.now() - start;
    
    const opsPerSecond = (iterations / (duration / 1000)).toFixed(0);
    console.log(`Chemical Update: ${duration.toFixed(2)}ms for ${iterations} iterations (${opsPerSecond} ops/sec)`);
  }
  
  // Memory System Benchmark
  if (typeof SpatialMemory !== 'undefined') {
    const memory = new SpatialMemory('benchmark');
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      memory.rememberLocation(i * 0.01, i * 0.01, 'test', 0.5);
    }
    const duration = performance.now() - start;
    console.log(`Memory Storage: ${duration.toFixed(2)}ms for 1000 memories`);
    
    const searchStart = performance.now();
    for (let i = 0; i < 100; i++) {
      memory.recallNearby(50 * 0.01, 50 * 0.01, 10);
    }
    const searchDuration = performance.now() - searchStart;
    console.log(`Memory Search: ${searchDuration.toFixed(2)}ms for 100 queries`);
  }
}

/**
 * Test Agent Evolution
 */
function testEvolution() {
  console.log('\n=== Testing Agent Evolution ===');
  
  if (typeof AgentNeuralNetwork === 'undefined') {
    TestResults.log('Evolution Test', false, 'Neural network not available');
    return;
  }
  
  try {
    // Create parent
    const parent = new AgentNeuralNetwork();
    const parentWeights = parent.getWeights();
    
    // Create child with inheritance
    const child = new AgentNeuralNetwork({ 
      inheritedWeights: parentWeights, 
      inheritFactor: 0.7 
    });
    
    const childWeights = child.getWeights();
    
    // Verify inheritance (weights should be similar but not identical)
    let totalDiff = 0;
    let count = 0;
    for (let i = 0; i < parent.weightsIH.length; i++) {
      for (let h = 0; h < parent.weightsIH[i].length; h++) {
        totalDiff += Math.abs(parent.weightsIH[i][h] - child.weightsIH[i][h]);
        count++;
      }
    }
    
    const avgDiff = totalDiff / count;
    // Average difference should be small but non-zero (inherited + random)
    TestResults.log('Weight Inheritance', avgDiff < 0.5, `Average weight diff ${avgDiff} too large`);
    
    // Test mutation creates variation
    const child2 = child.clone();
    child2.mutate(0.1, 0.2);
    
    let mutationDiff = 0;
    count = 0;
    for (let i = 0; i < child.weightsIH.length; i++) {
      for (let h = 0; h < child.weightsIH[i].length; h++) {
        mutationDiff += Math.abs(child.weightsIH[i][h] - child2.weightsIH[i][h]);
        count++;
      }
    }
    
    const avgMutation = mutationDiff / count;
    TestResults.log('Mutation Variation', avgMutation > 0, 'No variation after mutation');
    
  } catch (e) {
    TestResults.log('Evolution Test', false, e.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=== Agent System Test Suite ===');
  console.log('Date:', new Date().toISOString());
  
  testNeuralNetwork();
  testChemicalSystem();
  testMemorySystem();
  testBehaviorGraph();
  testEvolution();
  await runPerformanceBenchmark();
  
  const success = TestResults.summary();
  
  return {
    success,
    results: TestResults.tests,
    passed: TestResults.passed,
    failed: TestResults.failed
  };
}

// Export for use in browser or Node.js
if (typeof window !== 'undefined') {
  window.AgentSystemTests = {
    runAllTests,
    testNeuralNetwork,
    testChemicalSystem,
    testMemorySystem,
    testBehaviorGraph,
    testEvolution,
    runPerformanceBenchmark
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
}

// Auto-run if loaded as script
if (typeof window !== 'undefined' && window.document) {
  console.log('Agent System Test Suite loaded. Run AgentSystemTests.runAllTests() to execute.');
}
