/* OpsToolbox 前端逻辑：手写 DOM，无框架、无依赖、无网络请求。 */
import {
  formatJson,
  encodeBase64,
  decodeBase64,
  urlEncode,
  urlDecode,
  timeReport,
  parseTimeInput,
  humanizeDelta,
  COMMON_TIME_ZONES,
  analyzeCidr,
  splitSubnets,
  testRegex,
  replaceRegex,
  decodeJwt,
  diffLines,
  nextRuns,
  describeCron,
  explainFields,
  htmlEscape,
  htmlUnescape,
  unicodeEscape,
  unicodeUnescape,
  hexEncode,
  hexDecode,
  decodeWithCharset,
  CHARSETS,
  textStats,
  sortLines,
  dedupeLines,
  removeEmptyLines,
  trimLines,
  reverseLines,
  generatePassword,
} from "../src/tools/index.js";

const NL = String.fromCharCode(10);
const REPO_URL = "https://github.com/pzj060726-png/ops-toolbox";
const THEME_KEY = "ops-toolbox-theme";

/* ---------------- DOM 小工具 ---------------- */

const appendKid = (node, kid) => {
  if (kid === null || kid === undefined || kid === false) return;
  if (Array.isArray(kid)) {
    for (const inner of kid) appendKid(node, inner);
    return;
  }
  node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
};

const h = (tag, props, ...kids) => {
  const node = document.createElement(tag);
  if (props) {
    for (const key of Object.keys(props)) {
      const value = props[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "style") node.setAttribute("style", value);
      else if (key === "text") node.textContent = String(value);
      else if (key.slice(0, 2) === "on" && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, String(value));
    }
  }
  for (const kid of kids) appendKid(node, kid);
  return node;
};

const replaceKids = (node, ...kids) => {
  node.textContent = "";
  for (const kid of kids) appendKid(node, kid);
};

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(paths, size) {
  const node = document.createElementNS(SVG_NS, "svg");
  node.setAttribute("viewBox", "0 0 24 24");
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "1.8");
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  node.setAttribute("width", String(size || 15));
  node.setAttribute("height", String(size || 15));
  node.innerHTML = paths;
  return node;
}

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4M2 12h2M20 12h2"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
};

const pill = (text, tone) => h("span", {class: "pill" + (tone ? " " + tone : "")}, text);

const checkbox = (text, checked, onChange) => {
  const input = h("input", {type: "checkbox"});
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", {class: "check"}, input, text);
};

function select(options, value, onChange) {
  const node = document.createElement("select");
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    node.append(item);
  }
  node.value = value;
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

const labelled = (text, control) =>
  h("span", {style: "display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--text-soft)"}, text, control);

const debounce = (fn, wait) => {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait || 160);
  };
};

const memo = new Map();
const stateOf = (id, init) => {
  if (!memo.has(id)) memo.set(id, Object.assign({}, init));
  return memo.get(id);
};

let toastTimer = 0;

function toast(message) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 1600);
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.append(area);
    area.select();
    try {
      document.execCommand("copy");
    } catch (ignored) {
      toast("复制失败，请手动选中");
      area.remove();
      return;
    }
    area.remove();
  }
  toast("已复制到剪贴板");
}

const copyBtn = (getText) =>
  h(
    "button",
    {
      class: "copy-icon",
      type: "button",
      title: "复制",
      onclick: () => copyText(getText()),
    },
    svg(ICONS.copy, 13),
  );

function setStatus(node, tone, ...kids) {
  node.className = "status" + (tone ? " " + tone : "");
  replaceKids(node, ...kids.filter((kid) => kid !== null && kid !== undefined));
}

function pane(title, body, extra) {
  return h("div", {class: "pane"}, h("div", {class: "pane-head"}, h("span", {}, title), extra || null), body);
}

function outPane(title, node) {
  return pane(
    title,
    node,
    h(
      "button",
      {
        class: "btn tiny",
        type: "button",
        onclick: () => copyText(node.textContent || ""),
      },
      "复制",
    ),
  );
}

const card = (...kids) => h("div", {class: "card"}, kids);

function kvList(entries) {
  return h(
    "dl",
    {class: "kv-list"},
    entries.map((item) => {
      const label = item[0];
      const value = item[1];
      const options = item[2] || {};
      const dd = h("dd");
      if (options.pill) {
        dd.append(pill(String(value), options.tone));
      } else {
        dd.append(h("span", {}, String(value)));
        if (String(value) !== "" && options.copy !== false) dd.append(copyBtn(() => String(value)));
      }
      return h("div", {class: "kv"}, h("dt", {}, label), dd);
    }),
  );
}

function table(headers, rows) {
  return h(
    "div",
    {class: "table-wrap"},
    h(
      "table",
      {},
      h("thead", {}, h("tr", {}, headers.map((text) => h("th", {}, text)))),
      h(
        "tbody",
        {},
        rows.map((row) =>
          h(
            "tr",
            {},
            row.map((cell) => {
              const td = h("td");
              appendKid(td, cell instanceof Node ? cell : cell === null || cell === undefined ? "" : String(cell));
              return td;
            }),
          ),
        ),
      ),
    ),
  );
}

const toolbarOf = (...kids) => h("div", {class: "toolbar"}, kids);

/* ---------------- 示例数据 ---------------- */

const SAMPLES = {
  json: '{"name":"ops-toolbox","version":"1.0.0","tags":["json","base64","cidr"],"author":{"name":"pzj060726-png","role":"IT 运维"},"stable":true}',
  base64: "你好，运维工具箱 👋",
  url: "https://example.com/search?q=C++ 与 网络&lang=中文",
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  diffBefore: [
    "server {",
    "  listen 80;",
    "  server_name shop.example.com;",
    "  root /var/www/shop;",
    "  index index.html;",
    "}",
  ].join(NL),
  diffAfter: [
    "server {",
    "  listen 443 ssl http2;",
    "  server_name shop.example.com;",
    "  root /var/www/shop/dist;",
    "  index index.html;",
    "  add_header Strict-Transport-Security max-age=31536000 always;",
    "}",
  ].join(NL),
  cidr: "192.168.10.37/24",
  cron: "*/5 9-18 * * 1-5",
  regex: "([a-z]+)@([a-z0-9.]+)",
  regexText: "联系 ops@example.com 或 dev@corp.cn，抄送 boss@example.com",
  time: "1735689600",
  html: '<a href="/console" title="控制台">检查 & 重启</a>',
  unicode: "运维工具箱 OpsToolbox 😀",
  text: ["beta", "alpha", "beta", "", "gamma", "alpha", "  delta  ", "172.16.0.1"].join(NL),
};

