const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");

process.env.TZ = "Europe/Madrid";
const clone = (value) => JSON.parse(JSON.stringify(value));
function loadModule(filename, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Date, Number, console: { warn() {} }, require(id) {
    assert(id in dependencies, `Unexpected dependency ${id}`);
    return dependencies[id];
  } });
  return exports;
}
const types = loadModule("../taskStore/taskTypes.ts");
const pause = loadModule("timeLogPause.ts", { "../taskStore/taskTypes": types });
const openLog = () => ({ id: crypto.randomUUID(), taskId: crypto.randomUUID(), date: "2026-11-21", startTime: "09:00", endDate: null, hours: null, note: "Original note" });
const at = (time) => new Date(`2026-11-21T${time}:00+01:00`);
function closed(log, endDate, endTime) {
  const working = pause.calculateTimeLogWorkingDuration(log, endDate, endTime);
  assert(working);
  return { ...log, ...working, pausedAt: null, endDate, endTime };
}

function database(log = openLog(), { migrated = true } = {}) {
  const scope = "TEST-LOGGER";
  const rowFromLog = (value) => ({
    id: value.id, sync_code: scope, task_id: value.taskId || null, date: value.date,
    start_time: value.startTime ? value.startTime + ":00" : null, end_date: value.endDate ?? null,
    end_time: value.endTime ? value.endTime + ":00" : null, hours: value.hours, note: value.note,
    ...(migrated ? { paused_at: value.pausedAt ?? null, paused_seconds: value.pausedSeconds ?? 0 } : {}),
  });
  const rows = new Map([[log.id, rowFromLog(log)]]);
  const state = { writes: [], beforeMutation: null, fail: false, loseResponse: false };
  const supabase = { from(table) {
    assert.equal(table, "time_logs");
    let action = "read", payload, columns = "", filters = [];
    const query = {
      select(value) { columns = value; return query; },
      returns() { return query; }, order() { return query; },
      eq(column, value) { filters.push([column, value]); return query; },
      is(column, value) { filters.push([column, value]); return query; },
      update(value) { action = "update"; payload = value; return query; },
      delete() { action = "delete"; return query; },
      upsert(value) { action = "upsert"; payload = value; return query; },
      async maybeSingle() { return execute(true); },
      then(resolve, reject) { return Promise.resolve().then(() => execute(false)).then(resolve, reject); },
    };
    function execute(single) {
      if (!migrated && (columns.includes("paused_") || (payload && Object.keys(payload).some((key) => key.startsWith("paused_"))))) {
        return { data: null, error: { code: "42703", message: "column time_logs.paused_at does not exist" } };
      }
      if (action !== "read" && state.beforeMutation) { const hook = state.beforeMutation; state.beforeMutation = null; hook(rows); }
      if (action !== "read" && state.fail) return { data: null, error: { message: "Mock failure" } };
      const matching = [...rows.values()].filter((row) => filters.every(([column, value]) => row[column] === value));
      if (action === "upsert") { rows.set(payload.id, { ...rows.get(payload.id), ...clone(payload) }); state.writes.push(clone(payload)); }
      if (action === "update") for (const row of matching) { Object.assign(row, clone(payload)); state.writes.push(clone(row)); }
      if (action === "delete") for (const row of matching) { rows.delete(row.id); state.writes.push({ deleted: row.id }); }
      if (action !== "read" && state.loseResponse) { state.loseResponse = false; throw new Error("Connection lost after commit"); }
      const data = matching.map((row) => Object.fromEntries(columns.split(",").filter(Boolean).map((column) => [column, row[column]])));
      return { data: single ? data[0] ?? null : data, error: null };
    }
    return query;
  } };
  const store = loadModule("supabaseTimeLogStore.ts", {
    "@/lib/supabase": { supabase }, "../taskStore/taskTypes": types, "./timeLogPause": pause,
  });
  return { store, rows, state, scope, id: log.id };
}

test("Pause retains UUID, null hours, and minute-precision pause state", () => {
  const log = openLog();
  const paused = pause.toggleTimeLogPause(log, new Date("2026-11-21T10:00:49+01:00"));
  assert.equal(paused.id, log.id);
  assert.equal(paused.pausedAt, at("10:00").toISOString());
  assert.equal(paused.pausedSeconds, 0);
  assert.equal(paused.hours, null);
  assert(types.isOpenTimeLog(paused));
  assert(!types.isClosedTimeLog(paused));
  assert(pause.isPausedTimeLog(paused));
});

