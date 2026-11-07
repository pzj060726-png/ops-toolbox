#!/usr/bin/env node
/**
 * 冒烟检查：确保每个核心模块都能被导入，且导出的是函数。
 * 浏览器里跑的是同一份代码，任何语法/导出错误都会在这里被拦下。
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const toolsDir = fileURLToPath(new URL("../src/tools", import.meta.url));
const files = (await readdir(toolsDir)).filter((file) => file.endsWith(".js") && file !== "index.js").sort();

let failures = 0;
for (const file of files) {
  try {
    const module = await import(pathToFileURL(join(toolsDir, file)).href);
    const names = Object.keys(module);
    const functions = names.filter((name) => typeof module[name] === "function");
    if (functions.length === 0) {
      console.error(`✗ ${file}: 没有导出任何函数`);
      failures += 1;
    } else {
      console.log(`✓ ${file}  (${functions.length} 个导出)`);
    }
  } catch (error) {
    console.error(`✗ ${file}: ${error.message}`);
    failures += 1;
  }
}

const indexModule = await import(pathToFileURL(join(toolsDir, "index.js")).href);
console.log(`\n聚合出口 src/tools/index.js 共导出 ${Object.keys(indexModule).length} 个符号`);

if (failures > 0) {
  console.error(`\n${failures} 个模块有问题`);
  process.exit(1);
}
console.log("全部模块导入正常 ✓");
