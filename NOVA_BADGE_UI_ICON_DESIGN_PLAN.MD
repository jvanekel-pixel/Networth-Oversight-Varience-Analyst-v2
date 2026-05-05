You are working on/Designing the UI Portion of NOVA's Badging Card/System:
### Stage 5 — UI Layer
**Scope:** Make all of this visible.

- **Badge Showcase Screen** (new screen or Settings sub-section): Grid of all badges. Earned tiers shown in full color with icon placeholder. Locked tiers shown as dim outlines. Tap any badge to see progress bars for all three variables and "X more to next tier" gap.
- **XP Progress Bar:** Subtle bar or number in the header or dashboard. Shows progress toward next Nova Agent tier.
- **Streak Counter:** Weekly Active Streak shown prominently — always visible. Payday Streak shown contextually on the income confirmation screen.
- **Unlock Toast:** When `pendingUnlocks` has entries, show a full-screen overlay congratulation moment on next app open. Should feel like an event, not a notification banner. Clear entry after display.


NOVA Badge System — Visual Language + Production Strategy

The style reference you attached is extremely close to the Ingress medal system:

hexagonal medal containers
minimal iconography
glowing neon-accent sci-fi palette
metallic tier progression
dark UI with emissive highlights
geometric line language
restrained detail density
icon-first recognition

Your best optimization path is:

Core Production Strategy

Instead of generating 50 unique badges, CODEX should generate:

10 master badge SVGs
1 shared Dormant/Locked shell
5 reusable tier palettes/styles
automated tint/material swapping per tier

That means:

same icon geometry
same base hex frame
same lighting model
only material/color/effects change

This dramatically conserves tokens + generation time.

UNIVERSAL BADGE SYSTEM SPEC
Badge Shape

All badges use:

perfect hexagonal medal
beveled metallic border
subtle depth extrusion
matte interior panel
glowing accent lines
centered symbolic icon
UI Style Keywords

Use these consistently in ALL prompts:

futuristic tactical UI, ingress-style achievement medal, matte metallic hexagon, emissive cyan accents, subtle glow lines, geometric iconography, sci-fi operations interface, high contrast on black background, minimal but prestigious, engraved metal surfaces, clean vector geometry, restrained detail density, premium game HUD aesthetic

TIER SYSTEM (Reusable)
Dormant / Locked
dark graphite hex
nearly black interior
faint teal outline
icon hidden or obscured
tiny center lock glyph
no glow
low opacity
Bronze
copper/bronze alloy
amber highlights
low glow
first visible icon reveal
Silver
brushed titanium
cool cyan glow
brighter edge lighting
Gold
warm gold alloy
cream emissive highlights
prestige shine
Platinum
dark chrome + white-blue glow
more animated energy accents
sharper reflections
Onyx
black obsidian metal
neon cyan + violet glow
highest contrast
subtle animated energy veins
feels “legendary”
GLOBAL UI IMPLEMENTATION RULES
Grid

Use:

2 rows x 5 columns
equal spacing
black background
hover/tap enlarges slightly
locked badges stay visible but obscured
Progress States

Each badge needs:

dormant
active current tier
progress ring
completed pulse state
Animation Language

Minimal.
No cartoon effects.

Use:

glow pulses
scanning lines
energy sweep
subtle shimmer
tiny parallax rotation

Avoid:

confetti
bounce
playful motion
mobile game excess

MASTER CODEX SYSTEM PROMPT

Use this before generating any badge:
Design a futuristic achievement medal for a premium fintech application inspired by Ingress-style badge systems.

STYLE:
- tactical sci-fi UI
- matte metallic hexagon
- geometric vector iconography
- restrained detail density
- emissive cyan energy accents
- black background
- premium prestige aesthetic
- subtle glow effects
- engraved metallic surfaces
- centered symbolic icon
- no cartoon styling
- no fantasy RPG styling
- no gradients that feel playful
- clean readable silhouette at small sizes

