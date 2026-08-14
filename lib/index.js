import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
/** O(1) membership. */
const MANAGEABLE = /* @__PURE__ */ new Set([
	"ui-deliverables",
	"ui-jobs",
	"ui-goal",
	"ui-message-feedback",
	"ui-model-selection",
	"ui-agent-preset",
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
/** The module specifier that identifies an official built-in package. */
const OFFICIAL_PACKAGE_PREFIX = "@deepseek-ai/";
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
* - recognizes TOP-LEVEL `- id: <exact id>` rows (column 0) as the override
*   target; an id inside a nested `insert:` block is never edited in place;
* - adds or replaces only that row's OWN `disabled:` field (at the row's
*   observed child indentation);
* - leaves `config`, `name`, other ids, comments, `!!js` and the original
*   line endings untouched;
* - appends a minimal name-less `- id: <id>` / `  disabled: …` override when
*   the row does not exist. Official patch semantics merge an override's keys
*   onto the composed entry by id (a name-less row skips the Loader's
*   name-mismatch check), so this also correctly targets a row this same
*   file inserted earlier — the nested block stays byte-identical;
* - writes through a sibling temp file + atomic rename, with an optimistic
*   concurrency re-read immediately before the rename: an external edit
*   since our first read refuses the write instead of being overwritten.
*
* Line endings: the EOL style is detected from the file's first newline and
* used for inserted lines; existing lines are never rewritten.
*
* The read → render → verify → commit cycle runs under the official
* `@deepseek-ai/dsh-atomic-write` cross-process writer lock
* (`withFileLock`), and the commit itself is that package's
* `writeFileAtomic` (random-suffix sibling + rename). The optimistic
* concurrency re-read happens INSIDE the lock, immediately before the
* commit: an external edit since our locked read refuses the write instead
* of being overwritten, and two of our own writers can never interleave.
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
const realDeps = {
	read: (file) => readFileSync(file, "utf8"),
	writeAtomic: (file, content, mode) => writeFileAtomic(file, content, { mode }),
	lock: withFileLock
};
/**
* Persist one `disabled` override under the official writer lock, with
* optimistic concurrency: lock → read → render → re-read → refuse on
* mismatch → atomic replace. The re-read happens inside the lock so two of
* our own writers can never lose each other's committed content, and an
* external (non-locking) edit since our locked read refuses the write
* instead of being overwritten.
* @returns what changed; throws ConcurrentEditError / PatchError / fs errors.
*/
async function applyDisabledOverride(file, id, disabled, deps = realDeps) {
	if (!existsSync(file)) throw new PatchError(`builtin-toggles: profile patch missing: ${file}; refusing to create it implicitly`);
	const mode = statSync(file).mode & 511;
	return deps.lock(file, async () => {
		const original = deps.read(file);
		const rendered = renderDisabledPatch(original, id, disabled);
		if (!rendered.changed) return {
			changed: false,
			createdRow: false
		};
		if (deps.read(file) !== original) throw new ConcurrentEditError(file);
		await deps.writeAtomic(file, rendered.content, mode);
		return {
			changed: true,
			createdRow: rendered.createdRow
		};
	});
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
		persisted = (await deps.persist(deps.patchFile, id, disabled)).changed;
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
//#region src/evidence.ts
const BASE_REFERENCE = {
	source: "npm-published-patch",
	packageName: "@deepseek-ai/dsh-base",
	version: "0.1.0-rc.6",
	artifact: "cordis.patch.yml"
};
const WEB_REFERENCE = {
	source: "npm-published-patch",
	packageName: "@deepseek-ai/dsh-web-app",
	version: "0.1.0-rc.6",
	artifact: "cordis.patch.yml"
};
/**
* Exact composition from the published rc.6 base and Web cordis patches.
* This is a package-patch provenance baseline. It is intentionally not
* labelled an upstream source snapshot or a live Loader snapshot.
*/
const REVIEWED_RC6_ROWS = [
	[
		"timer",
		"@deepseek-ai/cordis-plugin-timer",
		"@deepseek-ai/dsh-base"
	],
	[
		"hmr",
		"@deepseek-ai/cordis-plugin-hmr",
		"@deepseek-ai/dsh-base"
	],
	[
		"llm",
		"@deepseek-ai/dsh-llm",
		"@deepseek-ai/dsh-base"
	],
	[
		"session",
		"@deepseek-ai/dsh-session",
		"@deepseek-ai/dsh-base"
	],
	[
		"typert",
		"@deepseek-ai/dsh-typert-registry",
		"@deepseek-ai/dsh-base"
	],
	[
		"typert-loader",
		"@deepseek-ai/dsh-typert-loader",
		"@deepseek-ai/dsh-base"
	],
	[
		"typert-gateway",
		"@deepseek-ai/dsh-api-gateway",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-title",
		"@deepseek-ai/dsh-session-title",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-title-llm",
		"@deepseek-ai/dsh-session-title-first-prompt-llm",
		"@deepseek-ai/dsh-base"
	],
	[
		"user-questions",
		"@deepseek-ai/dsh-user-questions",
		"@deepseek-ai/dsh-base"
	],
	[
		"agent",
		"@deepseek-ai/dsh-agent",
		"@deepseek-ai/dsh-base"
	],
	[
		"agent-default-model",
		"@deepseek-ai/dsh-agent-default-model",
		"@deepseek-ai/dsh-base"
	],
	[
		"jobs",
		"@deepseek-ai/dsh-jobs-local",
		"@deepseek-ai/dsh-base"
	],
	[
		"llm-retry",
		"@deepseek-ai/dsh-llm-retry",
		"@deepseek-ai/dsh-base"
	],
	[
		"settings",
		"@deepseek-ai/dsh-settings-file",
		"@deepseek-ai/dsh-base"
	],
	[
		"credentials",
		"@deepseek-ai/dsh-credentials-local",
		"@deepseek-ai/dsh-base"
	],
	[
		"llm-pi-ai",
		"@deepseek-ai/dsh-llm-pi-ai",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-persistence-jsonl",
		"@deepseek-ai/dsh-session-persistence-jsonl",
		"@deepseek-ai/dsh-base"
	],
	[
		"attachment-local",
		"@deepseek-ai/dsh-attachment-local",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-query-sqlite",
		"@deepseek-ai/dsh-session-query-sqlite",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-projection",
		"@deepseek-ai/dsh-session-projection",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-telemetry-otel",
		"@deepseek-ai/dsh-session-telemetry-otel",
		"@deepseek-ai/dsh-base"
	],
	[
		"subprocess",
		"@deepseek-ai/dsh-subprocess-local",
		"@deepseek-ai/dsh-base"
	],
	[
		"sandbox",
		"@deepseek-ai/dsh-sandbox-local",
		"@deepseek-ai/dsh-base"
	],
	[
		"sandbox-policy",
		"@deepseek-ai/dsh-sandbox-policy",
		"@deepseek-ai/dsh-base"
	],
	[
		"bash-sandbox",
		"@deepseek-ai/dsh-bash-sandbox",
		"@deepseek-ai/dsh-base"
	],
	[
		"pwsh-sandbox",
		"@deepseek-ai/dsh-pwsh-sandbox",
		"@deepseek-ai/dsh-base"
	],
	[
		"approval",
		"@deepseek-ai/dsh-user-approval",
		"@deepseek-ai/dsh-base"
	],
	[
		"permission",
		"@deepseek-ai/dsh-permission-presets",
		"@deepseek-ai/dsh-base"
	],
	[
		"shell-env",
		"@deepseek-ai/dsh-shell-env",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-bash",
		"@deepseek-ai/dsh-tool-bash",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-pwsh",
		"@deepseek-ai/dsh-tool-pwsh",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-jobs",
		"@deepseek-ai/dsh-tool-jobs",
		"@deepseek-ai/dsh-base"
	],
	[
		"fs-observation-policy",
		"@deepseek-ai/dsh-fs-observation-policy",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-fs",
		"@deepseek-ai/dsh-tool-fs",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-fs-search",
		"@deepseek-ai/dsh-tool-fs-search",
		"@deepseek-ai/dsh-base"
	],
	[
		"agent-instructions",
		"@deepseek-ai/dsh-agent-instructions",
		"@deepseek-ai/dsh-base"
	],
	[
		"skill",
		"@deepseek-ai/dsh-skill",
		"@deepseek-ai/dsh-base"
	],
	[
		"skill-filesystem",
		"@deepseek-ai/dsh-skill-filesystem",
		"@deepseek-ai/dsh-base"
	],
	[
		"skill-badge",
		"@deepseek-ai/dsh-skill-badge",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-skill",
		"@deepseek-ai/dsh-tool-skill",
		"@deepseek-ai/dsh-base"
	],
	[
		"commands",
		"@deepseek-ai/dsh-commands",
		"@deepseek-ai/dsh-base"
	],
	[
		"command-feedback",
		"@deepseek-ai/dsh-command-feedback",
		"@deepseek-ai/dsh-base"
	],
	[
		"goal",
		"@deepseek-ai/dsh-goal",
		"@deepseek-ai/dsh-base"
	],
	[
		"goal-round-driver",
		"@deepseek-ai/dsh-goal-round-driver",
		"@deepseek-ai/dsh-base"
	],
	[
		"command-goal",
		"@deepseek-ai/dsh-command-goal",
		"@deepseek-ai/dsh-base"
	],
	[
		"plan-mode",
		"@deepseek-ai/dsh-plan-mode",
		"@deepseek-ai/dsh-base"
	],
	[
		"token-meter",
		"@deepseek-ai/dsh-token-meter",
		"@deepseek-ai/dsh-base"
	],
	[
		"compaction-basic",
		"@deepseek-ai/dsh-compaction-basic",
		"@deepseek-ai/dsh-base"
	],
	[
		"command-compact",
		"@deepseek-ai/dsh-command-compact",
		"@deepseek-ai/dsh-base"
	],
	[
		"subagent",
		"@deepseek-ai/dsh-subagent",
		"@deepseek-ai/dsh-base"
	],
	[
		"subagent-spawn-in-process",
		"@deepseek-ai/dsh-subagent-spawn-in-process",
		"@deepseek-ai/dsh-base"
	],
	[
		"subagent-fork-in-process",
		"@deepseek-ai/dsh-subagent-fork-in-process",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-subagent-control",
		"@deepseek-ai/dsh-tool-subagent-control",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-subagent-list-agents",
		"@deepseek-ai/dsh-tool-subagent-control/list-agents",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-subagent",
		"@deepseek-ai/dsh-tool-subagent",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-subagent-fork",
		"@deepseek-ai/dsh-tool-subagent",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-subagent-report",
		"@deepseek-ai/dsh-tool-subagent-report",
		"@deepseek-ai/dsh-base"
	],
	[
		"workflow-worker-thread",
		"@deepseek-ai/dsh-workflow-worker-thread",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-workflow",
		"@deepseek-ai/dsh-tool-workflow",
		"@deepseek-ai/dsh-base"
	],
	[
		"timeout-policy",
		"@deepseek-ai/dsh-tool-call-timeout-policy",
		"@deepseek-ai/dsh-base"
	],
	[
		"spill-local",
		"@deepseek-ai/dsh-spill-local",
		"@deepseek-ai/dsh-base"
	],
	[
		"spill-policy",
		"@deepseek-ai/dsh-spill-policy",
		"@deepseek-ai/dsh-base"
	],
	[
		"session-checkpoint-policy",
		"@deepseek-ai/dsh-session-checkpoint-policy",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-result-pruner",
		"@deepseek-ai/dsh-compaction-tool-result-pruner",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-todo",
		"@deepseek-ai/dsh-tool-todo",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-goal",
		"@deepseek-ai/dsh-tool-goal",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-ralph",
		"@deepseek-ai/dsh-tool-ralph",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-str-replace-editor",
		"@deepseek-ai/dsh-tool-str-replace-editor",
		"@deepseek-ai/dsh-base"
	],
	[
		"repeat-tool-reminder",
		"@deepseek-ai/dsh-repeat-tool-reminder",
		"@deepseek-ai/dsh-base"
	],
	[
		"web",
		"@deepseek-ai/dsh-web",
		"@deepseek-ai/dsh-base"
	],
	[
		"web-search-deepseek",
		"@deepseek-ai/dsh-web-search-deepseek",
		"@deepseek-ai/dsh-base"
	],
	[
		"tool-web",
		"@deepseek-ai/dsh-tool-web",
		"@deepseek-ai/dsh-base"
	],
	[
		"tools",
		"@deepseek-ai/dsh-tools",
		"@deepseek-ai/dsh-base"
	],
	[
		"system-prompt",
		"@deepseek-ai/dsh-system-prompt",
		"@deepseek-ai/dsh-base"
	],
	[
		"agent-loop",
		"@deepseek-ai/dsh-agent-loop",
		"@deepseek-ai/dsh-base"
	],
	[
		"fs-sandbox",
		"@deepseek-ai/dsh-fs-sandbox",
		"@deepseek-ai/dsh-base"
	],
	[
		"llm-deepseek",
		"@deepseek-ai/dsh-llm-deepseek",
		"@deepseek-ai/dsh-base"
	],
	[
		"code-runtime",
		"@deepseek-ai/dsh-code-runtime-worker-thread",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"storage",
		"@deepseek-ai/dsh-storage",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"storage-json",
		"@deepseek-ai/dsh-storage-json",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"storage-domain",
		"@deepseek-ai/dsh-storage-domain",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"message-feedback",
		"@deepseek-ai/dsh-message-feedback",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"session-log-download",
		"@deepseek-ai/dsh-session-log-export",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"workspace",
		"@deepseek-ai/dsh-workspace",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"session-projection-cache",
		"@deepseek-ai/dsh-session-projection-cache",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"session-stats",
		"@deepseek-ai/dsh-session-stats",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"directory-picker",
		"@deepseek-ai/dsh-host-directory-picker-auto",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"plugin-inventory",
		"@deepseek-ai/dsh-host-plugin-inventory",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"api-gateway",
		"@deepseek-ai/dsh-host-apiproxy",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"cordis-host-runner",
		"@deepseek-ai/dsh-cordis-host-runner",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"web-startup",
		"@deepseek-ai/dsh-web-app/startup",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"webserver",
		"@deepseek-ai/dsh-host-webserver",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"web-runtime",
		"@deepseek-ai/dsh-web-app",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"client-hmr",
		"@deepseek-ai/dsh-client-hmr",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"modules",
		"@deepseek-ai/dsh-client-modules",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"connection",
		"@deepseek-ai/dsh-client-connection",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"api-remotes",
		"@deepseek-ai/dsh-api-remotes",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"client-runtime",
		"@deepseek-ai/dsh-client-runtime",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"cordis-client-runner",
		"@deepseek-ai/dsh-cordis-client-runner",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-theme",
		"@deepseek-ai/dsh-client-ui-theme",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"locale",
		"@deepseek-ai/dsh-client-locale",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-layout",
		"@deepseek-ai/dsh-client-ui-layout",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-sidebar",
		"@deepseek-ai/dsh-client-ui-sidebar",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-settings",
		"@deepseek-ai/dsh-client-ui-settings",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-settings-general",
		"@deepseek-ai/dsh-client-ui-settings-general",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-settings-models",
		"@deepseek-ai/dsh-client-ui-settings-models",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-settings-plugin-inventory",
		"@deepseek-ai/dsh-client-ui-settings-plugin-inventory",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-conversation",
		"@deepseek-ai/dsh-client-ui-conversation",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-tool",
		"@deepseek-ai/dsh-client-ui-tool",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-cordis",
		"@deepseek-ai/dsh-client-ui-cordis",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-workflow-run",
		"@deepseek-ai/dsh-client-ui-workflow-run",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-deliverables",
		"@deepseek-ai/dsh-client-ui-deliverables",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-workspace",
		"@deepseek-ai/dsh-client-ui-workspace",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-input-trigger",
		"@deepseek-ai/dsh-client-ui-input-trigger",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-commands",
		"@deepseek-ai/dsh-client-ui-commands",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-skill",
		"@deepseek-ai/dsh-client-ui-skill",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-subagent",
		"@deepseek-ai/dsh-client-ui-subagent",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-jobs",
		"@deepseek-ai/dsh-client-ui-jobs",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-goal",
		"@deepseek-ai/dsh-client-ui-goal",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-message-feedback",
		"@deepseek-ai/dsh-client-ui-message-feedback",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-model-selection",
		"@deepseek-ai/dsh-client-ui-model-selection",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-permission",
		"@deepseek-ai/dsh-client-ui-permission-presets",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-agent-preset",
		"@deepseek-ai/dsh-client-ui-agent-preset",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-settings-plugins",
		"@deepseek-ai/dsh-client-ui-settings-plugins",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-plan",
		"@deepseek-ai/dsh-client-ui-plan",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-user-questions",
		"@deepseek-ai/dsh-client-ui-user-questions",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"ui-trajectory",
		"@deepseek-ai/dsh-client-ui-trajectory",
		"@deepseek-ai/dsh-web-app"
	],
	[
		"agent-presets",
		"@deepseek-ai/dsh-agent-presets",
		"@deepseek-ai/dsh-web-app"
	]
];
REVIEWED_RC6_ROWS.map(([id]) => id);
const REVIEWED_INJECTS = {
	connection: ["webRuntime"],
	webserver: ["webStartup"],
	"web-runtime": ["webStartup"]
};
/** Explicit audit mapping; no entry name prefix is used to infer a plane. */
const AGENT_PRESET_IDS = /* @__PURE__ */ new Set([
	"tool-bash",
	"tool-pwsh",
	"tool-jobs",
	"tool-fs",
	"tool-fs-search",
	"tool-str-replace-editor",
	"skill-filesystem",
	"tool-skill",
	"tool-goal",
	"plan-mode",
	"compaction-basic",
	"command-compact",
	"tool-result-pruner",
	"tool-subagent-control",
	"tool-subagent-list-agents",
	"tool-subagent",
	"tool-subagent-fork",
	"workflow-worker-thread",
	"tool-workflow",
	"tool-ralph",
	"agent-instructions",
	"tool-todo",
	"tool-web"
]);
const HOST_IDS = /* @__PURE__ */ new Set([
	"code-runtime",
	"storage",
	"storage-json",
	"storage-domain",
	"message-feedback",
	"session-log-download",
	"workspace",
	"session-projection-cache",
	"session-stats",
	"directory-picker",
	"plugin-inventory",
	"api-gateway",
	"cordis-host-runner",
	"web-startup",
	"webserver",
	"web-runtime"
]);
const BROWSER_IDS = /* @__PURE__ */ new Set([
	"client-hmr",
	"modules",
	"connection",
	"api-remotes",
	"client-runtime",
	"cordis-client-runner",
	"ui-theme",
	"locale",
	"ui-layout",
	"ui-sidebar",
	"ui-settings",
	"ui-settings-general",
	"ui-settings-models",
	"ui-settings-plugin-inventory",
	"ui-conversation",
	"ui-tool",
	"ui-cordis",
	"ui-workflow-run",
	"ui-deliverables",
	"ui-workspace",
	"ui-input-trigger",
	"ui-commands",
	"ui-skill",
	"ui-subagent",
	"ui-jobs",
	"ui-goal",
	"ui-message-feedback",
	"ui-model-selection",
	"ui-permission",
	"ui-agent-preset",
	"ui-settings-plugins",
	"ui-plan",
	"ui-user-questions",
	"ui-trajectory"
]);
const SAFE_UI_LEAF_IDS = /* @__PURE__ */ new Set([
	"ui-deliverables",
	"ui-jobs",
	"ui-goal",
	"ui-message-feedback",
	"ui-model-selection",
	"ui-agent-preset",
	"ui-skill",
	"ui-subagent",
	"ui-trajectory"
]);
function managementPlaneFor(id) {
	if (AGENT_PRESET_IDS.has(id)) return "agent-preset";
	if (HOST_IDS.has(id)) return "host";
	if (BROWSER_IDS.has(id)) return "browser";
	return "unknown";
}
function categoryFor(id) {
	if (SAFE_UI_LEAF_IDS.has(id)) return "presentation";
	if (AGENT_PRESET_IDS.has(id)) return "agent";
	if (id === "webserver" || id === "web-runtime" || id === "connection" || id === "api-remotes") return "transport";
	return "unknown";
}
function dependencyEvidenceFor(id) {
	if (id === "ui-commands") return {
		provides: {
			status: "observed",
			services: ["commandUi"]
		},
		consumers: {
			status: "observed",
			ids: [
				"ui-conversation",
				"ui-model-selection",
				"ui-permission"
			]
		}
	};
	return {
		provides: { status: "unknown" },
		consumers: { status: "unknown" }
	};
}
function leafReviewFor(id) {
	if (SAFE_UI_LEAF_IDS.has(id)) return "reviewed-safe-ui-leaf";
	if (id === "ui-commands") return "locked-dependency";
	return "not-reviewed";
}
function rationaleFor(id) {
	if (SAFE_UI_LEAF_IDS.has(id)) return "Reviewed rc.6 admission audit classified this as a safe UI leaf; this fact does not authorize mutation.";
	if (id === "ui-commands") return "Provides commandUi with known consumers; it is not a safe UI leaf.";
	return "Package composition was reviewed, but no independent safe-leaf conclusion is asserted.";
}
const REVIEWED_DSH_WEB_BASELINE = REVIEWED_RC6_ROWS.map(([id, expectedPackageName, source]) => ({
	id,
	expectedPackageName,
	managementPlane: managementPlaneFor(id),
	category: categoryFor(id),
	serviceEvidence: REVIEWED_INJECTS[id] === void 0 ? [] : [{
		kind: "declared-inject",
		expectedServices: REVIEWED_INJECTS[id]
	}],
	dependencyEvidence: dependencyEvidenceFor(id),
	leafReview: leafReviewFor(id),
	reviewedReference: source === "@deepseek-ai/dsh-base" ? BASE_REFERENCE : WEB_REFERENCE,
	rationale: rationaleFor(id)
}));
function baselineById(baseline = REVIEWED_DSH_WEB_BASELINE) {
	return new Map(baseline.map((entry) => [entry.id, entry]));
}
//#endregion
//#region src/compatibility.ts
/**
* Cordis resolves an inject string array by assigning each service name into a
* record. Array order therefore does not affect the resolved injection set.
*/
function canonicalInject(value) {
	return value === null ? null : [...new Set(value)].sort();
}
function sameInject(left, right) {
	const canonicalLeft = canonicalInject(left);
	const canonicalRight = canonicalInject(right);
	return canonicalLeft !== null && canonicalLeft.length === canonicalRight.length && canonicalLeft.every((value, index) => value === canonicalRight[index]);
}
/**
* Compare runtime Loader facts to the reviewed baseline. This evaluator only
* reports evidence; PR 1 deliberately does not feed its result into POST.
*/
function evaluateCompatibility(runtimeEntries, baseline) {
	const expected = baselineById(baseline);
	const runtimeById = /* @__PURE__ */ new Map();
	for (const entry of runtimeEntries) {
		const entries = runtimeById.get(entry.id);
		if (entries === void 0) runtimeById.set(entry.id, [entry]);
		else entries.push(entry);
	}
	const findings = [];
	let verifiedCount = 0;
	let driftedCount = 0;
	let unverifiedCount = 0;
	const duplicateIds = /* @__PURE__ */ new Set();
	for (const [id, entries] of runtimeById) {
		if (entries.length < 2) continue;
		duplicateIds.add(id);
		findings.push({
			code: "duplicate_runtime_id",
			id,
			observed: entries.map((entry) => entry.packageName)
		});
		driftedCount += 1;
	}
	for (const reviewed of baseline) {
		const entries = runtimeById.get(reviewed.id);
		if (entries === void 0) {
			findings.push({
				code: "missing_expected_entry",
				id: reviewed.id,
				expected: reviewed.expectedPackageName
			});
			driftedCount += 1;
			continue;
		}
		if (duplicateIds.has(reviewed.id)) continue;
		const entry = entries[0];
		if (reviewed.expectedPackageName === null) {
			findings.push({
				code: "baseline_package_unknown",
				id: reviewed.id,
				observed: entry.packageName
			});
			unverifiedCount += 1;
			continue;
		}
		if (entry.packageName !== reviewed.expectedPackageName) {
			findings.push({
				code: "package_identity_changed",
				id: reviewed.id,
				expected: reviewed.expectedPackageName,
				observed: entry.packageName
			});
			driftedCount += 1;
			continue;
		}
		const declaredInject = reviewed.serviceEvidence.find((evidence) => evidence.kind === "declared-inject");
		if (declaredInject !== void 0 && !sameInject(entry.declaredInject, declaredInject.expectedServices)) {
			findings.push({
				code: "declared_inject_changed",
				id: reviewed.id,
				expected: declaredInject.expectedServices,
				observed: entry.declaredInject
			});
			driftedCount += 1;
			continue;
		}
		verifiedCount += 1;
	}
	for (const [id, entries] of runtimeById) {
		if (duplicateIds.has(id)) continue;
		const entry = entries[0];
		if (!entry.packageName.startsWith("@deepseek-ai/")) continue;
		if (expected.has(entry.id)) continue;
		findings.push({
			code: "new_official_entry",
			id: entry.id,
			observed: entry.packageName
		});
		driftedCount += 1;
	}
	return {
		status: driftedCount > 0 ? "drifted" : unverifiedCount > 0 ? "unverified" : "verified",
		findings,
		verifiedCount,
		driftedCount,
		unverifiedCount
	};
}
//#endregion
//#region src/inspection.ts
const INSPECTION_SCHEMA_VERSION = "builtin-toggles.inspection/v1";
function unknownPlane() {
	return "unknown";
}
function unknownCategory() {
	return "unknown";
}
function lifecycleFor(phase) {
	if (phase === null) return "inactive";
	if (phase === "pending" || phase === "loading" || phase === "active" || phase === "failed" || phase === "unloading") return phase;
	return "unknown";
}
/** Build the versioned, presentation-free inspection DTO. */
function buildInspectionResponse(entries) {
	const baseline = baselineById();
	const compatibility = evaluateCompatibility(entries.map((entry) => ({
		id: entry.id,
		packageName: entry.name,
		declaredInject: entry.declaredInject
	})), REVIEWED_DSH_WEB_BASELINE);
	const findingCodesById = /* @__PURE__ */ new Map();
	for (const finding of compatibility.findings) findingCodesById.set(finding.id, finding.code === "baseline_package_unknown" || finding.code === "new_official_entry" ? "unverified" : "drifted");
	const capabilities = entries.map((entry) => {
		const reviewed = baseline.get(entry.id);
		const policy = classifyEntry(entry);
		return {
			id: entry.id,
			packageName: entry.name,
			official: entry.name.startsWith(OFFICIAL_PACKAGE_PREFIX),
			runtimeState: {
				disabled: entry.disabled,
				lifecycle: lifecycleFor(entry.phase)
			},
			managementPlane: reviewed?.managementPlane ?? unknownPlane(),
			category: reviewed?.category ?? unknownCategory(),
			policy: policy.manageable ? { status: "manageable" } : {
				status: "locked",
				reason: policy.reason
			},
			verification: findingCodesById.get(entry.id) ?? (reviewed === void 0 ? "unverified" : "verified"),
			baseline: {
				reviewed: reviewed !== void 0,
				expectedPackageName: reviewed?.expectedPackageName ?? null,
				reviewedReference: reviewed?.reviewedReference ?? null,
				serviceEvidence: reviewed?.serviceEvidence ?? [],
				dependencyEvidence: reviewed?.dependencyEvidence ?? null,
				leafReview: reviewed?.leafReview ?? null,
				rationale: reviewed?.rationale ?? null
			}
		};
	});
	const officialEntries = capabilities.filter((entry) => entry.official).length;
	return {
		schemaVersion: INSPECTION_SCHEMA_VERSION,
		host: {
			plugin: "builtin-toggles",
			profile: "web"
		},
		compatibility,
		inventory: {
			totalEntries: capabilities.length,
			officialEntries,
			externalEntries: capabilities.length - officialEntries,
			reviewedEntries: capabilities.filter((entry) => entry.baseline.reviewed).length
		},
		capabilities
	};
}
//#endregion
//#region src/trust.ts
function header(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/**
* Official loopback classification: localhost, the bracketed IPv6 loopback
* literal, or any IPv4 address in 127/8 (all four octets numeric, ≤ 255).
* A WHATWG URL hostname keeps IPv6 brackets, so the bracket form is the one
* that appears here.
*/
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/**
* Canonical form of a parsed authority: `hostname` when no port was written,
* else `hostname:port`. The port is judged from URL parses under both special
* schemes (their default ports differ, so `:80` and `:443` still count as
* explicit), never from the raw string.
*/
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
/**
* Whether the request authority matches a `trustedHosts` entry. An entry with
* an explicit port matches that exact authority; a port-less entry matches
* the hostname on any port. Both sides compare through WHATWG normalization.
*/
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/**
* Decide whether one plugin-API request may reach the routes.
* @param headers - Node HTTP request headers.
* @param trustedHosts - non-loopback authorities this deployment serves:
* exact `host:port`, or port-less `host` matching any port.
* @returns true when the Host is ours (loopback or trusted) and any attached
* browser markers are same-origin.
*/
function isTrustedRequest(headers, trustedHosts) {
	const host = header(headers, "host");
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (header(headers, "sec-fetch-site") === "cross-site") return false;
	const origin = header(headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/index.ts
/** Cordis plugin identity. */
const name = "builtin-toggles";
/** Services required from the web composition. */
const inject = ["webServer", "loader"];
/** The same-origin API prefix. */
const API_PREFIX = "/api/builtin-toggles";
/** Versioned, read-only inspection endpoint. */
const INSPECTION_API_PATH = `${API_PREFIX}/v1/inspection`;
/** Maximum accepted POST body. */
const MAX_BODY_BYTES = 4096;
/**
* Decode a URL-encoded plugin id from the request path. Malformed percent
* encoding (`%ZZ`, dangling `%`) must never throw into the HTTP layer:
* return null and let the route answer a clean 400 without touching the
* runtime or the profile patch.
*/
function decodeEntryId(raw) {
	try {
		return decodeURIComponent(raw);
	} catch {
		return null;
	}
}
/**
* Process-wide mutation serialization: every POST runs through this queue,
* so two browser tabs (or any concurrent callers) can never interleave
* runtime updates or profile-patch writes. The official per-file writer lock
* (withFileLock) additionally serializes across processes.
*/
let mutationQueue = Promise.resolve();
function serializeMutation(run) {
	const next = mutationQueue.then(run, run);
	mutationQueue = next.then(() => void 0, () => void 0);
	return next;
}
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
/**
* Loader `inject` can also be an intercept object.  Only a plain string array
* has a stable, reviewed meaning for this API; every other shape is exposed as
* unknown instead of being flattened or guessed.
*/
function declaredInject(entry) {
	const inject = entry.options.inject;
	return Array.isArray(inject) && inject.every((value) => typeof value === "string") ? inject : null;
}
function inspectionEntry(entry) {
	return {
		...entryFacts(entry),
		declaredInject: declaredInject(entry)
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
				const trustedHosts = ctx.get("webRuntime")?.trustedHosts ?? [];
				if (!isTrustedRequest(req.headers, trustedHosts)) {
					sendJson(res, 403, {
						ok: false,
						error: "forbidden",
						message: "builtin-toggles: untrusted request"
					});
					return;
				}
				const pathname = (req.url ?? "/").split("?")[0] ?? "/";
				const method = req.method ?? "GET";
				if (method === "GET" && pathname === INSPECTION_API_PATH) {
					sendJson(res, 200, buildInspectionResponse([...ctx.loader.entries()].filter((entry) => !entry.options.group).map(inspectionEntry)));
					return;
				}
				if (method === "GET" && pathname === "/api/builtin-toggles") {
					sendJson(res, 200, { plugins: buildSnapshot([...ctx.loader.entries()]) });
					return;
				}
				const match = /^\/api\/builtin-toggles\/([^/]+)$/.exec(pathname);
				if (method === "POST" && match !== null) {
					const id = decodeEntryId(match[1]);
					if (id === null) {
						sendJson(res, 400, {
							ok: false,
							error: "invalid_id",
							message: "builtin-toggles: malformed percent-encoding in plugin id"
						});
						return;
					}
					let rawBody;
					try {
						const text = await readBody(req, MAX_BODY_BYTES);
						rawBody = text === null ? void 0 : JSON.parse(text);
					} catch {
						rawBody = void 0;
					}
					const result = await serializeMutation(() => runToggle({
						patchFile: profilePatchPath("web"),
						findEntry: (targetId) => {
							const entry = findEntryByShortId(ctx, targetId);
							return entry === void 0 ? void 0 : entryHandle(entry);
						},
						persist: async (file, targetId, disabled) => {
							return { changed: (await applyDisabledOverride(file, targetId, disabled)).changed };
						}
					}, id, rawBody));
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
export { API_PREFIX, INSPECTION_API_PATH, apply, buildSnapshot, decodeEntryId, inject, name, serializeMutation };
