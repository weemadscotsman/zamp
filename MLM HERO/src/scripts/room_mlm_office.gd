extends Node2D

# MLM OFFICE - Recruitment Phase Location
# Where Diamond Dave operates

func _ready():
	_setup_exit()
	_setup_npcs()
	_spawn_player()
	
	# Check if this is first visit
	if not GlobalState.story_flags.has("visited_mlm_office"):
		_first_visit()

func _setup_exit():
	$DoorExit.body_entered.connect(func(body):
		if body.is_in_group("player"):
			RoomManager.change_room("res://src/scenes/rooms/city_hub.tscn", "from_office")
	)

func _setup_npcs():
	# Diamond Dave - Boss NPC
	var dave = $NPCs/DiamondDave
	if dave:
		dave.dialogue_data = [
			{"text": "Welcome to Diamond Dynamics! 💎"},
			{"text": "I'm Diamond Dave, and I'm here to change your life!"},
			{"text": "Last month I made $87,000 working from my yacht."},
			{"text": "This isn't MLM - it's direct social commerce entrepreneurship!"},
			{"text": "Are you ready to join the diamond life?", "choices": [
				{"text": "Tell me more! 💎", "effect": {"skepticism": -5, "guilt": 5}},
				{"text": "Show me proof 📊", "effect": {"skepticism": 10}},
				{"text": "This sounds like a pyramid... 🚫", "effect": {"skepticism": 15}}
			]}
		]
		dave.show_exclamation()
	
	# Receptionist
	var receptionist = $NPCs/Receptionist
	if receptionist:
		receptionist.dialogue_data = [
			{"text": "Welcome to Diamond Dynamics! Sign in please."},
			{"text": "We've had 47 people quit this week, but they just didn't want it enough."},
			{"text": "I haven't been paid in 3 months, but I'm building my empire!"}
		]
	
	# New Recruit - Victim
	var recruit = $NPCs/NewRecruit
	if recruit:
		recruit.dialogue_data = [
			{"text": "I just put my life savings into inventory..."},
			{"text": "Dave says I'll be a Diamond by next month!"},
			{"text": "My family won't talk to me anymore, but they'll see when I'm rich."}
		]

func _spawn_player():
	var spawn_point = $SpawnPoints/FromCity
	
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		player = preload("res://src/scenes/player.tscn").instantiate()
		add_child(player)
	
	if spawn_point:
		player.global_position = spawn_point.global_position

func _first_visit():
	GlobalState.story_flags["visited_mlm_office"] = true
	GlobalState.save_game()
	
	# Show intro dialogue
	DialogueManager.show_notification("📍 Diamond Dynamics Office", 2.0)
	await get_tree().create_timer(2.0).timeout
	DialogueManager.show_notification("The smell of desperation and cheap cologne fills the air...", 3.0)
