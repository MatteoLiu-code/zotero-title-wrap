const windows = new Map();
const marker = "data-zotero-title-wrap";
const textSelectors = [
  ":scope > .cell.title > .cell-text",
  ":scope > .cell.zoterostyle-remark .remark-span",
];
const headerSelector = ".virtualized-table-header .cell:is(.title, .zoterostyle-remark)";

function startup() {
  for (const window of Zotero.getMainWindows()) onMainWindowLoad({ window });
}

function shutdown() {
  for (const window of windows.keys()) onMainWindowUnload({ window });
}

function onMainWindowLoad({ window }) {
  if (windows.has(window)) return;
  let active;
  const timer = window.setInterval(connect, 350);
  windows.set(window, () => {
    window.clearInterval(timer);
    active?.stop();
  });
  connect();

  function connect() {
    const view = window.ZoteroPane?.itemsView;
    const table = view?.tree;
    const list = table?._jsWindow;
    if (active?.list === list && active?.view === view) return;
    active?.stop();
    active = null;
    if (list?.innerElem?.isConnected && table._topDiv &&
        typeof view.getRow === "function" && typeof table.updateCustomRowHeights === "function" &&
        typeof table.invalidate === "function" && typeof list.update === "function" &&
        typeof list.scrollTo === "function" &&
        typeof list.getFirstVisibleRow === "function" && typeof list._getItemPosition === "function" &&
        typeof list._renderedRows?.entries === "function" && Array.isArray(list.customRowHeights)) {
      active = wrapTree(window, view, table, list);
    }
  }
}

function onMainWindowUnload({ window }) {
  windows.get(window)?.();
  windows.delete(window);
}

function sameHeights(a, b) {
  return a.length === b.length &&
    a.every(([index, height], i) => index === b[i][0] && height === b[i][1]);
}

function wrapTree(window, view, table, list) {
  const { innerElem, targetElement } = list;
  const measured = new Map();
  let frame = null;
  let headers = [];
  let layoutKey;
  let applied;
  let stopped = false;
  const stylesheet = window.document.createElementNS("http://www.w3.org/1999/xhtml", "style");
  stylesheet.textContent = `
    [${marker}] > .row [${marker}] {
      white-space: normal;
      overflow-wrap: anywhere;
      min-inline-size: 0;
      text-overflow: clip;
      line-height: 1.333333;
    }
    [${marker}] > .row .remark-span[${marker}] {
      display: inline-block;
      max-inline-size: 100%;
      overflow: hidden;
      vertical-align: middle;
    }`;
  window.document.documentElement.append(stylesheet);
  innerElem.setAttribute(marker, "");

  const resize = new window.ResizeObserver(schedule);
  resize.observe(targetElement);
  const mutation = new window.MutationObserver(schedule);
  mutation.observe(innerElem, { childList: true, subtree: true, characterData: true });
  mutation.observe(table._topDiv, { childList: true, subtree: true });
  window.document.fonts?.addEventListener("loadingdone", resetMeasurements);
  schedule();

  function resetMeasurements() {
    measured.clear();
    schedule();
  }

  function schedule() {
    if (stopped || frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      try {
        measure();
      } catch (error) {
        Zotero.logError(error);
        stop();
      }
    });
  }

  function measure() {
    if (!innerElem.isConnected || !targetElement.clientWidth) return;
    const nextHeaders = Array.from(table._topDiv.querySelectorAll(headerSelector));
    if (nextHeaders.length !== headers.length || nextHeaders.some((node, i) => node !== headers[i])) {
      for (const header of headers) resize.unobserve(header);
      headers = nextHeaders;
      for (const header of headers) resize.observe(header);
      measured.clear();
    }

    const base = table._rowHeight;
    if (!Number.isFinite(base) || base <= 0) return;
    const key = [...headers.map(header => header.getBoundingClientRect().width), targetElement.clientWidth,
      base, Zotero.Prefs.get("fontSize")].join("/");
    if (key !== layoutKey) {
      measured.clear();
      layoutKey = key;
    }
    for (const [index, entry] of measured) {
      if (view.getRow(index)?.id !== entry.id) measured.delete(index);
    }

    const native = new Map(table.props.customRowHeights ?? []);
    for (const [index, row] of list._renderedRows.entries()) {
      const itemRow = view.getRow(index);
      const eligible = Boolean(itemRow?.ref?.isRegularItem?.());
      let extra = 0;
      for (const selector of textSelectors) {
        const content = row.querySelector(selector);
        content?.toggleAttribute(marker, eligible);
        if (!eligible || !content?.clientWidth) continue;
        const line = parseFloat(window.getComputedStyle(content).lineHeight);
        if (Number.isFinite(line)) extra = Math.max(extra, content.scrollHeight - Math.round(line));
      }
      if (extra > 1) {
        measured.set(index, { id: itemRow.id, height: (native.get(index) ?? base) + extra });
      } else {
        measured.delete(index);
      }
    }
    for (const [index, { height }] of measured) native.set(index, height);
    const heights = Array.from(native).sort(([a], [b]) => a - b);
    if (!sameHeights(heights, list.customRowHeights) ||
        Object.keys(table._customRowHeightMap ?? {}).length !== heights.length ||
        heights.some(([i, h]) => table._customRowHeightMap?.[i] !== h)) {
      applied = heights;
      apply(heights, true);
    }
  }

  function apply(heights, preserveScroll) {
    const anchor = Math.max(0, list.getFirstVisibleRow());
    const oldTop = list._getItemPosition(anchor);
    const oldScroll = targetElement.scrollTop;
    table.updateCustomRowHeights(heights);
    // Some WindowedList versions compute the spacer before rebuilding offsets.
    list.update();
    if (preserveScroll) list.scrollTo(oldScroll + list._getItemPosition(anchor) - oldTop);
    table.invalidate();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    mutation.disconnect();
    resize.disconnect();
    window.document.fonts?.removeEventListener("loadingdone", resetMeasurements);
    innerElem.removeAttribute(marker);
    for (const title of innerElem.querySelectorAll(`[${marker}]`)) title.removeAttribute(marker);
    stylesheet.remove();
    if (applied && innerElem.isConnected && table._jsWindow === list &&
        sameHeights(applied, list.customRowHeights)) {
      try {
        apply(table.props.customRowHeights ?? [], false);
      } catch (error) {
        Zotero.logError(error);
      }
    }
  }

  return { view, list, stop };
}

