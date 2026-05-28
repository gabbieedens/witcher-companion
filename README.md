# Witcher's Companion

An AI-powered dashboard for The Witcher 3: Wild Hunt. Track your build, quests, and gear — and chat with an AI guide that knows the game inside and out.

![Python](https://img.shields.io/badge/Python-3.10+-blue) ![Flask](https://img.shields.io/badge/Flask-3.0-lightgrey) ![Claude](https://img.shields.io/badge/AI-Claude%20Sonnet-orange)

---

## Features

### Geralt Figure
A layered SVG character in the center of the dashboard that updates visually as you equip gear. Each Witcher school has its own armor color scheme — Griffin (blue plate), Cat (dark leather), Bear (heavy brown), Wolf (silver), Manticore (purple), Viper (green).

### Chat Guide — Vesemir
Ask anything about The Witcher 3. Builds, quest walkthroughs, monster weaknesses, gear locations, decision consequences. The AI speaks as Vesemir and automatically updates your quest log and build tracker based on what you tell it.

### Quest Log
Track active quests across Main Quests, Side Quests, and Contracts. Autocomplete searches all 80+ quests in the game. Mark complete with one click.

### Build Tracker
See your equipped skills organized by tree (Combat / Signs / Alchemy / General) with star ratings. Gear slots show your current equipment and which school set you're working toward.

### Bestiary
30 monsters covering every category — Necrophage, Specter, Vampire, Draconid, Hybrid, Elementa, Relict, and more. Each entry shows the recommended Sign, oil, and bomb, plus a combat tactic. Searchable and filterable by category.

### Skills Browser
Browse all 64 skills across the four skill trees. Set levels (1–5), toggle equipped, and tap any skill for its description — all without leaving the page. Changes reflect on the dashboard live.

### Build Templates
Five ready-to-load preset builds:

| Template | School | Playstyle |
|---|---|---|
| Signs Master | Griffin | Max Sign intensity — Igni + Quen |
| Feline Assassin | Cat | Fast attack + bleed |
| Iron Bear | Bear | Tank, strong attack, Rend |
| Alchemist | Manticore | Decoction stacking |
| Wolf Pack | Wolf | Balanced adrenaline build |

Loading a template applies all 12 skills instantly and updates the Geralt figure to match the school.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/gabbieedens/witcher-companion.git
cd witcher-companion
```

### 2. Install dependencies

```bash
python3 -m pip install -r requirements.txt
```

### 3. Get an Anthropic API key

Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key. The API is billed pay-as-you-go — a typical session costs a few cents.

### 4. Add your API key

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your_key_here
```

### 5. Run

```bash
python3 app.py
```

Open **http://localhost:5050** in your browser.

---

## How the AI Works

Every chat message makes two Claude API calls:

1. **Main response** — Vesemir answers your question with full Witcher 3 knowledge and context about your current build and active quests.
2. **State extraction** — A lightweight background call parses your message for any build or quest updates and writes them to your local database. The dashboard refreshes automatically.

Example: saying *"I just finished Bloody Baron and I'm running a Signs build with Griffin armor"* will answer your question, mark Bloody Baron as completed in your quest log, and update your build tracker — all from one message.

---

## Tech Stack

- **Backend:** Python / Flask
- **Database:** SQLite (local, auto-created on first run)
- **AI:** Anthropic Claude API (`claude-sonnet-4-6` for chat, `claude-haiku-4-5` for state extraction)
- **Frontend:** Vanilla HTML / CSS / JavaScript — no framework
- **Character figure:** Inline SVG with CSS school color themes

---

## Project Structure

```
witcher-companion/
├── app.py              # Flask routes
├── database.py         # SQLite setup and queries
├── ai_service.py       # Claude API — chat + state extraction
├── witcher_data.py     # Game data: skills, quests, bestiary, build templates
├── templates/
│   └── index.html      # Dashboard UI
├── static/
│   ├── style.css       # Dark Witcher-themed styles + school color themes
│   └── app.js          # Frontend logic
└── requirements.txt
```

---

## Future Ideas

- Support for additional games
- Monster tracker (mark as defeated)
- Potion / decoction inventory
- Screenshot or clipboard parsing to auto-detect gear
- Multi-user support with login

---

*Built with Python, Flask, and the Anthropic Claude API.*
