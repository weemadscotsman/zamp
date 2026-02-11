class_name PlayerStats
extends RefCounted

var logic: int = 10
var confidence: int = 20
var skepticism: int = 5
var social_credit: int = 30
var financial_health: int = -2000
var stress: int = 40
var trauma: int = 0
var innocence: int = 90
var cynicism: int = 10
var money: int = 500
var inventory: Array[String] = []
var relationships: Dictionary = {}
var flags: Dictionary = {}
var is_cycler: bool = true

func modify_stat(stat_name: String, value: int) -> void:
	match stat_name:
		"logic": logic = clamp(logic + value, 0, 100)
		"confidence": confidence = clamp(confidence + value, 0, 100)
		"skepticism": skepticism = clamp(skepticism + value, 0, 100)
		"social_credit": social_credit = clamp(social_credit + value, 0, 100)
		"financial_health": financial_health += value
		"stress": stress = clamp(stress + value, 0, 100)
		"trauma": trauma = clamp(trauma + value, 0, 100)
		"innocence": innocence = clamp(innocence + value, 0, 100)
		"cynicism": cynicism = clamp(cynicism + value, 0, 100)
		"money": money += value

func check_threshold(stat_name: String, threshold: int) -> bool:
	match stat_name:
		"logic": return logic >= threshold
		"confidence": return confidence >= threshold
		"skepticism": return skepticism >= threshold
		"social_credit": return social_credit >= threshold
		_: return false

func set_flag(flag_name: String, value: bool = true) -> void:
	flags[flag_name] = value

func has_flag(flag_name: String) -> bool:
	return flags.get(flag_name, false)
