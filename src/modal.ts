import {App, Modal} from "obsidian";
import {DAG} from "./types";

export type DagSelectionCallback = (dag: DAG) => void | Promise<void>;

/**
 * Keyboard + mouse selectable DAG picker modal following the selectableItem.ts interaction pattern.
 */
export class DagPickerModal extends Modal {
	private readonly dags: DAG[];
	private readonly onSelect: DagSelectionCallback;
	private readonly title: string;

	private activeIndex = 0;
	private hoveredIndex: number | null = null;
	private itemElements: HTMLElement[] = [];

	constructor(app: App, dags: DAG[], onSelect: DagSelectionCallback, title = "Select DAG") {
		super(app);
		this.dags = dags;
		this.onSelect = onSelect;
		this.title = title;

		this.scope.register([], "Escape", () => {
			this.close();
			return false;
		});

		this.containerEl.addClass("orr-dag-modal");
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("h4", {text: this.title});

		if (this.dags.length === 0) {
			contentEl.createEl("p", {text: "No pipelines found. Add one in plugin settings."});
			return;
		}

		this.itemElements = [];
		this.dags.forEach((dag, index) => {
			const itemEl = contentEl.createDiv({cls: "orr-selectable-item"});
			itemEl.tabIndex = 0;
			itemEl.createDiv({cls: "orr-selectable-title", text: dag.name || "Untitled DAG"});
			itemEl.createDiv({
				cls: "orr-selectable-meta",
				text: `${dag.steps.length} step${dag.steps.length === 1 ? "" : "s"}`,
			});

			itemEl.addEventListener("click", () => this.selectItem(index));
			itemEl.addEventListener("mouseover", () => this.handleMouseOver(index));
			itemEl.addEventListener("mouseleave", () => this.handleMouseLeave());

			this.itemElements.push(itemEl);
		});

		if (this.itemElements.length > 0) {
			this.activeIndex = 0;
			this.focusItem(this.activeIndex);
		}

		this.scope.register([], "ArrowUp", () => {
			this.navigateItems(-1);
			return false;
		});
		this.scope.register([], "ArrowDown", () => {
			this.navigateItems(1);
			return false;
		});
		this.scope.register([], "Enter", () => {
			if (this.activeIndex >= 0 && this.activeIndex < this.itemElements.length) {
				const activeItem = this.itemElements[this.activeIndex];
				if (activeItem) {
					activeItem.click();
				}
			}
			return false;
		});
	}

	onClose(): void {
		this.contentEl.empty();
		this.itemElements = [];
		this.hoveredIndex = null;
	}

	private navigateItems(direction: number): void {
		if (this.itemElements.length === 0) {
			return;
		}

		if (this.hoveredIndex !== null) {
			this.activeIndex = this.hoveredIndex;
			this.hoveredIndex = null;
		}

		const newIndex = this.activeIndex + direction;
		if (newIndex < 0) {
			this.activeIndex = this.itemElements.length - 1;
		} else if (newIndex >= this.itemElements.length) {
			this.activeIndex = 0;
		} else {
			this.activeIndex = newIndex;
		}

		this.focusItem(this.activeIndex);
	}

	private handleMouseOver(index: number): void {
		this.hoveredIndex = index;
		this.focusItem(index);
	}

	private handleMouseLeave(): void {
		this.hoveredIndex = null;
		this.focusItem(undefined);
	}

	private focusItem(index?: number): void {
		const targetIndex = index ?? -1;
		this.itemElements.forEach((el, i) => {
			if (i === targetIndex) {
				el.addClass("is-focused");
				el.focus();
			} else {
				el.removeClass("is-focused");
			}
		});
	}

	private selectItem(index: number): void {
		if (index < 0 || index >= this.dags.length) {
			return;
		}

		const selectedDag = this.dags[index];
		if (!selectedDag) {
			return;
		}
		void Promise.resolve(this.onSelect(selectedDag));
		this.close();
	}
}
