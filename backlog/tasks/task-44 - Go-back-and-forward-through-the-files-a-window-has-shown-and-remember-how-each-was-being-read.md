---
id: TASK-44
title: >-
  Go back and forward through the files a window has shown, and remember how
  each was being read
status: In Review
assignee: []
created_date: '2026-10-29 21:50'
updated_date: '2026-10-30 00:02'
labels:
  - feature
milestone: m-5
dependencies: []
references:
  - src/App.tsx
  - src/components/Viewer.tsx
  - src/lib/scroll.ts
  - src/lib/chord.ts
  - src-tauri/src/menu.rs
  - backlog/tasks/task-13 - Keep-several-documents-open-as-tabs-in-one-window.md
  - >-
    backlog/decisions/decision-4 -
    Tabs-carry-documents-inside-one-folder-windows-carry-side-by-side-comparison.md
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting a second file in the tree replaces the first, and everything about the first is lost: `App` holds one `selected`, `Viewer` remounts the body on `key={file.path}`, and each view keeps its view mode in local state (`MarkdownView`'s preview / source, `HtmlView`'s rendered / source, `TableView`, `ConfigView`, `XmlView`). Going back means finding the file in the tree again and then finding the place again.

TASK-13 answers this with tabs. This task answers the same complaint with less: a back / forward history per window, and a per-file memory of how the file was being read. It is meant as a trial before tabs are built — if the return trip stops hurting, the tab strip may not be needed; if the need to keep a working set of files open remains, tabs still go ahead, and the view-state memory here is the same machinery TASK-13.2 asks for, so nothing is thrown away.

Two terms, used in this task for these things:

- **visit history** — a window's ordered list of files it has shown, with a cursor on the one on screen. Back and forward move the cursor; opening a file by any other route drops everything after the cursor and appends the file. It belongs to the window's folder: changing the folder empties it, for the reason decision-4's rule 7 empties the tab set.
- **file view state** — what is remembered per file inside one window and restored when the file is shown again, by history or by the tree alike: the view mode its kind offers, and the scroll position as a `lib/scroll` anchor (`captureScrollAnchor` / `restoreScrollAnchor`), captured when the file is replaced on screen. Restoring by anchor rather than by `scrollTop` keeps it right after the file changed on disk in between.

Out of scope: following a link to a local `.md` file (the link stays inert; a later task can make it a history entry), restoring the history across a relaunch (the restored session keeps carrying only what is on screen), and tabs themselves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Showing a file from the tree, Open Recent or a location the OS handed over appends it to the window's visit history; showing the file already on screen, a live reload, and a move by back / forward append nothing
- [ ] #2 Back and forward are reachable from the keyboard (Cmd+[ / Cmd+] on macOS, Alt+Left / Alt+Right on Windows and Linux), from the mouse's back / forward buttons, and from menu items that are disabled when there is nowhere to go
- [x] #3 Each chord is consumed even where there is nowhere to go, so WebView2's own Alt+Left navigation never reaches the app shell
- [x] #4 Returning to a file by history or by the tree restores its view mode and scroll position, for every kind that offers a view switch
- [x] #5 A history entry whose file no longer exists is skipped rather than shown as an error
- [ ] #6 Changing the window's folder empties its visit history and its file view state; another window's history is untouched
- [x] #7 The history and the view-state memory are bounded, with the limits and the reason for them stated where they are defined
- [x] #8 The history logic is a pure module with unit tests; pnpm lint, pnpm build and pnpm test pass, and cargo check / cargo test pass if the menu changes
- [x] #9 README describes back / forward and the chords on each platform
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/lib/visit-history.ts: pure module — visit history (entries + cursor, capped), file view state memory (LRU, capped, never evicts a path the history still holds), an epoch bumped on folder change so a view leaving the previous folder cannot write into the new one, and an async travel() that skips entries whose file is gone. Unit tests beside it.
2. src/lib/history-nav.ts: chord / mouse-button classification (Cmd+[ / Cmd+] on macOS, Alt+Left / Alt+Right elsewhere, buttons 3 / 4) and the keydown / mouseup handlers, always consuming. Unit tests.
3. App: one showFile() for every route that shows a file (tree, mount-time location, handover) appending to the history; openLocation empties history + view state only when the folder actually changes; back / forward travel via pathExists; report can-go-back / can-go-forward to Rust.
4. Views: a shared hook captures {mode, anchor} at unmount (against the still-attached container) and a shared hook restores the remembered anchor while the content is still filling. MarkdownView, HtmlView, ConfigView, TableView, XmlView take the remembered mode; MermaidView and the plain source arm get the scroll half.
5. menu.rs: View > Back / Forward with per-platform accelerators, gated per window like Print / Export (report_history_moves), menu:back / menu:forward events. cargo test for the id map.
6. README: back / forward and the chords per platform.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 実装

