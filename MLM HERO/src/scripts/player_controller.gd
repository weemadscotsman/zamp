extends CharacterBody2D

# TOP-DOWN RPG PLAYER CONTROLLER
# Zelda-style movement with investigation mechanics

@export var speed: float = 150.0
@export var sprint_speed: float = 250.0
@export var acceleration: float = 800.0
@export var friction: float = 800.0

@onready var sprite = $Sprite2D
@onready var animation_player = $AnimationPlayer
@onready var interaction_ray = $InteractionRay
@onready var camera = $Camera2D

var facing_direction = Vector2.DOWN
var is_in_dialogue = false
var is_in_stealth = false
var is_sprinting = false

# Animation states
enum State { IDLE, WALK, SNEAK }
var current_state = State.IDLE

func _ready():
	# Create a simple colored rectangle as placeholder sprite
	if not $Sprite2D.texture:
		var img = Image.create(32, 32, false, Image.FORMAT_RGBA8)
		img.fill(Color(0.2, 0.6, 1.0))
		var tex = ImageTexture.create_from_image(img)
		$Sprite2D.texture = tex
	
	# Connect to dialogue system (safely)
	var dm = get_node_or_null("/root/DialogueManager")
	if dm:
		dm.dialogue_started.connect(_on_dialogue_started)
		dm.dialogue_ended.connect(_on_dialogue_ended)
	
	# Add to group for easy finding
	add_to_group("player")

func _physics_process(delta):
	if is_in_dialogue:
		velocity = Vector2.ZERO
		_play_animation("idle")
		return
	
	_handle_input()
	_apply_movement(delta)
	_update_animation()
	_check_interactions()
	
	move_and_slide()

func _handle_input():
	var input_dir = Vector2.ZERO
	input_dir.x = Input.get_axis("ui_left", "ui_right")
	input_dir.y = Input.get_axis("ui_up", "ui_down")
	
	# Normalize for consistent diagonal speed
	if input_dir != Vector2.ZERO:
		input_dir = input_dir.normalized()
		facing_direction = input_dir
		_update_interaction_ray()
	
	# Sprint check
	is_sprinting = Input.is_action_pressed("sprint") and not is_in_stealth
	
	# Calculate target speed
	var target_speed = sprint_speed if is_sprinting else speed
	if is_in_stealth:
		target_speed = speed * 0.5  # Slower when sneaking
	
	# Apply acceleration/friction
	if input_dir != Vector2.ZERO:
		velocity = velocity.move_toward(input_dir * target_speed, acceleration * get_physics_process_delta_time())
		current_state = State.WALK if not is_in_stealth else State.SNEAK
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * get_physics_process_delta_time())
		current_state = State.IDLE

func _apply_movement(delta):
	# Movement is handled in _handle_input via velocity
	pass

func _update_animation():
	match current_state:
		State.IDLE:
			_play_animation("idle_" + _get_direction_string())
		State.WALK:
			_play_animation("walk_" + _get_direction_string())
		State.SNEAK:
			_play_animation("sneak_" + _get_direction_string())

func _get_direction_string() -> String:
	# Determine facing direction for animations
	var angle = facing_direction.angle()
	var degrees = rad_to_deg(angle)
	
	if degrees >= -45 and degrees < 45:
		return "right"
	elif degrees >= 45 and degrees < 135:
		return "down"
	elif degrees >= -135 and degrees < -45:
		return "up"
	else:
		return "left"

func _update_interaction_ray():
	# Point interaction ray in facing direction
	interaction_ray.target_position = facing_direction * 32

func _check_interactions():
	if Input.is_action_just_pressed("interact"):
		# Check for NPCs
		if interaction_ray.is_colliding():
			var collider = interaction_ray.get_collider()
			if collider.is_in_group("npc"):
				collider.interact()
			elif collider.is_in_group("evidence"):
				collider.collect()
			elif collider.is_in_group("door"):
				collider.use()
			elif collider.is_in_group("computer"):
				collider.use()

func _play_animation(anim_name: String):
	if animation_player.has_animation(anim_name):
		if animation_player.current_animation != anim_name:
			animation_player.play(anim_name)

func _on_dialogue_started():
	is_in_dialogue = true
	velocity = Vector2.ZERO

func _on_dialogue_ended():
	is_in_dialogue = false

func set_stealth_mode(enabled: bool):
	is_in_stealth = enabled
	if enabled:
		# Visual indicator for stealth
		modulate = Color(0.7, 0.7, 1.0, 0.8)
	else:
		modulate = Color.WHITE

func enter_room(room_path: String, spawn_point: String):
	# Transition to new room
	var rm = get_node_or_null("/root/RoomManager")
	if rm:
		rm.change_room(room_path, spawn_point)

func show_emote(emote_type: String):
	# Show emote bubble above player (safely)
	var emote_path = "res://src/scenes/emote_bubble.tscn"
	if ResourceLoader.exists(emote_path):
		var emote = load(emote_path).instantiate()
		emote.set_emote(emote_type)
		add_child(emote)
	else:
		# Fallback: just print
		print("Emote: ", emote_type)