STRUCTURE:
- identical hexagonal frame system for all badges
- icon centered
- layered metallic depth
- thin illuminated trim lines
- designed as scalable SVG/UI asset

OUTPUT:
Generate:
1. dormant/locked version
2. bronze
3. silver
4. gold
5. platinum
6. onyx

Only change:
- materials
- emissive intensity
- accent colors
- surface prestige

Do NOT redesign the icon between tiers.
THE 10 BADGES
1. PAYDAY ORACLE

"You showed up when it mattered."

Visual Identity

A futuristic financial sigil:

circular radar/grid
vertical income marker
timing rings
central numeric pulse

Should feel:

precise
important
elite
operational
Symbol Concept

A glowing paycheck beacon.

Badge Prompt:
Create a futuristic fintech achievement badge called “Payday Oracle”.

ICON:
A circular timing grid with a central vertical income beacon, radar sweep lines, and synchronized pulse rings representing precise paycheck confirmation timing.

MOOD:
Elite operational precision.
Feels like monitoring critical financial signals.

STYLE:
Ingress-style tactical medal, hexagonal metallic badge, emissive cyan and amber accents, clean geometric linework, matte metal surfaces, premium sci-fi UI.

2. VAULT GUARDIAN

"Building the thing you said you would."

Visual Identity
secure vault
shield geometry
upward accumulation
protected reserve energy
Symbol Concept

A protected savings core.

Badge Prompt:
Create a futuristic fintech achievement badge called “Vault Guardian”.

ICON:
A protected energy vault with layered shield geometry surrounding a glowing reserve core. Subtle upward accumulation lines indicate savings growth.

MOOD:
Security, discipline, protection, long-term stability.

STYLE:
Ingress-inspired tactical achievement medal, metallic hexagonal frame, restrained geometric iconography, cyan energy accents, premium sci-fi financial interface.
3. BILL SLAYER

"Recurring obligations don't scare you."

Visual Identity
fractured invoice
precision strike
crossed payment marks
cut-through geometry
Symbol Concept

Bills destroyed before due date.

Badge Prompt:
Create a futuristic fintech achievement badge called “Bill Slayer”.

ICON:
Angular invoice geometry split apart by precision strike lines, with clean payment confirmation marks integrated into the design.

MOOD:
Efficient, proactive, controlled, decisive.

STYLE:
Sci-fi tactical medal, matte metallic hexagon, minimal geometric iconography, emissive edge lighting, Ingress-style prestige system aesthetic.
4. GROCERY SENTINEL

"The most frequent battlefield in your budget."

Visual Identity
surveillance eye
circular budget perimeter
subtle cart/basket abstraction
monitoring field
Symbol Concept

Watching the grocery zone.

Badge Prompt
Create a futuristic fintech achievement badge called “Grocery Sentinel”.

ICON:
A surveillance-style eye symbol surrounded by circular monitoring rings and subtle budget perimeter markers, representing disciplined grocery tracking.

MOOD:
Awareness, vigilance, sustained discipline.

STYLE:
Ingress-inspired futuristic achievement medal, dark metallic surfaces, emissive cyan accents, tactical UI iconography, premium vector geometry.
5. LEDGER KEEPER

"The habit of looking."

Visual Identity
compass/navigation symbol
balance alignment
directional certainty
tracking instrument
Symbol Concept

Financial orientation and awareness.

Badge Prompt
Create a futuristic fintech achievement badge called “Ledger Keeper”.

ICON:
A futuristic compass-like financial navigation instrument with balance alignment markers and symmetrical directional geometry.

MOOD:
Awareness, orientation, consistency, clarity.

STYLE:
Premium sci-fi achievement medal, hexagonal metallic badge, restrained vector geometry, emissive cyan energy lines, Ingress-style tactical aesthetic.
6. CYCLE CLOSER

"You finished the month with your eyes open."

Visual Identity
completed circular loop
resolved financial cycle
closure ring
green-state completion
Symbol Concept

