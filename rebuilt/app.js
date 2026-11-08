let ITEMS = [], ENCH = [], state = {
  items: [],
  next: 0,
  settings: { java_edition: false, allow_multiple_armor_enhancements: false }
};
const $ = id => document.getElementById(id);
const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X" };
const rn = n => ROMAN[n] || ("" + n);
const dName = n => (ITEMS.find(i => i.name === n) || {}).display_name || n;
const eName = n => (ENCH.find(e => e.name === n) || {}).display_name || n;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function icon(name, sz) {
  const spec = ITEMS.find(i => i.name === name) || {};
  const file = spec.image || (name + ".png");
  const size = sz || 28;
  return `<img src="item_images/${escapeHtml(file)}" alt="${escapeHtml(dName(name))}" width="${size}" height="${size}" style="image-rendering:pixelated;vertical-align:middle" onerror="this.style.display='none'">`;
}

async function load() {
  try {
    const [itemsResponse, enchResponse] = await Promise.all([
      fetch("data/items.json"),
      fetch("data/enchantments.json")
    ]);
    if (!itemsResponse.ok || !enchResponse.ok) throw new Error("Could not load item data.");
    ITEMS = await itemsResponse.json();
    ENCH = await enchResponse.json();
    makeCombo("addItemWrap", addItemChoices(), value => { addItemVal = value; });
    makeCombo("presetWrap", PRESETS.map(p => ({ value: p[0], label: p[1] })), value => { presetVal = value; });

    const sharedItems = new URLSearchParams(location.search).get("items");
    if (sharedItems) {
      try {
        const parsed = JSON.parse(sharedItems);
        if (Array.isArray(parsed)) {
          state.items = parsed.filter(item => item && typeof item.name === "string").map((item, index) => ({
            name: item.name,
            penalty: Math.max(0, Number(item.penalty) || 0),
            index: Number.isFinite(Number(item.index)) ? Number(item.index) : index,
            enchantments: Array.isArray(item.enchantments) ? item.enchantments : []
          }));
          state.next = state.items.reduce((next, item) => Math.max(next, item.index + 1), 0);
        }
      } catch (error) {
        // Ignore an invalid shared setup and let the user start fresh.
      }
    }
    $("java").checked = state.settings.java_edition;
    $("multi").checked = state.settings.allow_multiple_armor_enhancements;
    render();
  } catch (error) {
    $("status").textContent = "Item data could not be loaded. Please refresh and try again.";
    $("items").innerHTML = `<div class="empty"><div><strong>Could not load the item list</strong><p>Check your connection, then refresh the calculator.</p></div></div>`;
  }
}

let addItemVal = "", presetVal = "";

