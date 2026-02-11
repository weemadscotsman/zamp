extends Node2D

# Emote bubble that shows above player/NPC

@onready var label = $Label
@onready var timer = $Timer

var emote_icons = {
	"question": "❓",
	"exclaim": "❗",
	"heart": "❤️",
	"angry": "😠",
	"sad": "😢",
	"happy": "😊",
	"surprise": "😲",
	"thought": "💭",
	"idea": "💡"
}

func _ready():
	# Float up animation
	var tween = create_tween()
	tween.tween_property(self, "position:y", position.y - 20, 0.5)
	
	# Connect timer
	timer.timeout.connect(_on_timer_timeout)

func set_emote(emote_type: String):
	var icon = emote_icons.get(emote_type, "❓")
	label.text = icon

func _on_timer_timeout():
	# Fade out and remove
	var tween = create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.3)
	tween.tween_callback(queue_free)
