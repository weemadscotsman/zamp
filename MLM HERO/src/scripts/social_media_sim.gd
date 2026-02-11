extends Control

# SOCIAL MEDIA SIMULATOR - Phase 1 with VISUAL POLISH

@onready var vfx = $VisualEffects

var posts_made_today: int = 0
var max_posts_per_day: int = 3
var current_day: int = 1
var max_days: int = 5

var available_posts = [
	{
		"id": "lifestyle_1",
		"text": "Grinding at 5AM 💪 #Hustle #Success",
		"type": "LIFESTYLE",
		"followers": 50,
		"reputation": 0,
		"skepticism": 0,
		"evidence_potential": "none",
		"color": Color(0.9, 0.8, 0.4)
	},
	{
		"id": "product_1", 
		"text": "Check out this AMAZING opportunity! DM me! 💎",
		"type": "PROMO",
		"followers": -20,
		"reputation": -15,
		"skepticism": 5,
		"evidence_potential": "mlm_denial",
		"color": Color(0.9, 0.5, 0.5)
	},
	{
		"id": "research_1",
		"text": "Been researching income claims... numbers don't add up 🤔",
		"type": "INVESTIGATION",
		"followers": -10,
		"reputation": 20,
		"skepticism": 10,
		"evidence_potential": "sarah_income_claims",
		"color": Color(0.5, 0.8, 0.9)
	},
	{
		"id": "vague_1",
		"text": "Something big is coming... stay tuned 👀",
		"type": "MYSTERIOUS",
		"followers": 30,
		"reputation": 5,
		"skepticism": 2,
		"evidence_potential": "none",
		"color": Color(0.8, 0.7, 0.9)
	}
]

var pending_dms = []
var current_dm = null

func _ready():
	GlobalState.current_phase = "social"
	GlobalState.save_game()
	
	# Entrance animation
	vfx.fade_in_node($MainPanel, 0.5)
	
	# Setup cursor for all buttons
	_setup_cursors()
	
	# Add ambient glow
	$AmbientEffects.add_corner_glow(Color(0.3, 0.5, 0.9, 0.3), "top_left")
	$AmbientEffects.add_corner_glow(Color(0.9, 0.3, 0.7, 0.3), "bottom_right")
	
	update_shared_ui()
	show_main_feed()
	check_new_dms()

func _setup_cursors():
	var cursor_mgr = $CursorManager
	cursor_mgr.setup_button_cursor($SharedUI/DMButton)
	cursor_mgr.setup_button_cursor($MainPanel/ResearchButton)
	cursor_mgr.setup_button_cursor($ResearchPanel/CloseResearchButton)
	cursor_mgr.setup_button_cursor($DMPanel/BackButton)
	cursor_mgr.setup_button_cursor($DayTransitionPanel/ContinueDayButton)

func update_shared_ui():
	$SharedUI/StatBar/FollowersValue.text = str(GlobalState.followers)
	$SharedUI/StatBar/ReputationValue.text = str(GlobalState.reputation)
	$SharedUI/StatBar/SkepticismValue.text = str(GlobalState.skepticism)
	$SharedUI/StatBar/StressValue.text = str(GlobalState.stress)
	$SharedUI/StatBar/EvidenceValue.text = str(GlobalState.get_total_evidence())
	
	$SharedUI/PhaseIndicator.text = "📱 PHASE 1: INFLUENCER LIFE"
	$SharedUI/DayIndicator.text = "Day %d/%d" % [current_day, max_days]
	
	_update_stat_colors()

func _update_stat_colors():
	var skeptic_color = Color(1 - GlobalState.skepticism/100.0, GlobalState.skepticism/100.0, 0.2)
	$SharedUI/StatBar/SkepticismValue.modulate = skeptic_color
	
	var stress_color = Color(GlobalState.stress/100.0, 1 - GlobalState.stress/100.0, 0.2)
	$SharedUI/StatBar/StressValue.modulate = stress_color

