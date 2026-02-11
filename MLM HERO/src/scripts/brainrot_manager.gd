extends Node

var in_brainrot = false

func trigger_brainrot(reason: String):
	if in_brainrot:
		return
	in_brainrot = true
	print("BRAINROT TRIGGERED: " + reason)
	
	# Save current game state before switching
	var current_scene = get_tree().current_scene
	if current_scene:
		current_scene.set_meta("return_scene", current_scene.scene_file_path)
	
	# Switch to brainrot punishment scene
	get_tree().change_scene_to_file("res://src/scenes/brainrot_punishment.tscn")

func escape_brainrot():
	in_brainrot = false
	print("Escaped brainrot!")
	
	# Return to main game
	get_tree().change_scene_to_file("res://src/scenes/simple_game.tscn")
