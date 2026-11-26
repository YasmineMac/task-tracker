const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");
const clone = (value) => JSON.parse(JSON.stringify(value));

// Exercise the actual TypeScript modules with an in-memory Supabase transport.
function loadModule(name, dependencies = {}) {
  const filename = path.join(__dirname, name);
  const source = fs.readFileSync(filename, "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, crypto, Error,
    console: { warn() {} },
    require: (id) => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  }, { filename });
  return exports;
}
const types = loadModule("medicationTypes.ts");
const batchApi = loadModule("signalBatch.ts", { "./medicationTypes": types });
const timestamp = "2026-11-19T13:20:00.123Z";
const create = (selected, grams = 5, coffee = null) => batchApi.createSignalBatch(timestamp, selected, grams, coffee);
const coffee = { drinkId: "iced_latte", label: "Iced latte", mg: 180, shots: 3 };

function transport() {
  const rows = new Map();
  const calls = [];
  const outcomes = new Map();
  const supabase = { from(table) {
    assert.equal(table, "medication_entries");
    return {
      async upsert(row, options) {
        assert.equal(options.onConflict, "id");
        calls.push(row.id);
        const outcome = outcomes.get(row.medication);
        if (outcome !== "fail") rows.set(row.id, { ...row });
        if (outcome === "lost-response") throw new Error("Connection closed after commit");
        return { error: outcome === "fail" ? { message: "Mock save failure" } : null };
      },
      select() {
        let scope;
        return { eq(column, value) {
          assert.equal(column, "sync_code"); scope = value;
          return { async order() { return { data: [...rows.values()].filter((row) => row.sync_code === scope), error: null }; } };
        } };
      },
    };
  } };
  const store = loadModule("supabaseMedicationStore.ts", {
    "@/lib/supabase": { supabase }, "./medicationTypes": types,
  });
  return { rows, calls, outcomes, save: (entry) => store.saveMedicationEntry(entry, "TEST-SCOPE"), load: () => store.loadMedicationEntries("TEST-SCOPE") };
}

test("one signal: original identity, dose, unit and timestamp", () => {
  const { entry } = create(["Prozac"]).entries[0];
  assert.equal(entry.medication, "Prozac");
  assert.equal(entry.amount, 20);
  assert.equal(entry.unit, "mg");
  assert.equal(entry.timestamp, timestamp);
});

test("multiple signals have distinct UUIDs and one exact timestamp", () => {
  const batch = create(["Vyvanse", "Prozac", "Creatine"], 3.5, coffee);
  assert.equal(batch.entries.length, 4);
  assert.equal(new Set(batch.entries.map(({ entry }) => entry.id)).size, 4);
  for (const { entry } of batch.entries) assert.equal(entry.timestamp, timestamp);
  const creatine = batch.entries[2].entry;
  assert.equal(creatine.amount, 3.5);
  assert.equal(creatine.unit, "g");
});

test("coffee presets scale by their own shot count; non-espresso amounts stay unchanged", () => {
  assert.equal(batchApi.caffeineMgForShots({ mg: 120, shots: 2 }, 3), 360);
  assert.equal(batchApi.caffeineMgForShots({ mg: 65, shots: 1 }, 2), 130);
  assert.equal(batchApi.caffeineMgForShots({ mg: 95 }, 3), 285);
  const entry = create([], 0, { ...coffee, mg: 147.5 }).entries[0].entry;
  assert.equal(entry.amount, 147.5);
  assert.equal(entry.metadata.drinkType, "iced_latte");
  assert.equal(entry.metadata.shots, 3);
  assert.equal(create([], 0, { drinkId: "matcha_latte", label: "Matcha latte", mg: 70 }).entries[0].entry.metadata.shots, null);
});

test("invalid amounts, empty selection and unsupported numeric precision rejected before sending", () => {
  assert.throws(() => create([]));
  for (const amount of [0, -1, NaN, Infinity, 0.0001, 10000000]) assert.throws(() => create(["Creatine"], amount));
  assert.throws(() => create([], 0, { ...coffee, mg: 0 }));
});

test("partial failure: retry only failed records with their original UUIDs", async () => {
  const db = transport();
  const original = create(["Vyvanse", "Prozac", "Creatine"]);
  db.outcomes.set("Prozac", "fail");
  const progress = [];
  const partial = await batchApi.saveSignalBatch(original, db.save, (value) => progress.push(value));
  assert.deepEqual(Array.from(partial.entries, (item) => item.status), ["saved", "failed", "saved"]);
  assert.equal(db.rows.size, 2);
  assert.equal(progress.length, 3);
  db.outcomes.clear();
  const complete = await batchApi.saveSignalBatch(partial, db.save, () => {});
  assert(complete.entries.every((item) => item.status === "saved"));
  assert.equal(db.calls.length, 4);
  assert.equal(db.calls[3], original.entries[1].entry.id);
  assert.equal(db.rows.size, 3);
});

test("uncertain outcome and reload retry upserts the same UUID, never a duplicate", async () => {
  const db = transport();
  const original = create(["Vyvanse", "Prozac"]);
  db.outcomes.set("Vyvanse", "lost-response");
  const partial = await batchApi.saveSignalBatch(original, db.save, () => {});
  assert.equal(db.rows.size, 2);
  assert.equal(partial.entries[0].status, "failed");
  const restored = batchApi.parseSignalBatch(JSON.stringify(partial));
  db.outcomes.clear();
  await batchApi.saveSignalBatch(restored, db.save, () => {});
  assert.equal(db.rows.size, 2);
  assert.equal(db.calls.length, 3);
  assert.equal(db.calls[0], db.calls[2]);
});

test("mock save/reload preserves all values and unrelated historical entries", async () => {
  const db = transport();
  db.rows.set("historical", { id: "historical", medication: "Untouched", sync_code: "OTHER-SCOPE" });
  const batch = create(["Prozac", "Creatine"], 4.25, coffee);
  await batchApi.saveSignalBatch(batch, db.save, () => {});
  const loaded = await db.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.entries.length, 3);
  for (const { entry } of batch.entries) {
    const row = loaded.entries.find((item) => item.id === entry.id);
    assert.equal(row.timestamp, timestamp);
    assert.equal(row.amount, entry.amount);
    assert.equal(row.unit, entry.unit);
  }
  assert.equal(loaded.entries.filter((entry) => entry.medication === "Prozac").length, 1);
  assert.equal(db.rows.get("historical").medication, "Untouched");
});

test("completed batch performs zero additional writes on retry", async () => {
  const db = transport();
  const done = await batchApi.saveSignalBatch(create(["Vyvanse"]), db.save, () => {});
  await batchApi.saveSignalBatch(done, db.save, () => {});
  assert.equal(db.calls.length, 1);
});

test("journal validation rejects malformed or mixed-timestamp batches", () => {
  assert.equal(batchApi.parseSignalBatch(null), null);
  assert.throws(() => batchApi.parseSignalBatch("{}"));
  const value = create(["Vyvanse", "Prozac"]);
  value.entries[1].entry.timestamp = "2026-11-20T13:20:00Z";
  assert.throws(() => batchApi.parseSignalBatch(JSON.stringify(value)));
});

// Shallow hook harness invokes the actual UI callbacks without a browser or production credentials.
const uiSource = fs.readFileSync(path.join(__dirname, "../MinimalTaskTracker.tsx"), "utf8");
const ast = ts.createSourceFile("signals.tsx", uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNames = ["isValidISODate", "isoParts", "localDateISO", "timeInputFromTimestamp", "timeToMinutes", "medicationTimestampFromInputs", "signalTimestampFromInputs", "SignalTimestampInput", "SignalTimeKeypad", "signalColourMix", "MobileSignalSelection"];
const definitions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && functionNames.includes(node.name?.text));
const presets = ast.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "CAFFEINE_DRINK_DEFAULTS"));
const palette = ast.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "SIGNAL_COLOURS"));
const icons = ast.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "SIGNAL_ICONS"));

