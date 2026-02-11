extends CharacterBody2D

# GUARD AI - Patrols and detects player

@export var patrol_points: Array[Vector2] = []
@export var move_speed: float = 60.0
@export var wait_time: float = 2.0
@export var vision_range: float = 120.0
@export var vision_angle: float = 60.0

@onready var vision_cone = $VisionCone
@onready var sprite = $ColorRect

var current_point_index = 0
var is_waiting = false
var is_alerted = false
var player_detected = false
var facing_direction = Vector2.RIGHT

func _ready():
	add_to_group("guard")
	
	# Set initial position
	if patrol_points.size() > 0:
		global_position = patrol_points[0]
	
	# Setup vision cone
	_update_vision_cone()
	
	# Connect vision detection
	vision_cone.body_entered.connect(_on_player_entered_vision)

func _physics_process(delta):
	if is_alerted:
		_chase_player(delta)
	elif not is_waiting and patrol_points.size() > 1:
		_patrol(delta)
	
	_update_vision_cone()

func _patrol(delta):
	var target = patrol_points[current_point_index]
	var direction = (target - global_position).normalized()
	
	facing_direction = direction
	
	if global_position.distance_to(target) < 5:
		# Reached waypoint
		current_point_index = (current_point_index + 1) % patrol_points.size()
		_start_wait()
	else:
		velocity = direction * move_speed
		move_and_slide()

func _start_wait():
	is_waiting = true
	velocity = Vector2.ZERO
	await get_tree().create_timer(wait_time).timeout
	is_waiting = false

func _chase_player(delta):
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		return
	
	var direction = (player.global_position - global_position).normalized()
	facing_direction = direction
	velocity = direction * (move_speed * 1.5)
	move_and_slide()
	
	# Catch player
	if global_position.distance_to(player.global_position) < 30:
		_catch_player()

func _catch_player():
	var player = get_tree().get_first_node_in_group("player")
	if player:
		player.show_emote("❌")
		DialogueManager.show_notification("❌ CAUGHT!", 2.0)
		
		# Increase suspicion
		GlobalState.infiltration_suspicion += 50
		GlobalState.times_spotted += 1
		
		# Return player to start or game over
		await get_tree().create_timer(2.0).timeout
		_get_parent()._on_caught()

func _on_player_entered_vision(body):
	if body.is_in_group("player"):
		var player = body
		
		# Check if player is hiding
		if player.is_in_stealth:
			return
		
		# Check line of sight (no walls in between)
		var space_state = get_world_2d().direct_space_state
		var query = PhysicsRayQueryParameters2D.create(global_position, player.global_position)
		query.exclude = [self]
		var result = space_state.intersect_ray(query)
		
		if result.is_empty() or result.collider == player:
			_detect_player()

func _detect_player():
	if not player_detected:
		player_detected = true
		is_alerted = true
		
		# Visual alert
		modulate = Color(1, 0.3, 0.3)
		
		# Alert sound would go here
		# AudioManager.play_alert_sound()
		
		DialogueManager.show_notification("⚠️ Guard spotted you!", 1.5)

func _update_vision_cone():
	# Rotate vision cone to match facing direction
	vision_cone.rotation = facing_direction.angle()

func reset():
	is_alerted = false
	player_detected = false
	modulate = Color.WHITE
	if patrol_points.size() > 0:
		global_position = patrol_points[0]
	current_point_index = 0