test("Resume accumulates pauses and continues the same open session", () => {
  const log = openLog();
  const resumed = pause.toggleTimeLogPause(pause.toggleTimeLogPause(log, at("10:00")), at("10:30"));
  assert.equal(resumed.id, log.id);
  assert.equal(resumed.pausedAt, null);
  assert.equal(resumed.pausedSeconds, 1800);
  assert.equal(pause.calculateTimeLogWorkingDuration(resumed, log.date, "12:00").hours, 2.5);
});

test("End while paused freezes work even when the end is much later", () => {
  const paused = pause.toggleTimeLogPause(openLog(), at("10:00"));
  assert.equal(closed(paused, paused.date, "10:00").hours, 1);
  const end = closed(paused, paused.date, "16:00");
  assert.equal(end.hours, 1);
  assert.equal(end.pausedSeconds, 21600);
  assert.equal(end.pausedAt, null);
  assert(types.isClosedTimeLog(end));
});

test("multiple pauses exclude exactly their combined duration", () => {
  let log = openLog();
  for (const time of ["10:00", "10:15", "11:00", "11:45"]) log = pause.toggleTimeLogPause(log, at(time));
  assert.equal(log.pausedSeconds, 3600);
  assert.equal(closed(log, log.date, "12:00").hours, 2);
});

test("overnight and multi-day pauses use full timestamps", () => {
  const log = { ...openLog(), startTime: "23:00" };
  const paused = pause.toggleTimeLogPause(log, new Date("2026-11-21T23:30:00+01:00"));
  const resumed = pause.toggleTimeLogPause(paused, new Date("2026-11-22T00:30:00+01:00"));
  assert.equal(closed(resumed, "2026-11-22", "01:00").hours, 1);
  assert.equal(closed(paused, "2026-11-23", "01:00").hours, 0.5);
});

test("zero or negative work is rejected rather than inventing positive logged hours", () => {
  const log = openLog();
  assert.equal(pause.toggleTimeLogPause(log, at("08:59")), null);
  const paused = pause.toggleTimeLogPause(log, at("09:00"));
  assert.equal(pause.calculateTimeLogWorkingDuration(paused, log.date, "10:00"), null);
  assert.equal(pause.toggleTimeLogPause(pause.toggleTimeLogPause(log, at("10:00")), at("09:59")), null);
  assert.equal(pause.calculateTimeLogWorkingDuration({ ...log, pausedSeconds: 999999 }, log.date, "10:00"), null);
});

test("legacy logs retain the exact original duration calculation", () => {
  const log = { ...openLog(), startTime: "14:00" };
  assert.equal(pause.calculateTimeLogWorkingDuration(log, log.date, "16:30").hours, 2.5);
  assert.equal(pause.calculateTimeLogWorkingDuration({ ...log, pausedAt: null, pausedSeconds: 0 }, log.date, "16:30").hours, 2.5);
  const durationOnly = { ...openLog(), startTime: undefined, hours: 25.0001 };
  assert(types.isClosedTimeLog(durationOnly));
  assert.equal(durationOnly.hours, 25.0001);
});

test("pause-aware duration remains correct across a Madrid DST transition", () => {
  const log = { ...openLog(), date: "2026-10-25", startTime: "01:00" };
  const paused = pause.toggleTimeLogPause(log, new Date("2026-10-25T01:30:00+02:00"));
  const resumed = pause.toggleTimeLogPause(paused, new Date("2026-10-25T03:30:00+01:00"));
  assert.equal(resumed.pausedSeconds, 10800);
  assert.equal(closed(resumed, log.date, "04:00").hours, 1);
});

test("confirmed Pause and refresh load the same persisted session state", async () => {
  const db = database();
  const first = (await db.store.loadTimeLogs(db.scope)).logs[0];
  const result = await db.store.updateTimeLogIfUnchanged(db.scope, first, pause.toggleTimeLogPause(first, at("10:00")));
  assert.equal(result.ok, true);
  const loaded = await db.store.loadTimeLogs(db.scope);
  assert(loaded.pauseSupported);
  assert.equal(loaded.logs[0].id, first.id);
  assert(pause.isPausedTimeLog(loaded.logs[0]));
  assert.equal(loaded.logs[0].pausedAt, at("10:00").toISOString());
});

