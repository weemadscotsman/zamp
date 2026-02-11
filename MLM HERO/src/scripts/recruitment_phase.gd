extends Control

# RECRUITMENT PHASE - Connected to Global State Brain

var current_week: int = 1
var max_weeks: int = 4
var recruits_this_week: int = 0

func _ready():
	GlobalState.current_phase = "recruitment"
	GlobalState.save_game()
	
	# Derive starting guilt from choices made
	if GlobalState.story_path == "joined":
		GlobalState.guilt = 10  # Initial guilt from joining
	
	update_shared_ui()
	update_recruitment_ui()
	generate_recruits()
	
	# Apply phase transition from social stats
	_apply_social_carryover()

func _apply_social_carryover():
	# Followers affect how many people you can reach
	var reach_bonus = GlobalState.followers / 500
	
	# Reputation affects recruit resistance
	if GlobalState.reputation < 30:
		$StatusLabel.text = "⚠️ Your reputation is low. People are skeptical."
	elif GlobalState.reputation > 70:
		$StatusLabel.text = "✅ Your reputation helps with recruitment."

# --- SHARED UI ---
func update_shared_ui():
	# Update the shared stat bar
	var shared_ui = $SharedUI
	shared_ui.get_node("StatBar/FollowersValue").text = str(GlobalState.followers)
	shared_ui.get_node("StatBar/ReputationValue").text = str(GlobalState.reputation)
	shared_ui.get_node("StatBar/SkepticismValue").text = str(GlobalState.skepticism)
	shared_ui.get_node("StatBar/StressValue").text = str(GlobalState.stress)
	
	shared_ui.get_node("PhaseIndicator").text = "🎯 PHASE 2A: THE RECRUITMENT"
	shared_ui.get_node("DayIndicator").text = "Week %d/%d" % [current_week, max_weeks]
	
	_update_stat_colors()

func _update_stat_colors():
	var shared_ui = $SharedUI
	var skeptic_color = Color(1 - GlobalState.skepticism/100.0, GlobalState.skepticism/100.0, 0.2)
	shared_ui.get_node("StatBar/SkepticismValue").modulate = skeptic_color
	
	var stress_color = Color(GlobalState.stress/100.0, 1 - GlobalState.stress/100.0, 0.2)
	shared_ui.get_node("StatBar/StressValue").modulate = stress_color

func update_recruitment_ui():
	$RecruitmentUI/WeekLabel.text = "📅 Week %d/%d" % [current_week, max_weeks]
	$RecruitmentUI/DebtLabel.text = "💸 Debt: $%d" % GlobalState.money
	$RecruitmentUI/RecruitsLabel.text = "👥 Recruits: %d" % GlobalState.recruits_made
	$RecruitmentUI/GuiltLabel.text = "😰 Guilt: %d" % GlobalState.guilt
	
	# Color code guilt
	if GlobalState.guilt > 70:
		$RecruitmentUI/GuiltLabel.modulate = Color(1, 0.2, 0.2)
	elif GlobalState.guilt > 40:
		$RecruitmentUI/GuiltLabel.modulate = Color(1, 0.8, 0.2)
	else:
		$RecruitmentUI/GuiltLabel.modulate = Color(1, 1, 1)

