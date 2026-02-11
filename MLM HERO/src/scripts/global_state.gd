extends Node

# =============================================================================
# GLOBAL PLAYER STATE BRAIN
# The single source of truth for ALL game state
# Persists across ALL scenes and phases
# =============================================================================

# --- CORE IDENTITY ---
var player_name: String = "You"
var current_phase: String = "opening"  # opening, social, recruitment, investigation, infiltration, ending

# --- STORY PROGRESSION ---
var story_path: String = ""  # "joined", "questioned", "ignored", "infiltrator", "resistance"
var path_history: Array = []  # Tracks every major decision
var current_chapter: int = 1
var max_chapters: int = 5

# --- EVIDENCE SYSTEM (Universal) ---
var evidence_collection: Dictionary = {
	# Phase 1: Social Media discoveries
	"sarah_income_claims": {"found": false, "phase": "social", "strength": 1, "category": "income"},
	"mlm_denial": {"found": false, "phase": "social", "strength": 1, "category": "deception"},
	"urgency_tactics": {"found": false, "phase": "social", "strength": 1, "category": "pressure"},
	
	# Phase 2a: Recruitment discoveries  
	"fabricated_success": {"found": false, "phase": "recruitment", "strength": 2, "category": "deception"},
	"pressure_scripts": {"found": false, "phase": "recruitment", "strength": 2, "category": "pressure"},
	"victim_testimonies": {"found": false, "phase": "recruitment", "strength": 3, "category": "harm"},
	
	# Phase 2b: Investigation discoveries
	"income_disclosure": {"found": false, "phase": "investigation", "strength": 3, "category": "income"},
	"company_history": {"found": false, "phase": "investigation", "strength": 2, "category": "deception"},
	"shell_companies": {"found": false, "phase": "investigation", "strength": 4, "category": "deception"},
	"legal_complaints": {"found": false, "phase": "investigation", "strength": 3, "category": "harm"},
	
	# Phase 3: Infiltration discoveries
	"internal_emails": {"found": false, "phase": "infiltration", "strength": 4, "category": "deception"},
	"financial_records": {"found": false, "phase": "infiltration", "strength": 5, "category": "income"},
	"rebrand_strategy": {"found": false, "phase": "infiltration", "strength": 4, "category": "deception"},
	"victim_database": {"found": false, "phase": "infiltration", "strength": 5, "category": "harm"}
}

# Computed property for total evidence
func get_total_evidence() -> int:
	var count = 0
	for key in evidence_collection:
		if evidence_collection[key].found:
			count += 1
	return count

func get_evidence_by_category(category: String) -> int:
	var count = 0
	for key in evidence_collection:
		if evidence_collection[key].found and evidence_collection[key].category == category:
			count += 1
	return count

func get_evidence_strength() -> int:
	var strength = 0
	for key in evidence_collection:
		if evidence_collection[key].found:
			strength += evidence_collection[key].strength
	return strength

# --- SOCIAL STATS (Phase 1 carryover) ---
var followers: int = 847
var reputation: int = 50  # 0 = scammer, 100 = whistleblower
var engagement_rate: float = 0.05

# --- MORAL STATS (Phase 2a carryover) ---
var guilt: int = 0  # 0-100, affects dialogue options and endings
var self_awareness: int = 0  # Realization it's a scam
var recruits_made: int = 0
var recruits_lost_money: int = 0  # Tracks harm you've caused

# --- INVESTIGATION STATS (Phase 2b carryover) ---
var research_stamina: int = 100
var investigation_suspicion: int = 0  # If too high, they notice you
var leads_discovered: Array = []
var connections_mapped: int = 0

# --- INFILTRATION STATS (Phase 3 carryover) ---
var infiltration_suspicion: float = 0.0
var documents_stolen: int = 0
var times_spotted: int = 0

# --- BRAINROT / MENTAL STATE ---
var brainrot_resistance: int = 50  # Affects attention mini-games
var times_brainrot_triggered: int = 0
var critical_thinking: int = 10  # Grows with skepticism

# --- UNIFIED PRIMARY STATS (The Big 4) ---
var money: int = 500
var confidence: int = 20
var skepticism: int = 5  # THE key stat - affects everything
var stress: int = 10

func update_big_four():
	# These 4 stats are derived from everything else
	# and affect gameplay across ALL phases
	
	# Money: Base + recruits affect this negatively
	money = 500 - (recruits_made * 50) - get_evidence_strength() * 10
	
	# Confidence: Followers help, guilt hurts
	confidence = 20 + int(followers / 100) - int(guilt / 5)
	
	# Skepticism: The master stat
	# Grows with evidence, self-awareness, investigation
	skepticism = 5 + get_total_evidence() * 3 + int(self_awareness / 3) + connections_mapped * 5
	skepticism = min(skepticism, 100)  # Cap at 100
	
	# Stress: Everything adds to this
	stress = 10 + guilt + investigation_suspicion + times_spotted * 10 + times_brainrot_triggered * 5
	stress = min(stress, 100)

# --- ENDING MODIFIERS ---
var ending_flags: Dictionary = {
	"perfect_infiltration": false,
	"saved_victims": false,
	"exposed_publicly": false,
	"brought_down_syndicate": false,
	"redeemed_guilt": false,
	"warned_others": false
}

# --- UNLOCK FLAGS ---
var unlocked_phases: Array = ["opening", "social"]
var unlocked_areas: Dictionary = {}
var story_flags: Dictionary = {}

