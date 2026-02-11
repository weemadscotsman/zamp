# MLM HERO - Technical Design Document 🔧

## GAME ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                        MAIN GAME                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  SCENE MGR   │  │  BATTLE SYS  │  │  STORY MGR   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐       │
│  │  DIALOGUE    │  │  BRAINROT    │  │  SAVE/LOAD   │       │
│  │  ENGINE      │  │  SYSTEM      │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  STATS       │  │  INVENTORY   │  │  AUDIO       │       │
│  │  SYSTEM      │  │  SYSTEM      │  │  MANAGER     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## CORE SYSTEMS

### 1. SCENE MANAGEMENT SYSTEM

**Purpose:** Handle game flow between story beats

```python
class SceneManager:
    def __init__(self):
        self.current_scene = None
        self.scene_history = []
        self.flags = {}  # Story flags
    
    def load_scene(self, scene_id):
        """Load a scene by ID from data files"""
        pass
    
    def make_choice(self, choice_id):
        """Process player choice, update stats, progress story"""
        pass
    
    def check_flag(self, flag_name):
        """Check if story flag is set"""
        pass
```

**Scene Data Format (JSON):**
```json
{
  "scene_id": "opening_apartment",
  "background": "bedroom_night",
  "characters": ["hero"],
  "dialogue": [
    {
      "speaker": "narrator",
      "text": "It's 2 AM. You can't sleep.",
      "effects": [{"type": "mood", "value": -5}]
    }
  ],
  "choices": [
    {
      "id": "scroll_phone",
      "text": "Scroll social media",
      "next_scene": "dm_from_sarah",
      "effects": [{"stat": "stress", "value": 5}]
    },
    {
      "id": "try_sleep",
      "text": "Try to sleep",
      "next_scene": "alarm_clock",
      "effects": [{"stat": "stress", "value": -5}]
    }
  ]
}
```

---

### 2. CONVERSATION BATTLE SYSTEM

**Purpose:** Turn-based dialogue combat with scammers

```python
class BattleSystem:
    def __init__(self, player_stats, enemy_data):
        self.player = player_stats
        self.enemy = Enemy(enemy_data)
        self.turn = 0
        self.battle_log = []
    
    def enemy_attack(self):
        """Select and execute enemy attack based on AI"""
        pass
    
    def player_response(self, response_type):
        """Process player response, calculate damage"""
        pass
    
    def calculate_damage(self, attack, defense):
        """Math for battle outcomes"""
        pass
    
    def check_win_condition(self):
        """Check if battle should end"""
        pass
```

**Battle Data Format:**
```json
{
  "enemy_id": "boss_babe_brittany",
  "name": "Boss Babe Brittany",
  "hp": 100,
  "attacks": [
    {
      "name": "Toxic Positivity",
      "damage": 15,
      "type": "confidence",
      "dialogue": "Your negative mindset is blocking abundance!"
    },
    {
      "name": "Income Claim",
      "damage": 25,
      "type": "logic",
      "dialogue": "I made $50k last month! Here's my screenshot!"
    }
  ],
  "weakness": "evidence",
  "defeat_dialogue": "I have $40k of inventory in my garage..."
}
```

---

### 3. BRAINROT BANISHMENT SYSTEM

**Purpose:** Punishment mini-game for bad decisions

```python
class BrainrotSystem:
    def __init__(self):
        self.brainrot_meter = 0
        self.current_video = None
        self.flags_spotted = 0
        self.flags_missed = 0
    
    def trigger_banishment(self, reason):
        """Enter brainrot realm"""
        pass
    
    def play_video(self, video_data):
        """Show scam video, start timer"""
        pass
    
    def spot_flag(self, flag_type, x, y):
        """Player clicked a red flag"""
        pass
    
    def update_meter(self):
        """Adjust brainrot level"""
        pass
    
    def escape_condition(self):
        """Check if player can leave"""
        pass
```

**Brainrot Video Format:**
```json
{
  "video_id": "crypto_bro_rant",
  "duration": 8.0,
  "flags": [
    {
      "type": "fake_profit",
      "x": 100, "y": 200,
      "time_start": 2.0,
      "time_end": 6.0
    },
    {
      "type": "urgency_timer",
      "x": 300, "y": 50,
      "time_start": 4.0,
      "time_end": 8.0
    }
  ],
  "video_url": "assets/videos/crypto_bro.mp4",
  "audio": "assets/audio/chaos.mp3"
}
```

---

### 4. REPENTANCE BOX SYSTEM

**Purpose:** Recovery and buff system

```python
class RepentanceBox:
    def __init__(self):
        self.recovery_time = 0
        self.content_queue = []
        self.current_mood = "stressed"
    
    def enter(self, entry_reason):
        """Start recovery sequence"""
        pass
    
    def play_content(self, content_type):
        """Show animal videos, ambience"""
        pass
    
    def calculate_buffs(self, time_spent):
        """Return stat bonuses based on time"""
        pass
    
    def force_stay(self):
        """Prevent early exit if too stressed"""
        pass
```

---

### 5. STATS SYSTEM

**Purpose:** Track and modify player progression

