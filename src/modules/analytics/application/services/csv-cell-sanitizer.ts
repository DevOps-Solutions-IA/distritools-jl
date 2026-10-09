const FORMULA_PREFIX = /^[\s\u0000-\u001f\u007f\ufeff]*[=+\-@]/u;
const NUMERIC_VALUE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function csvCell(value: unknown): string {
  let text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  if (FORMULA_PREFIX.test(text) && !NUMERIC_VALUE.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}
