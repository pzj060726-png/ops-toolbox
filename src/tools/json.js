/**
 * JSON 格式化 / 压缩 / 校验。
 * 全部为纯函数，不依赖 DOM，可同时在浏览器与 Node 中运行。
 */

const encoder = new TextEncoder();

/** 把 2 / 4 / "tab" 统一成缩进字符串。 */
export function normalizeIndent(indent) {
  if (indent === "tab" || indent === "\t") return "\t";
  const n = Number(indent);
  if (!Number.isFinite(n) || n <= 0) return "  ";
  return " ".repeat(Math.min(10, Math.floor(n)));
}

/** UTF-8 字节数（按真实字节计算，而不是字符数）。 */
export function utf8ByteLength(text) {
  return encoder.encode(String(text)).length;
}

function lineColumnAt(text, position) {
  const clamped = Math.max(0, Math.min(position, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

function excerptAt(text, line) {
  const lines = text.split(/\r?\n/);
  return lines[line - 1] ?? "";
}

/**
 * 老版 V8 会给出 "at position 12"；Node 20+ 改成只贴一段上下文：
 *   Unexpected token '}', ..."1,\n  \"b\": }\n}" is not valid JSON
 * 这里把上下文片段在原文里找回来，从而还原出错位置。
 */
function findSnippetPosition(source, raw) {
  const contextMatch = raw.match(/\.\.\."([\s\S]*)" is not valid JSON\s*$/);
  if (!contextMatch) return null;
  const snippet = contextMatch[1];
  const index = source.indexOf(snippet);
  if (index === -1) return null;
  const tokenMatch = raw.match(/^Unexpected token '(.*?)',\s/s);
  if (!tokenMatch) return index;
  const offset = snippet.indexOf(tokenMatch[1]);
  return index + Math.max(0, offset);
}

/**
 * 从引擎原始报错里提取行列信息。
 * V8（Node / Chrome）消息形如：
 *   Unexpected token } in JSON at position 12
 *   Expected ',' or '}' after property value in JSON at position 5 (line 3 column 4)
 *   Unexpected token '}', ..."1, "b": }" is not valid JSON
 */
function locateJsonError(source, error) {
  const raw = error && error.message ? String(error.message) : "JSON 解析失败";
  const lineColMatch = raw.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  const posMatch = raw.match(/position\s+(\d+)/i);

  let position = posMatch ? Number(posMatch[1]) : findSnippetPosition(source, raw);
  let line = lineColMatch ? Number(lineColMatch[1]) : null;
  let column = lineColMatch ? Number(lineColMatch[2]) : null;

  if (position === null && line !== null && column !== null) {
    const lines = source.split(/\r?\n/);
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i += 1) offset += lines[i].length + 1;
    position = offset + column - 1;
  }
  if (position === null) position = source.length;
  if (line === null || column === null) {
    const computed = lineColumnAt(source, position);
    line = computed.line;
    column = computed.column;
  }

  return {
    message: raw,
    line,
    column,
    position,
    excerpt: excerptAt(source, line),
  };
}

function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = deepSortKeys(value[key]);
    return sorted;
  }
  return value;
}

function measure(value) {
  let keys = 0;
  let depth = 0;
  const stack = [{ node: value, level: 1 }];
  while (stack.length > 0) {
    const { node, level } = stack.pop();
    if (level > depth) depth = level;
    if (Array.isArray(node)) {
      for (const item of node) if (item && typeof item === "object") stack.push({ node: item, level: level + 1 });
    } else if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        keys += 1;
        const child = node[key];
        if (child && typeof child === "object") stack.push({ node: child, level: level + 1 });
      }
    }
  }
  return { keys, depth };
}

/**
 * @param {string} text 待处理的 JSON 文本
 * @param {{ mode?: "pretty"|"minify", indent?: number|string, sortKeys?: boolean }} [options]
 * @returns {{ ok: true, output: string, value: unknown, stats: {bytes:number,lines:number,keys:number,depth:number} }
 *          | { ok: false, output: "", stats: null, error: { message:string,line:number,column:number,position:number,excerpt:string } }}
 */
export function formatJson(text, options = {}) {
  const mode = options.mode === "minify" ? "minify" : "pretty";
  const indent = normalizeIndent(options.indent ?? 2);
  const sortKeys = options.sortKeys === true;
  const source = String(text ?? "");

  if (source.trim() === "") {
    return {
      ok: false,
      output: "",
      value: undefined,
      stats: null,
      error: { message: "输入为空", line: 1, column: 1, position: 0, excerpt: "" },
    };
  }

  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { ok: false, output: "", value: undefined, stats: null, error: locateJsonError(source, error) };
  }

  const prepared = sortKeys ? deepSortKeys(value) : value;
  const output = mode === "minify" ? JSON.stringify(prepared) : JSON.stringify(prepared, null, indent);
  const extra = measure(value);

  return {
    ok: true,
    output,
    value,
    stats: {
      bytes: utf8ByteLength(output),
      lines: output.split("\n").length,
      keys: extra.keys,
      depth: extra.depth,
    },
    error: null,
  };
}

/** 只校验不输出，便于做「粘贴即校验」的场景。 */
export function validateJson(text) {
  const result = formatJson(text, { mode: "minify" });
  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error };
}