/* ---------------- 1. JSON ---------------- */

function renderJson() {
  const state = stateOf("json", {text: SAMPLES.json, mode: "pretty", indent: "2", sortKeys: false});
  const input = h("textarea", {spellcheck: "false", placeholder: "在这里粘贴 JSON…"});
  input.value = state.text;
  const out = h("pre");
  const status = h("div", {class: "status"});

  const run = () => {
    state.text = input.value;
    const text = input.value.trim();
    if (text === "") {
      out.textContent = "";
      setStatus(status, "", "等待输入");
      return;
    }
    const result = formatJson(text, {mode: state.mode, indent: state.indent, sortKeys: state.sortKeys});
    if (result.ok) {
      out.textContent = result.output;
      setStatus(
        status,
        "ok",
        pill(state.mode === "minify" ? "已压缩" : "已美化", "ok"),
        pill(result.stats.bytes + " 字节"),
        pill(result.stats.lines + " 行"),
        pill(result.stats.keys + " 个键"),
        pill("层级 " + result.stats.depth),
      );
    } else {
      out.textContent = "";
      const where = result.error.line ? "第 " + result.error.line + " 行第 " + result.error.column + " 列" : "解析失败";
      setStatus(status, "bad", pill("✗ " + where, "bad"), h("span", {}, result.error.message));
    }
  };

  const node = card(
    toolbarOf(
      labelled("模式", select([{value: "pretty", label: "美化"}, {value: "minify", label: "压缩"}], state.mode, (value) => {
        state.mode = value;
        run();
      })),
      labelled("缩进", select([{value: "2", label: "2 空格"}, {value: "4", label: "4 空格"}], state.indent, (value) => {
        state.indent = value;
        run();
      })),
      checkbox("键名 A→Z 排序", state.sortKeys, (checked) => {
        state.sortKeys = checked;
        run();
      }),
      h("span", {class: "spacer"}),
      h("button", {class: "btn", type: "button", onclick: () => { input.value = SAMPLES.json; run(); }}, "示例"),
      h("button", {class: "btn", type: "button", onclick: () => { input.value = ""; run(); input.focus(); }}, "清空"),
    ),
    h("div", {class: "panes"}, pane("输入", input, pill("JSON")), outPane("输出", out)),
    status,
  );
  input.addEventListener("input", debounce(run, 140));
  run();
  return node;
}

/* ---------------- 2. Base64 ---------------- */

function renderBase64() {
  const state = stateOf("base64", {text: SAMPLES.base64, mode: "encode", urlSafe: false});
  const input = h("textarea", {spellcheck: "false", placeholder: "在这里粘贴文本或 Base64…"});
  input.value = state.text;
  const out = h("pre");
  const status = h("div", {class: "status"});

  const run = () => {
    state.text = input.value;
    if (input.value.trim() === "") {
      out.textContent = "";
      setStatus(status, "", "等待输入");
      return;
    }
    if (state.mode === "encode") {
      const output = encodeBase64(input.value, {urlSafe: state.urlSafe});
      out.textContent = output;
      setStatus(
        status,
        "ok",
        pill("编码完成", "ok"),
        pill(output.length + " 个字符"),
        pill(new TextEncoder().encode(input.value).length + " 字节"),
        pill(state.urlSafe ? "URL 安全字符集" : "标准字符集"),
      );
      return;
    }
    const result = decodeBase64(input.value, {urlSafe: "auto"});
    if (!result.ok) {
      out.textContent = "";
      setStatus(status, "bad", pill("✗ 解码失败", "bad"), h("span", {}, result.error));
      return;
    }
    out.textContent = result.text;
    setStatus(
      status,
      "ok",
      pill("解码完成", "ok"),
      pill(result.bytes + " 字节"),
      result.lossy ? pill("含二进制数据，可能有损", "warn") : pill("UTF-8 无损"),
      result.urlSafe ? pill("URL 安全字符集") : pill("标准字符集"),
    );
  };

  const modeSelect = select(
    [
      {value: "encode", label: "文本 → Base64"},
      {value: "decode", label: "Base64 → 文本"},
    ],
    state.mode,
    (value) => {
      state.mode = value;
      run();
    },
  );

  const node = card(
    toolbarOf(
      labelled("方向", modeSelect),
      checkbox("URL 安全（- _ 无填充）", state.urlSafe, (checked) => {
        state.urlSafe = checked;
        run();
      }),
      h("span", {class: "spacer"}),
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            const text = out.textContent || "";
            if (!text) return;
            input.value = text;
            state.mode = state.mode === "encode" ? "decode" : "encode";
            modeSelect.value = state.mode;
            run();
          },
        },
        "⇅ 交换",
      ),
    ),
    h("div", {class: "panes"}, pane("输入", input, pill(state.urlSafe ? "URL 安全" : "标准")), outPane("输出", out)),
    status,
  );
  input.addEventListener("input", debounce(run, 140));
  run();
  return node;
}

/* ---------------- 3. URL ---------------- */

function renderUrl() {
  const state = stateOf("url", {text: SAMPLES.url, mode: "component", direction: "encode", plusAsSpace: true});
  const input = h("textarea", {spellcheck: "false", placeholder: "粘贴 URL 或参数值…", style: "min-height:160px"});
  input.value = state.text;
  const out = h("pre");
  const status = h("div", {class: "status"});

  const run = () => {
    state.text = input.value;
    if (input.value === "") {
      out.textContent = "";
      setStatus(status, "", "等待输入");
      return;
    }
    if (state.direction === "encode") {
      const output = urlEncode(input.value, {mode: state.mode});
      out.textContent = output;
      setStatus(
        status,
        "ok",
        pill("编码完成", "ok"),
        pill(state.mode === "whole" ? "按整条 URL 处理（保留 : / ? & =）" : "按参数值处理（全部转义）"),
        pill(output.length + " 个字符"),
      );
      return;
    }
    const result = urlDecode(input.value, {plusAsSpace: state.plusAsSpace});
    if (!result.ok) {
      out.textContent = "";
      setStatus(status, "bad", pill("✗ 解码失败", "bad"), h("span", {}, result.error));
      return;
    }
    out.textContent = result.output;
    setStatus(
      status,
      "ok",
      pill("解码完成", "ok"),
      result.recovered ? pill("含非法转义，已按字节尽量恢复", "warn") : pill("没有发现异常转义"),
      pill(state.plusAsSpace ? "+ 视为空格" : "+ 保持原样"),
    );
  };

  const node = card(
    toolbarOf(
      labelled(
        "方向",
        select(
          [
            {value: "encode", label: "编码"},
            {value: "decode", label: "解码"},
          ],
          state.direction,
          (value) => {
            state.direction = value;
            run();
          },
        ),
      ),
      labelled(
        "范围",
        select(
          [
            {value: "component", label: "单个参数值"},
            {value: "whole", label: "整条 URL"},
          ],
          state.mode,
          (value) => {
            state.mode = value;
            run();
          },
        ),
      ),
      checkbox("解码时 + 视为空格", state.plusAsSpace, (checked) => {
        state.plusAsSpace = checked;
        run();
      }),
    ),
    h("div", {class: "panes"}, pane("输入", input), outPane("输出", out)),
    status,
  );
  input.addEventListener("input", debounce(run, 140));
  run();
  return node;
}

