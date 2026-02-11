extends Area2D

# EVIDENCE ITEM - Collectible in the world
# Shows sparkle effect, can be investigated

@export var evidence_id: String = ""
@export var evidence_name: String = "Evidence"
@export var description: String = ""
@export var strength: int = 1

@onready var sprite = $Sprite2D
@onready var animation_player = $AnimationPlayer
@onready var sparkle = $Sparkle
@onready var label = $Label

var is_collected = false
var is_in_range = false

func _ready():
	add_to_group("evidence")
	
	# Check if already collected
	if GlobalState.evidence_collection.has(evidence_id):
		if GlobalState.evidence_collection[evidence_id].found:
			is_collected = true
			hide()
			return
	
	# Show sparkle effect
	_play_sparkle()
	
	# Hide label initially
	if label:
		label.hide()

func _play_sparkle():
	if sparkle and sparkle is CPUParticles2D:
		sparkle.emitting = true
	
	# Bobbing animation
	if animation_player and animation_player.has_animation("bob"):
		animation_player.play("bob")

func _process(_delta):
	if is_collected:
		return
	
	# Check if player is in range
	var bodies = get_overlapping_bodies()
	var player_in_range = false
	
	for body in bodies:
		if body.is_in_group("player"):
			player_in_range = true
			break
	
	if player_in_range and not is_in_range:
		_show_prompt()
		is_in_range = true
	elif not player_in_range and is_in_range:
		_hide_prompt()
		is_in_range = false

func _show_prompt():
	if label:
		label.text = "Press [E] to investigate"
		label.show()
		
		# Animate in
		var tween = create_tween()
		tween.tween_property(label, "modulate:a", 1.0, 0.2)

func _hide_prompt():
	if label:
		var tween = create_tween()
		tween.tween_property(label, "modulate:a", 0.0, 0.2)
		tween.tween_callback(label.hide)

func collect():
	if is_collected:
		return
	
	is_collected = true
	
	# Add to global state
	if GlobalState.add_evidence(evidence_id):
		# Show collection effect
		_play_collection_effect()
		
		# Show notification
		DialogueManager.show_notification("📄 Found: " + evidence_name, 3.0)
		
		# Hide after animation
		await get_tree().create_timer(1.0).timeout
		hide()

func _play_collection_effect():
	# Freeze game briefly
	get_tree().paused = true
	
	# Zoom effect (would need camera work)
	# For now, just flash
	var flash = ColorRect.new()
	flash.color = Color(1, 1, 1, 0.5)
	flash.size = Vector2(1280, 720)
	get_tree().root.add_child(flash)
	
	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0.0, 0.5)
	tween.tween_callback(func():
		flash.queue_free()
		get_tree().paused = false
	)
	
	# Show evidence details
	_show_evidence_details()

func _show_evidence_details():
	# Create a popup showing the evidence
	var popup = Panel.new()
	popup.size = Vector2(400, 200)
	popup.position = Vector2(440, 260)
	
	var bg = ColorRect.new()
	bg.color = Color(0.1, 0.1, 0.15, 0.95)
	bg.anchors_preset = Control.PRESET_FULL_RECT
	popup.add_child(bg)
	
	var title = Label.new()
	title.text = "📄 " + evidence_name
	title.theme_override_font_sizes/font_size = 24
	title.position = Vector2(20, 20)
	popup.add_child(title)
	
	var desc = Label.new()
	desc.text = description
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.size = Vector2(360, 100)
	desc.position = Vector2(20, 60)
	popup.add_child(desc)
	
	var strength_label = Label.new()
	strength_label.text = "Strength: " + "⭐".repeat(strength)
	strength_label.position = Vector2(20, 160)
	popup.add_child(strength_label)
	
	get_tree().root.add_child(popup)
	
	# Auto close
	await get_tree().create_timer(3.0).timeout
	
	var close_tween = create_tween()
	close_tween.tween_property(popup, "modulate:a", 0.0, 0.3)
	close_tween.tween_callback(popup.queue_free)
