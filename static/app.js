const ALL_QUESTS = [];

// Fetch full quest list for autocomplete and initialize character visual
fetch("/api/dashboard")
  .then(r => r.json())
  .then(data => {
    data.all_quests.forEach(q => ALL_QUESTS.push(q));
    updateCharacterVisual(data.gear);
  });

// --- Chat ---

function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  appendMessage("user", text);
  input.value = "";
  setLoading(true);

  const typing = appendTyping();

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  })
    .then(r => r.json())
    .then(data => {
      typing.remove();
      appendMessage("assistant", data.response);
      if (hasUpdates(data.updates)) {
        appendUpdateNotice(data.updates);
        refreshDashboard(data.dashboard);
      }
    })
    .catch(() => {
      typing.remove();
      appendMessage("assistant", "Hmph. Something went wrong on my end. Try again.");
    })
    .finally(() => setLoading(false));
}

function appendMessage(role, content) {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "assistant" ? "V" : "G";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = formatMessage(content);

  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendTyping() {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "chat-message assistant typing-indicator";
  div.innerHTML = `<div class="avatar">V</div><div class="bubble">...</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendUpdateNotice(updates) {
  const container = document.getElementById("chat-messages");
  const parts = [];
  if (updates.quest_updates?.length) {
    updates.quest_updates.forEach(q => parts.push(`Quest updated: ${q.name} → ${q.status}`));
  }
  if (updates.skill_updates?.length) {
    updates.skill_updates.forEach(s => parts.push(`Skill tracked: ${s.name}`));
  }
  if (updates.gear_updates?.length) {
    updates.gear_updates.forEach(g => parts.push(`Gear updated: ${g.slot} → ${g.item_name}`));
  }
  if (updates.character_level) parts.push(`Level updated: ${updates.character_level}`);

  if (parts.length === 0) return;

  const div = document.createElement("div");
  div.className = "update-notice";
  div.textContent = "↻ " + parts.join("  ·  ");
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function formatMessage(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

function hasUpdates(updates) {
  if (!updates) return false;
  return (
    (updates.quest_updates?.length > 0) ||
    (updates.skill_updates?.length > 0) ||
    (updates.gear_updates?.length > 0) ||
    updates.character_level ||
    updates.playstyle
  );
}

function setLoading(on) {
  document.getElementById("send-btn").disabled = on;
}

// Enter to send, Shift+Enter for newline
document.getElementById("chat-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// --- Dashboard refresh ---

// --- Geralt Figure ---

const SCHOOL_PIECE_COUNTS = {
  "Griffin School": 6, "Cat School": 6, "Bear School": 6,
  "Wolf School": 6, "Manticore School": 6, "Viper School": 6,
};

function detectDominantSchool(gear) {
  const counts = {};
  gear.forEach(g => {
    if (g.school_set && g.school_set.trim()) {
      const k = g.school_set.trim();
      counts[k] = (counts[k] || 0) + 1;
    }
  });
  let top = null, max = 0;
  for (const [school, n] of Object.entries(counts)) {
    if (n > max) { max = n; top = school; }
  }
  return { school: top, count: max };
}

function updateCharacterVisual(gear) {
  const fig = document.getElementById("geralt-figure");
  if (!fig) return;

  // Remove existing school class
  [...fig.classList].filter(c => c.startsWith("school-")).forEach(c => fig.classList.remove(c));

  const { school, count } = detectDominantSchool(gear);
  const label = document.getElementById("school-label-text");
  const pieceCount = document.getElementById("school-piece-count");
  const total = school ? (SCHOOL_PIECE_COUNTS[school] || 6) : 6;

  if (school) {
    // e.g. "Griffin School" → "school-griffin"
    const cls = "school-" + school.toLowerCase().split(" ")[0];
    fig.classList.add(cls);
    if (label) label.textContent = school.toUpperCase();
    if (pieceCount) pieceCount.textContent = `${count} / ${total}`;
  } else {
    fig.classList.add("school-none");
    if (label) label.textContent = "NO SET EQUIPPED";
    if (pieceCount) pieceCount.textContent = "0 / 6";
  }
}

function refreshDashboard(state) {
  // Active quests
  const questList = document.getElementById("active-quests-list");
  if (state.active_quests.length === 0) {
    questList.innerHTML = `<p class="empty-state">No active quests tracked yet. Ask the guide or add one below.</p>`;
  } else {
    questList.innerHTML = state.active_quests.map(q => `
      <div class="quest-item active" data-name="${escHtml(q.name)}">
        <span class="quest-category">${escHtml(q.category)}</span>
        <span class="quest-name">${escHtml(q.name)}</span>
        <button class="btn-complete" onclick="completeQuest('${escHtml(q.name)}')">✓</button>
      </div>
    `).join("");
  }

  document.getElementById("completed-count").textContent = state.completed_quests_count;

  // Skills
  const skillsEl = document.getElementById("equipped-skills");
  if (state.equipped_skills.length === 0) {
    skillsEl.innerHTML = `<p class="empty-state">No skills equipped. Ask the guide for build advice.</p>`;
  } else {
    skillsEl.innerHTML = state.equipped_skills.map(s => {
      const cat = s.category.toLowerCase().replace(/ /g, "-");
      const stars = "★".repeat(s.level) + "☆".repeat(5 - s.level);
      return `<div class="skill-chip ${cat}"><span>${escHtml(s.name)}</span><span class="skill-level">${stars}</span></div>`;
    }).join("");
  }

  // Gear
  const gearEl = document.getElementById("gear-slots");
  gearEl.innerHTML = state.gear.map(g => {
    const schoolClass = g.school_set ? `school-${g.school_set.toLowerCase().replace(/ /g, "-")}` : "";
    return `
      <div class="gear-row" data-slot="${escHtml(g.slot)}">
        <span class="gear-slot">${escHtml(g.slot)}</span>
        <span class="gear-item ${schoolClass}">${escHtml(g.item_name || "—")}</span>
        <button class="btn-small" onclick="openGearModal('${escHtml(g.slot)}', '${escHtml(g.item_name || "")}', '${escHtml(g.school_set || "")}')">Edit</button>
      </div>`;
  }).join("");

  // Level & playstyle
  document.getElementById("char-level").textContent = state.profile.character_level || "1";
  const pb = document.getElementById("playstyle-badge");
  pb.textContent = state.profile.playstyle || "No playstyle set";

  // Update Geralt figure armor
  updateCharacterVisual(state.gear);
}

// --- Quests ---

function completeQuest(name) {
  fetch("/api/quest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, status: "completed" }),
  }).then(() => {
    fetch("/api/dashboard").then(r => r.json()).then(refreshDashboard);
  });
}

function addQuest() {
  const input = document.getElementById("quest-search");
  const name = input.value.trim();
  if (!name) return;
  fetch("/api/quest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, status: "active" }),
  }).then(() => {
    input.value = "";
    document.getElementById("quest-suggestions").innerHTML = "";
    fetch("/api/dashboard").then(r => r.json()).then(refreshDashboard);
  });
}

// Quest autocomplete
document.getElementById("quest-search").addEventListener("input", function () {
  const val = this.value.toLowerCase().trim();
  const sug = document.getElementById("quest-suggestions");
  if (!val) { sug.innerHTML = ""; return; }

  const matches = ALL_QUESTS.filter(q => q.name.toLowerCase().includes(val)).slice(0, 8);
  sug.innerHTML = matches.map(q => `
    <div class="suggestion-item" onclick="selectQuest('${escHtml(q.name)}')">
      <span style="color:var(--text-dim);font-size:10px;">${q.category}</span> ${escHtml(q.name)}
    </div>
  `).join("");
});

function selectQuest(name) {
  document.getElementById("quest-search").value = name;
  document.getElementById("quest-suggestions").innerHTML = "";
}

// --- Modals ---

function openLevelModal() {
  document.getElementById("level-input").value = document.getElementById("char-level").textContent;
  document.getElementById("level-modal").classList.remove("hidden");
}

function saveLevel() {
  const level = document.getElementById("level-input").value;
  fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character_level: level }),
  }).then(() => {
    document.getElementById("char-level").textContent = level;
    closeModal("level-modal");
  });
}

let currentGearSlot = null;

function openGearModal(slot, item, school) {
  currentGearSlot = slot;
  document.getElementById("gear-modal-slot").textContent = slot;
  document.getElementById("gear-item-input").value = item;
  document.getElementById("gear-school-input").value = school;
  document.getElementById("gear-modal").classList.remove("hidden");
}

function saveGear() {
  const item = document.getElementById("gear-item-input").value.trim();
  const school = document.getElementById("gear-school-input").value.trim();
  fetch("/api/gear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot: currentGearSlot, item_name: item, school_set: school }),
  }).then(() => {
    closeModal("gear-modal");
    fetch("/api/dashboard").then(r => r.json()).then(refreshDashboard);
  });
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Close modal on backdrop click
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Tab switching ──────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-" + tab).classList.remove("hidden");
    if (tab === "bestiary" && !bestiaryLoaded) loadBestiary();
    if (tab === "skills") loadSkillsBrowser();
    if (tab === "builds" && !templatesLoaded) loadBuildTemplates();
  });
});

// ── Bestiary ──────────────────────────────────────────────────────────────

let bestiaryData = [];
let bestiaryLoaded = false;
let activeCategory = "All";

function loadBestiary() {
  fetch("/api/bestiary")
    .then(r => r.json())
    .then(data => {
      bestiaryData = data;
      bestiaryLoaded = true;
      buildBestiaryFilters();
      renderBestiary();
    });
}

function buildBestiaryFilters() {
  const cats = ["All", ...new Set(bestiaryData.map(m => m.category)).values()].sort();
  const row = document.getElementById("bestiary-filters");
  row.innerHTML = cats.map(c => `
    <button class="filter-btn ${c === "All" ? "active" : ""}" data-cat="${escHtml(c)}"
            onclick="filterBestiary('${escHtml(c)}')">${escHtml(c)}</button>
  `).join("");
}

function filterBestiary(cat) {
  activeCategory = cat;
  document.querySelectorAll(".filter-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.cat === cat);
  });
  renderBestiary();
}

function renderBestiary() {
  const search = (document.getElementById("bestiary-search").value || "").toLowerCase();
  const list = document.getElementById("bestiary-list");
  const filtered = bestiaryData.filter(m => {
    const catOk = activeCategory === "All" || m.category === activeCategory;
    const searchOk = !search || m.name.toLowerCase().includes(search) || m.category.toLowerCase().includes(search);
    return catOk && searchOk;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-state">No monsters found.</p>`;
    return;
  }

  list.innerHTML = filtered.map(m => `
    <div class="monster-card collapsed" onclick="toggleMonster(this)">
      <div class="monster-header">
        <span class="monster-name">${escHtml(m.name)}</span>
        <span class="monster-cat">${escHtml(m.category)}</span>
        <span class="monster-expand">▾</span>
      </div>
      <div class="monster-badges">
        <span class="badge badge-sign">⚡ ${escHtml(m.sign)}</span>
        <span class="badge badge-oil">⚗ ${escHtml(m.oil)}</span>
        <span class="badge badge-bomb">💥 ${escHtml(m.bombs)}</span>
      </div>
      <div class="monster-tactic">${escHtml(m.tactic)}</div>
    </div>
  `).join("");
}