A completed and stabilized cycle.

Badge Prompt
Create a futuristic fintech achievement badge called “Cycle Closer”.

ICON:
A closed financial loop formed from segmented cycle geometry with a stabilized illuminated completion core.

MOOD:
Completion, control, successful financial closure.

STYLE:
Ingress-inspired medal system, matte metallic hexagon, clean geometric iconography, premium tactical UI, subtle energy glow accents.
7. INCOME ARCHITECT

"Every dollar had a destination before it arrived."

Visual Identity
branching allocation paths
structured routing
planned distribution
financial circuitry
Symbol Concept

Intentional money routing.

Badge Prompt
Create a futuristic fintech achievement badge called “Income Architect”.

ICON:
Structured branching financial pathways distributing energy from a central income source into organized allocation channels.

MOOD:
Strategic, intelligent, methodical, engineered.

STYLE:
Futuristic tactical medal, metallic hexagonal badge, emissive routing lines, geometric vector UI design, Ingress-style prestige aesthetic.
8. VARIANCE ANALYST

"You didn't just see yellow. You understood it."

Visual Identity
volatility waveform
analytical overlays
variance graph
correction vectors
Symbol Concept

Reading and correcting instability.

Badge Prompt
Create a futuristic fintech achievement badge called “Variance Analyst”.

ICON:
A stylized variance waveform with analytical overlays, correction vectors, and stabilized trajectory indicators.

MOOD:
Analytical, adaptive, intelligent, responsive.

STYLE:
Premium sci-fi achievement medal, dark metallic hexagonal frame, cyan analytical glow lines, restrained tactical UI geometry.
9. ENTREPRENEUR

"Real numbers on a real hustle."

Visual Identity
modular business grid
income/expense duality
logistics structure
operational flow
Symbol Concept

Running a system, not just earning money.

Badge Prompt
Create a futuristic fintech achievement badge called “Entrepreneur”.

ICON:
An interconnected operational grid combining income nodes, expense pathways, and logistics structure into a unified business system symbol.

MOOD:
Industrial, ambitious, operational, self-directed.

STYLE:
Ingress-style futuristic medal, metallic hexagonal achievement icon, geometric systems design, subtle emissive energy accents, premium tactical aesthetic.
10. NOVA AGENT

"You're not just using an app. You're building a practice."

Visual Identity

This is the MASTER badge.

Should feel:

elite
rare
system-wide mastery
symbolic identity
Symbol Concept

The NOVA core identity sigil.

Badge Prompt
Create a futuristic fintech mastery achievement badge called “NOVA Agent”.

ICON:
An elite central NOVA sigil combining geometric star-map alignment, energy synchronization rings, and a unified operational core representing complete financial system mastery.

MOOD:
Legendary, prestigious, intelligent, elite.

STYLE:
Ingress-inspired master achievement medal, premium black-metal hexagon, emissive cyan and violet energy accents, tactical sci-fi interface aesthetic, restrained but iconic geometry.
RECOMMENDED DEVELOPMENT PIPELINE
Step 1

Generate:

shared hex frame
dormant state
tier material system

ONCE.

Step 2

Generate:

only the 10 center icons

as vector assets.

Step 3

Programmatically apply:

tier colors
glows
emissive intensity
material swaps

instead of regenerating every badge.

FINAL UI NOTES
Best Badge Size

Recommended:

72px grid
128px detail modal
SVG-first
Best Tech Stack
SVG icons
CSS/React Native tint layers
shader/glow overlays
reusable material tokens
Token Optimization

The key savings:

1 frame system
1 dormant shell
10 icons
5 palette/material presets

instead of:

50 fully unique generations

That reduces generation complexity by roughly 80–90% while keeping the prestige feel extremely high.

Your uploaded gamification architecture already strongly supports this structure.

DESIGN AND IMPLEMENT THE BADGE IDS INTO THE APPLICATION DIRECTLY. 