/**
 * JSON with comments and trailing commas (wrangler.jsonc, site.config.jsonc) → value.
 * Comments inside strings ("https://…") are left alone.
 */
export function parseJsonc(source) {
  // Some Windows editors save UTF-8 with a byte-order mark.
  return JSON.parse(stripTrailingCommas(stripJsoncComments(source.replace(/^\uFEFF/, ""))));
}

/** The source without line and block comments; strings are kept as they are. */
export function stripJsoncComments(source) {
  let json = "";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      let close = source.indexOf('"', i + 1);
      while (close !== -1 && isEscaped(source, close)) close = source.indexOf('"', close + 1);
      if (close === -1) throw new SyntaxError("Unterminated string");
      json += source.slice(i, close + 1);
      i = close;
    } else if (char === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      if (end === -1) break;
      i = end - 1;
    } else if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) throw new SyntaxError("Unterminated comment");
      i = end + 1;
    } else {
      json += char;
    }
  }
  return json;
}

/** Whether the quote at `index` is escaped by an odd number of backslashes. */
function isEscaped(source, index) {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && source[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

/** Drops commas before } or ], outside strings. */
function stripTrailingCommas(json) {
  let out = "";
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (char === '"') {
      let close = json.indexOf('"', i + 1);
      while (close !== -1 && isEscaped(json, close)) close = json.indexOf('"', close + 1);
      out += json.slice(i, close + 1);
      i = close;
    } else if (char === "," && /^\s*[}\]]/.test(json.slice(i + 1))) {
      continue;
    } else {
      out += char;
    }
  }
  return out;
}
