extends Control

@onready var title_label: Label = $CenterContainer/BrainrotPanel/TitleLabel
@onready var content_label: Label = $CenterContainer/BrainrotPanel/ContentLabel
@onready var timer_label: Label = $CenterContainer/BrainrotPanel/TimerLabel
@onready var escape_button: Button = $CenterContainer/BrainrotPanel/EscapeButton

var time_remaining: float = 10.0
var escaped: bool = false

var brainrot_content = [
	{
		"title": "🧠 WARNING: BRAINROT DETECTED",
		"content": "You made a choice without questioning. The algorithm has you now.\n\nWatch TikTok for 10 seconds...\nOr pay attention and ESCAPE!"
	},
	{
		"title": "📱 SOCIAL MEDIA OVERLOAD",
		"content": "Your dopamine receptors are fried.\n\nCan you focus long enough to escape?"
	}
]

func _ready():
	var content = brainrot_content[randi() % brainrot_content.size()]
	title_label.text = content.title
	content_label.text = content.content
	escape_button.pressed.connect(_on_escape_pressed)

func _process(delta):
	if not escaped:
		time_remaining -= delta
		timer_label.text = "⏱️ %.1f seconds" % time_remaining
		
		if time_remaining <= 0:
			escaped = true
			_escape_success()

func _on_escape_pressed():
	if time_remaining > 5.0:
		# Escaped early - good attention span!
		escaped = true
		_escape_success()
	else:
		# Too slow - need to wait longer or click at right time
		timer_label.text = "⏱️ WAIT FOR GREEN LIGHT!"

func _escape_success():
	escape_button.text = "✅ ESCAPED!"
	timer_label.text = "Brain resistance restored!"
	
	# Small delay before returning
	await get_tree().create_timer(1.5).timeout
	
	var brainrot_manager = get_node_or_null("/root/BrainrotManager")
	if brainrot_manager:
		brainrot_manager.escape_brainrot()
	else:
		get_tree().change_scene_to_file("res://src/scenes/simple_game.tscn")