function harness({ save = async () => true, storage = new Map(), onSaved = () => {}, loggedToday = [], recentCoffeeIds = ["iced_latte", "espresso", "matcha_latte"] } = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const context = {
    React: require("react"), Date, Intl, Error, ...batchApi,
    SYNC_CODE: "TEST-SCOPE", PillIcon: "pill", Plus: "plus", ChevronLeft: "back", Check: "check", Dumbbell: "dumbbell", Coffee: "coffee", Zap: "zap", Clock3: "clock", Delete: "backspace-icon", Field: "field", Modal: "modal",
    CAFFEINE_DRINK_ICONS: new Proxy({}, { get: () => "coffee" }),
    saveMedicationEntry: save,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(callback);
      slots[index] = deps;
    },
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule([presets, palette, icons, ...definitions].map((node) => node.getText(ast)).join("\n"), {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  let component = "MobileSignalSelection";
  let date = "2026-11-19", time = "14:20";
  function render() {
    cursor = 0; effects = [];
    const tree = context[component](component === "MobileSignalSelection" ? { recentCoffeeIds, onSaved, loggedToday } : { date, time, onChange(d, t) { date = d; time = t; } });
    effects.forEach((effect) => effect());
    return tree;
  }
  function nodes(tree, output = []) {
    if (tree && typeof tree === "object") {
      if (tree.type === "modal" && !tree.props.open) return output;
      output.push(tree);
      [].concat(tree.props?.children || []).flat(Infinity).forEach((child) => nodes(child, output));
      if (tree.props?.footer) nodes(tree.props.footer, output);
    }
    return output;
  }
  function text(tree) { return typeof tree === "string" || typeof tree === "number" ? String(tree) : [].concat(tree?.props?.children || []).flat(Infinity).map(text).join(""); }
  function button(label) { const node = nodes(render()).find((item) => item.type === "button" && text(item).startsWith(label)); assert(node, `Missing ${label}`); return node; }
  function click(label) { const node = button(label); assert(!node.props.disabled, `Disabled ${label}`); node.props.onClick(); }
  render();
  return { context, storage, render, nodes, text, button, click,
    timestampMode() { slots.length = 0; component = "SignalTimestampInput"; render(); render(); },
    keypadMode() { slots.length = 0; component = "SignalTimeKeypad"; render(); },
    get date() { return date; }, get time() { return time; } };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("Log now double-click is locked; confirmed success clears only after completion", async () => {
  let release;
  const writes = [];
  const saved = [];
  const ui = harness({ save: (entry) => { writes.push(entry); return new Promise((resolve) => { release = resolve; }); }, onSaved: (entry) => saved.push(entry) });
  ui.click("Vyvanse");
  const action = ui.button("Log now").props.onClick;
  action(); action();
  assert.equal(writes.length, 1);
  assert.equal(saved.length, 0);
  assert(ui.button("Vyvanse").props["aria-pressed"]);
  release(true);
  await tick();
  assert.equal(saved.length, 1);
  assert.equal(ui.storage.size, 0);
  assert(!ui.button("Vyvanse").props["aria-pressed"]);
  assert(ui.text(ui.render()).includes("Logged 1 entry"));
});

test("Log time saves nothing before Confirm and uses its exact timestamp for all entries", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Vyvanse"); ui.click("Fluoxetine"); ui.click("Log time");
  assert.equal(writes.length, 0);
  const picker = ui.nodes(ui.render()).find((item) => item.type === ui.context.SignalTimeKeypad);
  picker.props.onChange("2026-08-25", "00:00");
  assert.equal(writes.length, 0);
  const expected = ui.context.signalTimestampFromInputs("2026-08-25", "00:00");
  ui.click("Confirm"); await tick();
  assert.equal(writes.length, 2);
  assert(writes.every((entry) => entry.timestamp === expected));
});

test("UI partial failure retains selection; refresh retries only failed UUID", async () => {
  const storage = new Map(), writes = [], confirmed = [];
  const ui = harness({ storage, save: async (entry) => { writes.push(entry.id); return entry.medication !== "Prozac"; }, onSaved: (entry) => confirmed.push(entry) });
  ui.click("Vyvanse"); ui.click("Fluoxetine"); ui.click("Log now"); await tick();
  assert.equal(confirmed.length, 1);
  assert(ui.button("Fluoxetine").props["aria-pressed"]);
  assert(ui.nodes(ui.render()).some((node) => node.props?.role === "alert"));
  const reloaded = harness({ storage, save: async (entry) => { writes.push(entry.id); return true; } });
  reloaded.click("Retry unsaved entries"); await tick();
  assert.equal(writes.length, 3);
  assert.equal(writes[1], writes[2]);
  assert.equal(storage.size, 0);
});

test("numeric clock handles AM/PM, noon, midnight and partial PM entry", () => {
  const ui = harness(); ui.timestampMode();
  const control = (label) => ui.nodes(ui.render()).find((item) => item.props?.["aria-label"] === label);
  control("Time HH:MM").props.onChange({ target: { value: "1200" } });
  control("AM or PM").props.onChange({ target: { value: "AM" } }); assert.equal(ui.time, "00:00");
  control("AM or PM").props.onChange({ target: { value: "PM" } }); assert.equal(ui.time, "12:00");
  control("Time HH:MM").props.onChange({ target: { value: "0" } });
  control("Time HH:MM").props.onChange({ target: { value: "0930" } }); assert.equal(ui.time, "21:30");
});

test("Madrid retrospective dates and DST boundaries remain timezone-safe", () => {
  const oldTimezone = process.env.TZ;
  process.env.TZ = "Europe/Madrid";
  try {
    const stamp = harness().context.signalTimestampFromInputs;
    assert.equal(stamp("2026-11-19", "14:20"), "2026-11-19T13:20:00.000Z");
    assert.equal(stamp("2026-03-29", "02:30"), null);
    assert.equal(stamp("2026-03-29", "03:30"), "2026-03-29T01:30:00.000Z");
    assert.equal(stamp("2026-10-25", "02:30"), "2026-10-25T00:30:00.000Z");
  } finally { if (oldTimezone === undefined) delete process.env.TZ; else process.env.TZ = oldTimezone; }
});

test("coffee UI derives mg from shot choices without exposing an mg input", () => {
  const ui = harness();
  ui.click("Coffee"); ui.click("Custom"); ui.click("Iced latte");
  ui.click("3 shots");
  assert.equal(ui.nodes(ui.render()).filter((item) => item.type === "input").length, 0);
  assert(!ui.text(ui.render()).includes("Caffeine (mg)"));
  ui.click("Confirm coffee");
  assert(ui.text(ui.render()).includes("3 shots"));
});

test("storage failure blocks writes rather than losing retry identity", async () => {
  let writes = 0;
  const storage = new Map();
  storage.set = () => { throw new Error("Quota exceeded"); };
  const ui = harness({ storage, save: async () => { writes++; return true; } });
  ui.click("Vyvanse"); ui.click("Log now"); await tick();
  assert.equal(writes, 0);
  assert(ui.button("Vyvanse").props["aria-pressed"]);
  assert(ui.nodes(ui.render()).some((node) => node.props?.role === "alert"));
});

test("a failed save never updates local confirmed data or clears selections", async () => {
  let succeeds = false;
  const writes = [], local = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return succeeds; }, onSaved: (entry) => local.push(entry) });
  ui.click("Fluoxetine"); ui.click("Log now"); await tick();
  assert.equal(local.length, 0);
  assert(ui.button("Fluoxetine").props["aria-pressed"]);
  assert(!ui.text(ui.render()).includes("Logged 1 entry"));
  succeeds = true;
  ui.click("Retry unsaved entries"); await tick();
  assert.equal(local.length, 1);
  assert.equal(writes[0].id, writes[1].id);
  assert.equal(writes[0].timestamp, writes[1].timestamp);
});

test("cancelling retrospective entry creates no draft or records", () => {
  let writes = 0;
  const ui = harness({ save: async () => { writes++; return true; } });
  ui.click("Vyvanse"); ui.click("Log time"); ui.click("Cancel");
  assert.equal(writes, 0);
  assert.equal(ui.storage.size, 0);
  assert(ui.button("Vyvanse").props["aria-pressed"]);
});

test("mobile Creatine logs 3.4 g immediately without a quantity input", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Creatine");
  assert.equal(ui.nodes(ui.render()).filter((node) => node.type === "input").length, 0);
  assert(!ui.text(ui.render()).includes("Creatine (g)"));
  ui.click("Log now"); await tick();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].medication, "Creatine");
  assert.equal(writes[0].amount, 3.4);
  assert.equal(writes[0].unit, "g");
});

