// COVERAGE=1 で採取した V8 カバレッジを集計し、index.html のインラインスクリプトの
// 行カバレッジ・関数カバレッジと、未実行の関数一覧を出力する。
//
//   COVERAGE=1 npx playwright test
//   node coverage-report.js
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, ".coverage");
if (!fs.existsSync(DIR)) {
  console.error(".coverage がない。先に COVERAGE=1 npx playwright test を実行する。");
  process.exit(1);
}

// アプリ本体のインラインスクリプトだけを対象にする（Quill・サンドボックスiframeは除外）
const isAppScript = (e) =>
  typeof e.source === "string" && e.source.includes("logicTree.v2") && !e.url.includes("jsdelivr");

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
const perTest = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")).filter(isAppScript));
const source = (perTest.flat()[0] || {}).source || null;

if (source === null) {
  console.error("対象スクリプトのカバレッジが見つからない。");
  process.exit(1);
}

// V8のレンジは「親と食い違う部分だけ」を報告するため、テストごとにバイト単位へ展開してから
// テスト間で OR を取る。レンジのcountを単純合算すると、あるテストで通らなかった分岐が
// 別のテストで通っていても未実行と誤判定する。
const counts = new Uint8Array(source.length); // 1本でも通ったバイトを1にする
const perTestCovered = []; // テストごとの実行済みバイト（暗黙のelse判定に使う）
for (const entries of perTest) {
  const local = new Uint8Array(source.length);
  const ranges = [];
  for (const e of entries) {
    if (e.source !== source) continue; // 別バージョンのスクリプトは混ぜない
    for (const fn of e.functions) for (const r of fn.ranges) ranges.push(r);
  }
  // 外側のレンジから順に塗り、内側の未実行レンジで上書きする
  ranges.sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset));
  for (const r of ranges) local.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset);
  for (let i = 0; i < counts.length; i++) if (local[i]) counts[i] = 1;
  perTestCovered.push(local);
}

// 行単位に集計（空行とコメント専用行は分母から除く）
const lines = source.split("\n");
let offset = 0;
let total = 0;
let covered = 0;
const uncoveredLines = [];
lines.forEach((line, i) => {
  const start = offset;
  offset += line.length + 1;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
  total++;
  let ok = false;
  for (let p = start; p < start + line.length; p++) {
    if (source[p].trim() && counts[p] > 0) {
      ok = true;
      break;
    }
  }
  if (ok) covered++;
  else uncoveredLines.push(i + 1);
});

// 関数単位（V8のfunctionNameとレンジ先頭のcountで判定）。1本でも通れば実行済み。
const fnState = new Map();
for (const entries of perTest) {
  for (const e of entries) {
    if (e.source !== source) continue;
    for (const fn of e.functions) {
      const r = fn.ranges[0];
      const key = (fn.functionName || "(匿名)") + "@" + r.startOffset;
      fnState.set(key, (fnState.get(key) || 0) + r.count);
    }
  }
}
const named = [...fnState.entries()].filter(([k]) => !k.startsWith("(匿名)"));
const namedCovered = named.filter(([, c]) => c > 0);

// 行番号は index.html のものに揃える（インラインスクリプトの開始行を足す）
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
const at = html.indexOf(source.slice(0, 200));
const LINE_BASE = at < 0 ? 0 : html.slice(0, at).split("\n").length - 1;
const lineOf = (offsetInSource) => source.slice(0, offsetInSource).split("\n").length + LINE_BASE;

// ---- statements / branches / functions を構文解析で数える ----
// V8のカバレッジは「実行されたバイト範囲」しか持たないため、Istanbul相当の4指標を出すには
// ASTでノードの位置を拾い、その位置が実行済み範囲に入っているかで判定する。
const acorn = require("acorn");
const walk = require("acorn-walk");

const ast = acorn.parse(source, { ecmaVersion: 2022, locations: false });
const isCovered = (pos) => counts[pos] > 0;

const stmts = [];
const branches = [];
const fns = [];

const STATEMENT_TYPES = new Set([
  "ExpressionStatement", "VariableDeclaration", "ReturnStatement", "IfStatement",
  "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement",
  "SwitchStatement", "ThrowStatement", "TryStatement", "BreakStatement", "ContinueStatement",
  "FunctionDeclaration", "ClassDeclaration", "LabeledStatement", "DebuggerStatement",
]);

