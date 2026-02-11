extends Node

# MLM HERO - CrosswordArchitect Example
# Demonstrates how the architectural constraint system works

func _ready():
	demonstrate_architect()

func demonstrate_architect():
	print("\n" + "=".repeat(70))
	print("  CROSSWORD ARCHITECT - MLM HERO EXAMPLE")
	print("=".repeat(70) + "\n")
	
	# Create architect
	var architect = CrosswordArchitect.new()
	
	# ============================================
	# STEP 1: Define Axes (Concerns)
	# ============================================
	print("📐 DEFINING ARCHITECTURAL AXES\n")
	
	architect.define_axis("narrative_delivery", [
		"linear",           # Story A → B → C
		"branching",        # Player choices matter
		"emergent",         # Story from gameplay
		"hybrid"            # Mix of above
	])
	
	architect.define_axis("mechanic_type", [
		"visual_novel",     # Reading, clicking
		"exploration",      # Walking, talking
		"stealth",          # Hiding, evading
		"puzzle",           # Problem solving
		"hybrid"
	])
	
	architect.define_axis("persistence_model", [
		"scene_based",      # Reset per scene
		"checkpoint",       # Save at milestones
		"continuous",       # Always saving
		"global_state"      # Shared across phases
	])
	
	architect.define_axis("ui_paradigm", [
		"screen_based",     # Full screen changes
		"overlay",          # HUD on top
		"diegetic",         # UI in world
		"hybrid"
	])
	
	# Set weights (some axes matter more)
	architect.set_axis_weight("persistence_model", 1.5)  # Critical for coherence
	
	# ============================================
	# STEP 2: Define Slots (Intersections)
	# ============================================
	print("\n🎯 DEFINING ARCHITECTURAL SLOTS\n")
	
	architect.add_slot("phase1_opening", ["narrative_delivery", "mechanic_type"], {
		"description": "How player first experiences the game"
	})
	
	architect.add_slot("phase2_recruitment", ["narrative_delivery", "mechanic_type", "persistence_model"], {
		"description": "Moral dilemma gameplay"
	})
	
	architect.add_slot("phase2_investigation", ["narrative_delivery", "mechanic_type", "persistence_model"], {
		"description": "Evidence collection gameplay"
	})
	
	architect.add_slot("phase3_infiltration", ["mechanic_type", "persistence_model", "ui_paradigm"], {
		"description": "Stealth mission"
	})
	
	architect.add_slot("global_ui", ["ui_paradigm", "persistence_model"], {
		"description": "Consistent UI across all phases"
	})
	
	# ============================================
	# STEP 3: Add Candidates (Possible Solutions)
	# ============================================
	print("\n💡 ADDING CANDIDATE SOLUTIONS\n")
	
	# PHASE 1 CANDIDATES
	architect.add_candidate("phase1_opening", "static_vn", {
		"narrative_delivery": "linear",
		"mechanic_type": "visual_novel"
	}, {
		"persistence_model": -0.5  # Weak for persistence
	})
	
	architect.add_candidate("phase1_opening", "social_media_sim", {
		"narrative_delivery": "emergent",
		"mechanic_type": "exploration"
	}, {
		"persistence_model": 1.0,  # Strong stats tracking
		"ui_paradigm": 0.5
	})
	
	architect.add_candidate("phase1_opening", "bedroom_exploration", {
		"narrative_delivery": "hybrid",
		"mechanic_type": "exploration"
	}, {
		"persistence_model": 1.2,  # Very strong
		"ui_paradigm": 1.0
	})
	
	# PHASE 2A (RECRUITMENT) CANDIDATES
	architect.add_candidate("phase2_recruitment", "choice_dialogue", {
		"narrative_delivery": "branching",
		"mechanic_type": "visual_novel",
		"persistence_model": "global_state"
	})
	
	architect.add_candidate("phase2_recruitment", "moral_minigame", {
		"narrative_delivery": "emergent",
		"mechanic_type": "puzzle",
		"persistence_model": "global_state"
	}, {
		"narrative_delivery": 1.5  # Great for moral weight
	})
	
	architect.add_candidate("phase2_recruitment", "recruitment_rpg", {
		"narrative_delivery": "hybrid",
		"mechanic_type": "exploration",
		"persistence_model": "global_state"
	}, {
		"mechanic_type": 1.2,
		"ui_paradigm": 0.8
	})
	
	# PHASE 2B (INVESTIGATION) CANDIDATES
	architect.add_candidate("phase2_investigation", "point_click", {
		"narrative_delivery": "emergent",
		"mechanic_type": "exploration",
		"persistence_model": "global_state"
	})
	
	architect.add_candidate("phase2_investigation", "research_system", {
		"narrative_delivery": "branching",
		"mechanic_type": "puzzle",
		"persistence_model": "global_state"
	})
	
	# PHASE 3 (INFILTRATION) CANDIDATES
	architect.add_candidate("phase3_infiltration", "stealth_grid", {
		"mechanic_type": "stealth",
		"persistence_model": "global_state",
		"ui_paradigm": "overlay"
	}, {
		"mechanic_type": 1.5,  # Pure stealth
		"ui_paradigm": 1.0
	})
	
	architect.add_candidate("phase3_infiltration", "narrative_stealth", {
		"mechanic_type": "hybrid",
		"persistence_model": "global_state",
		"ui_paradigm": "hybrid"
	})
	
	// GLOBAL UI CANDIDATES
	architect.add_candidate("global_ui", "shared_hud", {
		"ui_paradigm": "overlay",
		"persistence_model": "global_state"
	}, {
		"ui_paradigm": 2.0,  # Excellent consistency
		"persistence_model": 1.5
	})
	
	architect.add_candidate("global_ui", "contextual_ui", {
		"ui_paradigm": "diegetic",
		"persistence_model": "continuous"
	})
	
	# ============================================
	# STEP 4: Add Cross-Constraints
	# ============================================
	print("\n🔗 ADDING CROSS-CONSTRAINTS\n")
	
	# Recruitment and Investigation should feel similar (both Phase 2)
	architect.add_cross_constraint("phase2_recruitment", "phase2_investigation", 
		func(a, b): return a.properties.mechanic_type == b.properties.mechanic_type or a.properties.mechanic_type == "hybrid" or b.properties.mechanic_type == "hybrid"
	)
	
	# Phase 3 should differ from Phase 2 (contrast)
	architect.add_cross_constraint("phase2_recruitment", "phase3_infiltration",
		func(a, b): return a.properties.mechanic_type != b.properties.mechanic_type
	)
	
	# Global UI must work with all phases
	architect.add_cross_constraint("global_ui", "phase3_infiltration",
		func(ui, phase): 
			if ui.properties.ui_paradigm == "overlay" and phase.properties.mechanic_type == "stealth":
				return true  # Stealth meter as overlay works
			return true  # Always allow, just score differently
	)
	
	# Phase 1 should hint at Phase 2 mechanics
	architect.add_cross_constraint("phase1_opening", "phase2_recruitment",
		func(p1, p2): 
			# If phase 1 is exploration, phase 2 should be too (consistency)
			if p1.properties.mechanic_type == "exploration":
				return p2.properties.mechanic_type == "exploration" or p2.properties.mechanic_type == "hybrid"
			return true
	)
	
	# ============================================
	# STEP 5: SOLVE
	# ============================================
	print("\n🧩 SOLVING ARCHITECTURE...\n")
	
	var solution = architect.solve()
	
	# ============================================
	# STEP 6: Analyze Results
	# ============================================
	print("\n📊 ANALYSIS\n")
	
	var analysis = architect.analyze_solution(solution)
	print("Total slots filled: ", analysis.slots_filled)
	print("Coherence score: ", analysis.total_score)
	print("\nCoherence Matrix:")
	
	for slot_name in analysis.coherence_matrix.keys():
		var data = analysis.coherence_matrix[slot_name]
		print("  ", slot_name, ":")
		print("    → ", data.candidate)
		print("    → Score: ", data.score)
		print("    → Axes: ", data.axes)
	
	if analysis.warnings.size() > 0:
		print("\n⚠️ Warnings:")
		for warning in analysis.warnings:
			print("  - ", warning)
	
	# Export to JSON
	print("\n📝 EXPORTING TO JSON:\n")
	var json = architect.export_solution_json(solution)
	print(json)
	
	print("\n" + "=".repeat(70))
	print("  ARCHITECTURE DESIGN COMPLETE")
	print("=".repeat(70) + "\n")
