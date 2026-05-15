import {MarkdownView, Notice, Plugin} from "obsidian";
import {normalizeSettings} from "./helpers";
import {DagPickerModal} from "./modal";
import {executeDagOnMarkdown} from "./processor";
import {RegexRefinerSettingTab} from "./settings";
import {DAG, RegexRefinerSettings} from "./types";

export default class ObsidianRegexRefinerPlugin extends Plugin {
	settings: RegexRefinerSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "apply-regex-refiner-dag",
			name: "Apply regex refiner DAG",
			callback: () => {
				this.openDagPicker();
			},
		});

		this.addSettingTab(new RegexRefinerSettingTab(this.app, this));
	}

	onunload(): void {
		// No-op: all resources are registered through Obsidian lifecycle helpers.
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData() as Partial<RegexRefinerSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private openDagPicker(): void {
		new DagPickerModal(this.app, this.settings.dags, (dag) => {
			void this.applyDagToActiveEditor(dag);
		}, "Select a DAG to apply").open();
	}

	private async applyDagToActiveEditor(dag: DAG): Promise<void> {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) {
			new Notice("Open a Markdown note before applying a DAG.");
			return;
		}

		const editor = markdownView.editor;
		const originalText = editor.getValue();
		const result = executeDagOnMarkdown(originalText, dag);
		if (!result.ok) {
			new Notice(result.error ?? "DAG execution failed.");
			return;
		}

		editor.setValue(result.text);
		new Notice(`Applied "${dag.name || "Untitled DAG"}" (${result.replacements} replacements).`);
	}
}
