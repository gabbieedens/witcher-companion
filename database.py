import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "gamer_guide.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                level INTEGER DEFAULT 0,
                max_level INTEGER DEFAULT 5,
                equipped BOOLEAN DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS quests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL DEFAULT 'Side Quest',
                status TEXT NOT NULL DEFAULT 'undiscovered',
                notes TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS gear (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slot TEXT NOT NULL UNIQUE,
                item_name TEXT DEFAULT '',
                school_set TEXT DEFAULT '',
                tier TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS profile (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        _seed_defaults(conn)


def _seed_defaults(conn):
    from witcher_data import SKILL_TREES, MAIN_QUESTS, SIDE_QUESTS, CONTRACTS, GEAR_SLOTS

    for category, skills in SKILL_TREES.items():
        for skill in skills:
            conn.execute(
                "INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)",
                (skill, category)
            )

    for quest in MAIN_QUESTS:
        conn.execute(
            "INSERT OR IGNORE INTO quests (name, category) VALUES (?, ?)",
            (quest, "Main Quest")
        )
    for quest in SIDE_QUESTS:
        conn.execute(
            "INSERT OR IGNORE INTO quests (name, category) VALUES (?, ?)",
            (quest, "Side Quest")
        )
    for quest in CONTRACTS:
        conn.execute(
            "INSERT OR IGNORE INTO quests (name, category) VALUES (?, ?)",
            (quest, "Contract")
        )

    for slot in GEAR_SLOTS:
        conn.execute(
            "INSERT OR IGNORE INTO gear (slot) VALUES (?)",
            (slot,)
        )

    conn.execute(
        "INSERT OR IGNORE INTO profile (key, value) VALUES ('character_level', '1')"
    )
    conn.execute(
        "INSERT OR IGNORE INTO profile (key, value) VALUES ('playstyle', '')"
    )


# --- Skills ---

def get_skills():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM skills ORDER BY category, name").fetchall()
        return [dict(r) for r in rows]


def update_skill(name, level=None, equipped=None):
    with get_db() as conn:
        if level is not None:
            conn.execute("UPDATE skills SET level=? WHERE name=?", (level, name))
        if equipped is not None:
            conn.execute("UPDATE skills SET equipped=? WHERE name=?", (equipped, name))


# --- Quests ---

def get_quests():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM quests ORDER BY CASE category "
            "WHEN 'Main Quest' THEN 1 WHEN 'Side Quest' THEN 2 ELSE 3 END, name"
        ).fetchall()
        return [dict(r) for r in rows]


def update_quest(name, status=None, notes=None):
    with get_db() as conn:
        if status is not None:
            conn.execute("UPDATE quests SET status=? WHERE name=?", (status, name))
        if notes is not None:
            conn.execute("UPDATE quests SET notes=? WHERE name=?", (notes, name))


# --- Gear ---

def get_gear():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM gear ORDER BY slot").fetchall()
        return [dict(r) for r in rows]


def update_gear(slot, item_name=None, school_set=None, tier=None):
    with get_db() as conn:
        if item_name is not None:
            conn.execute("UPDATE gear SET item_name=? WHERE slot=?", (item_name, slot))
        if school_set is not None:
            conn.execute("UPDATE gear SET school_set=? WHERE slot=?", (school_set, slot))
        if tier is not None:
            conn.execute("UPDATE gear SET tier=? WHERE slot=?", (tier, slot))


# --- Chat ---

def save_message(role, content):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO chat_history (role, content) VALUES (?, ?)",
            (role, content)
        )


def get_chat_history(limit=20):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM chat_history ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in reversed(rows)]


# --- Profile ---

def get_profile():
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM profile").fetchall()
        return {r["key"]: r["value"] for r in rows}


def update_profile(key, value):
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO profile (key, value) VALUES (?, ?)",
            (key, str(value))
        )


def get_dashboard_state():
    skills = get_skills()
    quests = get_quests()
    gear = get_gear()
    profile = get_profile()

    active_quests = [q for q in quests if q["status"] == "active"]
    completed_quests = [q for q in quests if q["status"] == "completed"]
    equipped_skills = [s for s in skills if s["equipped"]]

    return {
        "profile": profile,
        "active_quests": active_quests,
        "completed_quests_count": len(completed_quests),
        "equipped_skills": equipped_skills,
        "gear": gear,
        "all_quests": quests,
        "all_skills": skills,
    }
