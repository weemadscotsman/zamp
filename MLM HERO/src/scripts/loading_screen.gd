extends CanvasLayer

# LOADING SCREEN with gameplay tips
# Smooth scene transitions with thematic loading

var tips = [
	"💡 99.7% of MLM participants make less than minimum wage.",
	"💡 If it requires recruiting to make money, it's a pyramid scheme.",
	"💡 Real businesses don't need to constantly recruit.",
	"💡 'Passive income' usually requires active scamming.",
	"💡 The 'hustle' is often just exploitation.",
	"💡 If they say 'it's not a pyramid', it probably is.",
	"💡 MLMs target vulnerable people in life transitions.",
	"💡 The products are often just cover for the recruitment.",
	"💡 Income disclosure statements are public - read them.",
	"💡 If success requires others to fail, that's not business."
]

@onready var progress_bar = $CenterContainer/Panel/ProgressBar
@onready var tip_label = $CenterContainer/Panel/TipLabel
@onready var title_label = $CenterContainer/Panel/TitleLabel

var target_scene: String = ""
var loading_progress: float = 0.0

func _ready():
	# Pick random tip
	tip_label.text = tips[randi() % tips.size()]
	
	# Animate loading bar
	_animate_loading()

func _animate_loading():
	# Fake loading for effect (or use ResourceLoader for real async)
	var tween = create_tween()
	tween.tween_property(self, "loading_progress", 1.0, 2.0)
	
	# Update bar
	while loading_progress < 1.0:
		progress_bar.value = loading_progress * 100
		await get_tree().process_frame
	
	progress_bar.value = 100
	
	# Small delay at 100%
	await get_tree().create_timer(0.3).timeout
	
	# Transition out
	var fade_tween = create_tween()
	fade_tween.tween_property($CenterContainer/Panel, "modulate:a", 0, 0.3)
	fade_tween.tween_callback(_finish_loading)

func _finish_loading():
	if target_scene != "":
		get_tree().change_scene_to_file(target_scene)
	else:
		queue_free()

func load_scene(scene_path: String):
	target_scene = scene_path
	show()

func set_theme(phase: String):
	match phase:
		"social":
			$Background.color = Color(0.08, 0.05, 0.12)
			title_label.modulate = Color(0.9, 0.7, 0.3)
		"recruitment":
			$Background.color = Color(0.12, 0.05, 0.05)
			title_label.modulate = Color(0.9, 0.3, 0.3)
		"investigation":
			$Background.color = Color(0.05, 0.08, 0.12)
			title_label.modulate = Color(0.3, 0.7, 0.9)
		"infiltration":
			$Background.color = Color(0.02, 0.02, 0.08)
			title_label.modulate = Color(0.3, 0.9, 0.5)
