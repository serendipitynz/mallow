/**
 * Lightweight in-app i18n: a flat message dictionary per language plus a React
 * context. The chosen language lives in localStorage (read synchronously before
 * first paint, like the theme) so there is no flash of the wrong language, and
 * also drives `<html lang>`. Falls back to the OS locale, then Japanese.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'ja' | 'en';

/** Selectable languages. Labels are autonyms (shown in their own language). */
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
];

const STORAGE_KEY = 'lang';

type Dict = Record<string, string>;

const ja: Dict = {
  // common
  openFolder: 'フォルダを開く',
  open: '開く',
  loading: '読み込み中…',
  empty: '（空）',
  settings: '設定',
  close: '閉じる',
  on: 'オン',
  off: 'オフ',
  // toolbar / colour
  colorMode: '明暗',
  'mode.light': 'ライト',
  'mode.dark': 'ダーク',
  'mode.auto': '自動 (OS)',
  modeOneSided: '{family} は暗い配色だけを持つため、ライトと自動 (OS) は選べません。',
  appearance: '外観',
  colorFamily: '配色',
  'family.standard': '標準',
  colorUnrecognized: '保存されている配色はこのバージョンにはないため、標準の配色で表示しています。',
  unavailable: '選べません',
  // open with
  openIn: '{editor} で開く',
  revealIn: '{manager} で表示',
  openDefaultApp: '既定のアプリで開く',
  noEditors: '対応エディタが見つかりません',
  openNeedsFile: 'ファイルを選ぶと使えます',
  'manager.finder': 'Finder',
  'manager.explorer': 'エクスプローラ',
  'manager.fileManager': 'ファイルマネージャ',
  copyPath: 'パスをコピー',
  copyRelativePath: '相対パスをコピー',
  fileActions: '{name} の操作',
  // visit history
  historyBack: '戻る',
  historyForward: '進む',
  historyBackNone: '戻る先のファイルがありません',
  historyForwardNone: '進む先のファイルがありません',
  // explorer
  explorer: 'エクスプローラ',
  noFolderOpen: 'フォルダが開かれていません。',
  noFiles: '表示できるファイルがありません。',
  recentFolders: '最近開いたフォルダ',
  recentNewWindowHint: '{modifier} を押しながらクリックすると別のウィンドウで開きます。',
  recentFolderGone: 'フォルダが見つかりません: {folder}',
  recentFolderUnlisted: '最近開いたフォルダの一覧から外れています: {folder}',
  handoverMissing: '開こうとしたファイルまたはフォルダが見つかりません: {path}',
  handoverUnsupported: 'mallow はこの種類のファイルを開けません: {path}',
  handoverNotAFile: 'ファイルでもフォルダでもないため開けません: {path}',
  handoverDroppedMany: 'ドロップされた {count} 件のうち、最初の 1 件だけを開きました。',
  treeReadFailed: 'このフォルダを読み込めませんでした（{error}）。閉じて開き直すと読み込み直します。',
  folderReadFailed: 'フォルダを読み込めませんでした（{error}）。フォルダを開き直してください。',
  explorerWidth: 'エクスプローラの幅',
  explorerWidthValue: '{width} ピクセル',
  explorerWidthHint:
    'ドラッグするか、クリックしてから置きたい位置をクリックすると幅を変えられます。矢印キーでも変えられます。',
  'noticeLevel.failure': '失敗',
  'noticeLevel.warning': '警告',
  'noticeLevel.degraded': '一部の機能が使えない状態',
  'noticeLevel.info': '案内',
  dismiss: '閉じる',
  // viewer
  selectFile: 'ファイルを選択してください',
  mediaUnsupported: 'このファイルはこのプラットフォームでは表示できません。',
  readErrorInvalidUtf8:
    'UTF-8 として読めないファイルです。別の文字コード（CP932 など）で保存されている可能性があります。',
  readErrorBinary: 'バイナリ形式のファイル（{format}）のため、テキストとして表示できません。',
  // markdown view
  outline: 'アウトライン',
  contents: '目次',
  // find in the open document
  find: '検索',
  findPrevious: '前の一致',
  findNext: '次の一致',
  findClose: '検索を閉じる',
  findPosition: '{current} / {total}',
  findTotal: '{total} 件',
  findTotalOne: '1 件',
  findNone: '一致なし',
  findUnavailable: 'この表示では検索できません',
  preview: 'プレビュー',
  source: 'ソース',
  viewMode: '表示モード',
  renderError: 'レンダリングエラー: {message}',
  mermaidFailed: '図を描画できませんでした: {message}',
  mermaidEmpty: '空のファイルです。',
  // slides (TASK-51.2)
  slides: 'スライド',
  present: '全画面で発表',
  presentInWindow: 'ウィンドウで発表',
  previousSlide: '前のスライド',
  nextSlide: '次のスライド',
  slidePosition: '{current} / {total}',
  listSeparator: '、',
  // laser pointer (TASK-51.3)
  laserTooltip: '発表中は L でレーザーポインター',
  presentHintEnd: '終了',
  presentHintPlace: '全画面／ウィンドウ',
  presentHintLaser: 'レーザーポインター（Shift を押しながら動かすと軌跡が長く残る）',
  deckUnsupported: 'このデッキには mallow が Marp と同じようには表示しない機能が含まれています: {features}',
  'deckFeature.rawHtml': 'HTML タグ（文字として表示）',
  'deckFeature.math': '数式',
  'deckFeature.theme': 'テーマ「{name}」（mallow のテーマで表示）',
  'deckFeature.themeDrawn': 'テーマ「{name}」（テーマ「{drawn}」で表示）',
  'deckFeature.size': 'サイズ「{value}」（テーマ本来のサイズで表示）',
  'deckFeature.fit': '<!-- fit --> の見出し',
  'deckFeature.cssAtRule': 'CSS の {name}（除去）',
  'deckFeature.cssAssetUrl': 'CSS 内の asset: URL（除去）',
  'deckFeature.cssUnparsed': '解釈できない CSS（全体を除去）',
  // source view
  highlightSkipped: 'ファイルが大きいため、強調表示を省いて表示しています。',
  // html view
  rendered: '描画',
  htmlRenderSkipped: '要素数またはテキスト量が上限を超えているため、描画せずソースを表示しています。',
  htmlTooTall: '描画したときの高さが上限を超えているため、描画せずソースを表示しています。',
  htmlNoticeScripts: 'スクリプト {n} 個は実行されません。',
  htmlNoticeBlockedRefs: 'スタイルシートやスクリプト、リモートの動画など、参照 {n} 件は読み込まれません。',
  htmlNoticeLocalRefs: '文書の隣にあるスタイルシートなど、局所参照 {n} 件は読み込めません。',
  htmlNoticeFrames: '入れ子のフレーム {n} 個を取り除きました。',
  htmlNoticeLinksInert: 'この環境ではリンク {n} 件が動作しません。文書自身の目次も動きません。',
  htmlNoticeOutlineWorks: '見出しの移動はアウトラインから行えます。',
  // config view
  expandAll: 'すべて展開',
  collapseAll: 'すべて折りたたみ',
  expandControls: '展開操作',
  tree: 'ツリー',
  syntaxError: '{format} 構文エラー',
  locLineCol: '（{line} 行 {column} 列）',
  locLine: '（{line} 行）',
  items: '{n} 個',
  keys: '{n} キー',
  showMore: 'さらに表示（残り {n} 件）',
  // table view
  table: '表',
  rowNumber: '行番号',
  tableTruncatedRows: '{n} 行を省略しています。',
  tableTruncatedColumns: '{n} 列を省略しています。',
  tableClippedCells: '{n} 個のセルは先頭 {chars} 文字までを表示しています。',
  tableTruncatedHint: '全文はソース表示で確認できます。',
  // xml view
  xmlNodesOmitted: '{n} 個のノードを省略しています。',
  xmlClippedValues: '{n} 個の値は先頭 {chars} 文字までを表示しています。',
  xmlTruncatedHint: '文書全体はソース表示で確認できます。',
  // settings modal
  explorerPosition: 'エクスプローラの位置',
  left: '左',
  right: '右',
  proseMeasure: '文章の幅',
  'measure.standard': '標準',
  'measure.wide': '幅広',
  'measure.full': 'フル（制限なし）',
  proseMeasureHint: '表・コード・図は、どれを選んでもウィンドウの幅まで広がります。',
  language: '言語',
  customEmoji: 'カスタム絵文字',
  customEmojiHint:
    '画像を入れたフォルダを指定すると、ファイル名が :ショートコード: になります（emoji.json があれば併用）。',
  customEmojiUnset: '未設定',
  chooseFolder: 'フォルダを選択…',
  clear: '解除',
  customEmojiLoaded: '{n} 個の絵文字を読み込みました。',
  customEmojiFailed: 'フォルダを読み込めませんでした。',
  slideThemes: 'スライドテーマ',
  slideThemeDefault: '既定のテーマ',
  slideThemeDefaultHint: 'テーマを指定していないデッキと、mallow にないテーマを指定したデッキに使います。',
  slideThemeMallow: 'mallow（default）',
  slideThemeNotFound: '見つかりません',
  slideThemeMissing: 'テーマ「{name}」が見つからないため、mallow のテーマで表示しています。',
  slideThemeDirHint:
    'フォルダ直下にある、@theme コメントを持つ .css ファイルを読み込みます。デッキの CSS と同じく、@media・@supports・@container 以外のアットルールと asset: URL は除去します。',
  slideThemeDirUnset: '未設定',
  slideThemeDirFailed: 'フォルダを読み込めませんでした。',
  slideThemeLoading: '読み込んでいます…',
  slideThemeNone: 'テーマとして読み込めるファイルがありません。',
  slideThemeRemoved: '除去: {items}',
  slideThemeRemovedAssetUrls: 'asset: URL {n} 件',
  'slideThemeSkip.unreadable': '読み込めないため使いません',
  'slideThemeSkip.unparsed': 'CSS を解釈できないため使いません',
  'slideThemeSkip.noTheme': '@theme コメントがないため使いません',
  'slideThemeSkip.reserved': 'テーマ名「{name}」は mallow が使うため使いません',
  'slideThemeSkip.conflict': 'テーマ名「{name}」を別のファイルも使っているため、どちらも使いません',
  // update
  update: '更新',
  updateRunningVersion: '実行中: バージョン {version}',
  updateAutoCheck: '起動時に更新を確認する',
  updateAutoCheckHint: 'オフにしても、この画面からいつでも確認できます。確認しただけでは何も導入されません。',
  updateCheckNow: '今すぐ確認',
  updateChecking: '確認しています…',
  updateUpToDate: '最新版を使用しています。',
  updateCheckFailed: '更新を確認できませんでした。',
  updateAvailable: '更新があります',
  updateTargetVersion: 'バージョン {version}',
  updateNotesLabel: 'このバージョンの変更点',
  updateAuthNotice: '導入の途中で、システムがパスワードまたは管理者の承認を求めることがあります。',
  updateInstallNow: '導入する',
  updateLater: 'あとで',
  updateCannotClose: '導入が終わるまで、この画面は閉じられません。',
  updateProgress: '更新の進行状況',
  updateDownloading: 'ダウンロードしています…',
  updateInstalling: '導入しています。終わるとアプリが再起動します。',
  updateRelaunching: '再起動しています…',
  updateInstalled: '更新を導入しました',
  updateInstalledHint: 'アプリを手動で再起動すると、新しいバージョンで開きます。',
  updateInstallFailed: '更新は導入されませんでした。',
  updateInstallFailedHint: '取り消した場合も、通信や書き込みに失敗した場合も、この結果になります。',
  // PDF export
  pdfExportFailedTitle: 'PDF を書き出せませんでした',
  pdfExportFailed: 'PDF の書き出しに失敗しました。\n\n{error}',
};

