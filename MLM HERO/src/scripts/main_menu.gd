extends Control

@onready var start_button = $VBoxContainer/StartButton
@onready var quit_button = $VBoxContainer/QuitButton

func _ready():
	print("=== MAIN MENU READY ===")
	
	# Connect buttons
	start_button.pressed.connect(_on_start)
	quit_button.pressed.connect(_on_quit)
	
	print("Buttons connected")
	
	# Check if GlobalState is available
	var gs = get_node_or_null("/root/GlobalState")
	if gs:
		print("GlobalState found")
	else:
		push_warning("GlobalState not found!")

func _on_start():
	print("=== START BUTTON PRESSED ===")
	start_button.text = "Loading..."
	start_button.disabled = true
	
	# Reset game state
	var gs = get_node_or_null("/root/GlobalState")
	if gs:
		gs.reset()
		print("Game state reset")
	
	# Load bedroom scene
	print("Loading bedroom.tscn...")
	var result = get_tree().change_scene_to_file("res://src/scenes/rooms/bedroom.tscn")
	
	if result != OK:
		print("ERROR: Failed to load bedroom! Code: ", result)
		start_button.text = "ERROR - Check Output"
		start_button.disabled = false
	else:
		print("Bedroom loading...")

func _on_quit():
	print("Quit pressed")
	get_tree().quit()