walk.full(ast, (node) => {
  if (STATEMENT_TYPES.has(node.type)) stmts.push(node);

  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
    fns.push({ node, name: (node.id && node.id.name) || "(匿名)" });
  }

  // Istanbul と同じ分岐の数え方：if の両アーム／三項の両アーム／論理演算子の各項／switch の各case
  if (node.type === "IfStatement") {
    branches.push({ kind: "if", node: node.consequent });
    if (node.alternate) branches.push({ kind: "else", node: node.alternate });
    else branches.push({ kind: "else(暗黙)", node: null, parent: node });
  } else if (node.type === "ConditionalExpression") {
    branches.push({ kind: "cond", node: node.consequent });
    branches.push({ kind: "cond", node: node.alternate });
  } else if (node.type === "LogicalExpression") {
    branches.push({ kind: "logical", node: node.right });
  } else if (node.type === "SwitchStatement") {
    node.cases.forEach((c) => branches.push({ kind: "case", node: c }));
  }
});

// 暗黙のelse（else節がないif）は「if文は実行されたが consequent は実行されなかった」テストが
// 1本でもあれば通ったとみなす。全テストの和集合で見ると、別々のテストで両アームが通った場合に
// 暗黙のelseを未実行と誤判定するため、ここだけテスト単位で判定する。
const branchCovered = branches.filter((b) => {
  if (b.node) return isCovered(b.node.start);
  return perTestCovered.some((c) => c[b.parent.start] && !c[b.parent.consequent.start]);
});
const stmtCovered = stmts.filter((s) => isCovered(s.start));
const fnCovered = fns.filter((f) => isCovered(f.node.body.start));

const pct = (a, b) => ((a / b) * 100).toFixed(1) + "%";

console.log("=== index.html インラインスクリプト カバレッジ ===");
console.log(`テスト数: ${files.length}`);
console.log("");
console.log("指標        | 実行済 / 全体 | 割合");
console.log("------------|---------------|------");
console.log(`Statements  | ${stmtCovered.length} / ${stmts.length} | ${pct(stmtCovered.length, stmts.length)}`);
console.log(`Branches    | ${branchCovered.length} / ${branches.length} | ${pct(branchCovered.length, branches.length)}`);
console.log(`Functions   | ${fnCovered.length} / ${fns.length} | ${pct(fnCovered.length, fns.length)}`);
console.log(`Lines       | ${covered} / ${total} | ${pct(covered, total)}`);
console.log(
  `\n（参考）名前付き関数のみ: ${namedCovered.length}/${named.length} ${pct(namedCovered.length, named.length)}`,
);

// 未実行の分岐を種類別に集計（どこを足せば伸びるかの目安）
const byKind = new Map();
for (const b of branches) {
  const rec = byKind.get(b.kind) || { total: 0, covered: 0 };
  rec.total++;
  if (branchCovered.includes(b)) rec.covered++;
  byKind.set(b.kind, rec);
}
console.log("\n--- 分岐の内訳 ---");
[...byKind.entries()]
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([kind, r]) => console.log(`  ${kind}\t${r.covered}/${r.total}\t${pct(r.covered, r.total)}`));

// 未実行の分岐が固まっている行（どのテストを足すか決める材料）
if (process.env.BRANCH_DETAIL) {
  console.log("\n--- 未実行の分岐がある行（多い順・上位40） ---");
  const perLine = new Map();
  for (const b of branches) {
    if (branchCovered.includes(b)) continue;
    const ln = lineOf((b.node || b.parent).start);
    const rec = perLine.get(ln) || { n: 0, kinds: new Set() };
    rec.n++;
    rec.kinds.add(b.kind);
    perLine.set(ln, rec);
  }
  [...perLine.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0] - b[0])
    .slice(0, 40)
    .forEach(([ln, r]) =>
      console.log(`  L${ln}\t${r.n}件\t[${[...r.kinds].join(",")}]\t${(lines[ln - LINE_BASE - 1] || "").trim().slice(0, 70)}`),
    );
}

console.log("\n--- 未実行の関数 ---");
named
  .filter(([, c]) => c === 0)
  .map(([k]) => {
    const [name, off] = k.split("@");
    return { name, line: lineOf(Number(off)) };
  })
  .sort((a, b) => a.line - b.line)
  .forEach((f) => console.log(`  L${f.line}\t${f.name}`));

// 未実行行の連続ブロック（5行以上）をまとめて出す
console.log("\n--- 未実行が続いている箇所（5行以上） ---");
let runStart = null;
let prev = null;
const flush = (end) => {
  if (runStart !== null && end - runStart >= 4) {
    console.log(
      `  L${runStart + LINE_BASE}-L${end + LINE_BASE}\t${lines[runStart - 1].trim().slice(0, 60)}`,
    );
  }
};
for (const ln of uncoveredLines) {
  if (prev !== null && ln === prev + 1) {
    prev = ln;
    continue;
  }
  flush(prev);
  runStart = ln;
  prev = ln;
}
flush(prev);
