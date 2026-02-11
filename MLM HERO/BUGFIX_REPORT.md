# BUGFIX REPORT - Menu/Start Button Issues

## DATE: 2026-02-09

---

## BUGS REPORTED
1. Start button doesn't work
2. No game loads
3. Text box overlaid on start menu

---

## ROOT CAUSES IDENTIFIED

### Bug 1: Text Box Overlay
**Cause:** DialogueBox in `dialogue_manager.tscn` was visible by default

**File:** `src/scenes/dialogue_manager.tscn`

**Problem:**
```
[node name="DialogueBox" type="Panel" parent="."]
```
(No visible = false)

**Fix:**
```
[node name="DialogueBox" type="Panel" parent="."]
visible = false
```

---

### Bug 2: Start Button Not Working
**Cause:** Bedroom scene had potential loading issues

**Files Affected:**
- `src/scenes/rooms/bedroom.tscn`
- `src/scripts/room_bedroom.gd`
- `src/scripts/main_menu.gd`

**Problems:**
1. Bedroom scene was spawning player via script, causing timing issues
2. No error handling if scene fails to load
3. Door connection could fail silently

**Fixes:**
1. Simplified bedroom scene - player now placed directly in scene
2. Added error handling to main_menu.gd
3. Added null checks to room_bedroom.gd
4. Added debug prints for troubleshooting

---

## CHANGES MADE

### 1. dialogue_manager.tscn
```diff
- [node name="DialogueBox" type="Panel" parent="."]
+ [node name="DialogueBox" type="Panel" parent="."]
+ visible = false
```

### 2. bedroom.tscn
- Simplified structure
- Player now instanced directly in scene (not spawned via script)
- Fixed subresource ordering

### 3. room_bedroom.gd
- Added null checks
- Added debug prints
- Simplified door connection
- Direct scene change (not using RoomManager for now)

### 4. main_menu.gd
- Added debug prints
- Added error handling with fallback to simple_game.tscn
- Better button connection logging

### 5. player.tscn
- Moved subresource definition to top (before usage)
- Cleaner structure

---

## HOW TO TEST FIXES

1. Open Godot 4.6
2. Open `main_menu.tscn`
3. Press F6 (Play Scene)
4. Check Output panel for:
   - "Main menu ready"
   - "Start button connected"
5. Click START GAME
6. Check Output panel for:
   - "Start button pressed"
   - "GlobalState reset..."
   - "changing scene to bedroom..."
7. Bedroom should load with:
   - Player in center
   - No dialogue box visible
   - Can move with WASD

---

## IF STILL BROKEN

Check Output panel for error messages and report them.

Common issues:
- `Cannot find file` = Path is wrong
- `Null instance` = Node not found
- `Method not found` = Script error

---

## STATUS

- ✅ DialogueBox hidden by default
- ✅ Bedroom scene simplified
- ✅ Error handling added
- ✅ Debug logging added

**READY FOR TESTING**
