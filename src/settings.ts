import {App, Modal, Notice, PluginSettingTab, Setting, setIcon} from "obsidian";
import type ObsidianRegexRefinerPlugin from "./main";
import {createDefaultDag, createDefaultStep, createId} from "./helpers";
import {DAG, Step, StepType} from "./types";

class ConfirmActionModal extends Modal {
	private readonly title: string;
	private readonly message: string;
	private readonly confirmLabel: string;
	private readonly onConfirm: () => void | Promise<void>;

	constructor(
		app: App,
		title: string,
		message: string,
		confirmLabel: string,
		onConfirm: () => void | Promise<void>
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.confirmLabel = confirmLabel;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("h3", {text: this.title});
		contentEl.createEl("p", {text: this.message});

		const actionRow = contentEl.createDiv({cls: "orr-confirm-actions"});
		const cancelButton = actionRow.createEl("button", {text: "Cancel"});
		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => this.close());

		const confirmButton = actionRow.createEl("button", {text: this.confirmLabel, cls: "mod-warning"});
		confirmButton.type = "button";
		confirmButton.addEventListener("click", () => {
			void Promise.resolve(this.onConfirm()).finally(() => this.close());
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class ExportJsonModal extends Modal {
	private readonly jsonText: string;

	constructor(app: App, jsonText: string) {
		super(app);
		this.jsonText = jsonText;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("h3", {text: "Export DAG settings (JSON)"});

		const textarea = contentEl.createEl("textarea", {
			cls: "orr-json-textarea",
		});
		textarea.value = this.jsonText;
		textarea.readOnly = true;

		const actionRow = contentEl.createDiv({cls: "orr-confirm-actions"});
		const copyButton = actionRow.createEl("button", {text: "Copy"});
		copyButton.type = "button";
			copyButton.addEventListener("click", () => {
				void (async () => {
				try {
					await navigator.clipboard.writeText(this.jsonText);
					new Notice("Export JSON copied.");
				} catch {
					new Notice("Copy failed. Select and copy manually.");
				}
				})();
			});

		const closeButton = actionRow.createEl("button", {text: "Close"});
		closeButton.type = "button";
		closeButton.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class ImportJsonModal extends Modal {
	private readonly onImport: (jsonText: string) => Promise<boolean>;

	constructor(app: App, onImport: (jsonText: string) => Promise<boolean>) {
		super(app);
		this.onImport = onImport;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("h3", {text: "Import DAG settings (JSON)"});
		contentEl.createEl("p", {
				text: "Imported pipelines will be added to your current list. Existing pipelines are kept.",
		});

		const textarea = contentEl.createEl("textarea", {
			cls: "orr-json-textarea",
		});
		textarea.placeholder = "Paste JSON here...";

		const actionRow = contentEl.createDiv({cls: "orr-confirm-actions"});
		const cancelButton = actionRow.createEl("button", {text: "Cancel"});
		cancelButton.type = "button";
		cancelButton.addEventListener("click", () => this.close());

		const importButton = actionRow.createEl("button", {text: "Import", cls: "mod-cta"});
		importButton.type = "button";
		importButton.addEventListener("click", () => {
			void (async () => {
				const imported = await this.onImport(textarea.value);
				if (imported) {
					this.close();
				}
			})();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class RegexRefinerSettingTab extends PluginSettingTab {
	private readonly plugin: ObsidianRegexRefinerPlugin;
	private readonly expandedDagIds: Set<string> = new Set();

	constructor(app: App, plugin: ObsidianRegexRefinerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Pipeline library")
			.setHeading();

		new Setting(containerEl)
			.setName("DAG pipelines")
			.setDesc("Create and manage multiple text-refactoring pipelines.")
			.addButton((button) => {
				button.setButtonText("Add DAG");
				button.onClick(() => {
					this.plugin.settings.dags.push(createDefaultDag());
					void this.persistAndRefresh();
				});
			})
			.addButton((button) => {
				button.setButtonText("Export JSON");
				button.onClick(() => {
					const exportJson = JSON.stringify({dags: this.plugin.settings.dags}, null, 2);
					new ExportJsonModal(this.app, exportJson).open();
				});
			})
			.addButton((button) => {
				button.setButtonText("Import JSON");
				button.onClick(() => {
					new ImportJsonModal(this.app, async (jsonText) => {
						return await this.importJsonAndAppend(jsonText);
					}).open();
				});
			});

		const listEl = containerEl.createDiv({cls: "orr-dag-list"});
		if (this.plugin.settings.dags.length === 0) {
			listEl.createEl("p", {
				cls: "orr-empty-message",
				text: "No pipelines yet. Select the add DAG button to create one.",
			});
			return;
		}

		for (const dag of this.plugin.settings.dags) {
			this.renderDagEditor(listEl, dag);
		}
	}

	private renderDagEditor(parent: HTMLElement, dag: DAG): void {
		const dagEl = parent.createDiv({cls: "orr-dag-item"});
		const headerEl = dagEl.createDiv({cls: "orr-dag-header"});
		const expanded = this.expandedDagIds.has(dag.id);

		const toggleButton = headerEl.createEl("button", {cls: "orr-dag-toggle"});
		toggleButton.type = "button";
		toggleButton.createSpan({cls: "orr-chevron", text: expanded ? "▼" : "▶"});
		toggleButton.createSpan({text: dag.name || "Untitled DAG"});
		toggleButton.addEventListener("click", () => {
			this.toggleDag(dag.id);
		});

		const deleteButton = headerEl.createEl("button", {cls: "clickable-icon orr-danger-icon", attr: {"aria-label": "Delete DAG"}});
		deleteButton.type = "button";
		setIcon(deleteButton, "trash");
		deleteButton.addEventListener("click", (event) => {
			event.stopPropagation();
			new ConfirmActionModal(
				this.app,
				"Delete DAG",
				`Delete DAG "${dag.name || "Untitled DAG"}" and all of its steps?`,
				"Delete",
				async () => {
					this.plugin.settings.dags = this.plugin.settings.dags.filter((item) => item.id !== dag.id);
					this.expandedDagIds.delete(dag.id);
					await this.persistAndRefresh();
				}
			).open();
		});

		if (!expanded) {
			return;
		}

		const bodyEl = dagEl.createDiv({cls: "orr-dag-body"});

		new Setting(bodyEl)
			.setName("DAG name")
			.setDesc("Name shown in the command picker modal.")
			.addText((text) => {
				text.setPlaceholder("My DAG");
				text.setValue(dag.name);
				text.onChange((value) => {
					dag.name = value;
					void this.persist();
				});
			});

		new Setting(bodyEl)
			.setName("Steps")
			.setDesc("Steps run top-to-bottom.")
			.addButton((button) => {
				button.setButtonText("Add step");
				button.onClick(() => {
					dag.steps.push(createDefaultStep());
					void this.persistAndRefresh();
				});
			});

		if (dag.steps.length === 0) {
			bodyEl.createEl("p", {
				cls: "orr-empty-message",
				text: "No steps yet. Select the add step button to create one.",
			});
			return;
		}

		for (let index = 0; index < dag.steps.length; index++) {
			const step = dag.steps[index];
			if (!step) {
				continue;
			}
			this.renderStepEditor(bodyEl, dag, step, index);
		}
	}

	private renderStepEditor(parent: HTMLElement, dag: DAG, step: Step, index: number): void {
		const stepEl = parent.createDiv({cls: "orr-step-item"});
		const stepHeader = stepEl.createDiv({cls: "orr-step-header"});
		stepHeader.createDiv({
			cls: "orr-step-title",
			text: `Step ${index + 1}: ${step.name || "Untitled step"}`,
		});

		const deleteStepButton = stepHeader.createEl("button", {cls: "clickable-icon orr-danger-icon", attr: {"aria-label": "Delete step"}});
		deleteStepButton.type = "button";
		setIcon(deleteStepButton, "trash");
		deleteStepButton.addEventListener("click", () => {
			new ConfirmActionModal(
				this.app,
				"Delete step",
				`Delete step "${step.name || "Untitled step"}"?`,
				"Delete",
				async () => {
					dag.steps = dag.steps.filter((item) => item.id !== step.id);
					await this.persistAndRefresh();
				}
			).open();
		});

		new Setting(stepEl)
			.setName("Step name")
			.addText((text) => {
				text.setPlaceholder("Short step title");
				text.setValue(step.name);
				text.onChange((value) => {
					step.name = value;
					void this.persist();
				});
			});

		new Setting(stepEl)
			.setName("Step description")
			.addText((text) => {
				text.setPlaceholder("What this step does");
				text.setValue(step.description);
				text.onChange((value) => {
					step.description = value;
					void this.persist();
				});
			});

		new Setting(stepEl)
			.setName("Step type")
			.addDropdown((dropdown) => {
				dropdown.addOption("Regex", "Regex");
				dropdown.addOption("Replace", "Replace");
				dropdown.setValue(step.type);
				dropdown.onChange((value) => {
					step.type = normalizeStepType(value);
					void this.persist();
				});
			});

		new Setting(stepEl)
			.setName("Find")
			.setDesc("Pattern (regex) or literal text (replace).")
			.addText((text) => {
				text.setPlaceholder("Find text");
				text.setValue(step.find);
				text.onChange((value) => {
					step.find = value;
					void this.persist();
				});
			});

		new Setting(stepEl)
			.setName("Replace")
			.addText((text) => {
				text.setPlaceholder("Replacement text");
				text.setValue(step.replace);
				text.onChange((value) => {
					step.replace = value;
					void this.persist();
				});
			});
	}

	private toggleDag(dagId: string): void {
		if (this.expandedDagIds.has(dagId)) {
			this.expandedDagIds.delete(dagId);
		} else {
			this.expandedDagIds.add(dagId);
		}
		this.display();
	}

	private async persist(): Promise<void> {
		await this.plugin.saveSettings();
	}

	private async persistAndRefresh(): Promise<void> {
		await this.persist();
		this.display();
	}

	private async importJsonAndAppend(jsonText: string): Promise<boolean> {
		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			new Notice("Invalid JSON.");
			return false;
		}

		const importedDags = parseImportedDags(parsed);
		if (importedDags.length === 0) {
			new Notice("No valid DAG data found in JSON.");
			return false;
		}

		this.plugin.settings.dags.push(...importedDags);
		await this.persistAndRefresh();
		new Notice(`Imported ${importedDags.length} DAG(s).`);
		return true;
	}
}

function normalizeStepType(value: string): StepType {
	return value === "Regex" ? "Regex" : "Replace";
}

function parseImportedDags(raw: unknown): DAG[] {
	const maybeObject = isRecord(raw) ? raw : null;
	const rawDags = Array.isArray(raw) ? raw : maybeObject?.dags;
	if (!Array.isArray(rawDags)) {
		return [];
	}

	const dags: DAG[] = [];
	for (const dagValue of rawDags) {
		const dag = parseSingleImportedDag(dagValue);
		if (dag) {
			dags.push(dag);
		}
	}
	return dags;
}

function parseSingleImportedDag(raw: unknown): DAG | null {
	if (!isRecord(raw)) {
		return null;
	}

	const rawName = typeof raw.name === "string" ? raw.name : "Imported DAG";
	const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
	const steps: Step[] = [];

	for (const stepValue of rawSteps) {
		const step = parseSingleImportedStep(stepValue);
		if (step) {
			steps.push(step);
		}
	}

	return {
		id: createId("dag"),
		name: rawName,
		steps,
	};
}

function parseSingleImportedStep(raw: unknown): Step | null {
	if (!isRecord(raw)) {
		return null;
	}

	const type = raw.type === "Regex" ? "Regex" : "Replace";
	const find = typeof raw.find === "string" ? raw.find : "";
	const replace = typeof raw.replace === "string" ? raw.replace : "";
	const name = typeof raw.name === "string" ? raw.name : "Imported step";
	const description = typeof raw.description === "string" ? raw.description : "";

	return {
		id: createId("step"),
		name,
		description,
		type,
		find,
		replace,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