```python
class PlayerStats:
    def __init__(self):
        # Primary Stats
        self.logic = 10
        self.confidence = 20
        self.skepticism = 5
        self.social_credit = 30
        self.financial_health = -2000  # Start in debt
        
        # Secondary Stats
        self.stress = 40
        self.trauma = 0
        self.innocence = 90
        self.cynicism = 10
        
        # Resources
        self.money = 500
        self.inventory = []
        self.relationships = {}
    
    def modify_stat(self, stat_name, value):
        """Safely modify a stat with bounds checking"""
        pass
    
    def check_threshold(self, stat_name, threshold):
        """Check if stat meets requirement"""
        pass
    
    def get_effective_stats(self):
        """Calculate stats after buffs/debuffs"""
        pass
```

---

### 6. SAVE/LOAD SYSTEM

**Purpose:** Persist game state

```python
class SaveSystem:
    def __init__(self):
        self.save_slots = 3
        self.save_directory = "saves/"
    
    def save_game(self, slot, game_state):
        """Serialize and save game"""
        pass
    
    def load_game(self, slot):
        """Deserialize and restore game"""
        pass
    
    def auto_save(self, game_state):
        """Quick save at checkpoints"""
        pass
    
    def export_save_data(self):
        """Convert game state to JSON"""
        pass
```

**Save Data Format:**
```json
{
  "version": "1.0",
  "timestamp": "2026-02-08T11:30:00Z",
  "player": {
    "stats": {...},
    "inventory": [...],
    "money": 450
  },
  "story": {
    "current_scene": "coffee_shop",
    "flags": ["met_crystal", "scam_1_collapsed"],
    "companions": ["crystal", "gary"]
  },
  "progress": {
    "scams_experienced": 3,
    "victims_saved": 12,
    "brainrot_escapes": 2
  }
}
```

---

## DATA STRUCTURES

### Scam Database
```json
{
  "scams": [
    {
      "id": "luminary_oasis",
      "name": "Luminary Oasis",
      "type": "wellness_mlm",
      "difficulty": 1,
      "target_demographic": ["parents", "health_conscious"],
      "products": [...],
      "recruitment_script": {...},
      "red_flags": [...],
      "collapse_event": {...}
    }
  ]
}
```

### Character Database
```json
{
  "characters": [
    {
      "id": "coach_crystal",
      "name": "Crystal",
      "archetype": "sports_mom",
      "state": "recruiting",
      "dialogue_sets": {
        "introduction": [...],
        "recruiting": [...],
        "rock_bottom": [...],
        "redemption": [...]
      },
      "battle_quotes": [...]
    }
  ]
}
```

### Scene Database
```json
{
  "scenes": [
    {
      "id": "beat_3_collapse",
      "beat_number": 3,
      "prerequisites": ["joined_scam_1"],
      "dialogue_sequence": [...],
      "trigger_brainrot": true,
      "next_scenes": [...]
    }
  ]
}
```

---

## USER INTERFACE

### Main Game Screen Layout
```
┌────────────────────────────────────────────────────┐
│  💰 $450  📊 Logic: 45  💪 Conf: 30  🔍 Skep: 20  │ <- Stats Bar
├────────────────────────────────────────────────────┤
│                                                    │
│              [SCENE BACKGROUND]                    │
│                                                    │
│      ┌─────┐                                       │
│      │ NPC │  "Hey! Want to be your own boss?"     │
│      └─────┘                                       │
│                                                    │
├────────────────────────────────────────────────────┤
│  > Narrator: The room feels too bright.           │ <- Dialogue Box
│                                                    │
├────────────────────────────────────────────────────┤
│  [ 1. Hear her out ]                              │ <- Choices
│  [ 2. Ask questions ]                             │
│  [ 3. Walk away ]                                 │
└────────────────────────────────────────────────────┘
```

### Battle Screen Layout
```
┌────────────────────────────────────────────────────┐
│  YOU: ████████████░░ 80%                          │
│  😐 Confidence: 45  🔍 Skepticism: 30              │
├────────────────────────────────────────────────────┤
│                                                    │
│              [BOSS ARENA]                          │
│                                                    │
│      ┌─────────┐                                   │
│      │ 💎      │  "You're just afraid of success!"│
│      │ BRITTANY│                                   │
│      │ 100/100 │                                   │
│      └─────────┘                                   │
│                                                    │
├────────────────────────────────────────────────────┤
│  💬 Battle Log:                                    │
│  > Brittany used Toxic Positivity!                 │
│  > Your Confidence dropped by 15!                  │
├────────────────────────────────────────────────────┤
│  [ 1. Show Math (requires Logic 30) ]             │
│  [ 2. Use Sarcasm (requires Conf 40) ]            │
│  [ 3. Deploy Evidence ]                           │
│  [ 4. Grey Rock (immune to emotional) ]           │
└────────────────────────────────────────────────────┘
```