# --- SAVE/LOAD SYSTEM ---
func save_game():
	var save_data = {
		"player_name": player_name,
		"current_phase": current_phase,
		"story_path": story_path,
		"path_history": path_history,
		"evidence_collection": evidence_collection,
		"followers": followers,
		"reputation": reputation,
		"guilt": guilt,
		"self_awareness": self_awareness,
		"recruits_made": recruits_made,
		"skepticism": skepticism,
		"ending_flags": ending_flags
	}
	
	var save_file = FileAccess.open("user://mlm_hero_save.save", FileAccess.WRITE)
	if save_file:
		save_file.store_var(save_data)
		save_file.close()
		print("Game saved!")

func load_game() -> bool:
	if not FileAccess.file_exists("user://mlm_hero_save.save"):
		return false
	
	var save_file = FileAccess.open("user://mlm_hero_save.save", FileAccess.READ)
	if save_file:
		var save_data = save_file.get_var()
		save_file.close()
		
		# Restore all state
		player_name = save_data.get("player_name", "You")
		current_phase = save_data.get("current_phase", "opening")
		story_path = save_data.get("story_path", "")
		path_history = save_data.get("path_history", [])
		evidence_collection = save_data.get("evidence_collection", evidence_collection)
		followers = save_data.get("followers", 847)
		reputation = save_data.get("reputation", 50)
		guilt = save_data.get("guilt", 0)
		self_awareness = save_data.get("self_awareness", 0)
		recruits_made = save_data.get("recruits_made", 0)
		skepticism = save_data.get("skepticism", 5)
		ending_flags = save_data.get("ending_flags", ending_flags)
		
		update_big_four()
		print("Game loaded!")
		return true
	
	return false

func has_save() -> bool:
	return FileAccess.file_exists("user://mlm_hero_save.save")

# --- PHASE TRANSITION LOGIC ---
func transition_to_phase(new_phase: String, context: Dictionary = {}):
	# Record the transition
	path_history.append({
		"from": current_phase,
		"to": new_phase,
		"context": context,
		"timestamp": Time.get_time_dict_from_system()
	})
	
	# Update phase
	current_phase = new_phase
	
	# Auto-save on phase transition
	save_game()
	
	# Update derived stats
	update_big_four()

# --- STAT INTERACTIONS (Gameplay Loop Reinforcement) ---
func calculate_recruitment_success(base_chance: float) -> float:
	# Followers boost success
	var follower_bonus = followers / 5000.0  # 0-0.2 bonus
	
	# Reputation matters
	var rep_multiplier = reputation / 100.0
	
	# But guilt hurts your pitch
	var guilt_penalty = guilt / 200.0
	
	return base_chance + follower_bonus + rep_multiplier - guilt_penalty

func calculate_infiltration_suspicion_rate() -> float:
	# High skepticism = better at staying hidden
	var skeptic_bonus = skepticism / 100.0
	
	# Evidence helps you know what to avoid
	var evidence_bonus = get_total_evidence() / 20.0
	
	# But stress makes you sloppy
	var stress_penalty = stress / 200.0
	
	return 1.0 - skeptic_bonus - evidence_bonus + stress_penalty

func calculate_investigation_efficiency() -> float:
	# Skepticism = pattern recognition
	var base = 0.5 + (skepticism / 200.0)
	
	# Brainrot resistance = attention span
	var focus_bonus = brainrot_resistance / 200.0
	
	# Stress = mistakes
	var stress_penalty = stress / 300.0
	
	return base + focus_bonus - stress_penalty

func should_trigger_brainrot() -> bool:
	# Brainrot triggers when you're not thinking critically
	var vulnerability = 100 - skepticism - brainrot_resistance + stress / 2
	return randi() % 100 < vulnerability

# --- UTILITY FUNCTIONS ---
func add_evidence(evidence_id: String) -> bool:
	if evidence_collection.has(evidence_id) and not evidence_collection[evidence_id].found:
		evidence_collection[evidence_id].found = true
		skepticism += evidence_collection[evidence_id].strength
		update_big_four()
		return true
	return false

func add_path_history(decision: String, details: Dictionary = {}):
	path_history.append({
		"decision": decision,
		"phase": current_phase,
		"details": details,
		"timestamp": Time.get_time_dict_from_system()
	})

func reset():
	player_name = "You"
	current_phase = "opening"
	story_path = ""
	path_history.clear()
	
	for key in evidence_collection:
		evidence_collection[key].found = false
	
	followers = 847
	reputation = 50
	engagement_rate = 0.05
	
	guilt = 0
	self_awareness = 0
	recruits_made = 0
	recruits_lost_money = 0
	
	research_stamina = 100
	investigation_suspicion = 0
	leads_discovered.clear()
	connections_mapped = 0
	
	infiltration_suspicion = 0.0
	documents_stolen = 0
	times_spotted = 0
	
	brainrot_resistance = 50
	times_brainrot_triggered = 0
	critical_thinking = 10
	
	money = 500
	confidence = 20
	skepticism = 5
	stress = 10
	
	ending_flags = {
		"perfect_infiltration": false,
		"saved_victims": false,
		"exposed_publicly": false,
		"brought_down_syndicate": false,
		"redeemed_guilt": false,
		"warned_others": false
	}
	
	unlocked_phases = ["opening", "social"]
	unlocked_areas.clear()
	story_flags.clear()

func _ready():
	update_big_four()
	print("Global State Brain initialized!")
