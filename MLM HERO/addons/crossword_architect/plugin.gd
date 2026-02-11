@tool
extends EditorPlugin

# CrosswordArchitect Plugin
# Adds architectural constraint-satisfaction tools to Godot

const MAIN_PANEL = preload("res://addons/crossword_architect/ui/architect_dock.tscn")
var main_panel_instance

func _enter_tree():
	# Add custom types
	add_custom_type("CrosswordArchitect", "RefCounted", preload("res://addons/crossword_architect/crossword_architect.gd"), preload("res://addons/crossword_architect/icons/architect_icon.svg"))
	
	# Add dock
	main_panel_instance = MAIN_PANEL.instantiate()
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, main_panel_instance)
	
	print("[CrosswordArchitect] Plugin loaded successfully")

func _exit_tree():
	remove_custom_type("CrosswordArchitect")
	
	if main_panel_instance:
		remove_control_from_docks(main_panel_instance)
		main_panel_instance.queue_free()