/* ---------------- 4. JWT ---------------- */

function renderJwt() {
  const state = stateOf("jwt", {text: SAMPLES.jwt});
  const input = h("textarea", {spellcheck: "false", placeholder: "粘贴 JWT，允许带 Bearer 前缀…", style: "min-height:130px"});
  input.value = state.text;
  const summary = h("div", {class: "chips"});
  const headerOut = h("pre");
  const payloadOut = h("pre");
  const claimsBox = h("div");
  const warnings = h("div", {class: "chips"});

  const run = () => {
    state.text = input.value;
    if (input.value.trim() === "") {
      headerOut.textContent = "";
      payloadOut.textContent = "";
      replaceKids(claimsBox, );
      replaceKids(warnings, );
      replaceKids(summary, pill("等待输入"));
      return;
    }
    const result = decodeJwt(input.value);
    if (!result.ok) {
      headerOut.textContent = "";
      payloadOut.textContent = "";
      replaceKids(claimsBox, );
      replaceKids(warnings, );
      replaceKids(summary, pill("✗ " + result.error, "bad"));
      return;
    }
    headerOut.textContent = JSON.stringify(result.header, null, 2);
    payloadOut.textContent = JSON.stringify(result.payload, null, 2);
    replaceKids(summary, 
      pill(result.parts + " 段", "accent"),
      pill("alg " + (result.header.alg || "缺失")),
      result.lifetime.map((item) => pill(item.claim + "：" + item.label, item.status === "valid" ? "ok" : "warn")),
    );
    const rows = [];
    for (const key of Object.keys(result.claims)) {
      const value = result.claims[key];
      if (value === null) continue;
      const timeLike = key === "iat" || key === "exp" || key === "nbf";
      rows.push([key, timeLike ? String(value) + "（" + new Date(value * 1000).toLocaleString("zh-CN") + "）" : String(value)]);
    }
    replaceKids(claimsBox, 
      rows.length > 0
        ? table(["标准声明", "值"], rows)
        : h("div", {class: "status"}, "没有 iss / sub / aud / exp 等标准声明"),
    );
    replaceKids(warnings, result.warnings.map((text) => pill("⚠ " + text, "warn")));
  };

  const node = card(
    pane("JWT", input, pill("Header.Payload.Signature")),
    h("div", {style: "margin-top:14px"}, summary),
    h("div", {class: "panes", style: "margin-top:14px"}, pane("Header", headerOut), pane("Payload", payloadOut)),
    h("div", {style: "margin-top:14px"}, claimsBox),
    h("div", {style: "margin-top:12px"}, warnings),
  );
  input.addEventListener("input", debounce(run, 160));
  run();
  return node;
}

/* ---------------- 5. Diff ---------------- */

function renderDiff() {
  const state = stateOf("diff", {before: SAMPLES.diffBefore, after: SAMPLES.diffAfter});
  const before = h("textarea", {spellcheck: "false", placeholder: "原始内容", style: "min-height:190px"});
  const after = h("textarea", {spellcheck: "false", placeholder: "修改后内容", style: "min-height:190px"});
  before.value = state.before;
  after.value = state.after;
  const panel = h("div", {class: "diff"});
  const status = h("div", {class: "status"});

  const run = () => {
    state.before = before.value;
    state.after = after.value;
    const result = diffLines(before.value, after.value);
    if (!result.ok) {
      replaceKids(panel, h("div", {class: "alert"}, result.error));
      setStatus(status, "bad", pill("✗ 无法比较", "bad"));
      return;
    }
    if (result.identical) {
      replaceKids(panel, h("div", {style: "padding:16px;color:var(--text-soft)"}, "两段文本完全一致，没有差异。"));
    } else {
      const limit = 600;
      const ops = result.ops.slice(0, limit);
      replaceKids(panel, 
        ops.map((op) => {
          const sign = op.type === "add" ? "+" : op.type === "del" ? "−" : "";
          const rowClass = op.type === "add" ? "diff-line add" : op.type === "del" ? "diff-line del" : "diff-line";
          return h(
            "div",
            {class: rowClass},
            h("span", {class: "num"}, op.oldLine === null ? "" : String(op.oldLine)),
            h("span", {class: "num"}, op.newLine === null ? "" : String(op.newLine)),
            h("span", {class: "sign"}, sign),
            h("span", {class: "text"}, op.text === "" ? " " : op.text),
          );
        }),
      );
      if (result.ops.length > limit) {
        panel.append(h("div", {style: "padding:10px 14px;color:var(--text-dim)"}, "只展示前 " + limit + " 行差异，共 " + result.ops.length + " 行。"));
      }
    }
    setStatus(
      status,
      "",
      result.identical ? pill("完全一致", "ok") : pill("+" + result.stats.added, "ok"),
      result.identical ? null : pill("−" + result.stats.removed, "bad"),
      pill(result.stats.unchanged + " 行未变"),
      result.identical ? null : pill("共 " + result.ops.length + " 行"),
    );
  };

  const node = card(
    h("div", {class: "panes"}, pane("修改前", before), pane("修改后", after)),
    h("div", {style: "margin-top:16px"}, status),
    h("div", {style: "margin-top:10px"}, panel),
  );
  before.addEventListener("input", debounce(run, 200));
  after.addEventListener("input", debounce(run, 200));
  run();
  return node;
}

/* ---------------- 6. CIDR ---------------- */

