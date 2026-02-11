extends Node

# ROOM MANAGER
# Handles transitions between areas (bedroom, office, infiltration, etc.)

signal room_changed(room_name)

var current_room = ""
var player_spawn_point = ""

func change_room(room_path: String, spawn_point: String = ""):
	player_spawn_point = spawn_point
	
	# Show loading screen
	var loading = preload("res://src/scenes/loading_screen.tscn").instantiate()
	get_tree().root.add_child(loading)
	
	await get_tree().create_timer(0.5).timeout
	
	# Change scene
	get_tree().change_scene_to_file(room_path)
	
	await get_tree().process_frame
	
	# Position player at spawn point
	_position_player_at_spawn(spawn_point)
	
	# Update current room
	current_room = room_path.get_file().get_basename()
	room_changed.emit(current_room)
	
	# Remove loading screen
	loading.queue_free()

func _position_player_at_spawn(spawn_name: String):
	if spawn_name == "":
		return
	
	var player = get_tree().get_first_node_in_group("player")
	var spawn_point = get_tree().get_first_node_in_group("spawn_" + spawn_name)
	
	if player and spawn_point:
		player.global_position = spawn_point.global_position

func get_current_room() -> String:
	return current_room

func is_in_room(room_name: String) -> bool:
	return current_room == room_name
