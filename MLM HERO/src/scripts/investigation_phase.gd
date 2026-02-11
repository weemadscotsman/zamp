extends Control

# INVESTIGATION PHASE - Detective gameplay
# Research the MLM, find evidence, build your case

var day = 1
var max_days = 5

var evidence_found = []
var leads = []
var current_lead = null

var research_stamina = 100  # Decreases with actions, refills daily
var suspicion_level = 0  # If too high, they might notice you

var investigation_areas = [
	{
		"name": "Social Media Deep Dive",
		"icon": "📱",
		"desc": "Analyze Sarah's posts, look for inconsistencies",
		"stamina_cost": 20,
		"evidence_types": ["income_claims", "lifestyle_fabrication"],
		"unlock_condition": null
	},
	{
		"name": "Public Records Search",
		"icon": "📚",
		"desc": "Company registrations, lawsuits, complaints",
		"stamina_cost": 30,
		"evidence_types": ["company_history", "legal_issues"],
		"unlock_condition": null
	},
	{
		"name": "Former Victim Interviews",
		"icon": "🗣️",
		"desc": "Find people who lost money, hear their stories",
		"stamina_cost": 40,
		"evidence_types": ["testimonies", "financial_loss"],
		"unlock_condition": "day2"
	},
	{
		"name": "Income Disclosure Analysis",
		"icon": "📊",
		"desc": "Crunch the numbers they don't want you to see",
		"stamina_cost": 35,
		"evidence_types": ["statistical_proof", "income_distribution"],
		"unlock_condition": "public_records"
	},
	{
		"name": "Network Mapping",
		"icon": "🕸️",
		"desc": "Connect shell companies, trace the money",
		"stamina_cost": 50,
		"evidence_types": ["shell_companies", "money_trail"],
		"unlock_condition": "income_disclosure"
	}
]

var evidence_database = {
	"income_claims": {
		"title": "💰 Fabricated Income Claims",
		"desc": "Screenshots show $12k/month but metadata reveals they're from 2019 and recycled.",
		"strength": 2
	},
	"lifestyle_fabrication": {
		"title": "📸 Staged Lifestyle Photos",
		"desc": "Rented cars, AirBnB mansions, fake it till you make it.",
		"strength": 1
	},
	"company_history": {
		"title": "🏢 Corporate Shell Game",
		"desc": "Same address registered 5 different 'companies' in 3 years.",
		"strength": 3
	},
	"legal_issues": {
		"title": "⚖️ Legal Warnings",
		"desc": "CEASE AND DESIST orders from 2 states. Still operating.",
		"strength": 4
	},
	"testimonies": {
		"title": "💔 Victim Testimonies",
		"desc": "12 people interviewed. Average loss: $4,500. Dreams destroyed.",
		"strength": 3
	},
	"financial_loss": {
		"title": "📉 Documented Losses",
		"desc": "Bankruptcy filings tied to 'distributors'. The human cost.",
		"strength": 4
	},
	"statistical_proof": {
		"title": "📊 The 99.7% Truth",
		"desc": "Official disclosure: 99.7% earn less than minimum wage. 80% lose money.",
		"strength": 5
	},
	"income_distribution": {
		"title": "💸 Pyramid Distribution",
		"desc": "Chart shows classic pyramid shape. Top 0.1% make 90% of money.",
		"strength": 5
	},
	"shell_companies": {
		"title": "🎭 The Rebrand Cycle",
		"desc": "Bit-Konnexx → CryptoKonnekt → BlockKonnect → KonneXion. Same people.",
		"strength": 4
	},
	"money_trail": {
		"title": "💳 Following the Money",
		"desc": "Payments flow to offshore accounts. Trace ends in Cyprus.",
		"strength": 5
	}
}

var unlocked_areas = []
var discovered_connections = []

func _ready():
	unlocked_areas = [investigation_areas[0], investigation_areas[1]]
	update_ui()
	show_investigation_screen()

