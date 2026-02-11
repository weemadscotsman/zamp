# MLM HERO - TOP-DOWN RPG PIVOT
## Pivot from Visual Novel to Zelda-Style RPG + Dialogue

---

## WHAT CHANGED

### BEFORE (Visual Novel)
- Static screens with buttons
- Phase-based menu navigation
- Dialogue through text boxes only
- Mini-games as separate scenes

### AFTER (Top-Down RPG Hybrid)
- Player character moves with WASD/Arrows
- Explore physical spaces (bedroom, city, offices)
- Talk to NPCs by walking up and pressing E
- Evidence as physical collectibles in world
- Seamless transitions between areas

---

## NEW CORE SYSTEMS

### 1. Player Controller (`player_controller.gd`)
- **Top-down movement** with acceleration/friction
- **8-directional facing** for interaction
- **Sprint** (Shift) and **Sneak** (Ctrl) modes
- **Interaction ray** for talking to NPCs
- **State machine**: IDLE, WALK, SNEAK

### 2. Dialogue Manager (`dialogue_manager.gd`)
- **Context-sensitive** - triggers when near NPCs
- **Typewriter effect** with skip option
- **Choice system** with stat effects
- **Pause gameplay** during dialogue
- **Animated UI** with portraits

### 3. NPC System (`npc.gd`)
- **Walk around** with patrol patterns
- **Face player** when talked to
- **Exclamation marks** for quest givers
- **Dynamic dialogue** based on game state

### 4. Evidence Items (`evidence_item.gd`)
- **Physical objects** in the world
- **Sparkle effects** to draw attention
- **Collection animation** with flash
- **Evidence popup** showing details

### 5. Room Manager (`room_manager.gd`)
- **Seamless transitions** between areas
- **Spawn points** for consistent entry
- **Loading screens** with MLM facts

---

## WORLD STRUCTURE

```
BEDROOM (Phase 1 Start)
    ↓
CITY HUB (Connects all areas)
    ├── MLM Office (Recruitment Phase)
    ├── Library/Archives (Investigation Phase)  
    ├── Syndicate HQ (Infiltration Phase)
    └── Safe House (Resistance Base)
```

### Room: Bedroom
- Player's starting location
- Computer for social media phase
- Bed, desk, furniture with collision
- Door to city hub

### Room: City Hub (WIP)
- Central connection point
- Multiple NPCs wandering
- Signs pointing to different areas
- Ambient city sounds

### Room: MLM Office (WIP)
- Recruitment phase location
- Diamond Dave's office
- Meeting rooms
- Desks with evidence

### Room: Syndicate HQ (WIP)
- Infiltration phase
- Guards with vision cones
- Documents to steal
- Security systems

---

## GAMEPLAY FLOW (NEW)

1. **Wake up in bedroom**
   - Walk around, check phone
   - Find suspicious DM from Sarah
   - *Evidence collected: sarah_income_claims*

2. **Explore city**
   - Talk to NPCs
   - Find Uncle Kev at coffee shop
   - Learn about MLM patterns

3. **Make choice**
   - Go to MLM Office (Recruitment path)
   - Go to Library (Investigation path)
   - Ignore everything (Safe ending)

4. **Recruitment Path**
   - Attend "opportunity meeting"
   - Meet Diamond Dave
   - Try to recruit people (guilt mechanic)
   - Can switch to resistance at any time

5. **Investigation Path**
   - Research company history
   - Find income disclosure
   - Interview victims
   - Build case

6. **Infiltration Path**
   - Sneak into HQ
   - Avoid guards
   - Steal documents
   - Escape

7. **Final Confrontation**
   - Use collected evidence
   - Choose how to expose them
   - Multiple endings based on path

---

## CONTROLS

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Shift | Sprint |
| Ctrl | Sneak (stealth) |
| E / Space | Interact / Talk |
| Esc | Pause Menu |

---

## FILES CREATED

### Core Systems (6)
- `player_controller.gd` - Movement and interaction
- `dialogue_manager.gd` - Conversation system
- `npc.gd` - Non-player characters
- `evidence_item.gd` - Collectible evidence
- `room_manager.gd` - Scene transitions
- `audio_manager.gd` - Sound (stub)

### Scenes (4)
- `player.tscn` - Player character
- `dialogue_manager.tscn` - Dialogue UI
- `bedroom.tscn` - Starting room
- `room_bedroom.gd` - Room logic

### Rooms Directory
- `src/scenes/rooms/` - All level scenes go here

---

## WHAT WORKS NOW

✅ Player movement (WASD)  
✅ Collision with walls/furniture  
✅ Dialogue system  
✅ Room transitions  
✅ Global state integration  
✅ Shared UI across all scenes  

## WHAT NEEDS WORK

⏭️ NPC sprites and animations  
⏭️ More rooms (city hub, office, etc.)  
⏭️ Guard AI for infiltration  
⏭️ Evidence item placement  
⏭️ Quest/mission system  
⏭️ Boss battle mechanics  
⏭️ Art assets (sprites, tilesets)  

---

## TESTING

Run `comprehensive_test.tscn` to verify:
- Global state works
- Save/load works
- All scenes load
- No broken references

---

## NEXT STEPS

1. **Create City Hub room**
2. **Add 3-4 NPCs with dialogue**
3. **Place evidence items**
4. **Build MLM Office**
5. **Add stealth mechanics**
6. **Create boss battle**

---

**The game is now a TOP-DOWN RPG with visual novel dialogue.**

**STATUS: Playable foundation, needs content** 🎮
