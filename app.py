import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import database as db
import ai_service as ai

load_dotenv()

app = Flask(__name__)


@app.route("/")
def index():
    db.init_db()
    state = db.get_dashboard_state()
    return render_template("index.html", state=state)


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    db.save_message("user", user_message)
    history = db.get_chat_history(limit=20)
    state = db.get_dashboard_state()

    response_text = ai.chat(user_message, history[:-1], state)
    db.save_message("assistant", response_text)

    updates = ai.extract_state_updates(user_message)
    _apply_updates(updates)

    return jsonify({
        "response": response_text,
        "updates": updates,
        "dashboard": db.get_dashboard_state(),
    })


@app.route("/api/dashboard")
def dashboard():
    return jsonify(db.get_dashboard_state())


@app.route("/api/quest", methods=["POST"])
def update_quest():
    data = request.get_json()
    db.update_quest(data["name"], status=data.get("status"), notes=data.get("notes"))
    return jsonify({"ok": True})


@app.route("/api/skill", methods=["POST"])
def update_skill():
    data = request.get_json()
    db.update_skill(data["name"], level=data.get("level"), equipped=data.get("equipped"))
    return jsonify({"ok": True})


@app.route("/api/gear", methods=["POST"])
def update_gear():
    data = request.get_json()
    db.update_gear(
        data["slot"],
        item_name=data.get("item_name"),
        school_set=data.get("school_set"),
        tier=data.get("tier"),
    )
    return jsonify({"ok": True})


@app.route("/api/profile", methods=["POST"])
def update_profile():
    data = request.get_json()
    for key, value in data.items():
        db.update_profile(key, value)
    return jsonify({"ok": True})


@app.route("/api/chat/history")
def chat_history():
    return jsonify(db.get_chat_history(limit=50))


@app.route("/api/bestiary")
def bestiary():
    from witcher_data import BESTIARY
    return jsonify(BESTIARY)


@app.route("/api/build-templates")
def build_templates():
    from witcher_data import BUILD_TEMPLATES
    return jsonify(BUILD_TEMPLATES)


@app.route("/api/load-template", methods=["POST"])
def load_template():
    data = request.get_json()
    from witcher_data import BUILD_TEMPLATES
    template = next((t for t in BUILD_TEMPLATES if t["id"] == data.get("id")), None)
    if not template:
        return jsonify({"error": "Template not found"}), 404

    with db.get_db() as conn:
        conn.execute("UPDATE skills SET level=0, equipped=0")

    for skill in template["skills"]:
        db.update_skill(skill["name"], level=skill["level"], equipped=skill["equipped"])

    db.update_profile("playstyle", template["playstyle"])
    return jsonify({"ok": True, "dashboard": db.get_dashboard_state()})


@app.route("/api/skills-with-descriptions")
def skills_with_descriptions():
    from witcher_data import SKILL_DESCRIPTIONS
    skills = db.get_skills()
    for s in skills:
        s["description"] = SKILL_DESCRIPTIONS.get(s["name"], "")
    return jsonify(skills)


def _apply_updates(updates):
    if not updates:
        return

    for q in updates.get("quest_updates", []):
        db.update_quest(q["name"], status=q.get("status"))

    for s in updates.get("skill_updates", []):
        db.update_skill(
            s["name"],
            level=s.get("level"),
            equipped=s.get("equipped"),
        )

    for g in updates.get("gear_updates", []):
        db.update_gear(
            g["slot"],
            item_name=g.get("item_name"),
            school_set=g.get("school_set"),
        )

    if updates.get("character_level"):
        db.update_profile("character_level", updates["character_level"])

    if updates.get("playstyle"):
        db.update_profile("playstyle", updates["playstyle"])


if __name__ == "__main__":
    db.init_db()
    app.run(debug=True, port=5050)
