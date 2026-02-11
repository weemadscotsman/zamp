@tool
class_name CrosswordArchitect
extends RefCounted

# CROSSWORD ARCHITECT
# Constraint-satisfaction architecture design system
# 
# Usage:
#   var architect = CrosswordArchitect.new()
#   architect.define_axis("narrative", ["linear", "branching", "open_world"])
#   architect.define_axis("mechanics", ["turn_based", "real_time", "hybrid"])
#   architect.add_slot("combat_system", ["mechanics", "narrative"])
#   var solution = architect.solve()
#
# Every candidate is validated against ALL intersecting axes before selection.

# ============================================
# CONFIGURATION
# ============================================

# Axes of concern (e.g., "narrative", "mechanics", "persistence")
var axes: Dictionary = {}

# Slots at axis intersections (e.g., "combat_system" touches "mechanics" + "narrative")
var slots: Dictionary = {}

# Candidates for each slot
var candidates: Dictionary = {}

# Constraints between slots
var cross_constraints: Array = []

# ============================================
# SETUP API
# ============================================

func define_axis(axis_name: String, valid_values: Array):
	"""Define an architectural axis with valid values."""
	axes[axis_name] = {
		"name": axis_name,
		"values": valid_values,
		"weight": 1.0  # Importance in coherence calculation
	}
	print("[CrosswordArchitect] Defined axis: ", axis_name, " with ", valid_values.size(), " values")

func set_axis_weight(axis_name: String, weight: float):
	"""Set importance weight for an axis (0.0 to 2.0)."""
	if axes.has(axis_name):
		axes[axis_name].weight = weight

func add_slot(slot_name: String, intersecting_axes: Array, metadata: Dictionary = {}):
	"""Define a slot at the intersection of multiple axes."""
	slots[slot_name] = {
		"name": slot_name,
		"axes": intersecting_axes,
		"metadata": metadata,
		"selected_candidate": null
	}
	candidates[slot_name] = []
	print("[CrosswordArchitect] Added slot: ", slot_name, " at intersection of ", intersecting_axes)

func add_candidate(slot_name: String, candidate_id: String, properties: Dictionary, coherence_hints: Dictionary = {}):
	"""Add a candidate solution for a slot.
	
	Args:
		slot_name: Which slot this candidate fills
		candidate_id: Unique identifier (e.g., "visual_novel", "top_down_rpg")
		properties: What this candidate provides for each axis
		coherence_hints: Bonus/malus for specific axis combinations
	"""
	if not slots.has(slot_name):
		push_error("Slot not found: " + slot_name)
		return
	
	var candidate = {
		"id": candidate_id,
		"slot": slot_name,
		"properties": properties,
		"coherence_hints": coherence_hints,
		"validation_score": 0.0,
		"cross_validations": {}  # Results from checking against other slots
	}
	
	candidates[slot_name].append(candidate)

func add_cross_constraint(from_slot: String, to_slot: String, validation_func: Callable):
	"""Add a constraint between two slots.
	
	Example: combat_system and narrative_system must agree on pacing
	"""
	cross_constraints.append({
		"from": from_slot,
		"to": to_slot,
		"validate": validation_func
	})

# ============================================
# SOLVING ENGINE
# ============================================

func solve() -> Dictionary:
	"""Solve the crossword - find coherent configuration of all slots.
	
	Returns:
		Dictionary mapping slot_name -> selected_candidate
	"""
	print("\n[CrosswordArchitect] ===== BEGINNING SOLVE =====")
	
	# Step 1: Validate all candidates locally (within their slot)
	_validate_local_candidates()
	
	# Step 2: Cross-validate candidates against intersecting constraints
	_validate_cross_constraints()
	
	# Step 3: Score all valid combinations
	var valid_solutions = _generate_valid_solutions()
	
	if valid_solutions.is_empty():
		push_error("[CrosswordArchitect] No valid solutions found! Constraints too tight.")
		return {}
	
	print("[CrosswordArchitect] Found ", valid_solutions.size(), " valid solutions")
	
	# Step 4: Select best solution by coherence score
	var best_solution = _select_best_solution(valid_solutions)
	
	print("[CrosswordArchitect] ===== SOLVE COMPLETE =====\n")
	
	return best_solution

func _validate_local_candidates():
	"""Check each candidate satisfies its slot's axis requirements."""
	for slot_name in slots.keys():
		var slot = slots[slot_name]
		var slot_candidates = candidates[slot_name]
		
		for candidate in slot_candidates:
			var score = 0.0
			var valid = true
			
			# Check candidate provides valid value for each axis
			for axis_name in slot.axes:
				if not axes.has(axis_name):
					valid = false
					continue
				
				var axis = axes[axis_name]
				var candidate_value = candidate.properties.get(axis_name, null)
				
				if candidate_value == null:
					valid = false
				elif not axis.values.has(candidate_value):
					push_warning("Candidate ", candidate.id, " has invalid value for axis ", axis_name)
					valid = false
				else:
					score += axis.weight
			
			candidate.validation_score = score if valid else -1.0

func _validate_cross_constraints():
	"""Check candidates against constraints with other slots."""
	for constraint in cross_constraints:
		var from_slot = constraint.from
		var to_slot = constraint.to
		var validate_func = constraint.validate
		
		if not candidates.has(from_slot) or not candidates.has(to_slot):
			continue
		
		for from_candidate in candidates[from_slot]:
			from_candidate.cross_validations[to_slot] = {}
			
			for to_candidate in candidates[to_slot]:
				var compatible = validate_func.call(from_candidate, to_candidate)
				from_candidate.cross_validations[to_slot][to_candidate.id] = compatible
				
				if not compatible:
					from_candidate.validation_score -= 0.5  # Penalty

