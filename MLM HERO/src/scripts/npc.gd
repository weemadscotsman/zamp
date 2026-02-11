extends CharacterBody2D

# NPC for Top-Down RPG
# Can be talked to, can move, can give quests

@export var npc_name: String = "Unknown"
@export var npc_id: String = ""
@export var portrait: Texture2D
@export var dialogue_file: String = ""
@export var can_move: bool = false
@export var movement_pattern: Array[Vector2] = []
@export var movement_speed: float = 30.0
@export var wait_time: float = 2.0

@onready var sprite = $Sprite2D
@onready var collision = $CollisionShape2D

var dialogue_data = []
var current_patrol_index = 0
var is_waiting = false
var has_been_talked_to = false

func _ready():
	add_to_group("npc")
	
	# Create default sprite if none exists
	if not $Sprite2D.texture:
		var img = Image.create(32, 32, false, Image.FORMAT_RGBA8)
		# Random color based on npc_id hash
		var hash_val = hash(npc_id)
		var r = float((hash_val >> 16) & 0xFF) / 255.0
		var g = float((hash_val >> 8) & 0xFF) / 255.0
		var b = float(hash_val & 0xFF) / 255.0
		img.fill(Color(r, g, b))
		$Sprite2D.texture = ImageTexture.create_from_image(img)
	
	_load_dialogue()
	
	if can_move and movement_pattern.size() > 0:
		_start_patrol()

func _load_dialogue():
	# Load dialogue from file or use embedded data
	if dialogue_file != "":
		pass
	
	# Default dialogue if none loaded
	if dialogue_data.size() == 0:
		dialogue_data = _get_default_dialogue()

func _get_default_dialogue() -> Array:
	return [
		{"text": "Hello there! I don't have much to say."}
	]

func _physics_process(delta):
	if can_move and not is_waiting:
		_patrol_movement(delta)

func _patrol_movement(delta):
	if movement_pattern.size() == 0:
		return
	
	var target = movement_pattern[current_patrol_index]
	var direction = (target - global_position).normalized()
	
	if global_position.distance_to(target) < 5:
		# Reached waypoint
		current_patrol_index = (current_patrol_index + 1) % movement_pattern.size()
		_start_wait()
	else:
		velocity = direction * movement_speed
		move_and_slide()

func _start_wait():
	is_waiting = true
	velocity = Vector2.ZERO
	await get_tree().create_timer(wait_time).timeout
	is_waiting = false

func interact():
	# Called when player presses interact
	_look_at_player()
	
	if not has_been_talked_to:
		has_been_talked_to = true
	
	# Show dialogue
	DialogueManager.start_dialogue(dialogue_data, npc_name, portrait)

func _look_at_player():
	# Face the player
	var player = get_tree().get_first_node_in_group("player")
	if player:
		var direction = (player.global_position - global_position).normalized()
		_update_facing(direction)

func _update_facing(direction: Vector2):
	# Visual feedback of facing
	pass

func set_dialogue(new_dialogue: Array):
	dialogue_data = new_dialogue

func add_dialogue_line(text: String, choices: Array = []):
	var line = {"text": text}
	if choices.size() > 0:
		line["choices"] = choices
	dialogue_data.append(line)

func show_exclamation():
	# Visual indicator this NPC has important dialogue
	modulate = Color(1.2, 1.2, 0.8)

# NPC types - convenience functions
func make_sarah():
	npc_name = "Sarah"
	npc_id = "sarah"
	dialogue_data = [
		{"text": "Hey hun! 💕 Love your vibe!"},
		{"text": "I made $12,000 last month working just 2 hours a day!"},
		{"text": "This isn't MLM - it's direct social commerce! Want in?", "choices": [
			{"text": "Tell me more! 💎", "effect": {"skepticism": -5}},
			{"text": "Sounds fishy... 🤔", "effect": {"skepticism": 10}},
			{"text": "No thanks 🚫", "effect": {"skepticism": 5}}
		]}
	]

func make_uncle_kev():
	npc_name = "Uncle Kev"
	npc_id = "uncle_kev"
	dialogue_data = [
		{"text": "Mate, I saw you talking to that Sarah girl."},
		{"text": "I've seen this before. Bit-Konnexx. Same script, different logo."},
		{"text": "Check the income disclosure. 99% lose money."}
	]

func make_diamond_dave():
	npc_name = "Diamond Dave"
	npc_id = "diamond_dave"
	dialogue_data = [
		{"text": "Welcome to the family! 💎"},
		{"text": "I'm your upline. Together we'll build an empire!"},
		{"text": "Your first task: recruit 3 people this week.", "choices": [
			{"text": "I'll do my best!", "effect": {"guilt": 5}},
			{"text": "That's a lot of pressure...", "effect": {"skepticism": 5}}
		]}
	]
