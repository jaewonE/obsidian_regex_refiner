import {DAG, DagExecutionResult, Step, TextTransformResult} from "./types";
import {transformMarkdownEditableContent} from "./parser_or_segmenter";

interface CompiledStep {
	step: Step;
}

export function executeDagOnMarkdown(originalText: string, dag: DAG): DagExecutionResult {
	const validation = validateDagSteps(dag.steps);
	if (!validation.ok) {
		return {
			ok: false,
			text: originalText,
			replacements: 0,
			error: validation.error,
		};
	}

	let text = originalText;
	let replacements = 0;

	for (const compiledStep of validation.compiledSteps) {
		const result = transformMarkdownEditableContent(text, (editableText) =>
			applyStepToText(editableText, compiledStep.step)
		);
		text = result.text;
		replacements += result.replacements;
	}

	return {
		ok: true,
		text,
		replacements,
	};
}

function validateDagSteps(steps: Step[]):
	| {ok: true; compiledSteps: CompiledStep[]}
	| {ok: false; error: string} {
	const compiledSteps: CompiledStep[] = [];

	for (const step of steps) {
		if (step.find.length === 0) {
			return {
				ok: false,
				error: `Step "${step.name || "(unnamed)"}" has an empty Find field.`,
			};
		}

		if (step.type === "Regex") {
			try {
				// Validate pattern before any text transformation to keep updates transactional.
				void new RegExp(step.find, "g");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					error: `Invalid regex in step "${step.name || "(unnamed)"}": ${message}`,
				};
			}
		}

		compiledSteps.push({step});
	}

	return {
		ok: true,
		compiledSteps,
	};
}

function applyStepToText(text: string, step: Step): TextTransformResult {
	if (step.type === "Regex") {
		const regex = new RegExp(step.find, "g");
		const matches = text.match(regex);
		const replacements = matches?.length ?? 0;
		const updatedText = text.replace(regex, step.replace);
		return {text: updatedText, replacements};
	}

	const find = step.find;
	const parts = text.split(find);
	const replacements = Math.max(0, parts.length - 1);
	return {
		text: parts.join(step.replace),
		replacements,
	};
}