### Brainrot Screen Layout
```
┌────────────────────────────────────────────────────┐
│  🧠 BRAINROT METER: ████████░░░░ 67%              │
│  Spot the red flags before the video ends!         │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────┐      │
│  │  [VIDEO PLAYING - CRYPTO BRO RANT]       │      │
│  │                                           │      │
│  │  "BRO I'M MAKING 10K A DAY PASSIVE!"      │      │
│  │      [📊]           [⏰]                  │      │
│  │   (click here)   (click here)             │      │
│  │                                           │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
│  ⏱️ Time: 3.2s / 8.0s                             │
├────────────────────────────────────────────────────┤
│  ✅ Spotted: Fake Profit Screenshot                │
│  ❌ Missed: Urgency Timer                          │
└────────────────────────────────────────────────────┘
```

---

## AUDIO SYSTEM

### Music Tracks
| Track | Use | BPM | Mood |
|-------|-----|-----|------|
| main_menu | Menu | 90 | Chill, ironic |
| false_hope | Act 1 | 120 | Upbeat, fake |
| reality_check | Act 2 | 80 | Somber |
| brainrot_chaos | Brainrot realm | 140 | Anxious, glitchy |
| repentance_cal | Repentance box | 60 | Peaceful |
| megacorp_tension | Infiltration | 100 | Suspense |
| victory_real | Good ending | 70 | Warm |

### Sound Effects
- ui_click.wav - Menu interaction
- text_scroll.wav - Dialogue typing
- damage_hit.wav - Stat damage
- damage_heal.wav - Stat recovery
- brainrot_glitch.wav - Brainrot transition
- success_chime.wav - Achievement
- error_buzz.wav - Bad choice

---

## DEVELOPMENT ROADMAP

### Phase 1: Core (Week 1-2)
- [ ] Scene manager
- [ ] Basic UI
- [ ] Stats system
- [ ] 3 opening scenes

### Phase 2: Battle (Week 3-4)
- [ ] Battle system
- [ ] 3 enemy types
- [ ] Response options
- [ ] First boss

### Phase 3: Brainrot (Week 5-6)
- [ ] Brainrot mini-game
- [ ] 10 video challenges
- [ ] Meter system
- [ ] Visual effects

### Phase 4: Repentance (Week 7)
- [ ] Repentance box
- [ ] Animal videos
- [ ] Recovery mechanics
- [ ] Buff system

### Phase 5: Story (Week 8-10)
- [ ] All 11 story beats
- [ ] Companion arcs
- [ ] Multiple endings
- [ ] Polish/dialogue

### Phase 6: Megacorp (Week 11-12)
- [ ] Infiltration system
- [ ] Suspicion meter
- [ ] Sabotage actions
- [ ] Final boss

### Phase 7: Release (Week 13-14)
- [ ] Sound design
- [ ] Achievements
- [ ] Polish
- [ ] Build & test

---

## TECH STACK RECOMMENDATION

### Option A: Godot 4 (Recommended)
**Pros:**
- Free, open source
- Built-in UI system
- Excellent 2D support
- GDScript is Python-like
- Export to Web/PC/Mobile
- Great for narrative games

**Cons:**
- Learning curve for beginners
- Smaller community than Unity

### Option B: Python + Pygame
**Pros:**
- Fastest prototyping
- No engine to learn
- Full Python control
- Great for text-heavy games

**Cons:**
- Manual UI construction
- Performance concerns
- Harder to polish
- Distribution harder

### Recommended Choice: Godot 4
Best balance of speed, polish, and learning for this project.

---

## FILE STRUCTURE

```
mlm_hero/
├── project.godot              # Godot project file
├── assets/
│   ├── images/
│   │   ├── backgrounds/       # Scene backgrounds
│   │   ├── characters/        # Character portraits
│   │   ├── ui/                # Buttons, frames, etc.
│   │   └── effects/           # Brainrot glitches, etc.
│   ├── audio/
│   │   ├── music/             # Background tracks
│   │   └── sfx/               # Sound effects
│   └── fonts/                 # Typography
├── data/
│   ├── scenes/                # JSON scene files
│   ├── characters/            # Character data
│   ├── scams/                 # Scam database
│   ├── battles/               # Enemy definitions
│   └── brainrot/              # Brainrot video data
├── src/
│   ├── main.gd                # Entry point
│   ├── scene_manager.gd       # Scene system
│   ├── battle_system.gd       # Battle mechanics
│   ├── stats_system.gd        # Player stats
│   ├── brainrot_system.gd     # Brainrot mini-game
│   ├── repentance_system.gd   # Recovery system
│   └── save_system.gd         # Persistence
├── scenes/                    # Godot scene files
│   ├── main_menu.tscn
│   ├── game_screen.tscn
│   ├── battle_screen.tscn
│   ├── brainrot_screen.tscn
│   └── repentance_box.tscn
└── docs/                      # Documentation
    ├── STORY_BIBLE.md
    ├── GAME_DESIGN.md
    ├── CONTENT_BIBLE.md
    └── TECH_DESIGN.md
```

---

## NEXT STEPS

1. **Set up Godot 4** and create project
2. **Build Scene Manager** - The backbone
3. **Create first 3 scenes** - Opening beats
4. **Implement Stats System** - Core progression
5. **Prototype Battle System** - One enemy
6. **Build Brainrot prototype** - Basic mini-game

Let's build this thing! 🚀
