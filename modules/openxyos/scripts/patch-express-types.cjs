/**
 * V0.50 R0-P0-09 类型修复 — 补丁脚本
 *
 * Express v5 @types 引入破坏性变更：
 * 1. ParamsDictionary: [key: string]: string | string[]  (v4 是 string)
 * 2. ParsedQs:         [key: string]: undefined | string | ParsedQs | ...
 *
 * 本系统所有路由均为 :id 路径参数（不使用 *wildcard），
 * 且查询参数从未使用数组/嵌套形式。
 *
 * 此脚本直接修补 node_modules 中上述两个接口定义，
 * 收敛为 string-only。每次 npm install 后由 postinstall 自动执行。
 */

const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: 'node_modules/@types/express-serve-static-core/index.d.ts',
    description: 'ParamsDictionary → string-only',
    find: '    [key: string]: string | string[];',
    replace: '    [key: string]: string;',
  },
  {
    file: 'node_modules/@types/qs/index.d.ts',
    description: 'ParsedQs → string-only',
    find: '        [key: string]: undefined | string | ParsedQs | (string | ParsedQs)[];',
    replace: '        [key: string]: string;',
  },
];

let patched = 0;
let skipped = 0;

for (const { file, description, find, replace } of patches) {
  const filePath = path.resolve(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`[skip] ${file} 不存在`);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  if (content.includes(replace)) {
    console.log(`[skip] ${description} — 已打过补丁`);
    skipped++;
    continue;
  }

  if (!content.includes(find)) {
    console.log(`[warn] ${description} — 未找到目标行，可能 @types 版本已变`);
    skipped++;
    continue;
  }

  content = content.replace(find, replace);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`[ok] ${description}`);
  patched++;
}

console.log(`\n补丁完成: ${patched} 处修改, ${skipped} 处跳过`);
