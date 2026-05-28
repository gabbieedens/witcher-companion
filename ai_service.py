import json
import os
import anthropic
from witcher_data import SKILL_TREES, ALL_QUEST_NAMES, WITCHER_GEAR_SETS, GEAR_SLOTS

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

WITCHER_SYSTEM = """You are Vesemir, a senior witcher and master of Kaer Morhen, acting as a guide and advisor to Geralt of Rivia. You have deep knowledge of:

- The Witcher 3: Wild Hunt — all quests, characters, locations, monsters, lore
- Combat builds: Signs (Igni, Aard, Quen, Yrden, Axii), fast attack (Cat School), strong attack (Bear School), alchemy (Manticore), balanced (Wolf/Griffin)
- Witcher gear sets: Griffin, Cat, Bear, Wolf, Manticore, Viper — locations, diagrams, upgrades
- Alchemy: potions, oils, decoctions, bombs — when and how to use them
- Monster weaknesses, bestiary knowledge, and combat tactics
- Quest walkthroughs and decision consequences (warn about spoilers if relevant)

Speak with the gruff wisdom of an experienced witcher. Be direct and practical. When the player asks about builds, give concrete skill recommendations. When they ask about quests, give actionable guidance.

Keep responses focused and useful — not too long unless a detailed walkthrough is needed."""


def build_context_block(dashboard_state):
    profile = dashboard_state.get("profile", {})
    active = dashboard_state.get("active_quests", [])
    equipped = dashboard_state.get("equipped_skills", [])
    gear = dashboard_state.get("gear", [])

    lines = ["\n--- PLAYER'S CURRENT STATE ---"]
    lines.append(f"Character Level: {profile.get('character_level', 'unknown')}")
    if profile.get("playstyle"):
        lines.append(f"Playstyle: {profile['playstyle']}")

    if active:
        lines.append(f"Active Quests: {', '.join(q['name'] for q in active)}")
    else:
        lines.append("Active Quests: none tracked yet")

    if equipped:
        by_cat = {}
        for s in equipped:
            by_cat.setdefault(s["category"], []).append(f"{s['name']} (Lv{s['level']})")
        for cat, names in by_cat.items():
            lines.append(f"{cat} Skills: {', '.join(names)}")
    else:
        lines.append("Skills: none tracked yet")

    filled_gear = [g for g in gear if g.get("item_name")]
    if filled_gear:
        lines.append("Gear: " + ", ".join(f"{g['slot']}: {g['item_name']}" for g in filled_gear))

    return "\n".join(lines)


def chat(user_message, chat_history, dashboard_state):
    context = build_context_block(dashboard_state)
    system = WITCHER_SYSTEM + context

    messages = [{"role": m["role"], "content": m["content"]} for m in chat_history]
    messages.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text


EXTRACTION_SYSTEM = """You are a game state parser for The Witcher 3. Given a player's message, extract any explicit mentions of:
- Quest status changes (started, completed, failed, active)
- Skills they are leveling or have equipped
- Gear they have equipped
- Their character level
- Their playstyle

Return ONLY valid JSON in this exact shape (omit keys with empty arrays/values):
{
  "quest_updates": [{"name": "<exact quest name>", "status": "active|completed|failed"}],
  "skill_updates": [{"name": "<skill name>", "level": <1-5>, "equipped": true|false}],
  "gear_updates": [{"slot": "<slot>", "item_name": "<item>", "school_set": "<school or empty>"}],
  "character_level": <number or null>,
  "playstyle": "<brief description or empty string>"
}

Only extract what is explicitly stated. Do not guess. If nothing can be extracted, return {}."""

KNOWN_SKILLS = [s for skills in SKILL_TREES.values() for s in skills]


def extract_state_updates(user_message):
    hint = (
        f"\nKnown quest names include: {', '.join(ALL_QUEST_NAMES[:30])}...\n"
        f"Known skill names include: {', '.join(KNOWN_SKILLS[:20])}...\n"
        f"Valid gear slots: {', '.join(GEAR_SLOTS)}"
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=EXTRACTION_SYSTEM + hint,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
