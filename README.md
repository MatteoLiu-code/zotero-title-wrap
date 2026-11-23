# Zotero Title Wrap 0.1.2

0.1.1 补齐 Zotero 10.0.8 安装器要求的 `applications.zotero.update_url`。本地发行包使用保留的 `.invalid` 域名作为占位，更新通过手动安装新版 XPI 完成。

0.1.2 adds wrapping for the column named Simplified Chinese “简记” in Zotero Style (zoterostyle-remark). Row height follows the taller of the Title and Remark cells.

## 安装

1. 下载与本说明一同提供的 `zotero-title-wrap-0.1.2.xpi`，保留原扩展名。
2. 在 Zotero 10 菜单打开「工具 → 插件」，点右上角齿轮，选「从文件安装插件…」（Install Plugin From File…），选择 XPI 并确认。
3. 回到文献库，在中间条目列表显示「标题」列。拖动标题列边界，检查短标题仍为单行、长标题按可用宽度换行、作者和年份仍各自在本列中垂直居中。再试一次排序、搜索和滚动。
4. 要关闭效果，回到插件管理器停用或移除 Zotero Title Wrap。

## 实现与验证

插件作用于主窗口中间列表的常规文献条目。标题使用 Zotero 原有的文本节点，保留标题格式、缩进和图标。行高从实际排版测量，短标题沿用原高度。作者和年份等列使用原有的宽度和对齐规则。插件按虚拟列表渲染进度测量条目，尚未测量的行先使用默认高度，因此滚动条长度可能随滚动逐步调整。

插件清单限定 Zotero 10.0.x。版本 10 的官方迁移文档确认主窗口的 `ZoteroPane.itemsView` 为 `CollectionViewItemTree`。已从本机 Zotero 10.0.8 安装包核对标题 DOM、`updateCustomRowHeights()` 和 `WindowedList` 的行位置及总高度计算。插件使用非公开的列表接口，其他 10.0.x 小版本、不同平台和会改动标题或行布局的插件仍需实测。检测不到所需接口时，跳过该列表。

已通过 JavaScript 语法检查、XPI 包结构检查，以及用 10.0.8 原版 `WindowedList` 加模拟 DOM 运行的测试，覆盖长短标题高度、列宽变化、重排后的行坐标和停用恢复。测试提供模拟的文字高度。实际 Zotero 窗口中的安装、换行视觉效果、极长标题、复杂文字方向和大馆藏滚动性能尚未验证。

- [Zotero 10 开发者文档](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [插件清单与启动钩子](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [官方 VirtualizedTable 源码](https://github.com/zotero/zotero/blob/main/chrome/content/zotero/components/virtualized-table.jsx)
- [官方 WindowedList 源码](https://github.com/zotero/zotero/blob/main/chrome/content/zotero/components/windowed-list.js)

## 从源码构建

解压源码包，在源码目录运行 `python build.py`。它会生成 XPI，并检查归档完整性。测试可用 `node test.cjs <windowed-list.js 的路径>` 重跑。该文件可从 Zotero 10.0.8 安装目录的 `app/omni.ja` 中提取，包内路径为 `chrome/content/zotero/components/windowed-list.js`。