function renderCidr() {
  const state = stateOf("cidr", {text: SAMPLES.cidr, split: "26"});
  const input = h("input", {type: "text", placeholder: "192.168.1.0/24", spellcheck: "false"});
  input.value = state.text;
  const body = h("div");
  const splitInput = h("input", {type: "text", placeholder: "26", spellcheck: "false", style: "max-width:110px"});
  splitInput.value = state.split;
  const splitBox = h("div");

  const runSplit = () => {
    const prefix = Number(splitInput.value.trim());
    if (!Number.isInteger(prefix)) {
      replaceKids(splitBox, h("div", {class: "alert warn"}, "请输入 0 到 32 之间的整数前缀"));
      return;
    }
    const result = splitSubnets(input.value, prefix, {maxRows: 256});
    if (!result.ok) {
      replaceKids(splitBox, h("div", {class: "alert warn"}, result.error));
      return;
    }
    replaceKids(splitBox, 
      h("div", {class: "status"}, pill("共 " + result.count + " 个子网", "accent"), pill("来自 " + result.base)),
      h("div", {style: "margin-top:10px"}, table(
        ["#", "子网", "可用范围", "主机数"],
        result.rows.map((row) => [row.index, row.cidr, row.firstHost + " - " + row.lastHost, row.hostCount]),
      )),
    );
  };

  const run = () => {
    state.text = input.value;
    const result = analyzeCidr(input.value);
    if (!result.ok) {
      replaceKids(body, h("div", {class: "alert"}, result.error));
      replaceKids(splitBox, );
      return;
    }
    replaceKids(body, 
      kvList([
        ["网段（CIDR）", result.cidr],
        ["网络地址", result.network],
        ["广播地址", result.broadcast],
        ["子网掩码", result.mask],
        ["反掩码", result.wildcard],
        ["可用主机", result.hostCount + " 个"],
        ["可用范围", result.firstHost === result.lastHost ? result.firstHost : result.firstHost + " - " + result.lastHost],
        ["地址总数", result.totalAddresses + " 个"],
        ["掩码长度", "/" + result.prefix],
        ["IP 归属", result.ipInNetwork ? "在网段内" : "不在网段内", {pill: true, tone: result.ipInNetwork ? "ok" : "warn"}],
        ["特殊网段", result.special || "无", {pill: Boolean(result.special), tone: "accent"}],
      ]),
    );
    runSplit();
  };

  const node = card(
    toolbarOf(input, h("span", {class: "spacer"}), pill("IPv4")),
    h("div", {style: "margin-top:14px"}, body),
    h("div", {class: "card-title", style: "margin-top:20px"}, "继续划分"),
    toolbarOf(labelled("目标前缀 /", splitInput), h("span", {class: "spacer"}), pill("最多展示 256 个子网")),
    splitBox,
  );
  input.addEventListener("input", debounce(run, 140));
  splitInput.addEventListener("input", debounce(() => {
    state.split = splitInput.value;
    runSplit();
  }, 200));
  run();
  return node;
}

/* ---------------- 7. Cron ---------------- */

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function weekdayLabel(value) {
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) return String(value);
  return WEEKDAY_NAMES[num % 7] || String(value);
}

function renderCron() {
  const state = stateOf("cron", {text: SAMPLES.cron});
  const input = h("input", {type: "text", placeholder: "*/5 9-18 * * 1-5", spellcheck: "false"});
  input.value = state.text;
  const summary = h("div", {class: "chips"});
  const runsBox = h("div");
  const fieldsBox = h("div");

  const run = () => {
    state.text = input.value;
    const description = describeCron(input.value);
    if (!description.ok) {
      replaceKids(summary, );
      replaceKids(runsBox, h("div", {class: "alert"}, description.error));
      replaceKids(fieldsBox, );
      return;
    }
    const next = nextRuns(input.value, {count: 6});
    replaceKids(summary, 
      description.description ? pill(description.description, "accent") : pill("属于常见写法之外，按字段原样执行"),
      pill("时区：" + Intl.DateTimeFormat().resolvedOptions().timeZone),
    );
    if (!next.ok) {
      replaceKids(runsBox, h("div", {class: "alert"}, next.error));
      replaceKids(fieldsBox, );
      return;
    }
    replaceKids(runsBox, 
      table(
        ["#", "下次触发", "相对现在"],
        next.runs.map((ms, index) => [index + 1, new Date(ms).toLocaleString("zh-CN", {hour12: false}), humanizeDelta(ms - Date.now())]),
      ),
      next.exhausted ? h("div", {class: "status"}, pill("表达式过于稀疏，3 年内只找到 " + next.runs.length + " 次", "warn")) : null,
    );
    const fields = explainFields(input.value);
    if (fields.ok) {
      replaceKids(fieldsBox, 
        kvList(
          fields.rows.map((row) => [
            row.label,
            row.values.map((value) => (row.label.includes("星期") ? weekdayLabel(value) : String(value))).join("、"),
          ]),
        ),
      );
    }
  };

  const node = card(
    toolbarOf(input, h("span", {class: "spacer"}), pill("分 时 日 月 周")),
    h("div", {style: "margin-top:12px"}, summary),
    h("div", {style: "margin-top:14px"}, runsBox),
    h("div", {class: "card-title", style: "margin-top:20px"}, "字段展开"),
    fieldsBox,
  );
  input.addEventListener("input", debounce(run, 180));
  run();
  return node;
}

/* ---------------- 8. Regex ---------------- */

