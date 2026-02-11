extends CanvasLayer

# DIALOGUE SYSTEM for Top-Down RPG
# Shows dialogue boxes when talking to NPCs

signal dialogue_started
signal dialogue_ended
signal choice_made(choice_index)

@onready var dialogue_box = $DialogueBox
@onready var name_label = $DialogueBox/NameLabel
@onready var text_label = $DialogueBox/TextLabel
@onready var portrait = $DialogueBox/Portrait
@onready var choices_container = $DialogueBox/ChoicesContainer
@onready var advance_indicator = $DialogueBox/AdvanceIndicator

var is_active = false
var current_dialogue = []
var current_index = 0
var is_typing = false
var skip_typing = false

var typing_speed = 0.03

func _ready():
	dialogue_box.hide()

func _input(event):
	if not is_active:
		return
	
	if event.is_action_just_pressed("ui_accept") or event.is_action_just_pressed("interact"):
		if is_typing:
			skip_typing = true
		else:
			_advance_dialogue()

func start_dialogue(dialogue_data: Array, speaker_name: String = "", portrait_texture: Texture2D = null):
	current_dialogue = dialogue_data
	current_index = 0
	is_active = true
	
	name_label.text = speaker_name
	if portrait_texture:
		portrait.texture = portrait_texture
		portrait.show()
	else:
		portrait.hide()
	
	dialogue_box.show()
	dialogue_box.modulate.a = 0
	
	# Animate in
	var tween = create_tween()
	tween.tween_property(dialogue_box, "modulate:a", 1.0, 0.2)
	
	dialogue_started.emit()
	_show_current_line()

func _show_current_line():
	if current_index >= current_dialogue.size():
		_end_dialogue()
		return
	
	var line = current_dialogue[current_index]
	
	# Check if this is a choice
	if line.has("choices"):
		_show_choices(line.text, line.choices)
	else:
		_type_text(line.text)

func _type_text(text: String):
	is_typing = true
	skip_typing = false
	text_label.text = ""
	advance_indicator.hide()
	
	for i in range(text.length()):
		if skip_typing:
			text_label.text = text
			break
		
		text_label.text += text[i]
		
		# Play typing sound (optional)
		if i % 3 == 0:
			AudioManager.play_typing_sound()
		
		await get_tree().create_timer(typing_speed).timeout
	
	is_typing = false
	advance_indicator.show()
	
	# Animate advance indicator
	_animate_advance_indicator()

func _animate_advance_indicator():
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(advance_indicator, "position:y", advance_indicator.position.y + 5, 0.3)
	tween.tween_property(advance_indicator, "position:y", advance_indicator.position.y - 5, 0.3)

func _show_choices(text: String, choices: Array):
	text_label.text = text
	
	# Clear old choices
	for child in choices_container.get_children():
		child.queue_free()
	
	choices_container.show()
	
	# Create choice buttons
	for i in range(choices.size()):
		var btn = Button.new()
		btn.text = choices[i].text
		btn.custom_minimum_size = Vector2(0, 40)
		btn.pressed.connect(func(): _select_choice(i, choices[i]))
		choices_container.add_child(btn)

func _select_choice(index: int, choice_data: Dictionary):
	choice_made.emit(index)
	
	# Apply any effects
	if choice_data.has("effect"):
		_apply_choice_effect(choice_data.effect)
	
	choices_container.hide()
	current_index += 1
	_show_current_line()

func _apply_choice_effect(effect: Dictionary):
	# Apply stat changes, evidence discovery, etc.
	if effect.has("skepticism"):
		GlobalState.skepticism += effect.skepticism
	if effect.has("guilt"):
		GlobalState.guilt += effect.guilt
	if effect.has("evidence"):
		GlobalState.add_evidence(effect.evidence)
	if effect.has("followers"):
		GlobalState.followers += effect.followers
	if effect.has("reputation"):
		GlobalState.reputation += effect.reputation
	
	GlobalState.update_big_four()
	GlobalState.save_game()

func _advance_dialogue():
	current_index += 1
	_show_current_line()

func _end_dialogue():
	is_active = false
	
	# Animate out
	var tween = create_tween()
	tween.tween_property(dialogue_box, "modulate:a", 0.0, 0.2)
	tween.tween_callback(func():
		dialogue_box.hide()
		choices_container.hide()
		dialogue_ended.emit()
	)

func show_notification(text: String, duration: float = 2.0):
	# Quick popup notification
	var notif = Label.new()
	notif.text = text
	notif.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notif.position = Vector2(400, 100)
	add_child(notif)
	
	var tween = create_tween()
	tween.tween_property(notif, "position:y", 80, 0.3)
	tween.tween_interval(duration)
	tween.tween_property(notif, "modulate:a", 0, 0.3)
	tween.tween_callback(notif.queue_free)
