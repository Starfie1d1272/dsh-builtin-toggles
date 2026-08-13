window.__ModuleLoader__.load({
	id: "dsh-builtin-toggles",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/BuiltinTogglesTab.tsx
		/**
		* Built-ins tab: Settings → Plugins → Built-ins.
		*
		* Section A lists the manageable allowlisted entries with a real switch.
		* Section B lists every other official built-in as locked rows (collapsed by
		* default), so users can see why most built-ins cannot be turned off.
		*
		* The server is the authority: after every toggle the snapshot is re-read,
		* and failures re-read it too instead of trusting optimistic local state.
		* Mutations are serialized — only one toggle request runs at a time.
		*/
		const API = "/api/builtin-toggles";
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			width: "100%",
			maxWidth: 760,
			color: "var(--dsw-alias-label-primary)"
		};
		const headingStyle = {
			margin: 0,
			fontSize: 15,
			lineHeight: "22px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const introStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const statusLineStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const errorStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-state-error-primary)"
		};
		const retryButtonStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			cursor: "pointer",
			background: "transparent",
			borderRadius: 6,
			padding: "4px 10px",
			fontSize: 13
		};
		const blockStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const cardStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-layer-3)",
			borderRadius: 10,
			padding: "12px 14px",
			display: "flex",
			alignItems: "center",
			gap: 12
		};
		const cardMainStyle = {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			gap: 3
		};
		const nameStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)",
			overflowWrap: "anywhere"
		};
		const idStyle = {
			margin: 0,
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)",
			fontFamily: "var(--ds-font-family-code)",
			overflowWrap: "anywhere"
		};
		const descStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const statusTagStyle = {
			background: "var(--dsw-alias-bg-layer-1)",
			borderRadius: 5,
			padding: "1px 6px",
			fontSize: 11,
			lineHeight: "16px",
			whiteSpace: "nowrap",
			fontVariantNumeric: "tabular-nums"
		};
		const enabledTagStyle = {
			...statusTagStyle,
			color: "var(--dsw-alias-state-success-primary)",
			background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)"
		};
		const disabledTagStyle = {
			...statusTagStyle,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const lockedTagStyle = {
			...statusTagStyle,
			color: "var(--dsw-alias-label-tertiary)",
			background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)"
		};
		const toggleButtonStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer",
			background: "transparent",
			borderRadius: 6,
			padding: "3px 8px"
		};
		const switchStyle = {
			position: "relative",
			flex: "none",
			width: 36,
			height: 20,
			borderRadius: 999,
			border: "none",
			padding: 0,
			cursor: "pointer",
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "inset 0 0 0 1px var(--dsw-alias-border-l2)",
			transition: "background .14s var(--ds-ease-in-out)"
		};
		const switchOnStyle = {
			...switchStyle,
			background: "var(--dsw-alias-state-business-primary)",
			boxShadow: "none"
		};
		const switchDisabledStyle = {
			...switchStyle,
			cursor: "default",
			opacity: .55
		};
		const knobStyle = {
			position: "absolute",
			top: 2,
			left: 2,
			width: 16,
			height: 16,
			borderRadius: 999,
			background: "var(--dsw-alias-bg-base)",
			transition: "transform .14s var(--ds-ease-in-out)"
		};
		const knobOnStyle = {
			...knobStyle,
			transform: "translateX(16px)"
		};
		function Switch(props) {
			const { on, disabled, label, onToggle } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				role: "switch",
				"aria-checked": on,
				"aria-label": label,
				"aria-disabled": disabled || void 0,
				disabled,
				onClick: onToggle,
				style: disabled ? switchDisabledStyle : on ? switchOnStyle : switchStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: on ? knobOnStyle : knobStyle,
					"aria-hidden": "true"
				})
			});
		}
		function phaseKey(phase) {
			if (phase === null) return "phaseUnobserved";
			switch (phase) {
				case "pending": return "phasePending";
				case "loading": return "phaseLoading";
				case "active": return "phaseActive";
				case "failed": return "phaseFailed";
				case "unloading": return "phaseUnloading";
				default: return null;
			}
		}
		const DESCRIPTION = {
			"ui-deliverables": "descUiDeliverables",
			"ui-jobs": "descUiJobs",
			"ui-goal": "descUiGoal",
			"ui-message-feedback": "descUiMessageFeedback",
			"ui-model-selection": "descUiModelSelection",
			"ui-agent-preset": "descUiAgentPreset",
			"ui-commands": "descUiCommands",
			"ui-skill": "descUiSkill",
			"ui-subagent": "descUiSubagent",
			"ui-trajectory": "descUiTrajectory"
		};
		const REASON_KEY = {
			self: "reasonSelf",
			core: "reasonCore",
			unlisted: "reasonUnlisted",
			external: "reasonExternal"
		};
		function BuiltinTogglesTab({ t }) {
			const [view, setView] = (0, react.useState)({ status: "loading" });
			const [busyId, setBusyId] = (0, react.useState)(null);
			const [toggleError, setToggleError] = (0, react.useState)(null);
			const [showLocked, setShowLocked] = (0, react.useState)(false);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const queue = (0, react.useRef)(Promise.resolve());
			const load = (0, react.useCallback)(async (silent = false) => {
				if (!silent) setView({ status: "loading" });
				try {
					const res = await fetch(API);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					setView({
						status: "ready",
						plugins: data.plugins
					});
				} catch {
					setView((previous) => silent && previous.status === "ready" ? previous : { status: "error" });
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load, attempt]);
			const toggle = (0, react.useCallback)((id, disabled) => {
				const run = async () => {
					setBusyId(id);
					setToggleError(null);
					try {
						const res = await fetch(`${API}/${encodeURIComponent(id)}`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({ disabled })
						});
						if (!res.ok) {
							const data = await res.json().catch(() => null);
							throw new Error(data?.message ?? `HTTP ${res.status}`);
						}
					} catch (error) {
						setToggleError(error instanceof Error ? error.message : String(error));
					} finally {
						setBusyId(null);
						await load(true);
					}
				};
				queue.current = queue.current.then(run, run);
			}, [load]);
			if (view.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: sectionStyle,
				"aria-busy": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: statusLineStyle,
					children: t("loading")
				})
			});
			if (view.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: sectionStyle,
				role: "alert",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: errorStyle,
					children: t("error")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: retryButtonStyle,
					onClick: () => setAttempt((n) => n + 1),
					children: t("retry")
				}) })]
			});
			const manageable = view.plugins.filter((plugin) => plugin.manageable);
			const locked = view.plugins.filter((plugin) => !plugin.manageable);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: t("intro")
					}),
					toggleError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle,
						role: "alert",
						children: t("toggleFailed", { message: toggleError })
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: headingStyle,
						children: t("manageableHeading")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: blockStyle,
						children: manageable.map((plugin) => {
							const busy = busyId === plugin.id;
							const on = !plugin.disabled;
							const phase = phaseKey(plugin.phase);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								style: cardStyle,
								"aria-busy": busy || void 0,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: cardMainStyle,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: nameStyle,
											children: plugin.name.split("/").pop()
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: idStyle,
											children: plugin.id
										}),
										DESCRIPTION[plugin.id] !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: descStyle,
											children: t(DESCRIPTION[plugin.id])
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												gap: 6,
												alignItems: "center",
												marginTop: 2
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: on ? enabledTagStyle : disabledTagStyle,
													children: on ? t("enabled") : t("disabled")
												}),
												phase !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: statusTagStyle,
													children: t(phase)
												}) : null,
												busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: statusTagStyle,
													children: t("busy")
												}) : null
											]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
									on,
									disabled: busy || busyId !== null,
									label: t(on ? "toggleDisable" : "toggleEnable", { name: plugin.id }),
									onToggle: () => {
										toggle(plugin.id, on);
									}
								})]
							}, plugin.id);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 10,
							marginTop: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							style: {
								...headingStyle,
								margin: 0
							},
							children: t("lockedHeading")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: toggleButtonStyle,
							"aria-expanded": showLocked,
							onClick: () => setShowLocked((v) => !v),
							children: showLocked ? t("hideLocked") : t("lockedHint") + " · " + String(locked.length)
						})]
					}),
					showLocked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: blockStyle,
						children: locked.map((plugin) => {
							const phase = phaseKey(plugin.phase);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								style: cardStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: cardMainStyle,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: nameStyle,
											children: plugin.name.split("/").pop()
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: idStyle,
											children: plugin.id
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												gap: 6,
												alignItems: "center",
												marginTop: 2
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: lockedTagStyle,
												title: t("reasonLabel"),
												children: plugin.reason !== void 0 ? t(REASON_KEY[plugin.reason] ?? "reasonUnlisted") : t("reasonUnlisted")
											}), phase !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: statusTagStyle,
												children: t(phase)
											}) : null]
										})
									]
								})
							}, plugin.id);
						})
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** 中文词典。 */
		const zh = {
			tab: "内置开关",
			loading: "正在读取内置插件…",
			error: "内置插件暂时不可用。",
			retry: "重试",
			intro: "这里只允许开关一小撮经过安全审核的官方 Web UI 插件；其他内置插件默认锁定。",
			manageableHeading: "可管理",
			lockedHeading: "其他内置插件",
			lockedHint: "以下官方内置插件已锁定，不能通过本面板操作。",
			showLocked: "查看其他内置插件",
			hideLocked: "收起",
			enabled: "已启用",
			disabled: "已停用",
			phasePending: "等待依赖",
			phaseLoading: "加载中",
			phaseActive: "运行中",
			phaseFailed: "挂载失败",
			phaseUnloading: "卸载中",
			phaseUnobserved: "未挂载",
			toggleEnable: "启用 {name}",
			toggleDisable: "停用 {name}",
			busy: "正在应用…",
			toggleFailed: "操作失败：{message}",
			reasonSelf: "自身",
			reasonCore: "核心",
			reasonUnlisted: "未收录",
			reasonExternal: "外部",
			reasonLabel: "锁定原因",
			descUiDeliverables: "在每条助手消息下方展示产物文件。",
			descUiJobs: "在会话头部展示后台任务列表。",
			descUiGoal: "在输入坞展示目标进度条。",
			descUiMessageFeedback: "在消息操作区展示赞 / 踩反馈。",
			descUiModelSelection: "模型选择器（/model）。",
			descUiAgentPreset: "默认 Agent 预设选择器。",
			descUiCommands: "“/” 命令面板。",
			descUiSkill: "技能选择器（@ 引用源）。",
			descUiSubagent: "子代理选择器（@ 引用源）。",
			descUiTrajectory: "轨迹面板。"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Built-ins",
			loading: "Reading built-in plugins…",
			error: "Built-in plugins are temporarily unavailable.",
			retry: "Retry",
			intro: "Only a small, security-reviewed set of official Web UI plugins can be toggled here; every other built-in stays locked.",
			manageableHeading: "Manageable",
			lockedHeading: "Other built-ins",
			lockedHint: "The following official built-ins are locked and cannot be operated from this panel.",
			showLocked: "Show other built-ins",
			hideLocked: "Collapse",
			enabled: "Enabled",
			disabled: "Disabled",
			phasePending: "Waiting for dependencies",
			phaseLoading: "Loading",
			phaseActive: "Active",
			phaseFailed: "Mount failed",
			phaseUnloading: "Unloading",
			phaseUnobserved: "Not mounted",
			toggleEnable: "Enable {name}",
			toggleDisable: "Disable {name}",
			busy: "Applying…",
			toggleFailed: "Toggle failed: {message}",
			reasonSelf: "Self",
			reasonCore: "Core",
			reasonUnlisted: "Unlisted",
			reasonExternal: "External",
			reasonLabel: "Lock reason",
			descUiDeliverables: "Produced files under each assistant message.",
			descUiJobs: "Background jobs list in the session header.",
			descUiGoal: "Goal progress bar in the input dock.",
			descUiMessageFeedback: "Like / dislike feedback in the message action strip.",
			descUiModelSelection: "Model selector (/model).",
			descUiAgentPreset: "Default agent preset picker.",
			descUiCommands: "The \"/\" command surface.",
			descUiSkill: "Skill picker (@ reference source).",
			descUiSubagent: "Subagent picker (@ reference source).",
			descUiTrajectory: "Trajectory panel."
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
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map