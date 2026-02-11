extends CanvasLayer

# PHASE TRANSITION CINEMATIC
# Smooth, emotional transitions between game phases

@onready var color_rect = $ColorRect
@onready var from_text = $FromText
@onready var to_text = $ToText
@onready var arrow = $Arrow
@onready var subtitle = $SubtitleText
@onready var glitch = $GlitchEffect

var transition_data = {
	"social_to_recruitment": {
		"from": "INFLUENCER LIFE",
		"to": "THE RECRUITMENT",
		"subtitle": "You took the bait...",
		"color": Color(0.8, 0.2, 0.2),
		"glitch_intensity": 0.5
	},
	"social_to_investigation": {
		"from": "INFLUENCER LIFE", 
		"to": "THE INVESTIGATION",
		"subtitle": "Something feels wrong...",
		"color": Color(0.2, 0.4, 0.9),
		"glitch_intensity": 0.3
	},
	"recruitment_to_infiltration": {
		"from": "THE RECRUITMENT",
		"to": "THE INFILTRATION",
		"subtitle": "Time to go inside...",
		"color": Color(0.1, 0.1, 0.3),
		"glitch_intensity": 0.7
	},
	"investigation_to_resistance": {
		"from": "THE INVESTIGATION",
		"to": "THE RESISTANCE",
		"subtitle": "Knowledge is power...",
		"color": Color(0.2, 0.7, 0.3),
		"glitch_intensity": 0.2
	},
	"to_brainrot": {
		"from": "REALITY",
		"to": "BRAINROT",
		"subtitle": "The algorithm consumes you...",
		"color": Color(0.9, 0.1, 0.4),
		"glitch_intensity": 1.0
	}
}

func play_transition(transition_id: String):
	var data = transition_data.get(transition_id, transition_data["social_to_recruitment"])
	
	# Set text
	from_text.text = data.from
	to_text.text = data.to
	subtitle.text = data.subtitle
	
	# Set colors
	color_rect.color = data.color.darkened(0.7)
	glitch.color = data.color
	glitch.color.a = 0.1
	
	# Initial state
	modulate = Color(1, 1, 1, 0)
	from_text.modulate = Color(1, 1, 1, 0)
	to_text.modulate = Color(1, 1, 1, 0)
	arrow.modulate = Color(1, 1, 1, 0)
	subtitle.modulate = Color(1, 1, 1, 0)
	
	show()
	
	# Animate in
	var tween = create_tween()
	tween.set_parallel(false)
	
	# Fade in background
	tween.tween_property(self, "modulate", Color(1, 1, 1, 1), 0.3)
	
	# Glitch effect during transition
	_start_glitch(data.glitch_intensity)
	
	# Show "from" phase
	tween.tween_property(from_text, "modulate", Color(0.5, 0.5, 0.5, 1), 0.4)
	tween.tween_interval(0.5)
	
	# Arrow drop
	tween.tween_property(arrow, "modulate", Color(1, 1, 1, 1), 0.2)
	tween.tween_property(arrow, "position:y", arrow.position.y + 10, 0.2)
	tween.tween_interval(0.3)
	
	# Show "to" phase with emphasis
	tween.tween_property(to_text, "modulate", Color(1, 1, 1, 1), 0.4)
	tween.tween_property(to_text, "scale", Vector2(1.1, 1.1), 0.3)
	tween.tween_property(to_text, "scale", Vector2(1.0, 1.0), 0.2)
	
	# Subtitle fade in
	tween.tween_property(subtitle, "modulate", Color(1, 1, 1, 1), 0.5)
	
	# Hold
	tween.tween_interval(1.5)
	
	# Fade out
	tween.tween_property(self, "modulate", Color(1, 1, 1, 0), 0.5)
	
	await tween.finished
	_stop_glitch()
	hide()

func _start_glitch(intensity: float):
	# Simple glitch effect using random offset
	var glitch_tween = create_tween()
	glitch_tween.set_loops()
	
	for i in range(20):
		glitch_tween.tween_callback(func():
			glitch.position.x = randf_range(-10 * intensity, 10 * intensity)
			glitch.color.a = randf_range(0.05, 0.2 * intensity)
		)
		glitch_tween.tween_interval(0.05)

func _stop_glitch():
	glitch.position.x = 0
	glitch.color.a = 0
