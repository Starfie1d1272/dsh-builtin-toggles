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
/**
* Reviewed, locale-independent facts about the DSH Web Loader composition.
*
* This is evidence, not policy: changing any value here must never make a
* mutation possible.  The POST authority remains `policy.ts`.
*/
/**
* The reviewed rc.6 Web composition roster. The list is deliberately kept as
* ids even when a package identity was not independently verified: presence
* is still a meaningful, runtime-checkable composition assertion.
*/
const REVIEWED_DSH_WEB_IDS = [
	"agent",
	"agent-default-model",
	"agent-instructions",
	"agent-loop",
	"agent-presets",
	"api-gateway",
	"api-remotes",
	"approval",
	"attachment-local",
	"bash-sandbox",
	"client-hmr",
	"client-runtime",
	"code-runtime",
	"command-compact",
	"command-feedback",
	"command-goal",
	"commands",
	"compaction-basic",
	"connection",
	"cordis-client-runner",
	"cordis-host-runner",
	"credentials",
	"directory-picker",
	"fs-observation-policy",
	"fs-sandbox",
	"goal",
	"goal-round-driver",
	"hmr",
	"jobs",
	"llm",
	"llm-deepseek",
	"llm-pi-ai",
	"llm-retry",
	"locale",
	"message-feedback",
	"modules",
	"permission",
	"plan-mode",
	"plugin-inventory",
	"pwsh-sandbox",
	"repeat-tool-reminder",
	"sandbox",
	"sandbox-policy",
	"session",
	"session-checkpoint-policy",
	"session-log-download",
	"session-persistence-jsonl",
	"session-projection",
	"session-projection-cache",
	"session-query-sqlite",
	"session-stats",
	"session-telemetry-otel",
	"session-title",
	"session-title-llm",
	"settings",
	"shell-env",
	"skill",
	"skill-badge",
	"skill-filesystem",
	"spill-local",
	"spill-policy",
	"storage",
	"storage-domain",
	"storage-json",
	"subagent",
	"subagent-fork-in-process",
	"subagent-spawn-in-process",
	"subprocess",
	"system-prompt",
	"timeout-policy",
	"timer",
	"token-meter",
	"tool-bash",
	"tool-fs",
	"tool-fs-search",
	"tool-goal",
	"tool-jobs",
	"tool-pwsh",
	"tool-ralph",
	"tool-result-pruner",
	"tool-skill",
	"tool-str-replace-editor",
	"tool-subagent",
	"tool-subagent-control",
	"tool-subagent-fork",
	"tool-subagent-list-agents",
	"tool-subagent-report",
	"tool-todo",
	"tool-web",
	"tool-workflow",
	"tools",
	"typert",
	"typert-gateway",
	"typert-loader",
	"ui-agent-preset",
	"ui-commands",
	"ui-conversation",
	"ui-cordis",
	"ui-deliverables",
	"ui-goal",
	"ui-input-trigger",
	"ui-jobs",
	"ui-layout",
	"ui-message-feedback",
	"ui-model-selection",
	"ui-permission",
	"ui-plan",
	"ui-settings",
	"ui-settings-general",
	"ui-settings-models",
	"ui-settings-plugin-inventory",
	"ui-settings-plugins",
	"ui-sidebar",
	"ui-skill",
	"ui-subagent",
	"ui-theme",
	"ui-tool",
	"ui-trajectory",
	"ui-user-questions",
	"ui-workflow-run",
	"ui-workspace",
	"user-questions",
	"web",
	"web-runtime",
	"web-search-deepseek",
	"web-startup",
	"webserver",
	"workflow-worker-thread",
	"workspace"
];
/** Exact names copied from the published `@deepseek-ai/dsh-web-app@0.1.0-rc.6` patch. */
const REVIEWED_WEB_PACKAGE_NAMES = {
	"api-gateway": "@deepseek-ai/dsh-host-apiproxy",
	"api-remotes": "@deepseek-ai/dsh-api-remotes",
	"client-hmr": "@deepseek-ai/dsh-client-hmr",
	"client-runtime": "@deepseek-ai/dsh-client-runtime",
	"connection": "@deepseek-ai/dsh-client-connection",
	"cordis-client-runner": "@deepseek-ai/dsh-cordis-client-runner",
	"cordis-host-runner": "@deepseek-ai/dsh-cordis-host-runner",
	"directory-picker": "@deepseek-ai/dsh-host-directory-picker-auto",
	"modules": "@deepseek-ai/dsh-client-modules",
	"plugin-inventory": "@deepseek-ai/dsh-host-plugin-inventory",
	"web-runtime": "@deepseek-ai/dsh-web-app",
	"web-startup": "@deepseek-ai/dsh-web-app/startup",
	"webserver": "@deepseek-ai/dsh-host-webserver",
	"ui-agent-preset": "@deepseek-ai/dsh-client-ui-agent-preset",
	"ui-commands": "@deepseek-ai/dsh-client-ui-commands",
	"ui-conversation": "@deepseek-ai/dsh-client-ui-conversation",
	"ui-cordis": "@deepseek-ai/dsh-client-ui-cordis",
	"ui-deliverables": "@deepseek-ai/dsh-client-ui-deliverables",
	"ui-goal": "@deepseek-ai/dsh-client-ui-goal",
	"ui-input-trigger": "@deepseek-ai/dsh-client-ui-input-trigger",
	"ui-jobs": "@deepseek-ai/dsh-client-ui-jobs",
	"ui-layout": "@deepseek-ai/dsh-client-ui-layout",
	"ui-message-feedback": "@deepseek-ai/dsh-client-ui-message-feedback",
	"ui-model-selection": "@deepseek-ai/dsh-client-ui-model-selection",
	"ui-permission": "@deepseek-ai/dsh-client-ui-permission-presets",
	"ui-plan": "@deepseek-ai/dsh-client-ui-plan",
	"ui-settings": "@deepseek-ai/dsh-client-ui-settings",
	"ui-settings-general": "@deepseek-ai/dsh-client-ui-settings-general",
	"ui-settings-models": "@deepseek-ai/dsh-client-ui-settings-models",
	"ui-settings-plugin-inventory": "@deepseek-ai/dsh-client-ui-settings-plugin-inventory",
	"ui-settings-plugins": "@deepseek-ai/dsh-client-ui-settings-plugins",
	"ui-sidebar": "@deepseek-ai/dsh-client-ui-sidebar",
	"ui-skill": "@deepseek-ai/dsh-client-ui-skill",
	"ui-subagent": "@deepseek-ai/dsh-client-ui-subagent",
	"ui-theme": "@deepseek-ai/dsh-client-ui-theme",
	"ui-tool": "@deepseek-ai/dsh-client-ui-tool",
	"ui-trajectory": "@deepseek-ai/dsh-client-ui-trajectory",
	"ui-user-questions": "@deepseek-ai/dsh-client-ui-user-questions",
	"ui-workflow-run": "@deepseek-ai/dsh-client-ui-workflow-run",
	"ui-workspace": "@deepseek-ai/dsh-client-ui-workspace"
};
const REVIEWED_INJECTS = {
	connection: ["webRuntime"],
	"web-runtime": ["webStartup"],
	webserver: ["webStartup"]
};
const PUBLISHED_WEB_REFERENCE = {
	source: "npm-published-patch",
	packageName: "@deepseek-ai/dsh-web-app",
	version: "0.1.0-rc.6",
	artifact: "cordis.patch.yml"
};
function managementPlaneFor(id) {
	if (id.startsWith("ui-") || [
		"client-hmr",
		"client-runtime",
		"connection",
		"cordis-client-runner",
		"locale",
		"modules"
	].includes(id)) return "browser";
	if (id === "agent-presets" || id.startsWith("tool-") || id.startsWith("skill-") || id.startsWith("subagent") || id.startsWith("agent-")) return "agent-preset";
	if ([
		"agent",
		"commands",
		"goal",
		"jobs",
		"llm",
		"plan-mode",
		"tools"
	].includes(id)) return "agent";
	if (id.includes("web") || id.includes("server") || id.includes("storage") || id.includes("session") || id.includes("runtime") || id.includes("gateway")) return "host";
	return "unknown";
}
function categoryFor(id) {
	if (id.startsWith("ui-")) return id.includes("settings") ? "settings" : "presentation";
	if (id.startsWith("tool-") || id.startsWith("skill-") || id === "tools") return "tooling";
	if (id.startsWith("agent") || id.startsWith("subagent") || id === "plan-mode") return "agent";
	if (id.startsWith("session") || id.startsWith("storage") || id === "workspace") return "storage";
	if (id.includes("web") || id.includes("gateway") || id === "connection" || id === "api-remotes") return "transport";
	if (id.includes("workflow") || id === "jobs") return "workflow";
	if (id === "llm" || id.startsWith("llm-") || id === "goal" || id === "commands") return "conversation";
	return "infrastructure";
}
function policyFor(id) {
	return MANAGEABLE.has(id) ? "manageable" : "locked";
}
const REVIEWED_DSH_WEB_BASELINE = REVIEWED_DSH_WEB_IDS.map((id) => {
	const expectedServices = REVIEWED_INJECTS[id];
	const policyStatus = policyFor(id);
	return {
		id,
		expectedPackageName: REVIEWED_WEB_PACKAGE_NAMES[id] ?? null,
		managementPlane: managementPlaneFor(id),
		category: categoryFor(id),
		documentedPolicyStatus: policyStatus,
		serviceEvidence: expectedServices === void 0 ? [] : [{
			kind: "declared-inject",
			expectedServices
		}],
		reviewedReference: REVIEWED_WEB_PACKAGE_NAMES[id] === void 0 ? null : PUBLISHED_WEB_REFERENCE,
		rationale: policyStatus === "manageable" ? "Explicit server policy allowlist; this reviewed description does not authorize mutation." : "Not on the explicit server allowlist; reviewed metadata cannot authorize mutation."
	};
});
function baselineById(baseline = REVIEWED_DSH_WEB_BASELINE) {
	return new Map(baseline.map((entry) => [entry.id, entry]));
}
//#endregion
//#region src/compatibility.ts
function sameStrings(left, right) {
	return left !== null && left.length === right.length && left.every((value, index) => value === right[index]);
}
/**
* Compare runtime Loader facts to the reviewed baseline. This evaluator only
* reports evidence; PR 1 deliberately does not feed its result into POST.
*/
function evaluateCompatibility(runtimeEntries, baseline) {
	const expected = baselineById(baseline);
	const runtimeOfficial = runtimeEntries.filter((entry) => entry.packageName.startsWith(OFFICIAL_PACKAGE_PREFIX));
	const actual = new Map(runtimeOfficial.map((entry) => [entry.id, entry]));
	const findings = [];
	let verifiedCount = 0;
	let driftedCount = 0;
	let unverifiedCount = 0;
	for (const reviewed of baseline) {
		const entry = actual.get(reviewed.id);
		if (entry === void 0) {
			findings.push({
				code: "missing_expected_entry",
				id: reviewed.id,
				expected: reviewed.expectedPackageName
			});
			driftedCount += 1;
			continue;
		}
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
		if (declaredInject !== void 0 && !sameStrings(entry.declaredInject, declaredInject.expectedServices)) {
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
	for (const entry of runtimeOfficial) {
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