function toggleMonster(card) {
  const collapsed = card.classList.toggle("collapsed");
  card.querySelector(".monster-expand").textContent = collapsed ? "▾" : "▴";
}

document.getElementById("bestiary-search").addEventListener("input", renderBestiary);

// ── Skills Browser ─────────────────────────────────────────────────────────

let allSkillsData = [];
let activeSkillCat = "Combat";
let expandedSkill = null;

function loadSkillsBrowser() {
  fetch("/api/skills-with-descriptions")
    .then(r => r.json())
    .then(data => {
      allSkillsData = data;
      renderSkillsBrowser();
    });
}

function setSkillCat(cat) {
  activeSkillCat = cat;
  document.querySelectorAll(".skill-cat-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.cat === cat);
  });
  expandedSkill = null;
  renderSkillsBrowser();
}

function renderSkillsBrowser() {
  const skills = allSkillsData.filter(s => s.category === activeSkillCat);
  const list = document.getElementById("skills-browser-list");
  if (!list) return;

  list.innerHTML = skills.map(s => {
    const stars = "★".repeat(s.level) + "☆".repeat(Math.max(0, 5 - s.level));
    const expanded = expandedSkill === s.name;
    return `
      <div class="skill-browser-item" onclick="toggleSkillDesc('${escHtml(s.name)}')">
        <span class="skill-browser-name">${escHtml(s.name)}</span>
        <span class="skill-browser-stars">${stars}</span>
        <div class="skill-level-ctrl" onclick="event.stopPropagation()">
          <button onclick="changeSkillLevel('${escHtml(s.name)}', ${s.level}, -1)">−</button>
          <span class="skill-level-num">${s.level}</span>
          <button onclick="changeSkillLevel('${escHtml(s.name)}', ${s.level}, 1)">+</button>
        </div>
        <button class="equip-toggle ${s.equipped ? 'equipped' : ''}"
                onclick="event.stopPropagation(); toggleEquipped('${escHtml(s.name)}', ${s.equipped})">
          ${s.equipped ? "Equipped" : "Equip"}
        </button>
      </div>
      ${expanded && s.description ? `<div class="skill-desc-row">${escHtml(s.description)}</div>` : ""}
    `;
  }).join("");
}

