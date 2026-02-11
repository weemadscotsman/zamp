extends Node2D

# CITY HUB - Central connection point
# Multiple buildings to enter, NPCs wandering

func _ready():
	# Setup all doors
	_setup_door($Buildings/CoffeeShop/Door, "res://src/scenes/rooms/coffee_shop.tscn", "from_city")
	_setup_door($Buildings/MLMOffice/Door, "res://src/scenes/rooms/mlm_office.tscn", "from_city", _can_enter_office)
	_setup_door($Buildings/Library/Door, "res://src/scenes/rooms/library.tscn", "from_city")
	_setup_door($Buildings/SyndicateTower/Door, "res://src/scenes/rooms/syndicate_hq.tscn", "from_city", _can_enter_syndicate)
	
	# Spawn player at correct position
	_spawn_player()
	
	# Setup NPCs
	_setup_npcs()

func _setup_door(door: Area2D, target_scene: String, spawn_point: String, condition: Callable = Callable()):
	door.body_entered.connect(func(body):
		if body.is_in_group("player"):
			if condition.is_null() or condition.call():
				_show_prompt(door, target_scene, spawn_point)
	)
	
	door.body_exited.connect(func(body):
		if body.is_in_group("player"):
			_hide_prompt(door)
	)

func _show_prompt(door: Area2D, scene: String, spawn: String):
	# Create prompt label
	var prompt = Label.new()
	prompt.text = "Press [E] to enter"
	prompt.name = "Prompt"
	door.add_child(prompt)
	
	# Wait for interaction
	await _wait_for_interaction()
	
	if is_instance_valid(prompt):
		prompt.queue_free()
		RoomManager.change_room(scene, spawn)

func _hide_prompt(door: Area2D):
	var prompt = door.get_node_or_null("Prompt")
	if prompt:
		prompt.queue_free()

func _wait_for_interaction():
	while true:
		if Input.is_action_just_pressed("interact"):
			return
		await get_tree().process_frame

func _can_enter_office() -> bool:
	# Can always enter, but different dialogue based on story path
	return true

func _can_enter_syndicate() -> bool:
	# Need evidence or story progress to enter
	if GlobalState.get_total_evidence() >= 3:
		return true
	
	# Show locked message
	DialogueManager.show_notification("🔒 Locked. Need more evidence to infiltrate.", 2.0)
	return false

func _spawn_player():
	var spawn_name = RoomManager.player_spawn_point
	var spawn_point = null
	
	match spawn_name:
		"from_bedroom":
			spawn_point = $SpawnPoints/FromBedroom
		"from_coffee":
			spawn_point = $SpawnPoints/FromCoffee
		"from_office":
			spawn_point = $SpawnPoints/FromOffice
		"from_library":
			spawn_point = $SpawnPoints/FromLibrary
		"from_syndicate":
			spawn_point = $SpawnPoints/FromSyndicate
		_:
			spawn_point = $SpawnPoints/FromBedroom
	
	# Spawn or reposition player
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		player = preload("res://src/scenes/player.tscn").instantiate()
		add_child(player)
	
	if spawn_point:
		player.global_position = spawn_point.global_position

func _setup_npcs():
	# Setup Uncle Kev with specific dialogue
	var uncle_kev = $NPCs/UncleKev
	if uncle_kev:
		uncle_kev.dialogue_data = [
			{"text": "Mate, careful around here. Lots of 'opportunity' hunters."},
			{"text": "See that gold building? Diamond Dynamics. Rebranded 3 times."},
			{"text": "If someone says 'passive income', run the other way."}
		]
		uncle_kev.show_exclamation()
	
	# Setup random NPCs
	var npc1 = $NPCs/RandomNPC1
	if npc1:
		npc1.dialogue_data = [
			{"text": "I'm late for my 'business opportunity' meeting..."},
			{"text": "My cousin says I'll be a millionaire by 30!"}
		]
	
	var npc2 = $NPCs/RandomNPC2
	if npc2:
		npc2.dialogue_data = [
			{"text": "The coffee here is terrible but it's cheap."},
			{"text": "I saw a guy crying in the MLM office yesterday."}
		]
