import {TextTransformResult} from "./types";

interface LinePart {
	text: string;
	ending: string;
}

export type EditableTransformer = (text: string) => TextTransformResult;

/**
 * Transforms only editable markdown ranges while preserving frontmatter, fenced code,
 * math blocks, inline code/math, and table structure.
 */
export function transformMarkdownEditableContent(input: string, transformEditable: EditableTransformer): TextTransformResult {
	if (input.length === 0) {
		return {text: input, replacements: 0};
	}

	const parts = splitLinesPreserveEndings(input);
	const output: Array<string | undefined> = [];
	let totalReplacements = 0;

	let inFrontmatter = parts[0]?.text === "---";
	let inFence = false;
	let fenceChar = "`";
	let fenceLength = 3;
	let inMathFence = false;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!part) {
			continue;
		}
		const line = part.text;

		if (inFrontmatter) {
			output[i] = line;
			if (i > 0 && (line === "---" || line === "...")) {
				inFrontmatter = false;
			}
			continue;
		}

		if (inFence) {
			output[i] = line;
			if (isFenceClose(line, fenceChar, fenceLength)) {
				inFence = false;
			}
			continue;
		}

		if (inMathFence) {
			output[i] = line;
			if (hasUnescapedDoubleDollar(line)) {
				inMathFence = false;
			}
			continue;
		}

		const fenceOpen = getFenceOpen(line);
		if (fenceOpen !== null) {
			output[i] = line;
			inFence = true;
			fenceChar = fenceOpen.char;
			fenceLength = fenceOpen.length;
			continue;
		}

		if (startsMathFence(line)) {
			output[i] = line;
			if (!isSingleLineMathFence(line)) {
				inMathFence = true;
			}
			continue;
		}

		const nextPart = parts[i + 1];
		const nextLine = nextPart?.text;
		if (nextLine !== undefined && isTableStart(line, nextLine)) {
			const headerResult = transformTableRow(line, transformEditable);
			output[i] = headerResult.text;
			totalReplacements += headerResult.replacements;

			output[i + 1] = nextLine;
			i += 1;

			while (i + 1 < parts.length) {
				const rowPart = parts[i + 1];
				if (!rowPart || !isTableDataRow(rowPart.text)) {
					break;
				}

				const rowResult = transformTableRow(rowPart.text, transformEditable);
				output[i + 1] = rowResult.text;
				totalReplacements += rowResult.replacements;
				i += 1;
			}
			continue;
		}

		const lineResult = transformInlineProtected(line, transformEditable);
		output[i] = lineResult.text;
		totalReplacements += lineResult.replacements;
	}

	let text = "";
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!part) {
			continue;
		}
		text += (output[i] ?? part.text) + part.ending;
	}

	return {text, replacements: totalReplacements};
}

function splitLinesPreserveEndings(input: string): LinePart[] {
	const parts: LinePart[] = [];
	let cursor = 0;

	while (cursor < input.length) {
		const newlineIndex = input.indexOf("\n", cursor);
		if (newlineIndex === -1) {
			parts.push({text: input.slice(cursor), ending: ""});
			return parts;
		}

		if (newlineIndex > cursor && input[newlineIndex - 1] === "\r") {
			parts.push({text: input.slice(cursor, newlineIndex - 1), ending: "\r\n"});
		} else {
			parts.push({text: input.slice(cursor, newlineIndex), ending: "\n"});
		}
		cursor = newlineIndex + 1;
	}

	return parts;
}