function toggleSkillDesc(name) {
  expandedSkill = expandedSkill === name ? null : name;
  renderSkillsBrowser();
}

function changeSkillLevel(name, current, delta) {
  const newLevel = Math.max(0, Math.min(5, current + delta));
  fetch("/api/skill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, level: newLevel }),
  }).then(() => {
    const skill = allSkillsData.find(s => s.name === name);
    if (skill) skill.level = newLevel;
    renderSkillsBrowser();
    fetch("/api/dashboard").then(r => r.json()).then(refreshDashboard);
  });
}

function toggleEquipped(name, currently) {
  const newEquipped = currently ? 0 : 1;
  fetch("/api/skill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, equipped: newEquipped }),
  }).then(() => {
    const skill = allSkillsData.find(s => s.name === name);
    if (skill) skill.equipped = newEquipped;
    renderSkillsBrowser();
    fetch("/api/dashboard").then(r => r.json()).then(refreshDashboard);
  });
}

document.querySelectorAll(".skill-cat-btn").forEach(btn => {
  btn.addEventListener("click", () => setSkillCat(btn.dataset.cat));
});

// ── Build Templates ─────────────────────────────────────────────────────────

let templatesLoaded = false;

function loadBuildTemplates() {
  fetch("/api/build-templates")
    .then(r => r.json())
    .then(data => {
      templatesLoaded = true;
      renderBuildTemplates(data);
    });
}