const en: Dict = {
  // common
  openFolder: 'Open Folder',
  open: 'Open',
  loading: 'Loading…',
  empty: '(empty)',
  settings: 'Settings',
  close: 'Close',
  on: 'On',
  off: 'Off',
  // toolbar / colour
  colorMode: 'Light or dark',
  'mode.light': 'Light',
  'mode.dark': 'Dark',
  'mode.auto': 'Auto (OS)',
  modeOneSided: '{family} has a dark palette only, so Light and Auto (OS) are unavailable.',
  appearance: 'Appearance',
  colorFamily: 'Palette',
  'family.standard': 'Standard',
  colorUnrecognized: 'The saved palette is not in this version, so the standard palette is shown.',
  unavailable: 'unavailable',
  // open with
  openIn: 'Open in {editor}',
  revealIn: 'Reveal in {manager}',
  openDefaultApp: 'Open in default app',
  noEditors: 'No supported editors found',
  openNeedsFile: 'Select a file to use this',
  'manager.finder': 'Finder',
  'manager.explorer': 'File Explorer',
  'manager.fileManager': 'File Manager',
  copyPath: 'Copy path',
  copyRelativePath: 'Copy relative path',
  fileActions: 'Actions for {name}',
  // visit history
  historyBack: 'Back',
  historyForward: 'Forward',
  historyBackNone: 'No file to go back to',
  historyForwardNone: 'No file to go forward to',
  // explorer
  explorer: 'Explorer',
  noFolderOpen: 'No folder is open.',
  noFiles: 'No files to display.',
  recentFolders: 'Recent Folders',
  recentNewWindowHint: 'Hold {modifier} and click to open in another window.',
  recentFolderGone: 'That folder is no longer there: {folder}',
  recentFolderUnlisted: 'That folder is no longer in the recent list: {folder}',
  handoverMissing: 'The file or folder to open does not exist: {path}',
  handoverUnsupported: 'mallow does not open this kind of file: {path}',
  handoverNotAFile: 'This is neither a file nor a folder, so it cannot be opened: {path}',
  handoverDroppedMany: '{count} items were dropped; only the first was opened.',
  treeReadFailed: "Couldn't read this folder ({error}). Close it and open it again to retry.",
  folderReadFailed: "Couldn't read the folder ({error}). Open the folder again.",
  explorerWidth: 'Explorer width',
  explorerWidthValue: '{width} pixels',
  explorerWidthHint: 'Drag, or click and then click where it should go, to change the width. The arrow keys work too.',
  'noticeLevel.failure': 'Failure',
  'noticeLevel.warning': 'Warning',
  'noticeLevel.degraded': 'Some features unavailable',
  'noticeLevel.info': 'Information',
  dismiss: 'Dismiss',
  // viewer
  selectFile: 'Select a file',
  mediaUnsupported: 'This file cannot be displayed on this platform.',
  readErrorInvalidUtf8: 'This file is not valid UTF-8. It may be saved in another encoding, such as CP932.',
  readErrorBinary: 'This is a binary file ({format}), so it cannot be shown as text.',
  // markdown view
  outline: 'Outline',
  contents: 'Contents',
  // find in the open document
  find: 'Find',
  findPrevious: 'Previous match',
  findNext: 'Next match',
  findClose: 'Close find',
  findPosition: '{current} / {total}',
  findTotal: '{total} matches',
  findTotalOne: '1 match',
  findNone: 'No matches',
  findUnavailable: 'Find is not available in this view',
  preview: 'Preview',
  source: 'Source',
  viewMode: 'View mode',
  renderError: 'Render error: {message}',
  mermaidFailed: 'The diagram could not be drawn: {message}',
  mermaidEmpty: 'The file is empty.',
  // slides (TASK-51.2)
  slides: 'Slides',
  present: 'Present full screen',
  presentInWindow: 'Present in window',
  previousSlide: 'Previous slide',
  nextSlide: 'Next slide',
  slidePosition: '{current} / {total}',
  listSeparator: ', ',
  // laser pointer (TASK-51.3)
  laserTooltip: 'While presenting, L toggles the laser pointer',
  presentHintEnd: 'End',
  presentHintPlace: 'Full screen / window',
  presentHintLaser: 'Laser pointer (hold Shift while moving for a longer trail)',
  deckUnsupported: 'This deck uses features mallow does not show the way Marp does: {features}',
  'deckFeature.rawHtml': 'HTML tags (shown as text)',
  'deckFeature.math': 'math',
  'deckFeature.theme': 'the theme “{name}” (drawn with mallow’s theme)',
  'deckFeature.themeDrawn': 'the theme “{name}” (drawn with the theme “{drawn}”)',
  'deckFeature.size': 'the size “{value}” (drawn at the theme’s own size)',
  'deckFeature.fit': '<!-- fit --> headings',
  'deckFeature.cssAtRule': '{name} in CSS (removed)',
  'deckFeature.cssAssetUrl': 'asset: URLs in CSS (removed)',
  'deckFeature.cssUnparsed': 'CSS that cannot be parsed (removed whole)',
  // source view
  highlightSkipped: 'This file is large, so it is shown without syntax highlighting.',
  // html view
  rendered: 'Rendered',
  htmlRenderSkipped:
    'This document has more elements or text than the rendered view builds, so its source is shown instead.',
  htmlTooTall: 'Rendered, this document is taller than the frame is allowed to grow, so its source is shown instead.',
  // Written as label-then-count rather than "{n} scripts …": n is 1 in the
  // common case, and English number agreement cannot be carried by a template
  // this dictionary has no plural form for.
  htmlNoticeScripts: 'Scripts not run: {n}.',
  htmlNoticeBlockedRefs: 'References not loaded — stylesheets, scripts, remote media: {n}.',
  htmlNoticeLocalRefs: 'Local references not loaded, such as a stylesheet beside the document: {n}.',
  htmlNoticeFrames: 'Nested frames removed: {n}.',
  htmlNoticeLinksInert: "Links that do nothing on this platform, the document's own table of contents included: {n}.",
  htmlNoticeOutlineWorks: 'Use the outline to move between headings.',
  // config view
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  expandControls: 'Expand controls',
  tree: 'Tree',
  syntaxError: '{format} syntax error',
  locLineCol: ' (line {line}, column {column})',
  locLine: ' (line {line})',
  items: '{n} items',
  keys: '{n} keys',
  showMore: 'Show more ({n} remaining)',
  // table view
  table: 'Table',
  rowNumber: 'Row number',
  tableTruncatedRows: '{n} rows are not shown.',
  tableTruncatedColumns: '{n} columns are not shown.',
  tableClippedCells: '{n} cells show only their first {chars} characters.',
  tableTruncatedHint: 'The full text is in the source view.',
  // xml view
  xmlNodesOmitted: '{n} nodes are not shown.',
  xmlClippedValues: '{n} values show only their first {chars} characters.',
  xmlTruncatedHint: 'The whole document is in the source view.',
  // settings modal
  explorerPosition: 'Explorer position',
  left: 'Left',
  right: 'Right',
  proseMeasure: 'Text width',
  'measure.standard': 'Standard',
  'measure.wide': 'Wide',
  'measure.full': 'Full (no limit)',
  proseMeasureHint: 'Tables, code and diagrams widen with the window whichever you choose.',
  language: 'Language',
  customEmoji: 'Custom emoji',
  customEmojiHint:
    'Point at a folder of images and each file name becomes a :shortcode: (an emoji.json manifest is used when present).',
  customEmojiUnset: 'Not set',
  chooseFolder: 'Choose folder…',
  clear: 'Clear',
  customEmojiLoaded: 'Loaded {n} emoji.',
  customEmojiFailed: 'Could not read that folder.',
  slideThemes: 'Slide themes',
  slideThemeDefault: 'Default theme',
  slideThemeDefaultHint: 'Used for a deck that names no theme, or one mallow does not have.',
  slideThemeMallow: 'mallow (default)',
  slideThemeNotFound: 'not found',
  slideThemeMissing: 'The theme “{name}” is not found, so decks are drawn with mallow’s theme.',
  slideThemeDirHint:
    'Reads each .css file directly inside the folder that carries an @theme comment. As with a deck’s CSS, at-rules other than @media, @supports and @container, and asset: URLs, are removed.',
  slideThemeDirUnset: 'Not set',
  slideThemeDirFailed: 'Could not read that folder.',
  slideThemeLoading: 'Loading…',
  slideThemeNone: 'No file in the folder can be read as a theme.',
  slideThemeRemoved: 'Removed: {items}',
  slideThemeRemovedAssetUrls: '{n} asset: URL(s)',
  'slideThemeSkip.unreadable': 'not used: the file cannot be read',
  'slideThemeSkip.unparsed': 'not used: the CSS cannot be parsed',
  'slideThemeSkip.noTheme': 'not used: no @theme comment',
  'slideThemeSkip.reserved': 'not used: the theme name “{name}” is mallow’s',
  'slideThemeSkip.conflict': 'not used: another file also claims the theme name “{name}”',
  // update
  update: 'Updates',
  updateRunningVersion: 'Running version {version}',
  updateAutoCheck: 'Check for updates at launch',
  updateAutoCheckHint: 'Turning this off leaves the check on this screen. A check on its own installs nothing.',
  updateCheckNow: 'Check now',
  updateChecking: 'Checking…',
  updateUpToDate: 'You are on the latest version.',
  updateCheckFailed: 'Could not check for updates.',
  updateAvailable: 'An update is available',
  updateTargetVersion: 'Version {version}',
  updateNotesLabel: "What's in this version",
  updateAuthNotice: 'The system may ask for a password or for administrator approval while the update is installed.',
  updateInstallNow: 'Install',
  updateLater: 'Later',
  updateCannotClose: 'This window cannot be closed until the install ends.',
  updateProgress: 'Update progress',
  updateDownloading: 'Downloading…',
  updateInstalling: 'Installing. The app restarts when it finishes.',
  updateRelaunching: 'Restarting…',
  updateInstalled: 'The update is installed',
  updateInstalledHint: 'Restart the app by hand to open it on the new version.',
  updateInstallFailed: 'The update was not installed.',
  updateInstallFailedHint: 'Cancelling, and a failed transfer or write, both end here.',
  // PDF export
  pdfExportFailedTitle: 'The PDF was not written',
  pdfExportFailed: 'The PDF export failed.\n\n{error}',
};

const messages: Record<Lang, Dict> = { ja, en };

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ja' || stored === 'en') {
      return stored;
    }
  } catch {
    // private mode / disabled storage: fall through to OS detection
  }
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('en')) {
    return 'en';
  }
  return 'ja';
}

export type TParams = Record<string, string | number>;
export type TFn = (key: string, params?: TParams) => string;

function translate(lang: Lang, key: string, params?: TParams): string {
  const template = messages[lang][key] ?? messages.ja[key] ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Switch this window's language without persisting it — what a window does
   *  when another window is the one that changed it (`lib/settings-sync`).
   *  Every window shares one WebView data store, so the originating window's
   *  write is already this window's stored value. */
  applyLang: (lang: Lang) => void;
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  /** Stable for the life of the provider, so that the effect in `App` listening
   *  for another window's language change registers once rather than again on
   *  every switch. */
  const applyLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // still apply for this session
      }
      applyLang(next);
    },
    [applyLang],
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      applyLang,
      t: (key, params) => translate(lang, key, params),
    }),
    [lang, setLang, applyLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

/** Convenience hook for components that only need the translation function. */
export function useT(): TFn {
  return useI18n().t;
}