function getFenceOpen(line: string): {char: string; length: number} | null {
	const match = line.match(/^\s*(`{3,}|~{3,})/);
	if (!match) {
		return null;
	}

	return {
		char: match[1]?.charAt(0) ?? "`",
		length: match[1]?.length ?? 3,
	};
}

function isFenceClose(line: string, fenceChar: string, fenceLength: number): boolean {
	const escaped = fenceChar === "`" ? "`" : "~";
	const closeRegex = new RegExp(`^\\s*${escaped}{${fenceLength},}\\s*$`);
	return closeRegex.test(line);
}

function startsMathFence(line: string): boolean {
	return /^\s*\$\$/.test(line);
}

function isSingleLineMathFence(line: string): boolean {
	return countUnescapedDoubleDollar(line) >= 2;
}

function hasUnescapedDoubleDollar(line: string): boolean {
	return countUnescapedDoubleDollar(line) > 0;
}

function countUnescapedDoubleDollar(line: string): number {
	let count = 0;
	for (let i = 0; i < line.length - 1; i++) {
		if (line[i] === "$" && line[i + 1] === "$" && !isEscaped(line, i)) {
			count += 1;
			i += 1;
		}
	}
	return count;
}

function isTableStart(headerLine: string, alignmentLine: string): boolean {
	if (headerLine.trim().length === 0) {
		return false;
	}

	const headerSegments = splitByUnescapedPipes(headerLine);
	if (headerSegments === null) {
		return false;
	}

	return isAlignmentRow(alignmentLine);
}

function isTableDataRow(line: string): boolean {
	if (line.trim().length === 0) {
		return false;
	}

	if (startsMathFence(line) || getFenceOpen(line) !== null) {
		return false;
	}

	return splitByUnescapedPipes(line) !== null;
}

function isAlignmentRow(line: string): boolean {
	const segments = splitByUnescapedPipes(line);
	if (segments === null) {
		return false;
	}

	const cells = normalizeTableCells(segments);
	if (cells.length === 0) {
		return false;
	}

	return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function normalizeTableCells(segments: string[]): string[] {
	let cells = [...segments];
	const firstCell = cells[0];
	if (cells.length > 1 && firstCell !== undefined && firstCell.trim() === "") {
		cells = cells.slice(1);
	}
	const lastCell = cells[cells.length - 1];
	if (cells.length > 1 && lastCell !== undefined && lastCell.trim() === "") {
		cells = cells.slice(0, -1);
	}
	return cells;
}

function splitByUnescapedPipes(line: string): string[] | null {
	const segments: string[] = [];
	let segmentStart = 0;
	let hasPipe = false;

	for (let i = 0; i < line.length; i++) {
		if (line[i] === "|" && !isEscaped(line, i)) {
			segments.push(line.slice(segmentStart, i));
			segmentStart = i + 1;
			hasPipe = true;
		}
	}

	if (!hasPipe) {
		return null;
	}

	segments.push(line.slice(segmentStart));
	return segments;
}

function transformTableRow(line: string, transformEditable: EditableTransformer): TextTransformResult {
	const segments = splitByUnescapedPipes(line);
	if (segments === null) {
		return transformInlineProtected(line, transformEditable);
	}

	let replacements = 0;
	let text = "";

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		if (segment === undefined) {
			continue;
		}
		const segmentResult = transformInlineProtected(segment, transformEditable);
		text += segmentResult.text;
		replacements += segmentResult.replacements;
		if (i < segments.length - 1) {
			text += "|";
		}
	}

	return {text, replacements};
}

function transformInlineProtected(line: string, transformEditable: EditableTransformer): TextTransformResult {
	let text = "";
	let buffer = "";
	let replacements = 0;
	let cursor = 0;

	const flushBuffer = () => {
		if (buffer.length === 0) {
			return;
		}
		const result = transformEditable(buffer);
		text += result.text;
		replacements += result.replacements;
		buffer = "";
	};

	while (cursor < line.length) {
		const backtickRun = countRunAt(line, cursor, "`");
		if (backtickRun > 0) {
			const closeAt = findBacktickClose(line, cursor + backtickRun, backtickRun);
			if (closeAt !== -1) {
				flushBuffer();
				text += line.slice(cursor, closeAt + backtickRun);
				cursor = closeAt + backtickRun;
				continue;
			}
		}

		if (line[cursor] === "$" && !isEscaped(line, cursor)) {
			if (line[cursor + 1] === "$" && !isEscaped(line, cursor + 1)) {
				const closeAt = findDoubleDollarClose(line, cursor + 2);
				if (closeAt !== -1) {
					flushBuffer();
					text += line.slice(cursor, closeAt + 2);
					cursor = closeAt + 2;
					continue;
				}
			} else if (!isAdjacentDollar(line, cursor)) {
				const closeAt = findSingleDollarClose(line, cursor + 1);
				if (closeAt !== -1) {
					flushBuffer();
					text += line.slice(cursor, closeAt + 1);
					cursor = closeAt + 1;
					continue;
				}
			}
		}

		buffer += line[cursor];
		cursor += 1;
	}

	flushBuffer();
	return {text, replacements};
}

function countRunAt(text: string, start: number, char: string): number {
	let length = 0;
	while (start + length < text.length && text[start + length] === char) {
		length += 1;
	}
	return length;
}

function findBacktickClose(text: string, start: number, runLength: number): number {
	for (let i = start; i <= text.length - runLength; i++) {
		if (countRunAt(text, i, "`") === runLength) {
			return i;
		}
	}
	return -1;
}

function findDoubleDollarClose(text: string, start: number): number {
	for (let i = start; i < text.length - 1; i++) {
		if (text[i] === "$" && text[i + 1] === "$" && !isEscaped(text, i)) {
			return i;
		}
	}
	return -1;
}

function findSingleDollarClose(text: string, start: number): number {
	for (let i = start; i < text.length; i++) {
		if (text[i] !== "$") {
			continue;
		}
		if (isEscaped(text, i) || isAdjacentDollar(text, i)) {
			continue;
		}
		return i;
	}
	return -1;
}

function isAdjacentDollar(text: string, index: number): boolean {
	return text[index - 1] === "$" || text[index + 1] === "$";
}

function isEscaped(text: string, index: number): boolean {
	let backslashCount = 0;
	let i = index - 1;
	while (i >= 0 && text[i] === "\\") {
		backslashCount += 1;
		i -= 1;
	}
	return backslashCount % 2 === 1;
}
