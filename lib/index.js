import { lstatSync, readFileSync } from "node:fs";
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
/**
* Exact Cordis/DSH framework identities, not bare-id heuristics.
*
* `cordis:*` is the Loader's builtin specifier scheme, and `loader` is the
* Cordis Loader service's own module name. These names are stronger evidence
* than a bare id; a third-party package can still pick the id `include`, but
* its module name will not be `cordis:include`, so it keeps the `external`
* reason. The `LOCKED_IDS.has(id)` requirement below prevents an unknown
* bare-id squat from borrowing the core label.
*/
const CORDIS_FRAMEWORK_NAMES = /* @__PURE__ */ new Set([
	"loader",
	"cordis:loader",
	"cordis:include",
	"cordis:group"
]);
/** Classify one loader entry against the policy. */
function classifyEntry(entry) {
	if (SELF_IDS.has(entry.id)) return {
		...entry,
		manageable: false,
		reason: "self"
	};
	if (CORDIS_FRAMEWORK_NAMES.has(entry.name) && LOCKED_IDS.has(entry.id)) return {
		...entry,
		manageable: false,
		reason: "core"
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
	if (!isMutationBody(body)) return {
		ok: false,
		status: 400,
		code: "invalid_body",
		message: "builtin-toggles: body must be a legacy { disabled: boolean } object or an explicit mutation action"
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
/** Strict API schema, retaining the v0.1 `{ disabled }` request form. */
function parseMutationBody(value) {
	const legacy = parseDisabledBody(value);
	if (legacy !== null) return legacy;
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const record = value;
	if (Object.keys(record).length !== 1 || typeof record.action !== "string") return null;
	return record.action === "force-enable" || record.action === "force-disable" || record.action === "restore-inheritance" ? { action: record.action } : null;
}
function isMutationBody(value) {
	return parseMutationBody(value) !== null;
}
//#endregion
//#region src/evidence.ts
/**
* The release whose published patches supplied this baseline. This is an
* expected identity, not proof that the currently running Host exposes it.
*/
const REVIEWED_RC6_COMPOSITION_IDENTITY = {
	kind: "dsh-release",
	value: "@deepseek-ai/dsh@0.1.0-rc.6",
	provenance: "npm-published-package"
};
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
	if (SAFE_UI_LEAF_IDS.has(id)) return {
		provides: {
			status: "observed",
			services: []
		},
		consumers: {
			status: "observed",
			ids: []
		}
	};
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
	serviceEvidence: [{
		kind: "declared-inject",
		expectedServices: REVIEWED_INJECTS[id] ?? null
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
function reviewedRuntimeAugmentation(entry) {
	switch (entry.packageName) {
		case "@deepseek-ai/dsh-host-directory-picker-browse": return {
			role: "host-directory-picker",
			variant: "browse"
		};
		case "@deepseek-ai/dsh-host-directory-picker-native": return {
			role: "host-directory-picker",
			variant: "native"
		};
		case "@deepseek-ai/dsh-client-ui-directory-picker-browse": return {
			role: "client-directory-picker",
			variant: "browse"
		};
		case "@deepseek-ai/dsh-client-ui-directory-picker-native": return {
			role: "client-directory-picker",
			variant: "native"
		};
		case "@deepseek-ai/cordis-plugin-hmr": return { role: "hmr" };
	}
}
/**
* Cordis resolves an inject string array by assigning each service name into a
* record. Array order therefore does not affect the resolved injection set.
*/
function canonicalInject(value) {
	return value === null ? null : [...new Set(value)].sort();
}
function sameInject(left, known, right) {
	if (!known || left === null || right === null) return known && left === right;
	const canonicalLeft = canonicalInject(left);
	const canonicalRight = canonicalInject(right);
	return canonicalLeft !== null && canonicalLeft.length === canonicalRight.length && canonicalLeft.every((value, index) => value === canonicalRight[index]);
}
/**
* Compare runtime Loader facts to the reviewed baseline. This evaluator only
* reports evidence; PR 1 deliberately does not feed its result into POST.
*/
function evaluateCompatibility(runtimeEntries, baseline, runtimeIdentity = null, expectedIdentity = REVIEWED_RC6_COMPOSITION_IDENTITY) {
	const expected = baselineById(baseline);
	const runtimeByScope = /* @__PURE__ */ new Map();
	const hostById = /* @__PURE__ */ new Map();
	for (const entry of runtimeEntries) {
		const scopeId = entry.scopeId ?? entry.id;
		const scopeRows = runtimeByScope.get(scopeId);
		if (scopeRows === void 0) runtimeByScope.set(scopeId, [entry]);
		else scopeRows.push(entry);
		if ((entry.compositionScope ?? "host") !== "host") continue;
		const hostRows = hostById.get(entry.id);
		if (hostRows === void 0) hostById.set(entry.id, [entry]);
		else hostRows.push(entry);
	}
	const findings = [];
	const directDriftIds = /* @__PURE__ */ new Set();
	const structurallyMatchingReviewedIds = /* @__PURE__ */ new Set();
	const incompleteReviewedIds = /* @__PURE__ */ new Set();
	const identityStatus = runtimeIdentity === null ? "unavailable" : runtimeIdentity.kind === expectedIdentity.kind && runtimeIdentity.value === expectedIdentity.value ? "matched" : "mismatched";
	if (identityStatus === "unavailable") findings.push({
		scope: "composition",
		code: "runtime_release_identity_unavailable",
		expected: expectedIdentity,
		observed: null
	});
	else if (identityStatus === "mismatched") findings.push({
		scope: "composition",
		code: "runtime_release_identity_mismatch",
		expected: expectedIdentity,
		observed: runtimeIdentity
	});
	const duplicateIds = /* @__PURE__ */ new Set();
	for (const entries of runtimeByScope.values()) {
		if (entries.length < 2) continue;
		duplicateIds.add(entries[0].id);
		findings.push({
			scope: "entry",
			code: "duplicate_runtime_id",
			id: entries[0].id,
			observed: entries.map((entry) => entry.packageName)
		});
		directDriftIds.add(entries[0].id);
	}
	for (const [id, entries] of hostById) {
		if (entries.length < 2 || duplicateIds.has(id)) continue;
		duplicateIds.add(id);
		findings.push({
			scope: "entry",
			code: "duplicate_runtime_id",
			id,
			observed: entries.map((entry) => entry.packageName)
		});
		directDriftIds.add(id);
	}
	for (const reviewed of baseline) {
		const entries = hostById.get(reviewed.id);
		if (entries === void 0) {
			findings.push({
				scope: "entry",
				code: "missing_expected_entry",
				id: reviewed.id,
				expected: reviewed.expectedPackageName
			});
			directDriftIds.add(reviewed.id);
			continue;
		}
		if (duplicateIds.has(reviewed.id)) continue;
		const entry = entries[0];
		if (reviewed.expectedPackageName === null) {
			findings.push({
				scope: "entry",
				code: "baseline_package_unknown",
				id: reviewed.id,
				observed: entry.packageName
			});
			incompleteReviewedIds.add(reviewed.id);
			continue;
		}
		if (entry.packageName !== reviewed.expectedPackageName) {
			findings.push({
				scope: "entry",
				code: "package_identity_changed",
				id: reviewed.id,
				expected: reviewed.expectedPackageName,
				observed: entry.packageName
			});
			directDriftIds.add(reviewed.id);
			continue;
		}
		const declaredInject = reviewed.serviceEvidence.find((evidence) => evidence.kind === "declared-inject");
		if (declaredInject !== void 0 && !sameInject(entry.declaredInject, entry.declaredInjectKnown !== false, declaredInject.expectedServices)) {
			findings.push({
				scope: "entry",
				code: "declared_inject_changed",
				id: reviewed.id,
				expected: declaredInject.expectedServices,
				observed: entry.declaredInject
			});
			directDriftIds.add(reviewed.id);
			continue;
		}
		structurallyMatchingReviewedIds.add(reviewed.id);
	}
	const runtimeAugmentations = [];
	let observedRuntimeAugmentation = false;
	for (const entries of runtimeByScope.values()) {
		for (const entry of entries) {
			if (reviewedRuntimeAugmentation(entry) === void 0) continue;
			const reviewed = expected.get(entry.id);
			if (reviewed === void 0 || reviewed.expectedPackageName !== entry.packageName) observedRuntimeAugmentation = true;
			if (reviewed !== void 0 && reviewed.expectedPackageName !== entry.packageName) {
				findings.push({
					scope: "entry",
					code: "runtime_augmentation_id_conflicts_baseline",
					id: entry.id,
					expected: reviewed.expectedPackageName,
					observed: entry.packageName
				});
				directDriftIds.add(entry.id);
			}
		}
		if (duplicateIds.has(entries[0].id)) continue;
		const entry = entries[0];
		if (!entry.packageName.startsWith("@deepseek-ai/")) continue;
		if ((entry.compositionScope ?? "host") !== "host") continue;
		if (expected.has(entry.id)) continue;
		const augmentation = reviewedRuntimeAugmentation(entry);
		if (augmentation !== void 0) {
			runtimeAugmentations.push({
				entry,
				evidence: augmentation
			});
			continue;
		}
		findings.push({
			scope: "entry",
			code: "new_official_entry",
			id: entry.id,
			observed: entry.packageName
		});
		directDriftIds.add(entry.id);
	}
	if (observedRuntimeAugmentation) {
		const reportAugmentationShape = (id, expectedShape, observedShape) => {
			findings.push({
				scope: "entry",
				code: "runtime_augmentation_shape_changed",
				id,
				expected: expectedShape,
				observed: observedShape
			});
			directDriftIds.add(id);
		};
		const host = runtimeAugmentations.filter(({ evidence }) => evidence.role === "host-directory-picker");
		const client = runtimeAugmentations.filter(({ evidence }) => evidence.role === "client-directory-picker");
		const hmr = runtimeAugmentations.filter(({ evidence }) => evidence.role === "hmr");
		for (const [role, entries] of [["host-directory-picker", host], ["client-directory-picker", client]]) if (entries.length !== 1) reportAugmentationShape(`rc6-runtime-augmentation-${role}`, `exactly one ${role} helper`, entries.map(({ entry }) => entry.packageName));
		if (hmr.length > 1) reportAugmentationShape("rc6-runtime-augmentation-hmr", "zero or one hmr helper", hmr.map(({ entry }) => entry.packageName));
		if (host.length === 1 && client.length === 1 && host[0].evidence.variant !== client[0].evidence.variant) reportAugmentationShape("rc6-runtime-augmentation-directory-picker-variant", "matching host/client directory-picker variants", [host[0].entry.packageName, client[0].entry.packageName]);
		for (const { entry } of runtimeAugmentations) if (entry.declaredInjectKnown !== false && entry.declaredInject !== null) reportAugmentationShape(`rc6-runtime-augmentation-inject-${entry.id}`, "no declared inject", entry.declaredInject);
	}
	const identityBound = identityStatus === "matched";
	const unverifiedCount = incompleteReviewedIds.size + (identityBound ? 0 : structurallyMatchingReviewedIds.size);
	return {
		status: identityStatus === "mismatched" || directDriftIds.size > 0 ? "drifted" : unverifiedCount > 0 ? "unverified" : "verified",
		runtimeIdentity: {
			expected: expectedIdentity,
			observed: runtimeIdentity,
			status: identityStatus
		},
		findings,
		verifiedCount: identityBound ? structurallyMatchingReviewedIds.size : 0,
		driftedCount: directDriftIds.size,
		unverifiedCount
	};
}
//#endregion
//#region src/eligibility.ts
/**
* Per-entry mutation eligibility.
*
* Inspection compatibility answers whether this complete runtime can be bound
* to a reviewed release. Mutation eligibility is narrower: it only permits a
* reviewed UI leaf after its own structural evidence and every observable
* dependency assumption remain intact. A missing Host release identity is an
* explicitly reported limitation, not a fabricated verification result and
* not, by itself, an automatic denial.
*/
function hasCompleteSafeLeafEvidence(entry) {
	return entry !== void 0 && entry.expectedPackageName !== null && entry.leafReview === "reviewed-safe-ui-leaf" && entry.reviewedReference !== null && entry.dependencyEvidence.provides.status === "observed" && entry.dependencyEvidence.consumers.status === "observed";
}
function addReason(reasons, reason) {
	if (!reasons.includes(reason)) reasons.push(reason);
}
/**
* Decide one requested mutation from runtime facts available through public
* Loader APIs. It intentionally does not use `compatibility.status`: a Host
* may not expose release identity, while target-local evidence can still be
* exact. Conversely, a discovered composition change is denied when the
* public seam cannot show that it is not a new consumer of a reviewed leaf.
*/
function evaluateMutationEligibility(id, runtimeEntries, baseline = REVIEWED_DSH_WEB_BASELINE, compatibility = evaluateCompatibility(runtimeEntries, baseline), profileMutation = { status: "writable" }) {
	const reasons = [];
	const limitations = ["consumer_graph_not_exposed"];
	const reviewed = baselineById(baseline).get(id);
	const targetEntries = runtimeEntries.filter((entry) => entry.id === id && (entry.compositionScope ?? "host") === "host");
	if (!MANAGEABLE.has(id)) addReason(reasons, "not_manageable");
	if (targetEntries.length === 0) addReason(reasons, "missing_runtime_entry");
	if (reviewed === void 0) addReason(reasons, "reviewed_baseline_missing");
	if (!hasCompleteSafeLeafEvidence(reviewed)) addReason(reasons, "reviewed_safe_leaf_evidence_missing");
	if (profileMutation.status !== "writable") addReason(reasons, "profile_not_persistable");
	if (compatibility.runtimeIdentity.status === "unavailable") limitations.push("runtime_identity_unavailable");
	else if (compatibility.runtimeIdentity.status === "mismatched") addReason(reasons, "runtime_identity_mismatch");
	for (const finding of compatibility.findings) {
		if (finding.scope === "composition") continue;
		if (finding.id === id) {
			addReason(reasons, "target_structural_drift");
			continue;
		}
		addReason(reasons, "global_structural_drift");
	}
	return {
		status: reasons.length === 0 ? "eligible" : "ineligible",
		reasons,
		limitations
	};
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
* - recognizes an exact TOP-LEVEL mapping id in the safe ordinary YAML
*   spellings (plain or quoted; first or later direct field). An id inside a
*   nested `insert:` block is never edited in place; unfamiliar top-level id
*   syntax refuses the operation rather than risking a duplicate override;
* - adds, replaces, or removes only that row's OWN literal `disabled:` field
*   (at the row's observed child indentation); when restore leaves a minimal
*   row empty, it removes that row while retaining a valid empty sequence;
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
	return /^-(?:\s|$)/.test(line);
}
/** Whether a line is column-0 content (not indented, not blank, not a comment). */
function isTopLevelContent(line) {
	return line.length > 0 && !/^\s/.test(line) && !line.startsWith("#");
}
/**
* Read only the boring YAML scalar spellings we can preserve byte-for-byte.
* YAML has many more legal scalar forms; those are deliberately ambiguous
* here rather than being half-parsed into a possibly different id.
*/
function parseSafeScalar(raw) {
	const value = raw.trim();
	const plain = /^([A-Za-z0-9][A-Za-z0-9._/@+-]*)(?:\s+#.*)?$/.exec(value);
	if (plain !== null) return {
		status: "known",
		value: plain[1]
	};
	const single = /^'((?:''|[^'])*)'(?:\s+#.*)?$/.exec(value);
	if (single !== null) return {
		status: "known",
		value: single[1].replace(/''/g, "'")
	};
	const double = /^("(?:[^"\\]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*")(?:\s+#.*)?$/.exec(value);
	if (double !== null) try {
		return {
			status: "known",
			value: JSON.parse(double[1])
		};
	} catch {}
	return { status: "ambiguous" };
}
function isPropertyKey(raw, expected) {
	return raw === expected || raw === `'${expected}'` || raw === `"${expected}"`;
}
function propertyValue(line, indent, listItem, key) {
	const prefix = listItem ? `^-\\s+` : `^${" ".repeat(indent)}`;
	const match = new RegExp(`${prefix}((?:id|disabled)|'(?:id|disabled)'|"(?:id|disabled)")\\s*:\\s*(.*)$`).exec(line);
	return match !== null && isPropertyKey(match[1], key) ? match[2] : null;
}
function inlineMappingValue(line) {
	const match = /^-\s+[^\s:#][^:]*:\s*(.*)$/.exec(line);
	return match === null ? null : match[1];
}
function inlineMappingKey(line) {
	const match = /^-\s+([^\s:#][^:]*):\s*/.exec(line);
	return match === null ? null : match[1];
}
function isScalarAnchor(raw) {
	if (parseSafeScalar(raw).status === "known") return true;
	return /^(?![!&*|>{[\]])[^\s:#][^\s#]*(?:\s+#.*)?$/.test(raw.trim());
}
function mappingValueAtIndent(line, indent) {
	const match = new RegExp(`^${" ".repeat(indent)}[^\\s:#][^:]*:\\s*(.*)$`).exec(line);
	return match === null ? null : match[1];
}
function rowShape(lines, start) {
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i += 1) if (isTopLevelItem(lines[i]) || isTopLevelContent(lines[i])) {
		end = i;
		break;
	}
	const itemContent = lines[start].slice(1).trimStart();
	const transparent = itemContent.length === 0 || /^(?:[A-Za-z][A-Za-z0-9_-]*|'(?:''|[^'])*'|"(?:[^"\\]|\\.)*")\s*:/.test(itemContent);
	const idFields = [];
	const inline = propertyValue(lines[start], 0, true, "id");
	if (inline !== null) idFields.push({
		index: start,
		scalar: parseSafeScalar(inline)
	});
	const inlineValue = inlineMappingValue(lines[start]);
	const scalarAnchor = inlineValue !== null && isScalarAnchor(inlineValue);
	const inlineKey = inlineMappingKey(lines[start]);
	const directIndent = scalarAnchor ? 2 : null;
	let safeNestedInsert = inlineKey === "insert" && inlineValue !== null && inlineValue.trim() === "";
	let opaqueDescendant = false;
	let nestedMappingOpen = false;
	for (let i = start + 1; i < end; i += 1) {
		const line = lines[i];
		const trimmed = line.trimStart();
		if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
		const indent = line.length - trimmed.length;
		if (directIndent === null) {
			if (safeNestedInsert && indent > 2 && trimmed.startsWith("-")) continue;
			else if (safeNestedInsert && indent > 2) continue;
			else {
				opaqueDescendant = true;
				continue;
			}
		}
		if (indent > directIndent) {
			if (!nestedMappingOpen) opaqueDescendant = true;
			continue;
		}
		if (indent < directIndent || trimmed.startsWith("-")) {
			opaqueDescendant = true;
			continue;
		}
		nestedMappingOpen = mappingValueAtIndent(line, directIndent)?.trim() === "";
		const value = propertyValue(line, directIndent, false, "id");
		if (value !== null) idFields.push({
			index: i,
			scalar: parseSafeScalar(value)
		});
	}
	return {
		start,
		end,
		directIndent,
		transparent: transparent && !opaqueDescendant,
		idFields
	};
}
/** Locate one exact top-level override row without ever traversing `insert:`. */
function locateTargetRow(lines, id) {
	const matches = [];
	for (let i = 0; i < lines.length; i += 1) {
		if (!isTopLevelItem(lines[i])) continue;
		const shape = rowShape(lines, i);
		if (!shape.transparent) throw new PatchError(`builtin-toggles: ambiguous top-level id near line ${i + 1}; refusing to guess`);
		for (const field of shape.idFields) {
			if (field.scalar.status === "ambiguous") throw new PatchError(`builtin-toggles: ambiguous top-level id near line ${field.index + 1}; refusing to guess`);
			if (field.scalar.value === id) matches.push(shape);
		}
	}
	const uniqueMatches = [...new Set(matches)];
	if (uniqueMatches.length > 1 || (uniqueMatches[0]?.idFields.length ?? 0) > 1) throw new PatchError(`builtin-toggles: duplicate top-level override rows for ${id}; refusing to guess`);
	const target = uniqueMatches[0];
	if (target === void 0) return null;
	const { start, end, directIndent } = target;
	const indent = " ".repeat(directIndent ?? 2);
	const rowInlineComment = /^-\s+(?:id|'id'|"id"):\s*(?:\S+|'(?:''|[^'])*'|"(?:[^"\\]|\\.)*")(\s+#.*)?\s*$/.exec(lines[start])?.[1] ?? "";
	let disabledIndex = -1;
	let disabledValue = null;
	let disabledSuffix = "";
	for (let i = start + 1; i < end; i += 1) {
		const line = lines[i];
		if (directIndent === null) continue;
		if (propertyValue(line, directIndent, false, "disabled") === null) continue;
		if (disabledIndex !== -1) throw new PatchError(`builtin-toggles: duplicate disabled fields for ${id}; refusing to guess`);
		disabledIndex = i;
		const literal = new RegExp(`^${indent}(?:disabled|'disabled'|"disabled"):\\s*(true|false)(\\s*(?:#.*)?)?$`).exec(line);
		if (literal === null) throw new PatchError(`builtin-toggles: ${id} has a non-literal disabled override; refusing to rewrite it`);
		disabledValue = literal[1] === "true";
		disabledSuffix = literal[2] ?? "";
	}
	return {
		start,
		end,
		indent,
		disabledIndex,
		disabledValue,
		disabledSuffix,
		rowInlineComment
	};
}
/** Read only the current profile-layer override; no YAML reserialization. */
function inspectProfileOverride(content, id) {
	const lines = content.length === 0 ? [] : content.split(/\r?\n/);
	try {
		const row = locateTargetRow(lines, id);
		if (row === null || row.disabledIndex === -1) return { state: "inherited" };
		return { state: row.disabledValue ? "explicitly-disabled" : "explicitly-enabled" };
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		return {
			state: "unavailable",
			reason: message.includes("duplicate top-level") ? "duplicate_top_level_row" : message.includes("duplicate disabled") ? "duplicate_disabled_field" : message.includes("ambiguous top-level id") ? "ambiguous_top_level_id" : "non_literal_disabled"
		};
	}
}
/**
* Read-only preflight for the known writer rejection paths. It intentionally
* does not lock or commit anything: `applyProfilePatch()` still takes the
* writer lock and repeats all read/render/concurrency checks at commit time.
*/
function preflightProfileMutation(file, id) {
	return inspectProfileSnapshot(file, [id]).profilePersistence.get(id);
}
function preflightContent(content, id) {
	try {
		locateTargetRow(content.length === 0 ? [] : content.split(/\r?\n/), id);
		return { status: "writable" };
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (message.includes("duplicate top-level")) return {
			status: "unwritable",
			reason: "duplicate_top_level_row"
		};
		if (message.includes("duplicate disabled")) return {
			status: "unwritable",
			reason: "duplicate_disabled_field"
		};
		if (message.includes("ambiguous top-level id")) return {
			status: "unwritable",
			reason: "ambiguous_top_level_id"
		};
		return {
			status: "unwritable",
			reason: "non_literal_disabled"
		};
	}
}
/** Read one regular profile file once, then derive every target state purely. */
function inspectProfileSnapshot(file, ids) {
	const profileOverrides = /* @__PURE__ */ new Map();
	const profilePersistence = /* @__PURE__ */ new Map();
	let content;
	try {
		const stat = lstatSync(file);
		if (stat.isSymbolicLink() || !stat.isFile()) throw new PatchError("profile patch is not a regular file");
		content = readFileSync(file, "utf8");
	} catch (error) {
		const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
		for (const id of ids) {
			profileOverrides.set(id, code === "ENOENT" ? { state: "inherited" } : {
				state: "unavailable",
				reason: "profile_unavailable"
			});
			profilePersistence.set(id, {
				status: "unwritable",
				reason: code === "ENOENT" ? "profile_patch_missing" : "profile_patch_unreadable"
			});
		}
		return {
			profileOverrides,
			profilePersistence
		};
	}
	for (const id of ids) {
		profileOverrides.set(id, inspectProfileOverride(content, id));
		profilePersistence.set(id, preflightContent(content, id));
	}
	return {
		profileOverrides,
		profilePersistence
	};
}
/**
* Render `content` with the top-level override row for `id` set to
* `disabled`. Pure: no filesystem access, no parsing of unknown structure.
*/
function renderDisabledPatch(content, id, disabled) {
	const eol = detectEol(content);
	const lines = [...content.length === 0 ? [] : content.split(/\r?\n/)];
	const value = String(disabled);
	const defaultChildIndent = 2;
	const target = locateTargetRow(lines, id);
	if (target !== null) {
		if (target.disabledIndex !== -1) {
			if (target.disabledValue === disabled) return {
				content,
				changed: false,
				createdRow: false
			};
			lines[target.disabledIndex] = `${target.indent}disabled: ${value}${target.disabledSuffix}`;
		} else {
			const insertAt = target.end === lines.length && lines[lines.length - 1] === "" ? target.end - 1 : target.end;
			lines.splice(insertAt, 0, `${target.indent}disabled: ${value}`);
		}
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
/** Remove only this row's literal top-level `disabled` override. */
function renderRestoreInheritance(content, id) {
	const eol = detectEol(content);
	const lines = content.length === 0 ? [] : content.split(/\r?\n/);
	const target = locateTargetRow(lines, id);
	if (target === null || target.disabledIndex === -1) return {
		content,
		changed: false,
		createdRow: false
	};
	const hasOtherContent = lines.slice(target.start + 1, target.end).some((line, index) => {
		return target.start + 1 + index !== target.disabledIndex && line.trim() !== "" && !line.trimStart().startsWith("#");
	});
	const hasComments = lines.slice(target.start + 1, target.end).some((line, index) => {
		return target.start + 1 + index !== target.disabledIndex && line.trimStart().startsWith("#");
	}) || target.disabledSuffix.trim().length > 0 || target.rowInlineComment.length > 0;
	if (!hasOtherContent && !hasComments) {
		lines.splice(target.disabledIndex, 1);
		lines.splice(target.start, 1);
		if (lines.every((line) => line.trim() === "" || line.trimStart().startsWith("#"))) {
			const trailing = lines.length > 0 && lines[lines.length - 1] === "";
			lines.splice(trailing ? lines.length - 1 : lines.length, 0, "[]");
		}
	} else if (!hasOtherContent) {
		lines.splice(target.disabledIndex, 1);
		lines.splice(target.start, 1);
		if (target.rowInlineComment.length > 0) lines.splice(target.start, 0, target.rowInlineComment.trimStart());
		if (lines.every((line) => line.trim() === "" || line.trimStart().startsWith("#"))) {
			const trailing = lines.length > 0 && lines[lines.length - 1] === "";
			lines.splice(trailing ? lines.length - 1 : lines.length, 0, "[]");
		}
	} else if (target.disabledSuffix.trim().length > 0) lines[target.disabledIndex] = `${target.indent}${target.disabledSuffix.trimStart()}`;
	else lines.splice(target.disabledIndex, 1);
	return {
		content: lines.join(eol),
		changed: true,
		createdRow: false
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
	lock: withFileLock,
	stat: lstatSync
};
function regularFileIdentity(file, deps) {
	let stat;
	try {
		stat = (deps.stat ?? lstatSync)(file);
	} catch (error) {
		throw new PatchError((error && typeof error === "object" && "code" in error ? error.code : void 0) === "ENOENT" ? `builtin-toggles: profile patch missing: ${file}; refusing to create it implicitly` : `builtin-toggles: cannot inspect profile patch: ${file}`);
	}
	if (stat.isSymbolicLink() || !stat.isFile()) throw new PatchError(`builtin-toggles: profile patch must be a regular non-symlink file: ${file}`);
	return {
		mode: stat.mode & 511,
		dev: stat.dev,
		ino: stat.ino
	};
}
function sameFile(left, right) {
	return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}
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
	return applyProfilePatch(file, (content) => renderDisabledPatch(content, id, disabled), deps);
}
/** Restore Loader inheritance by deleting this profile row's `disabled` field. */
async function restoreDisabledInheritance(file, id, deps = realDeps) {
	return applyProfilePatch(file, (content) => renderRestoreInheritance(content, id), deps);
}
async function applyProfilePatch(file, render, deps) {
	regularFileIdentity(file, deps);
	return deps.lock(file, async () => {
		const before = regularFileIdentity(file, deps);
		const original = deps.read(file);
		if (!sameFile(before, regularFileIdentity(file, deps))) throw new ConcurrentEditError(file);
		const rendered = render(original);
		if (!rendered.changed) return {
			changed: false,
			createdRow: false
		};
		if (deps.read(file) !== original) throw new ConcurrentEditError(file);
		const final = regularFileIdentity(file, deps);
		if (!sameFile(before, final)) throw new ConcurrentEditError(file);
		await deps.writeAtomic(file, rendered.content, final.mode);
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
*   1. policy + per-entry eligibility gate (allowlist → body schema → entry
*      → official module → reviewed structural evidence); any refusal is a
*      4xx with zero mutation;
*   2. conservative profile-writer preflight; known persistence refusals are
*      returned before the Loader is touched;
*   3. force-enable/disable update the Loader, then persist the same override;
*      restore persists first and lets DSH's profile/HMR recomposition expose
*      the lower layer (Loader `disabled: null` alone cannot do that);
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
	const body = parseMutationBody(rawBody);
	const entries = deps.listEntries();
	const entry = entries.find((candidate) => candidate.facts.id === id);
	const verdict = checkMutation(id, entry?.facts, body);
	if (!verdict.ok) return refuse(verdict.status, verdict.code, verdict.message);
	const action = "disabled" in body ? body.disabled ? "force-disable" : "force-enable" : body.action;
	const runtimeEvidence = entries.map((candidate) => ({
		id: candidate.facts.id,
		packageName: candidate.facts.name,
		declaredInject: candidate.declaredInject,
		declaredInjectKnown: candidate.declaredInjectKnown
	}));
	const profileMutation = deps.profilePreflight?.(deps.patchFile, id) ?? preflightProfileMutation(deps.patchFile, id);
	const eligibility = evaluateMutationEligibility(id, runtimeEvidence, deps.eligibilityBaseline, void 0, profileMutation);
	if (eligibility.status !== "eligible") return refuse(409, "mutation_ineligible", `builtin-toggles: ${id} is not eligible (${eligibility.reasons.join(", ")})`);
	const disabled = action === "force-disable" ? true : action === "force-enable" ? false : null;
	const previousOwn = entry.ownDisabled;
	if (action === "restore-inheritance") try {
		return {
			status: 200,
			body: {
				ok: true,
				id,
				action,
				disabled,
				runtimeEffect: "recomposing",
				persisted: (await deps.persist(deps.patchFile, id, action)).changed
			}
		};
	} catch (error) {
		return persistFailure(error);
	}
	try {
		await entry.update({ disabled });
	} catch (error) {
		return refuse(500, "runtime_update_failed", errorMessage(error, `loader entry update failed for ${id}`));
	}
	let persisted = false;
	try {
		persisted = (await deps.persist(deps.patchFile, id, action)).changed;
	} catch (error) {
		const rollbackError = await rollbackRuntime(entry, previousOwn);
		if (rollbackError !== void 0) return refuse(500, "persist_failed", `persist failed (${errorMessage(error, "write error")}) and runtime rollback also failed (${rollbackError}); profile may be inconsistent`);
		return persistFailure(error);
	}
	return {
		status: 200,
		body: {
			ok: true,
			id,
			action,
			disabled,
			runtimeEffect: "applied",
			persisted
		}
	};
}
function persistFailure(error) {
	if (error instanceof ConcurrentEditError) return refuse(409, "concurrent_edit", error.message);
	if (error instanceof PatchError) return refuse(500, "patch_refused", error.message);
	return refuse(500, "persist_failed", errorMessage(error, "failed to write profile patch"));
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
function buildInspectionResponse(entries, runtimeIdentity, profile, mutationAccess) {
	const baseline = baselineById();
	const runtimeEvidence = entries.map((entry) => ({
		id: entry.id,
		packageName: entry.name,
		declaredInject: entry.declaredInject,
		declaredInjectKnown: entry.declaredInjectKnown,
		scopeId: entry.scopeId,
		compositionScope: entry.compositionScope
	}));
	const compatibility = evaluateCompatibility(runtimeEvidence, REVIEWED_DSH_WEB_BASELINE, runtimeIdentity);
	const findingCodesById = /* @__PURE__ */ new Map();
	for (const finding of compatibility.findings) {
		if (finding.scope !== "entry" || finding.id === void 0) continue;
		findingCodesById.set(finding.id, finding.code === "baseline_package_unknown" || finding.code === "new_official_entry" ? "unverified" : "drifted");
	}
	const identityVerified = compatibility.runtimeIdentity.status === "matched";
	const capabilities = entries.map((entry) => {
		const reviewed = baseline.get(entry.id);
		const presetRow = entry.compositionScope === "agent-preset";
		const policy = classifyEntry(entry);
		const override = profile.profileOverrides.get(entry.id) ?? {
			state: "unavailable",
			reason: "profile_unavailable"
		};
		const writable = profile.profilePersistence.get(entry.id) ?? {
			status: "unwritable",
			reason: "profile_patch_unreadable"
		};
		return {
			id: entry.id,
			packageName: entry.name,
			official: entry.name.startsWith(OFFICIAL_PACKAGE_PREFIX),
			scopeId: entry.scopeId,
			compositionScope: entry.compositionScope,
			runtimeState: {
				disabled: entry.disabled,
				lifecycle: lifecycleFor(entry.phase)
			},
			configuration: {
				profileOverride: presetRow ? {
					state: "unavailable",
					reason: "profile_unavailable"
				} : override,
				profilePersistence: presetRow ? {
					status: "unwritable",
					reason: "profile_patch_unreadable"
				} : writable,
				profileApplicability: presetRow ? "not-applicable" : "applicable",
				effectiveDisabled: entry.disabled,
				agentPresetManaged: reviewed?.managementPlane === "agent-preset"
			},
			managementPlane: reviewed?.managementPlane ?? unknownPlane(),
			category: reviewed?.category ?? unknownCategory(),
			policy: presetRow ? {
				status: "locked",
				reason: "agent-preset"
			} : policy.manageable ? { status: "manageable" } : {
				status: "locked",
				reason: policy.reason
			},
			verification: presetRow ? "unverified" : findingCodesById.get(entry.id) ?? (reviewed === void 0 ? "unverified" : !identityVerified ? "unverified" : "verified"),
			mutationEligibility: presetRow ? {
				status: "ineligible",
				reasons: ["agent_preset_scope"],
				limitations: ["consumer_graph_not_exposed"]
			} : evaluateMutationEligibility(entry.id, runtimeEvidence, REVIEWED_DSH_WEB_BASELINE, compatibility, writable),
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
		access: { mutation: mutationAccess },
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
/**
* The Loader's own public identity for one entry: `options.id` prefixed by
* every owning tree entry (`EntryTree.sep`-joined). Two entries with the same
* `scopeId` claim the same Loader namespace slot.
*/
function scopeIdOf(entry) {
	return entry.id;
}
/**
* Walk the tree-owner chain through public fields. An entry whose owning tree
* chain contains the `agent-presets` entry lives in a per-session Agent
* Preset composition; everything else is Host composition (the root tree, the
* profile include tree, and any other non-preset subtree).
*/
function compositionScopeOf(entry) {
	const visited = /* @__PURE__ */ new Set();
	let owner = entry.parent?.tree?.ctx?.fiber?.entry;
	while (owner !== void 0) {
		if (visited.has(owner)) break;
		visited.add(owner);
		if (owner.options?.name === "@deepseek-ai/dsh-agent-presets") return "agent-preset";
		owner = owner.parent?.tree?.ctx?.fiber?.entry;
	}
	return "host";
}
/** Project both facts from one public Loader entry. */
function scopedEntryFacts(entry) {
	return {
		scopeId: scopeIdOf(entry),
		compositionScope: compositionScopeOf(entry)
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
function injectEvidence(entry) {
	const inject = entry.options.inject;
	if (inject === void 0) return {
		declaredInject: null,
		declaredInjectKnown: true
	};
	if (Array.isArray(inject) && inject.every((value) => typeof value === "string")) return {
		declaredInject: inject,
		declaredInjectKnown: true
	};
	return {
		declaredInject: null,
		declaredInjectKnown: false
	};
}
function inspectionEntry(entry) {
	const inject = injectEvidence(entry);
	return {
		...entryFacts(entry),
		...inject,
		...scopedEntryFacts(entry),
		ownDisabled: typeof entry.options.disabled === "boolean" ? entry.options.disabled : void 0
	};
}
/** Snapshot rows: manageable + official + self (external packages stay invisible). */
function buildSnapshot(entries) {
	const seen = /* @__PURE__ */ new Set();
	const plugins = [];
	for (const entry of entries) {
		if (entry.options.group) continue;
		if (typeof entry.options.name !== "string") continue;
		if (compositionScopeOf(entry) !== "host") continue;
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
	const inject = injectEvidence(entry);
	return {
		facts: entryFacts(entry),
		ownDisabled: entry.options.disabled ?? void 0,
		...inject,
		update: (options) => entry.update(options)
	};
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
				const mutationAccess = isTrustedRequest(req.headers, []) ? "allowed" : "loopback-required";
				if (method === "GET" && pathname === INSPECTION_API_PATH) {
					const entries = [...ctx.loader.entries()].filter((entry) => !entry.options.group).map(inspectionEntry);
					sendJson(res, 200, buildInspectionResponse(entries, null, inspectProfileSnapshot(profilePatchPath("web"), entries.map((entry) => entry.id)), mutationAccess));
					return;
				}
				if (method === "GET" && pathname === "/api/builtin-toggles") {
					sendJson(res, 200, { plugins: buildSnapshot([...ctx.loader.entries()]) });
					return;
				}
				const match = /^\/api\/builtin-toggles\/([^/]+)$/.exec(pathname);
				if (method === "POST" && match !== null) {
					if (mutationAccess !== "allowed") {
						sendJson(res, 403, {
							ok: false,
							error: "loopback_required",
							message: "builtin-toggles: configuration mutation requires loopback same-origin access"
						});
						return;
					}
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
						profilePreflight: preflightProfileMutation,
						listEntries: () => [...ctx.loader.entries()].filter((entry) => !entry.options.group).filter((entry) => compositionScopeOf(entry) === "host").map(entryHandle),
						persist: async (file, targetId, action) => {
							return { changed: (action === "restore-inheritance" ? await restoreDisabledInheritance(file, targetId) : await applyDisabledOverride(file, targetId, action === "force-disable")).changed };
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
