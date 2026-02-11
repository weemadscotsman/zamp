extends Node2D

# BEDROOM - Phase 1 Starting Area
# Top-down RPG room

func _ready():
	print("Bedroom loaded")
	
	# Setup door
	if $Door:
		$Door.body_entered.connect(_on_door_entered)
		print("Door connected")

func _on_door_entered(body):
	if body.is_in_group("player"):
		print("Player entered door - transitioning to city hub")
		get_tree().change_scene_to_file("res://src/scenes/rooms/city_hub.tscn")
