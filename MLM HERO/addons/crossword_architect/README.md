# CrosswordArchitect
## Constraint-Satisfaction Architecture Design for Godot

---

## What Is This?

**CrosswordArchitect** formalizes the design methodology used throughout MLM HERO:

Instead of designing features linearly (A → B → C), you design them as a **crossword puzzle** where every piece must satisfy multiple intersecting constraints.

### The Core Insight

Most architectural failures happen because:
- ❌ Systems are designed in isolation
- ❌ Integration happens too late
- ❌ Local optimization breaks global coherence

**CrosswordArchitect** solves this by:
- ✅ Validating every candidate against ALL relevant axes
- ✅ Checking cross-dependencies between systems
- ✅ Scoring solutions by global coherence

---

## Quick Start

```gdscript
# 1. Create architect
var architect = CrosswordArchitect.new()

# 2. Define axes of concern
architect.define_axis("narrative", ["linear", "branching", "emergent"])
architect.define_axis("mechanics", ["turn_based", "real_time", "hybrid"])

# 3. Define slots (where axes intersect)
architect.add_slot("combat", ["narrative", "mechanics"])

# 4. Add candidate solutions
architect.add_candidate("combat", "tactical_vn", {
    "narrative": "branching",
    "mechanics": "turn_based"
})

architect.add_candidate("combat", "action_qte", {
    "narrative": "linear",
    "mechanics": "real_time"
})

# 5. Solve
var solution = architect.solve()
# Returns: {"combat": <best candidate>}
```

---

## API Reference

### Setup

#### `define_axis(axis_name: String, valid_values: Array)`
Define an architectural axis with valid values.

```gdscript
architect.define_axis("persistence", ["none", "checkpoint", "continuous"])
```

#### `set_axis_weight(axis_name: String, weight: float)`
Set importance weight (0.0 to 2.0). Higher = more important for coherence.

#### `add_slot(slot_name: String, intersecting_axes: Array, metadata: Dictionary = {})`
Define a slot at the intersection of multiple axes.

```gdscript
architect.add_slot("save_system", ["persistence", "ui", "platform"])
```

#### `add_candidate(slot_name: String, candidate_id: String, properties: Dictionary, coherence_hints: Dictionary = {})`
Add a possible solution for a slot.

```gdscript
architect.add_candidate("save_system", "auto_save", {
    "persistence": "continuous",
    "ui": "overlay",
    "platform": "universal"
}, {
    "persistence": 1.5,  # Bonus for this axis
    "ui": 0.5
})
```

### Constraints

#### `add_cross_constraint(from_slot: String, to_slot: String, validation_func: Callable)`
Add a constraint between two slots.

```gdscript
architect.add_cross_constraint("combat", "narrative",
    func(combat, narrative):
        # Combat must match narrative pacing
        if narrative.properties.pacing == "slow":
            return combat.properties.speed != "fast"
        return true
)
```

### Solving

#### `solve() -> Dictionary`
Find the optimal configuration of all slots.

Returns a dictionary mapping slot names to selected candidates.

### Analysis

#### `analyze_solution(solution: Dictionary) -> Dictionary`
Get detailed analysis including coherence matrix and warnings.

#### `export_solution_json(solution: Dictionary) -> String`
Export to JSON for documentation.

---

## Example: MLM HERO Architecture

See `src/scripts/mlm_architect_example.gd` for a complete working example.

This shows how the actual MLM HERO architecture was designed using this tool:
- 4 axes (narrative_delivery, mechanic_type, persistence_model, ui_paradigm)
- 5 slots (phase1, phase2a, phase2b, phase3, global_ui)
- 15+ candidate solutions
- Cross-constraints between phases

---

## The Methodology

### Step 1: Identify Axes
What dimensions matter for your project?
- Narrative structure?
- Gameplay mechanics?
- Persistence model?
- UI paradigm?
- Platform constraints?

### Step 2: Map Slots
Where do these axes intersect?
- "Combat system" touches mechanics + narrative + audio
- "Save system" touches persistence + UI + platform

### Step 3: Generate Candidates
For each slot, brainstorm 2-4 approaches.

### Step 4: Add Constraints
What must be true between slots?
- Phase 1 and Phase 2 should feel consistent
- Phase 3 should contrast with Phase 2
- Global UI must work with all phases

### Step 5: Solve
Let the algorithm find the globally optimal configuration.

---

## Why This Works

### Traditional Design
```
Design combat → Design narrative → Integrate → Fix conflicts
```
Result: Integration hell, cut features, technical debt

### CrosswordArchitect Design
```
Define all constraints first → Generate valid solutions → Pick best
```
Result: Coherent architecture, no integration surprises

---

## Installation

1. Copy `addons/crossword_architect/` to your project's `addons/` folder
2. Enable in Project Settings → Plugins
3. Use via code or the dock panel

---

## Integration with DreamForge

This tool is the formalization of DreamForge's architectural validation.

Use it to:
- Validate spec documents before implementation
- Compare multiple architectural approaches
- Document design decisions with rigor
- Ensure consistency across large projects

---

## License

MIT - Use it, extend it, make better games.

---

## Credits

Inspired by:
- Constraint Satisfaction Problems (CSP)
- Design Structure Matrices (DSM)
- The chaotic but effective design process of MLM HERO
