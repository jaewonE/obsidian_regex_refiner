export type StepType = "Regex" | "Replace";

export interface Step {
	id: string;
	name: string;
	description: string;
	type: StepType;
	find: string;
	replace: string;
}

export interface DAG {
	id: string;
	name: string;
	steps: Step[];
}

export interface RegexRefinerSettings {
	dags: DAG[];
}

export interface TextTransformResult {
	text: string;
	replacements: number;
}

export interface DagExecutionResult {
	ok: boolean;
	text: string;
	replacements: number;
	error?: string;
}