// Searchable picker shared by the item, preset, and enchantment fields.
function makeCombo(wrapId, choices, onPick) {
  const wrap = $(wrapId);
  if (!wrap) return;
  wrap.innerHTML = `<input class="combo-in" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"><div class="combo-list" role="listbox"></div>`;
  const input = wrap.querySelector("input");
  const list = wrap.querySelector(".combo-list");
  const placeholder = wrapId === "addItemWrap" ? "Search items…" : wrapId === "presetWrap" ? "Find a preset…" : "Search compatible enchantments…";
  input.id = wrapId === "addItemWrap" ? "addItemSearch" : wrapId === "presetWrap" ? "presetSearch" : `${wrapId}Search`;
  list.id = `${input.id}List`;
  input.setAttribute("aria-controls", list.id);
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder.replace(/[.…]+$/, ""));
  let selected = -1;

  function draw(filter) {
    const needle = String(filter || "").trim().toLocaleLowerCase();
    const hits = choices.filter(choice => choice.label.toLocaleLowerCase().includes(needle)).slice(0, 15);
    list.replaceChildren();
    if (!hits.length) {
      const empty = document.createElement("div");
      empty.className = "combo-hit dim";
      empty.textContent = choices.length ? "No matching options" : "No compatible enchantments left";
      list.appendChild(empty);
    } else {
      hits.forEach(choice => {
        const hit = document.createElement("div");
        hit.className = "combo-hit";
        hit.setAttribute("role", "option");
        hit.dataset.value = choice.value;
        if (choice.icon) hit.insertAdjacentHTML("afterbegin", choice.icon);
        const label = document.createElement("span");
        label.textContent = choice.label;
        hit.appendChild(label);
        list.appendChild(hit);
      });
    }
    selected = -1;
    list.style.display = "block";
    input.setAttribute("aria-expanded", "true");
  }

  function close() {
    list.style.display = "none";
    input.setAttribute("aria-expanded", "false");
  }

  function choose(hit) {
    if (!hit || !hit.dataset.value) return;
    const value = hit.dataset.value;
    const choice = choices.find(option => String(option.value) === value);
    input.value = choice ? choice.label : hit.textContent.trim();
    close();
    onPick(value);
  }

  input.addEventListener("focus", () => draw(input.value));
  input.addEventListener("input", () => {
    onPick("");
    draw(input.value);
  });
  input.addEventListener("keydown", event => {
    const hits = [...list.querySelectorAll(".combo-hit[data-value]")];
    if (event.key === "ArrowDown" && list.style.display === "block") {
      event.preventDefault();
      selected = Math.min(selected + 1, hits.length - 1);
    } else if (event.key === "ArrowUp" && list.style.display === "block") {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
    } else if (event.key === "Enter" && list.style.display === "block") {
      event.preventDefault();
      choose(hits[selected] || hits[0]);
      return;
    } else if (event.key === "Escape") {
      close();
      return;
    } else {
      return;
    }
    hits.forEach((hit, index) => hit.classList.toggle("active", index === selected));
    if (hits[selected]) hits[selected].scrollIntoView({ block: "nearest" });
  });
  list.addEventListener("mousedown", event => event.preventDefault());
  list.addEventListener("click", event => {
    const hit = event.target.closest(".combo-hit[data-value]");
    if (hit) choose(hit);
  });
  input.addEventListener("blur", () => setTimeout(close, 120));

  wrap._refresh = () => {
    if (wrapId === "addItemWrap") {
      const current = state.items.find(item => item.name !== "book");
      choices = ITEMS.filter(item => !current || item.name === current.name || item.name === "book")
        .map(item => ({ value: item.name, label: item.display_name, icon: icon(item.name, 20) }));
    }
  };
  wrap._clear = () => { input.value = ""; onPick(""); };
  wrap._refresh();
}

function addItemChoices() {
  return ITEMS.map(item => ({ value: item.name, label: item.display_name, icon: icon(item.name, 20) }));
}

const PRESETS = [
  ["clear", "Clear setup"], ["helmet", "Helmet"], ["chestplate", "Chestplate"],
  ["leggings", "Leggings"], ["boots", "Boots"],
  ["sword_sharpness", "Sword · Sharpness"], ["axe_sharpness", "Axe · Sharpness"],
  ["mace_breach", "Mace · Breach"], ["spear", "Spear"], ["bow", "Bow"],
  ["crossbow_multishot", "Crossbow · Multishot"], ["crossbow_piercing", "Crossbow · Piercing"],
  ["trident_channeling", "Trident · Channeling"], ["trident_riptide", "Trident · Riptide"],
  ["pickaxe_fortune", "Pickaxe · Fortune"], ["pickaxe_silk_touch", "Pickaxe · Silk Touch"],
  ["shovel_fortune", "Shovel · Fortune"], ["shovel_silk_touch", "Shovel · Silk Touch"],
  ["hoe_fortune", "Hoe · Fortune"], ["hoe_silk_touch", "Hoe · Silk Touch"],
  ["brush", "Brush"], ["elytra", "Elytra"]
];

function effSpec(e) {
  if (state.settings.java_edition && e.java_overrides) return { ...e, ...e.java_overrides };
  return e;
}

