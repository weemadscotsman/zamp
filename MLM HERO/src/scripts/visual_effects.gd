extends CanvasLayer

# VISUAL EFFECTS MANAGER
# Juicy feedback for everything!

@onready var shake_camera = $ShakeCamera
@onready var particles = $Particles

# Screen shake intensity
var shake_intensity = 0.0
var shake_decay = 5.0

# Chromatic aberration for brainrot
var chromatic_aberration = 0.0

func _process(delta):
	# Screen shake decay
	if shake_intensity > 0:
		shake_intensity = max(0, shake_intensity - shake_decay * delta)
		var shake_offset = Vector2(
			randf_range(-shake_intensity, shake_intensity),
			randf_range(-shake_intensity, shake_intensity)
		)
		shake_camera.offset = shake_offset
	else:
		shake_camera.offset = Vector2.ZERO

# --- SCREEN SHAKE ---
func shake(intensity: float, duration: float = 0.5):
	shake_intensity = intensity
	shake_decay = intensity / duration

func small_shake():
	shake(5.0, 0.3)

func medium_shake():
	shake(10.0, 0.5)

func big_shake():
	shake(20.0, 0.8)

# --- PARTICLE EFFECTS ---
func spawn_confetti(position: Vector2, color: Color = Color.GOLD):
	for i in range(20):
		var particle = ColorRect.new()
		particle.color = color
		particle.size = Vector2(4, 4)
		particle.position = position
		particles.add_child(particle)
		
		# Animate
		var tween = create_tween()
		var end_pos = position + Vector2(randf_range(-100, 100), randf_range(-150, 50))
		tween.tween_property(particle, "position", end_pos, 1.0)
		tween.parallel().tween_property(particle, "rotation", randf() * 360, 1.0)
		tween.parallel().tween_property(particle, "modulate:a", 0, 1.0)
		tween.tween_callback(particle.queue_free)

func spawn_evidence_sparkle(position: Vector2):
	for i in range(10):
		var sparkle = ColorRect.new()
		sparkle.color = Color(1, 0.9, 0.3)
		sparkle.size = Vector2(3, 3)
		sparkle.position = position
		particles.add_child(sparkle)
		
		var tween = create_tween()
		var direction = Vector2(randf() - 0.5, randf() - 0.5).normalized()
		var end_pos = position + direction * randf_range(30, 80)
		tween.tween_property(sparkle, "position", end_pos, 0.6)
		tween.parallel().tween_property(sparkle, "scale", Vector2(0, 0), 0.6)
		tween.tween_callback(sparkle.queue_free)

func spawn_glitch_pixels(rect: Rect2, intensity: float = 1.0):
	for i in range(int(10 * intensity)):
		var pixel = ColorRect.new()
		pixel.color = Color(randf(), randf(), randf())
		pixel.size = Vector2(randf_range(2, 8), randf_range(2, 4))
		pixel.position = Vector2(
			rect.position.x + randf_range(0, rect.size.x),
			rect.position.y + randf_range(0, rect.size.y)
		)
		particles.add_child(pixel)
		
		var tween = create_tween()
		tween.tween_property(pixel, "position:x", pixel.position.x + randf_range(-50, 50), 0.2)
		tween.parallel().tween_property(pixel, "modulate:a", 0, 0.2)
		tween.tween_callback(pixel.queue_free)

func spawn_text_float(text: String, position: Vector2, color: Color = Color.WHITE):
	var label = Label.new()
	label.text = text
	label.modulate = color
	label.position = position
	label.theme_override_font_sizes/font_size = 20
	particles.add_child(label)
	
	var tween = create_tween()
	tween.tween_property(label, "position:y", position.y - 50, 1.0)
	tween.parallel().tween_property(label, "modulate:a", 0, 1.0)
	tween.tween_callback(label.queue_free)

# --- BUTTON JUICE ---
func animate_button_press(button: Button):
	var tween = create_tween()
	tween.tween_property(button, "scale", Vector2(0.95, 0.95), 0.05)
	tween.tween_property(button, "scale", Vector2(1.0, 1.0), 0.1)

func animate_button_hover(button: Button, enter: bool):
	var tween = create_tween()
	if enter:
		tween.tween_property(button, "scale", Vector2(1.05, 1.05), 0.1)
		button.modulate = button.modulate.lightened(0.2)
	else:
		tween.tween_property(button, "scale", Vector2(1.0, 1.0), 0.1)
		button.modulate = Color.WHITE