func show_main_feed():
	$MainPanel.show()
	$MainPanel.modulate.a = 1
	$DMPanel.hide()
	$ResearchPanel.hide()
	
	for child in $MainPanel/PostOptions.get_children():
		child.queue_free()
	
	for post in available_posts:
		var btn = Button.new()
		btn.custom_minimum_size = Vector2(0, 70)
		btn.mouse_entered.connect(func(): vfx.animate_button_hover(btn, true))
		btn.mouse_exited.connect(func(): vfx.animate_button_hover(btn, false))
		btn.button_down.connect(func(): vfx.animate_button_press(btn))
		
		var effect_text = ""
		if post.followers > 0:
			effect_text += "+%d👥 " % post.followers
		elif post.followers < 0:
			effect_text += "%d👥 " % post.followers
		
		effect_text += "%+d📊" % post.reputation
		
		btn.text = post.text + "\n" + effect_text
		btn.pressed.connect(func(): make_post(post, btn))
		
		# Color tint
		btn.modulate = post.color
		
		$MainPanel/PostOptions.add_child(btn)
		vfx.pop_in_node(btn)
		await get_tree().create_timer(0.05).timeout

func make_post(post_data, button):
	if posts_made_today >= max_posts_per_day:
		vfx.flash_red(0.2)
		show_notification("❌ No more posts today!", "error")
		return
	
	posts_made_today += 1
	
	# Visual feedback
	vfx.spawn_confetti(button.global_position + button.size/2, post_data.color)
	vfx.small_shake()
	
	# Update stats
	var old_followers = GlobalState.followers
	var old_rep = GlobalState.reputation
	
	GlobalState.followers += post_data.followers
	GlobalState.reputation += post_data.reputation
	GlobalState.skepticism += post_data.skepticism
	
	# Show number changes
	vfx.show_number_change($SharedUI/StatBar/FollowersValue, old_followers, GlobalState.followers)
	vfx.show_number_change($SharedUI/StatBar/ReputationValue, old_rep, GlobalState.reputation)
	
	# Evidence discovery
	if post_data.evidence_potential != "none":
		if randi() % 100 < 30:
			if GlobalState.add_evidence(post_data.evidence_potential):
				vfx.flash_green(0.3)
				vfx.spawn_evidence_sparkle(button.global_position)
				$ToastManager.evidence_found(post_data.evidence_potential.replace("_", " ").capitalize())
				show_notification("📄 Evidence discovered!", "success")
	
	# Update stress
	if post_data.type == "PROMO":
		GlobalState.stress += 5
	elif post_data.type == "INVESTIGATION":
		GlobalState.stress += 2
	
	GlobalState.update_big_four()
	GlobalState.save_game()
	
	show_notification("✅ Posted! " + post_data.text.substr(0, 30) + "...", "neutral")
	update_shared_ui()
	
	# Button fly-away animation
	var tween = create_tween()
	tween.tween_property(button, "position:x", button.position.x + 400, 0.3).set_trans(Tween.TRANS_CUBIC)
	tween.parallel().tween_property(button, "modulate:a", 0, 0.3)
	tween.tween_callback(button.queue_free)
	
	if posts_made_today >= max_posts_per_day:
		await get_tree().create_timer(0.5).timeout
		advance_day()

func advance_day():
	current_day += 1
	posts_made_today = 0
	
	GlobalState.stress = max(0, GlobalState.stress - 10)
	GlobalState.save_game()
	
	if current_day > max_days:
		finish_phase1()
		return
	
	# Day transition animation
	vfx.flash_white(0.3)
	show_day_transition()
	check_new_dms()

func show_day_transition():
	$DayTransitionPanel.show()
	$DayTransitionPanel.modulate.a = 0
	
	vfx.fade_in_node($DayTransitionPanel, 0.5)
	
	$DayTransitionPanel/DayText.text = "📅 DAY %d" % current_day
	$DayTransitionPanel/SummaryText.text = _get_day_summary()
	
	# Animate stats appearing
	var stats = $DayTransitionPanel/SummaryText
	stats.modulate.a = 0
	var tween = create_tween()
	tween.tween_interval(0.3)
	tween.tween_property(stats, "modulate:a", 1, 0.5)

func _get_day_summary() -> String:
	var text = "Followers: %d\n" % GlobalState.followers
	text += "Reputation: %d\n" % GlobalState.reputation
	text += "Evidence: %d found\n" % GlobalState.get_total_evidence()
	text += "Skepticism: %d" % GlobalState.skepticism
	return text

