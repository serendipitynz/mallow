/**
 * Lightweight in-app i18n: a flat message dictionary per language plus a React
 * context. The chosen language lives in localStorage (read synchronously before
 * first paint, like the theme) so there is no flash of the wrong language, and
 * also drives `<html lang>`. Falls back to the OS locale, then Japanese.
 */
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

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
  // toolbar / theme
  selectTheme: 'テーマを選択',
  'theme.light': 'ライト',
  'theme.dark': 'ダーク',
  'theme.auto': '自動 (OS)',
  // open with
  openIn: '{editor} で開く',
  revealIn: '{manager} で表示',
  openDefaultApp: '既定のアプリで開く',
  noEditors: '対応エディタが見つかりません',
  'manager.finder': 'Finder',
  'manager.explorer': 'エクスプローラ',
  'manager.fileManager': 'ファイルマネージャ',
  // explorer
  explorer: 'エクスプローラ',
  noFolderOpen: 'フォルダが開かれていません。',
  noFiles: '表示できるファイルがありません。',
  // viewer
  selectFile: 'ファイルを選択してください',
  mediaUnsupported: 'このファイルはこのプラットフォームでは表示できません。',
  readErrorInvalidUtf8:
    'UTF-8 として読めないファイルです。別の文字コード（CP932 など）で保存されている可能性があります。',
  readErrorBinary: 'バイナリ形式のファイル（{format}）のため、テキストとして表示できません。',
  // markdown view
  outline: 'アウトライン',
  contents: '目次',
  preview: 'プレビュー',
  source: 'ソース',
  viewMode: '表示モード',
  renderError: 'レンダリングエラー: {message}',
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
  language: '言語',
  customEmoji: 'カスタム絵文字',
  customEmojiHint:
    '画像を入れたフォルダを指定すると、ファイル名が :ショートコード: になります（emoji.json があれば併用）。',
  customEmojiUnset: '未設定',
  chooseFolder: 'フォルダを選択…',
  clear: '解除',
  customEmojiLoaded: '{n} 個の絵文字を読み込みました。',
  customEmojiFailed: 'フォルダを読み込めませんでした。',
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
  updateProgress: '更新の進行状況',
  updateDownloading: 'ダウンロードしています…',
  updateInstalling: '導入しています。終わるとアプリが再起動します。',
  updateRelaunching: '再起動しています…',
  updateInstallFailed: '更新は導入されませんでした。',
  updateInstallFailedHint: '取り消した場合も、通信や書き込みに失敗した場合も、この結果になります。',
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
  // toolbar / theme
  selectTheme: 'Select theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.auto': 'Auto (OS)',
  // open with
  openIn: 'Open in {editor}',
  revealIn: 'Reveal in {manager}',
  openDefaultApp: 'Open in default app',
  noEditors: 'No supported editors found',
  'manager.finder': 'Finder',
  'manager.explorer': 'File Explorer',
  'manager.fileManager': 'File Manager',
  // explorer
  explorer: 'Explorer',
  noFolderOpen: 'No folder is open.',
  noFiles: 'No files to display.',
  // viewer
  selectFile: 'Select a file',
  mediaUnsupported: 'This file cannot be displayed on this platform.',
  readErrorInvalidUtf8: 'This file is not valid UTF-8. It may be saved in another encoding, such as CP932.',
  readErrorBinary: 'This is a binary file ({format}), so it cannot be shown as text.',
  // markdown view
  outline: 'Outline',
  contents: 'Contents',
  preview: 'Preview',
  source: 'Source',
  viewMode: 'View mode',
  renderError: 'Render error: {message}',
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
  language: 'Language',
  customEmoji: 'Custom emoji',
  customEmojiHint:
    'Point at a folder of images and each file name becomes a :shortcode: (an emoji.json manifest is used when present).',
  customEmojiUnset: 'Not set',
  chooseFolder: 'Choose folder…',
  clear: 'Clear',
  customEmojiLoaded: 'Loaded {n} emoji.',
  customEmojiFailed: 'Could not read that folder.',
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
  updateProgress: 'Update progress',
  updateDownloading: 'Downloading…',
  updateInstalling: 'Installing. The app restarts when it finishes.',
  updateRelaunching: 'Restarting…',
  updateInstallFailed: 'The update was not installed.',
  updateInstallFailedHint: 'Cancelling, and a failed transfer or write, both end here.',
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
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (next) => {
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // still apply for this session
        }
        setLangState(next);
      },
      t: (key, params) => translate(lang, key, params),
    }),
    [lang],
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