test("stale device cannot overwrite a confirmed Pause", async () => {
  const db = database();
  const original = (await db.store.loadTimeLogs(db.scope)).logs[0];
  const first = await db.store.updateTimeLogIfUnchanged(db.scope, original, pause.toggleTimeLogPause(original, at("10:00")));
  assert(first.ok);
  const stale = await db.store.updateTimeLogIfUnchanged(db.scope, original, { ...original, note: "Stale Adjust" });
  assert.equal(stale.reason, "conflict");
  assert.equal(db.state.writes.length, 1);
  assert.equal(db.rows.get(original.id).note, "Original note");
});

test("stale Resume cannot overwrite a newer resume or a later pause", async () => {
  const db = database(pause.toggleTimeLogPause(openLog(), at("10:00")));
  const paused = (await db.store.loadTimeLogs(db.scope)).logs[0];
  const first = await db.store.updateTimeLogIfUnchanged(db.scope, paused, pause.toggleTimeLogPause(paused, at("10:30")));
  assert(first.ok);
  const again = await db.store.updateTimeLogIfUnchanged(db.scope, first.log, pause.toggleTimeLogPause(first.log, at("11:00")));
  assert(again.ok);
  const stale = await db.store.updateTimeLogIfUnchanged(db.scope, paused, pause.toggleTimeLogPause(paused, at("11:30")));
  assert.equal(stale.reason, "conflict");
  assert.equal(db.rows.get(paused.id).paused_seconds, 1800);
});

test("change between snapshot read and update is rejected atomically", async () => {
  const db = database();
  const log = (await db.store.loadTimeLogs(db.scope)).logs[0];
  db.state.beforeMutation = (rows) => { rows.get(log.id).note = "Other device updated while request was in flight"; };
  const result = await db.store.updateTimeLogIfUnchanged(db.scope, log, pause.toggleTimeLogPause(log, at("10:00")));
  assert.equal(result.reason, "conflict");
  assert.equal(db.state.writes.length, 0);
  assert.equal(db.rows.get(log.id).paused_at, null);
});

test("stale End now and Delete do not close or remove a changed session", async () => {
  const db = database();
  const log = (await db.store.loadTimeLogs(db.scope)).logs[0];
  const paused = await db.store.updateTimeLogIfUnchanged(db.scope, log, pause.toggleTimeLogPause(log, at("10:00")));
  assert(paused.ok);
  assert.equal((await db.store.updateTimeLogIfUnchanged(db.scope, log, closed(log, log.date, "12:00"))).reason, "conflict");
  assert.equal((await db.store.deleteTimeLogIfUnchanged(db.scope, log)).reason, "conflict");
  assert.equal(db.rows.size, 1);
  assert.equal(db.rows.get(log.id).hours, null);
});

test("lost response cannot add the same pause twice on retry", async () => {
  const db = database(pause.toggleTimeLogPause(openLog(), at("10:00")));
  const paused = (await db.store.loadTimeLogs(db.scope)).logs[0];
  const next = pause.toggleTimeLogPause(paused, at("10:30"));
  db.state.loseResponse = true;
  assert.equal((await db.store.updateTimeLogIfUnchanged(db.scope, paused, next)).reason, "error");
  assert.equal((await db.store.updateTimeLogIfUnchanged(db.scope, paused, next)).reason, "conflict");
  assert.equal((await db.store.loadTimeLogs(db.scope)).logs[0].pausedSeconds, 1800);
  assert.equal(db.state.writes.length, 1);
});

test("failed Pause leaves the row unchanged", async () => {
  const db = database();
  const original = clone(db.rows.get(db.id));
  const log = (await db.store.loadTimeLogs(db.scope)).logs[0];
  db.state.fail = true;
  assert.equal((await db.store.updateTimeLogIfUnchanged(db.scope, log, pause.toggleTimeLogPause(log, at("10:00")))).reason, "error");
  assert.deepEqual(db.rows.get(db.id), original);
});