func generate_recruits():
	# Clear old recruits
	for child in $RecruitmentUI/RecruitList.get_children():
		child.queue_free()
	
	# Generate recruits based on followers
	var num_recruits = 3 + (GlobalState.followers / 1000)
	
	var npc_types = [
		{"name": "Single Mom", "vulnerability": 90, "guilt": 30, "desc": "Desperate. High guilt."},
		{"name": "College Student", "vulnerability": 70, "guilt": 15, "desc": "Young, optimistic."},
		{"name": "Retiree", "vulnerability": 60, "guilt": 25, "desc": "Fixed income. Risky."},
		{"name": "Aspiring Influencer", "vulnerability": 50, "guilt": 10, "desc": "Similar to you."},
		{"name": "Skeptical Friend", "vulnerability": 20, "guilt": 5, "desc": "Hard to convince."}
	]
	
	for i in range(num_recruits):
		var npc = npc_types[randi() % npc_types.size()]
		
		var btn = Button.new()
		btn.custom_minimum_size = Vector2(0, 80)
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		
		var vul_color = "🟢"
		if npc.vulnerability > 70:
			vul_color = "🔴"
		elif npc.vulnerability > 40:
			vul_color = "🟡"
		
		# Adjust vulnerability based on player reputation
		var adjusted_vul = npc.vulnerability
		if GlobalState.reputation < 30:
			adjusted_vul -= 20  # Skeptical of you
		elif GlobalState.reputation > 70:
			adjusted_vul += 10  # Trust you more
		
		btn.text = vul_color + " " + npc.name + "\n   " + npc.desc + "\n   Vulnerability: " + str(adjusted_vul) + "%"
		btn.set_meta("npc", npc)
		btn.pressed.connect(func(): select_recruit(npc, btn))
		
		$RecruitmentUI/RecruitList.add_child(btn)

func select_recruit(npc, btn):
	$RecruitmentUI.hide()
	$TacticsPanel.show()
	
	$TacticsPanel/TargetName.text = npc.name
	$TacticsPanel/TargetDesc.text = npc.desc + "\n\nVulnerability: " + str(npc.vulnerability) + "%"
	$TacticsPanel/TargetDesc.text += "\nRecruiting them adds " + str(npc.guilt) + " guilt."
	
	# Store current target
	$TacticsPanel.set_meta("current_npc", npc)

func _on_tactic_pressed(tactic_name):
	var npc = $TacticsPanel.get_meta("current_npc")
	
	# Calculate success based on stats
	var base_success = 50
	
	# Reputation helps/hurts
	base_success += (GlobalState.reputation - 50) / 2
	
	# Vulnerability matters
	base_success += npc.vulnerability / 2
	
	# High guilt makes you sloppy
	base_success -= GlobalState.guilt / 4
	
	# Roll for success
	var roll = randi() % 100
	var success = roll < base_success
	
	if success:
		# Recruited them
		GlobalState.recruits_made += 1
		GlobalState.guilt += npc.guilt
		GlobalState.money -= 50  # Cost to "help" them start
		GlobalState.stress += 5
		
		// Some recruits lose money (tracked for ending)
		if npc.vulnerability > 70:
			GlobalState.recruits_lost_money += 1
		
		show_result("✅ SUCCESS!", npc.name + " joined.\nGuilt +" + str(npc.guilt), Color(0.3, 1, 0.3))
	else:
		// Failed
		GlobalState.guilt += npc.guilt / 3  // Less guilt for failing
		GlobalState.stress += 2
		
		show_result("❌ FAILED", npc.name + " resisted.\nPartial guilt +" + str(npc.guilt / 3), Color(1, 0.5, 0.2))
	
	GlobalState.save_game()
	update_shared_ui()
	update_recruitment_ui()

func show_result(title, message, color):
	$ResultPanel.show()
	$TacticsPanel.hide()
	
	$ResultPanel/ResultTitle.text = title
	$ResultPanel/ResultTitle.modulate = color
	$ResultPanel/ResultText.text = message

func _on_back_button_pressed():
	$TacticsPanel.hide()
	$RecruitmentUI.show()

func _on_continue_result_pressed():
	$ResultPanel.hide()
	
	# Check for week end
	recruits_this_week += 1
	if recruits_this_week >= 3:
		end_week()
	else:
		$RecruitmentUI.show()

func end_week():
	current_week += 1
	recruits_this_week = 0
	
	if current_week > max_weeks:
		finish_recruitment()
		return
	
	$WeekEndPanel.show()
	$RecruitmentUI.hide()
	
	$WeekEndPanel/WeekText.text = "📅 End of Week " + str(current_week - 1)
	$WeekEndPanel/SummaryText.text = "Total recruits: " + str(GlobalState.recruits_made) + "\n"
	$WeekEndPanel/SummaryText.text += "Current guilt: " + str(GlobalState.guilt) + "/100\n"
	$WeekEndPanel/SummaryText.text += "People you harmed: " + str(GlobalState.recruits_lost_money) + "\n\n"
	
	if GlobalState.guilt > 60:
		$WeekEndPanel/SummaryText.text += "😰 You can't sleep. The DMs haunt you."
	elif GlobalState.guilt > 30:
		$WeekEndPanel/SummaryText.text += "🤔 Something feels wrong..."
	else:
		$WeekEndPanel/SummaryText.text += "💎 You're climbing the ranks!"