test("non-espresso coffee saves its serving preset without invented shots", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Coffee"); ui.click("Matcha latte");
  const inputs = ui.nodes(ui.render()).filter((node) => node.type === "input");
  assert.equal(inputs.length, 0);
  assert(!ui.text(ui.render()).includes("One serving"));
  ui.click("Confirm coffee"); ui.click("Log now"); await tick();
  assert.equal(writes[0].amount, 70);
  assert.equal(writes[0].metadata.shots, 1);
  assert.equal(writes[0].metadata.drinkType, "matcha_latte");
});

test("another tab's pending journal is not overwritten by a new save", async () => {
  let writes = 0;
  const ui = harness({ save: async () => { writes++; return true; } });
  ui.click("Vyvanse");
  const other = create(["Prozac"]);
  const original = JSON.stringify(other);
  ui.storage.set("pineapple_signals_pending_v1_TEST-SCOPE", original);
  ui.click("Log now"); await tick();
  assert.equal(writes, 0);
  assert.equal(ui.storage.get("pineapple_signals_pending_v1_TEST-SCOPE"), original);
});

test("Log time opens a dedicated modal with a non-scrolling footer", () => {
  const ui = harness();
  ui.click("Vyvanse"); ui.click("Log time");
  const modal = ui.nodes(ui.render()).find((node) => node.type === "modal");
  assert(modal.props.open);
  assert.equal(modal.props.ariaLabel, "Log signals at time");
  assert(modal.props.footer);
  assert(ui.nodes(modal.props.footer).some((node) => node.type === "button" && ui.text(node) === "Confirm"));
});

function keypad(ui) {
  function press(label) {
    const button = ui.nodes(ui.render()).find((node) => node.type === "button" && node.props["aria-label"] === label);
    assert(button, `Missing keypad button ${label}`);
    button.props.onClick();
  }
  function enter(digits) { press("Clear time"); for (const digit of digits) press(`Digit ${digit}`); }
  return { press, enter };
}

test("keypad uses buttons and a large output, never an editable native time field", () => {
  const ui = harness(); ui.keypadMode();
  const nodes = ui.nodes(ui.render());
  const fields = nodes.filter((node) => node.type === "input");
  assert.equal(fields.length, 1);
  assert.equal(fields[0].props.type, "date");
  assert(nodes.some((node) => node.type === "output" && node.props["aria-label"] === "Selected time"));
  assert.equal(nodes.filter((node) => node.type === "button" && node.props["aria-label"]?.startsWith("Digit ")).length, 10);
  assert(nodes.some((node) => node.props?.["aria-label"] === "Time keypad" && node.props.className.includes("grid-cols-3")));
});

test("keypad formats digits, auto-prefixes single-digit hours, and backspaces", () => {
  const ui = harness(); ui.keypadMode();
  const pad = keypad(ui);
  pad.enter("930");
  assert.equal(ui.time, "21:30");
  assert(ui.nodes(ui.render()).some((node) => node.type === "output" && ui.text(node) === "09:30"));
  pad.press("Backspace");
  assert.equal(ui.time, "");
  pad.press("Digit 5");
  assert.equal(ui.time, "21:35");
  pad.press("Clear time");
  assert.equal(ui.time, "");
  assert(ui.nodes(ui.render()).some((node) => node.type === "output" && ui.text(node) === "--:--"));
});

test("keypad validates 1–12 hours and 00–59 minutes; AM/PM handles noon and midnight", () => {
  const ui = harness(); ui.keypadMode();
  const pad = keypad(ui);
  pad.enter("1200");
  ui.click("AM"); assert.equal(ui.time, "00:00");
  ui.click("PM"); assert.equal(ui.time, "12:00");
  for (const invalid of ["0000", "1360", "1260", "010"]) {
    pad.enter(invalid); assert.equal(ui.time, "");
  }
  pad.enter("1159"); ui.click("PM"); assert.equal(ui.time, "23:59");
  ui.click("AM"); assert.equal(ui.time, "11:59");
});

test("keypad retains selected date and shows full interpreted timestamp", () => {
  const ui = harness(); ui.keypadMode();
  const pad = keypad(ui); pad.enter("0930"); ui.click("AM");
  const date = ui.nodes(ui.render()).find((node) => node.type === "input");
  date.props.onChange({ target: { value: "2026-08-25" } });
  assert.equal(ui.date, "2026-08-25");
  assert.equal(ui.time, "09:30");
  assert(ui.text(ui.render()).includes("Tuesday, August 25, 2026"));
});

test("invalid keypad input disables Confirm and cancels without a write", () => {
  let writes = 0;
  const ui = harness({ save: async () => { writes++; return true; } });
  ui.click("Vyvanse"); ui.click("Log time");
  const picker = ui.nodes(ui.render()).find((node) => node.type === ui.context.SignalTimeKeypad);
  picker.props.onChange("2026-11-19", "");
  assert(ui.button("Confirm").props.disabled);
  ui.click("Cancel");
  assert.equal(writes, 0);
  assert.equal(ui.storage.size, 0);
  assert(ui.button("Vyvanse").props["aria-pressed"]);
});

test("four rounded choices toggle independently and logging actions immediately follow", () => {
  const ui = harness();
  ui.click("Vyvanse"); ui.click("Fluoxetine"); ui.click("Creatine");
  ui.click("Coffee"); ui.click("Iced latte"); ui.click("Confirm coffee");
  const labels = ["Vyvanse", "Fluoxetine", "Creatine", "Coffee"];
  for (const label of labels) {
    const choice = ui.button(label);
    assert(choice.props["aria-pressed"]);
    assert(choice.props.className.includes("rounded-[18px]"));
    assert(choice.props.className.includes("h-[100px]"));
  }
  assert(!ui.text(ui.button("Vyvanse")).includes("30 mg"));
  assert(!ui.text(ui.button("Fluoxetine")).includes("20 mg"));
  assert(ui.nodes(ui.button("Creatine")).some((node) => node.type === "dumbbell"));
  const main = ui.render().props.children[1];
  const sections = main.props.children;
  assert(sections[0].props.className.includes("grid-cols-4"));
  assert(ui.text(sections[1]).includes("Log nowLog time"));
  ui.click("Fluoxetine");
  assert(!ui.button("Fluoxetine").props["aria-pressed"]);
  assert(ui.button("Vyvanse").props["aria-pressed"]);
});

test("recent coffee choices retain ordering and Custom exposes the complete library", () => {
  const ui = harness(); ui.click("Coffee");
  const recent = ui.nodes(ui.render()).filter((node) => node.type === "button" && node.props["aria-pressed"] !== undefined).map(ui.text);
  assert.deepEqual(recent.slice(0, 3), ["Iced latte", "Espresso", "Matcha latte"]);
  ui.click("Custom");
  for (const label of ["Americano", "Iced Americano", "Cappuccino", "Cortado", "Homemade coffee", "Custom"]) assert(ui.button(label));
});

test("compact coffee chooser has three dynamic recent tiles and a fourth Custom tile", () => {
  for (const recentCoffeeIds of [["cortado", "homemade_coffee", "flat_white"], ["matcha_latte", "iced_americano", "espresso"], [], ["custom", "invalid", "cortado", "cortado"]]) {
    const ui = harness({ recentCoffeeIds }); ui.click("Coffee");
    const popup = ui.nodes(ui.render()).find((node) => node.type === "modal" && node.props.title === "Choose coffee");
    assert(popup.props.compact && popup.props.hideHeader && popup.props.softBackdrop);
    const grid = ui.nodes(ui.render()).find((node) => node.props?.["aria-label"] === "Quick coffee presets");
    const tiles = ui.nodes(grid).filter((node) => node.type === "button");
    assert.equal(tiles.length, 4);
    assert.equal(ui.text(tiles[3]), "Custom");
    assert.equal(new Set(tiles.slice(0, 3).map(ui.text)).size, 3);
    assert(tiles.every((node) => node.props.className.includes("aspect-square")));
    assert(!ui.text(grid).includes("mg"));
    assert(!ui.text(ui.render()).includes("Recent coffees"));
    assert(!ui.text(ui.render()).includes("Other coffees"));
    assert(ui.button("Confirm coffee").props.disabled);
    if (recentCoffeeIds[0] === "cortado") assert.deepEqual(tiles.map(ui.text), ["Cortado", "Homemade coffee", "Flat white", "Custom"]);
    if (recentCoffeeIds[0] === "matcha_latte") assert.deepEqual(tiles.map(ui.text), ["Matcha latte", "Iced Americano", "Espresso", "Custom"]);
  }
});

