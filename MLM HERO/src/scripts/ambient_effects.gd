extends CanvasLayer

# AMBIENT EFFECTS - Background atmosphere
# Subtle, non-distracting visual polish

@onready var bg_particles = $BGParticles
@onready var floating_shapes = $FloatingShapes

var time = 0.0

func _ready():
	_spawn_background_particles()
	_spawn_floating_shapes()

func _process(delta):
	time += delta
	_animate_floating_shapes(delta)

# --- BACKGROUND PARTICLES ---
func _spawn_background_particles():
	# Subtle dust/particles floating in background
	for i in range(15):
		var particle = ColorRect.new()
		particle.color = Color(1, 1, 1, randf_range(0.03, 0.08))
		particle.size = Vector2(randf_range(2, 5), randf_range(2, 5))
		particle.position = Vector2(randf_range(0, 800), randf_range(0, 600))
		particle.set_meta("speed", randf_range(5, 15))
		particle.set_meta("wobble", randf_range(0.5, 2.0))
		particle.set_meta("offset", randf() * 100)
		bg_particles.add_child(particle)

func _animate_floating_shapes(delta):
	for child in bg_particles.get_children():
		var speed = child.get_meta("speed")
		var wobble = child.get_meta("wobble")
		var offset = child.get_meta("offset")
		
		# Gentle upward drift with sine wave
		child.position.y -= speed * delta
		child.position.x += sin(time * wobble + offset) * 0.5
		
		# Wrap around screen
		if child.position.y < -10:
			child.position.y = 610
			child.position.x = randf_range(0, 800)

# --- FLOATING GEOMETRIC SHAPES ---
func _spawn_floating_shapes():
	# Large, slow-moving geometric shapes for depth
	var shapes = []
	
	# Diamond
	var diamond = Polygon2D.new()
	diamond.polygon = PackedVector2Array([
		Vector2(0, -30), Vector2(30, 0),
		Vector2(0, 30), Vector2(-30, 0)
	])
	diamond.color = Color(0.3, 0.7, 0.9, 0.05)
	shapes.append(diamond)
	
	# Triangle
	var triangle = Polygon2D.new()
	triangle.polygon = PackedVector2Array([
		Vector2(0, -25), Vector2(25, 20), Vector2(-25, 20)
	])
	triangle.color = Color(0.9, 0.3, 0.7, 0.05)
	shapes.append(triangle)
	
	# Hexagon
	var hex = Polygon2D.new()
	hex.polygon = PackedVector2Array([
		Vector2(20, 0), Vector2(10, 17), Vector2(-10, 17),
		Vector2(-20, 0), Vector2(-10, -17), Vector2(10, -17)
	])
	hex.color = Color(0.9, 0.8, 0.3, 0.05)
	shapes.append(hex)
	
	for i in range(3):
		var shape = shapes[i % shapes.size()].duplicate()
		shape.position = Vector2(randf_range(100, 700), randf_range(100, 500))
		shape.set_meta("base_pos", shape.position)
		shape.set_meta("float_speed", randf_range(0.3, 0.8))
		shape.set_meta("float_range", randf_range(10, 30))
		shape.set_meta("phase", randf() * PI * 2)
		shape.set_meta("rotation_speed", randf_range(-0.2, 0.2))
		floating_shapes.add_child(shape)

func _animate_floating_shapes(delta):
	for child in floating_shapes.get_children():
		var base_pos = child.get_meta("base_pos")
		var speed = child.get_meta("float_speed")
		var range_val = child.get_meta("float_range")
		var phase = child.get_meta("phase")
		var rot_speed = child.get_meta("rotation_speed")
		
		# Gentle floating motion
		child.position.y = base_pos.y + sin(time * speed + phase) * range_val
		child.position.x = base_pos.x + cos(time * speed * 0.5 + phase) * (range_val * 0.5)
		
		# Slow rotation
		child.rotation += rot_speed * delta

# --- PULSE EFFECTS ---
func pulse_glow(node: Control, color: Color, intensity: float = 1.0):
	var glow = ColorRect.new()
	glow.color = color
	glow.color.a = 0.2 * intensity
	glow.size = node.size + Vector2(20, 20)
	glow.position = node.position - Vector2(10, 10)
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(glow)
	
	# Animate pulse
	var tween = create_tween()
	tween.tween_property(glow, "size", node.size + Vector2(40, 40), 0.5)
	tween.parallel().tween_property(glow, "position", node.position - Vector2(20, 20), 0.5)
	tween.parallel().tween_property(glow, "modulate:a", 0, 0.5)
	tween.tween_callback(glow.queue_free)

func ripple_effect(position: Vector2, color: Color = Color.WHITE):
	for i in range(3):
		var ripple = ColorRect.new()
		ripple.color = color
		ripple.color.a = 0.3
		ripple.size = Vector2(10, 10)
		ripple.position = position - Vector2(5, 5)
		ripple.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(ripple)
		
		var tween = create_tween()
		tween.tween_interval(i * 0.1)
		tween.tween_property(ripple, "size", Vector2(100, 100), 0.6)
		tween.parallel().tween_property(ripple, "position", position - Vector2(50, 50), 0.6)
		tween.parallel().tween_property(ripple, "modulate:a", 0, 0.6)
		tween.tween_callback(ripple.queue_free)

# --- LIGHTING EFFECTS ---
func add_corner_glow(color: Color, corner: String = "top_left"):
	var glow = PointLight2D.new()
	
	match corner:
		"top_left":
			glow.position = Vector2(0, 0)
		"top_right":
			glow.position = Vector2(800, 0)
		"bottom_left":
			glow.position = Vector2(0, 600)
		"bottom_right":
			glow.position = Vector2(800, 600)
	
	glow.color = color
	glow.energy = 0.5
	glow.texture = _create_light_texture()
	glow.range_z_min = -100
	glow.range_z_max = 100
	add_child(glow)
	
	# Animate
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(glow, "energy", 0.3, 2.0)
	tween.tween_property(glow, "energy", 0.6, 2.0)

func _create_light_texture() -> GradientTexture2D:
	var texture = GradientTexture2D.new()
	var gradient = Gradient.new()
	gradient.add_point(0.0, Color.WHITE)
	gradient.add_point(1.0, Color(1, 1, 1, 0))
	texture.gradient = gradient
	texture.width = 400
	texture.height = 400
	texture.fill = GradientTexture2D.FILL_RADIAL
	return texture