test("ending while paused saves the net duration on the same UUID and reloads correctly", async () => {
  const db = database(pause.toggleTimeLogPause(openLog(), at("10:00")));
  const log = (await db.store.loadTimeLogs(db.scope)).logs[0];
  const result = await db.store.updateTimeLogIfUnchanged(db.scope, log, closed(log, log.date, "12:00"));
  assert(result.ok);
  const loaded = (await db.store.loadTimeLogs(db.scope)).logs[0];
  assert.equal(loaded.id, log.id);
  assert.equal(loaded.hours, 1);
  assert.equal(loaded.pausedSeconds, 7200);
  assert.equal(loaded.pausedAt, null);
  assert(types.isClosedTimeLog(loaded));
});

test("missing migration retains legacy loads and edits but cannot silently save a pause", async () => {
  const db = database(openLog(), { migrated: false });
  const loaded = await db.store.loadTimeLogs(db.scope);
  assert(loaded.ok);
  assert.equal(loaded.pauseSupported, false);
  const log = loaded.logs[0];
  assert.equal((await db.store.updateTimeLogIfUnchanged(db.scope, log, pause.toggleTimeLogPause(log, at("10:00")))).reason, "unavailable");
  assert((await db.store.updateTimeLogIfUnchanged(db.scope, log, { ...log, note: "Updated note" })).ok);
  assert.equal(db.rows.get(log.id).note, "Updated note");
});

test("wrong sync scope and deleted rows cannot be updated or resurrected", async () => {
  const db = database();
  const log = (await db.store.loadTimeLogs(db.scope)).logs[0];
  assert.equal((await db.store.updateTimeLogIfUnchanged("WRONG", log, pause.toggleTimeLogPause(log, at("10:00")))).reason, "conflict");
  db.rows.delete(log.id);
  assert.equal((await db.store.updateTimeLogIfUnchanged(db.scope, log, pause.toggleTimeLogPause(log, at("10:00")))).reason, "conflict");
  assert.equal(db.rows.size, 0);
});

const main = fs.readFileSync(path.join(__dirname, "../MinimalTaskTracker.tsx"), "utf8");
const ast = ts.createSourceFile("main.tsx", main, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function sourceFunction(name) {
  let result;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert(result, `Missing ${name}`); return result;
}

test("normalization and backup JSON preserve paused and legacy sessions without changing hours", () => {
  const context = { ...types, ...pause, uid: crypto.randomUUID };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(sourceFunction("normalizeTimeLogs"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const paused = pause.toggleTimeLogPause(openLog(), at("10:00"));
  const historical = { ...openLog(), startTime: undefined, hours: 25.0001 };
  const snapshot = clone({ createdAt: at("11:00").toISOString(), tasks: [], timeLogs: [paused, historical] });
  const logs = context.normalizeTimeLogs(snapshot.timeLogs);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].pausedAt, paused.pausedAt);
  assert.equal(logs[1].pausedSeconds, 0);
  assert.equal(logs[1].hours, 25.0001);
  assert.equal(context.normalizeTimeLogs([{ ...paused, pausedSeconds: -1 }]).length, 0);
  assert.equal(context.normalizeTimeLogs([{ ...historical, pausedAt: paused.pausedAt }]).length, 0);
});

test("new logs and legacy duration-only records retain the existing upsert representation", async () => {
  const db = database();
  const durationOnly = { ...openLog(), startTime: undefined, hours: 1.25 };
  assert(await db.store.saveTimeLog(db.scope, durationOnly));
  const loaded = (await db.store.loadTimeLogs(db.scope)).logs.find((log) => log.id === durationOnly.id);
  assert.equal(loaded.hours, 1.25);
  assert.equal(loaded.pausedSeconds, 0);
});

test("migration is additive and contains no UPDATE, DELETE or DROP statements", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261121000000_add_time_log_pause_state.sql"), "utf8");
  assert(sql.includes("add column if not exists paused_at timestamptz null"));
  assert(sql.includes("paused_seconds numeric not null default 0"));
  assert(!/\b(update|delete|drop|truncate)\b/i.test(sql));
});

