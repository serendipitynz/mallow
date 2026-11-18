---
id: TASK-67
title: Move the decisions left in src/hooks into pure src/lib functions with tests
status: Done
assignee: []
created_date: '2026-11-17 23:22'
updated_date: '2026-11-18 21:55'
labels:
  - chore
dependencies: []
references:
  - TASK-66
  - src/hooks/useUpdater.ts
  - src/hooks/useFileTree.ts
  - src/hooks/useMenu.ts
  - src/lib/update-flow.ts
  - src/lib/tree-nav.ts
  - src/lib/menu-nav.ts
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/hooks` has no tests and 0% coverage (measured 2026-11-18). The suite runs under Node with no DOM by design, so a hook cannot be tested directly without jsdom and a React renderer. Most hooks already hand their decisions to pure functions in `src/lib`, which are tested: `readsOnOpen`, `menuKeyTarget`, `contextMenuPlacement`, `advanceDownload` / `updateNotes`, `restoreScrollAnchor`. Three decisions are still written inside a hook. This task moves them into `src/lib` the same way, as pure functions with unit tests. TASK-66's mutation testing over `src/lib/**` then reaches them with no scope of its own.

**1. The update check in `useUpdater`** (`checkForUpdate` and `confirmInstall`). This is the one that matters most. Its rules live in refs and nested branches, and the comments beside them record how each one was got wrong. The rules the tests pin:
- While a check is running, a second check starts nothing. A manual press during a launch check promotes that check to manual, and shows it as checking.
- Outcomes by trigger:
  - No update: manual reports up to date, launch reports nothing.
  - An update: the check line goes back to idle, and the dialog offers the update.
  - A failure: manual reports it failed, launch reports nothing.
- Starting a check drops an offer the reader has not acted on, whatever the check then returns. Otherwise `available` outlives the handle a confirmation would act on.
- A confirmation does nothing without a pending handle, or while a check or an install is running.
- A failure after consent is reported as not installed. A relaunch failure after a successful install is reported as installed, never as failed.

The hook keeps the Tauri calls, the `Update` handle and its closing. A pure function holds the state the refs hold now and returns the next state. `advanceDownload` in `lib/update-flow` is the shape to copy, and that module is the natural home.

**2. Two choices in `useFileTree`.** `expandPaths` opens shorter paths first, so a parent is expanded before its children. `refresh` re-reads only the expanded folders whose children were already loaded. `lib/tree-nav` already holds `readsOnOpen`, which makes the same kind of choice.

**3. Where `useMenuBody` puts the focus on open.** `first`, `last`, or `current`; `current` is the item marked `aria-checked`, and falls back to the first item when none is marked. With no items, the focus goes to the popup itself. It goes beside `menuKeyTarget` in `lib/menu-nav`.

**Behaviour is unchanged.** This is a move, so no rule above changes on the way. A rule found to be wrong while it is pinned is recorded and raised with the owner, not fixed in passing.

**Out of scope.**
- Testing hooks themselves (jsdom, `@testing-library/react`).
- `useExitFade`, whose few lines are React state.
- The hooks that only wire events, lifecycles and the DOM: `useWindowEvent`, `useEditors`, `useOutlineFocusReturn`, `useViewMemory`, `useContextMenu`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The update check's rules are in a pure function in src/lib, and unit tests cover each rule in the description: the manual press during a launch check, the outcome per trigger, the superseded offer dropped at check start, a confirmation's preconditions, and a relaunch failure reported as installed
- [x] #2 useFileTree's expand order and its refresh selection are pure functions in src/lib with unit tests
- [x] #3 useMenuBody's focus target on open is a pure function in src/lib with unit tests, covering no checked item and an empty list
- [x] #4 The three hooks call those functions and keep only their Tauri, React and DOM wiring, with no rule changed on the way
- [x] #5 Checked in pnpm tauri dev: expanding and refreshing the explorer after a file change, opening each toolbar menu from the keyboard, and Check for Updates from Settings
- [x] #6 AGENTS.md and AGENTS.ja.md describe the lib modules whose role widened
- [x] #7 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/update-flow: CheckTrigger と UpdaterActivity(idle / checking+trigger / installing)を移し、requestCheck(開始・昇格・offer の破棄)、reportCheck(trigger ごとの結果)、canConfirmInstall、reportInstall(同意後の失敗 / 再起動失敗)を純粋関数にする。useUpdater は ref に activity を 1 つ持ち、Tauri 呼び出しと Update ハンドルだけを残す。
2. lib/tree-nav: expandOrder(短いパスから)と refreshTargets(展開済みかつ読み込み済み)。useFileTree から呼ぶ。
3. lib/menu-nav: OpenFocus 型と openFocusIndex(first / last / current、checked が無ければ先頭、項目なしは null)。useMenuBody は null のときポップアップにフォーカスする。
4. 各関数にユニットテスト。pnpm mutation --include で 3 モジュールを回して新しいテストがルールを押さえているか確認。
5. AGENTS.md / AGENTS.ja.md の lib 説明を更新。pnpm tauri dev で AC #5 の手動確認。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 移したもの

- **更新確認**(`lib/update-flow`): `CheckTrigger` と `UpdaterActivity`(idle / checking + trigger / installing)をフックから移した。`useUpdater` の 2 つの ref(`inFlight` と `runningTrigger`)は 1 つの `activity` にまとめた。この 2 つは「確認中」「導入中」「何もしていない」の 3 状態しか取らず、`runningTrigger` が非 null なのは確認中だけなので、まとめても表せる状態は変わらない。
  - `requestCheck(activity, trigger)`: 開始するか、昇格するか、何もしないか。開始時は `dropOffer: true` で、表示中の offer とハンドルを捨てる。
  - `reportCheck(activity, result)`: 終了時の activity から trigger を読む(途中で昇格した確認を手動として報告するため)。
  - `canConfirmInstall(activity, hasOffer)`、`reportInstall(target, result)`。
  - フックに残したのは `check()` / `downloadAndInstall()` / `relaunch()` の呼び出し、`Update` ハンドル、その `close()` だけ。理由を書いたコメントは lib 側へ移し、フックには重複させていない。
- **ファイルツリー**(`lib/tree-nav`): `expandOrder`(短いパスから。元の配列は変えない)、`refreshTargets`(展開済みかつ子を読み込み済み)。`expandPaths` の「子が未読なら読む」判定は、await のたびに ref を読み直すループの中にあるため、フックに残した。
- **メニュー**(`lib/menu-nav`): `OpenFocus` 型と `openFocusIndex(focus, checked)`。項目なしは null で、フックはポップアップにフォーカスする。`OpenFocus` は lib から import するようにし、`useContextMenu` の import 元も変えた。

## 振る舞いを変えていないことの確認

元のコードと分岐を 1 つずつ突き合わせた。差分は 1 か所: 確認で更新が無かったとき、元は `pending` を触らず、新しいコードは `pending.current = null` を代入する。確認の開始時に `dropOffer` で必ず null にしてあり、確認中に offer が作られる経路も無いので、null に null を入れるだけになる。ルールの誤りは見つからなかった。

## テストと mutation

- 新規テスト 20 件(update-flow 12、tree-nav 4、menu-nav 4)。`pnpm test` は 732 件すべて通る。
- `pnpm mutation --include` で 3 モジュールを実行(6.8 秒): mutant 343 件、実行 158 件、Killed 152・Timeout 1・Survived 5、スコア 96.8%。**新しく足した関数の mutant はすべて Killed**。生き残った 5 件は既存の関数(`visibleRows`・`tabStopPath`・`isShownUnder`・`menuKeyTarget`)のもので、このタスクでは触っていない。
- `--include` で範囲を絞ると、範囲外の `mutator.accepted.json` のエントリ(TASK-66 の find / delimited の 17 件)が「mutant がもう存在しないので削除せよ」と表示される。誤検知なので消していない。

## 手動確認(AC #5)

`pnpm tauri dev` でオーナーが確認した(2026-11-19): エクスプローラでフォルダを展開し、ファイルを変更して再読み込みされること、ツールバーの各メニューをキーボードで開くこと(↓ で先頭または選択中の値、↑ で末尾)、設定から更新を確認すること。
<!-- SECTION:NOTES:END -->
