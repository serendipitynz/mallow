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
  // toolbar / theme
  selectTheme: 'テーマを選択',
  'theme.light': 'ライト',
  'theme.dark': 'ダーク',
  'theme.auto': '自動 (OS)',
  // open with
  openIn: '{editor} で開く',
  revealIn: '{manager} で表示',
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
};

const en: Dict = {
  // common
  openFolder: 'Open Folder',
  open: 'Open',
  loading: 'Loading…',
  empty: '(empty)',
  settings: 'Settings',
  close: 'Close',
  // toolbar / theme
  selectTheme: 'Select theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.auto': 'Auto (OS)',
  // open with
  openIn: 'Open in {editor}',
  revealIn: 'Reveal in {manager}',
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