function renderRegex() {
  const state = stateOf("regex", {
    pattern: SAMPLES.regex,
    flags: "gi",
    text: SAMPLES.regexText,
    replacement: "[已隐藏]",
  });
  const pattern = h("input", {type: "text", placeholder: "正则表达式", spellcheck: "false"});
  const flags = h("input", {type: "text", placeholder: "gi", spellcheck: "false", style: "max-width:90px"});
  const text = h("textarea", {spellcheck: "false", placeholder: "测试文本", style: "min-height:150px"});
  const replacement = h("input", {type: "text", placeholder: "替换为…", spellcheck: "false"});
  pattern.value = state.pattern;
  flags.value = state.flags;
  text.value = state.text;
  replacement.value = state.replacement;

  const marked = h("div", {class: "output", style: "min-height:56px"});
  const status = h("div", {class: "status"});
  const matchesBox = h("div");
  const replacedOut = h("pre", {style: "min-height:56px"});

  const run = () => {
    state.pattern = pattern.value;
    state.flags = flags.value;
    state.text = text.value;
    state.replacement = replacement.value;

    const result = testRegex(pattern.value, flags.value, text.value, {maxMatches: 500});
    if (!result.ok) {
      replaceKids(marked, );
      replaceKids(matchesBox, );
      replacedOut.textContent = "";
      setStatus(status, "bad", pill("✗", "bad"), h("span", {}, result.error));
      return;
    }
    replaceKids(marked, );
    let cursor = 0;
    for (const match of result.matches) {
      if (match.index > cursor) marked.append(document.createTextNode(text.value.slice(cursor, match.index)));
      marked.append(
        h(
          "mark",
          {style: "background:var(--accent-soft);color:var(--accent-ink);border-radius:3px;padding:0 1px"},
          match.value === "" ? "(空匹配)" : match.value,
        ),
      );
      cursor = match.end;
    }
    if (cursor < text.value.length) marked.append(document.createTextNode(text.value.slice(cursor)));
    if (result.matches.length === 0) marked.append(h("span", {style: "color:var(--text-dim)"}, "没有匹配"));

    replaceKids(matchesBox, 
      result.matches.length === 0
        ? h("div", {class: "status"}, "0 个匹配")
        : table(
            ["#", "匹配", "位置", "捕获组"],
            result.matches.map((match, index) => [
              index + 1,
              match.value,
              match.index + " - " + match.end,
              match.named ? JSON.stringify(match.named) : match.groups.length > 0 ? match.groups.join(" | ") : "—",
            ]),
          ),
    );
    const replaced = replaceRegex(pattern.value, flags.value, text.value, replacement.value);
    replacedOut.textContent = replaced.ok ? replaced.output : "";
    setStatus(
      status,
      "ok",
      pill(result.matches.length + " 个匹配", result.matches.length > 0 ? "ok" : ""),
      pill("标志 /" + result.flags),
      result.truncated ? pill("结果已截断（超过 500 个）", "warn") : null,
      replaced.ok ? null : pill("替换失败：" + replaced.error, "bad"),
    );
  };

  const node = card(
    toolbarOf(labelled("/", pattern), labelled("/", flags), h("span", {class: "spacer"}), pill("自动补全 g 标志")),
    h("div", {style: "margin-top:14px"}, status),
    h("div", {style: "margin-top:10px"}, marked),
    h("div", {class: "panes", style: "margin-top:16px"}, pane("测试文本", text), pane("匹配结果", matchesBox)),
    h("div", {class: "card-title", style: "margin-top:20px"}, "替换预览"),
    toolbarOf(replacement, h("span", {class: "spacer"}), pill("使用 $1 $2 或 $<name> 引用捕获组")),
    h("div", {style: "margin-top:10px"}, replacedOut),
  );
  pattern.addEventListener("input", debounce(run, 160));
  flags.addEventListener("input", debounce(run, 160));
  text.addEventListener("input", debounce(run, 200));
  replacement.addEventListener("input", debounce(run, 200));
  run();
  return node;
}

/* ---------------- 9. 时间戳 ---------------- */

const ZONE_LABELS = {
  "Asia/Shanghai": "Asia/Shanghai · 北京时间",
  UTC: "UTC · 协调世界时",
  "Asia/Hong_Kong": "Asia/Hong_Kong · 香港",
  "Asia/Tokyo": "Asia/Tokyo · 东京",
  "Asia/Singapore": "Asia/Singapore · 新加坡",
  "Europe/London": "Europe/London · 伦敦",
  "Europe/Berlin": "Europe/Berlin · 柏林",
  "America/New_York": "America/New_York · 纽约",
  "America/Los_Angeles": "America/Los_Angeles · 洛杉矶",
};

function renderTime() {
  const state = stateOf("time", {text: SAMPLES.time, zone: "Asia/Shanghai"});
  const input = h("input", {type: "text", placeholder: "1735689600 或 2025-01-01 08:00:00", spellcheck: "false"});
  input.value = state.text;
  const body = h("div");
  const status = h("div", {class: "status"});

  const run = () => {
    state.text = input.value;
    const parsed = parseTimeInput(input.value);
    if (!parsed.ok) {
      replaceKids(body, h("div", {class: "alert"}, parsed.error));
      setStatus(status, "", "等待输入");
      return;
    }
    const report = timeReport(parsed.ms, {timeZone: state.zone});
    replaceKids(body, 
      kvList([
        ["本地时间", report.local],
        ["时区", report.timeZone + "（" + report.offset + "）"],
        ["UTC", report.utc],
        ["ISO 8601", report.iso],
        ["RFC 2822", report.rfc],
        ["星期", report.weekday],
        ["ISO 周", report.isoWeek],
        ["年内第几天", String(report.dayOfYear) + " 天"],
        ["秒级时间戳", String(report.seconds)],
        ["毫秒级时间戳", String(report.milliseconds)],
        ["相对现在", report.relative],
        ["过去 / 未来", report.isFuture ? "未来时间" : "过去时间", {pill: true, tone: report.isFuture ? "warn" : "ok"}],
      ]),
    );
    setStatus(status, "ok", pill("识别为 " + (parsed.kind === "seconds" ? "秒级时间戳" : parsed.kind === "milliseconds" ? "毫秒级时间戳" : parsed.kind === "iso" ? "ISO 字符串" : "日期字符串"), "ok"));
  };

  const node = card(
    toolbarOf(
      input,
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            input.value = String(Math.floor(Date.now() / 1000));
            run();
          },
        },
        "用现在的时间",
      ),
      h("span", {class: "spacer"}),
      labelled(
        "时区",
        select(
          COMMON_TIME_ZONES.map((zone) => ({value: zone, label: ZONE_LABELS[zone] || zone})),
          state.zone,
          (value) => {
            state.zone = value;
            run();
          },
        ),
      ),
    ),
    status,
    h("div", {style: "margin-top:14px"}, body),
  );
  input.addEventListener("input", debounce(run, 160));
  run();
  return node;
}

/* ---------------- 通用：单输入单输出 ---------------- */

