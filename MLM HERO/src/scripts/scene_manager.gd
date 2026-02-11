extends Node

var stats: PlayerStats
var scenes_data: Dictionary = {}
var current_scene_id: String = ""
var current_dialogue_index: int = 0
var current_scene_data: Dictionary = {}
var waiting_for_choice: bool = false
var ui_node: Control = null

signal dialogue_updated(text: String, speaker: String)
signal choices_ready(choices: Array)
signal stats_changed()
signal scene_loaded(scene_id: String)

func _ready():
	stats = PlayerStats.new()
	load_all_scenes()
	await get_tree().create_timer(0.5).timeout
	load_scene("beat_1_streamer_opening")

func load_all_scenes() -> void:
	var file_path = "res://data/scenes/act1_hustle.json"
	if FileAccess.file_exists(file_path):
		var file = FileAccess.open(file_path, FileAccess.READ)
		var json_string = file.get_as_text()
		file.close()
		
		var json = JSON.new()
		if json.parse(json_string) == OK:
			var data = json.get_data()
			if data.has("scenes"):
				for scene_id in data.scenes.keys():
					scenes_data[scene_id] = data.scenes[scene_id]

func load_scene(scene_id: String) -> void:
	if not scenes_data.has(scene_id):
		dialogue_updated.emit("Error: Scene not found", "System")
		return
	
	current_scene_id = scene_id
	current_scene_data = scenes_data[scene_id]
	current_dialogue_index = 0
	waiting_for_choice = false
	
	scene_loaded.emit(scene_id)
	play_next_dialogue()

func play_next_dialogue() -> void:
	if waiting_for_choice:
		return
	
	if not current_scene_data.has("dialogue_sequence"):
		return
		
	var dialogue_sequence = current_scene_data.dialogue_sequence
	
	if current_dialogue_index >= dialogue_sequence.size():
		show_choices()
		return
	
	var line = dialogue_sequence[current_dialogue_index]
	var speaker = line.get("speaker", "narrator")
	var text = line.get("text", "")
	var effects = line.get("effects", [])
	
	for effect in effects:
		if effect.has("stat") and effect.has("value"):
			stats.modify_stat(effect.stat, effect.value)
	
	if effects.size() > 0:
		stats_changed.emit()
	
	dialogue_updated.emit(text, speaker)
	current_dialogue_index += 1

func show_choices() -> void:
	if not current_scene_data.has("choices"):
		return
	
	waiting_for_choice = true
	choices_ready.emit(current_scene_data.choices)

func make_choice(choice_id: String) -> void:
	if not waiting_for_choice:
		return
	
	waiting_for_choice = false
	
	for choice in current_scene_data.get("choices", []):
		if choice.get("id", "") == choice_id:
			if choice.has("effects"):
				for effect in choice.effects:
					if effect.has("stat") and effect.has("value"):
						stats.modify_stat(effect.stat, effect.value)
				stats_changed.emit()
			
			if choice.has("set_flag"):
				stats.set_flag(choice.set_flag)
			
			if choice.has("next_scene"):
				load_scene(choice.next_scene)
			return

func advance_dialogue() -> void:
	if not waiting_for_choice:
		play_next_dialogue()

func get_stats_display() -> Dictionary:
	return {
		"Logic": stats.logic,
		"Confidence": stats.confidence,
		"Skepticism": stats.skepticism,
		"Money": stats.money,
		"Stress": stats.stress
	}