func update_ui():
	$TopBar/DayLabel.text = "📅 Day %d/%d" % [day, max_days]
	$TopBar/StaminaLabel.text = "⚡ Stamina: %d/100" % research_stamina
	$TopBar/EvidenceLabel.text = "📄 Evidence: %d" % evidence_found.size()
	$TopBar/SuspicionLabel.text = "👁️ Suspicion: %d%%" % suspicion_level
	
	# Update stamina bar
	$StaminaBar.value = research_stamina
	
	# Color code suspicion
	if suspicion_level > 70:
		$TopBar/SuspicionLabel.modulate = Color(1, 0.3, 0.3)
	elif suspicion_level > 40:
		$TopBar/SuspicionLabel.modulate = Color(1, 0.8, 0.3)
	else:
		$TopBar/SuspicionLabel.modulate = Color(1, 1, 1)

func show_investigation_screen():
	$InvestigationPanel.show()
	$EvidencePanel.hide()
	$ConnectionPanel.hide()
	$ResultPanel.hide()
	$DayEndPanel.hide()
	
	update_investigation_areas()

func update_investigation_areas():
	for child in $InvestigationPanel/AreaList.get_children():
		child.queue_free()
	
	for area in unlocked_areas:
		var btn = Button.new()
		btn.custom_minimum_size = Vector2(0, 80)
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		
		var cost_text = "⚡ %d" % area.stamina_cost
		var can_afford = research_stamina >= area.stamina_cost
		
		btn.text = area.icon + " " + area.name + "\n   " + area.desc + "\n   " + cost_text
		btn.pressed.connect(func(): investigate_area(area))
		btn.disabled = not can_afford
		
		if not can_afford:
			btn.modulate = Color(0.5, 0.5, 0.5)
		
		$InvestigationPanel/AreaList.add_child(btn)
	
	# Add end day button
	var end_btn = Button.new()
	end_btn.custom_minimum_size = Vector2(0, 50)
	end_btn.text = "🌙 End Day (Restore Stamina)"
	end_btn.modulate = Color(0.7, 0.8, 1)
	end_btn.pressed.connect(func(): end_day())
	$InvestigationPanel/AreaList.add_child(end_btn)

func investigate_area(area):
	research_stamina -= area.stamina_cost
	suspicion_level += 5  # Each investigation raises suspicion slightly
	
	# Determine success and what evidence is found
	var roll = randi() % 100
	var success_threshold = 70  // 70% base success rate
	
	if roll < success_threshold:
		// Success - found evidence
		var evidence_type = area.evidence_types[randi() % area.evidence_types.size()]
		
		if not evidence_type in evidence_found:
			evidence_found.append(evidence_type)
			show_evidence_found(evidence_type)
		else:
			// Already have this evidence, find connection instead
			find_connection()
	else:
		// Partial success - lead only
		show_lead_found(area)
	
	# Check for unlocks
	check_unlocks(area)
	
	update_ui()
	
	# Check game state
	check_investigation_state()

func show_evidence_found(evidence_type):
	var evidence = evidence_database[evidence_type]
	
	$ResultPanel.show()
	$ResultPanel/ResultTitle.text = "📄 EVIDENCE ACQUIRED!"
	$ResultPanel/ResultTitle.modulate = Color(0.3, 1, 0.3)
	$ResultPanel/ResultText.text = "[b]" + evidence.title + "[/b]\n\n"
	$ResultPanel/ResultText.text += evidence.desc + "\n\n"
	$ResultPanel/ResultText.text += "Evidence Strength: " + "⭐".repeat(evidence.strength)
	
	$InvestigationPanel.hide()

func show_lead_found(area):
	$ResultPanel.show()
	$ResultPanel/ResultTitle.text = "🔍 LEAD DISCOVERED"
	$ResultPanel/ResultTitle.modulate = Color(1, 0.8, 0.3)
	$ResultPanel/ResultText.text = "You found a promising lead in " + area.name + ",\nbut you need more stamina to fully investigate.\n\n"
	$ResultPanel/ResultText.text += "💡 Tip: End the day to restore stamina and continue tomorrow."
	
	$InvestigationPanel.hide()