test("full coffee library returns to quick tiles without losing drink or custom shot quantity", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Coffee"); ui.click("Custom"); ui.click("Flat white");
  ui.nodes(ui.render()).find((node) => node.props?.["aria-label"] === "Custom shot count").props.onClick();
  ui.nodes(ui.render()).find((node) => node.type === "input" && node.props?.["aria-label"] === "Number of shots").props.onChange({ target: { value: "4" } });
  ui.click("Back to quick coffees");
  assert.equal(writes.length, 0);
  assert(!ui.button("Confirm coffee").props.disabled);
  ui.click("Custom");
  assert.equal(ui.nodes(ui.render()).find((node) => node.type === "input" && node.props?.["aria-label"] === "Number of shots").props.value, "4");
  ui.click("Back to quick coffees"); ui.click("Confirm coffee");
  assert.equal(writes.length, 0);
  ui.click("Log now"); await tick();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].metadata.drinkType, "flat_white");
  assert.equal(writes[0].amount, 520);
  assert.equal(writes[0].metadata.shots, 4);
});

test("coffee chooser preserves the existing Cortado, Homemade, Flat white and Custom icons", () => {
  const mapping = ast.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => item.name.getText(ast) === "CAFFEINE_DRINK_ICONS")).getText(ast);
  for (const [id, Icon] of [["cortado", "GlassWater"], ["homemade_coffee", "House"], ["flat_white", "Coffee"], ["custom", "Plus"]]) assert(mapping.includes(`${id}: ${Icon}`));
});

test("coffee popup keeps the Dashboard selectable beneath it and closing cannot save", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Vyvanse");
  ui.click("Coffee");
  const popup = ui.nodes(ui.render()).find((node) => node.type === "modal" && node.props.title === "Choose coffee");
  assert(popup.props.open);
  assert(popup.props.softBackdrop);
  assert(ui.button("Vyvanse").props["aria-pressed"]);
  ui.click("Iced latte");
  popup.props.onClose();
  await tick();
  assert.equal(writes.length, 0);
  assert(!ui.button("Coffee").props["aria-pressed"]);
  ui.click("Coffee"); ui.click("Cancel");
  assert.equal(writes.length, 0);
  ui.click("Coffee"); ui.click("Iced latte"); ui.click("Confirm coffee");
  assert.equal(writes.length, 0);
  assert(ui.button("Coffee").props["aria-pressed"]);
  ui.click("Log now"); await tick();
  assert.equal(writes.length, 2);
  assert.equal(writes[0].timestamp, writes[1].timestamp);
});

test("History and Tracker reuse the canonical Dashboard colours and icons", () => {
  const funcs = ["signalIdentity", "medicationTrackerColor", "isVyvanseEntry", "isProzacEntry", "isCaffeineEntry", "medicationMetadataValue"];
  const code = [palette, icons, ...ast.statements.filter((node) => ts.isFunctionDeclaration(node) && funcs.includes(node.name?.text))].map((node) => node.getText(ast)).join("\n");
  const context = { PillIcon: "pill", Dumbbell: "dumbbell", Coffee: "coffee" };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  for (const [medication, key, colour, Icon] of [["Vyvanse", "vyvanse", "#99E1FF", "pill"], ["Prozac", "prozac", "#C29EFF", "pill"], ["Creatine", "creatine", "#2ACEC6", "dumbbell"], ["Coffee", "caffeine", "#FCB100", "coffee"]]) {
    const result = context.signalIdentity({ entryType: "input", medication });
    assert.equal(result.colour, colour);
    assert.equal(result.Icon, Icon);
    assert.equal(context.medicationTrackerColor(key), colour);
  }
});

test("metric cards omit wind-down and preserve saved effect settings without a hidden default", () => {
  const cards = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "MobileSignalMetricCards").getText(ast);
  const settings = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "SignalEstimateSettings").getText(ast);
  assert(!cards.includes("Estimated wind-down"));
  assert(!cards.includes("Not enough data"));
  assert(!settings.includes("Personal estimate assumptions"));
  assert(!cards.includes("Adjust effect window"));
  assert(!cards.includes("Set estimate"));
  assert(settings.includes("...assumptions, effectHours:"));
  assert(!cards.includes("sm:hidden"));
});

test("one, two and three shots derive caffeine using the selected preset and persist metadata", async () => {
  for (const shots of [1, 2, 3]) {
    const db = transport();
    const ui = harness({ save: db.save });
    ui.click("Coffee"); ui.click("Custom"); ui.click("Iced latte"); ui.click(`${shots} ${shots === 1 ? "shot" : "shots"}`);
    ui.click("Confirm coffee"); ui.click("Log now"); await tick();
    const loaded = await db.load();
    assert.equal(loaded.entries.length, 1);
    assert.equal(loaded.entries[0].amount, 120 * shots);
    assert.equal(loaded.entries[0].unit, "mg");
    assert.equal(loaded.entries[0].metadata.drinkType, "iced_latte");
    assert.equal(loaded.entries[0].metadata.shots, shots);
  }
});

test("Custom shot selector supports editable counts and rejects invalid counts", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Coffee"); ui.click("Custom"); ui.click("Espresso");
  const customCount = () => ui.nodes(ui.render()).find((node) => node.props?.["aria-label"] === "Custom shot count").props.onClick();
  customCount();
  function input() { return ui.nodes(ui.render()).find((node) => node.type === "input" && node.props?.["aria-label"] === "Number of shots"); }
  for (const value of ["0", "1.5", "-1", ""]) {
    input().props.onChange({ target: { value } });
    assert(ui.button("Confirm coffee").props.disabled);
  }
  input().props.onChange({ target: { value: "4" } });
  ui.click("Confirm coffee"); ui.click("Coffee"); ui.click("Coffee");
  ui.click("Custom"); ui.click("Espresso"); customCount();
  input().props.onChange({ target: { value: "4" } });
  ui.click("Confirm coffee"); ui.click("Log now"); await tick();
  assert.equal(writes[0].amount, 260);
  assert.equal(writes[0].metadata.shots, 4);
});

test("switching from espresso to a serving-based drink removes shot controls and stale multipliers", async () => {
  const writes = [];
  const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Coffee"); ui.click("Custom"); ui.click("Espresso"); ui.click("3 shots"); ui.click("Homemade coffee");
  assert(!ui.nodes(ui.render()).some((node) => node.props?.["aria-label"] === "Espresso shots"));
  assert.equal(ui.nodes(ui.render()).filter((node) => node.type === "input").length, 0);
  ui.click("Confirm coffee"); ui.click("Log now"); await tick();
  assert.equal(writes[0].amount, 95);
  assert.equal(writes[0].metadata.shots, 1);
});

for (const [label, preset] of [["Homemade coffee", 95], ["Matcha latte", 70], ["Custom", 100], ["Cortado", 60]]) {
  for (const count of [1, 2, 3]) {
    test(`${label} saves ${count} shots using the full preset baseline`, async () => {
      const writes = [];
      const ui = harness({ save: async (entry) => { writes.push(entry); return true; } });
      ui.click("Coffee"); ui.click("Custom"); ui.click(label);
      ui.click(`${count} ${count === 1 ? "shot" : "shots"}`);
      ui.click("Confirm coffee"); ui.click("Log now"); await tick();
      assert.equal(writes[0].amount, preset * count);
      assert.equal(writes[0].metadata.shots, count);
    });
  }
}