- 純粋モジュール `src/lib/visit-history.ts`: 訪問履歴（entries + cursor）とファイル表示状態（path → { mode, anchor }）を 1 つの値 `Visits` に持つ。フォルダ変更で `epoch` を進め、両方を空にする。`travel` は存在しないファイルを飛ばし、履歴からも取り除く（次の押下でまた飛ばすのではなく、Back が効くかを履歴だけで決められるようにするため）。取り除いた結果、表示中のファイルと同じファイルが隣に来たらそれも消す。
- 上限（AC #7）: 履歴 `MAX_VISITS = 50`（Chromium の `kMaxSessionHistoryEntries` と同じ）、表示状態 `MAX_REMEMBERED_VIEWS = 100`。表示状態は最も昔に離れたものから捨てるが、履歴にまだ残っているパスは捨てない。履歴の異なるパスは最大 50 なので 100 なら必ず捨てられるものがあり、Back で届くファイルは必ず状態が残る。
- `src/lib/history-nav.ts`: macOS は `Cmd+[` / `Cmd+]`、Windows・Linux は `Alt+Left` / `Alt+Right`、マウスはボタン 3 / 4。chord は移動先がなくても常に preventDefault（AC #3）。ゲートを置かないのは、移動先がない移動は `travel` がそのまま何もしないため。マウスは mousedown / mouseup の両方を消費し、動くのは mouseup だけ。
- `src/hooks/useViewMemory.ts`: 離脱時の状態取得はレイアウトエフェクトの後始末で行う。React 19 のソース（`commitDeletionEffectsOnFiber`）で、関数コンポーネントのレイアウト後始末が配下のホスト要素の ref 解除・DOM 取り外しより先に走ることを確認した。`leave` はマウント時に受け取ったものを使う。フォルダ変更でアンマウントされたビューが新しいフォルダの記憶に書き込まないようにするため（新しいフォルダが古いフォルダを含む場合に実害が出る）。
- 復元は「マウント時に 1 回 + 内容が伸びるたびに 1.5 秒間」。ライブ更新側の「次フレームでもう 1 回」にしなかったのは、Shiki の着色と mermaid の描画が 1 フレーム以内に終わる保証がないため。wheel / pointerdown / touchstart / keydown で読み手が動かしたら止める（scroll イベントは復元自身の書き込みでも発火するので使えない）。
- `HtmlView` の描画モードは既存の収束ループ（`anchor` → `pendingRestore`）に覚えていたアンカーを渡すだけにし、共通の復元フックは使わない。ループの最中に横から復元すると収束途中で動くため。ソースモードは共通フック。
- `MarkdownView`: 初回レンダリングでは空のコンテナを測らない（比率 0 を測って、覚えていた位置を打ち消していた）。ソースモードでも復元するようになった。
- view の切り替えがある種別（markdown・html・json/yaml/toml・csv・xml、JSON の plist）はモードとスクロール、mermaid とテキスト系（text/ini/diff/sql）はスクロールだけを覚える。`default:` の枝は到達しないので対象外。
- App: 表示経路（ツリー・初期位置・OS からの受け渡し）は `showFile` を通り、そこで visit になる。フォルダが実際に変わるときだけ履歴を空にする（同じフォルダの 2 つ目のファイルを OS から渡された場合は visit として足すため）。Back / Forward は `pathExists` で確かめ、待っている間に履歴が動いた場合は結果を捨てる。
- メニュー: View → Back / Forward。ウィンドウごとのゲートを `report_history_moves` で受け、`apply_preview_gate` を `apply_focused_gates` に改名して 4 項目まとめて切り替える。

## 確認したこと

- `pnpm lint` / `pnpm build` / `pnpm test`（41 ファイル・517 件）が通った。新規テストは `visit-history.test.ts` と `history-nav.test.ts` の 26 件。
- `cargo fmt --check` / `cargo check` / `cargo test`（109 件）が通った。`MALLOW_UNATTENDED=1 cargo check` も警告なし。
- muda 0.19.3 のアクセラレータ解析が `[`・`]`・`Left`・`Right` を受け付けることをソースで確認した。

## 測っていないこと（オーナーの確認が要る）

- GUI 上の動作はどのプラットフォームでも見ていない。AC #1・#2・#4・#6 は実機で、AC #3 は Windows（WebView2 の Alt+Left が本当に止まるか）で確認が要る。
- サイドボタンが各 WebView でページに届くか（button 3 / 4）。
- Linux で GTK のアクセラレータとフロントエンドの keydown が両方動いて 2 歩戻らないか。Ctrl+N では 1 回だけ動いたという過去の観察（2026-09-12）に頼っている。
- 描画中の HTML フレームの中にフォーカスやポインタがあるときは、ウィンドウのリスナーに届かない。既存の chord 全部に共通の穴で、README に書いた。

## オーナーによる実機確認（2026-10-30）

- 履歴で戻ったとき・ツリーから開き直したときに表示モードとスクロール位置が戻る: OK（AC #4）
- View メニューの Back / Forward が移動先のないときに無効: OK
- Windows で Alt+Left が WebView2 の戻る操作に渡らない。移動先がないときの押下でも画面は変わらない: OK（AC #3）
- Linux で 1 回の押下で 2 つ戻らない: OK
- macOS でマウスのサイドボタン（Logitech MX Anywhere 3S）が効かなかった。Chrome では効く。

## サイドボタンの対応（macOS）

- フロントエンドの `mouseup`（button 3 / 4）のハンドラでは履歴が動かなかった。Chrome はネイティブのイベントを自分で処理しているので、ページに届いているかとは無関係。WKWebView が落としていると読むのが実測に合うが、そこを切り分けたわけではない。
- `src-tauri/src/side_buttons.rs`: `NSEvent` のローカルモニタで `buttonNumber` 3 / 4 の `otherMouseDown` / `otherMouseUp` を受け取り、両方を消費して、離したときにクリックされたウィンドウ（なければフォーカス中のウィンドウ）へ `history:go` を送る。消費するので、WebKit が将来ボタンをページに渡すようになっても 2 歩は動かない。
- `block2` を直接の本番依存に加えた（オーナー承認済み）。もともと objc2-app-kit 経由で依存グラフに入っていたので、新たにコンパイルされるクレートはなく、`pnpm notices` の差分もない。objc2-app-kit には feature `block2` を足した。
- 未確認: このネイティブ処理が実機で効くか（オーナーの再確認待ち）。Windows / Linux でサイドボタンがページに届くか。AC #1 のうち OS から渡されたファイルの追加と、AC #6 も未確認。
<!-- SECTION:NOTES:END -->
