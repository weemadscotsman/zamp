extends Node2D

# LIBRARY - Investigation phase, research area
# Features: Computers, archives, evidence collection

func _ready():
	_setup_exit()
	_setup_computers()
	_spawn_player()

func _setup_exit():
	$Exit.body_entered.connect(func(body):
		if body.is_in_group("player"):
			RoomManager.change_room("res://src/scenes/rooms/city_hub.tscn", "from_library")
	)

func _setup_computers():
	# Computer station for research interaction
	var computer_area = $Furniture/ComputerStation
	if computer_area:
		# Make the computer station interactive
		var interaction_zone = Area2D.new()
		interaction_zone.name = "InteractionZone"
		var collision = CollisionShape2D.new()
		collision.shape = RectangleShape2D.new()
		collision.shape.size = Vector2(200, 100)
		interaction_zone.add_child(collision)
		computer_area.add_child(interaction_zone)
		
		interaction_zone.body_entered.connect(func(body):
			if body.is_in_group("player"):
				_show_computer_prompt()
		)
		
		interaction_zone.body_exited.connect(func(body):
			if body.is_in_group("player"):
				_hide_computer_prompt()
		)

func _show_computer_prompt():
	DialogueManager.show_notification("Press [E] to research MLM data", 3.0)
	
	# Wait for interaction
	await _wait_for_interaction()
	
	# Show research dialogue
	DialogueManager.show_dialogue([
		{"speaker": "Computer", "text": "Searching database for 'Diamond Dynamics'..."},
		{"speaker": "Computer", "text": "Found 47 complaints. Average loss: $4,500."},
		{"speaker": "Computer", "text": "Previous company names: 'Luminary Oasis', 'Wealth Wave', 'Success Pyramid'..."},
		{"speaker": "Computer", "text": "Same scam, different name. Classic rebrand strategy."}
	])

func _hide_computer_prompt():
	# Prompt auto-hides via DialogueManager timeout
	pass

func _wait_for_interaction():
	var timeout = 0.0
	while timeout < 3.0:
		if Input.is_action_just_pressed("interact"):
			return
		timeout += get_process_delta_time()
		await get_tree().process_frame

func _spawn_player():
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		player = preload("res://src/scenes/player.tscn").instantiate()
		add_child(player)
	
	player.global_position = $Spawn.global_position