func find_connection():
	$ResultPanel.show()
	$ResultPanel/ResultTitle.text = "🔗 CONNECTION FOUND!"
	$ResultPanel/ResultTitle.modulate = Color(0.5, 0.8, 1)
	
	var connections = [
		"Sarah's 'mentor' also worked for Bit-Konnexx",
		"The same photographer shoots for 5 'different' MLMs",
		"Company address matches 3 previous scams",
		"Diamond Dave was involved in CryptoKonnekt collapse"
	]
	
	var connection = connections[randi() % connections.size()]
	discovered_connections.append(connection)
	
	$ResultPanel/ResultText.text = "Connecting the dots...\n\n" + connection + "\n\n"
	$ResultPanel/ResultText.text += "The pattern becomes clearer!"
	
	$InvestigationPanel.hide()
	
	# Connections reduce suspicion (you're getting smarter)
	suspicion_level = max(0, suspicion_level - 10)

func check_unlocks(area):
	// Unlock new areas based on progress
	if area.name == "Public Records Search" and not investigation_areas[3] in unlocked_areas:
		unlocked_areas.append(investigation_areas[3])
		$StatusLabel.text = "🔓 New area unlocked: Income Disclosure Analysis!"
	
	if len(evidence_found) >= 3 and not investigation_areas[2] in unlocked_areas:
		unlocked_areas.append(investigation_areas[2])
		$StatusLabel.text = "🔓 New area unlocked: Former Victim Interviews!"
	
	if len(evidence_found) >= 6 and not investigation_areas[4] in unlocked_areas:
		unlocked_areas.append(investigation_areas[4])
		$StatusLabel.text = "🔓 New area unlocked: Network Mapping!"

func check_investigation_state():
	if suspicion_level >= 100:
		show_discovered()
	elif evidence_found.size() >= 8:
		show_ready_to_publish()
	elif research_stamina <= 0 and day >= max_days:
		show_investigation_complete()

func end_day():
	day += 1
	research_stamina = 100
	
	if day > max_days:
		show_investigation_complete()
	else:
		$DayEndPanel.show()
		$InvestigationPanel.hide()
		
		$DayEndPanel/DaySummary.text = "📅 End of Day " + str(day - 1) + "\n\n"
		$DayEndPanel/DaySummary.text += "Evidence collected: " + str(evidence_found.size()) + "/10\n"
		$DayEndPanel/DaySummary.text += "Connections discovered: " + str(discovered_connections.size()) + "\n"
		$DayEndPanel/DaySummary.text += "Current suspicion: " + str(suspicion_level) + "%\n\n"
		
		if evidence_found.size() >= 5:
			$DayEndPanel/DaySummary.text += "📰 You could publish what you have..."
		else:
			$DayEndPanel/DaySummary.text += "💡 Keep investigating. The truth is out there."

func show_discovered():
	$GameOverPanel.show()
	$GameOverPanel/TitleLabel.text = "⚠️ THEY NOTICED YOU"
	$GameOverPanel/DescLabel.text = "Your investigation raised too many red flags.\n\n"
	$GameOverPanel/DescLabel.text += "Sarah blocked you.\nDiamond Dave sent a cease & desist.\n"
	$GameOverPanel/DescLabel.text += "Your evidence is good, but incomplete.\n\n"
	$GameOverPanel/DescLabel.text += "You have a choice: Publish now or go deeper?"
	
	$GameOverPanel/Choice1Button.text = "📢 PUBLISH WHAT YOU HAVE"
	$GameOverPanel/Choice1Button.pressed.connect(func(): publish_early())
	
	$GameOverPanel/Choice2Button.text = "🕵️ GO DEEPER (Risky)"
	$GameOverPanel/Choice2Button.pressed.connect(func(): go_underground())
	$GameOverPanel/Choice2Button.show()

func show_ready_to_publish():
	$GameOverPanel.show()
	$GameOverPanel/TitleLabel.text = "📰 READY TO PUBLISH"
	$GameOverPanel/DescLabel.text = "You've built an airtight case.\n\n"
	$GameOverPanel/DescLabel.text += "Evidence strength: " + str(calculate_case_strength()) + "/50\n"
	$GameOverPanel/DescLabel.text += "Connections mapped: " + str(discovered_connections.size()) + "\n\n"
	$GameOverPanel/DescLabel.text += "This could shut them down.\nBut are you ready for the backlash?"
	
	$GameOverPanel/Choice1Button.text = "🚀 PUBLISH EXPOSE"
	$GameOverPanel/Choice1Button.pressed.connect(func(): publish_full())
	
	$GameOverPanel/Choice2Button.text = "🕵️ INFILTRATE FOR MORE"
	$GameOverPanel/Choice2Button.pressed.connect(func(): launch_infiltration())
	$GameOverPanel/Choice2Button.show()

