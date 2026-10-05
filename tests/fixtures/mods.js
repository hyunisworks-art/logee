// MODテスト用のフィクスチャ。異常系は実ファイルではなくここで組み立てる。
function mod(name, code, params) {
  return {
    type: "logee-mod",
    name,
    version: "1.0.0",
    author: "test",
    layout: { name: "test", params: params || {}, code },
  };
}

module.exports = {
  mod,

  // 全ノードを縦一列に並べる正常なMOD
  column: mod(
    "Column",
    `var all = [];
     (function walk(n){ all.push(n); if(!n.collapsed) (n.children||[]).forEach(walk); })(tree);
     var positions = {};
     all.forEach(function(n,i){ positions[n.id] = { x: 0, y: i * 160 }; });
     return { positions: positions };`,
  ),

  // 例外を投げる
  throws: mod("Throws", `throw new Error("mod boom");`),

  // 座標が数値でない
  badPositions: mod(
    "Bad",
    `var positions = {};
     (function walk(n){ positions[n.id] = { x: "あ", y: null }; (n.children||[]).forEach(walk); })(tree);
     return { positions: positions };`,
  ),

  // 上限（1e5）を超える座標
  hugeCoords: mod(
    "Huge",
    `var positions = {};
     (function walk(n){ positions[n.id] = { x: 1e9, y: 1e9 }; (n.children||[]).forEach(walk); })(tree);
     return { positions: positions };`,
  ),

  // 応答を返さない（無限ループ）
  infinite: mod("Infinite", `while (true) {}`),

  // localStorage へ触ろうとする（opaque origin で失敗するはず）
  storageProbe: mod(
    "StorageProbe",
    `var probe = "";
     try { probe = String(localStorage.getItem("logicTree.v2")); }
     catch (e) { probe = "ERR:" + e.name; }
     if (probe !== "ERR:SecurityError" && probe !== "null") throw new Error("leaked:" + probe);
     var positions = {};
     (function walk(n){ positions[n.id] = { x: 0, y: 0 }; (n.children||[]).forEach(walk); })(tree);
     return { positions: positions };`,
  ),

  // layout.code がない
  noCode: { type: "logee-mod", name: "NoCode", version: "1.0.0", layout: { name: "x", params: {} } },
};