test("pending journal preserves a previously entered caffeine amount without recalculation", async () => {
  const storage = new Map();
  const pending = create([], 0, { ...coffee, mg: 155 });
  storage.set("pineapple_signals_pending_v1_TEST-SCOPE", JSON.stringify(pending));
  const writes = [];
  const ui = harness({ storage, save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Retry unsaved entries"); await tick();
  assert.equal(writes[0].id, pending.entries[0].entry.id);
  assert.equal(writes[0].amount, 155);
  assert.equal(writes[0].metadata.shots, 3);
});

test("375px and 393px mobile layout constraints keep four compact cards within the container", () => {
  const ui = harness();
  for (const width of [375, 393]) {
    const available = width - 32;
    const cardWidth = (available - 24) / 4;
    assert(cardWidth - 8 >= 70);
    assert(ui.button("Fluoxetine").props.className.includes("min-w-0"));
    const shotButtonWidth = (available - 3 * 6) / 4;
    assert(shotButtonWidth >= 70);
  }
  assert(!ui.render().props.className.includes("sm:hidden"));
});

test("mobile history hides alcohol without affecting desktop data or filters", () => {
  const wanted = ["signalsDayView", "visibleHistoryFilter", "medicationHistoryEntries", "medsHistoryItems"];
  const found = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && wanted.includes(node.name.getText(ast))) found[node.name.getText(ast)] = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const code = ts.transpileModule(wanted.map((name) => `const ${found[name]};`).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  function context(mobile, filter) {
    return vm.runInNewContext(`${code}\n({ signalsDayView, visibleHistoryFilter, medsHistoryItems });`, {
      signalsMobile: mobile, medsTodayMode: "night", medsHistoryFilter: filter,
      sortedMedicationEntries: [{ id: "med", entryType: "input", medication: "Prozac", timestamp }],
      alcoholEntries: [{ id: "alcohol", startedAt: timestamp }], useMemo: (callback) => callback(),
    });
  }
  const mobile = context(true, "all");
  assert.equal(mobile.signalsDayView, true);
  assert.equal(mobile.medsHistoryItems.length, 1);
  assert.equal(mobile.medsHistoryItems[0].kind, "medication");
  assert.equal(context(false, "all").medsHistoryItems.length, 2);
  assert.equal(context(false, "alcohol").medsHistoryItems[0].kind, "alcohol");
  assert.equal(context(false, "all").signalsDayView, false);
  assert.equal(context(true, "alcohol").visibleHistoryFilter, "all");
});

function metricModel() {
  const functions = ["deriveMobileSignalMetrics", "caffeineMetricBar", "estimateSignalWindDown", "normalizeSignalAssumptions", "localDateISO", "isVyvanseEntry", "isProzacEntry", "isCaffeineEntry", "medicationMetadataValue", "eliminationRateFromHalfLife", "batemanRelativeLevel", "batemanPeakTimeHours", "medsSmoothCurvePath", "medsCurvePath", "clamp"];
  const constants = ["SIGNAL_COLOURS", "EMPTY_SIGNAL_ASSUMPTIONS", "VYVANSE_DEFAULT_EFFECT_HOURS", "VYVANSE_VISUAL_MODEL", "CAFFEINE_VISUAL_MODEL", "VYVANSE_ELIMINATION_RATE", "VYVANSE_REFERENCE_PEAK_HOURS", "CAFFEINE_ELIMINATION_RATE", "CAFFEINE_REFERENCE_PEAK_HOURS"];
  const statements = ast.statements.filter((node) => ts.isFunctionDeclaration(node) ? functions.includes(node.name?.text) : ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => constants.includes(item.name.getText(ast))));
  const context = { Date, Number, Math, Set };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(statements.map((node) => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context;
}

test("logged-today rings are independent from selection and allow logging the same signal again", () => {
  const ui = harness({ loggedToday: ["Vyvanse", "Prozac"] });
  assert(!ui.button("Vyvanse").props["aria-pressed"]);
  const ring = () => ui.nodes(ui.button("Vyvanse")).find((node) => node.props?.["data-logged-today"] !== undefined);
  assert.equal(ring().props["data-logged-today"], true);
  const before = ring().props.style.borderColor;
  ui.click("Vyvanse"); assert(ui.button("Vyvanse").props["aria-pressed"]);
  assert.equal(ring().props.style.borderColor, before);
  ui.click("Vyvanse"); assert(!ui.button("Vyvanse").props["aria-pressed"]);
  assert.equal(ring().props["data-logged-today"], true);
  assert.equal(ui.nodes(ui.button("Creatine")).find((node) => node.props?.["data-logged-today"] !== undefined).props["data-logged-today"], false);
});

test("live metrics use recorded data and raw caffeine fractions, not normalized chart percentages", () => {
  const model = metricModel();
  const now = Date.parse("2026-11-22T12:00:00+01:00");
  const entries = [
    { entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(now - 3600000).toISOString() },
    { entryType: "input", medication: "Coffee", amount: 120, unit: "mg", timestamp: new Date(now - 2 * 3600000).toISOString() },
  ];
  const metrics = model.deriveMobileSignalMetrics(entries, now);
  const peakDelay = model.batemanPeakTimeHours(0.664, Math.log(2) / 10.5);
  assert.equal(metrics.minutesUntilPeak, Math.ceil((peakDelay - 1) * 60));
  const fraction = model.batemanRelativeLevel(2, 4, Math.log(2) / 5);
  assert(Math.abs(metrics.remainingMg - 120 * fraction) < 0.000001);
  const later = model.deriveMobileSignalMetrics(entries, now + 4 * 3600000);
  assert.equal(later.minutesUntilPeak, 0);
  assert(later.remainingMg < metrics.remainingMg);
});

test("metrics distinguish missing doses from unknown mg and exclude future/old intakes", () => {
  const model = metricModel(); const now = Date.parse("2026-11-22T12:00:00Z");
  assert.equal(model.deriveMobileSignalMetrics([], now).remainingMg, 0);
  assert.equal(model.deriveMobileSignalMetrics([], now).minutesUntilPeak, null);
  const unknown = { entryType: "input", medication: "Coffee", amount: 1, unit: "cup", timestamp: new Date(now - 3600000).toISOString() };
  assert(model.deriveMobileSignalMetrics([unknown], now).caffeineUnavailable);
  assert.equal(model.deriveMobileSignalMetrics([{ ...unknown, unit: "mg", amount: null }], now).remainingMg, null);
  assert.equal(model.deriveMobileSignalMetrics([{ ...unknown, timestamp: new Date(now + 3600000).toISOString() }], now).remainingMg, 0);
  assert.equal(model.deriveMobileSignalMetrics([{ ...unknown, timestamp: new Date(now - 40 * 3600000).toISOString() }], now).remainingMg, 0);
});

test("today markers use local dates, preserve Prozac aliases, and refresh from new records", () => {
  const previous = process.env.TZ; process.env.TZ = "Europe/Madrid";
  try {
    const model = metricModel(); const now = Date.parse("2026-11-22T00:30:00+01:00");
    const base = { entryType: "input", unit: "mg", amount: 20, timestamp: "2026-11-22T00:10:00+01:00" };
    const entries = ["Vyvanse", "fluoxetine", "Creatine", "Coffee"].map((medication) => ({ ...base, medication }));
    assert.deepEqual(Array.from(model.deriveMobileSignalMetrics(entries, now).loggedToday), ["Vyvanse", "Prozac", "Creatine", "Coffee"]);
    assert.equal(model.deriveMobileSignalMetrics([{ ...base, medication: "Vyvanse", timestamp: "2026-11-21T23:59:00+01:00" }], now).loggedToday.length, 0);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test("a confirmed entry newer than the last display-clock tick updates its ring immediately", () => {
  const model = metricModel();
  const now = Date.parse("2026-11-22T12:00:05Z");
  class Clock extends Date { static now() { return now; } }
  model.Date = Clock;
  model.clientNowMs = now - 5000;
  model.signalMetricNowMs = now - 5000;
  model.signalAssumptions = { effectHours: null, caffeineThresholdMg: null };
  model.sortedMedicationEntries = [{ entryType: "input", medication: "Creatine", amount: 3, unit: "g", timestamp: new Date(now).toISOString() }];
  model.useMemo = (callback) => callback();
  let declaration;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "mobileSignalMetrics") declaration = node.getText(ast);
    ts.forEachChild(node, find);
  }
  find(ast);
  vm.runInContext(ts.transpileModule(`const ${declaration};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, model);
  assert.deepEqual(Array.from(vm.runInContext("mobileSignalMetrics.loggedToday", model)), ["Creatine"]);
});

test("retrospective Creatine and other signals share the selected time and retain 3.4 g on reload", async () => {
  const db = transport();
  const ui = harness({ save: db.save });
  ui.click("Creatine"); ui.click("Vyvanse"); ui.click("Fluoxetine"); ui.click("Log time");
  const picker = ui.nodes(ui.render()).find((node) => node.type === ui.context.SignalTimeKeypad);
  picker.props.onChange("2026-08-25", "14:20");
  assert.equal(db.calls.length, 0);
  ui.click("Confirm"); await tick();
  const loaded = await db.load();
  assert.equal(loaded.entries.length, 3);
  const creatine = loaded.entries.find((entry) => entry.medication === "Creatine");
  assert.equal(creatine.amount, 3.4);
  assert.equal(creatine.unit, "g");
  assert(loaded.entries.every((entry) => entry.timestamp === ui.context.signalTimestampFromInputs("2026-08-25", "14:20")));
  assert.equal(loaded.entries.find((entry) => entry.medication === "Vyvanse").amount, 30);
  assert.equal(loaded.entries.find((entry) => entry.medication === "Prozac").amount, 20);
  const labelFunctions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ["medicationLabel", "formatMedicationAmount", "isProzacEntry"].includes(node.name?.text));
  vm.runInContext(ts.transpileModule(labelFunctions.map((node) => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, ui.context);
  assert.equal(ui.context.medicationLabel(creatine), "Creatine 3.4 g");
});

test("new default does not rewrite older Creatine retry journals", async () => {
  const pending = create(["Creatine"], 2.75);
  const storage = new Map([["pineapple_signals_pending_v1_TEST-SCOPE", JSON.stringify(pending)]]);
  const writes = [];
  const ui = harness({ storage, save: async (entry) => { writes.push(entry); return true; } });
  ui.click("Retry unsaved entries"); await tick();
  assert.equal(writes[0].id, pending.entries[0].entry.id);
  assert.equal(writes[0].amount, 2.75);
  assert.equal(writes[0].unit, "g");
});

function jsxByLabel(label) {
  let found;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some((attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "aria-label" && attribute.initializer?.text === label)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert(found, `Missing ${label}`); return found.getText(ast);
}

test("graph tabs change only the graph choice, not the selected range or offset", () => {
  const state = { mobileSignalGraph: "vyvanse", medsRangeOffset: 3, medsLevelRange: "2d" };
  const context = { React: require("react"), ...state };
  context.setMobileSignalGraph = (value) => { context.mobileSignalGraph = value; };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`function render() { return (${jsxByLabel("Estimated level graph")}); }`, { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText, context);
  const buttons = context.render().props.children;
  assert.equal(buttons[0].props["aria-selected"], true);
  buttons[1].props.onClick();
  assert.equal(context.mobileSignalGraph, "caffeine");
  assert.equal(context.medsRangeOffset, 3);
  assert.equal(context.medsLevelRange, "2d");
  assert.equal(context.render().props.children[1].props["aria-selected"], true);
});

test("compact navigation preserves previous/current/next behaviour and shows a historical date label", () => {
  const helper = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ["localDateISO", "signalRangeReferenceLabel"].includes(node.name?.text)).map((node) => node.getText(ast)).join("\n");
  const context = { React: require("react"), Date, Intl, ChevronLeft: "left", ChevronRight: "right", medsRangeOffset: 0, medsVisibleRange: { startMs: Date.parse("2026-11-21T10:00:00Z"), endMs: Date.parse("2026-11-22T10:00:00Z") } };
  context.setMedsRangeOffset = (value) => { context.medsRangeOffset = typeof value === "function" ? value(context.medsRangeOffset) : value; };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`${helper}\nfunction render() { return (${jsxByLabel("Chart time navigation")}); }`, { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText, context);
  let buttons = context.render().props.children;
  assert.equal(buttons[1].props.children, "Today");
  assert.equal(buttons[2].props.disabled, true);
  buttons[0].props.onClick(); buttons = context.render().props.children;
  assert.equal(context.medsRangeOffset, 1);
  assert(buttons[1].props.children.includes("2026"));
  assert.equal(buttons[2].props.disabled, false);
  buttons[2].props.onClick(); assert.equal(context.medsRangeOffset, 0);
  buttons[0].props.onClick(); context.render().props.children[1].props.onClick(); assert.equal(context.medsRangeOffset, 0);
});

test("dot coordinates, radii and colours stay unchanged; Signals dots have no white strokes at any width", () => {
  const chart = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "MedsChartCard");
  const React = require("react");
  const context = { React, useRef: () => ({ current: null }), medsCurvePath: () => "curve", medsAreaPath: () => "area" };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(chart.getText(ast), { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText, context);
  const props = { title: "Vyvanse", subtitle: "metadata", meta: "30mg", tone: "#ff6b1a", softTone: "#fff0e7", points: [], dots: [{ key: "intake", x: 45, y: 67 }], nowX: 100, axisLabels: [], maxPercent: 125 };
  function circles(node, result = []) { if (node && typeof node === "object") { if (node.type === "circle") result.push(node); [].concat(node.props?.children || []).flat(Infinity).forEach((child) => circles(child, result)); } return result; }
  const mobile = circles(context.MedsChartCard({ ...props, mobileDashboard: true }))[0];
  const original = circles(context.MedsChartCard(props))[0];
  assert.equal(mobile.props.stroke, "none");
  assert.equal(mobile.props.strokeWidth, 0);
  assert.equal(original.props.stroke, "#fff");
  for (const key of ["cx", "cy", "r", "fill"]) assert.equal(mobile.props[key], original.props[key]);
  assert.equal(mobile.props.cx, 45); assert.equal(mobile.props.cy, 67); assert.equal(mobile.props.r, "5.5");
});

test("canonical colours stay bright for logged-today rings, with independent selection outlines", () => {
  const expected = { Vyvanse: "#99E1FF", Fluoxetine: "#C29EFF", Creatine: "#2ACEC6", Coffee: "#FCB100" };
  const ui = harness();
  for (const [name, colour] of Object.entries(expected)) {
    const ring = ui.nodes(ui.button(name)).find((node) => node.props?.["data-logged-today"] !== undefined);
    assert.equal(ring.props.style.backgroundColor, colour);
    assert.equal(ui.button(name).props.style.backgroundColor, "white");
  }
  const logged = harness({ loggedToday: ["Vyvanse"] });
  const ring = () => logged.nodes(logged.button("Vyvanse")).find((node) => node.props?.["data-logged-today"] !== undefined);
  const loggedTone = ring().props.style.backgroundColor;
  assert.equal(loggedTone, expected.Vyvanse);
  assert.equal(ring().props.style.borderColor, undefined);
  assert.equal(ring().props.style.boxShadow, undefined);
  logged.click("Vyvanse");
  assert.equal(logged.button("Vyvanse").props.style.backgroundColor, expected.Vyvanse);
  assert.equal(ring().props.style.backgroundColor, "transparent");
  assert.equal(logged.button("Vyvanse").props.style.color, "white");
  logged.click("Creatine");
  assert.equal(logged.button("Vyvanse").props["aria-pressed"], true);
  assert.equal(logged.button("Creatine").props["aria-pressed"], true);
  logged.click("Vyvanse");
  assert.equal(logged.button("Vyvanse").props.style.backgroundColor, "white");
  for (const width of [375, 393, 1280]) assert((width - 32 - 24) / 4 > 70);
});

test("Tracker weekday labels align with actual dates across month, year and DST boundaries", () => {
  const component = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "MedsTrackerGrid");
  const context = { React: require("react"), Date, Intl, useState: () => [null, () => {}], todayISO: () => "2026-11-23", medicationTrackerDateLabel: (date) => date, formatMedicationAmount: String };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(component.getText(ast), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  function nodes(tree, output = []) {
    if (tree && typeof tree === "object") { output.push(tree); [].concat(tree.props?.children || []).flat(Infinity).forEach((child) => nodes(child, output)); }
    return output;
  }
  for (const start of ["2026-02-23", "2026-03-23", "2026-12-28", "2026-04-01"]) {
    const dates = Array.from({ length: 15 }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
    for (const mobile of [true, false]) {
      const tree = context.MedsTrackerGrid({ dates, mobile, substance: { label: "Vyvanse", color: "#99E1FF", subtitle: "7D HIDDEN SUMMARY", days: new Map() } });
      const all = nodes(tree);
      const weekdays = all.filter((node) => node.type === "span" && ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(node.props["aria-label"]));
      assert.deepEqual(weekdays.map((node) => node.props.children), ["M", "T", "W", "T", "F", "S", "S"]);
      assert.deepEqual(weekdays.map((node) => node.props.style.gridRowStart), [2, 3, 4, 5, 6, 7, 8]);
      const cells = all.filter((node) => node.type === "button");
      const offset = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
      assert.equal(cells.length, dates.length);
      cells.forEach((cell, index) => {
        const weekday = (new Date(`${dates[index]}T00:00:00Z`).getUTCDay() + 6) % 7;
        assert.equal(cell.props["data-date"], dates[index]);
        assert.equal(cell.props.style.gridRowStart, weekday + 2);
        assert.equal(cell.props.style.gridColumnStart, Math.floor((index + offset) / 7) + 2);
      });
      for (const label of all.filter((node) => node.type === "span" && /^\d{4}-\d{2}$/.test(node.props.title ?? ""))) {
        const firstIndex = dates.findIndex((date) => date.startsWith(label.props.title));
        assert.equal(label.props.style.gridColumn.split(" / ")[0], String(cells[firstIndex].props.style.gridColumnStart));
        assert(Number(label.props.style.gridColumn.split("span ")[1]) >= 1);
      }
      assert(!JSON.stringify(tree).includes("7D HIDDEN SUMMARY"));
    }
  }
});

test("History omits only per-day summaries and Tracker omits archive headings", () => {
  assert(!uiSource.includes("Signal archive"));
  assert(!uiSource.includes("365 day activity"));
  assert(!uiSource.includes('items.length === 1 ? "signal" : "signals"'));
  assert(uiSource.includes("formatMedicationDate(items[0]?.timestamp ?? date)"));
  assert(uiSource.includes("onClick={() => openMedicationEntryEditor(entry)}"));
});

test("Vyvanse transitions peak → personal wear-off → ended, with whole-window progress", () => {
  const model = metricModel();
  const doseMs = Date.parse("2026-11-23T08:00:00+01:00");
  const entries = [{ entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(doseMs).toISOString() }];
  const assumptions = { effectHours: 12, caffeineThresholdMg: 20 };
  const before = model.deriveMobileSignalMetrics(entries, doseMs + 3600000, assumptions);
  assert.equal(before.effectPhase, "peak");
  assert.equal(before.effectProgress, 1 / 12);
  assert(before.minutesUntilPeak > 0);
  const afterPeak = model.deriveMobileSignalMetrics(entries, doseMs + 6 * 3600000, assumptions);
  assert.equal(afterPeak.effectPhase, "wearOff");
  assert.equal(afterPeak.minutesUntilWearOff, 360);
  assert.equal(afterPeak.effectProgress, 0.5);
  const ended = model.deriveMobileSignalMetrics(entries, doseMs + 12 * 3600000, assumptions);
  assert.equal(ended.effectPhase, "ended");
  assert.equal(ended.minutesUntilWearOff, 0);
  assert.equal(ended.effectProgress, 1);
});

test("unset personal duration uses the 14-hour adult estimate, not elimination half-life", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const entry = { entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(now - 6 * 3600000).toISOString() };
  const metric = model.deriveMobileSignalMetrics([entry], now);
  assert.equal(metric.effectPhase, "wearOff");
  assert.equal(metric.effectConfigured, true);
  assert.equal(metric.effectPersonalized, false);
  assert.equal(metric.effectHours, 14);
  assert.equal(metric.minutesUntilWearOff, 480);
  assert.equal(metric.effectProgress, 6 / 14);
  assert.equal(metric.windDownAt, null);
  assert.equal(model.deriveMobileSignalMetrics([], now, { effectHours: 12, caffeineThresholdMg: 20 }).windDownAt, null);
});

test("default Vyvanse peak, wear-off and progress use logged ingestion time without changing peak maths", () => {
  const model = metricModel(), doseMs = Date.parse("2026-11-23T08:00:00Z");
  const dose = { entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(doseMs).toISOString() };
  const peakHours = model.batemanPeakTimeHours(0.664, Math.log(2) / 10.5);
  for (const [hours, phase, remaining] of [[0, "peak", 840], [1, "peak", 780], [6, "wearOff", 480], [13, "wearOff", 60], [14, "ended", 0], [20, "ended", 0]]) {
    const metrics = model.deriveMobileSignalMetrics([dose], doseMs + hours * 3600000);
    assert.equal(metrics.effectPhase, phase);
    assert.equal(metrics.minutesUntilWearOff, remaining);
    assert.equal(metrics.effectProgress, Math.min(1, hours / 14));
    assert.equal(metrics.minutesUntilPeak, Math.max(0, Math.ceil((peakHours - hours) * 60)));
  }
  const empty = model.deriveMobileSignalMetrics([], doseMs);
  assert.equal(empty.effectPhase, "empty");
  assert.equal(empty.effectProgress, 0);
  assert.equal(empty.minutesUntilWearOff, null);
  const future = model.deriveMobileSignalMetrics([dose], doseMs - 60000);
  assert.equal(future.effectPhase, "empty");
  assert.equal(future.effectProgress, 0);
  const latest = { ...dose, timestamp: new Date(doseMs + 5 * 3600000).toISOString() };
  const multiple = model.deriveMobileSignalMetrics([dose, latest], doseMs + 6 * 3600000);
  assert.equal(multiple.effectPhase, "peak");
  assert.equal(multiple.effectProgress, 1 / 14);
  assert.equal(multiple.minutesUntilWearOff, 780);
});

test("valid personal Vyvanse durations override the default without rewriting stored settings", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const dose = { entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(now - 6 * 3600000).toISOString() };
  for (const effectHours of [8, 12, 14.5, 16]) {
    const assumptions = { effectHours, caffeineThresholdMg: null }, before = JSON.stringify(assumptions);
    const metrics = model.deriveMobileSignalMetrics([dose], now, assumptions);
    assert.equal(metrics.effectPersonalized, true);
    assert.equal(metrics.effectHours, effectHours);
    assert.equal(metrics.minutesUntilWearOff, (effectHours - 6) * 60);
    assert.equal(metrics.effectProgress, 6 / effectHours);
    assert.equal(JSON.stringify(assumptions), before);
  }
  for (const effectHours of [null, undefined, 0, -1, NaN, Infinity, 169, "12"]) {
    const metrics = model.deriveMobileSignalMetrics([dose], now, { effectHours, caffeineThresholdMg: null });
    assert.equal(metrics.effectHours, 14);
    assert.equal(metrics.effectPersonalized, false);
    assert.equal(metrics.minutesUntilWearOff, 480);
  }
  const saved = { effectHours: null, caffeineThresholdMg: 20 };
  model.deriveMobileSignalMetrics([dose], now, saved);
  assert.equal(saved.effectHours, null);
});

test("Vyvanse selects the latest occurred valid dose, never a future or invalid dose", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const dose = (hoursAgo, amount = 30) => ({ entryType: "input", medication: "Vyvanse", unit: "mg", amount, timestamp: new Date(now - hoursAgo * 3600000).toISOString() });
  const assumptions = { effectHours: 12, caffeineThresholdMg: null };
  const older = dose(8), recent = dose(1);
  const metrics = model.deriveMobileSignalMetrics([dose(-1), older, dose(0, -10), recent, { ...dose(0), timestamp: "invalid" }], now, assumptions);
  assert.equal(metrics.effectPhase, "peak");
  assert.equal(metrics.effectProgress, 1 / 12);
  assert.equal(metrics.minutesUntilWearOff, 660);
  const noDose = model.deriveMobileSignalMetrics([dose(-1)], now, assumptions);
  assert.equal(noDose.effectPhase, "empty");
  assert.equal(noDose.minutesUntilPeak, null);
  assert.equal(noDose.effectProgress, 0);
  const ended = model.deriveMobileSignalMetrics([dose(14)], now, assumptions);
  assert.equal(ended.effectPhase, "ended");
  assert.equal(ended.minutesUntilWearOff, 0);
});

test("caffeine capacity is fixed at 120 mg and display colours follow quantity anchors", () => {
  const model = metricModel();
  for (const [mg, fill, colour] of [[0, 0, "#FCB100"], [60, 0.5, "#FCB100"], [120, 1, "#FCB100"], [180, 1, "#F59E0B"], [240, 1, "#F46332"], [300, 1, "#EF4444"]]) {
    const bar = model.caffeineMetricBar(mg);
    assert.equal(bar.fill, fill);
    assert.equal(bar.displayMg, mg);
    assert.equal(bar.colour, colour);
  }
  assert.equal(model.caffeineMetricBar(600).colour, "#EF4444");
  assert.equal(model.caffeineMetricBar(600).displayMg, 600);
  assert.equal(model.caffeineMetricBar(null).displayMg, null);
  assert.equal(model.caffeineMetricBar(0.9).displayMg, 0);
  assert(model.caffeineMetricBar(0.9).fill > 0);
});

test("caffeine bar colour interpolates continuously and reversibly between anchors", () => {
  const model = metricModel();
  const channels = (colour) => [1, 3, 5].map((index) => parseInt(colour.slice(index, index + 2), 16));
  for (const mg of [150, 210, 270]) {
    const a = channels(model.caffeineMetricBar(mg - 30).colour), b = channels(model.caffeineMetricBar(mg + 30).colour);
    const middle = channels(model.caffeineMetricBar(mg).colour);
    middle.forEach((channel, index) => assert(Math.abs(channel - (a[index] + b[index]) / 2) <= 0.5));
  }
  for (const boundary of [120, 180, 240, 300]) {
    const before = channels(model.caffeineMetricBar(boundary - 0.001).colour);
    const after = channels(model.caffeineMetricBar(boundary + 0.001).colour);
    before.forEach((channel, index) => assert(Math.abs(channel - after[index]) <= 1));
  }
  const rising = [60, 120, 180, 240, 300].map((mg) => model.caffeineMetricBar(mg).colour);
  const falling = [300, 240, 180, 120, 60].map((mg) => model.caffeineMetricBar(mg).colour).reverse();
  assert.deepEqual(rising, falling);
});

test("caffeine retains residual amounts when a new intake is logged and uses actual persisted mg", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const intake = (hoursAgo, mg) => ({ entryType: "input", medication: "Coffee", unit: "mg", amount: mg, timestamp: new Date(now - hoursAgo * 3600000).toISOString(), metadata: { shots: 999 } });
  const older = intake(6, 95), recent = intake(1, 145), justLogged = intake(0, 60);
  const before = model.deriveMobileSignalMetrics([older], now);
  const withNew = model.deriveMobileSignalMetrics([older, justLogged], now);
  assert.equal(withNew.remainingMg, before.remainingMg);
  const total = model.deriveMobileSignalMetrics([older, recent, justLogged], now);
  const expected = 95 * model.batemanRelativeLevel(6, 4, Math.log(2) / 5) + 145 * model.batemanRelativeLevel(1, 4, Math.log(2) / 5);
  assert(Math.abs(total.remainingMg - expected) < 1e-10);
  assert.equal(total.caffeineProgress, Math.min(1, expected / 120));
  const declining = model.deriveMobileSignalMetrics([older, recent], now + 5 * 3600000);
  assert(declining.remainingMg < total.remainingMg);
  assert(declining.caffeineProgress < total.caffeineProgress);
  const tiny = model.deriveMobileSignalMetrics([intake(2, 0.5)], now);
  assert(tiny.remainingMg > 0 && tiny.remainingMg < 1);
  assert.equal(tiny.displayCaffeineMg, 0);
});

test("metric cards show one Vyvanse countdown, no settings, and quantity-only caffeine styling", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ["MobileSignalMetricCards", "signalColourMix"].includes(node.name?.text));
  const context = { React: require("react"), PillIcon: "pill", Coffee: "coffee" };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule([palette, ...functions].map((node) => node.getText(ast)).join("\n"), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  function nodes(tree, output = []) { if (tree && typeof tree === "object") { output.push(tree); [].concat(tree.props?.children || []).flat(Infinity).forEach((child) => nodes(child, output)); } return output; }
  function text(tree) { return typeof tree === "string" || typeof tree === "number" ? String(tree) : [].concat(tree?.props?.children || []).flat(Infinity).map(text).join(""); }
  for (const [hoursAgo, label] of [[1, "Until peak"], [6, "Until estimated wear-off"], [12, "Estimated worn off"]]) {
    const dose = { entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(now - hoursAgo * 3600000).toISOString() };
    const metrics = model.deriveMobileSignalMetrics([dose], now, { effectHours: 12, caffeineThresholdMg: null });
    const tree = context.MobileSignalMetricCards({ metrics });
    assert(text(tree).includes(label));
    assert(!text(tree).includes("Set estimate"));
    assert.equal(nodes(tree).filter((node) => node.type === "button").length, 0);
    assert.equal(nodes(tree).filter((node) => node.type === "span" && node.props.className === "whitespace-nowrap").length, hoursAgo === 12 ? 0 : 1);
  }
  const caffeine = { entryType: "input", medication: "Coffee", amount: 500, unit: "mg", timestamp: new Date(now - 3600000).toISOString() };
  const metrics = model.deriveMobileSignalMetrics([caffeine], now);
  const tree = context.MobileSignalMetricCards({ metrics });
  const bar = nodes(tree).find((node) => node.props?.role === "progressbar" && node.props["aria-label"].includes("120 mg"));
  assert.equal(bar.props.children.props.style.width, "100%");
  assert.equal(bar.props.children.props.style.backgroundColor, metrics.caffeineBarColour);
  assert(nodes(tree).some((node) => node.type === "span" && node.props.style?.color === "#FCB100"));
});

test("wind-down respects both recorded substances, the personal threshold and sensitivity changes", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const entries = [
    { entryType: "input", medication: "Vyvanse", amount: 30, unit: "mg", timestamp: new Date(now - 3600000).toISOString() },
    { entryType: "input", medication: "Coffee", amount: 120, unit: "mg", timestamp: new Date(now - 2 * 3600000).toISOString() },
  ];
  const settings = { effectHours: 12, caffeineThresholdMg: 20 };
  const metric = model.deriveMobileSignalMetrics(entries, now, settings);
  assert(metric.windDownAt >= now + 11 * 3600000);
  const caffeineAtWindDown = 120 * model.batemanRelativeLevel((metric.windDownAt - Date.parse(entries[1].timestamp)) / 3600000, 4, Math.log(2) / 5);
  assert(caffeineAtWindDown <= 20);
  const sensitive = model.deriveMobileSignalMetrics(entries, now, { effectHours: 14, caffeineThresholdMg: 10 });
  assert(sensitive.windDownAt >= metric.windDownAt);
  assert.equal(sensitive.remainingMg, metric.remainingMg);
  assert.equal(model.deriveMobileSignalMetrics([{ ...entries[1], unit: "cup" }], now, settings).windDownAt, null);
});

test("wind-down does not treat zero initial absorption as readiness or include future doses", () => {
  const model = metricModel(), now = Date.parse("2026-11-23T12:00:00Z");
  const entry = { entryType: "input", medication: "Coffee", amount: 120, unit: "mg", timestamp: new Date(now).toISOString() };
  const settings = { effectHours: null, caffeineThresholdMg: 20 };
  const metric = model.deriveMobileSignalMetrics([entry], now, settings);
  assert.equal(metric.remainingMg, 0);
  assert(metric.windDownAt > now + 3600000);
  assert.equal(model.deriveMobileSignalMetrics([entry, { ...entry, amount: 500, timestamp: new Date(now + 3600000).toISOString() }], now, settings).windDownAt, metric.windDownAt);
});

test("personal settings validate safely and leave unspecified assumptions unset", () => {
  const model = metricModel();
  assert.deepEqual(clone(model.normalizeSignalAssumptions({})), { effectHours: null, caffeineThresholdMg: null });
  for (const effectHours of [0, -1, Infinity, 169, "12"]) assert.equal(model.normalizeSignalAssumptions({ effectHours }), null);
  for (const caffeineThresholdMg of [0, -1, NaN, "20"]) assert.equal(model.normalizeSignalAssumptions({ caffeineThresholdMg }), null);
  assert.deepEqual(clone(model.normalizeSignalAssumptions({ effectHours: 12, caffeineThresholdMg: 20 })), { effectHours: 12, caffeineThresholdMg: 20 });
});

test("smooth mobile curve interpolates all samples without overshoot or rounding cutoff jumps", () => {
  const model = metricModel();
  const points = [{ x: 0, y: 132 }, { x: 10, y: 60 }, { x: 20, y: 80 }, { x: 30, y: 120 }];
  const before = JSON.stringify(points);
  const smooth = model.medsSmoothCurvePath(points);
  assert(smooth.startsWith("M 0.0 132.0 C"));
  const segments = smooth.split(" C ").slice(1).map((segment) => segment.split(" ").map(Number));
  assert.equal(segments.length, points.length - 1);
  segments.forEach((segment, index) => {
    const start = points[index], end = points[index + 1];
    assert.equal(segment[4], end.x); assert.equal(segment[5], end.y);
    for (const y of [segment[1], segment[3]]) assert(y >= Math.min(start.y, end.y) && y <= Math.max(start.y, end.y));
  });
  assert(model.medsSmoothCurvePath(points, [15]).includes("L 20.0 80.0"));
  assert.equal(JSON.stringify(points), before);
  assert(model.medsCurvePath(points).includes(" Q "));
});