async function setPreset() {
  const value = presetVal;
  if (!value) return;
  if (value === "clear") {
    state.items = [];
    state.next = 0;
    render();
    return;
  }
  try {
    const response = await fetch(`data/${encodeURIComponent(value)}_preset.json`);
    if (!response.ok) throw new Error("Preset not found");
    const data = await response.json();
    state.items = data.map((item, index) => ({ name: item.name, penalty: item.penalty || 0, index, enchantments: item.enchantments || [] }));
    state.next = state.items.length;
    render();
  } catch (error) {
    $("status").textContent = "That preset could not be loaded. Please try another one.";
  }
}

function addItem() {
  if (!addItemVal) return;
  state.items.push({ name: addItemVal, enchantments: [], index: state.next++, penalty: 0 });
  addItemVal = "";
  const wrap = $("addItemWrap");
  if (wrap && wrap._clear) wrap._clear();
  render();
}

function quickAdd(name) {
  const current = state.items.find(item => item.name !== "book");
  if (current && name !== current.name && name !== "book") return;
  state.items.push({ name, enchantments: [], index: state.next++, penalty: 0 });
  render();
}

function delItem(index) {
  state.items = state.items.filter(item => item.index !== index);
  render();
}

function compatList(item) {
  return ENCH.map(effSpec).filter(enchantment =>
    !item.enchantments.some(existing => existing.name === enchantment.name) &&
    compatible(withSpecs(item, ENCH), enchantment, state.settings) &&
    (state.settings.java_edition || !enchantment.java_only)
  );
}

function addEnch(index, value) {
  if (!value) return;
  const item = state.items.find(entry => entry.index === index);
  const spec = ENCH.find(enchantment => enchantment.name === value);
  if (!item || !spec) return;
  item.enchantments.push({ name: value, level: spec.base_max_level ?? spec.max_level });
  render();
}

function delEnch(index, name) {
  const item = state.items.find(entry => entry.index === index);
  if (!item) return;
  item.enchantments = item.enchantments.filter(enchantment => enchantment.name !== name);
  render();
}

function chLvl(index, name, value) {
  const item = state.items.find(entry => entry.index === index);
  const enchantment = item && item.enchantments.find(entry => entry.name === name);
  if (!enchantment) return;
  enchantment.level = Math.max(1, +value || 1);
  run();
}

function chPen(index, value) {
  const item = state.items.find(entry => entry.index === index);
  if (!item) return;
  item.penalty = Math.max(0, +value || 0);
  run();
}

function fmtItem(item) {
  if (!item) return "?";
  const enchantments = (item.enchantments || []).map(enchantment => `${escapeHtml(eName(enchantment.name))} ${rn(enchantment.level)}`).join(", ");
  return `${icon(item.name, 22)} ${escapeHtml(dName(item.name))}${enchantments ? " — " + enchantments : ""}`;
}

