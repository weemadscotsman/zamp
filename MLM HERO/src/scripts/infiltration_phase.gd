extends Control

# INFILTRATION PHASE - Stealth gameplay!
# Navigate the Pyramid Syndicate HQ, collect evidence, avoid guards

enum GameState { PLAYING, CAUGHT, WON, PAUSED }
var current_state = GameState.PLAYING

# Player position (grid-based movement)
var player_pos = Vector2i(1, 8)
var target_pos = Vector2i(14, 1)  # The CEO's office

# Grid size
var grid_width = 16
var grid_height = 10

# Suspicion system
var suspicion = 0.0
var max_suspicion = 100.0
var suspicion_decay = 5.0  # Decays per second when hidden

# Evidence to collect in this phase
var infiltration_evidence = []
var collected_docs = []

# Guards (patrol routes)
var guards = [
	{"pos": Vector2i(5, 5), "route": [Vector2i(5, 5), Vector2i(5, 3), Vector2i(7, 3), Vector2i(7, 5)], "current_target": 1, "move_timer": 0, "move_delay": 1.5},
	{"pos": Vector2i(10, 7), "route": [Vector2i(10, 7), Vector2i(12, 7), Vector2i(12, 5), Vector2i(10, 5)], "current_target": 1, "move_timer": 0, "move_delay": 1.2},
	{"pos": Vector2i(3, 2), "route": [Vector2i(3, 2), Vector2i(3, 4), Vector2i(5, 4), Vector2i(5, 2)], "current_target": 1, "move_timer": 0, "move_delay": 1.8}
]

# Documents to collect
var documents = [
	{"pos": Vector2i(4, 6), "type": "EMAIL", "title": "Recruitment Script v2.3", "collected": false},
	{"pos": Vector2i(8, 4), "type": "SPREADSHEET", "title": "Income Reality (Hidden)", "collected": false},
	{"pos": Vector2i(11, 6), "type": "MEMO", "title": "Rebrand Plan: Bit-Konnexx", "collected": false},
	{"pos": Vector2i(13, 3), "type": "CONTRACT", "title": "Shell Company List", "collected": false}
]

# Safe zones (desks, plants to hide behind)
var safe_zones = [
	Vector2i(2, 7), Vector2i(6, 6), Vector2i(9, 5), Vector2i(12, 4)
]

# Walls/obstacles
var walls = [
	# Office dividers
	Vector2i(3, 5), Vector2i(4, 5),
	Vector2i(7, 4), Vector2i(8, 4),  # Document at 8,4 is ON a desk - must time it
	Vector2i(10, 6), Vector2i(11, 6),  # Document at 11,6
	Vector2i(13, 2), Vector2i(13, 3),  # Near CEO office
	# Outer walls (simplified)
]

var is_hidden = false

func _ready():
	update_display()
	$StatusLabel.text = "🕵️ INFILTRATION PHASE\nReach the CEO's office (top right)\nCollect evidence along the way!"
	$Timer.start()
	
	# Get evidence from main game
	infiltration_evidence = GlobalState.get_total_evidence()
	
	render_grid()

func _input(event):
	if current_state != GameState.PLAYING:
		return
	
	if event.is_action_pressed("ui_up") or event.is_action_pressed("move_up"):
		try_move(Vector2i(0, -1))
	elif event.is_action_pressed("ui_down") or event.is_action_pressed("move_down"):
		try_move(Vector2i(0, 1))
	elif event.is_action_pressed("ui_left") or event.is_action_pressed("move_left"):
		try_move(Vector2i(-1, 0))
	elif event.is_action_pressed("ui_right") or event.is_action_pressed("move_right"):
		try_move(Vector2i(1, 0))
	elif event.is_action_pressed("ui_accept"):
		interact()

func try_move(dir: Vector2i):
	var new_pos = player_pos + dir
	
	# Check bounds
	if new_pos.x < 0 or new_pos.x >= grid_width or new_pos.y < 0 or new_pos.y >= grid_height:
		return
	
	# Check walls
	if new_pos in walls:
		return
	
	# Check guards (instant game over if walking into guard)
	for guard in guards:
		if guard.pos == new_pos:
			get_caught("Walked into a guard!")
			return
	
	player_pos = new_pos
	check_position()
	update_display()

func interact():
	# Check for document collection
	for doc in documents:
		if doc.pos == player_pos and not doc.collected:
			doc.collected = true
			collected_docs.append(doc)
			$StatusLabel.text = "📄 COLLECTED: " + doc.title
			suspicion = max(0, suspicion - 10)  # Good evidence reduces suspicion
			update_display()
			return
	
	# Hide in safe zone
	if player_pos in safe_zones:
		is_hidden = !is_hidden
		if is_hidden:
			$StatusLabel.text = "🌿 HIDDEN behind desk/plant"
		else:
			$StatusLabel.text = "👤 Left hiding spot"
		update_display()

