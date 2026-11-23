const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = require("node:path").join(__dirname, "bootstrap.js");
const listPath = process.argv[2];
if (!listPath) throw new Error("Pass the extracted Zotero windowed-list.js path");

const zotero = {
  Utilities: { debounce: fn => fn },
  Prefs: { get: () => 1 },
  getMainWindows: () => [window],
  logError(error) { throw error; },
};
const upstream = { exports: {} };
vm.runInNewContext(fs.readFileSync(listPath, "utf8"), { module: upstream, Zotero: zotero });

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let nextFrame;
let width = 180;
const short = { clientWidth: 100, scrollHeight: 16, toggleAttribute() {} };
const long = { clientWidth: 100, scrollHeight: 48, toggleAttribute() {} };
const remark = { clientWidth: 100, scrollHeight: 16, toggleAttribute() {} };
const innerElem = {
  isConnected: true,
  style: {},
  setAttribute() {},
  removeAttribute() {},
  querySelectorAll: () => [],
};
const targetElement = {
  scrollTop: 0, clientWidth: 400,
  getBoundingClientRect: () => ({ height: 100 }),
};
const items = [short, long].map((title, id) => ({
  id,
  title,
  ref: { isRegularItem: () => true },
}));
const list = new upstream.exports({
  itemHeight: 22,
  targetElement,
  getItemCount: () => items.length,
  renderItem: (index, row = { style: {} }) => {
    row.querySelector = selector => selector.includes("remark")
      ? (items[index].id === 1 ? remark : null)
      : items[index].title;
    row.style.height = (table._customRowHeightMap[index] ?? 22) + "px";
    return row;
  },
});
const header = { getBoundingClientRect: () => ({ width }) };
const table = {
  _jsWindow: list,
  _rowHeight: 22,
  _customRowHeightMap: {},
  _topDiv: { querySelectorAll: () => [header, header] },
  props: {},
  updateCustomRowHeights(customRowHeights) {
    this._customRowHeightMap = Object.fromEntries(customRowHeights);
    list.update({ customRowHeights });
  },
  invalidate: () => list.invalidate(),
};
list.innerElem = innerElem;
items.forEach((_, index) => list._renderedRows.set(index, list.renderItem(index)));
list.update();

const view = { tree: table, getRow: index => items[index] };
let onResize;
const window = {
  ZoteroPane: { itemsView: view },
  setInterval() {},
  clearInterval() {},
  ResizeObserver: class extends Observer { constructor(fn) { super(); onResize = fn; } },
  MutationObserver: Observer,
  getComputedStyle: () => ({ lineHeight: "16px" }),
  requestAnimationFrame(fn) { nextFrame = fn; return 1; },
  cancelAnimationFrame() {},
  document: {
    documentElement: { append() {} },
    createElementNS: () => ({ remove() {} }),
  },
};

const plugin = vm.createContext({ Zotero: zotero });
vm.runInContext(fs.readFileSync(source, "utf8"), plugin);
plugin.startup();
nextFrame();
assert.equal(list.getElementByIndex(0).style.height, "22px");
assert.equal(list.getElementByIndex(1).style.height, "54px");
assert.equal(list.getElementByIndex(1).style.top, "22px");
assert.equal(innerElem.style.height, "76px");

remark.scrollHeight = 64;
onResize();
nextFrame();
assert.equal(list.getElementByIndex(1).style.height, "70px");
assert.equal(innerElem.style.height, "92px");

width = 400;
long.scrollHeight = 16;
remark.scrollHeight = 16;
onResize();
nextFrame();
assert.equal(innerElem.style.height, "44px");

width = 120;
long.scrollHeight = 48;
items.reverse();
list.invalidate();
onResize();
nextFrame();
assert.equal(list.getElementByIndex(1).style.top, "54px");
assert.equal(innerElem.style.height, "76px");

plugin.shutdown();
assert.equal(list.getElementByIndex(0).style.height, "22px");
assert.equal(list.getElementByIndex(1).style.top, "22px");
assert.equal(innerElem.style.height, "44px");
console.log("PASS: resize, reorder, offsets, spacer and shutdown");