function renderBuildTemplates(templates) {
  const list = document.getElementById("build-templates-list");
  list.innerHTML = templates.map(t => {
    const skillTags = t.skills.map(s => {
      const cat = s.category.toLowerCase();
      return `<span class="template-skill-tag ${cat}">${escHtml(s.name)}</span>`;
    }).join("");

    const pros = (t.pros || []).map(p => `<li>${escHtml(p)}</li>`).join("");
    const cons = (t.cons || []).map(c => `<li>${escHtml(c)}</li>`).join("");

    return `
      <div class="template-card">
        <div class="template-header">
          <span class="template-name">${escHtml(t.name)}</span>
          <span class="template-school">${escHtml(t.school)}</span>
        </div>
        <div class="template-playstyle">${escHtml(t.playstyle)}</div>
        <div class="template-desc">${escHtml(t.description)}</div>
        <div class="template-pros-cons">
          <div class="template-pros"><ul>${pros}</ul></div>
          <div class="template-cons"><ul>${cons}</ul></div>
        </div>
        <div class="template-skills-preview">${skillTags}</div>
        <button class="btn-load-template" onclick="loadTemplate('${escHtml(t.id)}', '${escHtml(t.name)}')">
          Load "${escHtml(t.name)}"
        </button>
      </div>
    `;
  }).join("");
}

function loadTemplate(id, name) {
  if (!confirm(`Load the "${name}" build? This will overwrite your current skills.`)) return;
  fetch("/api/load-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        refreshDashboard(data.dashboard);
        allSkillsData = [];
        appendMessage("assistant", `Build loaded — "${name}" is now active. ${data.dashboard.profile.playstyle || ""}`);
      }
    });
}
