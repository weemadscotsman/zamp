extends Node

# TEXT EFFECTS - Animated typography
# Rich text animations and styling

func animate_text_reveal(label: Label, text: String, speed: float = 0.03):
	label.text = ""
	
	for i in range(text.length()):
		label.text += text[i]
		await label.get_tree().create_timer(speed).timeout

func animate_wave_text(label: Label, amplitude: float = 3.0, speed: float = 5.0):
	# Requires the label to be in a container that allows position modification
	var original_y = label.position.y
	
	while label:
		label.position.y = original_y + sin(Time.get_time_dict_from_system()["second"] * speed) * amplitude
		await label.get_tree().process_frame

func style_title(label: Label, glow_color: Color = Color.GOLD):
	# Add shadow
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	
	# Outline
	label.add_theme_color_override("font_outline_color", glow_color)
	label.add_theme_constant_override("outline_size", 1)

func add_glow_pulse(label: Label, color: Color):
	var tween = label.create_tween()
	tween.set_loops()
	
	# Create glow effect using modulate
	var original_modulate = label.modulate
	tween.tween_property(label, "modulate", color.lightened(0.3), 1.0)
	tween.tween_property(label, "modulate", original_modulate, 1.0)

func typewriter_with_sound(label: Label, text: String, sound_player: AudioStreamPlayer = null):
	label.text = ""
	
	for char in text:
		label.text += char
		
		# Play typing sound if available
		if sound_player and randi() % 3 == 0:  # Don't play for every character
			sound_player.play()
		
		await label.get_tree().create_timer(0.03).timeout

func scramble_reveal(label: Label, final_text: String, duration: float = 1.0):
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	var elapsed = 0.0
	
	while elapsed < duration:
		var progress = elapsed / duration
		var revealed_count = int(final_text.length() * progress)
		
		var display_text = ""
		for i in range(final_text.length()):
			if i < revealed_count:
				display_text += final_text[i]
			else:
				display_text += chars[randi() % chars.length()]
		
		label.text = display_text
		elapsed += 0.05
		await label.get_tree().create_timer(0.05).timeout
	
	label.text = final_text

func gradient_text(rich_label: RichTextLabel, text: String, color1: Color, color2: Color) -> String:
	var result = ""
	for i in range(text.length()):
		var t = float(i) / max(1, text.length() - 1)
		var color = color1.lerp(color2, t)
		var hex = "#%02X%02X%02X" % [int(color.r * 255), int(color.g * 255), int(color.b * 255)]
		result += "[color=" + hex + "]" + text[i] + "[/color]"
	
	return result

func rainbow_text(rich_label: RichTextLabel, text: String, speed: float = 1.0) -> String:
	var time = Time.get_time_dict_from_system()["second"]
	var result = ""
	
	for i in range(text.length()):
		var hue = fmod(time * speed + float(i) / text.length(), 1.0)
		var color = Color.from_hsv(hue, 0.8, 1.0)
		var hex = "#%02X%02X%02X" % [int(color.r * 255), int(color.g * 255), int(color.b * 255)]
		result += "[color=" + hex + "]" + text[i] + "[/color]"
	
	return result

func shake_text(label: Label, intensity: float = 2.0, duration: float = 0.5):
	var original_position = label.position
	var elapsed = 0.0
	
	while elapsed < duration:
		label.position = original_position + Vector2(
			randf_range(-intensity, intensity),
			randf_range(-intensity, intensity)
		)
		elapsed += 0.05
		await label.get_tree().create_timer(0.05).timeout
	
	label.position = original_position