func _on_continue_day_pressed():
	vfx.slide_in_panel($DayTransitionPanel, false)
	await get_tree().create_timer(0.3).timeout
	$DayTransitionPanel.hide()
	update_shared_ui()

func check_new_dms():
	pending_dms.clear()
	
	if current_day == 1:
		pending_dms.append({
			"from": "SARAH",
			"avatar_color": Color(1, 0.4, 0.7),
			"unread": true,
			"messages": [
				{"sender": "SARAH", "text": "Hey hun! 💕 Love your content!"},
				{"sender": "SARAH", "text": "I made $12,000 last month working 2hrs/day!"},
				{"sender": "SARAH", "text": "This isn't MLM - it's direct social commerce!"}
			],
			"choices": [
				{"text": "Tell me more! 💎", "effect": "join_path"},
				{"text": "Show me income proof 📊", "effect": "question_path"},
				{"text": "Sounds like a pyramid... 🚫", "effect": "reject_path"}
			]
		})
	
	if current_day >= 2 and GlobalState.skepticism > 10:
		pending_dms.append({
			"from": "UNCLE_KEV",
			"avatar_color": Color(0.8, 0.6, 0.2),
			"unread": true,
			"messages": [
				{"sender": "UNCLE_KEV", "text": "Mate, saw your posts about that 'opportunity'"},
				{"sender": "UNCLE_KEV", "text": "Check the income disclosure. 99% lose money."}
			],
			"choices": [
				{"text": "Thanks for the warning 🙏", "effect": "wise_up"}
			]
		})
	
	$SharedUI/DMButton.text = "💬 (%d)" % pending_dms.size()
	if pending_dms.size() > 0:
		$SharedUI/DMButton.modulate = Color(1, 0.9, 0.5)
		vfx.spawn_text_float("💬 New DM!", $SharedUI/DMButton.global_position, Color.YELLOW)

func _on_dm_button_pressed():
	if pending_dms.size() == 0:
		show_notification("No new messages", "neutral")
		return
	show_dm_panel(pending_dms[0])

func show_dm_panel(dm):
	current_dm = dm
	
	vfx.slide_in_panel($DMPanel)
	$MainPanel.hide()
	
	$DMPanel/ContactName.text = dm.from
	$DMPanel/ContactAvatar.color = dm.avatar_color
	
	# Glitch effect on avatar
	vfx.glitch_node($DMPanel/ContactAvatar, 0.5)
	
	for child in $DMPanel/MessageHistory.get_children():
		child.queue_free()
	
	for msg in dm.messages:
		var label = Label.new()
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.text = msg.sender + ": " + msg.text
		
		if msg.sender == "YOU":
			label.modulate = Color(0.7, 0.9, 1)
		else:
			label.modulate = dm.avatar_color
		
		$DMPanel/MessageHistory.add_child(label)
		vfx.pop_in_node(label)
		await get_tree().create_timer(0.1).timeout
	
	for child in $DMPanel/ChoiceButtons.get_children():
		child.queue_free()
	
	for choice in dm.choices:
		var btn = Button.new()
		btn.text = choice.text
		btn.custom_minimum_size = Vector2(0, 40)
		btn.mouse_entered.connect(func(): vfx.animate_button_hover(btn, true))
		btn.mouse_exited.connect(func(): vfx.animate_button_hover(btn, false))
		btn.pressed.connect(func(): choose_dm_option(choice))
		$DMPanel/ChoiceButtons.add_child(btn)
		vfx.pop_in_node(btn)

func choose_dm_option(choice):
	GlobalState.add_path_history(choice.effect, {"day": current_day})
	
	match choice.effect:
		"join_path":
			GlobalState.story_path = "joined"
			vfx.flash_red(0.4)
			transition_to_recruitment()
		"question_path":
			GlobalState.story_path = "questioned"
			vfx.flash_green(0.4)
			transition_to_investigation()
		"reject_path":
			GlobalState.story_path = "rejected"
			vfx.flash_white(0.5)
			transition_to_safe_ending()
		"wise_up":
			GlobalState.self_awareness += 20
			GlobalState.skepticism += 10
			vfx.spawn_evidence_sparkle($DMPanel/ContactAvatar.global_position)
	
	GlobalState.save_game()
	current_dm.unread = false
	pending_dms.erase(current_dm)
	check_new_dms()