function simpleTool(config) {
  const state = stateOf(config.id, {text: config.sample, mode: config.modes[0].value});
  const input = h("textarea", {spellcheck: "false", placeholder: config.placeholder || "在这里粘贴文本…"});
  input.value = state.text;
  const out = h("pre");
  const status = h("div", {class: "status"});

  const run = () => {
    state.text = input.value;
    if (input.value === "") {
      out.textContent = "";
      setStatus(status, "", "等待输入");
      return;
    }
    let result;
    try {
      result = config.transform(input.value, state.mode);
    } catch (error) {
      out.textContent = "";
      setStatus(status, "bad", pill("✗", "bad"), h("span", {}, String(error && error.message ? error.message : error)));
      return;
    }
    if (!result.ok) {
      out.textContent = "";
      setStatus(status, "bad", pill("✗", "bad"), h("span", {}, result.error));
      return;
    }
    out.textContent = result.output;
    setStatus(status, "ok", result.pills || []);
  };

  const modeSelect = config.modes.length > 1
    ? select(config.modes, state.mode, (value) => {
        state.mode = value;
        run();
      })
    : null;

  const node = card(
    toolbarOf(
      modeSelect ? labelled("模式", modeSelect) : null,
      config.extra || null,
      h("span", {class: "spacer"}),
      h("button", {class: "btn", type: "button", onclick: () => { input.value = config.sample; run(); }}, "示例"),
      h("button", {class: "btn", type: "button", onclick: () => { input.value = ""; run(); input.focus(); }}, "清空"),
    ),
    h("div", {class: "panes"}, pane("输入", input), outPane("输出", out)),
    status,
  );
  input.addEventListener("input", debounce(run, 160));
  run();
  return node;
}

/* ---------------- 10. HTML 实体 ---------------- */

function renderHtml() {
  return simpleTool({
    id: "html",
    sample: SAMPLES.html,
    modes: [
      {value: "escape", label: "转义（& < > 变实体）"},
      {value: "unescape", label: "反转义（实体变字符）"},
    ],
    transform: (text, mode) => {
      const output = mode === "escape" ? htmlEscape(text) : htmlUnescape(text);
      return {
        ok: true,
        output,
        pills: [
          pill(mode === "escape" ? "已转义" : "已反转义", "ok"),
          pill(text.length + " 字符"),
          pill(output.length + " 字符"),
        ],
      };
    },
  });
}

/* ---------------- 11. Unicode / 十六进制 ---------------- */

function renderUnicode() {
  return simpleTool({
    id: "unicode",
    sample: SAMPLES.unicode,
    modes: [
      {value: "escape", label: "Unicode 转义"},
      {value: "unescape", label: "Unicode 还原"},
      {value: "hex", label: "转十六进制字节"},
      {value: "unhex", label: "十六进制还原"},
    ],
    transform: (text, mode) => {
      if (mode === "escape") {
        return {ok: true, output: unicodeEscape(text), pills: [pill("已转义", "ok"), pill(text.length + " 个字符")]};
      }
      if (mode === "unescape") {
        return {ok: true, output: unicodeUnescape(text), pills: [pill("已还原", "ok")]};
      }
      if (mode === "hex") {
        const output = hexEncode(text, {separator: " ", upper: true});
        return {ok: true, output, pills: [pill("UTF-8 字节", "ok"), pill(new TextEncoder().encode(text).length + " 字节")]};
      }
      const result = hexDecode(text);
      if (!result.ok) return {ok: false, error: result.error};
      return {
        ok: true,
        output: result.text,
        pills: [pill("已还原", "ok"), pill(result.bytes + " 字节"), result.lossy ? pill("含非法 UTF-8，可能有损", "warn") : null],
      };
    },
  });
}

/* ---------------- 12. 乱码修复 ---------------- */

function toLatin1Mojibake(text) {
  const bytes = new TextEncoder().encode(text);
  return String.fromCharCode(...bytes);
}

function renderCharset() {
  const state = stateOf("charset", {text: toLatin1Mojibake("网络连通性检查：全部正常"), zone: "utf-8"});
  const input = h("textarea", {spellcheck: "false", placeholder: "粘贴乱码文本…"});
  input.value = state.text;
  const out = h("pre");
  const status = h("div", {class: "status"});

  const run = () => {
    state.text = input.value;
    if (input.value === "") {
      out.textContent = "";
      setStatus(status, "", "等待输入");
      return;
    }
    const result = decodeWithCharset(input.value, state.zone);
    if (!result.ok) {
      out.textContent = "";
      setStatus(status, "bad", pill("✗", "bad"), h("span", {}, result.error));
      return;
    }
    out.textContent = result.text;
    setStatus(
      status,
      "ok",
      pill("按 " + result.charset.toUpperCase() + " 重新解码", "ok"),
      pill(result.bytes + " 字节"),
      pill(result.text === input.value ? "结果与原文本相同，换个编码试试" : "文本已变化"),
    );
  };

  const node = card(
    toolbarOf(
      labelled(
        "目标编码",
        select(
          [{value: "utf-8", label: "UTF-8（最常见：ä½ å¥½ 这类）"}].concat(CHARSETS.map((item) => ({value: item.id, label: item.label}))),
          state.zone,
          (value) => {
            state.zone = value;
            run();
          },
        ),
      ),
      h("span", {class: "spacer"}),
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            input.value = toLatin1Mojibake("网络连通性检查：全部正常");
            run();
          },
        },
        "示例",
      ),
    ),
    h("div", {class: "panes"}, pane("乱码文本", input), outPane("修复结果", out)),
    status,
    h(
      "p",
      {style: "margin:12px 0 0;font-size:12.5px;color:var(--text-dim);line-height:1.7"},
      "适用场景：UTF-8 或 GBK 字节被当成单字节编码（Latin-1 / Windows-1252）显示时出现的乱码，例如 ",
      h("code", {}, "ä½ å¥½"),
      " 或 ",
      h("code", {}, "ÍøÂç"),
      "。原理是把每个字符的低 8 位还原成字节，再用目标编码重新解码。",
    ),
  );
  input.addEventListener("input", debounce(run, 160));
  run();
  return node;
}

/* ---------------- 13. 文本处理 ---------------- */

function renderText() {
  const state = stateOf("text", {text: SAMPLES.text});
  const input = h("textarea", {spellcheck: "false", placeholder: "粘贴多行文本…"});
  input.value = state.text;
  const out = h("pre");
  const stats = h("div", {class: "chips"});
  const note = h("div", {class: "status"});

  const updateStats = () => {
    const info = textStats(input.value);
    replaceKids(stats, 
      pill(info.chars + " 字符", "accent"),
      pill(info.charsNoSpace + " 字符（不含空格）"),
      pill(info.bytes + " 字节"),
      pill(info.lines + " 行"),
      pill(info.nonEmptyLines + " 非空行"),
      pill(info.cjkChars + " 个汉字"),
      pill(info.words + " 个词"),
    );
  };

  const apply = (label, fn) => {
    const result = fn(input.value);
    const text = typeof result === "string" ? result : result.text;
    out.textContent = text;
    note.className = "status ok";
    const extra = typeof result === "object" && typeof result.removed === "number" ? "，移除 " + result.removed + " 行" : "";
    replaceKids(note, pill(label + "完成" + extra, "ok"));
  };

  const actions = [
    ["排序 A→Z", (text) => sortLines(text)],
    ["数字排序", (text) => sortLines(text, {numeric: true})],
    ["反转行序", (text) => reverseLines(text)],
    ["去重", (text) => dedupeLines(text)],
    ["去空行", (text) => removeEmptyLines(text)],
    ["去首尾空格", (text) => trimLines(text)],
  ];

  const run = () => {
    state.text = input.value;
    updateStats();
    out.textContent = input.value;
    note.className = "status";
    replaceKids(note, pill("当前为原始文本"));
  };

  const node = card(
    stats,
    h("div", {class: "panes", style: "margin-top:14px"}, pane("输入", input), outPane("输出", out)),
    toolbarOf(
      actions.map(([label, fn]) => h("button", {class: "btn tiny", type: "button", onclick: () => apply(label, fn)}, label)),
    ),
    note,
  );
  input.addEventListener("input", debounce(run, 160));
  run();
  return node;
}

