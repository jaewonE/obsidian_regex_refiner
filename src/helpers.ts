import {DAG, RegexRefinerSettings, Step, StepType} from "./types";

export const DEFAULT_SETTINGS: RegexRefinerSettings = {
	dags: [
		{
			id: "dag-example-normalize-spacing",
			name: "Normalize spacing",
			steps: [
				{
					id: "step-example-collapse-spaces",
					name: "Collapse multiple spaces",
					description: "Convert consecutive spaces into a single space.",
					type: "Regex",
					find: " {2,}",
					replace: " ",
				},
			],
		},
	],
};

export function createId(prefix: string): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `${prefix}-${crypto.randomUUID()}`;
	}

	const randomPart = Math.random().toString(36).slice(2, 10);
	return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function createDefaultStep(): Step {
	return {
		id: createId("step"),
		name: "New step",
		description: "",
		type: "Replace",
		find: "",
		replace: "",
	};
}

export function createDefaultDag(): DAG {
	return {
		id: createId("dag"),
		name: "New DAG",
		steps: [createDefaultStep()],
	};
}

export function normalizeSettings(data: Partial<RegexRefinerSettings> | null | undefined): RegexRefinerSettings {
	const dags = data?.dags;
	if (!Array.isArray(dags)) {
		return cloneSettings(DEFAULT_SETTINGS);
	}

	const normalizedDags = dags.map((dag): DAG => ({
		id: dag?.id ?? createId("dag"),
		name: dag?.name ?? "Untitled DAG",
		steps: Array.isArray(dag?.steps)
			? dag.steps.map((step): Step => ({
				id: step?.id ?? createId("step"),
				name: step?.name ?? "Untitled step",
				description: step?.description ?? "",
				type: normalizeStepType(step?.type),
				find: step?.find ?? "",
				replace: step?.replace ?? "",
			}))
			: [],
	}));

	return {
		dags: normalizedDags,
	};
}

function normalizeStepType(type: string | undefined): StepType {
	return type === "Regex" ? "Regex" : "Replace";
}

function cloneSettings(settings: RegexRefinerSettings): RegexRefinerSettings {
	return {
		dags: settings.dags.map((dag) => ({
			id: dag.id,
			name: dag.name,
			steps: dag.steps.map((step) => ({...step})),
		})),
	};
}
