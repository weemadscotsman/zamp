# MANUAL TEST CHECKLIST
## Run these tests in-game

---

## STARTUP TEST
- [ ] Game launches without errors
- [ ] Main menu displays
- [ ] Clicking Start loads Bedroom

---

## BEDROOM TEST
- [ ] Player spawns in bedroom
- [ ] Player can move with WASD
- [ ] Player collides with walls/furniture
- [ ] Player can interact with objects (E key)
- [ ] Walking into door triggers transition
- [ ] Transitions to City Hub

---

## CITY HUB TEST
- [ ] Player spawns at correct location
- [ ] All 4 buildings visible
- [ ] Can walk around freely
- [ ] Can talk to Uncle Kev (E key)
- [ ] Can talk to wandering NPCs
- [ ] Evidence (flyer) can be collected
- [ ] Walking into building doors:
  - [ ] Coffee Shop works
  - [ ] MLM Office works
  - [ ] Library (if exists)
  - [ ] Syndicate Tower (locked until 3 evidence)

---

## COFFEE SHOP TEST
- [ ] Room loads correctly
- [ ] Furniture has collision
- [ ] Exit returns to City Hub

---

## MLM OFFICE TEST
- [ ] Room loads correctly
- [ ] Can talk to Diamond Dave
- [ ] Can talk to Receptionist
- [ ] Can talk to New Recruit
- [ ] Evidence items collectible
- [ ] Exit returns to City Hub

---

## SYNDICATE HQ TEST (STEALTH)
- [ ] Room loads with dark theme
- [ ] 3 guards patrol correctly
- [ ] Detection bar appears
- [ ] Player can hide in hiding spots
- [ ] Guards detect player when visible
- [ ] Getting caught resets position
- [ ] Documents can be collected
- [ ] Exit requires 2+ documents
- [ ] Successful escape returns to City Hub

---

## DIALOGUE SYSTEM TEST
- [ ] Talking to NPC opens dialogue box
- [ ] Text appears with typewriter effect
- [ ] Can skip typing with E/Space
- [ ] Can advance dialogue
- [ ] Choice buttons appear when available
- [ ] Selecting choice applies effects
- [ ] Portrait shows for major NPCs

---

## EVIDENCE SYSTEM TEST
- [ ] Evidence items sparkle
- [ ] Collecting evidence shows notification
- [ ] Evidence appears in UI counter
- [ ] Collecting increases skepticism
- [ ] Already-collected evidence hidden on reload

---

## SAVE/LOAD TEST
- [ ] Game auto-saves on room transition
- [ ] Evidence collected persists
- [ ] Stats (followers, skepticism) persist
- [ ] Can load saved game from main menu

---

## UI TEST
- [ ] Shared UI visible in all rooms
- [ ] Follower count updates
- [ ] Evidence counter updates
- [ ] Skepticism bar color changes
- [ ] Phase indicator shows correct phase
- [ ] DM button works (if implemented)

---

## EDGE CASES
- [ ] Rapid room transitions don't crash
- [ ] Holding sprint works
- [ ] Sneaking reduces speed
- [ ] Can't walk through walls
- [ ] NPCs don't walk through walls

---

## EXPECTED BUGS (Temporary)
- [ ] Player sprite is colored rectangle (no art yet)
- [ ] NPC sprites are colored rectangles (no art yet)
- [ ] No sound effects
- [ ] No music
- [ ] No particle effects (sparkles, etc.)

---

## PASS CRITERIA
- **PASS:** 90%+ of tests work
- **FAIL:** Major crashes or soft locks
- **PARTIAL:** Some features broken but core loop works

---

## HOW TO TEST

1. Open Godot 4.6
2. Open MLM HERO project
3. Press F6 (Play Scene) with `main_menu.tscn` open
4. Follow checklist above
5. Mark results

**Report any failures with:**
- What you were doing
- What you expected
- What actually happened
- Any error messages
