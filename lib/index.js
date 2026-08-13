import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
/** O(1) membership. */
const MANAGEABLE = /* @__PURE__ */ new Set([
	"ui-deliverables",
	"ui-jobs",
	"ui-goal",
	"ui-message-feedback",
	"ui-model-selection",
	"ui-agent-preset",
	"ui-commands",
	"ui-skill",
	"ui-subagent",
	"ui-trajectory"
]);
/**
* Explicitly locked core / infrastructure ids, listed for an accurate
* "core" reason in the UI. This list never grants anything: manageability
* comes from MANAGEABLE_IDS alone, and any id absent from both lists is
* still locked (reason "unlisted"). Unknown ids default to locked.
*/
const LOCKED_IDS = /* @__PURE__ */ new Set([
	"loader",
	"include",
	"group",
	"timer",
	"hmr",
	"modules",
	"connection",
	"api-remotes",
	"client-runtime",
	"cordis-client-runner",
	"client-hmr",
	"api-gateway",
	"webserver",
	"web-runtime",
	"web-startup",
	"ui-theme",
	"locale",
	"ui-layout",
	"ui-sidebar",
	"ui-settings",
	"ui-settings-general",
	"ui-settings-models",
	"ui-settings-plugins",
	"ui-settings-plugin-inventory",
	"ui-conversation",
	"ui-input-trigger",
	"ui-tool",
	"plugin-inventory",
	"storage",
	"storage-json",
	"storage-domain",
	"session",
	"session-projection-cache",
	"session-query-sqlite",
	"session-stats",
	"session-log-download",
	"workspace",
	"code-runtime",
	"message-feedback",
	"directory-picker"
]);
/**
* Ids this plugin itself owns. A plugin must never toggle itself off: that
* would unload the manager's API while its persistence has already run.
* (The package is not `@deepseek-ai/*`, so the module check below would
* reject it anyway; the explicit id check keeps the reason accurate.)
*/
const SELF_IDS = /* @__PURE__ */ new Set(["builtin-toggles"]);
/** Classify one loader entry against the policy. */
function classifyEntry(entry) {
	if (SELF_IDS.has(entry.id)) return {
		...entry,
		manageable: false,
		reason: "self"
	};
	if (!entry.name.startsWith("@deepseek-ai/")) return {
		...entry,
		manageable: false,
		reason: "external"
	};
	if (MANAGEABLE.has(entry.id)) return {
		...entry,
		manageable: true
	};
	return {
		...entry,
		manageable: false,
		reason: LOCKED_IDS.has(entry.id) ? "core" : "unlisted"
	};
}
/**
* Server-side gate for POST /api/builtin-toggles/<id>. Re-checks every rule
* on every request — the UI hiding buttons is never the security boundary.
* Order matters: the id must be allowlisted before anything is looked up, so
* an unknown id can never probe the loader or the filesystem.
*/
function checkMutation(id, facts, body) {
	if (!MANAGEABLE.has(id)) return {
		ok: false,
		status: 403,
		code: "not_manageable",
		message: `builtin-toggles: ${id} is not on the manageable allowlist`
	};
	if (!isDisabledBody(body)) return {
		ok: false,
		status: 400,
		code: "invalid_body",
		message: "builtin-toggles: body must be a JSON object with a boolean \"disabled\" field"
	};
	if (facts === void 0) return {
		ok: false,
		status: 404,
		code: "not_found",
		message: `builtin-toggles: loader entry not found: ${id}`
	};
	if (!facts.name.startsWith("@deepseek-ai/")) return {
		ok: false,
		status: 403,
		code: "not_official",
		message: `builtin-toggles: ${id} is not an @deepseek-ai/* package`
	};
	if (SELF_IDS.has(facts.id)) return {
		ok: false,
		status: 403,
		code: "self",
		message: "builtin-toggles: the manager cannot toggle itself"
	};
	return { ok: true };
}
/** Narrow an unknown parsed JSON value to { disabled: boolean } (strict schema: no extra keys). */
function parseDisabledBody(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const record = value;
	const keys = Object.keys(record);
	if (keys.length !== 1 || keys[0] !== "disabled") return null;
	const disabled = record.disabled;
	if (typeof disabled !== "boolean") return null;
	return { disabled };
}
function isDisabledBody(value) {
	return parseDisabledBody(value) !== null;
}
//#endregion
//#region src/profile-patch.ts
/**
* Minimal, conservative textual writer for the profile patch layer
* (`$DSH_HOME/profiles/<profile>/cordis.patch.yml`).
*
* The official config file may carry `!!js` expressions, comments, and user
* structure we do not understand, so a generic parse → stringify round trip
* is forbidden. This writer only:
*
* - recognizes TOP-LEVEL `- id: <exact id>` rows (column 0); a nested id
*   inside an `insert:` block is never touched;
* - adds or replaces only that row's OWN `disabled:` field (at the row's
*   observed child indentation);
* - leaves `config`, `name`, other ids, comments, `!!js` and the original
*   line endings untouched;
* - appends a minimal `- id: <id>` / `  disabled: …` override when the row
*   does not exist yet (and refuses when the id already appears nested —
*   creating a duplicate patch row is never safe);
* - writes through a sibling temp file + atomic rename, with an optimistic
*   concurrency re-read immediately before the rename: an external edit
*   since our first read refuses the write instead of being overwritten.
*
* Line endings: the EOL style is detected from the file's first newline and
* used for inserted lines; existing lines are never rewritten.
*/
/** Thrown when the patch file changed between our read and our write. */
var ConcurrentEditError = class extends Error {
	constructor(file) {
		super(`builtin-toggles: ${file} changed concurrently; refusing to overwrite`);
		this.name = "ConcurrentEditError";
	}
};
/** Thrown when the patch file is in a state we refuse to mutate. */
var PatchError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "PatchError";
	}
};
/** EOL style of the file, from its first newline; defaults to LF. */
function detectEol(content) {
	return content.indexOf("\r\n") === -1 ? "\n" : "\r\n";
}
/** Whether a line is a top-level list item (`- …` at column 0). */
function isTopLevelItem(line) {
	return /^-\s/.test(line);
}
/** Whether a line is column-0 content (not indented, not blank, not a comment). */
function isTopLevelContent(line) {
	return line.length > 0 && !/^\s/.test(line) && !line.startsWith("#");
}
/** Parse the exact id of a top-level `- id: …` row; null for anything else. */
function topLevelRowId(line) {
	if (!isTopLevelItem(line)) return null;
	const match = /^-\s+id:\s*(\S+)/.exec(line);
	return match === null ? null : match[1];
}
/**
* Render `content` with the top-level override row for `id` set to
* `disabled`. Pure: no filesystem access, no parsing of unknown structure.
*/
function renderDisabledPatch(content, id, disabled) {
	const eol = detectEol(content);
	const lines = [...content.length === 0 ? [] : content.split(/\r?\n/)];
	let rowIndex = -1;
	for (let i = 0; i < lines.length; i += 1) if (topLevelRowId(lines[i]) === id) {
		rowIndex = i;
		break;
	}
	const value = String(disabled);
	const defaultChildIndent = 2;
	if (rowIndex !== -1) {
		let subtreeEnd = lines.length;
		for (let i = rowIndex + 1; i < lines.length; i += 1) {
			const line = lines[i];
			if (isTopLevelItem(line) || isTopLevelContent(line)) {
				subtreeEnd = i;
				break;
			}
		}
		let childIndent = defaultChildIndent;
		for (let i = rowIndex + 1; i < subtreeEnd; i += 1) {
			const line = lines[i];
			const trimmed = line.trimStart();
			if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
			childIndent = line.length - trimmed.length;
			break;
		}
		const indent = " ".repeat(childIndent);
		const disabledPattern = new RegExp(`^${indent}disabled:`);
		let disabledIndex = -1;
		for (let i = rowIndex + 1; i < subtreeEnd; i += 1) if (disabledPattern.test(lines[i])) {
			disabledIndex = i;
			break;
		}
		if (disabledIndex !== -1) {
			if (lines[disabledIndex].replace(disabledPattern, "").trim() === value) return {
				content,
				changed: false,
				createdRow: false
			};
			lines[disabledIndex] = `${indent}disabled: ${value}`;
		} else lines.splice(subtreeEnd, 0, `${indent}disabled: ${value}`);
		return {
			content: lines.join(eol),
			changed: true,
			createdRow: false
		};
	}
	const row = [`- id: ${id}`, `${" ".repeat(defaultChildIndent)}disabled: ${value}`];
	let flowIndex = -1;
	for (let i = 0; i < lines.length; i += 1) if (/^\[\]\s*$/.test(lines[i])) {
		flowIndex = i;
		break;
	}
	if (flowIndex !== -1) {
		lines.splice(flowIndex, 1, ...row);
		return {
			content: lines.join(eol),
			changed: true,
			createdRow: true
		};
	}
	if (lines.length === 0) lines.push(...row, "");
	else if (lines[lines.length - 1] === "") lines.splice(lines.length - 1, 0, ...row);
	else lines.push(...row);
	return {
		content: lines.join(eol),
		changed: true,
		createdRow: true
	};
}
/** Resolve `$DSH_HOME`, defaulting to `~/.dsh` when unset or blank. */
function dshHomeDir() {
	const env = process.env.DSH_HOME;
	return env !== void 0 && env.trim() !== "" ? env : join(homedir(), ".dsh");
}
/** The profile patch path this plugin persists to. */
function profilePatchPath(profile = "web") {
	return join(dshHomeDir(), "profiles", profile, "cordis.patch.yml");
}
/**
* Write `content` to `file` atomically: sibling temp file, fsync, rename.
* Never leaves a half-written target file behind.
*/
function writeTextAtomic(file, content) {
	const temp = `${file}.builtin-toggles-${process.pid}-${randomBytes(4).toString("hex")}.tmp`;
	writeFileSync(temp, content, "utf8");
	try {
		const fd = openForFsync(temp);
		fsyncFd(fd);
		closeFd(fd);
		renameSync(temp, file);
	} catch (error) {
		try {
			unlinkQuiet(temp);
		} catch {}
		throw error;
	}
}
function openForFsync(path) {
	return openSync(path, "r");
}
function fsyncFd(fd) {
	fsyncSync(fd);
}
function closeFd(fd) {
	closeSync(fd);
}
function unlinkQuiet(path) {
	unlinkSync(path);
}
const realDeps = {
	read: (file) => readFileSync(file, "utf8"),
	writeAtomic: writeTextAtomic
};
/**
* Persist one `disabled` override with optimistic concurrency:
* read → render → re-read → refuse on mismatch → atomic replace.
* @returns what changed; throws ConcurrentEditError / PatchError / ENOENT.
*/
function applyDisabledOverride(file, id, disabled, deps = realDeps) {
	if (!existsSync(file)) throw new PatchError(`builtin-toggles: profile patch missing: ${file}; refusing to create it implicitly`);
	const original = deps.read(file);
	const rendered = renderDisabledPatch(original, id, disabled);
	if (!rendered.changed) return {
		changed: false,
		createdRow: false
	};
	if (deps.read(file) !== original) throw new ConcurrentEditError(file);
	deps.writeAtomic(file, rendered.content);
	return {
		changed: true,
		createdRow: rendered.createdRow
	};
}
//#endregion
//#region src/mutate.ts
/**
* Mutation orchestration for POST /api/builtin-toggles/<id>.
*
* Pure of HTTP plumbing and of the real loader/filesystem — both are
* injected — so the whole decision tree (checks, runtime update, persistence,
* rollback, concurrency refusal) is unit-testable. The route handler in
* index.ts is only a thin adapter on top of this.
*
* Order of operations:
*   1. policy gate (allowlist → body schema → entry exists → official module
*      → not self); any refusal is a 4xx with zero mutation;
*   2. runtime update via `entry.update({ disabled })` (current session);
*   3. persist the same override into the profile patch (survives restart);
*   4. on any persistence failure, roll the runtime back to its previous own
*      `disabled` value and report the error — no half-applied state.
*/
function refuse(status, error, message) {
	return {
		status,
		body: {
			ok: false,
			error,
			message
		}
	};
}
/**
* Run one toggle. `rawBody` is the JSON-parsed request body (any shape).
* Never mutates on any refusal path.
*/
async function runToggle(deps, id, rawBody) {
	const body = parseDisabledBody(rawBody);
	const entry = deps.findEntry(id);
	const verdict = checkMutation(id, entry?.facts, body);
	if (!verdict.ok) return refuse(verdict.status, verdict.code, verdict.message);
	const disabled = body.disabled;
	const previousOwn = entry.ownDisabled;
	try {
		await entry.update({ disabled });
	} catch (error) {
		return refuse(500, "runtime_update_failed", errorMessage(error, `loader entry update failed for ${id}`));
	}
	let persisted = false;
	try {
		persisted = deps.persist(deps.patchFile, id, disabled).changed;
	} catch (error) {
		const rollbackError = await rollbackRuntime(entry, previousOwn);
		if (rollbackError !== void 0) return refuse(500, "persist_failed", `persist failed (${errorMessage(error, "write error")}) and runtime rollback also failed (${rollbackError}); profile may be inconsistent`);
		if (error instanceof ConcurrentEditError) return refuse(409, "concurrent_edit", error.message);
		if (error instanceof PatchError) return refuse(500, "patch_refused", error.message);
		return refuse(500, "persist_failed", errorMessage(error, "failed to write profile patch"));
	}
	return {
		status: 200,
		body: {
			ok: true,
			id,
			disabled,
			runtime: true,
			persisted
		}
	};
}
/** Restore the entry's own disabled field; returns an error message on failure. */
async function rollbackRuntime(entry, previousOwn) {
	try {
		await entry.update({ disabled: previousOwn === void 0 ? null : previousOwn });
		return;
	} catch (error) {
		return errorMessage(error, "rollback failed");
	}
}
function errorMessage(error, fallback) {
	return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
//#endregion
//#region src/index.ts
/** Cordis plugin identity. */
const name = "builtin-toggles";
/** Services required from the web composition. */
const inject = ["webServer", "loader"];
/** The same-origin API prefix. */
const API_PREFIX = "/api/builtin-toggles";
/** Maximum accepted POST body. */
const MAX_BODY_BYTES = 4096;
/** Runtime mirror of the Cordis FiberState const enum (no runtime import). */
const FIBER_PHASE = {
	0: "pending",
	1: "loading",
	2: "active",
	3: "failed",
	4: null,
	5: "unloading"
};
/** Map a loader entry to its current Cordis phase, or null when unmounted. */
function fiberPhase(entry) {
	if (entry.fiber === void 0) return null;
	return FIBER_PHASE[entry.fiber.state] ?? null;
}
/** Facts the policy needs, projected from one loader entry. */
function entryFacts(entry) {
	return {
		id: entry.options.id,
		name: entry.options.name,
		disabled: entry.disabled,
		phase: fiberPhase(entry)
	};
}
/** Snapshot rows: manageable + official + self (external packages stay invisible). */
function buildSnapshot(entries) {
	const seen = /* @__PURE__ */ new Set();
	const plugins = [];
	for (const entry of entries) {
		if (entry.options.group) continue;
		if (typeof entry.options.name !== "string") continue;
		if (seen.has(entry.options.id)) continue;
		seen.add(entry.options.id);
		const classified = classifyEntry(entryFacts(entry));
		if (!classified.manageable && !classified.name.startsWith("@deepseek-ai/") && classified.reason !== "self") continue;
		plugins.push(classified);
	}
	return plugins;
}
function headerValue(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
function isLoopbackHostname(hostname) {
	return hostname === "localhost" || hostname === "::1" || hostname === "127.0.0.1" || hostname === "::ffff:127.0.0.1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}
/**
* Accept loopback requests outright; for LAN serving, require a same-origin
* browser marker (Origin matching Host). A rebound page carries an attacker
* Host here, and a cross-site fetch carries a mismatching Origin — both
* refuse. This is a defense-in-depth fence for a local UI manager, not auth.
*/
function isLocalRequest(req) {
	const host = headerValue(req.headers, "host");
	if (host === void 0) return false;
	let authority;
	try {
		authority = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (isLoopbackHostname(authority.hostname)) return true;
	const origin = headerValue(req.headers, "origin");
	if (origin === void 0) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}
function sendJson(res, status, body) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
}
function readBody(req, maxBytes) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > maxBytes) {
				reject(/* @__PURE__ */ new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
/** Wrap the loader's raw entries in the handle shape the orchestrator needs. */
function entryHandle(entry) {
	return {
		facts: entryFacts(entry),
		ownDisabled: entry.options.disabled ?? void 0,
		update: (options) => entry.update(options)
	};
}
function findEntryByShortId(ctx, id) {
	for (const entry of ctx.loader.entries()) {
		if (entry.options.group) continue;
		if (entry.options.id === id) return entry;
	}
}
/** Register the same-origin API; runs for the lifetime of the fiber. */
function apply(ctx) {
	ctx.effect(() => {
		return ctx.webServer.register({
			kind: "prefix",
			path: API_PREFIX,
			handler: async (req, res) => {
				if (!isLocalRequest(req)) {
					sendJson(res, 403, {
						ok: false,
						error: "forbidden",
						message: "builtin-toggles: untrusted request origin"
					});
					return;
				}
				const pathname = (req.url ?? "/").split("?")[0] ?? "/";
				const method = req.method ?? "GET";
				if (method === "GET" && pathname === "/api/builtin-toggles") {
					sendJson(res, 200, { plugins: buildSnapshot([...ctx.loader.entries()]) });
					return;
				}
				const match = /^\/api\/builtin-toggles\/([^/]+)$/.exec(pathname);
				if (method === "POST" && match !== null) {
					const id = decodeURIComponent(match[1]);
					let rawBody;
					try {
						const text = await readBody(req, MAX_BODY_BYTES);
						rawBody = text === null ? void 0 : JSON.parse(text);
					} catch {
						rawBody = void 0;
					}
					const result = await runToggle({
						patchFile: profilePatchPath("web"),
						findEntry: (targetId) => {
							const entry = findEntryByShortId(ctx, targetId);
							return entry === void 0 ? void 0 : entryHandle(entry);
						},
						persist: (file, targetId, disabled) => {
							return { changed: applyDisabledOverride(file, targetId, disabled).changed };
						}
					}, id, rawBody);
					sendJson(res, result.status, result.body);
					return;
				}
				sendJson(res, 404, {
					ok: false,
					error: "not_found",
					message: `builtin-toggles: no route for ${method} ${pathname}`
				});
			}
		});
	}, "builtin-toggles: same-origin API");
}
//#endregion
export { API_PREFIX, apply, buildSnapshot, inject, isLocalRequest, name };