/* ---------------- 14. 随机密码 ---------------- */

function renderPassword() {
  const state = stateOf("password", {
    length: "16",
    lower: true,
    upper: true,
    digits: true,
    symbols: false,
    excludeAmbiguous: true,
  });
  const out = h("pre", {style: "font-size:16px;letter-spacing:0.5px"});
  const status = h("div", {class: "status"});

  const run = () => {
    const result = generatePassword({
      length: Number(state.length),
      lower: state.lower,
      upper: state.upper,
      digits: state.digits,
      symbols: state.symbols,
      excludeAmbiguous: state.excludeAmbiguous,
    });
    if (!result.ok) {
      out.textContent = "";
      setStatus(status, "bad", pill("✗", "bad"), h("span", {}, result.error));
      return;
    }
    out.textContent = result.password;
    setStatus(
      status,
      "ok",
      pill("强度：" + result.strength, "ok"),
      pill("熵 " + result.entropyBits + " bit"),
      pill("字符集 " + result.alphabetSize + " 个"),
    );
  };

  const options = [
    ["lower", "小写字母 a-z"],
    ["upper", "大写字母 A-Z"],
    ["digits", "数字 0-9"],
    ["symbols", "符号 !@#$"],
    ["excludeAmbiguous", "排除易混字符 0O1lI"],
  ];

  const node = card(
    toolbarOf(
      labelled(
        "长度",
        select(
          ["12", "16", "24", "32", "48"].map((value) => ({value, label: value + " 位"})),
          state.length,
          (value) => {
            state.length = value;
            run();
          },
        ),
      ),
      h("span", {class: "spacer"}),
      h("button", {class: "btn primary", type: "button", onclick: run}, "重新生成"),
      h("button", {class: "btn", type: "button", onclick: () => copyText(out.textContent || "")}, "复制"),
    ),
    h("div", {style: "margin-top:14px"}, out),
    status,
    toolbarOf(
      options.map(([key, label]) =>
        checkbox(label, state[key], (checked) => {
          state[key] = checked;
          run();
        }),
      ),
    ),
  );
  run();
  return node;
}

/* ---------------- 工具注册表 ---------------- */

const TOOLS = [
  {id: "json", name: "JSON 格式化", group: "数据", badge: "{ }", desc: "美化、压缩、键名排序，出错直接定位到行列。", keywords: "json 格式化 美化 压缩 校验 format minify", render: renderJson},
  {id: "base64", name: "Base64 编解码", group: "数据", badge: "b64", desc: "文本与 Base64 互转，支持 URL 安全字符集。", keywords: "base64 编码 解码 url safe", render: renderBase64},
  {id: "url", name: "URL 编解码", group: "数据", badge: "%20", desc: "整条 URL 或单个参数值的百分号编码，一键互转。", keywords: "url 编码 解码 百分号 转义 encode", render: renderUrl},
  {id: "jwt", name: "JWT 解析", group: "数据", badge: "jwt", desc: "拆开 Header 与 Payload，并检查过期、nbf、iat 等时间声明。", keywords: "jwt token 解析 解码 过期 claims", render: renderJwt},
  {id: "diff", name: "文本 Diff", group: "数据", badge: "±", desc: "按行比较两段文本，新增与删除一目了然。", keywords: "diff 对比 差异 比较 文本", render: renderDiff},
  {id: "cidr", name: "子网计算", group: "网络", badge: "/24", desc: "输入 IPv4 网段，算出可用地址、掩码与广播地址，还能继续划分。", keywords: "cidr 子网 掩码 ip 网段 计算 subnet", render: renderCidr},
  {id: "cron", name: "Cron 表达式", group: "网络", badge: "* *", desc: "解释表达式含义，并推算出接下来几次触发时间。", keywords: "cron 定时 表达式 下次 触发", render: renderCron},
  {id: "regex", name: "正则测试", group: "网络", badge: ".*", desc: "高亮匹配位置、捕获组与命名组，顺带预览替换结果。", keywords: "正则 regex 替换 捕获组 测试", render: renderRegex},
  {id: "time", name: "时间戳转换", group: "时间", badge: "ts", desc: "秒级、毫秒级时间戳与日期字符串、多个时区互转。", keywords: "时间戳 timestamp unix 时区 日期 转换", render: renderTime},
  {id: "html", name: "HTML 实体", group: "编码", badge: "< >", desc: "转义与反转义 HTML 实体，避免它们被当成标签解析。", keywords: "html 实体 转义 escape unescape", render: renderHtml},
  {id: "unicode", name: "Unicode / 十六进制", group: "编码", badge: "U+", desc: "把中文与 Emoji 转成 Unicode 转义序列或十六进制字节。", keywords: "unicode 转义 十六进制 hex 字节", render: renderUnicode},
  {id: "charset", name: "乱码修复", group: "编码", badge: "gbk", desc: "把被当成单字节编码显示的文本，按 UTF-8 或 GBK 重新解码。", keywords: "乱码 修复 gbk utf8 charset 编码", render: renderCharset},
  {id: "text", name: "文本处理", group: "文本", badge: "¶", desc: "统计字符、行数、汉字与词数，还能排序、去重、去空行。", keywords: "文本 统计 排序 去重 行数 字数", render: renderText},
  {id: "password", name: "随机密码", group: "文本", badge: "•••", desc: "用 crypto.getRandomValues 现场生成，不经过任何网络请求。", keywords: "密码 随机 password 生成 强度", render: renderPassword},
];

/* ---------------- 外壳：导航、主题、路由、命令面板 ---------------- */