func _on_continue_week_pressed():
	$WeekEndPanel.hide()
	
	# Check for awakening (self-awareness from guilt)
	if GlobalState.guilt > 50 and randi() % 100 < GlobalState.guilt:
		GlobalState.self_awareness += 20
		show_awakening()
		return
	
	generate_recruits()
	$RecruitmentUI.show()

func show_awakening():
	$AwakeningPanel.show()
	$AwakeningPanel/AwakeningText.text = "🌅 AWAKENING\n\n"
	$AwakeningPanel/AwakeningText.text += "The pattern is clear now.\n\n"
	$AwakeningPanel/AwakeningText.text += "You're not building a business.\n"
	$AwakeningPanel/AwakeningText.text += "You're harvesting people.\n\n"
	$AwakeningPanel/AwakeningText.text += "Their faces. Their trust. Their money.\n\n"
	$AwakeningPanel/AwakeningText.text += "You decide to do something about it..."

func _on_join_resistance_pressed():
	GlobalState.story_path = "resistance"
	transition_to_investigation()

func _on_continue_recruiting_pressed():
	$AwakeningPanel.hide()
	generate_recruits()
	$RecruitmentUI.show()

func finish_recruitment():
	$GameOverPanel.show()
	$RecruitmentUI.hide()
	
	$GameOverPanel/TitleLabel.text = "💎 RECRUITMENT COMPLETE"
	
	var text = "Final Stats:\n\n"
	text += "Total recruits: " + str(GlobalState.recruits_made) + "\n"
	text += "People harmed: " + str(GlobalState.recruits_lost_money) + "\n"
	text += "Guilt level: " + str(GlobalState.guilt) + "/100\n"
	text += "Self-awareness: " + str(GlobalState.self_awareness) + "\n\n"
	
	if GlobalState.guilt > 70:
		text += "🏆 ENDING: HOLLOW VICTORY\nYou won the game. But lost yourself."
	elif GlobalState.self_awareness > 30:
		text += "⚠️ ENDING: CRACKS FORMING\nYou're starting to see the truth."
	else:
		text += "📉 ENDING: TRUE BELIEVER\nYou're one of them now."
	
	$GameOverPanel/DescLabel.text = text
	$GameOverPanel/ContinueButton.text = "➡️ THE COLLAPSE"

func _on_finish_recruitment_pressed():
	GlobalState.save_game()
	transition_to_infiltration()

# --- PHASE TRANSITIONS ---
func transition_to_infiltration():
	$PhaseTransition.play_transition("recruitment_to_infiltration")
	await get_tree().create_timer(2.0).timeout
	GlobalState.transition_to_phase("infiltration")
	get_tree().change_scene_to_file("res://src/scenes/infiltration_phase.tscn")

func transition_to_investigation():
	$PhaseTransition.play_transition("recruitment_to_investigation")
	await get_tree().create_timer(2.0).timeout
	GlobalState.transition_to_phase("investigation")
	get_tree().change_scene_to_file("res://src/scenes/investigation_phase.tscn")

# Button connections
func _on_lifestyle_tactic_pressed():
	_on_tactic_pressed("lifestyle")

func _on_pressure_tactic_pressed():
	_on_tactic_pressed("pressure")

func _on_income_claims_pressed():
	_on_tactic_pressed("income_claims")

func _on_pay_starter_pressed():
	_on_tactic_pressed("pay_starter")

func _on_conscience_pressed():
	# Back off
	GlobalState.guilt = max(0, GlobalState.guilt - 5)
	GlobalState.self_awareness += 10
	GlobalState.save_game()
	update_shared_ui()
	
	show_result("🛑 LISTENED TO CONSCIENCE", "You backed off.\nGuilt -5 | Awareness +10", Color(0.5, 0.8, 1))
