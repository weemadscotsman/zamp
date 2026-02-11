extends CanvasLayer

# TOAST NOTIFICATION SYSTEM
# Sliding notifications for achievements and milestones

var toast_queue = []
var is_showing = false

@onready var toast_container = $ToastContainer

func _ready():
	# Pre-create toast panels
	for i in range(3):
		var toast = _create_toast_panel()
		toast.hide()
		toast_container.add_child(toast)

func _create_toast_panel() -> Panel:
	var panel = Panel.new()
	panel.custom_minimum_size = Vector2(300, 80)
	
	var bg = ColorRect.new()
	bg.color = Color(0.1, 0.1, 0.15, 0.95)
	bg.anchors_preset = Control.PRESET_FULL_RECT
	panel.add_child(bg)
	
	var icon = Label.new()
	icon.name = "Icon"
	icon.layout_mode = 0
	icon.offset_left = 15
	icon.offset_top = 15
	icon.offset_right = 55
	icon.offset_bottom = 65
	icon.theme_override_font_sizes/font_size = 32
	icon.text = "🏆"
	panel.add_child(icon)
	
	var title = Label.new()
	title.name = "Title"
	title.layout_mode = 0
	title.offset_left = 65
	title.offset_top = 10
	title.offset_right = 285
	title.offset_bottom = 35
	title.theme_override_font_sizes/font_size = 16
	title.theme_override_colors/font_color = Color(0.9, 0.9, 0.3)
	title.text = "Achievement"
	panel.add_child(title)
	
	var desc = Label.new()
	desc.name = "Desc"
	desc.layout_mode = 0
	desc.offset_left = 65
	desc.offset_top = 35
	desc.offset_right = 285
	desc.offset_bottom = 70
	desc.theme_override_font_sizes/font_size = 12
	desc.theme_override_colors/font_color = Color(0.8, 0.8, 0.8)
	desc.text = "Description"
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(desc)
	
	# Glow border
	var glow = ColorRect.new()
	glow.color = Color(0.9, 0.8, 0.3, 0.3)
	glow.anchors_preset = Control.PRESET_FULL_RECT
	glow.size.y = 3
	glow.position.y = 77
	panel.add_child(glow)
	
	return panel

func show_toast(icon: String, title: String, description: String, duration: float = 3.0):
	var toast_data = {
		"icon": icon,
		"title": title,
		"description": description,
		"duration": duration
	}
	
	if is_showing:
		toast_queue.append(toast_data)
	else:
		_display_toast(toast_data)

func _display_toast(data: Dictionary):
	is_showing = true
	
	# Get available toast panel
	var toast = toast_container.get_child(0)
	
	# Update content
	toast.get_node("Icon").text = data.icon
	toast.get_node("Title").text = data.title
	toast.get_node("Desc").text = data.description
	
	# Position off-screen
	toast.position = Vector2(800, 500)
	toast.modulate.a = 0
	toast.show()
	
	# Animate in
	var tween = create_tween()
	tween.tween_property(toast, "position:x", 480, 0.4).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(toast, "modulate:a", 1, 0.3)
	
	# Hold
	tween.tween_interval(data.duration)
	
	// Animate out
	tween.tween_property(toast, "position:x", 850, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(toast, "modulate:a", 0, 0.2)
	tween.tween_callback(func():
		toast.hide()
		is_showing = false
		
		# Show next in queue
		if toast_queue.size() > 0:
			var next = toast_queue.pop_front()
			_display_toast(next)
	)

# --- PRESET TOASTS ---
func evidence_found(evidence_name: String):
	show_toast("📄", "Evidence Acquired", evidence_name, 3.0)

func milestone_reached(milestone: String):
	show_toast("⭐", "Milestone", milestone, 4.0)

func phase_unlocked(phase_name: String):
	show_toast("🔓", "New Phase Unlocked", phase_name, 4.0)

func stat_milestone(stat: String, value: int):
	show_toast("📈", stat + " Reached", "Now at " + str(value), 2.5)

func warning(message: String):
	show_toast("⚠️", "Warning", message, 3.0)

func achievement(title: String, description: String):
	show_toast("🏆", title, description, 5.0)