func check_position():
	# Check if reached CEO office
	if player_pos == target_pos:
		win_infiltration()
		return
	
	# Check guard vision (adjacent tiles)
	for guard in guards:
		var dist = player_pos.distance_to(guard.pos)
		if dist <= 1.5 and not is_hidden:
			get_caught("Spotted by guard!")
			return
		elif dist <= 2.5 and not is_hidden:
			suspicion += 20  # Being close increases suspicion
			$StatusLabel.text = "⚠️ Guard is watching..."

func _process(delta):
	if current_state != GameState.PLAYING:
		return
	
	# Decay suspicion when hidden
	if is_hidden:
		suspicion = max(0, suspicion - suspicion_decay * delta)
	else:
		# Slowly increase suspicion when visible
		suspicion += 2 * delta
	
	if suspicion >= max_suspicion:
		get_caught("Suspicion maxed out!")
		return
	
	# Update suspicion bar
	$SuspicionBar.value = suspicion
	
	# Update guard positions
	update_guards(delta)

func update_guards(delta):
	for guard in guards:
		guard.move_timer += delta
		if guard.move_timer >= guard.move_delay:
			guard.move_timer = 0
			move_guard(guard)
	
	render_grid()

func move_guard(guard):
	var target = guard.route[guard.current_target]
	var dir = target - guard.pos
	
	# Simple movement toward target
	if dir.x != 0:
		guard.pos.x += sign(dir.x)
	elif dir.y != 0:
		guard.pos.y += sign(dir.y)
	
	# Check if reached target
	if guard.pos == target:
		guard.current_target = (guard.current_target + 1) % guard.route.size()
	
	# Check if guard sees player
	var dist = player_pos.distance_to(guard.pos)
	if dist <= 1.5 and not is_hidden:
		get_caught("Guard caught you!")
	elif dist <= 2.5 and not is_hidden:
		suspicion += 15
		$StatusLabel.text = "⚠️ ALMOST CAUGHT!"

func render_grid():
	var grid_text = ""
	
	for y in range(grid_height):
		for x in range(grid_width):
			var pos = Vector2i(x, y)
			
			if pos == player_pos:
				if is_hidden:
					grid_text += "🥷"  # Hidden ninja
				else:
					grid_text += "🕵️"  # Spy
			elif pos == target_pos:
				grid_text += "🚪"  # CEO Office
			elif pos in walls:
				grid_text += "⬛"  # Wall
			elif is_guard_at(pos):
				grid_text += "👮"  # Guard
			elif has_document_at(pos):
				grid_text += "📄"  # Document
			elif pos in safe_zones:
				grid_text += "🌿"  # Hiding spot
			else:
				grid_text += "⬜"  # Empty floor
		
		grid_text += " "
		
		# Add spacing for readability
		if x == grid_width - 1:
			grid_text += "\n"
	
	$GridLabel.text = grid_text

func is_guard_at(pos: Vector2i) -> bool:
	for guard in guards:
		if guard.pos == pos:
			return true
	return false

func has_document_at(pos: Vector2i) -> bool:
	for doc in documents:
		if doc.pos == pos and not doc.collected:
			return true
	return false

func update_display():
	$StatsLabel.text = "Documents: %d/4 | Hidden: %s | Suspicion: %.0f%%" % [collected_docs.size(), "YES" if is_hidden else "NO", suspicion]
	render_grid()

func get_caught(reason: String):
	current_state = GameState.CAUGHT
	$CaughtPanel.show()
	$CaughtPanel/ReasonLabel.text = "❌ CAUGHT!\n\n" + reason + "\n\nThe Pyramid Syndicate security escorts you out."
	
	# Save failure to game data
	GlobalState.ending_flags["infiltration_success"] = false

func win_infiltration():
	current_state = GameState.WON
	$WinPanel.show()
	
	var bonus_text = ""
	if collected_docs.size() == 4:
		bonus_text = "\n🏆 PERFECT RUN! All documents collected!"
	elif collected_docs.size() >= 2:
		bonus_text = "\n⭐ Good job! Solid evidence collected."
	else:
		bonus_text = "\n⚠️ Minimal evidence. Hope it's enough..."
	
	$WinPanel/WinLabel.text = "✅ INFILTRATION SUCCESSFUL!\n\nDocuments collected: %d/4%s\n\nReady for the final confrontation?" % [collected_docs.size(), bonus_text]
	
	# Save success to game data
	GlobalState.ending_flags["infiltration_success"] = true
	GlobalState.documents_stolen = collected_docs.size()

func _on_retry_button_pressed():
	# Reset and retry
	current_state = GameState.PLAYING
	player_pos = Vector2i(1, 8)
	suspicion = 0
	collected_docs.clear()
	is_hidden = false
	$CaughtPanel.hide()
	
	# Reset documents
	for doc in documents:
		doc.collected = false
	
	# Reset guards
	for guard in guards:
		guard.pos = guard.route[0]
		guard.current_target = 1
		guard.move_timer = 0
	
	update_display()

func _on_continue_button_pressed():
	# Return to main game with infiltration results
	get_tree().change_scene_to_file("res://src/scenes/simple_game.tscn")

func _on_abort_button_pressed():
	# Give up and return to menu
	get_tree().change_scene_to_file("res://src/scenes/main_menu.tscn")
