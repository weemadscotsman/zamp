extends AnimatedSprite2D

# Character animator - handles walk, idle, fight animations

@export var character_name: String = "hero"

var current_state: String = "idle"

func _ready():
	load_animations()
	play("idle")

func load_animations():
	# Godot will load sprite frames from files like:
	# res://assets/sprites/hero/idle_01.png, idle_02.png, etc.
	
	var sprite_frames = SpriteFrames.new()
	
	# Load idle animation
	var idle_frames = []
	for i in range(1, 5):  # idle_01 to idle_04
		var path = "res://assets/sprites/" + character_name + "/idle_%02d.png" % i
		if ResourceLoader.exists(path):
			var tex = load(path)
			if tex:
				idle_frames.append(tex)
	
	if idle_frames.size() > 0:
		sprite_frames.add_animation("idle")
		for frame in idle_frames:
			sprite_frames.add_frame("idle", frame)
		sprite_frames.set_animation_speed("idle", 5.0)
		sprite_frames.set_animation_loop("idle", true)
	
	# Load walk animation
	var walk_frames = []
	for i in range(1, 5):
		var path = "res://assets/sprites/" + character_name + "/walk_%02d.png" % i
		if ResourceLoader.exists(path):
			var tex = load(path)
			if tex:
				walk_frames.append(tex)
	
	if walk_frames.size() > 0:
		sprite_frames.add_animation("walk")
		for frame in walk_frames:
			sprite_frames.add_frame("walk", frame)
		sprite_frames.set_animation_speed("walk", 8.0)
		sprite_frames.set_animation_loop("walk", true)
	
	# Load fight animation
	var fight_frames = []
	for i in range(1, 5):
		var path = "res://assets/sprites/" + character_name + "/fight_%02d.png" % i
		if ResourceLoader.exists(path):
			var tex = load(path)
			if tex:
				fight_frames.append(tex)
	
	if fight_frames.size() > 0:
		sprite_frames.add_animation("fight")
		for frame in fight_frames:
			sprite_frames.add_frame("fight", frame)
		sprite_frames.set_animation_speed("fight", 10.0)
		sprite_frames.set_animation_loop("fight", false)
	
	self.sprite_frames = sprite_frames

func set_state(new_state: String):
	if new_state != current_state and sprite_frames.has_animation(new_state):
		current_state = new_state
		play(new_state)

func idle():
	set_state("idle")

func walk():
	set_state("walk")

func fight():
	set_state("fight")