function render() {
  document.querySelectorAll("#addItemWrap,#presetWrap").forEach(wrap => wrap._refresh && wrap._refresh());
  const current = state.items.find(item => item.name !== "book");
  const grid = $("quickGrid");
  grid.replaceChildren();
  ITEMS.filter(item => !current || item.name === current.name || item.name === "book").forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qit";
    button.title = `Add ${item.display_name}`;
    button.setAttribute("aria-label", `Add ${item.display_name}`);
    button.innerHTML = icon(item.name, 30);
    const label = document.createElement("span");
    label.textContent = item.display_name;
    button.appendChild(label);
    button.addEventListener("click", () => quickAdd(item.name));
    grid.appendChild(button);
  });

  const box = $("items");
  box.replaceChildren();
  if (!state.items.length) {
    box.innerHTML = `<div class="empty"><div><div class="empty-icon" aria-hidden="true">⚒</div><strong>Your anvil is ready</strong><p>Search for gear above, pick a preset, or tap a quick-add icon to get started.</p></div></div>`;
  }

  state.items.forEach(item => {
    const card = document.createElement("article");
    card.className = "item";
    const options = compatList(item);
    card.innerHTML = `<div class="item-h">${icon(item.name, 34)}<strong class="item-title">${escapeHtml(dName(item.name))}</strong><span class="pill">Prior work ${item.penalty || 0}</span><button class="icon-button remove-item" type="button" aria-label="Remove ${escapeHtml(dName(item.name))}" title="Remove item">×</button></div><label class="prior-row">Prior work penalty <input class="penalty-input" type="number" min="0" step="1" value="${Math.max(0, Number(item.penalty) || 0)}" aria-label="Prior work penalty for ${escapeHtml(dName(item.name))}"></label><div class="combo-wrap-inline" id="ce${item.index}"></div><div class="enchantments"></div>`;
    card.querySelector(".remove-item").addEventListener("click", () => delItem(item.index));
    card.querySelector(".penalty-input").addEventListener("change", event => chPen(item.index, event.target.value));

    const enchantments = card.querySelector(".enchantments");
    item.enchantments.forEach(enchantment => {
      const row = document.createElement("div");
      row.className = "ench";
      row.innerHTML = `<span class="ench-name">${escapeHtml(eName(enchantment.name))}<small>${rn(enchantment.level)}</small></span><input type="number" min="1" step="1" value="${Math.max(1, Number(enchantment.level) || 1)}" aria-label="${escapeHtml(eName(enchantment.name))} level"><button class="icon-button" type="button" aria-label="Remove ${escapeHtml(eName(enchantment.name))}" title="Remove enchantment">×</button>`;
      row.querySelector("input").addEventListener("change", event => chLvl(item.index, enchantment.name, event.target.value));
      row.querySelector("button").addEventListener("click", () => delEnch(item.index, enchantment.name));
      enchantments.appendChild(row);
    });
    box.appendChild(card);
    makeCombo(`ce${item.index}`, options.map(enchantment => ({ value: enchantment.name, label: enchantment.display_name })), value => addEnch(item.index, value));
  });
  run();
}

let timer = null;
function run() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const url = new URL(location.href);
    if (state.items.length) url.searchParams.set("items", JSON.stringify(state.items));
    else url.searchParams.delete("items");
    history.replaceState(null, "", url);

    if (!state.items.length) {
      $("kCost").textContent = "—";
      $("kXp").textContent = "—";
      $("kSteps").textContent = "—";
      $("steps").innerHTML = `<tr class="steps-empty"><td colspan="4">Add gear or an enchanted book to see your anvil order.</td></tr>`;
      $("status").textContent = "";
      return;
    }

    $("status").textContent = "Calculating the lowest-cost order…";
    setTimeout(() => {
      const result = combineItems(JSON.parse(JSON.stringify(state.items)), state.settings, ENCH);
      if (result.error) {
        $("status").textContent = state.items.length < 2
          ? "Add a second item or an enchanted book to plan an anvil combination."
          : result.status;
        $("kCost").textContent = "—";
        $("kXp").textContent = "—";
        $("kSteps").textContent = "—";
        $("steps").innerHTML = `<tr class="steps-empty"><td colspan="4">No valid combination found. Check compatibility and try another setup.</td></tr>`;
        return;
      }
      $("status").textContent = "";
      $("kCost").textContent = result.cost;
      const xp = result.steps.reduce((total, step) => total + levelToXP(step.stepCost), 0);
      $("kXp").textContent = Math.round(xp).toLocaleString();
      $("kSteps").textContent = result.steps.length;
      $("steps").innerHTML = result.steps.map((step, index) =>
        `<tr><td class="step-n">${index + 1}</td><td>${fmtItem(step.targetItem)}</td><td>+ ${fmtItem(step.sacrificeItem)}</td><td><b>${step.stepCost}</b><br><small>${Math.round(levelToXP(step.stepCost)).toLocaleString()} XP</small></td></tr>`
      ).join("");
    }, 30);
  }, 120);
}

load();
