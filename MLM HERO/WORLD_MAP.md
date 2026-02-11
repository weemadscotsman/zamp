# MLM HERO - WORLD MAP

## Room Layout

```
BEDROOM (Start)
    ↓ Door
CITY HUB (Central Hub)
    ├── Coffee Shop ←→ Uncle Kev
    ├── MLM Office ←→ Diamond Dave
    ├── Library ←→ Research
    └── Syndicate Tower ←→ Infiltration
```

---

## Rooms Built

### 1. Bedroom (`bedroom.tscn`)
**Purpose:** Starting area, tutorial, phone/computer access

**Features:**
- Bed, desk, computer
- Door to City Hub
- Spawn point for new game
- Evidence: Phone with suspicious DMs

**Connections:**
- Exit → City Hub (from_bedroom)

---

### 2. City Hub (`city_hub.tscn`)
**Purpose:** Central connection point, exploration

**Features:**
- Large open area (1600x1200)
- 4 enterable buildings
- Wandering NPCs
- Sidewalks and roads
- Evidence: MLM flyer on ground

**Buildings:**
- Coffee Shop (brown)
- MLM Office (gold)
- Library (blue)
- Syndicate Tower (dark, locked until evidence collected)

**NPCs:**
- Uncle Kev (Coffee Shop entrance)
- 2 wandering pedestrians

**Connections:**
- Coffee Shop Door → Coffee Shop
- MLM Office Door → MLM Office
- Library Door → Library  
- Syndicate Door → Syndicate HQ (requires 3+ evidence)

---

### 3. Coffee Shop (`coffee_shop.tscn`)
**Purpose:** Meeting spot, information gathering

**Features:**
- Counter with barista
- Tables for sitting
- Cozy atmosphere

**NPCs:**
- Uncle Kev (main contact)
- Other customers

**Connections:**
- Exit → City Hub (from_coffee)

---

### 4. MLM Office (`mlm_office.tscn`)
**Purpose:** Recruitment phase, moral choices

**Features:**
- Reception desk
- Meeting table
- Diamond Dave's office
- Chairs for "opportunity meetings"
- Evidence: Income posters, recruitment scripts

**NPCs:**
- Diamond Dave (Boss)
- Receptionist (true believer)
- New Recruit (victim)

**Connections:**
- Exit → City Hub (from_office)

---

### 5. Library (`library.tscn`)
**Purpose:** Investigation phase, research

**Status:** ✅ BUILT
**Features:**
- Computers for research (interactive database search)
- Bookshelves (Books, Archives, Research sections)
- Reading table for study
- Evidence: Income disclosure statements, company history

**NPCs:**
- Computer terminal (interactive research)

**Connections:**
- Exit → City Hub (from_library)

---

### 6. Syndicate HQ (`syndicate_hq.tscn`)
**Purpose:** Infiltration phase, stealth mission

**Features:**
- Large office space (1600x1200)
- 3 patrolling guards with vision cones
- Hiding spots (plants, desks)
- 3 classified documents to steal
- Detection meter UI
- Emergency exit

**Enemies:**
- Guard 1 (horizontal patrol)
- Guard 2 (vertical patrol)
- Guard 3 (square patrol pattern)

**Evidence:**
- Internal emails
- Financial records
- Rebrand strategy

**Connections:**
- Exit → City Hub (from_syndicate)

---

## Evidence Locations

| Evidence | Room | Description |
|----------|------|-------------|
| sarah_income_claims | Bedroom | Suspicious DMs |
| mlm_denial | City Hub | Flyer saying "not MLM" |
| fabricated_success | MLM Office | Income posters |
| pressure_scripts | MLM Office | Recruitment script |
| internal_emails | Syndicate HQ | Executive emails |
| financial_records | Syndicate HQ | Offshore accounts |
| rebrand_strategy | Syndicate HQ | Bit-Konnexx plans |

---

## Room Transition Logic

### Locked Doors
- **Syndicate Tower:** Requires 3+ evidence to enter
- Shows "🔒 Locked" notification if player tries early

### Spawn Points
Each room tracks where player came from:
- From bedroom → spawn at bedroom exit
- From office → spawn at office door
- etc.

### Saving
Room transitions auto-save via GlobalState

---

## Next Rooms To Build

1. **Library** - Investigation area with computers
2. **Safe House** - Resistance base (if choosing investigation path)
3. **Boss Arena** - Final confrontation room

---

## Technical Details

### Scene Files Created:
- `bedroom.tscn`
- `city_hub.tscn`
- `coffee_shop.tscn`
- `mlm_office.tscn`
- `syndicate_hq.tscn`

### Scripts Created:
- `room_bedroom.gd`
- `room_city_hub.gd`
- `room_coffee_shop.gd`
- `room_mlm_office.gd`
- `room_syndicate_hq.gd`
- `guard.gd`

### Player Spawning:
Each room has:
- Spawn point Marker2D nodes
- Door Area2D with collision
- Transition logic to other rooms

---

## STATUS: 6/6 Core Rooms Built (100%)

✅ Bedroom  
✅ City Hub  
✅ Coffee Shop  
✅ MLM Office  
✅ Syndicate HQ  
✅ Library  
⏭️ Boss Arena (pending)  