const THEME_BUTTON_TEXT = {light: "深色", dark: "浅色"};

function resolvedTheme() {
  const forced = new URLSearchParams(window.location.search).get("theme");
  if (forced === "light" || forced === "dark") return forced;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute("data-theme", theme);
  const button = document.getElementById("themeToggle");
  if (button) {
    replaceKids(button, svg(theme === "dark" ? ICONS.moon : ICONS.sun, 14), h("span", {}, THEME_BUTTON_TEXT[theme]));
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0d1418" : "#f2f5f7");
}

function toggleTheme() {
  localStorage.setItem(THEME_KEY, resolvedTheme() === "dark" ? "light" : "dark");
  applyTheme();
}

function buildNav() {
  const nav = document.getElementById("toolNav");
  const groups = [];
  for (const tool of TOOLS) {
    let group = groups.find((item) => item.name === tool.group);
    if (!group) {
      group = {name: tool.group, items: []};
      groups.push(group);
    }
    group.items.push(tool);
  }
  replaceKids(nav, 
    groups.map((group) =>
      h(
        "div",
        {class: "nav-group"},
        h("div", {class: "nav-group-label"}, group.name),
        group.items.map((tool) =>
          h(
            "a",
            {class: "nav-item", href: "#/" + tool.id, "data-id": tool.id},
            h("span", {class: "nav-badge"}, tool.badge),
            h("span", {}, tool.name),
          ),
        ),
      ),
    ),
  );
}

function currentToolId() {
  let raw = String(window.location.hash || "").replace("#", "");
  if (raw.slice(0, 1) === "/") raw = raw.slice(1);
  raw = raw.split("?")[0].split("/")[0];
  const known = TOOLS.some((tool) => tool.id === raw);
  return known ? raw : TOOLS[0].id;
}

function resolveRepoUrl() {
  const matched = /^([\w-]+)\.github\.io$/i.exec(window.location.hostname);
  if (matched) {
    const segment = window.location.pathname.split("/").filter(Boolean)[0];
    return "https://github.com/" + matched[1] + "/" + (segment || "ops-toolbox");
  }
  return REPO_URL;
}

function footerNote() {
  return h(
    "div",
    {class: "foot-note"},
    h("span", {}, "纯前端运行 · 数据不出浏览器"),
    h("span", {}, "·"),
    h("a", {href: resolveRepoUrl(), target: "_blank", rel: "noreferrer"}, "GitHub 仓库"),
    h("span", {}, "·"),
    h("span", {}, "MIT License"),
  );
}

function render() {
  const id = currentToolId();
  const tool = TOOLS.find((item) => item.id === id);
  for (const item of document.querySelectorAll(".nav-item")) {
    if (item.getAttribute("data-id") === id) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  const view = document.getElementById("toolView");
  replaceKids(view, 
    h(
      "header",
      {class: "tool-head"},
      h("div", {class: "tool-eyebrow"}, tool.group),
      h("h1", {}, tool.name),
      h("p", {class: "tool-desc"}, tool.desc),
    ),
    tool.render(),
    footerNote(),
  );
  document.title = tool.name + " · OpsToolbox";
  const main = document.querySelector(".main");
  if (main) main.scrollTop = 0;
}

/* 命令面板 */
let paletteMatches = [];
let paletteIndex = 0;

function paletteNodes() {
  return {
    root: document.getElementById("palette"),
    input: document.getElementById("paletteInput"),
    list: document.getElementById("paletteList"),
  };
}

function drawPalette() {
  const {list} = paletteNodes();
  if (paletteMatches.length === 0) {
    replaceKids(list, h("div", {class: "palette-empty"}, "没有找到匹配的工具"));
    return;
  }
  replaceKids(list, 
    paletteMatches.map((tool, index) =>
      h(
        "div",
        {
          class: "palette-item",
          role: "option",
          "aria-selected": index === paletteIndex ? "true" : "false",
          onclick: () => choosePalette(index),
        },
        h("span", {class: "nav-badge"}, tool.badge),
        h("span", {class: "p-name"}, tool.name),
        h("span", {class: "p-group"}, tool.group),
      ),
    ),
  );
}

function filterPalette(query) {
  const keyword = String(query || "").trim().toLowerCase();
  paletteMatches = TOOLS.filter((tool) => {
    if (!keyword) return true;
    const haystack = (tool.name + " " + tool.group + " " + tool.keywords + " " + tool.id).toLowerCase();
    return haystack.includes(keyword);
  });
  paletteIndex = 0;
  drawPalette();
}

function choosePalette(index) {
  const tool = paletteMatches[index];
  if (!tool) return;
  closePalette();
  window.location.hash = "#/" + tool.id;
}

function openPalette() {
  const {root, input} = paletteNodes();
  root.hidden = false;
  input.value = "";
  filterPalette("");
  input.focus();
}

function closePalette() {
  const {root} = paletteNodes();
  root.hidden = true;
}

function movePalette(step) {
  const total = paletteMatches.length;
  if (total === 0) return;
  paletteIndex = (paletteIndex + step + total) % total;
  drawPalette();
  const {list} = paletteNodes();
  const active = list.querySelector('[aria-selected="true"]');
  if (active && active.scrollIntoView) active.scrollIntoView({block: "nearest"});
}

function typingInField(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
}

function bindShell() {
  buildNav();
  applyTheme();

  const themeButton = document.getElementById("themeToggle");
  if (themeButton) themeButton.addEventListener("click", toggleTheme);

  const repoLink = document.getElementById("repoLink");
  if (repoLink) {
    const repoUrl = resolveRepoUrl();
    repoLink.setAttribute("href", repoUrl);
    repoLink.setAttribute("title", "GitHub 仓库：" + repoUrl.replace(/^https?:\/\//, ""));
  }

  const searchButton = document.getElementById("openPalette");
  if (searchButton) searchButton.addEventListener("click", openPalette);

  const {root, input} = paletteNodes();

  if (input) {
    input.addEventListener("input", () => filterPalette(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        movePalette(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        movePalette(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        choosePalette(paletteIndex);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      }
    });
  }

  if (root) {
    root.addEventListener("mousedown", (event) => {
      if (event.target === root) closePalette();
    });
  }

  document.addEventListener("keydown", (event) => {
    const open = root && !root.hidden;
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
      event.preventDefault();
      if (open) closePalette();
      else openPalette();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.key === "/" && !open && !typingInField(event.target)) {
      event.preventDefault();
      openPalette();
    }
  });

  window.addEventListener("hashchange", render);
  render();
}

bindShell();
