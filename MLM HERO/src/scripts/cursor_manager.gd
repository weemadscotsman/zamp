extends Node

# CUSTOM CUROR SYSTEM
# Thematic cursor that changes based on context

var default_cursor = load("res://assets/cursors/default.png")
var pointer_cursor = load("res://assets/cursors/pointer.png")
var text_cursor = load("res://assets/cursors/text.png")
var investigate_cursor = load("res://assets/cursors/investigate.png")

# Fallback if images don't exist - use colored rects
var use_fallback = true

func _ready():
	# Check if custom cursor images exist
	var dir = DirAccess.open("res://assets/cursors/")
	if dir:
		use_fallback = false
	else:
		_setup_fallback_cursors()

func _setup_fallback_cursors():
	# Create programmatic cursors using Godot's built-in cursors
	pass

func set_cursor(type: String):
	match type:
		"default":
			Input.set_default_cursor_shape(Input.CURSOR_ARROW)
		"pointer":
			Input.set_default_cursor_shape(Input.CURSOR_POINTING_HAND)
		"text":
			Input.set_default_cursor_shape(Input.CURSOR_IBEAM)
		"investigate":
			Input.set_default_cursor_shape(Input.CURSOR_HELP)
		"busy":
			Input.set_default_cursor_shape(Input.CURSOR_WAIT)
		"forbidden":
			Input.set_default_cursor_shape(Input.CURSOR_FORBIDDEN)

func setup_button_cursor(button: Button):
	button.mouse_entered.connect(func(): set_cursor("pointer"))
	button.mouse_exited.connect(func(): set_cursor("default"))

func setup_investigate_cursor(control: Control):
	control.mouse_entered.connect(func(): set_cursor("investigate"))
	control.mouse_exited.connect(func(): set_cursor("default"))
