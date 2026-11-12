---
id: TASK-50
title: >-
  Give the explorer's rows a context menu with Open in and the two copy-path
  entries
status: In Review
assignee: []
created_date: '2026-11-11 01:29'
updated_date: '2026-11-12 04:27'
labels:
  - feature
dependencies: []
references:
  - src/components/FileTree.tsx
  - src/components/Explorer.tsx
  - src/components/OpenWith.tsx
  - src/hooks/useMenu.ts
  - src-tauri/src/editors.rs
priority: medium
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every way to act on a file outside mallow — open it in a detected editor, hand it to the OS default app, reveal it in Finder / Explorer / the file manager — is reached from the toolbar's Open menu (`OpenWith`), and only for the file already selected. A reader working in the explorer has to select a row first and then travel to the toolbar, and there is no way at all to copy a file's path. This task adds a context menu on the explorer's rows.

The menu carries:
- **Open** with a submenu holding exactly what `OpenWith` offers today: one entry per detected editor, the OS default app, and Reveal in Finder / Explorer / the file manager. It is the same list built from the same `detectEditors` answer, not a second list that can drift from the toolbar's.
- **Copy path** — the absolute path, as the tree holds it.
- **Copy relative path** — the path relative to the folder the window has open, separated the way the platform separates paths.

The row the menu acts on is the row it was opened on, not the selected file; opening the menu does not change the selection or open the file.

To settle at the start:
- Native popup (`Menu.popup()` from `@tauri-apps/api/menu`, which needs `core:menu:default` checked against `core:default`) or a DOM menu built on `useMenu`. The native one gives each platform's own look and submenu behaviour; the DOM one follows snz-design doc-9 §6.11 and stays inside the app's palette. Whichever is chosen, the menu labels follow the app's ja / en, unlike the native menu bar's English-only labels.
- What a directory row offers: both copy entries apply as they are; Reveal applies; whether an editor entry is offered depends on whether `open_in_editor` hands a folder to every detected editor correctly, which has to be read in `editors.rs` rather than assumed.
- Whether the toolbar's Open menu gains the two copy entries too, so the selected file can be copied without the explorer.

The menu is reachable from the keyboard on a focused row (the ContextMenu key and Shift+F10), and Escape returns the focus to that row. The WebView's own context menu does not appear over a row.

Out of scope: a context menu inside the viewers, and file operations (rename, delete, new file).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Right-clicking a row in the explorer opens a menu with the Open entries, Copy path and Copy relative path, acting on that row, without changing the selection
- [x] #2 The menu's Open entries are the same editors, default-app entry and reveal entry the toolbar's Open menu lists, from the same detectEditors answer
- [x] #3 Copy path puts the absolute path on the clipboard; Copy relative path puts the path relative to the window's open folder, using the platform's separator
- [x] #4 The menu opens from the keyboard on a focused row (ContextMenu key, Shift+F10), and Escape returns the focus to the row
- [x] #5 Every label reaches the reader in both ja and en
- [ ] #6 What a directory row offers is settled and written down in the task, and each entry it shows works
- [x] #7 pnpm lint, pnpm build and pnpm test pass, and any new pure logic (the relative path) is unit-tested
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の判定 (2026-11-12、オーナー判断):
- DOM のメニュー (useMenu の系統) を採り、サブメニューは置かない。Open の項目・区切り線・コピー2項目を1つの並びに置く。snz-design doc-9 §6.11 にサブメニューの仕様が無く、ネイティブの Menu.popup() はクリップボードへの書き込みが利用者の操作の中で起きない (WKWebView の navigator.clipboard の要件) 恐れがあるため。AC#1・#2 の「Open (a submenu)」を「the Open entries」へ改めた。
- フォルダの行は Reveal・Copy path・Copy relative path だけを出す。open_in_editor はファイルとフォルダを区別せずパスを渡すだけで、フォルダを受け取れるかはエディタ次第 (VS Code・Zed は可、CotEditor・mi・サクラエディタは未確認、Notepad++ は中のファイルを全部開く)。既定のアプリはフォルダではファイルマネージャを開くだけで Reveal と重なる。
- ツールバーの Open メニューにもコピー2項目を足す。doc-9 §6.11 が「右押下だけで開くメニューに、そこにしか無い項目を置かない」とするため。

