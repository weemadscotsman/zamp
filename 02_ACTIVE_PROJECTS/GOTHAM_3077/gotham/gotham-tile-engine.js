/**
 * Gotham 3077 - Tile World Engine
 * 2D top-down tile simulation for deep zoom globe rendering
 */

/**
 * AgentChemicalState - Manages agent's internal chemical/hormonal state
 * Represents the "mood" and physiological needs of an agent
 */
class AgentChemicalState {
    constructor() {
        // Core needs (0-100, higher = more satisfied/lower urgency)
        this.hunger = 50;      // 0 = starving, 100 = full
        this.fatigue = 0;      // 0 = rested, 100 = exhausted
        this.stress = 0;       // 0 = calm, 100 = panicked
        this.social = 50;      // 0 = lonely, 100 = socially fulfilled
        this.curiosity = 70;   // 0 = bored, 100 = highly curious
        
        // Reward chemicals
        this.dopamine = 50;    // Pleasure/reward
        this.serotonin = 50;   // Mood stability
        this.adrenaline = 0;   // Fight/flight response
    }

    /**
     * Apply natural decay to all chemicals over time
     * Called every simulation tick
     */
    decay() {
        // Needs increase (become more urgent)
        this.hunger = Math.min(100, this.hunger + 0.3);
        this.fatigue = Math.min(100, this.fatigue + 0.2);
        this.stress = Math.max(0, this.stress - 0.1);
        this.social = Math.max(0, this.social - 0.15);
        this.curiosity = Math.min(100, this.curiosity + 0.1);
        
        // Reward chemicals decay toward baseline
        this.dopamine = this.dopamine > 50 ? this.dopamine - 0.2 : this.dopamine + 0.1;
        this.serotonin = this.serotonin > 50 ? this.serotonin - 0.15 : this.serotonin + 0.1;
        this.adrenaline = Math.max(0, this.adrenaline - 0.5);
    }

    /**
     * Get current chemical state as normalized array for neural input
     * @returns {number[]} Array of chemical values (0-1)
     */
    toArray() {
        return [
            this.hunger / 100,
            this.fatigue / 100,
            this.stress / 100,
            this.social / 100,
            this.curiosity / 100,
            this.dopamine / 100,
            this.serotonin / 100,
            this.adrenaline / 100
        ];
    }

    /**
     * Clamp all values to valid range [0, 100]
     */
    clamp() {
        const keys = ['hunger', 'fatigue', 'stress', 'social', 'curiosity', 'dopamine', 'serotonin', 'adrenaline'];
        for (const key of keys) {
            this[key] = Math.max(0, Math.min(100, this[key]));
        }
    }
}

/**
 * AgentBrain - Neural decision-making system for agents
 * Simplified neural network that maps chemical states to actions
 */
class AgentBrain {
    constructor() {
        // Action outputs: [eat, sleep, socialize, explore, flee, idle]
        this.actionWeights = new Array(6).fill(0).map(() => Math.random() * 0.2 - 0.1);
        this.bias = new Array(6).fill(0).map(() => Math.random() * 0.1 - 0.05);
        
        // Weight matrix: 8 chemical inputs -> 6 action outputs
        this.weights = new Array(6).fill(0).map(() => 
            new Array(8).fill(0).map(() => Math.random() * 2 - 1)
        );
        
        // Personality modifiers
        this.personality = {
            aggression: Math.random(),
            sociability: Math.random(),
            curiosity: Math.random(),
            caution: Math.random()
        };
    }

    /**
     * Forward pass through the neural network
     * @param {number[]} inputs - Chemical state array (0-1 normalized)
     * @returns {Object} Selected action and confidence
     */
    forward(inputs) {
        const scores = new Array(6).fill(0);
        
        // Compute weighted sum for each action
        for (let i = 0; i < 6; i++) {
            scores[i] = this.bias[i];
            for (let j = 0; j < inputs.length; j++) {
                scores[i] += inputs[j] * this.weights[i][j];
            }
            scores[i] += this.actionWeights[i];
        }
        
        // Apply personality modifiers
        scores[0] += (1 - inputs[0]) * this.personality.aggression; // eat when hungry
        scores[2] += inputs[3] * this.personality.sociability;      // socialize
        scores[3] += inputs[4] * this.personality.curiosity;        // explore
        scores[4] += inputs[2] * this.personality.caution;          // flee when stressed
        
        // Softmax to get probabilities
        const expScores = scores.map(s => Math.exp(s));
        const sumExp = expScores.reduce((a, b) => a + b, 0);
        const probabilities = expScores.map(e => e / sumExp);
        
        // Select action based on probabilities (weighted random)
        const rand = Math.random();
        let cumulative = 0;
        const actions = ['eat', 'sleep', 'socialize', 'explore', 'flee', 'idle'];
        
        for (let i = 0; i < probabilities.length; i++) {
            cumulative += probabilities[i];
            if (rand <= cumulative) {
                return { action: actions[i], confidence: probabilities[i], allProbabilities: probabilities };
            }
        }
        
        return { action: 'idle', confidence: probabilities[5], allProbabilities: probabilities };
    }

    /**
     * Get action with highest probability (deterministic)
     * @param {number[]} inputs - Chemical state array
     * @returns {string} Best action
     */
    getBestAction(inputs) {
        const result = this.forward(inputs);
        return result.action;
    }
}

/**
 * TileWorldEngine - Main simulation engine for 2D tile-based world
 * Handles tile generation, agent simulation, rendering, and interaction
 */
class TileWorldEngine {
    /**
     * Create a new TileWorldEngine instance
     * @param {HTMLCanvasElement} canvas - The canvas element to render to
     * @param {number} latitude - World latitude coordinate
     * @param {number} longitude - World longitude coordinate
     * @param {Object} cityData - City configuration data
     * @param {Object} agentSystem - External agent system reference
     */
    constructor(canvas, latitude, longitude, cityData, agentSystem) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.latitude = latitude;
        this.longitude = longitude;
        this.cityData = cityData;
        this.agentSystem = agentSystem;
        
