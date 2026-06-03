/**
 * Heuristic language detection from a document's content.
 *
 * Used by the editor store to label documents and drive syntax highlighting
 * when no explicit language is stored. Order matters: more specific patterns
 * are checked before more general ones (e.g. TypeScript before JavaScript).
 */
export function detectLanguage(content: string): string {
  const code = content.toLowerCase();

  // Python: def/import/print are strong signals.
  if (/\bdef\s+\w+\s*\(/.test(content) || /\bimport\s+\w+/.test(content) || /\bprint\s*\(/.test(content)) {
    return 'python';
  }
  // TypeScript: interfaces, type aliases, and type annotations.
  if (/\binterface\s+\w+/.test(content) || /:\s*(string|number|boolean)/.test(code) || /\btype\s+\w+\s*=/.test(content)) {
    return 'typescript';
  }
  // JavaScript: functions, declarations, arrows, console.
  if (/\bfunction\s+\w+/.test(content) || /\bconst\s+\w+/.test(content) || /\blet\s+\w+/.test(content) || /=>/.test(content) || /console\.log/.test(content)) {
    return 'javascript';
  }
  // Java
  if (/\bpublic\s+class/.test(content) || /System\.out\.println/.test(content)) {
    return 'java';
  }
  // C / C++
  if (/#include\s*</.test(content) || /\bint\s+main\s*\(/.test(content)) {
    return 'cpp';
  }
  // HTML
  if (/<html/i.test(content) || /<div/i.test(content) || /<!DOCTYPE/i.test(content)) {
    return 'html';
  }
  // CSS: selector blocks with `prop: value;` declarations.
  if (/[.#]\w+\s*\{/.test(content) && /:\s*\w+;/.test(content)) {
    return 'css';
  }
  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(content)) {
    return 'sql';
  }
  // JSON: looks like an object/array AND actually parses.
  if (/^\s*[\[{]/.test(content) && /[\]}]\s*$/.test(content)) {
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      /* not valid JSON — fall through */
    }
  }
  return 'text';
}
