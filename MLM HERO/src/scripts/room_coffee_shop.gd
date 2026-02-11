extends Node2D

# COFFEE SHOP - Where Uncle Kev hangs out

func _ready():
	_setup_exit()
	_spawn_player()

func _setup_exit():
	$Exit.body_entered.connect(func(body):
		if body.is_in_group("player"):
			RoomManager.change_room("res://src/scenes/rooms/city_hub.tscn", "from_coffee")
	)

func _spawn_player():
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		player = preload("res://src/scenes/player.tscn").instantiate()
		add_child(player)
	
	player.global_position = $Spawn.global_position