function handlerHarness(log, update) {
  const state = { logs: [log], errors: [], closed: false, updates: 0 };
  class Clock extends Date {
    constructor(...args) { if (!args.length) super(at("12:00").getTime()); else super(...args); }
  }
  const context = {
    ...types, ...pause, Date: Clock, console: { warn() {} },
    SYNC_CODE: "TEST-LOGGER", timeLogPauseSupported: true,
    openSessionActionLock: { current: false }, logSubmitLock: { current: false }, pendingLogId: { current: log.id },
    updateTimeLogIfUnchanged: update, saveSupabaseTimeLog: async () => false,
    setTimeLogs: (callback) => { state.logs = callback(state.logs); state.updates++; },
    setLoggerActionError: (error) => state.errors.push(error), setLogOpen: (value) => { state.closed = !value; },
    setPausingOpenLogId() {}, setEndingOpenLogId() {}, setEditingLogId() {}, setEditingLogSnapshot() {}, setPlannerLogSourceEventId() {},
    localDateISO: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    localTimeInput: (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
  vm.createContext(context);
  const functions = ["pauseOrResumeTimeLog", "endOpenTimeLogNow", "persistTimeLogDraft"].map(sourceFunction).join("\n");
  vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return { context, state };
}

test("UI Pause waits for persistence and prevents duplicate or competing End requests", async () => {
  let release, calls = 0, submitted;
  const log = openLog();
  const ui = handlerHarness(log, async (_scope, _expected, next) => {
    calls++; submitted = next;
    return new Promise((resolve) => { release = resolve; });
  });
  const pending = ui.context.pauseOrResumeTimeLog(log);
  await ui.context.pauseOrResumeTimeLog(log);
  await ui.context.endOpenTimeLogNow(log);
  assert.equal(calls, 1);
  assert.equal(ui.state.updates, 0);
  assert.equal(ui.state.logs[0].pausedAt, undefined);
  release({ ok: true, log: submitted });
  await pending;
  assert.equal(ui.state.updates, 1);
  assert(pause.isPausedTimeLog(ui.state.logs[0]));
  assert.equal(ui.context.openSessionActionLock.current, false);
});

test("UI conflict preserves the session and asks for reload", async () => {
  const log = openLog();
  const ui = handlerHarness(log, async () => ({ ok: false, reason: "conflict" }));
  await ui.context.pauseOrResumeTimeLog(log);
  assert.equal(ui.state.updates, 0);
  assert.equal(ui.state.logs[0], log);
  assert(ui.state.errors.at(-1).includes("another device"));
  assert.equal(ui.context.openSessionActionLock.current, false);
});

test("UI End now while paused uses the same UUID and net working hours", async () => {
  const log = pause.toggleTimeLogPause(openLog(), at("10:00"));
  const ui = handlerHarness(log, async (_scope, expected, next) => {
    assert.equal(expected.id, next.id);
    assert.equal(next.hours, 1);
    assert.equal(next.pausedSeconds, 7200);
    assert.equal(next.pausedAt, null);
    return { ok: true, log: next };
  });
  await ui.context.endOpenTimeLogNow(log);
  assert(types.isClosedTimeLog(ui.state.logs[0]));
  assert.equal(ui.state.logs[0].hours, 1);
});

test("conflicted Adjust and failed new saves retain the editor, UUID and authoritative data", async () => {
  const log = openLog();
  const ui = handlerHarness(log, async () => ({ ok: false, reason: "conflict" }));
  assert.equal(await ui.context.persistTimeLogDraft({ ...log, note: "User draft" }, log, null), false);
  assert.equal(ui.state.updates, 0);
  assert.equal(ui.state.closed, false);
  assert.equal(ui.context.pendingLogId.current, log.id);
  assert.equal(await ui.context.persistTimeLogDraft({ ...log, note: "User draft" }, null, null), false);
  assert.equal(ui.state.updates, 0);
  assert.equal(ui.state.closed, false);
  assert.equal(ui.context.pendingLogId.current, log.id);
});

test("old backup pause defaults are compatible and malformed pause metadata is rejected", () => {
  assert.deepEqual(clone(pause.normalizeTimeLogPause({})), { pausedAt: null, pausedSeconds: 0 });
  for (const value of [-1, Infinity, NaN, "", true, {}, []]) {
    assert.equal(pause.normalizeTimeLogPause({ pausedSeconds: value }), null);
  }
  assert.equal(pause.normalizeTimeLogPause({ pausedAt: "not a date" }), null);
});

test("existing Day/Week block positions remain based on full start/end spans", () => {
  const segmentation = sourceFunction("loggerHourlySegments");
  assert(!segmentation.includes("pausedAt"));
  assert(!segmentation.includes("pausedSeconds"));
  assert(segmentation.includes("log.startTime"));
  assert(segmentation.includes("log.endTime"));
});
