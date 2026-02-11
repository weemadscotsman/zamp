# MLM HERO - Quick Start Guide 🚀

## WHAT WE BUILT

This is a **Godot 4** project for MLM HERO - a story-driven game about escaping scams.

### Current Status:
- ✅ Project structure
- ✅ Core systems (Stats, Scene Manager)
- ✅ First 4 scenes written
- ✅ Data format established
- ⬜ Need Godot 4 installed
- ⬜ Need art assets
- ⬜ Need to build UI scenes

---

## TO RUN THIS:

### 1. Install Godot 4
- Download from: https://godotengine.org/
- Get version 4.2 or higher
- It's FREE (MIT license)

### 2. Open Project
- Open Godot
- Click "Import"
- Navigate to: `C:\Users\Admin\Desktop\MLM HERO\project.godot`
- Click "Import & Edit"

### 3. Project Structure

```
MLM HERO/
├── project.godot          # Project settings
├── src/
│   ├── scenes/            # Godot scene files (.tscn)
│   │   └── (need to create)
│   └── scripts/           # GDScript files
│       ├── player_stats.gd
│       ├── scene_manager.gd
│       └── game_ui.gd
├── data/
│   └── scenes/            # JSON story data
│       └── act1_hustle.json
├── assets/                # Art, sound, music
│   ├── sprites/           # Character sprites
│   ├── backgrounds/       # Scene backgrounds
│   └── ui/                # UI elements
└── docs/                  # Documentation
    ├── STORY_BIBLE.md
    ├── MASTER_TIMELINE.md
    ├── GAME_DESIGN.md
    ├── CONTENT_BIBLE.md
    ├── TECH_DESIGN.md
    └── DEEP_LORE.md
```

---

## ART STYLE WE WANT

### World View
- **Semi-isometric top-down** (like Fallout 1/2, Disco Elysium)
- Character sprites: 2D pixel art or hand-drawn
- Environments: Isometric rooms, offices, stream setups

### UI Style
- **Fake websites/dashboards** as overlays
- Stream interface for Act 1
- Fake crypto dashboards
- MLM backoffice systems
- Phone screens for DMs

### Vibe
- Flashy neon (Act 1)
- Corporate grey (Megacorp)
- Glitch hell (Brainrot)
- Soft/warm (Repentance)

---

## NEXT STEPS TO MAKE IT PLAYABLE

### Priority 1: Core Scenes
Create these Godot scenes:
1. `main_menu.tscn` - Title screen
2. `game_screen.tscn` - Main gameplay UI
3. `dialogue_box.tscn` - Dialogue display
4. `choice_button.tscn` - Choice buttons

### Priority 2: First Playable
- Hook up scene manager to UI
- Load first scene from JSON
- Display dialogue
- Show choices
- Make choices advance story

### Priority 3: Systems
- Brainrot mini-game
- Repentance box
- Battle system
- Stats display

---

## CURRENT SCENES WRITTEN

### Act 1: The Hustle Dream

**Scene 1: Streamer Opening**
- Hero in bedroom, about to stream
- Shows off fake dashboard
- Gets DM from Sarah

**Scene 2: Sarah's Pitch**
- The recruitment conversation
- The urgency tactics
- The choice: Join or resist

**Scene 3: Early Success**
- Two weeks later
- Made first $50
- Team Zoom call hype
- The push to recruit/buy more

---

## DATA FORMAT

Scenes are stored in `data/scenes/*.json`

Each scene has:
- `background`: Image to show
- `music`: Audio to play
- `dialogue_sequence`: Array of dialogue lines
- `choices`: Array of player options

Example:
```json
{
  "background": "streamer_room_neon",
  "dialogue_sequence": [
    {
      "speaker": "narrator",
      "text": "8:47 PM. Your bedroom glows with ring lights."
    }
  ],
  "choices": [
    {
      "id": "go_live",
      "text": "Start the stream!",
      "next_scene": "beat_1_live_stream",
      "effects": [{"stat": "confidence", "value": 5}]
    }
  ]
}
```

---

## THE ENGINE WE PICKED

**Godot 4** because:
- Free forever (no licensing fees)
- Perfect for 2D + UI mixing
- Built-in scene system
- GDScript is Python-like
- Great for story games
- Exports to Web/PC/Mobile

---

## WHAT YOU NEED TO ADD

### Art (if you're doing it):
- Character portraits (256x256 or similar)
- Backgrounds (1280x720)
- UI elements (buttons, frames)
- Optional: Character sprites for isometric view

### OR Use Placeholders:
- Colored rectangles for characters
- Gradients for backgrounds
- Default Godot buttons
- Replace with real art later

### Sound:
- Music tracks (can use free/cheap assets)
- Sound effects
- Voice? (optional)

---

## THE VISION

### Game Flow:
```
Main Menu
    ↓
Scene 1: Streamer bedroom (isometric view)
    ↓
Phone screen overlay (DM conversation)
    ↓
Choice: Join the scam
    ↓
Act 2: Early success (stream interface)
    ↓
Platform collapse (dark turn)
    ↓
Brainrot punishment (vertical phone hell)
    ↓
Repentance box (cute animals)
    ↓
Act 3: Awakening (research montage)
    ↓
Act 4: Infiltration (corporate isometric)
    ↓
Act 5-8: Collapse and aftermath
    ↓
Ending: Writing the story
```

---

## READY TO BUILD?

### Option 1: You Handle Art
- Create/find character portraits
- Make backgrounds
- I'll code the systems

### Option 2: Placeholder First
- Use colored boxes
- Get gameplay working
- Replace art later

### Option 3: I Build More Systems
- Battle system
- Brainrot mini-game
- Repentance box
- More scenes

---

## QUESTIONS?

**Q: Do I need to know coding?**
A: No, I wrote the scripts. You just need Godot to run it.

**Q: Can I change the story?**
A: Yes! Edit the JSON files in `data/scenes/`

**Q: How long to make it playable?**
A: With placeholder art: 1-2 days. With real art: 1-2 weeks.

---

**LET'S BUILD THIS THING!** 🎮🔥