func transition_to_recruitment():
	$PhaseTransition.play_transition("social_to_recruitment")
	await get_tree().create_timer(2.0).timeout
	GlobalState.transition_to_phase("recruitment")
	get_tree().change_scene_to_file("res://src/scenes/recruitment_phase.tscn")

func transition_to_investigation():
	$PhaseTransition.play_transition("social_to_investigation")
	await get_tree().create_timer(2.0).timeout
	GlobalState.transition_to_phase("investigation")
	get_tree().change_scene_to_file("res://src/scenes/investigation_phase.tscn")

func transition_to_safe_ending():
	$PhaseTransition.play_transition("social_to_recruitment")
	await get_tree().create_timer(2.0).timeout
	GlobalState.transition_to_phase("ending")
	get_tree().change_scene_to_file("res://src/scenes/safe_ending.tscn")

func finish_phase1():
	if GlobalState.story_path == "":
		if GlobalState.skepticism > 20:
			transition_to_investigation()
		elif GlobalState.reputation < 30:
			transition_to_recruitment()
		else:
			transition_to_safe_ending()

func _on_research_button_pressed():
	$MainPanel.hide()
	vfx.slide_in_panel($ResearchPanel)
	update_research_panel()

func update_research_panel():
	$ResearchPanel/ResearchText.text = "[b]🔍 INVESTIGATION DESK[/b]\n\n"
	$ResearchPanel/ResearchText.text += "Current skepticism: " + str(GlobalState.skepticism) + "/100\n"
	$ResearchPanel/ResearchText.text += "Evidence found: " + str(GlobalState.get_total_evidence()) + "/12\n\n"
	
	var searches = [
		{"text": "Search income claims", "id": "sarah_income_claims"},
		{"text": "Search company history", "id": "company_history"},
		{"text": "Search 'isn't MLM'", "id": "mlm_denial"}
	]
	
	for child in $ResearchPanel/SearchButtons.get_children():
		child.queue_free()
	
	for search in searches:
		if not GlobalState.evidence_collection[search.id].found:
			var btn = Button.new()
			btn.text = search.text
			btn.mouse_entered.connect(func(): vfx.animate_button_hover(btn, true))
			btn.mouse_exited.connect(func(): vfx.animate_button_hover(btn, false))
			btn.pressed.connect(func(): do_research(search.id, btn))
			$ResearchPanel/SearchButtons.add_child(btn)

func do_research(evidence_id: String):
	if GlobalState.add_evidence(evidence_id):
		vfx.flash_green(0.3)
		vfx.spawn_evidence_sparkle(get_viewport().get_mouse_position())
		$ToastManager.evidence_found(evidence_id.replace("_", " ").capitalize())
		show_notification("📄 Found evidence!", "success")
	else:
		vfx.glitch_node($ResearchPanel, 0.3)
		show_notification("🔍 Already discovered", "neutral")
	
	GlobalState.save_game()
	update_shared_ui()
	update_research_panel()

func _on_close_research_pressed():
	vfx.slide_in_panel($ResearchPanel, false)
	await get_tree().create_timer(0.3).timeout
	$ResearchPanel.hide()
	$MainPanel.show()

func _on_back_button_pressed():
	vfx.slide_in_panel($DMPanel, false)
	await get_tree().create_timer(0.3).timeout
	$DMPanel.hide()
	$MainPanel.show()

func show_notification(text: String, type: String):
	$NotificationLabel.text = text
	match type:
		"success":
			$NotificationLabel.modulate = Color(0.3, 1, 0.3)
		"error":
			$NotificationLabel.modulate = Color(1, 0.3, 0.3)
		_:
			$NotificationLabel.modulate = Color(1, 1, 1)
	
	$NotificationLabel.show()
	$NotificationLabel.modulate.a = 1
	$NotificationLabel.position.y = 100
	
	var tween = create_tween()
	tween.tween_property($NotificationLabel, "position:y", 80, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(1.5)
	tween.tween_property($NotificationLabel, "modulate:a", 0, 0.5)