# --- PANEL TRANSITIONS ---
func slide_in_panel(panel: Control, from_right: bool = true):
	var start_x = 800 if from_right else -800
	panel.position.x = start_x
	panel.modulate.a = 0
	
	var tween = create_tween()
	tween.tween_property(panel, "position:x", 0, 0.4).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(panel, "modulate:a", 1, 0.3)

func fade_in_node(node: Control, duration: float = 0.5):
	node.modulate.a = 0
	var tween = create_tween()
	tween.tween_property(node, "modulate:a", 1, duration)

func pop_in_node(node: Control):
	node.scale = Vector2(0, 0)
	node.modulate.a = 0
	
	var tween = create_tween()
	tween.tween_property(node, "scale", Vector2(1.1, 1.1), 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(node, "modulate:a", 1, 0.2)
	tween.tween_property(node, "scale", Vector2(1, 1), 0.1)

# --- FLASH EFFECTS ---
func flash_white(duration: float = 0.2):
	var flash = ColorRect.new()
	flash.color = Color.WHITE
	flash.size = Vector2(800, 600)
	flash.modulate.a = 0.8
	add_child(flash)
	
	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0, duration)
	tween.tween_callback(flash.queue_free)

func flash_red(duration: float = 0.3):
	var flash = ColorRect.new()
	flash.color = Color(1, 0.2, 0.2)
	flash.size = Vector2(800, 600)
	flash.modulate.a = 0.5
	add_child(flash)
	
	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0, duration)
	tween.tween_callback(flash.queue_free)
	
	shake(10, duration)

func flash_green(duration: float = 0.3):
	var flash = ColorRect.new()
	flash.color = Color(0.2, 1, 0.3)
	flash.size = Vector2(800, 600)
	flash.modulate.a = 0.3
	add_child(flash)
	
	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0, duration)
	tween.tween_callback(flash.queue_free)

# --- GLITCH EFFECTS ---
func glitch_node(node: Control, intensity: float = 1.0):
	var original_pos = node.position
	
	var tween = create_tween()
	for i in range(5):
		var offset = Vector2(randf_range(-5, 5) * intensity, randf_range(-2, 2) * intensity)
		tween.tween_property(node, "position", original_pos + offset, 0.02)
	tween.tween_property(node, "position", original_pos, 0.05)

func rgb_split(node: Control, amount: float = 3.0):
	# Simulate chromatic aberration
	var r_offset = ColorRect.new()
	r_offset.color = Color(1, 0, 0, 0.3)
	r_offset.size = node.size
	r_offset.position = node.position + Vector2(-amount, 0)
	
	var b_offset = ColorRect.new()
	b_offset.color = Color(0, 0, 1, 0.3)
	b_offset.size = node.size
	b_offset.position = node.position + Vector2(amount, 0)
	
	add_child(r_offset)
	add_child(b_offset)
	
	var tween = create_tween()
	tween.tween_property(r_offset, "modulate:a", 0, 0.3)
	tween.parallel().tween_property(b_offset, "modulate:a", 0, 0.3)
	tween.tween_callback(func():
		r_offset.queue_free()
		b_offset.queue_free()
	)

# --- NUMBER POPUPS ---
func show_number_change(label: Label, old_value: int, new_value: int, color_good: Color = Color.GREEN, color_bad: Color = Color.RED):
	var change = new_value - old_value
	if change == 0:
		return
	
	var popup = Label.new()
	popup.text = "+%d" % change if change > 0 else "%d" % change
	popup.modulate = color_good if change > 0 else color_bad
	popup.position = label.global_position + Vector2(0, -20)
	popup.theme_override_font_sizes/font_size = 16
	add_child(popup)
	
	# Animate
	var tween = create_tween()
	tween.tween_property(popup, "position:y", popup.position.y - 30, 0.8)
	tween.parallel().tween_property(popup, "modulate:a", 0, 0.8)
	tween.tween_callback(popup.queue_free)
	
	# Pop the label
	var pop_tween = create_tween()
	pop_tween.tween_property(label, "scale", Vector2(1.2, 1.2), 0.1)
	pop_tween.tween_property(label, "scale", Vector2(1.0, 1.0), 0.2)
