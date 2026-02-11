extends Node2D

# SYNDICATE HQ - Infiltration Phase
# Stealth mission to collect documents

var detection_level = 0.0
var max_detection = 100.0
var is_in_hiding_spot = false

func _ready():
	_setup_exit()
	_setup_hiding_spots()
	_setup_documents()
	_spawn_player()
	
	# Start detection monitoring
	_detection_monitor()

func _setup_exit():
	$ExitDoor.body_entered.connect(func(body):
		if body.is_in_group("player"):
			_escape()
	)

func _setup_hiding_spots():
	for spot in $HidingSpots.get_children():
		spot.body_entered.connect(func(body):
			if body.is_in_group("player"):
				_enter_hiding_spot(body, spot)
		)
		
		spot.body_exited.connect(func(body):
			if body.is_in_group("player"):
				_exit_hiding_spot(body)
		)

func _enter_hiding_spot(player, spot):
	is_in_hiding_spot = true
	player.set_stealth_mode(true)
	DialogueManager.show_notification("🌿 Hidden! Guards can't see you.", 2.0)
	
	# Lower detection
	detection_level = max(0, detection_level - 30)

func _exit_hiding_spot(player):
	is_in_hiding_spot = false
	player.set_stealth_mode(false)

func _setup_documents():
	# Documents are already placed in scene
	# Just make sure they're visible if not collected
	for doc in $Documents.get_children():
		if GlobalState.evidence_collection.has(doc.evidence_id):
			if GlobalState.evidence_collection[doc.evidence_id].found:
				doc.hide()

func _spawn_player():
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		player = preload("res://src/scenes/player.tscn").instantiate()
		add_child(player)
	
	player.global_position = $SpawnPoint.global_position
	
	# Briefing
	DialogueManager.show_notification("🕵️ Infiltration Mode", 2.0)
	await get_tree().create_timer(2.0).timeout
	DialogueManager.show_notification("Avoid guards. Collect documents. Get to exit.", 3.0)

func _detection_monitor():
	while true:
		await get_tree().create_timer(0.1).timeout
		
		# Check if player in guard vision
		var player = get_tree().get_first_node_in_group("player")
		if not player:
			continue
		
		# Natural detection decay
		if detection_level > 0 and not is_in_hiding_spot:
			detection_level = max(0, detection_level - 0.5)
		
		# Update UI
		$StealthUI/DetectionBar.value = detection_level
		
		# Check if fully detected
		if detection_level >= max_detection:
			_on_caught()

func _on_caught():
	DialogueManager.show_notification("❌ MISSION FAILED", 3.0)
	
	# Reset guards
	for guard in $GuardPosts.get_children():
		guard.reset()
	
	# Reset player
	var player = get_tree().get_first_node_in_group("player")
	if player:
		player.global_position = $SpawnPoint.global_position
		player.set_stealth_mode(false)
	
	detection_level = 0
	
	# Give option to retry or leave
	DialogueManager.show_notification("Press [R] to retry or [E] to exit", 4.0)

func _escape():
	var docs_collected = 0
	for doc in $Documents.get_children():
		if GlobalState.evidence_collection[doc.evidence_id].found:
			docs_collected += 1
	
	# Calculate score
	var success = docs_collected >= 2
	
	if success:
		GlobalState.ending_flags["infiltration_success"] = true
		GlobalState.documents_stolen = docs_collected
		GlobalState.save_game()
		
		DialogueManager.show_notification("✅ ESCAPE SUCCESSFUL!", 2.0)
		await get_tree().create_timer(2.0).timeout
		
		# Go to ending
		RoomManager.change_room("res://src/scenes/rooms/city_hub.tscn", "from_syndicate")
	else:
		DialogueManager.show_notification("⚠️ Not enough evidence. Collect more documents!", 3.0)

func _input(event):
	if event.is_action_just_pressed("ui_cancel"):
		# Emergency exit
		RoomManager.change_room("res://src/scenes/rooms/city_hub.tscn", "from_syndicate")

func increase_detection(amount: float):
	if not is_in_hiding_spot:
		detection_level = min(max_detection, detection_level + amount)