func _generate_valid_solutions() -> Array:
	"""Generate all valid combinations of candidates."""
	var solutions = []
	var slot_names = slots.keys()
	
	if slot_names.is_empty():
		return solutions
	
	# Use recursive backtracking for combination generation
	_generate_combinations_recursive(slot_names, 0, {}, solutions)
	
	return solutions

func _generate_combinations_recursive(slot_names: Array, index: int, current: Dictionary, solutions: Array):
	"""Recursively build valid combinations."""
	if index >= slot_names.size():
		# Complete solution - check if globally valid
		if _is_globally_valid(current):
			solutions.append(current.duplicate())
		return
	
	var slot_name = slot_names[index]
	var slot_candidates = candidates[slot_name]
	
	for candidate in slot_candidates:
		# Skip invalid candidates
		if candidate.validation_score < 0:
			continue
		
		current[slot_name] = candidate
		
		# Early pruning - check partial validity
		if _is_partially_valid(current, slot_names.slice(0, index + 1)):
			_generate_combinations_recursive(slot_names, index + 1, current, solutions)
		
		current.erase(slot_name)

func _is_partially_valid(solution: Dictionary, checked_slots: Array) -> bool:
	"""Check if current partial solution is valid so far."""
	for constraint in cross_constraints:
		var from_slot = constraint.from
		var to_slot = constraint.to
		
		# Only check if both slots are in our partial solution
		if checked_slots.has(from_slot) and checked_slots.has(to_slot):
			if not solution.has(from_slot) or not solution.has(to_slot):
				return false
			
			var from_candidate = solution[from_slot]
			var to_candidate = solution[to_slot]
			
			if not from_candidate.cross_validations.has(to_slot):
				return false
			if not from_candidate.cross_validations[to_slot].get(to_candidate.id, false):
				return false
	
	return true

func _is_globally_valid(solution: Dictionary) -> bool:
	"""Check if complete solution satisfies all constraints."""
	for constraint in cross_constraints:
		var from_slot = constraint.from
		var to_slot = constraint.to
		
		if not solution.has(from_slot) or not solution.has(to_slot):
			return false
		
		var from_candidate = solution[from_slot]
		var to_candidate = solution[to_slot]
		
		if not from_candidate.cross_validations.has(to_slot):
			return false
		if not from_candidate.cross_validations[to_slot].get(to_candidate.id, false):
			return false
	
	return true

func _select_best_solution(solutions: Array) -> Dictionary:
	"""Score solutions and return the best one."""
	var best_solution = null
	var best_score = -999999.0
	
	for solution in solutions:
		var score = _score_solution(solution)
		
		if score > best_score:
			best_score = score
			best_solution = solution
	
	# Print solution summary
	print("[CrosswordArchitect] Best solution (score: ", best_score, "):")
	for slot_name in best_solution.keys():
		var candidate = best_solution[slot_name]
		print("  ", slot_name, " → ", candidate.id)
	
	return best_solution

func _score_solution(solution: Dictionary) -> float:
	"""Calculate coherence score for a solution."""
	var total_score = 0.0
	
	for slot_name in solution.keys():
		var candidate = solution[slot_name]
		
		# Base validation score
		total_score += candidate.validation_score
		
		# Coherence hints bonus
		for hint_axis in candidate.coherence_hints.keys():
			var hint = candidate.coherence_hints[hint_axis]
			if hint is float:
				total_score += hint
			elif hint is Dictionary:
				# Check if hint condition is met
				var condition_met = true
				for check_slot in hint.conditions:
					if solution.has(check_slot):
						var other_candidate = solution[check_slot]
						if other_candidate.id != hint.conditions[check_slot]:
							condition_met = false
							break
				
				if condition_met:
					total_score += hint.bonus
	
	# Diversity bonus (prefer varied approaches)
	var used_candidates = {}
	for candidate in solution.values():
		used_candidates[candidate.id] = used_candidates.get(candidate.id, 0) + 1
	
	for count in used_candidates.values():
		if count > 1:
			total_score -= (count - 1) * 0.5  # Penalty for repetition
	
	return total_score

# ============================================
# ANALYSIS API
# ============================================

func analyze_solution(solution: Dictionary) -> Dictionary:
	"""Generate detailed analysis of a solution."""
	var analysis = {
		"slots_filled": solution.size(),
		"total_score": _score_solution(solution),
		"coherence_matrix": {},
		"warnings": [],
		"recommendations": []
	}
	
	# Build coherence matrix
	for slot_name in solution.keys():
		var candidate = solution[slot_name]
		analysis.coherence_matrix[slot_name] = {
			"candidate": candidate.id,
			"score": candidate.validation_score,
			"axes": slots[slot_name].axes,
			"properties": candidate.properties
		}
	
	# Check for potential issues
	for slot_name in solution.keys():
		var candidate = solution[slot_name]
		if candidate.validation_score < 2.0:
			analysis.warnings.append("Low validation score for " + slot_name)
	
	return analysis

func export_solution_json(solution: Dictionary) -> String:
	"""Export solution to JSON for documentation."""
	var data = {
		"architecture": {},
		"metadata": {
			"timestamp": Time.get_datetime_string_from_system(),
			"axes_defined": axes.keys(),
			"slots_count": slots.size()
		}
	}
	
	for slot_name in solution.keys():
		var candidate = solution[slot_name]
		data.architecture[slot_name] = {
			"implementation": candidate.id,
			"properties": candidate.properties,
			"coherence_hints": candidate.coherence_hints
		}
	
	return JSON.stringify(data, "\t")