func show_investigation_complete():
	$GameOverPanel.show()
	$GameOverPanel/TitleLabel.text = "⏰ TIME'S UP"
	$GameOverPanel/DescLabel.text = "You've done what you can.\n\n"
	$GameOverPanel/DescLabel.text += "Final evidence count: " + str(evidence_found.size()) + "/10\n"
	$GameOverPanel/DescLabel.text += "Case strength: " + str(calculate_case_strength()) + "/50\n\n"
	
	if evidence_found.size() >= 5:
		$GameOverPanel/DescLabel.text += "📢 You have enough to warn people."
		$GameOverPanel/Choice1Button.text = "📢 PUBLISH FINDINGS"
		$GameOverPanel/Choice1Button.pressed.connect(func(): publish_partial())
	else:
		$GameOverPanel/DescLabel.text += "⚠️ Not enough for a full expose."
		$GameOverPanel/Choice1Button.text = "🔄 TRY AGAIN"
		$GameOverPanel/Choice1Button.pressed.connect(func(): restart_investigation())
	
	$GameOverPanel/Choice2Button.hide()

func calculate_case_strength() -> int:
	var total = 0
	for ev in evidence_found:
		total += evidence_database[ev].strength
	return total

func publish_early():
	GlobalState.story_path = "early_expose"
	for ev in evidence_found:
		GlobalState.add_evidence(ev)
	get_tree().change_scene_to_file("res://src/scenes/simple_game.tscn")

func go_underground():
	// Continue with higher stakes
	suspicion_level = 50
	day = max_days  // Extra time but riskier
	max_days = 7
	$GameOverPanel.hide()
	$StatusLabel.text = "🕵️ Going underground... Using fake accounts."
	update_ui()
	show_investigation_screen()

func publish_full():
	GlobalState.story_path = "full_expose"
	for ev in evidence_found:
		GlobalState.add_evidence(ev)
	get_tree().change_scene_to_file("res://src/scenes/simple_game.tscn")

func publish_partial():
	GlobalState.story_path = "partial_expose"
	for ev in evidence_found:
		GlobalState.add_evidence(ev)
	get_tree().change_scene_to_file("res://src/scenes/simple_game.tscn")

func launch_infiltration():
	GlobalState.story_path = "infiltrate_after_research"
	for ev in evidence_found:
		GlobalState.add_evidence(ev)
	get_tree().change_scene_to_file("res://src/scenes/infiltration_phase.tscn")

func restart_investigation():
	day = 1
	research_stamina = 100
	suspicion_level = 0
	evidence_found.clear()
	discovered_connections.clear()
	unlocked_areas = [investigation_areas[0], investigation_areas[1]]
	$GameOverPanel.hide()
	update_ui()
	show_investigation_screen()

func _on_continue_result_pressed():
	$ResultPanel.hide()
	show_investigation_screen()

func _on_continue_day_pressed():
	$DayEndPanel.hide()
	update_ui()
	show_investigation_screen()

func _on_evidence_button_pressed():
	$EvidencePanel.show()
	$InvestigationPanel.hide()
	
	var text = "[b]📋 EVIDENCE BOARD[/b]\n\n"
	for ev_id in evidence_found:
		var ev = evidence_database[ev_id]
		text += ev.icon + " [b]" + ev.title + "[/b]\n"
		text += ev.desc + "\n"
		text += "Strength: " + "⭐".repeat(ev.strength) + "\n\n"
	
	if discovered_connections.size() > 0:
		text += "[b]🔗 CONNECTIONS:[/b]\n"
		for conn in discovered_connections:
			text += "• " + conn + "\n"
	
	$EvidencePanel/EvidenceText.text = text

func _on_close_evidence_pressed():
	$EvidencePanel.hide()
	show_investigation_screen()