1. lib/path に relativePath(root, path) を足し単体テストする (区切りは入力のもの = Rust が返す OS のもの)
2. detectEditors の答えをモジュールで1つ持つ hook (useEditors) を作り、両メニューが同じ答えを読む
3. useMenu から開いた本体の振る舞い (焦点の移し方・矢印・Escape・Tab・外側の押下) を切り出し、トリガー型とコンテキスト型で共有する
4. 項目の並び (FileActionItems) を1つの部品にし、OpenWith とコンテキストメニューが同じものを描く
5. Explorer の行に contextmenu と ContextMenu キー / Shift+F10 を足す。本体は body へ portal し position: fixed、画面の端では反対側へ出す (位置の計算は純関数でテスト)。背後がスクロールしたら閉じる
6. i18n の ja / en にコピー2項目とメニューの語を足す
7. pnpm lint / build / test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の判定は Implementation Plan の冒頭に記録した (DOM のフラットなメニュー、フォルダ行は表示とコピー 2 つ、ツールバーの Open メニューにもコピー 2 つ)。

フォルダの行が出すもの (AC#6): 「Finder / エクスプローラ / ファイルマネージャで表示」「パスをコピー」「相対パスをコピー」の 3 つ。エディタと既定のアプリは出さない。editors.rs の open_in_editor はファイルかフォルダかを見ずにパスをそのままエディタへ渡すので、フォルダを受けられるかはエディタ次第になる (VS Code・Zed は可、CotEditor・mi・サクラエディタは未確認、Notepad++ は中のファイルをすべて開く)。既定のアプリはフォルダだとファイルマネージャを開くだけで、表示と重なる。

実装の要点:
- メニューの項目は FileActionItems という 1 つの部品にまとめ、OpenWith とコンテキストメニューの両方がこれを描く。エディタの一覧は useEditors がウィンドウにつき 1 回だけ問い合わせて共有する (AC#2)。
- useMenu を useMenuBody (開いた本体の焦点・矢印・Escape・Tab・外側の押下) とトリガー部分に分け、useContextMenu も useMenuBody の上に作った。キーボードの扱いが 2 か所に分かれないようにするため。
- 本体は body へ portal し position: fixed にした。エクスプローラのスクロール領域で切れないようにするため。位置は lib/context-menu の contextMenuPlacement (純関数) が決め、画面の端では反対側へ開く。背後のスクロールかリサイズで閉じる (doc-9 §5.3 の「閉じる」の側)。
- ツールバーと同じ理由で .menu__popup--context に will-change: transform を置いた。.doc__bar との重なり順は実機で見ていない。
- macOS の Ctrl+クリックはコンテキストメニューを開く操作なので、行の onClick では無視する。そうしないと選択が変わる。
- コピーはメニュー項目のクリックの中で navigator.clipboard.writeText を呼ぶ。利用者の操作の中で書き込むためで、ネイティブのポップアップを採らなかった理由の 1 つでもある。

確かめたこと (2026-11-12):
- pnpm lint / pnpm build / pnpm test が通る (45 files, 580 tests)。relativePath (POSIX・Windows・UNC・ルート直下・範囲外) と contextMenuPlacement・isContextMenuKey に単体テストを足した (AC#7)。
- _sandbox/task-50/ の検証ページで Explorer を Tauri をモックして内蔵ブラウザ (Chromium) に載せた。確認した内容: 右クリックで「README.md の操作」が開き、項目は VS Code / Zed / 既定のアプリ / Finder で表示 / パスをコピー / 相対パスをコピー。選択は変わらない (AC#1)。Shift+F10 と ContextMenu キーで開き、Escape で焦点が行へ戻る。項目を選んだ後も行へ戻る (AC#4)。intro.md で相対パスのコピーが "guide/intro.md"、フォルダでパスのコピーが "/Users/me/docs/guide" をクリップボードへ渡した (AC#3)。フォルダ行は 3 項目で、右クリックしても開閉しない。表示は reveal_in_os をフォルダのパスで呼んだ。ja では「README.md の操作」「VS Code で開く」…「相対パスをコピー」と出る (AC#5)。画面の下端と右端では反対側に開く。Ctrl+クリックではメニューが開き、選択は変わらない。detect_editors は 1 回しか呼ばれない。

実機 (WKWebView / WebView2 / WebKitGTK) では見ていないので、オーナーに確かめてほしいこと:
- AC#6 は未チェック。フォルダ行の「表示」が実際に Finder / エクスプローラ / ファイルマネージャでそのフォルダを表示するか。macOS は open -R、Windows は explorer /select、Linux は親フォルダを開く。
- WKWebView でクリップボードへ書き込めるか。コードブロックのコピーと同じ API を同じくクリックの中で使っている。
- WebView 自身のコンテキストメニューが行の上に出ないこと、Shift+F10 で WebView のメニューが重ならないこと。
- Windows で相対パスの区切りが \ になること (単体テストでは確かめた)。
<!-- SECTION:NOTES:END -->
