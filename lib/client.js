window.__ModuleLoader__.load({
	id: "dsh-builtin-toggles",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/EvidenceDetails.tsx
		const grid = {
			display: "grid",
			gridTemplateColumns: "minmax(150px, 1fr) minmax(220px, 2fr)",
			gap: "4px 12px",
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			marginTop: 8,
			paddingTop: 8
		};
		const key = {
			margin: 0,
			fontSize: 11,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)",
			fontWeight: 600
		};
		const value = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)",
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere"
		};
		function EvidenceDetails({ capability, snapshot, t }) {
			const findings = snapshot.compatibility.findings.filter((finding) => finding.id === capability.id);
			const dependency = capability.baseline.dependencyEvidence;
			const reference = capability.baseline.reviewedReference;
			const fields = [
				[t("compositionScope"), `${capability.compositionScope} · ${capability.scopeId}`],
				[t("expectedPackage"), capability.baseline.expectedPackageName ?? t("noEvidence")],
				[t("reviewed"), capability.baseline.reviewed ? t("yes") : t("no")],
				[t("reviewedReference"), reference === null ? t("noEvidence") : `${reference.source} · ${reference.packageName}@${reference.version} · ${reference.artifact}`],
				[t("declaredInject"), capability.baseline.serviceEvidence.length === 0 ? t("noEvidence") : capability.baseline.serviceEvidence.map((item) => item.expectedServices === null ? t("injectNotDeclared") : item.expectedServices.length === 0 ? t("injectDeclaredEmpty") : item.expectedServices.join(", ")).join("; ")],
				[t("dependencyEvidence"), dependency === null ? t("noEvidence") : `${t("provides")}: ${dependencyStatusLabel(t, dependency.provides.status)}${dependency.provides.services === void 0 ? "" : ` (${dependency.provides.services.join(", ")})`} · ${t("consumers")}: ${dependencyStatusLabel(t, dependency.consumers.status)}${dependency.consumers.ids === void 0 ? "" : ` (${dependency.consumers.ids.join(", ")})`}`],
				[t("leafReview"), leafReviewLabel(t, capability.baseline.leafReview)],
				[t("compatibilityFindings"), findings.map((finding) => `${findingLabel(t, finding.code)} (${finding.code})`).join("; ") || t("noFindings")],
				[t("profilePersistence"), profilePersistenceLabel(capability, t)],
				[t("eligibilityReasons"), capability.mutationEligibility.reasons.map((reason) => `${eligibilityReasonLabel(t, reason)} (${reason})`).join(", ") || t("none")],
				[t("limitations"), capability.mutationEligibility.limitations.map((limitation) => `${limitationLabel(t, limitation)} (${limitation})`).join(", ") || t("none")]
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
				style: grid,
				children: fields.map(([field, content]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: { display: "contents" },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
						style: key,
						children: field
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
						style: value,
						children: content
					})]
				}, field))
			});
		}
		function capitalize$4(value) {
			return value.replace(/(^|_)([a-z])/g, (_all, _prefix, char) => char.toUpperCase());
		}
		function findingLabel(t, code) {
			return t(`finding${capitalize$4(code)}`);
		}
		function eligibilityReasonLabel(t, reason) {
			return t(`eligibility${capitalize$4(reason)}`);
		}
		function limitationLabel(t, limitation) {
			return t(`limitation${capitalize$4(limitation)}`);
		}
		function dependencyStatusLabel(t, status) {
			return status === "observed" ? t("dependencyObserved") : t("unknown");
		}
		function leafReviewLabel(t, leafReview) {
			if (leafReview === null) return t("noEvidence");
			switch (leafReview) {
				case "reviewed-safe-ui-leaf": return `${t("leafReviewReviewedSafeUiLeaf")} (${leafReview})`;
				case "locked-dependency": return `${t("leafReviewLockedDependency")} (${leafReview})`;
				default: return `${t("leafReviewNotReviewed")} (${leafReview})`;
			}
		}
		function profilePersistenceLabel(capability, t) {
			if (capability.configuration.profileApplicability === "not-applicable") return t("profileNotApplicable");
			return `${capability.configuration.profilePersistence.status === "writable" ? t("profileWritable") : t("profileUnwritable")}${"reason" in capability.configuration.profilePersistence && capability.configuration.profilePersistence.reason !== void 0 ? ` (${capability.configuration.profilePersistence.reason})` : ""}`;
		}
		//#endregion
		//#region src/client/labels.ts
		function categoryLabel(t, value) {
			return t(`category${capitalize$3(value)}`);
		}
		function planeLabel(t, value) {
			return t(`plane${capitalize$3(value)}`);
		}
		function policyLabel(t, value) {
			return t(`policy${capitalize$3(value)}`);
		}
		function lockLabel(t, value) {
			return t(`lock${capitalize$3(value)}`);
		}
		function lifecycleLabel(t, value) {
			return t(`lifecycle${capitalize$3(value)}`);
		}
		function verificationLabel(t, value) {
			return t(`verification${capitalize$3(value)}`);
		}
		function capitalize$3(value) {
			return value.replace(/(^|[-_])([a-z])/g, (_all, _prefix, char) => char.toUpperCase());
		}
		//#endregion
		//#region src/client/inspector-model.ts
		const EMPTY_FILTERS = {
			query: "",
			category: "all",
			managementPlane: "all",
			compositionScope: "all",
			policy: "all",
			verification: "all",
			runtime: "all",
			anomaliesOnly: false
		};
		/**
		* Anomalies-only must agree with the compatibility evaluator: a row is an
		* anomaly when the evaluator observed a concrete problem with it, or when its
		* profile/runtime state is broken. An official row without a baseline row is
		* NOT an anomaly by itself — the evaluator explicitly accepts reviewed rc.6
		* runtime augmentations (Host-generated helper ids, per-session Agent Preset
		* rows) that have no published baseline row.
		*/
		function capabilityHasAnomaly(capability, snapshot) {
			const profileNotApplicable = capability.configuration.profileApplicability === "not-applicable";
			return capability.verification === "drifted" || !profileNotApplicable && capability.configuration.profileOverride.state === "unavailable" || !profileNotApplicable && capability.configuration.profilePersistence.status === "unwritable" || capability.runtimeState.lifecycle === "failed" || snapshot.compatibility.findings.some((finding) => finding.id === capability.id);
		}
		/**
		* Derive the user-facing verification label for one capability.
		*
		* This is display-only. The server DTO's `verification` field remains the
		* exact machine status, and diagnostics/API consumers keep using it.
		*/
		function verificationPresentationKey(capability, snapshot) {
			if (capability.verification === "drifted") return "drifted";
			if (capability.verification === "verified") return "verified";
			if (capability.compositionScope === "agent-preset") return "not-applicable";
			if (!capability.official || !capability.baseline.reviewed) return "unreviewed";
			if (capability.baseline.expectedPackageName === null) return "evidence-incomplete";
			if (snapshot.compatibility.findings.some((finding) => finding.id === capability.id && finding.code === "baseline_package_unknown")) return "evidence-incomplete";
			if (snapshot.compatibility.runtimeIdentity.status === "mismatched") return "identity-mismatch";
			return "no-drift";
		}
		/** Verification filter values that actually occur in this snapshot. */
		function verificationFilterValues(snapshot) {
			return [...new Set(snapshot.capabilities.map((capability) => verificationPresentationKey(capability, snapshot)))].sort();
		}
		function filterCapabilities(snapshot, filters, presentation) {
			const query = filters.query.trim().toLowerCase();
			return snapshot.capabilities.filter((capability) => {
				const display = presentation?.(capability);
				if (query && ![
					display?.title,
					display?.summary,
					capability.id,
					capability.packageName,
					capability.category,
					capability.managementPlane,
					capability.compositionScope
				].join(" ").toLowerCase().includes(query)) return false;
				if (filters.category !== "all" && capability.category !== filters.category) return false;
				if (filters.managementPlane !== "all" && capability.managementPlane !== filters.managementPlane) return false;
				if (filters.compositionScope !== "all" && capability.compositionScope !== filters.compositionScope) return false;
				if (filters.policy !== "all" && capability.policy.status !== filters.policy) return false;
				if (filters.verification !== "all" && verificationPresentationKey(capability, snapshot) !== filters.verification) return false;
				if (filters.runtime !== "all" && capability.runtimeState.lifecycle !== filters.runtime) return false;
				return !filters.anomaliesOnly || capabilityHasAnomaly(capability, snapshot);
			});
		}
		/** A deliberately allowlisted, local-path-free diagnostic report. */
		function buildDiagnostics(snapshot) {
			const compatibility = snapshot.compatibility;
			const publicReviewedIds = new Set(snapshot.capabilities.filter((capability) => capability.official && capability.baseline.reviewed && capability.baseline.expectedPackageName === capability.packageName).map((capability) => capability.id));
			const publicCapability = (capability) => publicReviewedIds.has(capability.id);
			const diagnosticFinding = (finding) => {
				const id = finding.id !== void 0 && publicReviewedIds.has(finding.id) ? ` (${finding.id})` : finding.id === void 0 ? "" : " (redacted)";
				return `- ${finding.scope}:${finding.code}${id}`;
			};
			return [
				"dsh-builtin-toggles capability inspector",
				`schemaVersion: ${snapshot.schemaVersion}`,
				`compatibility: ${compatibility.status}`,
				`runtimeIdentity: ${compatibility.runtimeIdentity.status}`,
				`inventory: total=${snapshot.inventory.totalEntries}, official=${snapshot.inventory.officialEntries}, external=${snapshot.inventory.externalEntries}, reviewed=${snapshot.inventory.reviewedEntries}`,
				"findings:",
				...compatibility.findings.map(diagnosticFinding),
				"capabilities:",
				...snapshot.capabilities.map((capability) => [
					`- capability=${publicCapability(capability) ? capability.id : "external-or-unreviewed"}`,
					`package=${publicCapability(capability) ? capability.packageName : "redacted"}`,
					`compositionScope=${capability.compositionScope}`,
					`verification=${capability.verification}`,
					`policy=${capability.policy.status}`,
					`eligibility=${capability.mutationEligibility.status}`,
					`reasons=${capability.mutationEligibility.reasons.join(",") || "none"}`,
					`limitations=${capability.mutationEligibility.limitations.join(",") || "none"}`
				].join(" "))
			].join("\n");
		}
		function capabilityFromHash(hash) {
			const match = /^#capability=([^&]+)$/.exec(hash);
			if (match === null) return null;
			try {
				return decodeURIComponent(match[1]);
			} catch {
				return null;
			}
		}
		/** True when the row would have controls under loopback/allowed access. */
		function wouldBeEligibleLocally(capability) {
			return availableActions(capability, { access: { mutation: "allowed" } }).length > 0;
		}
		/** Controls are presentation only; eligibility itself is always server-computed. */
		function availableActions(capability, snapshot) {
			if (snapshot.access.mutation !== "allowed") return [];
			if (capability.compositionScope !== "host") return [];
			if (capability.mutationEligibility.status !== "eligible" || capability.configuration.profileOverride.state === "unavailable" || capability.configuration.profileApplicability !== "applicable") return [];
			switch (capability.configuration.profileOverride.state) {
				case "inherited": return ["force-enable", "force-disable"];
				case "explicitly-enabled": return ["force-disable", "restore-inheritance"];
				case "explicitly-disabled": return ["force-enable", "restore-inheritance"];
			}
		}
		//#endregion
		//#region src/client/MutationControls.tsx
		const row$1 = {
			display: "flex",
			gap: 6,
			flexWrap: "wrap"
		};
		const button$1 = {
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			padding: "4px 8px",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		const muted$1 = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		function MutationControls({ capability, snapshot, busy, onMutate, t }) {
			const actions = availableActions(capability, snapshot);
			if (actions.length === 0) {
				if (snapshot.access.mutation === "loopback-required" && wouldBeEligibleLocally(capability)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: muted$1,
					children: t("remoteReadOnlyEligible")
				});
				if (capability.policy.status === "locked") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: muted$1,
					children: t("controlsUnavailable")
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: muted$1,
					children: `${t("controlsUnavailable")}: ${capability.mutationEligibility.reasons.map((reason) => t(`eligibility${capitalize$2(reason)}`)).join(", ") || t("unknown")}`
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: row$1,
				"aria-label": t("mutationControls"),
				children: [
					actions.includes("force-enable") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button$1,
						disabled: busy,
						onClick: () => onMutate(capability.id, "force-enable"),
						children: t("forceEnable")
					}) : null,
					actions.includes("force-disable") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button$1,
						disabled: busy,
						onClick: () => onMutate(capability.id, "force-disable"),
						children: t("forceDisable")
					}) : null,
					actions.includes("restore-inheritance") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button$1,
						disabled: busy,
						onClick: () => onMutate(capability.id, "restore-inheritance"),
						children: t("restoreInheritance")
					}) : null
				]
			});
		}
		function capitalize$2(value) {
			return value.replace(/(^|_)([a-z])/g, (_all, _prefix, char) => char.toUpperCase());
		}
		//#endregion
		//#region src/client/CapabilityCard.tsx
		const card = {
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 10,
			padding: "12px 14px",
			background: "var(--dsw-alias-bg-layer-3)"
		};
		const title = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const text$1 = {
			margin: "3px 0 0",
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)",
			overflowWrap: "anywhere"
		};
		const tags = {
			display: "flex",
			gap: 5,
			flexWrap: "wrap",
			marginTop: 7
		};
		const tag$1 = {
			borderRadius: 5,
			padding: "1px 6px",
			fontSize: 11,
			lineHeight: "16px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-secondary)"
		};
		const detail = {
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			padding: 0,
			marginTop: 8,
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		function CapabilityCard({ capability, presentation, snapshot, busy, initiallyExpanded, domId, onMutate, t }) {
			const [expanded, setExpanded] = (0, react.useState)(initiallyExpanded);
			const override = capability.configuration.profileApplicability === "not-applicable" ? "not-applicable" : capability.configuration.profileOverride.state;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				id: domId,
				"data-capability-id": capability.id,
				tabIndex: -1,
				style: card,
				"aria-busy": busy || void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: title,
						children: presentation.title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: text$1,
						children: [
							capability.id,
							" · ",
							capability.packageName
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: text$1,
						children: presentation.summary
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: tags,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: categoryLabel(t, capability.category)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: planeLabel(t, capability.managementPlane)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: tag$1,
								children: [
									t("compositionScope"),
									": ",
									planeLabel(t, capability.compositionScope)
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: policyLabel(t, capability.policy.status)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: t(`verification${capitalize$1(verificationPresentationKey(capability, snapshot))}`)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: t(`profile${capitalize$1(override)}`)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: lifecycleLabel(t, capability.runtimeState.lifecycle)
							}),
							capability.configuration.agentPresetManaged ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: t("presetManaged")
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: tag$1,
								children: capability.configuration.effectiveDisabled ? t("effectiveDisabled") : t("effectiveEnabled")
							}),
							capability.policy.reason === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: tag$1,
								children: [
									t("lockReason"),
									": ",
									lockLabel(t, capability.policy.reason)
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { marginTop: 9 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MutationControls, {
							capability,
							snapshot,
							busy,
							onMutate,
							t
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: detail,
						"aria-expanded": expanded,
						onClick: () => setExpanded((value) => !value),
						children: expanded ? t("detailsHide") : t("detailsShow")
					}),
					expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EvidenceDetails, {
						capability,
						snapshot,
						t
					}) : null
				]
			});
		}
		function capitalize$1(value) {
			return value.replace(/(^|[-_])([a-z])/g, (_all, _prefix, char) => char.toUpperCase());
		}
		//#endregion
		//#region src/client/CompatibilitySummary.tsx
		const box = {
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 10,
			padding: "12px 14px",
			background: "var(--dsw-alias-bg-layer-3)",
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const row = {
			display: "flex",
			gap: 8,
			flexWrap: "wrap",
			alignItems: "center"
		};
		const muted = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)",
			overflowWrap: "anywhere"
		};
		const label = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const tag = {
			borderRadius: 5,
			padding: "1px 6px",
			fontSize: 11,
			lineHeight: "16px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-secondary)"
		};
		function CompatibilitySummary({ snapshot, t }) {
			const displayedFindings = snapshot.compatibility.findings.filter((finding) => finding.code !== "runtime_release_identity_unavailable");
			const runtimeIdentity = snapshot.compatibility.runtimeIdentity;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: box,
				"aria-label": t("compatibilityHeading"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							style: label,
							children: t("compatibilityHeading")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: tag,
							children: compatibilityBadge(snapshot, t)
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: muted,
						children: compatibilityExplanation(snapshot, t)
					}),
					runtimeIdentity.status === "unavailable" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: muted,
						children: [
							t("runtimeIdentityLabel"),
							": ",
							t(`runtimeIdentity${capitalize(runtimeIdentity.status)}`)
						]
					}),
					displayedFindings.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: row,
						children: displayedFindings.map((finding, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: tag,
							children: [t(`finding${capitalize(finding.code)}`), finding.id === void 0 ? "" : ` · ${finding.id}`]
						}, `${finding.code}-${finding.id ?? index}`))
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: muted,
						children: t("noFindings")
					})
				]
			});
		}
		function capitalize(value) {
			return value.replace(/(^|_)([a-z])/g, (_all, _prefix, char) => char.toUpperCase());
		}
		function compatibilityBadge(snapshot, t) {
			if (snapshot.compatibility.status === "drifted") return snapshot.compatibility.runtimeIdentity.status === "mismatched" ? t("verificationIdentityMismatch") : t("compatibilityStatusDrifted");
			if (snapshot.compatibility.status === "verified") return t("verificationVerified");
			if (snapshot.compatibility.findings.some((finding) => finding.code === "baseline_package_unknown")) return t("verificationUnverified");
			if (snapshot.compatibility.findings.some((finding) => finding.code !== "runtime_release_identity_unavailable")) return t("verificationUnverified");
			return t("compatibilityStatusNoDrift");
		}
		function compatibilityExplanation(snapshot, t) {
			if (snapshot.compatibility.runtimeIdentity.status === "mismatched") return t("compatibilityExplainIdentityMismatch");
			if (snapshot.compatibility.status === "drifted") return t("compatibilityExplainDrifted");
			if (snapshot.compatibility.status === "verified") return t("compatibilityExplainVerified");
			if (snapshot.compatibility.findings.some((finding) => finding.code === "baseline_package_unknown")) return t("compatibilityExplainEvidenceIncomplete");
			if (snapshot.compatibility.findings.some((finding) => finding.code !== "runtime_release_identity_unavailable")) return t("compatibilityExplainUnverified");
			return t("compatibilityExplainNoDrift");
		}
		//#endregion
		//#region src/client/InspectorFilters.tsx
		const wrap = {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
			gap: 8
		};
		const control = {
			boxSizing: "border-box",
			minWidth: 0,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 12,
			padding: "6px 8px"
		};
		function InspectorFilters({ snapshot, filters, onChange, t }) {
			const categories = unique(snapshot.capabilities.map((capability) => capability.category));
			const planes = unique(snapshot.capabilities.map((capability) => capability.managementPlane));
			const lifecycles = unique(snapshot.capabilities.map((capability) => capability.runtimeState.lifecycle));
			const select = (field, values, label, format = (value) => value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				"aria-label": label,
				style: control,
				value: filters[field],
				onChange: (event) => onChange({
					...filters,
					[field]: event.target.value
				}),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: "all",
					children: t("filterAll")
				}), values.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value,
					children: format(value)
				}, value))]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: wrap,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "search",
						"aria-label": t("searchPlaceholder"),
						placeholder: t("searchPlaceholder"),
						style: control,
						value: filters.query,
						onChange: (event) => onChange({
							...filters,
							query: event.target.value
						})
					}),
					select("category", categories, t("filterCategory"), (value) => categoryLabel(t, value)),
					select("managementPlane", planes, t("filterManagementPlane"), (value) => planeLabel(t, value)),
					select("compositionScope", ["host", "agent-preset"], t("filterCompositionScope"), (value) => planeLabel(t, value)),
					select("policy", ["manageable", "locked"], t("filterPolicy"), (value) => policyLabel(t, value)),
					select("verification", verificationFilterValues(snapshot), t("filterVerification"), (value) => verificationLabel(t, value)),
					select("runtime", lifecycles, t("filterRuntime"), (value) => lifecycleLabel(t, value)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							...control,
							display: "flex",
							gap: 6,
							alignItems: "center"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: filters.anomaliesOnly,
							onChange: (event) => onChange({
								...filters,
								anomaliesOnly: event.target.checked
							})
						}), t("filterAnomalies")]
					})
				]
			});
		}
		function unique(values) {
			return [...new Set(values)].sort();
		}
		//#endregion
		//#region src/client/inspector-requests.ts
		const INSPECTION_API = "/api/builtin-toggles/v1/inspection";
		const MUTATION_API = "/api/builtin-toggles";
		const RESTORE_FOLLOW_UP_READS = 2;
		const RESTORE_RECHECK_DELAY_MS = 125;
		async function fetchInspection(fetcher) {
			const response = await fetcher(INSPECTION_API);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.json();
		}
		/** Never derives a predicted effective state: POST is followed by a fresh GET. */
		async function mutateAndRefresh(fetcher, id, action, options = {}) {
			const response = await fetcher(`${MUTATION_API}/${encodeURIComponent(id)}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.message ?? `HTTP ${response.status}`);
			}
			await response.json();
			let snapshot = await fetchInspection(fetcher);
			if (action !== "restore-inheritance") return snapshot;
			const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
			const reads = options.restoreFollowUpReads ?? RESTORE_FOLLOW_UP_READS;
			for (let attempt = 0; attempt < reads; attempt += 1) try {
				await wait(RESTORE_RECHECK_DELAY_MS);
				snapshot = await fetchInspection(fetcher);
			} catch {
				break;
			}
			return snapshot;
		}
		//#endregion
		//#region src/client/catalog.ts
		/**
		* Ids whose root Loader row is disabled by the official Web composition
		* because the capability is assembled per Session via Agent Presets.
		*
		* Display-only metadata: it explains state in the UI and NEVER participates
		* in POST authorization (see policy.ts).
		*/
		const PRESET_MANAGED_IDS = [
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
		];
		/** O(1) presentation-only membership. */
		const PRESET_MANAGED = new Set(PRESET_MANAGED_IDS);
		/** Fallback copy for official ids without a catalog entry yet (spec 4). */
		const UNKNOWN_FALLBACK_SUMMARY = "当前版本暂无补充说明。";
		const UNKNOWN_FALLBACK_LOCK_NOTE = "该条目属于官方内置插件，但尚未收录详细说明，因此保持锁定。";
		/**
		* Resolve one entry from a catalog record, falling back to the generic
		* unknown-id copy — never throws, so the UI cannot crash on an entry the
		* catalog has not documented yet. The bound convenience wrapper
		* Locale-bound helpers live in catalog.zh.ts and catalog.en.ts.
		*
		* @param catalog    the display-only catalog record (keyed by loader id)
		* @param id         loader short id (e.g. ui-goal)
		* @param moduleName module/package name (e.g. @deepseek-ai/dsh-client-ui-goal)
		*/
		function resolveCatalogEntry(catalog, id, moduleName) {
			const known = catalog[id];
			if (known !== void 0) return known;
			return {
				title: moduleShortName(moduleName),
				summary: UNKNOWN_FALLBACK_SUMMARY,
				category: "系统基础",
				lockNote: UNKNOWN_FALLBACK_LOCK_NOTE,
				unknown: true
			};
		}
		/** Derive the short package name, e.g. @deepseek-ai/dsh-client-ui-goal → dsh-client-ui-goal. */
		function moduleShortName(moduleName) {
			const trimmed = moduleName.trim();
			const slash = trimmed.lastIndexOf("/");
			return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
		}
		/** Normalize a search query / haystack: trim + case-fold (ids are ASCII). */
		function normalizeSearch(input) {
			return input.trim().toLowerCase();
		}
		/**
		* Local, in-memory matcher: title / summary / loader id / module name.
		* Empty or whitespace query matches everything (restores collapsed state).
		*/
		function matchesSearch(query, target) {
			const q = normalizeSearch(query);
			if (q === "") return true;
			return normalizeSearch([
				target.title,
				target.summary,
				target.id,
				target.moduleName
			].join(" ")).includes(q);
		}
		/** Only reviewed English copy is present; unknown rows use the honest fallback. */
		const enCatalog = Object.fromEntries(Object.entries({
			"ui-deliverables": {
				title: "Deliverables",
				summary: "Lists files created or changed in the current response and makes recognized references clickable."
			},
			"ui-jobs": {
				title: "Background jobs",
				summary: "Shows background task status, details, and elapsed time in the conversation header."
			},
			"ui-goal": {
				title: "Goal bar",
				summary: "Shows the current Goal near the composer and provides controls to edit, pause, resume, or clear it."
			},
			"ui-message-feedback": {
				title: "Message feedback",
				summary: "Shows thumbs-up, thumbs-down, and optional feedback notes on completed assistant replies."
			},
			"ui-model-selection": {
				title: "Model selection",
				summary: "Provides model and reasoning-effort selection through /model and the composer."
			},
			"ui-agent-preset": {
				title: "Agent presets",
				summary: "Lets users choose and inspect the Agent Preset used for new conversations."
			},
			"ui-skill": {
				title: "Skill entry points",
				summary: "Adds available Skills to command/input menus and renders Skill tool calls."
			},
			"ui-subagent": {
				title: "Subagent UI",
				summary: "Shows the subagent tree and navigation controls in the conversation header."
			},
			"ui-trajectory": {
				title: "Execution trajectory",
				summary: "Displays turn-by-turn user, assistant, and tool events for execution inspection."
			}
		}).map(([id, entry]) => [id, {
			...entry,
			category: "系统基础"
		}]));
		function getEnglishCatalogEntry(id, moduleName) {
			const known = enCatalog[id];
			if (known !== void 0) return known;
			return {
				title: moduleShortName(moduleName),
				summary: "No reviewed presentation description is available for this capability.",
				category: "系统基础",
				unknown: true
			};
		}
		//#endregion
		//#region src/client/catalog.zh.ts
		/**
		* 官方内置插件中文目录（Chinese-first catalog）。
		*
		* 本轮以中文用户为第一目标；英文完整 catalog 后续版本再补（预留
		* catalog.en.ts 结构）。本文件只做展示，绝不参与授权：
		* - 没有 manageable / enabled / disabled / allowToggle / policy 字段；
		* - 开关是否出现完全由服务端快照的 `manageable` 决定；
		* - PRESET_MANAGED_IDS 的展示语义见 catalog.ts。
		*
		* 文案来源：v0.2.0 规格文档整理的中文说明（按本机 rc.6 实际 Loader 核对）。
		*/
		/** 由 Agent Preset 管理的能力：统一状态说明（展示专用）。 */
		const PRESET_STATUS = "网页端顶层停用是正常状态；实际是否可用由当前会话的智能体预设决定。";
		const PRESET_LOCK = "该能力属于智能体组装，不由全局内置插件面板开关。";
		/** 生成一条 preset-managed 条目。 */
		function presetManaged(title, summary, category) {
			return {
				title,
				summary,
				category,
				presetManaged: true,
				statusNote: PRESET_STATUS,
				lockNote: PRESET_LOCK
			};
		}
		const zhCatalog = {
			"ui-deliverables": {
				title: "产出文件",
				summary: "在助手回复下方列出本轮创建或修改的文件，并把可识别的文件引用变成可点击链接。",
				category: "界面功能",
				impact: "不再显示产出文件行和文件链接；相关的最终回复文件引用提示也会移除。",
				recommendation: "如果经常让智能体创建或修改文件，建议保持开启。"
			},
			"ui-jobs": {
				title: "后台任务列表",
				summary: "会话存在后台任务时，在页头显示任务状态、详情和运行耗时。",
				category: "界面功能",
				impact: "后台任务仍可运行，但网页端页头不再显示任务列表。",
				recommendation: "使用后台命令或后台子代理时建议开启。"
			},
			"ui-goal": {
				title: "目标栏",
				summary: "在输入区显示当前目标，可编辑、暂停、恢复或清除；目标仍通过 /goal 创建。",
				category: "界面功能",
				impact: "目标本身和 /goal 命令仍然存在，但网页端中不再显示目标栏。",
				recommendation: "不使用目标工作流时可以关闭。"
			},
			"ui-message-feedback": {
				title: "消息反馈",
				summary: "在已完成的助手回复上显示赞、踩和可选备注。",
				category: "界面功能",
				impact: "只移除反馈控件，不影响对话内容，也不会改变模型上下文。",
				recommendation: "不需要给回复做人工反馈时可以关闭。"
			},
			"ui-model-selection": {
				title: "模型选择",
				summary: "提供 /model 和输入区的模型、推理强度选择入口。",
				category: "界面功能",
				impact: "已配置的模型路由仍可工作，但网页端中失去模型和推理强度选择界面。",
				recommendation: "需要在网页端中切换模型时保持开启。"
			},
			"ui-agent-preset": {
				title: "智能体预设",
				summary: "选择新会话使用的智能体预设，并查看和管理预设列表；已经开始的会话不会被实时切换。",
				category: "界面功能",
				impact: "智能体预设系统仍存在，但网页端中失去新会话预设选择、预设标签和管理界面。",
				recommendation: "使用 Standard、Code、Minimal、Cordis 或自定义预设时建议保持开启。"
			},
			"ui-skill": {
				title: "技能入口",
				summary: "把可用技能加入 / 输入菜单，并为技能工具调用提供专用展示。",
				category: "界面功能",
				impact: "宿主的技能能力仍可存在，但网页端中失去技能菜单入口和专用工具行显示。",
				recommendation: "经常手动调用技能时建议开启。"
			},
			"ui-subagent": {
				title: "子代理界面",
				summary: "在会话页头显示子代理树、进入子会话，并提供 @ 子代理引用入口。",
				category: "界面功能",
				impact: "宿主的子代理能力仍可运行，但网页端中失去子代理目录、导航和引用界面。",
				recommendation: "使用子代理时建议开启。"
			},
			"ui-trajectory": {
				title: "执行轨迹",
				summary: "按轮次查看用户、助手和工具事件，并检查词元、耗时、输入与输出。",
				category: "界面功能",
				impact: "对话和智能体执行不受影响，只移除执行轨迹调试与分析视图。",
				recommendation: "日常不查看执行细节时可以关闭。"
			},
			"ui-theme": {
				title: "主题系统",
				summary: "提供网页端界面的颜色、深浅色和统一视觉基础。",
				category: "系统基础",
				lockNote: "整个网页端界面依赖这套主题基础。"
			},
			locale: {
				title: "语言系统",
				summary: "提供网页端界面的语言选择和本地化文案。",
				category: "系统基础",
				lockNote: "其他界面依赖它获取当前语言和文本。"
			},
			"ui-layout": {
				title: "页面布局",
				summary: "负责网页端主页面各区域的整体布局。",
				category: "系统基础",
				lockNote: "关闭会破坏页面骨架。"
			},
			"ui-sidebar": {
				title: "侧边栏框架",
				summary: "提供左侧导航和侧边区域的基础容器。",
				category: "系统基础",
				lockNote: "工作区、会话等界面会向其中挂载内容。"
			},
			"ui-settings": {
				title: "设置框架",
				summary: "提供设置页面、设置分区和插件标签页。",
				category: "系统基础",
				lockNote: "本插件自身也运行在这套设置框架中。"
			},
			"ui-settings-general": {
				title: "通用设置",
				summary: "提供语言和其他通用偏好设置页面。",
				category: "界面功能",
				lockNote: "属于官方设置体系的一部分。"
			},
			"ui-settings-models": {
				title: "模型设置",
				summary: "提供模型提供方、模型和凭据相关的设置界面。",
				category: "模型与智能体",
				lockNote: "它连接模型路由与设置服务，不作为纯展示插件开放关闭。"
			},
			"ui-settings-plugin-inventory": {
				title: "官方插件列表",
				summary: "DSH 自带的只读插件清单，可搜索并查看加载器条目的状态和配置。",
				category: "界面功能",
				lockNote: "这是官方的插件状态查看器，保持只读和稳定。"
			},
			"ui-settings-plugins": {
				title: "插件配置",
				summary: "显示宿主插件主动暴露给用户的可配置项。",
				category: "界面功能",
				lockNote: "它是插件配置的基础页面，不是单一装饰功能。"
			},
			"ui-conversation": {
				title: "对话界面核心",
				summary: "负责聊天记录、输入框、消息渲染和主要会话交互。",
				category: "系统基础",
				lockNote: "这是网页端对话核心，许多其他界面插件依赖它。"
			},
			"ui-input-trigger": {
				title: "输入触发器",
				summary: "提供 /、@ 等输入触发和候选菜单的基础管线。",
				category: "系统基础",
				lockNote: "命令、技能和子代理等输入入口依赖它。"
			},
			"ui-commands": {
				title: "命令界面",
				summary: "提供 / 命令目录、命令弹窗和其他界面使用的 commandUi 服务。",
				category: "系统基础",
				lockNote: "模型选择、权限界面和对话核心等功能依赖它，不能作为独立界面关闭。"
			},
			"ui-permission": {
				title: "权限控制界面",
				summary: "提供默认权限预设以及当前会话的 /permission 选择界面。",
				category: "安全与权限",
				lockNote: "它会改变沙箱和审批策略，并依赖命令服务，属于安全关键界面。"
			},
			"ui-plan": {
				title: "规划模式界面",
				summary: "规划模式启用后，在输入区显示状态控件，并提供退出入口。",
				category: "模型与智能体",
				lockNote: "它对应会影响模型行为的规划策略，不作为普通视觉装饰开放关闭。"
			},
			"ui-user-questions": {
				title: "用户问答与审批",
				summary: "显示智能体发起的问题、选择题，以及规划审阅等等待用户决定的卡片。",
				category: "安全与权限",
				lockNote: "这是智能体等待用户回答或批准的重要交互通道。"
			},
			"ui-workspace": {
				title: "工作区与会话浏览",
				summary: "在侧边栏浏览和管理工作区、会话，并提供搜索、排序、重命名和归档等界面。",
				category: "界面功能",
				lockNote: "属于工作区和会话导航核心。"
			},
			"ui-tool": {
				title: "工具调用界面",
				summary: "负责聊天中工具调用的通用展示，并承载各种专用工具视图。",
				category: "系统基础",
				lockNote: "大量工具结果界面依赖这套渲染基础。"
			},
			"ui-cordis": {
				title: "Cordis 工具视图",
				summary: "为 Cordis 相关工具调用提供专用的结果展示。",
				category: "界面功能",
				lockNote: "依赖工具调用基础界面，当前保持锁定。"
			},
			"ui-workflow-run": {
				title: "工作流运行视图",
				summary: "把持久工作流的运行过程显示为聊天中的独立节点。",
				category: "界面功能",
				lockNote: "与工作流生命周期和会话投影相连，当前未作为安全叶子开放。"
			},
			modules: {
				title: "客户端模块加载",
				summary: "扫描并向浏览器提供各个客户端插件，组成网页端的启动模块表。",
				category: "系统基础",
				lockNote: "所有浏览器插件都依赖它加载。"
			},
			connection: {
				title: "浏览器连接",
				summary: "负责浏览器与 DSH 宿主之间的 API 和事件流连接。",
				category: "系统基础",
				lockNote: "关闭后网页端无法正常与宿主通信。"
			},
			"api-remotes": {
				title: "浏览器远程 API",
				summary: "把宿主提供的类型化远程接口交给浏览器插件使用。",
				category: "系统基础",
				lockNote: "大量界面与宿主的交互依赖它。"
			},
			"client-runtime": {
				title: "客户端运行时",
				summary: "维护浏览器中的会话、事件流和各类实时状态。",
				category: "系统基础",
				lockNote: "会话界面依赖的核心状态层。"
			},
			"cordis-client-runner": {
				title: "Cordis 客户端运行器",
				summary: "在浏览器中承载 Cordis 客户端插件及其协作机制。",
				category: "系统基础",
				lockNote: "属于客户端插件系统基础。"
			},
			"client-hmr": {
				title: "客户端热更新",
				summary: "开发时监听客户端插件包重建并重新加载浏览器插件。",
				category: "系统基础",
				lockNote: "属于开发和运行基础，不作为用户功能开关。"
			},
			"plugin-inventory": {
				title: "插件清单服务",
				summary: "宿主侧提供当前加载器条目和运行状态的只读快照。",
				category: "系统基础",
				lockNote: "官方插件列表和本插件的诊断都依赖这类清单能力。"
			},
			"directory-picker": {
				title: "目录选择",
				summary: "根据本机或远程部署环境选择合适的文件夹选择方式。",
				category: "界面功能",
				lockNote: "添加工作区等流程依赖它。"
			},
			webserver: {
				title: "网页端服务器",
				summary: "承载 DSH 网页端页面和 HTTP API。",
				category: "系统基础",
				lockNote: "关闭会直接失去网页端服务。"
			},
			"web-runtime": {
				title: "网页端运行层",
				summary: "连接前端静态页面、部署环境和网页端运行上下文。",
				category: "系统基础",
				lockNote: "属于整个网页端部署的核心。"
			},
			"web-startup": {
				title: "网页端启动参数",
				summary: "解析网页端启动时的地址、端口和 trusted-host 等参数。",
				category: "系统基础",
				lockNote: "网页端运行层依赖这些启动信息。"
			},
			"api-gateway": {
				title: "API 网关",
				summary: "宿主侧统一分发浏览器发来的业务 API 调用。",
				category: "系统基础",
				lockNote: "客户端与宿主的业务通信依赖它。"
			},
			"cordis-host-runner": {
				title: "Cordis 宿主运行器",
				summary: "承载宿主侧的 Cordis 插件运行能力。",
				category: "系统基础",
				lockNote: "属于宿主插件运行基础。"
			},
			"code-runtime": {
				title: "代码执行运行时",
				summary: "提供基于 worker thread 的代码运行环境，供程序化执行功能使用。",
				category: "工具与执行",
				lockNote: "属于执行基础设施，不是纯界面功能。"
			},
			storage: {
				title: "存储接口",
				summary: "为 DSH 各类状态提供统一的持久化存储接口。",
				category: "会话与数据",
				lockNote: "多个领域服务依赖这层存储抽象。"
			},
			"storage-json": {
				title: "JSON 存储后端",
				summary: "把通用存储内容保存为 DSH_HOME 下的 JSON 数据。",
				category: "会话与数据",
				lockNote: "属于具体持久化后端。"
			},
			"storage-domain": {
				title: "领域存储绑定",
				summary: "把 DSH 的领域状态连接到当前存储后端。",
				category: "会话与数据",
				lockNote: "属于数据持久化基础。"
			},
			"message-feedback": {
				title: "消息反馈服务",
				summary: "宿主侧保存赞、踩和备注，并处理并发版本冲突。",
				category: "会话与数据",
				lockNote: "这是消息反馈界面背后的数据服务。"
			},
			"session-log-download": {
				title: "会话导出",
				summary: "提供 /export 和浏览器下载会话日志的能力。",
				category: "会话与数据",
				lockNote: "与会话日志和命令系统相连，当前未审计为纯界面叶子。"
			},
			workspace: {
				title: "工作区服务",
				summary: "宿主侧维护工作区、会话归属及相关操作。",
				category: "会话与数据",
				lockNote: "工作区界面的核心数据服务。"
			},
			"session-projection-cache": {
				title: "会话投影缓存",
				summary: "缓存由会话日志计算出的界面和功能状态，减少重复重放。",
				category: "会话与数据",
				lockNote: "属于会话数据基础设施。"
			},
			"session-stats": {
				title: "会话统计",
				summary: "计算整个会话的轮次、步骤等统计信息。",
				category: "会话与数据",
				lockNote: "属于会话投影服务，而不是单一界面。"
			},
			llm: {
				title: "LLM 路由",
				summary: "统一登记模型提供方和模型调用路由。",
				category: "模型与智能体",
				lockNote: "所有模型调用都依赖它。"
			},
			"llm-deepseek": {
				title: "DeepSeek 模型适配器",
				summary: "连接 DeepSeek 模型接口；API Key 和端点从设置与凭据系统读取。",
				category: "模型与智能体",
				lockNote: "属于模型执行路径核心。"
			},
			"llm-pi-ai": {
				title: "多提供方模型适配器",
				summary: "按用户设置动态接入额外模型提供方；没有配置时可以保持空闲。",
				category: "模型与智能体",
				lockNote: "属于模型路由服务，不是界面叶子。"
			},
			"llm-retry": {
				title: "模型请求重试",
				summary: "为模型请求提供统一的失败重试策略。",
				category: "模型与智能体",
				lockNote: "直接影响模型调用可靠性。"
			},
			"token-meter": {
				title: "词元计量",
				summary: "记录模型上下文和词元使用，为压缩等策略提供依据。",
				category: "模型与智能体",
				lockNote: "多个智能体策略会依赖这些数据。"
			},
			session: {
				title: "会话核心",
				summary: "维护会话的事件记录、生命周期和核心状态。",
				category: "会话与数据",
				lockNote: "对话历史和智能体执行都依赖它。"
			},
			"session-title": {
				title: "会话标题",
				summary: "负责会话标题及标题生成失败时的回退规则。",
				category: "会话与数据",
				lockNote: "属于会话元数据服务。"
			},
			"session-title-llm": {
				title: "智能标题生成",
				summary: "根据会话开头内容调用模型生成简短标题。",
				category: "模型与智能体",
				lockNote: "属于标题生成链路。"
			},
			"session-persistence-jsonl": {
				title: "会话持久化",
				summary: "把会话事件以 JSONL 形式保存到 DSH_HOME/sessions。",
				category: "会话与数据",
				lockNote: "这是历史数据持久化核心。"
			},
			"attachment-local": {
				title: "附件存储",
				summary: "在本机保存会话图片和附件，并通过内容地址供消息引用。",
				category: "会话与数据",
				lockNote: "属于附件数据基础设施。"
			},
			"session-query-sqlite": {
				title: "会话查询索引",
				summary: "提供会话读取、标题和谱系查询；全文内容搜索默认不开启。",
				category: "会话与数据",
				lockNote: "导出和谱系等功能仍依赖它；不要把‘全文搜索未开启’理解为插件无用。"
			},
			"session-projection": {
				title: "会话投影",
				summary: "把追加式会话历史计算成界面和功能需要的当前状态。",
				category: "会话与数据",
				lockNote: "许多宿主和网页端功能都依赖这些派生状态。"
			},
			"session-telemetry-otel": {
				title: "会话遥测",
				summary: "按部署配置把会话遥测通过 OTLP 导出；官方默认模式为关闭。",
				category: "会话与数据",
				lockNote: "遥测启用属于部署和隐私策略，不由这个面板作为普通插件开关管理。"
			},
			"session-checkpoint-policy": {
				title: "会话检查点",
				summary: "在关键执行边界保存检查点，提高中断后的可恢复性。",
				category: "会话与数据",
				lockNote: "属于可靠性基础设施。"
			},
			agent: {
				title: "智能体核心",
				summary: "维护智能体实例、会话绑定和执行生命周期。",
				category: "模型与智能体",
				lockNote: "智能体运行核心。"
			},
			"agent-loop": {
				title: "智能体执行循环",
				summary: "负责模型调用、工具执行和下一步模型调用之间的主循环。",
				category: "模型与智能体",
				lockNote: "这是智能体执行核心。"
			},
			"agent-default-model": {
				title: "默认模型",
				summary: "定义新智能体或会话默认使用的模型提供方和模型。",
				category: "模型与智能体",
				lockNote: "属于会话创建路径。"
			},
			"system-prompt": {
				title: "系统提示词组装",
				summary: "组合 Harness 身份、部署角色设定和各功能加入的系统提示词。",
				category: "模型与智能体",
				lockNote: "会直接改变模型看到的上下文。"
			},
			settings: {
				title: "设置文件",
				summary: "读取和更新 DSH_HOME/settings.yaml，模型页等设置会写入这里。",
				category: "系统基础",
				lockNote: "用户配置体系依赖它。"
			},
			credentials: {
				title: "凭据管理",
				summary: "从受管凭据文件、环境变量和 .env 等来源解析 API Key 等机密信息。",
				category: "安全与权限",
				lockNote: "属于密钥和凭据基础设施。"
			},
			"user-questions": {
				title: "用户问答服务",
				summary: "宿主侧维护智能体向用户提问并等待回答的请求。",
				category: "安全与权限",
				lockNote: "用户问答界面和智能体提问能力依赖它。"
			},
			jobs: {
				title: "后台任务注册表",
				summary: "登记后台任务及其状态，并按智能体和会话提供查询。",
				category: "工具与执行",
				lockNote: "后台执行工具和后台任务界面都依赖它。"
			},
			subagent: {
				title: "子代理注册表",
				summary: "维护子代理的谱系、状态和继续交互能力。",
				category: "模型与智能体",
				lockNote: "宿主、网页端和子代理工具共同依赖它。"
			},
			"subagent-spawn-in-process": {
				title: "新建（Spawn）子代理后端",
				summary: "在当前 DSH 进程中创建新的子代理会话。",
				category: "模型与智能体",
				lockNote: "属于智能体委派执行后端。"
			},
			"subagent-fork-in-process": {
				title: "分叉（Fork）子代理后端",
				summary: "从父会话历史 fork 一个一次性的子代理执行。",
				category: "模型与智能体",
				lockNote: "属于智能体委派执行后端。"
			},
			"agent-presets": {
				title: "智能体预设目录",
				summary: "扫描系统和用户预设，并决定新会话默认采用哪套智能体组装；网页端默认使用 standard。",
				category: "模型与智能体",
				lockNote: "Preset 决定每个会话拥有哪些模型能力和工具，不能当普通插件开关。"
			},
			commands: {
				title: "命令注册表",
				summary: "宿主侧登记并执行 /goal、/permission、/compact 等命令。",
				category: "系统基础",
				lockNote: "多个网页端和智能体功能依赖统一命令系统。"
			},
			"command-feedback": {
				title: "反馈命令",
				summary: "注册与反馈流程相关的宿主命令入口。",
				category: "会话与数据",
				lockNote: "属于宿主命令体系。"
			},
			goal: {
				title: "目标服务",
				summary: "持久保存并维护当前会话的目标状态。",
				category: "模型与智能体",
				lockNote: "目标命令、智能体和网页端目标栏共同依赖它。"
			},
			"goal-round-driver": {
				title: "目标轮次驱动",
				summary: "把持久目标接入同一会话后续的智能体执行过程。",
				category: "模型与智能体",
				lockNote: "属于目标执行语义，而不是界面装饰。"
			},
			"command-goal": {
				title: "目标命令",
				summary: "提供 /goal 命令，用来创建和管理会话目标。",
				category: "模型与智能体",
				lockNote: "目标工作流依赖这个宿主命令入口。"
			},
			approval: {
				title: "用户审批",
				summary: "决定工具操作何时需要用户确认，并承接审批流程。",
				category: "安全与权限",
				lockNote: "这是执行安全边界的一部分。"
			},
			permission: {
				title: "权限预设",
				summary: "定义只读、工作区可写和完全访问等沙箱与审批组合。",
				category: "安全与权限",
				lockNote: "直接决定工具能做什么，属于安全策略核心。"
			},
			sandbox: {
				title: "沙箱服务",
				summary: "为文件和进程操作提供统一的本机安全边界。",
				category: "安全与权限",
				lockNote: "执行安全依赖它。"
			},
			"sandbox-policy": {
				title: "沙箱策略",
				summary: "根据当前权限模式和工作区决定允许访问和写入的范围。",
				category: "安全与权限",
				lockNote: "属于执行权限核心。"
			},
			"bash-sandbox": {
				title: "Bash 沙箱",
				summary: "在 macOS/Linux 等非 Windows 平台提供受限制的命令行环境执行环境。",
				category: "安全与权限",
				statusNote: "按操作系统自动选择；在 Windows 上显示停用是正常现象。",
				lockNote: "平台执行和沙箱安全依赖它。"
			},
			"pwsh-sandbox": {
				title: "Power命令行环境沙箱",
				summary: "在 Windows 上提供受限制的 Power命令行环境执行环境。",
				category: "安全与权限",
				statusNote: "按操作系统自动选择；在非 Windows 平台显示停用是正常现象。",
				lockNote: "平台执行和沙箱安全依赖它。"
			},
			subprocess: {
				title: "子进程执行",
				summary: "宿主侧统一启动和管理本地子进程。",
				category: "工具与执行",
				lockNote: "多个执行类工具依赖它。"
			},
			"shell-env": {
				title: "命令行环境环境",
				summary: "向命令行环境工具提供 DSH 运行环境和必要的上下文变量。",
				category: "工具与执行",
				lockNote: "属于命令行环境执行基础。"
			},
			"fs-sandbox": {
				title: "沙箱文件系统",
				summary: "把文件系统操作限制在当前沙箱和工作区策略允许的范围内。",
				category: "安全与权限",
				lockNote: "文件操作安全依赖它。"
			},
			"fs-observation-policy": {
				title: "文件读取展示策略",
				summary: "控制文件读取和搜索结果如何稳定地交给智能体。",
				category: "工具与执行",
				lockNote: "属于文件工具执行链路。"
			},
			tools: {
				title: "工具注册表",
				summary: "登记当前智能体可以看到的工具，并控制工具的呈现方式。",
				category: "模型与智能体",
				lockNote: "模型工具目录的核心。"
			},
			"timeout-policy": {
				title: "工具超时策略",
				summary: "为不同工具调用提供统一的超时规则。",
				category: "工具与执行",
				lockNote: "执行可靠性依赖它。"
			},
			"spill-local": {
				title: "大结果落盘",
				summary: "把不适合直接内联的超大工具结果保存到本地。",
				category: "会话与数据",
				lockNote: "属于工具结果存储基础。"
			},
			"spill-policy": {
				title: "大结果策略",
				summary: "决定工具结果超过多大时改用本地 spill 引用。",
				category: "会话与数据",
				lockNote: "用于控制上下文大小和结果可靠性。"
			},
			"repeat-tool-reminder": {
				title: "重复调用提醒",
				summary: "当智能体连续重复相似工具调用时加入提醒，减少无效循环。",
				category: "模型与智能体",
				lockNote: "会直接影响智能体的后续行为。"
			},
			web: {
				title: "网页端能力",
				summary: "登记网页搜索能力和当前使用的搜索提供方。",
				category: "工具与执行",
				lockNote: "属于智能体网页端工具的宿主服务。"
			},
			"web-search-deepseek": {
				title: "DeepSeek 网页搜索",
				summary: "使用 DeepSeek 的搜索接口作为默认网页搜索后端。",
				category: "工具与执行",
				lockNote: "属于搜索服务后端。"
			},
			typert: {
				title: "Typed RPC 注册表",
				summary: "登记 DSH 内部宿主与客户端之间的类型化远程接口。",
				category: "系统基础",
				lockNote: "属于内部通信基础。"
			},
			"typert-loader": {
				title: "RPC 协议加载",
				summary: "加载并连接 DSH 的类型化远程接口定义。",
				category: "系统基础",
				lockNote: "属于内部通信基础。"
			},
			"typert-gateway": {
				title: "Typed API 网关",
				summary: "负责在传输层分发类型化 RPC 调用。",
				category: "系统基础",
				lockNote: "属于内部通信核心。"
			},
			timer: {
				title: "定时器服务",
				summary: "提供 Cordis 插件使用的定时和周期任务基础能力。",
				category: "系统基础",
				lockNote: "属于基础运行服务。"
			},
			hmr: {
				title: "配置热重载",
				summary: "用于 Cordis 配置的热重载。",
				category: "系统基础",
				statusNote: "官方网页端当前明确关闭这项能力；显示停用是正常状态。",
				lockNote: "不要通过本面板强行开启。"
			},
			"tool-bash": presetManaged("Bash 工具", "让智能体在 macOS/Linux 等环境执行命令行环境命令。", "工具与执行"),
			"tool-pwsh": presetManaged("Power命令行环境工具", "让智能体在 Windows 环境执行 Power命令行环境命令。", "工具与执行"),
			"tool-jobs": presetManaged("后台任务工具", "让智能体查询和管理后台任务。", "工具与执行"),
			"tool-fs": presetManaged("文件系统工具", "让智能体读取、写入和管理文件。", "工具与执行"),
			"tool-fs-search": presetManaged("文件搜索工具", "让智能体搜索文件、目录和内容。", "工具与执行"),
			"tool-str-replace-editor": presetManaged("文本编辑工具", "提供结构化的文件查看、替换和插入编辑。", "工具与执行"),
			"skill-filesystem": presetManaged("本地技能发现", "从文件系统发现并注册当前智能体可用的技能。", "模型与智能体"),
			"tool-skill": presetManaged("技能工具", "让智能体查看和加载技能，并处理用户显式调用的技能。", "模型与智能体"),
			"tool-goal": presetManaged("目标工具", "让智能体读取和更新持久化的会话目标。", "模型与智能体"),
			"plan-mode": presetManaged("规划模式", "为智能体提供规划模式、退出工具和对应的规划规则。", "模型与智能体"),
			"compaction-basic": presetManaged("上下文压缩", "上下文过长时生成压缩摘要，为后续模型请求腾出空间。", "模型与智能体"),
			"command-compact": presetManaged("手动压缩命令", "提供 /compact，让用户主动触发一次上下文压缩。", "模型与智能体"),
			"tool-result-pruner": presetManaged("工具结果裁剪", "在整体压缩之前先缩减过大的工具结果，同时保留头尾关键信息。", "模型与智能体"),
			"tool-subagent-control": presetManaged("子代理控制", "为可继续子代理提供继续交互和控制通道。", "模型与智能体"),
			"tool-subagent-list-agents": presetManaged("子代理列表工具", "让智能体查看可用和已创建的子代理。", "模型与智能体"),
			"tool-subagent": presetManaged("创建子代理", "让智能体创建一个可继续交互的新建（Spawn）子代理。", "模型与智能体"),
			"tool-subagent-fork": presetManaged("分叉（Fork）子代理", "让智能体从当前历史 fork 一个一次性子代理。", "模型与智能体"),
			"workflow-worker-thread": presetManaged("工作流执行后端", "在线程工作器中执行持久工作流。", "工具与执行"),
			"tool-workflow": presetManaged("工作流工具", "让智能体启动和管理工作流。", "工具与执行"),
			"tool-ralph": presetManaged("Ralph 迭代工具", "按固定流程反复启动新的智能体轮次，用于多轮迭代执行。", "工具与执行"),
			"agent-instructions": presetManaged("工作区指令", "为智能体自动加载 AGENTS.md、CLAUDE.md 等工作区指令。", "模型与智能体"),
			"tool-todo": presetManaged("任务清单工具", "让智能体维护任务清单和执行状态。", "模型与智能体"),
			"tool-web": presetManaged("网页搜索工具", "让智能体使用 web_search；官方默认组合只开放搜索，不开放任意 URL fetch。", "工具与执行"),
			skill: {
				title: "技能注册表",
				summary: "维护可用技能目录，并把系统、用户和预设提供的技能合并给当前智能体。",
				category: "模型与智能体",
				lockNote: "属于技能基础服务。"
			},
			"skill-badge": {
				title: "技能标记",
				summary: "提供技能相关的辅助标记能力。",
				category: "模型与智能体",
				statusNote: "官方 base 当前默认停用。",
				lockNote: "保持官方默认状态。"
			},
			"tool-subagent-report": {
				title: "子代理回报通道",
				summary: "为可继续子代理提供向父智能体回报结果的通道。",
				category: "模型与智能体",
				lockNote: "它需要保持宿主层单例，不能按普通插件随意开关。"
			},
			loader: {
				title: "插件加载器",
				summary: "负责加载和管理整个 Cordis/DSH 插件树。",
				category: "系统基础",
				lockNote: "属于系统基础，保持锁定。"
			},
			include: {
				title: "配置包含",
				summary: "配置树内部用于组合其他配置的节点。",
				category: "系统基础",
				lockNote: "属于系统基础，保持锁定。"
			},
			group: {
				title: "配置分组",
				summary: "配置树内部用于组织插件条目的分组节点。",
				category: "系统基础",
				lockNote: "属于系统基础，保持锁定。"
			}
		};
		/** 按 Loader id 查询中文条目；未知官方 id 返回通用 fallback（不 crash）。 */
		function getBuiltinCatalogEntry(id, moduleName) {
			return resolveCatalogEntry(zhCatalog, id, moduleName);
		}
		//#endregion
		//#region src/client/presentation.ts
		function getCapabilityPresentation(locale, capability) {
			if (!capability.official) return fallback(locale, capability.packageName);
			return fromCatalog(locale === "en" ? getEnglishCatalogEntry(capability.id, capability.packageName) : getBuiltinCatalogEntry(capability.id, capability.packageName));
		}
		function fromCatalog(entry) {
			return {
				title: entry.title,
				summary: entry.summary,
				unknown: entry.unknown === true
			};
		}
		function fallback(locale, packageName) {
			return {
				title: moduleShortName(packageName),
				summary: locale === "zh" ? "此能力没有可用的本地化展示说明。" : "No localized presentation description is available for this capability.",
				unknown: true
			};
		}
		//#endregion
		//#region src/client/BuiltinTogglesTab.tsx
		/** Capability Inspector UI. Server inspection data is the sole authority. */
		const page = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			width: "100%",
			maxWidth: 900,
			color: "var(--dsw-alias-label-primary)"
		};
		const text = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const button = {
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			padding: "5px 9px",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		const error = {
			...text,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const list = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			padding: 0,
			margin: 0,
			listStyle: "none"
		};
		function BuiltinTogglesTab({ t }) {
			const [view, setView] = (0, react.useState)({ status: "loading" });
			const [filters, setFilters] = (0, react.useState)(EMPTY_FILTERS);
			const [busyId, setBusyId] = (0, react.useState)(null);
			const [message, setMessage] = (0, react.useState)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [copyStatus, setCopyStatus] = (0, react.useState)("idle");
			const queue = (0, react.useRef)(Promise.resolve());
			const copyTimer = (0, react.useRef)(void 0);
			const deepLinkId = typeof window === "undefined" ? null : capabilityFromHash(window.location.hash);
			const presentationLocale = t("presentationLocale");
			(0, react.useEffect)(() => () => {
				if (copyTimer.current !== void 0) window.clearTimeout(copyTimer.current);
			}, []);
			const load = (0, react.useCallback)(async (silent = false) => {
				if (!silent) setView({ status: "loading" });
				try {
					setView({
						status: "ready",
						snapshot: await fetchInspection(fetch)
					});
				} catch {
					setView((previous) => silent && previous.status === "ready" ? previous : { status: "error" });
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [attempt, load]);
			(0, react.useEffect)(() => {
				if (view.status !== "ready" || deepLinkId === null || typeof document === "undefined") return;
				const target = [...document.querySelectorAll("[data-capability-id]")].find((element) => element.dataset.capabilityId === deepLinkId);
				target?.scrollIntoView({ block: "center" });
				target?.focus({ preventScroll: true });
			}, [deepLinkId, view]);
			const mutate = (0, react.useCallback)((id, action) => {
				const run = async () => {
					setBusyId(id);
					setMessage(null);
					let succeeded = false;
					try {
						const snapshot = await mutateAndRefresh(fetch, id, action);
						setView({
							status: "ready",
							snapshot
						});
						succeeded = true;
					} catch (cause) {
						setMessage(t("mutationFailed", { message: cause instanceof Error ? cause.message : String(cause) }));
					} finally {
						setBusyId(null);
						if (!succeeded) await load(true);
						if (succeeded) setMessage(t(action === "restore-inheritance" ? "restoreSubmitted" : "mutationSubmitted"));
					}
				};
				queue.current = queue.current.then(run, run);
			}, [load, t]);
			const copyDiagnostics = (0, react.useCallback)(async (snapshot) => {
				try {
					await navigator.clipboard.writeText(buildDiagnostics(snapshot));
					setCopyStatus("copied");
				} catch {
					setCopyStatus("failed");
				}
				if (copyTimer.current !== void 0) window.clearTimeout(copyTimer.current);
				copyTimer.current = window.setTimeout(() => setCopyStatus("idle"), 3e3);
			}, []);
			const presentation = (0, react.useCallback)((capability) => getCapabilityPresentation(presentationLocale, capability), [presentationLocale]);
			const visible = (0, react.useMemo)(() => view.status === "ready" ? filterCapabilities(view.snapshot, filters, presentation) : [], [
				view,
				filters,
				presentation
			]);
			if (view.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: page,
				"aria-busy": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: text,
					children: t("loading")
				})
			});
			if (view.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: page,
				role: "alert",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: error,
					children: t("error")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: button,
					onClick: () => setAttempt((value) => value + 1),
					children: t("retry")
				})]
			});
			const { snapshot } = view;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: text,
						children: t("inspectorIntro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompatibilitySummary, {
						snapshot,
						t
					}),
					snapshot.access.mutation === "loopback-required" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: text,
						role: "status",
						children: t("remoteReadOnly")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							justifyContent: "space-between",
							gap: 8,
							alignItems: "center",
							flexWrap: "wrap"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: text,
							children: t("resultCount", {
								count: String(visible.length),
								total: String(snapshot.inventory.totalEntries)
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8,
								alignItems: "center"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: button,
								onClick: () => void copyDiagnostics(snapshot),
								children: copyStatus === "copied" ? t("copyCopied") : t("copyDiagnostics")
							}), copyStatus === "idle" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								role: "status",
								style: copyStatus === "failed" ? error : text,
								children: copyStatus === "copied" ? t("copyCopied") : t("copyFailed")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(InspectorFilters, {
						snapshot,
						filters,
						onChange: setFilters,
						t
					}),
					message === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: text,
						role: "status",
						children: message
					}),
					visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: text,
						children: filters.anomaliesOnly ? t("searchEmptyAnomalies") : t("searchEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: list,
						children: visible.map((capability, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityCard, {
							domId: `capability-${index}`,
							capability,
							presentation: presentation(capability),
							snapshot,
							busy: busyId === capability.id,
							initiallyExpanded: deepLinkId === capability.id,
							onMutate: mutate,
							t
						}, `${capability.id}-${index}`))
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			tab: "内置插件",
			loading: "正在读取能力检查结果…",
			error: "能力检查暂时不可用。",
			retry: "重试",
			presentationLocale: "zh",
			inspectorIntro: "检查当前宿主中的所有加载器能力。组成检查是检查结论，写入资格是服务端对单项写入的独立授权；不可操作的条目仍保留在此处供检查。",
			searchPlaceholder: "搜索 ID、包名、类别或管理平面",
			searchEmpty: "没有匹配的能力。",
			searchEmptyAnomalies: "当前未发现异常项。",
			resultCount: "显示 {count} / {total} 个能力",
			compatibilityHeading: "组成检查 / 兼容性检查",
			compatibilityStatusDrifted: "发现结构漂移",
			compatibilityStatusNoDrift: "未发现结构漂移",
			compatibilityExplainDrifted: "已发现可复核的结构差异；检查仍可用，但这些发现需要随兼容性报告一并评估。",
			compatibilityExplainIdentityMismatch: "宿主公开的运行时发布身份与已审阅基线不匹配；这不是对宿主健康状况的泛化判断。",
			compatibilityExplainEvidenceIncomplete: "已审阅基线中有未能独立确认的证据，因此结果保持未验证。",
			compatibilityExplainIdentityUnavailable: "宿主未公开可绑定的运行时发布身份；这不表示系统损坏或能力不可用。",
			compatibilityExplainUnverified: "当前可用证据不足以作出已验证结论；请查看下面的具体发现。",
			compatibilityExplainVerified: "结构与运行时身份均已核对，未发现结构漂移。",
			compatibilityExplainNoDrift: "未发现结构漂移；仅缺少上游未提供的运行时发布身份，已保留在机器证据中。",
			runtimeIdentityLabel: "运行时身份",
			noFindings: "没有可报告的发现。",
			copyDiagnostics: "复制诊断信息",
			diagnosticsCopied: "已复制脱敏诊断信息。",
			diagnosticsCopyFailed: "无法复制诊断信息。",
			filterAll: "全部",
			filterCategory: "类别",
			filterManagementPlane: "管理平面",
			filterCompositionScope: "组合范围",
			filterPolicy: "策略",
			filterVerification: "检查状态",
			filterRuntime: "运行状态",
			filterAnomalies: "仅异常项",
			capabilityName: "名称：{name}",
			presetManaged: "由智能体预设管理",
			effectiveDisabled: "当前有效：停用",
			effectiveEnabled: "当前有效：启用",
			detailsShow: "查看机器证据",
			detailsHide: "收起机器证据",
			lockReason: "锁定原因",
			compositionScope: "组合范围",
			mutationControls: "写入控制",
			forceEnable: "强制启用",
			forceDisable: "强制禁用",
			restoreInheritance: "恢复继承",
			controlsUnavailable: "此条目没有可执行控制",
			remoteReadOnly: "当前为远程只读模式；配置写入仅允许本机回环且同源请求。",
			remoteReadOnlyEligible: "本项本可修改，但当前为远程只读模式，无法执行写入。",
			mutationFailed: "操作失败：{message}",
			mutationSubmitted: "已提交。已重新读取服务端状态；刷新页面后客户端效果才会更新。",
			restoreSubmitted: "已恢复配置档继承。已重新读取服务端状态；DSH 配置档/HMR 重组期间有效状态可能暂时不同。",
			copyCopied: "已复制",
			copyFailed: "复制失败",
			expectedPackage: "预期包",
			reviewed: "是否已审阅",
			reviewedReference: "审阅引用 / 溯源",
			declaredInject: "注入声明证据",
			dependencyEvidence: "依赖证据",
			leafReview: "叶子审阅结论",
			compatibilityFindings: "组成检查发现",
			eligibilityReasons: "写入资格原因",
			limitations: "限制",
			provides: "提供",
			consumers: "消费者",
			profilePersistence: "配置档持久化预检",
			yes: "是",
			no: "否",
			none: "无",
			unknown: "未确认",
			noEvidence: "无可用证据",
			injectNotDeclared: "已审阅补丁未声明注入声明",
			injectDeclaredEmpty: "已声明为空注入集合",
			dependencyObserved: "已观察",
			verificationVerified: "已验证",
			verificationDrifted: "已漂移",
			verificationUnverified: "未验证",
			verificationNoDrift: "结构未见漂移",
			verificationEvidenceIncomplete: "证据不完整",
			verificationIdentityMismatch: "运行时身份不匹配",
			verificationUnreviewed: "未审阅",
			verificationNotApplicable: "智能体预设，不参与基线验证",
			runtimeIdentityMatched: "匹配",
			runtimeIdentityMismatched: "不匹配",
			runtimeIdentityUnavailable: "不可用",
			profileInherited: "继承默认值",
			profileExplicitlyEnabled: "已强制启用",
			profileExplicitlyDisabled: "已强制禁用",
			profileUnavailable: "不可用",
			profileNotApplicable: "不适用（智能体预设组合）",
			profileWritable: "可写",
			profileUnwritable: "不可写",
			lifecycleInactive: "未挂载",
			lifecyclePending: "等待依赖",
			lifecycleLoading: "加载中",
			lifecycleActive: "运行中",
			lifecycleFailed: "挂载失败",
			lifecycleUnloading: "卸载中",
			lifecycleUnknown: "未确认",
			findingMissingExpectedEntry: "缺少预期条目",
			findingNewOfficialEntry: "新增官方条目",
			findingPackageIdentityChanged: "包身份漂移",
			findingDeclaredInjectChanged: "注入声明漂移",
			findingBaselinePackageUnknown: "基线包身份未确认",
			findingDuplicateRuntimeId: "重复加载器 id",
			findingRuntimeReleaseIdentityUnavailable: "运行时身份不可用",
			findingRuntimeReleaseIdentityMismatch: "运行时身份不匹配",
			findingRuntimeAugmentationShapeChanged: "运行时增强形态变化",
			findingRuntimeAugmentationIdConflictsBaseline: "运行时增强 id 与基线冲突",
			eligibilityNotManageable: "不在可管理允许列表中",
			eligibilityMissingRuntimeEntry: "缺少运行时条目",
			eligibilityReviewedBaselineMissing: "缺少已审阅基线",
			eligibilityReviewedSafeLeafEvidenceMissing: "缺少安全叶子证据",
			eligibilityTargetStructuralDrift: "目标结构漂移",
			eligibilityGlobalStructuralDrift: "全局结构漂移",
			eligibilityRuntimeIdentityMismatch: "运行时身份不匹配",
			eligibilityProfileNotPersistable: "配置档无法安全写入",
			eligibilityAgentPresetScope: "智能体预设组合条目不是宿主写入目标",
			limitationRuntimeIdentityUnavailable: "运行时发布身份不可用",
			limitationConsumerGraphNotExposed: "未公开完整消费者关系图",
			leafReviewReviewedSafeUiLeaf: "已审阅的安全界面叶子",
			leafReviewLockedDependency: "锁定依赖",
			leafReviewNotReviewed: "未审阅",
			categoryPresentation: "界面功能",
			categoryAgent: "模型与智能体",
			categoryTransport: "传输",
			categoryInfrastructure: "系统基础",
			categoryUnknown: "未确认类别",
			planeBrowser: "浏览器",
			planeHost: "宿主",
			planeAgentPreset: "智能体预设",
			planeUnknown: "未确认平面",
			policyManageable: "可管理",
			policyLocked: "已锁定",
			lockSelf: "插件自身",
			lockCore: "核心基础设施",
			lockUnlisted: "未在允许列表中",
			lockExternal: "外部插件",
			lockAgentPreset: "智能体预设组合条目"
		};
		const en = {
			tab: "Built-ins",
			loading: "Reading capability inspection…",
			error: "Capability inspection is temporarily unavailable.",
			retry: "Retry",
			presentationLocale: "en",
			inspectorIntro: "Inspect every Loader capability in the current Host. Compatibility is an inspection conclusion; mutation eligibility is the server’s separate authorization for one write. Ineligible entries remain visible for inspection.",
			searchPlaceholder: "Search ID, package, category, or management plane",
			searchEmpty: "No matching capabilities.",
			searchEmptyAnomalies: "No anomalies found.",
			resultCount: "Showing {count} / {total} capabilities",
			compatibilityHeading: "Compatibility / Doctor",
			compatibilityStatusDrifted: "Structural drift found",
			compatibilityStatusNoDrift: "No structural drift found",
			compatibilityExplainDrifted: "A reviewable structural difference was observed. Inspection remains available, but these findings need evaluation in a compatibility report.",
			compatibilityExplainIdentityMismatch: "The Host-exposed runtime release identity does not match the reviewed baseline; this is not a general health judgment about the Host.",
			compatibilityExplainEvidenceIncomplete: "The reviewed baseline contains evidence that could not be independently confirmed, so the result remains unverified.",
			compatibilityExplainIdentityUnavailable: "The Host has not exposed a bindable runtime release identity. This does not mean the system is broken or a capability is unavailable.",
			compatibilityExplainUnverified: "Available evidence is insufficient for a verified conclusion; review the findings below.",
			compatibilityExplainVerified: "Structure and runtime identity are aligned; no structural drift found.",
			compatibilityExplainNoDrift: "No structural drift found; only the upstream-unavailable runtime release identity is missing and remains in machine evidence.",
			runtimeIdentityLabel: "Runtime identity",
			noFindings: "No reportable findings.",
			copyDiagnostics: "Copy diagnostics",
			diagnosticsCopied: "Redacted diagnostics copied.",
			diagnosticsCopyFailed: "Could not copy diagnostics.",
			filterAll: "All",
			filterCategory: "Category",
			filterManagementPlane: "Management plane",
			filterCompositionScope: "Composition scope",
			filterPolicy: "Policy",
			filterVerification: "Inspection status",
			filterRuntime: "Runtime state",
			filterAnomalies: "Anomalies only",
			capabilityName: "Name: {name}",
			presetManaged: "Managed by Agent Preset",
			effectiveDisabled: "Effective: disabled",
			effectiveEnabled: "Effective: enabled",
			detailsShow: "Show machine evidence",
			detailsHide: "Hide machine evidence",
			lockReason: "Lock reason",
			compositionScope: "Composition scope",
			mutationControls: "Mutation controls",
			forceEnable: "Force enable",
			forceDisable: "Force disable",
			restoreInheritance: "Restore inheritance",
			controlsUnavailable: "No executable controls for this entry",
			remoteReadOnly: "Remote Inspector is read-only; configuration mutation requires loopback same-origin access.",
			remoteReadOnlyEligible: "This item could be modified locally, but the current remote read-only mode prevents mutation.",
			mutationFailed: "Mutation failed: {message}",
			mutationSubmitted: "Submitted. The authoritative server state was re-read; refresh to update the loaded client.",
			restoreSubmitted: "Profile inheritance restored. The authoritative server state was re-read; effective state may differ temporarily while DSH profile/HMR recomposes.",
			copyCopied: "Copied",
			copyFailed: "Copy failed",
			expectedPackage: "Expected package",
			reviewed: "Reviewed",
			reviewedReference: "Reviewed reference / provenance",
			declaredInject: "Declared inject evidence",
			dependencyEvidence: "Dependency evidence",
			leafReview: "Leaf review conclusion",
			compatibilityFindings: "Compatibility findings",
			eligibilityReasons: "Eligibility reasons",
			limitations: "Limitations",
			provides: "Provides",
			consumers: "Consumers",
			profilePersistence: "Profile persistence preflight",
			yes: "Yes",
			no: "No",
			none: "None",
			unknown: "Unknown",
			noEvidence: "No available evidence",
			injectNotDeclared: "Reviewed patch declares no inject array",
			injectDeclaredEmpty: "Declared empty inject set",
			dependencyObserved: "Observed",
			verificationVerified: "Verified",
			verificationDrifted: "Drifted",
			verificationUnverified: "Unverified",
			verificationNoDrift: "No structural drift observed",
			verificationEvidenceIncomplete: "Evidence incomplete",
			verificationIdentityMismatch: "Runtime identity mismatch",
			verificationUnreviewed: "Unreviewed",
			verificationNotApplicable: "Agent Preset; not a baseline verification target",
			runtimeIdentityMatched: "Matched",
			runtimeIdentityMismatched: "Mismatched",
			runtimeIdentityUnavailable: "Unavailable",
			profileInherited: "Inherited",
			profileExplicitlyEnabled: "Explicitly enabled",
			profileExplicitlyDisabled: "Explicitly disabled",
			profileUnavailable: "Unavailable",
			profileNotApplicable: "Not applicable (Agent Preset composition)",
			profileWritable: "Writable",
			profileUnwritable: "Unwritable",
			lifecycleInactive: "Inactive",
			lifecyclePending: "Pending",
			lifecycleLoading: "Loading",
			lifecycleActive: "Active",
			lifecycleFailed: "Failed",
			lifecycleUnloading: "Unloading",
			lifecycleUnknown: "Unknown",
			findingMissingExpectedEntry: "Missing expected entry",
			findingNewOfficialEntry: "New official entry",
			findingPackageIdentityChanged: "Package identity drift",
			findingDeclaredInjectChanged: "Inject drift",
			findingBaselinePackageUnknown: "Baseline package identity unknown",
			findingDuplicateRuntimeId: "Duplicate Loader ID",
			findingRuntimeReleaseIdentityUnavailable: "Runtime identity unavailable",
			findingRuntimeReleaseIdentityMismatch: "Runtime identity mismatch",
			findingRuntimeAugmentationShapeChanged: "Runtime augmentation shape changed",
			findingRuntimeAugmentationIdConflictsBaseline: "Runtime augmentation id conflicts with baseline",
			eligibilityNotManageable: "Not in manageable allowlist",
			eligibilityMissingRuntimeEntry: "Missing runtime entry",
			eligibilityReviewedBaselineMissing: "Missing reviewed baseline",
			eligibilityReviewedSafeLeafEvidenceMissing: "Missing safe-leaf evidence",
			eligibilityTargetStructuralDrift: "Target structural drift",
			eligibilityGlobalStructuralDrift: "Global structural drift",
			eligibilityRuntimeIdentityMismatch: "Runtime identity mismatch",
			eligibilityProfileNotPersistable: "Profile cannot be safely written",
			eligibilityAgentPresetScope: "Agent Preset composition rows are not Host mutation targets",
			limitationRuntimeIdentityUnavailable: "Runtime release identity unavailable",
			limitationConsumerGraphNotExposed: "Consumer graph not exposed",
			leafReviewReviewedSafeUiLeaf: "Reviewed safe UI leaf",
			leafReviewLockedDependency: "Locked dependency",
			leafReviewNotReviewed: "Not reviewed",
			categoryPresentation: "Presentation",
			categoryAgent: "Agent",
			categoryTransport: "Transport",
			categoryInfrastructure: "Infrastructure",
			categoryUnknown: "Unknown category",
			planeBrowser: "Browser",
			planeHost: "Host",
			planeAgentPreset: "Agent Preset",
			planeUnknown: "Unknown plane",
			policyManageable: "Manageable",
			policyLocked: "Locked",
			lockSelf: "Plugin itself",
			lockCore: "Core infrastructure",
			lockUnlisted: "Not on allowlist",
			lockExternal: "External plugin",
			lockAgentPreset: "Agent Preset composition row"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.builtins";
		/** Services required by the Settings registration. */
		const inject = ["slots", "locale"];
		/** Contribute the lazy Built-ins tab to the Plugins settings section. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "builtin-toggles: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "builtins",
				order: 20,
				label: () => t("tab"),
				locale: NS,
				inject: () => ({})
			}, BuiltinTogglesTab));
		}
		//#endregion
		exports.NS = NS;
		exports.PRESET_MANAGED = PRESET_MANAGED;
		exports.PRESET_MANAGED_IDS = PRESET_MANAGED_IDS;
		exports.apply = apply;
		exports.getBuiltinCatalogEntry = getBuiltinCatalogEntry;
		exports.getCapabilityPresentation = getCapabilityPresentation;
		exports.getEnglishCatalogEntry = getEnglishCatalogEntry;
		exports.inject = inject;
		exports.matchesSearch = matchesSearch;
		exports.moduleShortName = moduleShortName;
		exports.normalizeSearch = normalizeSearch;
		exports.resolveCatalogEntry = resolveCatalogEntry;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map