        // Dimensions
        this.width = canvas.width;
        this.height = canvas.height;
        this.tileSize = 32;
        this.gridWidth = Math.ceil(this.width / this.tileSize);
        this.gridHeight = Math.ceil(this.height / this.tileSize);
        
        // Camera/viewport
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1
        };
        
        // Tile grid: 2D array of tile objects
        this.tiles = [];
        
        // Agent management
        this.agents = [];
        
        // Resources on the map
        this.resources = [];
        
        // UI state
        this.exitButton = { x: this.width - 80, y: 10, width: 70, height: 30 };
        this.selectedAgent = null;
        this.tickCount = 0;
        this.isRunning = true;
        
        // Bind event handlers
        this._handleClick = this.handleClick.bind(this);
        this.canvas.addEventListener('click', this._handleClick);
        
        // Initialize tile grid
        this._initGrid();
    }

    /**
     * Initialize empty tile grid
     * @private
     */
    _initGrid() {
        this.tiles = [];
        for (let y = 0; y < this.gridHeight; y++) {
            const row = [];
            for (let x = 0; x < this.gridWidth; x++) {
                row.push({
                    x,
                    y,
                    type: 'grass',
                    walkable: true,
                    resource: null,
                    variant: Math.random()
                });
            }
            this.tiles.push(row);
        }
    }

    /**
     * Generate procedural tile world based on biome
     * Creates terrain, resources, and environmental features
     */
    generate() {
        const biome = this.cityData?.biome || 'temperate';
        const seed = (this.latitude * 1000 + this.longitude) % 10000;
        
        // Biome configuration
        const biomeConfig = {
            tropical: { forestChance: 0.4, waterChance: 0.15, rockChance: 0.05, treeDensity: 0.6 },
            temperate: { forestChance: 0.3, waterChance: 0.1, rockChance: 0.1, treeDensity: 0.4 },
            continental: { forestChance: 0.2, waterChance: 0.08, rockChance: 0.2, treeDensity: 0.3 },
            polar: { forestChance: 0.05, waterChance: 0.05, rockChance: 0.3, treeDensity: 0.1 }
        };
        
        const config = biomeConfig[biome] || biomeConfig.temperate;
        
        // Simple pseudo-random generator
        let rng = seed;
        const random = () => {
            rng = (rng * 9301 + 49297) % 233280;
            return rng / 233280;
        };
        
        // Generate terrain using cellular automata-like approach
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tile = this.tiles[y][x];
                const noise = random();
                
                // Determine tile type based on noise and biome
                if (noise < config.waterChance) {
                    tile.type = 'water';
                    tile.walkable = false;
                } else if (noise < config.waterChance + config.rockChance) {
                    tile.type = 'rock';
                    tile.walkable = true;
                    
                    // Place copper ore in rock tiles
                    if (random() < 0.3) {
                        tile.resource = { type: 'copper_ore', amount: 50 + Math.floor(random() * 100) };
                        this.resources.push({ x, y, type: 'copper_ore', tile });
                    }
                } else if (noise < config.waterChance + config.rockChance + config.forestChance) {
                    tile.type = 'forest';
                    tile.walkable = true;
                    
                    // Place trees in forest tiles
                    if (random() < config.treeDensity) {
                        tile.resource = { type: 'tree', amount: 20 + Math.floor(random() * 30) };
                        this.resources.push({ x, y, type: 'tree', tile });
                    }
                } else {
                    tile.type = 'grass';
                    tile.walkable = true;
                    
                    // Occasional trees in grass
                    if (random() < 0.05) {
                        tile.resource = { type: 'tree', amount: 15 + Math.floor(random() * 20) };
                        this.resources.push({ x, y, type: 'tree', tile });
                    }
                }
                
                // Add visual variation
                tile.variant = random();
            }
        }
        
        // Smooth water edges (simple cellular automata)
        for (let iteration = 0; iteration < 2; iteration++) {
            for (let y = 1; y < this.gridHeight - 1; y++) {
                for (let x = 1; x < this.gridWidth - 1; x++) {
                    const tile = this.tiles[y][x];
                    if (tile.type === 'water') continue;
                    
                    // Count water neighbors
                    let waterNeighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            if (this.tiles[y + dy][x + dx].type === 'water') {
                                waterNeighbors++;
                            }
                        }
                    }
                    
                    // Convert to water if surrounded
                    if (waterNeighbors >= 5) {
                        tile.type = 'water';
                        tile.walkable = false;
                        tile.resource = null;
                    }
                }
            }
        }
    }

    /**
     * Spawn agents into the world
     * @param {number} count - Number of agents to spawn
     */
    spawnAgents(count) {
        const agentClasses = [
            { name: 'warrior', weight: 15, color: '#e74c3c', hp: 120 },
            { name: 'trader', weight: 25, color: '#f39c12', hp: 80 },
            { name: 'thief', weight: 12, color: '#9b59b6', hp: 70 },
            { name: 'mage', weight: 10, color: '#3498db', hp: 60 },
            { name: 'worker', weight: 28, color: '#2ecc71', hp: 100 },
            { name: 'berserker', weight: 10, color: '#c0392b', hp: 150 }
        ];
        
        // Calculate total weight for weighted random selection
        const totalWeight = agentClasses.reduce((sum, c) => sum + c.weight, 0);
        
        for (let i = 0; i < count; i++) {
            // Weighted class selection
            let randomWeight = Math.random() * totalWeight;
            let selectedClass = agentClasses[0];
            for (const cls of agentClasses) {
                randomWeight -= cls.weight;
                if (randomWeight <= 0) {
                    selectedClass = cls;
                    break;
                }
            }
            
            // Find valid spawn position
            let spawnX, spawnY, attempts = 0;
            do {
                spawnX = Math.floor(Math.random() * this.gridWidth);
                spawnY = Math.floor(Math.random() * this.gridHeight);
                attempts++;
            } while (attempts < 100 && (!this.tiles[spawnY][spawnX].walkable || this.tiles[spawnY][spawnX].resource));
            
            // Create agent with deterministic ID based on geohash
            const agent = {
                id: `agent_${this.latitude.toFixed(4)}_${this.longitude.toFixed(4)}_${i}_${Date.now()}`,
                class: selectedClass.name,
                color: selectedClass.color,
                x: spawnX,
                y: spawnY,
                pixelX: spawnX * this.tileSize + this.tileSize / 2,
                pixelY: spawnY * this.tileSize + this.tileSize / 2,
                hp: selectedClass.hp,
                maxHp: selectedClass.hp,
                level: 1,
                
                // Neural and chemical systems
                brain: new AgentBrain(),
                chemicals: new AgentChemicalState(),
                
                // Stats
                stats: {
                    strength: 10 + Math.floor(Math.random() * 10),
                    agility: 10 + Math.floor(Math.random() * 10),
                    intelligence: 10 + Math.floor(Math.random() * 10),
                    charisma: 10 + Math.floor(Math.random() * 10),
                    luck: 10 + Math.floor(Math.random() * 10)
                },
                
                // Inventory
                inventory: {
                    gold: Math.floor(Math.random() * 50),
                    items: []
                },
                
                // Memory for learning
                memory: [],
                maxMemorySize: 20,
                
                // Current state
                currentAction: 'idle',
                actionProgress: 0,
                facing: Math.floor(Math.random() * 4), // 0-3: N, E, S, W

                // Task queue for multi-step jobs (A* pathfinding)
                taskQueue: [],
                currentTask: null,
                path: [],
                infected: false
            };
            
            this.agents.push(agent);
        }
    }

    /**
     * Main simulation tick - advances the world state
     * @private
     */
    _tick() {
        if (!this.isRunning) return;
        
        this.tickCount++;
        
        for (const agent of this.agents) {
            // 1. Decay chemicals
            agent.chemicals.decay();
            
            // 2. Check critical states
            if (agent.chemicals.hunger >= 90) {
                agent.hp -= 1; // Starvation damage
            }
            if (agent.chemicals.fatigue >= 100) {
                agent.hp -= 0.5; // Exhaustion damage
            }
            
            // 3. Process task queue OR neural decision
            let actionTaken;
            if (agent.currentTask) {
                this._processTask(agent);
                actionTaken = agent.currentTask ? agent.currentTask.type : 'idle';
            } else {
                const inputs = agent.chemicals.toArray();
                const decision = agent.brain.forward(inputs);
                actionTaken = decision.action;
                this._executeAction(agent, decision.action);

                // Auto-assign tasks for idle agents every 10 ticks
                if (this.tickCount % 10 === 0 && decision.action === 'idle') {
                    this._autoAssignTask(agent);
                }
            }
            agent.currentAction = actionTaken;

            // 4. Update memory
            this._updateMemory(agent, actionTaken, agent.chemicals);

            // Clamp all chemicals
            agent.chemicals.clamp();
        }
        
        // Remove dead agents
        this.agents = this.agents.filter(agent => agent.hp > 0);
    }

    /**
     * Execute an action for an agent
     * @param {Object} agent - The agent performing the action
     * @param {string} action - The action to execute
     * @private
     */
    _executeAction(agent, action) {
        const chemicals = agent.chemicals;
        
        switch (action) {
            case 'explore':
                // Move randomly
                const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const newX = agent.x + dir[0];
                const newY = agent.y + dir[1];
                
                // Check bounds and walkability
                if (newX >= 0 && newX < this.gridWidth && 
                    newY >= 0 && newY < this.gridHeight &&
                    this.tiles[newY][newX].walkable) {
                    agent.x = newX;
                    agent.y = newY;
                    agent.pixelX = newX * this.tileSize + this.tileSize / 2;
                    agent.pixelY = newY * this.tileSize + this.tileSize / 2;
                }
                
                chemicals.curiosity = Math.max(0, chemicals.curiosity - 5);
                chemicals.fatigue = Math.min(100, chemicals.fatigue + 2);
                agent.facing = directions.indexOf(dir);
                break;
                
            case 'eat':
                // Reduce hunger, increase dopamine
                chemicals.hunger = Math.max(0, chemicals.hunger - 15);
                chemicals.dopamine = Math.min(100, chemicals.dopamine + 10);
                chemicals.fatigue = Math.min(100, chemicals.fatigue + 1);
                
                // Consume food from inventory if available
                const foodIndex = agent.inventory.items.findIndex(item => item.type === 'food');
                if (foodIndex >= 0) {
                    agent.inventory.items[foodIndex].amount--;
                    if (agent.inventory.items[foodIndex].amount <= 0) {
                        agent.inventory.items.splice(foodIndex, 1);
                    }
                }
                break;
                
            case 'sleep':
                // Reduce fatigue and stress
                chemicals.fatigue = Math.max(0, chemicals.fatigue - 10);
                chemicals.stress = Math.max(0, chemicals.stress - 5);
                chemicals.serotonin = Math.min(100, chemicals.serotonin + 3);
                break;
                
            case 'socialize':
                // Find nearby agents
                const nearbyAgents = this.agents.filter(other => 
                    other.id !== agent.id &&
                    Math.abs(other.x - agent.x) <= 2 &&
                    Math.abs(other.y - agent.y) <= 2
                );
                
                if (nearbyAgents.length > 0) {
                    chemicals.social = Math.min(100, chemicals.social + 15);
                    chemicals.dopamine = Math.min(100, chemicals.dopamine + 8);
                } else {
                    chemicals.social = Math.max(0, chemicals.social - 2);
                }
                chemicals.fatigue = Math.min(100, chemicals.fatigue + 1);
                break;
                
            case 'flee':
                // Panicked movement
                const fleeDir = [[0, -1], [1, 0], [0, 1], [-1, 0]][Math.floor(Math.random() * 4)];
                const fleeX = agent.x + fleeDir[0] * 2;
                const fleeY = agent.y + fleeDir[1] * 2;
                
                if (fleeX >= 0 && fleeX < this.gridWidth && 
                    fleeY >= 0 && fleeY < this.gridHeight &&
                    this.tiles[fleeY][fleeX].walkable) {
                    agent.x = fleeX;
                    agent.y = fleeY;
                    agent.pixelX = fleeX * this.tileSize + this.tileSize / 2;
                    agent.pixelY = fleeY * this.tileSize + this.tileSize / 2;
                }
                
                chemicals.stress = Math.max(0, chemicals.stress - 8);
                chemicals.adrenaline = Math.min(100, chemicals.adrenaline + 15);
                chemicals.fatigue = Math.min(100, chemicals.fatigue + 5);
                break;
                
            case 'idle':
            default:
                // Small recovery
                chemicals.fatigue = Math.max(0, chemicals.fatigue - 0.5);
                break;
        }
    }

    /**
     * Update agent's memory with recent experience
     * @param {Object} agent - The agent
     * @param {string} action - The action taken
     * @param {ChemicalState} chemicals - Current chemical state
     * @private
     */
    _updateMemory(agent, action, chemicals) {
        const memoryEntry = {
            tick: this.tickCount,
            action,
            chemicals: { ...chemicals },
            location: { x: agent.x, y: agent.y },
            reward: chemicals.dopamine > 60 ? 1 : chemicals.dopamine < 40 ? -1 : 0
        };
        
        agent.memory.push(memoryEntry);
        
        // Limit memory size
        if (agent.memory.length > agent.maxMemorySize) {
            agent.memory.shift();
        }
    }

    /**
     * Start the simulation loop
     */
    start() {
        this.isRunning = true;
        this._scheduleTick();
    }

    /**
     * Schedule the next simulation tick
     * @private
     */
    _scheduleTick() {
        if (!this.isRunning) return;
        
        this._tick();
        requestAnimationFrame(() => this._scheduleTick());
    }

    /**
     * Stop the simulation
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Render the world to the canvas
     */
    render() {
        const ctx = this.ctx;
        
        // Clear background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Apply camera transform
        ctx.save();
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw tiles
        this._renderTiles(ctx);
        
        // Draw resources
        this._renderResources(ctx);
        
        // Draw agents
        this._renderAgents(ctx);
        
        ctx.restore();
        
        // Draw UI overlay (not affected by camera)
        this._renderUI(ctx);
    }

    /**
     * Render all tiles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _renderTiles(ctx) {
        const tileColors = {
            grass: ['#2d5016', '#3a6b1c', '#457a20'],
            forest: ['#1a3d0a', '#234d0f', '#2d5d14'],
            water: ['#1e3a5f', '#264b7a', '#2e5c95'],
            rock: ['#4a4a4a', '#5a5a5a', '#6a6a6a']
        };
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tile = this.tiles[y][x];
                const colors = tileColors[tile.type] || tileColors.grass;
                const colorIndex = Math.floor(tile.variant * colors.length);
                
                ctx.fillStyle = colors[colorIndex];
                ctx.fillRect(
                    x * this.tileSize,
                    y * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
                
                // Draw tile border for grid effect
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    x * this.tileSize,
                    y * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
            }
        }
    }

    /**
     * Render resources on tiles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _renderResources(ctx) {
        for (const resource of this.resources) {
            const x = resource.x * this.tileSize + this.tileSize / 2;
            const y = resource.y * this.tileSize + this.tileSize / 2;
            
            if (resource.type === 'tree') {
                // Draw tree trunk
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(x - 4, y, 8, 12);
                
                // Draw tree crown
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                ctx.arc(x, y - 4, 10, 0, Math.PI * 2);
                ctx.fill();
                
                // Add shading
                ctx.fillStyle = '#1a6b1a';
                ctx.beginPath();
                ctx.arc(x - 3, y - 6, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (resource.type === 'copper_ore') {
                // Draw ore node
                ctx.fillStyle = '#B87333';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw ore crystals
                ctx.fillStyle = '#CD853F';
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const ox = x + Math.cos(angle) * 4;
                    const oy = y + Math.sin(angle) * 4;
                    ctx.beginPath();
                    ctx.arc(ox, oy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    /**
     * Render all agents
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _renderAgents(ctx) {
        for (const agent of this.agents) {
            const x = agent.pixelX;
            const y = agent.pixelY;
            
            // Draw agent body (colored circle by class)
            ctx.fillStyle = agent.color;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw direction indicator
            const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            const dir = directions[agent.facing] || [0, -1];
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + dir[0] * 8, y + dir[1] * 8);
            ctx.stroke();
            
            // Draw selection highlight
            if (this.selectedAgent === agent) {
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Draw HP bar if damaged
            if (agent.hp < agent.maxHp) {
                const barWidth = 20;
                const barHeight = 4;
                const hpPercent = agent.hp / agent.maxHp;
                
                // Background
                ctx.fillStyle = '#330000';
                ctx.fillRect(x - barWidth / 2, y - 16, barWidth, barHeight);
                
                // HP fill
                ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
                ctx.fillRect(x - barWidth / 2, y - 16, barWidth * hpPercent, barHeight);
            }
            
            // Draw current action indicator
            if (agent.currentAction && agent.currentAction !== 'idle') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(agent.currentAction[0].toUpperCase(), x, y - 20);
            }
        }
    }

    /**
     * Render UI overlay
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @private
     */
    _renderUI(ctx) {
        // Draw exit button
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(this.exitButton.x, this.exitButton.y, this.exitButton.width, this.exitButton.height);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.exitButton.x, this.exitButton.y, this.exitButton.width, this.exitButton.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIT', this.exitButton.x + this.exitButton.width / 2, this.exitButton.y + this.exitButton.height / 2);
        
        // Draw info panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 80);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.strokeRect(10, 10, 200, 80);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Agents: ${this.agents.length}`, 20, 30);
        ctx.fillText(`Coords: ${this.latitude.toFixed(4)}, ${this.longitude.toFixed(4)}`, 20, 45);
        ctx.fillText(`Tick: ${this.tickCount}`, 20, 60);
        ctx.fillText(`Biome: ${this.cityData?.biome || 'temperate'}`, 20, 75);
        
        // Draw selected agent info
        if (this.selectedAgent) {
            const panelX = 10;
            const panelY = this.height - 110;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(panelX, panelY, 250, 100);
            ctx.strokeStyle = this.selectedAgent.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(panelX, panelY, 250, 100);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`${this.selectedAgent.class.toUpperCase()} #${this.selectedAgent.id.slice(-4)}`, panelX + 10, panelY + 20);
            
            ctx.font = '11px monospace';
            ctx.fillText(`HP: ${Math.floor(this.selectedAgent.hp)}/${this.selectedAgent.maxHp}`, panelX + 10, panelY + 38);
            ctx.fillText(`Action: ${this.selectedAgent.currentAction}`, panelX + 10, panelY + 52);
            ctx.fillText(`Hunger: ${Math.floor(this.selectedAgent.chemicals.hunger)}`, panelX + 120, panelY + 38);
            ctx.fillText(`Fatigue: ${Math.floor(this.selectedAgent.chemicals.fatigue)}`, panelX + 120, panelY + 52);
            ctx.fillText(`Stress: ${Math.floor(this.selectedAgent.chemicals.stress)}`, panelX + 120, panelY + 66);
            ctx.fillText(`Dopamine: ${Math.floor(this.selectedAgent.chemicals.dopamine)}`, panelX + 10, panelY + 66);
            ctx.fillText(`Memory: ${this.selectedAgent.memory.length} entries`, panelX + 10, panelY + 80);
        }
    }

    /**
     * Handle canvas click events
     * @param {MouseEvent} e - Click event
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check exit button
        if (x >= this.exitButton.x && x <= this.exitButton.x + this.exitButton.width &&
            y >= this.exitButton.y && y <= this.exitButton.y + this.exitButton.height) {
            this.destroy();
            return;
        }
        
        // Transform to world coordinates
        const worldX = (x / this.camera.zoom) + this.camera.x;
        const worldY = (y / this.camera.zoom) + this.camera.y;
        
        // Check agent clicks (radius-based)
        let clickedAgent = null;
        for (const agent of this.agents) {
            const dx = worldX - agent.pixelX;
            const dy = worldY - agent.pixelY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= 12) {
                clickedAgent = agent;
                break;
            }
        }
        
        if (clickedAgent) {
            this.selectedAgent = clickedAgent;
            
            // Dispatch agent-selected event
            const event = new CustomEvent('agent-selected', {
                detail: {
                    agent: {
                        id: clickedAgent.id,
                        class: clickedAgent.class,
                        level: clickedAgent.level,
                        hp: clickedAgent.hp,
                        maxHp: clickedAgent.maxHp,
                        stats: { ...clickedAgent.stats },
                        chemicals: { ...clickedAgent.chemicals },
                        currentAction: clickedAgent.currentAction,
                        inventory: { ...clickedAgent.inventory },
                        memory: clickedAgent.memory.length,
                        position: { x: clickedAgent.x, y: clickedAgent.y }
                    }
                }
            });
            this.canvas.dispatchEvent(event);
        } else {
            this.selectedAgent = null;
        }
    }

    /**
     * Save agent states to localStorage for persistence
     */
    saveAgentState() {
        const agentData = this.agents.map(agent => ({
            id: agent.id,
            class: agent.class,
            x: agent.x,
            y: agent.y,
            hp: agent.hp,
            level: agent.level,
            stats: agent.stats,
            chemicals: agent.chemicals,
            inventory: agent.inventory,
            memory: agent.memory
        }));
        
        const saveKey = `gotham_agents_${this.latitude}_${this.longitude}`;
        localStorage.setItem(saveKey, JSON.stringify({
            timestamp: Date.now(),
            agents: agentData,
            tickCount: this.tickCount
        }));
    }

    /**
     * Load agent states from localStorage
     * @returns {boolean} True if loaded successfully
     */
    loadAgentState() {
        const saveKey = `gotham_agents_${this.latitude}_${this.longitude}`;
        const saved = localStorage.getItem(saveKey);
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Check if save is not too old (7 days)
                const age = Date.now() - data.timestamp;
                if (age > 7 * 24 * 60 * 60 * 1000) {
                    console.log('Agent save is too old, starting fresh');
                    return false;
                }
                
                // Restore agents from saved data
                if (data.agents && Array.isArray(data.agents)) {
                    this.agents = [];
                    
                    for (const agentData of data.agents) {
                        // Recreate agent with saved data
                        const agent = {
                            id: agentData.id,
                            class: agentData.class,
                            color: agentData.color,
                            x: agentData.x,
                            y: agentData.y,
                            pixelX: agentData.x * this.tileSize + this.tileSize / 2,
                            pixelY: agentData.y * this.tileSize + this.tileSize / 2,
                            hp: agentData.hp,
                            maxHp: agentData.maxHp,
                            level: agentData.level,
                            
                            // Recreate neural and chemical systems
                            brain: new AgentBrain(),
                            chemicals: new AgentChemicalState(),
                            
                            // Restore stats
                            stats: agentData.stats || {
                                strength: 10,
                                agility: 10,
                                intelligence: 10,
                                charisma: 10,
                                luck: 10
                            },
                            
                            // Restore inventory
                            inventory: agentData.inventory || {
                                gold: 0,
                                items: []
                            },
                            
                            // Restore memory
                            memory: agentData.memory || [],
                            maxMemorySize: 20,
                            
                            // Current state
                            currentAction: 'idle',
                            actionProgress: 0,
                            facing: Math.floor(Math.random() * 4),
                            taskQueue: [],
                            currentTask: null,
                            path: [],
                            infected: false
                        };
                        
                        // Restore chemical state
                        if (agentData.chemicals) {
                            Object.assign(agent.chemicals, agentData.chemicals);
                        }
                        
                        this.agents.push(agent);
                    }
                    
                    this.tickCount = data.tickCount || 0;
                    console.log(`Loaded ${this.agents.length} agents from save`);
                    return true;
                }
            } catch (e) {
                console.warn('Failed to load agent state:', e);
                return false;
            }
        }
        return false;
    }

    // ======================== A* PATHFINDING ========================

    /**
     * A* pathfinding on tile grid
     * @param {number} startX - Start grid X
     * @param {number} startY - Start grid Y
     * @param {number} goalX - Goal grid X
     * @param {number} goalY - Goal grid Y
     * @param {number} maxNodes - Max nodes to explore (performance cap)
     * @returns {Array|null} Array of {x,y} waypoints, or null if no path
     */
    _findPath(startX, startY, goalX, goalY, maxNodes = 200) {
        if (startX === goalX && startY === goalY) return [];
        const goal = this.getTile(goalX, goalY);
        if (!goal || !goal.walkable) return null;

        const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);
        const openSet = [{ x: startX, y: startY, g: 0, h: heuristic(startX, startY, goalX, goalY), f: heuristic(startX, startY, goalX, goalY), parent: null }];
        const closedSet = new Set();
        let nodesExplored = 0;

        while (openSet.length > 0 && nodesExplored < maxNodes) {
            // Find lowest f
            let lowestIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
            }
            const current = openSet.splice(lowestIdx, 1)[0];
            nodesExplored++;

            if (current.x === goalX && current.y === goalY) {
                const path = [];
                let node = current;
                while (node.parent) {
                    path.unshift({ x: node.x, y: node.y });
                    node = node.parent;
                }
                return path;
            }

            closedSet.add(`${current.x},${current.y}`);

            const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            for (const [dx, dy] of neighbors) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) continue;
                if (closedSet.has(`${nx},${ny}`)) continue;
                if (!this.tiles[ny][nx].walkable) continue;

                const g = current.g + 1;
                const h = heuristic(nx, ny, goalX, goalY);
                const f = g + h;

                const existing = openSet.find(n => n.x === nx && n.y === ny);
                if (existing && existing.g <= g) continue;

                if (existing) {
                    existing.g = g;
                    existing.h = h;
                    existing.f = f;
                    existing.parent = current;
                } else {
                    openSet.push({ x: nx, y: ny, g, h, f, parent: current });
                }
            }
        }
        return null;
    }

    /**
     * Find nearest resource of any type
     */
    _findNearestResource(fromX, fromY, maxDist = 20) {
        let nearest = null;
        let bestDist = maxDist + 1;
        for (const res of this.resources) {
            if (!res.tile || !res.tile.resource) continue;
            const dist = Math.abs(res.x - fromX) + Math.abs(res.y - fromY);
            if (dist < bestDist) {
                bestDist = dist;
                nearest = res;
            }
        }
        return nearest;
    }

    // ======================== TASK QUEUE SYSTEM ========================

    /**
     * Assign a multi-step task to an agent
     * @param {Object} agent
     * @param {Array} steps - [{type:'move',target:{x,y}}, {type:'collect',resource:'tree',amount:15}, ...]
     */
    _assignTask(agent, steps) {
        agent.taskQueue = steps.slice();
        agent.currentTask = steps.length > 0 ? { ...steps[0], progress: 0 } : null;
        agent.path = [];

        if (agent.currentTask && agent.currentTask.type === 'move' && agent.currentTask.target) {
            agent.path = this._findPath(agent.x, agent.y, agent.currentTask.target.x, agent.currentTask.target.y) || [];
        }
    }

    /**
     * Process the current task step for an agent
     */
    _processTask(agent) {
        if (!agent.currentTask) return false;
        const task = agent.currentTask;

        switch (task.type) {
            case 'move': {
                if (agent.path && agent.path.length > 0) {
                    const next = agent.path.shift();
                    if (this.tiles[next.y] && this.tiles[next.y][next.x] && this.tiles[next.y][next.x].walkable) {
                        agent.x = next.x;
                        agent.y = next.y;
                        agent.pixelX = next.x * this.tileSize + this.tileSize / 2;
                        agent.pixelY = next.y * this.tileSize + this.tileSize / 2;
                    }
                    agent.chemicals.fatigue = Math.min(100, agent.chemicals.fatigue + 1);
                    if (agent.path.length === 0) this._advanceTask(agent);
                } else {
                    this._advanceTask(agent);
                }
                return true;
            }

            case 'collect': {
                const tile = this.getTile(agent.x, agent.y);
                if (tile && tile.resource && (!task.resource || tile.resource.type === task.resource)) {
                    tile.resource.amount -= 5;
                    agent.inventory.items.push({ type: tile.resource.type, amount: 5 });
                    agent.chemicals.dopamine = Math.min(100, agent.chemicals.dopamine + 5);
                    task.progress = (task.progress || 0) + 5;
                    if (task.progress >= (task.amount || 10) || tile.resource.amount <= 0) {
                        if (tile.resource.amount <= 0) {
                            tile.resource = null;
                            this.resources = this.resources.filter(r => !(r.x === agent.x && r.y === agent.y));
                        }
                        this._advanceTask(agent);
                    }
                } else {
                    this._advanceTask(agent);
                }
                return true;
            }

            case 'deliver': {
                if (task.target && agent.x === task.target.x && agent.y === task.target.y) {
                    const idx = agent.inventory.items.findIndex(i => i.type === (task.itemType || i.type));
                    if (idx >= 0) {
                        agent.inventory.gold += agent.inventory.items[idx].amount * 2;
                        agent.inventory.items.splice(idx, 1);
                        agent.chemicals.dopamine = Math.min(100, agent.chemicals.dopamine + 15);
                    }
                    this._advanceTask(agent);
                } else if (task.target) {
                    if (!agent.path || agent.path.length === 0) {
                        agent.path = this._findPath(agent.x, agent.y, task.target.x, task.target.y) || [];
                    }
                    if (agent.path.length > 0) {
                        const next = agent.path.shift();
                        if (this.tiles[next.y][next.x].walkable) {
                            agent.x = next.x;
                            agent.y = next.y;
                            agent.pixelX = next.x * this.tileSize + this.tileSize / 2;
                            agent.pixelY = next.y * this.tileSize + this.tileSize / 2;
                        }
                    } else {
                        this._advanceTask(agent);
                    }
                } else {
                    this._advanceTask(agent);
                }
                return true;
            }

            case 'patrol': {
                task.progress = (task.progress || 0) + 1;
                const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                const d = dirs[Math.floor(Math.random() * 4)];
                const px = agent.x + d[0];
                const py = agent.y + d[1];
                if (px >= 0 && px < this.gridWidth && py >= 0 && py < this.gridHeight && this.tiles[py][px].walkable) {
                    agent.x = px;
                    agent.y = py;
                    agent.pixelX = px * this.tileSize + this.tileSize / 2;
                    agent.pixelY = py * this.tileSize + this.tileSize / 2;
                }
                agent.chemicals.fatigue = Math.min(100, agent.chemicals.fatigue + 1);
                if (task.progress >= (task.duration || 20)) this._advanceTask(agent);
                return true;
            }

            case 'rest': {
                task.progress = (task.progress || 0) + 1;
                agent.chemicals.fatigue = Math.max(0, agent.chemicals.fatigue - 5);
                agent.chemicals.stress = Math.max(0, agent.chemicals.stress - 3);
                agent.hp = Math.min(agent.maxHp, agent.hp + 1);
                if (task.progress >= (task.duration || 10)) this._advanceTask(agent);
                return true;
            }

            case 'attack': {
                const target = this.agents.find(a =>
                    a.id !== agent.id &&
                    Math.abs(a.x - agent.x) <= 1 &&
                    Math.abs(a.y - agent.y) <= 1
                );
                if (target) {
                    const dmg = Math.max(1, agent.stats.strength - target.stats.agility / 2);
                    target.hp -= dmg;
                    target.chemicals.stress = Math.min(100, target.chemicals.stress + 20);
                    target.chemicals.adrenaline = Math.min(100, target.chemicals.adrenaline + 30);
                    agent.chemicals.adrenaline = Math.min(100, agent.chemicals.adrenaline + 10);
                }
                this._advanceTask(agent);
                return true;
            }

            default:
                this._advanceTask(agent);
                return true;
        }
    }

    /**
     * Advance to the next step in the task queue
     */
    _advanceTask(agent) {
        if (agent.taskQueue && agent.taskQueue.length > 0) {
            agent.taskQueue.shift();
            if (agent.taskQueue.length > 0) {
                agent.currentTask = { ...agent.taskQueue[0], progress: 0 };
                agent.path = [];
                if (agent.currentTask.type === 'move' && agent.currentTask.target) {
                    agent.path = this._findPath(agent.x, agent.y, agent.currentTask.target.x, agent.currentTask.target.y) || [];
                }
            } else {
                agent.currentTask = null;
                agent.path = [];
            }
        } else {
            agent.currentTask = null;
            agent.path = [];
        }
    }

    /**
     * Auto-assign task based on agent class and chemical needs
     */
    _autoAssignTask(agent) {
        // Tired agents rest first
        if (agent.chemicals.fatigue > 70) {
            this._assignTask(agent, [{ type: 'rest', duration: 8 }]);
            return;
        }

        // Workers and traders seek resources
        if (agent.class === 'worker' || agent.class === 'trader') {
            const res = this._findNearestResource(agent.x, agent.y);
            if (res) {
                this._assignTask(agent, [
                    { type: 'move', target: { x: res.x, y: res.y } },
                    { type: 'collect', resource: res.type, amount: 15 }
                ]);
                return;
            }
        }

        // Warriors and berserkers patrol
        if (agent.class === 'warrior' || agent.class === 'berserker') {
            this._assignTask(agent, [{ type: 'patrol', duration: 15 }]);
            return;
        }

        // Thieves look for other agents to steal from (move toward nearest agent)
        if (agent.class === 'thief') {
            const target = this.agents.find(a =>
                a.id !== agent.id &&
                a.inventory.gold > 10 &&
                Math.abs(a.x - agent.x) + Math.abs(a.y - agent.y) < 15
            );
            if (target) {
                this._assignTask(agent, [
                    { type: 'move', target: { x: target.x, y: target.y } }
                ]);
                return;
            }
        }

        // Mages explore (pick random walkable tile)
        if (agent.class === 'mage') {
            let attempts = 0;
            let tx, ty;
            do {
                tx = Math.floor(Math.random() * this.gridWidth);
                ty = Math.floor(Math.random() * this.gridHeight);
                attempts++;
            } while (attempts < 20 && (!this.tiles[ty][tx].walkable));

            if (this.tiles[ty][tx].walkable) {
                this._assignTask(agent, [
                    { type: 'move', target: { x: tx, y: ty } }
                ]);
            }
        }
    }

    // ======================== EVENT BUS (SCENARIO INTEGRATION) ========================

    /**
     * Connect to event bus to receive scenario events
     * @param {GothamEventBus} eventBus
     */
    connectEventBus(eventBus) {
        this.eventBus = eventBus;

        // AGENT_PANIC — spike stress/adrenaline, high severity interrupts tasks
        eventBus.on('AGENT_PANIC', (data) => {
            const stressMap = { high: 60, medium: 35, low: 15 };
            const adrenalineMap = { high: 50, medium: 25, low: 10 };
            const severity = data.severity || 'medium';

            for (const agent of this.agents) {
                agent.chemicals.stress = Math.min(100, agent.chemicals.stress + (stressMap[severity] || 35));
                agent.chemicals.adrenaline = Math.min(100, agent.chemicals.adrenaline + (adrenalineMap[severity] || 25));
                agent.chemicals.serotonin = Math.max(0, agent.chemicals.serotonin - (stressMap[severity] || 35) / 2);

                if (severity === 'high') {
                    agent.currentTask = null;
                    agent.taskQueue = [];
                    agent.path = [];
                }
            }
        });

        // BUILDING_DAMAGE — damage tiles + hurt nearby agents
        eventBus.on('BUILDING_DAMAGE', (data) => {
            const severity = data.severity || 'medium';
            const dmgRadius = severity === 'high' ? 5 : severity === 'medium' ? 3 : 1;
            const cx = Math.floor(Math.random() * this.gridWidth);
            const cy = Math.floor(Math.random() * this.gridHeight);

            for (let dy = -dmgRadius; dy <= dmgRadius; dy++) {
                for (let dx = -dmgRadius; dx <= dmgRadius; dx++) {
                    const tx = cx + dx;
                    const ty = cy + dy;
                    if (tx >= 0 && tx < this.gridWidth && ty >= 0 && ty < this.gridHeight) {
                        if (Math.random() < 0.5) {
                            this.tiles[ty][tx].type = 'rock';
                            this.tiles[ty][tx].resource = null;
                        }
                    }
                }
            }

            for (const agent of this.agents) {
                const dist = Math.abs(agent.x - cx) + Math.abs(agent.y - cy);
                if (dist <= dmgRadius) {
                    const dmg = (severity === 'high' ? 30 : severity === 'medium' ? 15 : 5) * (1 - dist / (dmgRadius + 1));
                    agent.hp -= dmg;
                    agent.chemicals.stress = Math.min(100, agent.chemicals.stress + 40);
                    agent.chemicals.adrenaline = Math.min(100, agent.chemicals.adrenaline + 50);
                }
            }
        });

        // ECONOMIC_SHOCK — reduce agent gold
        eventBus.on('ECONOMIC_SHOCK', (data) => {
            const mag = data.magnitude || 0.2;
            for (const agent of this.agents) {
                agent.inventory.gold = Math.floor(agent.inventory.gold * (1 - mag));
                agent.chemicals.stress = Math.min(100, agent.chemicals.stress + mag * 30);
                agent.chemicals.dopamine = Math.max(0, agent.chemicals.dopamine - mag * 20);
            }
        });

        // AGENT_INFECT — mark random agents as infected
        eventBus.on('AGENT_INFECT', (data) => {
            const count = data.count || 1;
            const candidates = this.agents.filter(a => !a.infected);
            for (let i = 0; i < Math.min(count, candidates.length); i++) {
                const idx = Math.floor(Math.random() * candidates.length);
                candidates[idx].infected = true;
                candidates[idx].infectedTick = this.tickCount;
                candidates[idx].chemicals.fatigue = Math.min(100, candidates[idx].chemicals.fatigue + 30);
            }
        });

        // SPREAD_INFECTION — infected agents spread to nearby, take ongoing damage
        eventBus.on('SPREAD_INFECTION', () => {
            const infected = this.agents.filter(a => a.infected);
            for (const carrier of infected) {
                for (const agent of this.agents) {
                    if (agent.infected || agent.id === carrier.id) continue;
                    if (Math.abs(agent.x - carrier.x) <= 2 && Math.abs(agent.y - carrier.y) <= 2) {
                        if (Math.random() < 0.3) {
                            agent.infected = true;
                            agent.infectedTick = this.tickCount;
                            agent.chemicals.fatigue = Math.min(100, agent.chemicals.fatigue + 20);
                        }
                    }
                }
                carrier.hp -= 2;
                carrier.chemicals.fatigue = Math.min(100, carrier.chemicals.fatigue + 5);
            }
        });

        // SCEN_START — announce scenario to tile world
        eventBus.on('SCEN_START', (data) => {
            console.log(`[TileWorld] Scenario started: ${data.name}`);
        });

        // SCEN_END — clear infection flags on scenario end
        eventBus.on('SCEN_END', () => {
            for (const agent of this.agents) {
                agent.infected = false;
            }
        });

        console.log('[TileWorldEngine] Connected to event bus - scenario events wired');
    }

    /**
     * Clean up resources and event listeners
     */
    destroy() {
        this.isRunning = false;
        this.canvas.removeEventListener('click', this._handleClick);
        this.saveAgentState();
        
        // Dispatch engine-destroyed event
        const event = new CustomEvent('engine-destroyed', {
            detail: { latitude: this.latitude, longitude: this.longitude }
        });
        this.canvas.dispatchEvent(event);
    }

    /**
     * Set camera position
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    setCamera(x, y) {
        this.camera.x = x;
        this.camera.y = y;
    }

    /**
     * Set camera zoom level
     * @param {number} zoom - Zoom level (1 = normal)
     */
    setZoom(zoom) {
        this.camera.zoom = Math.max(0.5, Math.min(3, zoom));
    }

    /**
     * Get tile at world coordinates
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     * @returns {Object|null} Tile object or null
     */
    getTile(x, y) {
        if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
            return this.tiles[y][x];
        }
        return null;
    }

    /**
     * Get agent at grid position
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     * @returns {Object|null} Agent or null
     */
    getAgentAt(x, y) {
        return this.agents.find(agent => agent.x === x && agent.y === y) || null;
    }
}

// Expose to window for browser
window.TileWorldEngine = TileWorldEngine;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TileWorldEngine, AgentBrain, AgentChemicalState };
}

console.log('[TileWorldEngine] v2.0 loaded - A* pathfinding, task queue, scenario integration');
