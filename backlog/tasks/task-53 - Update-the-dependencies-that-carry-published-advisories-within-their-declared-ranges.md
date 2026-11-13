---
id: TASK-53
title: >-
  Update the dependencies that carry published advisories, within their declared
  ranges
status: Done
assignee: []
created_date: '2026-11-13 05:08'
updated_date: '2026-11-13 08:50'
labels:
  - chore
dependencies: []
references:
  - package.json
  - pnpm-lock.yaml
  - src-tauri/Cargo.toml
  - src-tauri/Cargo.lock
  - scripts/gen-third-party-notices.mjs
priority: high
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A dependency scan on 2026-11-13 (`pnpm audit`, and Cargo.lock's 522 crates queried against OSV.dev, which carries RustSec) found 26 npm advisories (1 critical, 6 high, 13 moderate, 6 low; 14 of them in production dependencies) and 21 RustSec advisories across 18 crates. Most are fixed by versions inside the ranges `package.json` and `Cargo.toml` already declare, so this task takes those versions and records what remains.

What ships in the app and is fixed within range:
- **smol-toml** 1.7.0 → 1.9.1: a malformed TOML document can stall the parser (GHSA-7w5x-hrqm-74c2, high) and key parsing is quadratic (GHSA-r4xh-jqrq-34v2). mallow parses whatever TOML file the reader opens, so this is reachable from a document.
- **mermaid** 11.16.0 → ≥ 11.16.1 (11.17.2 is the latest 11.x): CSS injection onto the diagram's siblings, prototype pollution in architecture diagrams and in the configuration APIs, and infinite-loop / DoS in XY and radar charts. Reachable from any document carrying a diagram.
- **dompurify** (through mermaid) → 3.4.17: a SAFE_FOR_TEMPLATES bypass (critical) and several IN_PLACE detached-subtree issues. mermaid's own range `^3.3.3` admits 3.4.17. Whether mermaid calls DOMPurify in the affected modes has not been read.
- **rustls** 0.23.43 → 0.23.46, **rustls-webpki** 0.103.15 → 0.103.17, **webpki-root-certs** 1.0.9 → 1.0.12: handshake-boundary, downgrade and distrusted-intermediate issues. Reached through tauri-plugin-updater's HTTPS to GitHub; the payload is minisign-verified regardless, the channel is not.
- **tokio**, **rustix**, **event-listener**: unsound, fixed by `cargo update`.

Development-only and fixed within range: vite 7.3.6 → 7.3.8, vitest / @vitest/mocker → 4.1.12, browserslist → 4.29.5, source-map-js → 1.2.2, baseline-browser-mapping ≥ 2.11.0. None reaches the bundle; they affect `pnpm tauri dev` and the test run.

What this task cannot fix by updating, and has to record instead:
- **katex** (through mermaid, low, GHSA-238p-pmpm-9mq7): fixed in 0.18.2 while mermaid 11 pins `^0.16.45`. A pnpm override is possible; whether to take one is to be settled here.
- **quick-xml** 0.39.4 (through tauri → plist, two DoS advisories, fixed in 0.41.0): mallow's XmlView parses with the WebView's DOMParser, so a document does not reach this parser. Waits on tauri.
- **zip** 4.6.1 (through tauri-plugin-updater, Windows only, four extraction advisories, fixed in 9.0.0): the updater extracts only an archive whose signature has verified. Waits on the plugin.
- **Unmaintained**: glib 0.18 (also unsound, the GTK3 stack), unic-*, proc-macro-error, zbus_names, zvariant, zvariant_derive — all transitive through Tauri / GTK3.

Out of scope: major-version moves (mermaid 12, vite 8, vitest 5, @vitejs/plugin-react 5), and anything that schedules or automates the scan, which is TASK-54.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pnpm audit --prod reports no advisory that a version within package.json's ranges fixes
- [x] #2 pnpm audit (dev included) reports no advisory that a version within range fixes
- [x] #3 A RustSec scan of src-tauri/Cargo.lock reports no vulnerability that cargo update fixes (rustls, rustls-webpki, webpki-root-certs, tokio, rustix, event-listener)
- [x] #4 Whether katex is overridden past mermaid's range is settled, and the answer written in the task
- [x] #5 Every advisory left unfixed is listed in the task with its path, why it is not reachable or not fixable here, and what upstream release would clear it
- [x] #6 A mermaid diagram, a TOML file and a malformed TOML file still render or report as before in pnpm tauri dev
- [x] #7 pnpm lint, pnpm build, pnpm test, cargo fmt --check, cargo check and cargo test pass, and pnpm notices is regenerated if any bundled dependency's version changed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 更新したもの (2026-11-13)

npm (`pnpm update` で宣言範囲内。pnpm が package.json の下限も修正版へ引き上げた):
- mermaid 11.16.0 → 11.17.2、smol-toml 1.7.0 → 1.9.1 (本番依存)
- dompurify 3.4.11 → 3.4.17 (mermaid 経由、`--depth Infinity`)
- vite 7.3.6 → 7.3.7、vitest 4.1.9 → 4.1.12、sass 1.101.0 → 1.108.0、@vitejs/plugin-react の下限 ^4.7.0、browserslist / source-map-js / baseline-browser-mapping / @vitest/mocker (開発用)

Rust (`cargo update -p`、Cargo.toml は変更なし):
- rustls 0.23.43 → 0.23.46、rustls-webpki 0.103.15 → 0.103.17、webpki-root-certs 1.0.9 → 1.0.12、tokio 1.52.3 → 1.54.1、rustix 1.1.4 → 1.1.6、event-listener 5.4.1 → 5.4.2
- plist 1.9.0 → 1.10.3 (tauri 経由)。これで quick-xml 0.39.4 → 0.42.0 となり RUSTSEC-2026-0194 / 0195 も解消した。起票時は「tauri 待ち」と書いたが、plist の範囲内の更新で直せた

## 更新後のスキャン結果

- `pnpm audit`: 1 件 (low、katex、下記)。`--prod` も同じ 1 件
- Cargo.lock を OSV.dev に照会: 脆弱性は zip のみ。残りは unsound / unmaintained (下記)

## AC #4: katex は overrides で上げない

GHSA-238p-pmpm-9mq7 (low) は「別経路のプロトタイプ汚染が既にある」ことが前提で、それ単体では成立しない。mermaid 11 は katex を `^0.16.45` で宣言しており、0.18.2 への強制は mermaid が試していない組み合わせで数式ラベルの描画を壊しうる。low の前提付きの脆弱性に対して、図の描画を壊す危険のほうが大きいと判断した。mermaid が katex 0.18 系へ上げた時点で解消する。

## AC #5: 更新後も残るもの

| advisory | 経路 | 残す理由 | 解消する上流リリース |
|---|---|---|---|
| GHSA-238p-pmpm-9mq7 (katex, low) | mermaid → katex 0.16.x | AC #4 のとおり | katex ≥ 0.18.2 を許す mermaid |
| RUSTSEC-2026-0367 / 0368 / 0369 / 0429 (zip 4.6.1) | tauri-plugin-updater → zip (Windows のみ) | updater が展開するのは minisign 署名を検証したアーカイブだけなので、悪用には署名鍵が要る。zip ^9 を使う updater は 2.14 からで、2.13 以降は tauri ^2.12 を要求する。mallow は tauri 2.11.3 に据え置いている (tauri-plugin-single-instance を ~2.4 に固定している理由と同じ) ため、この範囲では上げられない | tauri 2.12 以上へ上げたうえで tauri-plugin-updater ≥ 2.14 |
| RUSTSEC-2024-0429 (glib 0.18.5, unsound) | GTK3 系 (tauri / wry / muda) | GTK3 バインディングは 0.18 で止まっており、0.20 は GTK4 系。Tauri が GTK3 を使う間は動かせない | Tauri の GTK4 移行 |
| RUSTSEC-2024-0370 (proc-macro-error, unmaintained) | glib-macros 0.18 (GTK3 系) | 同上 | 同上 |
| RUSTSEC-2025-0075 / 0080 / 0081 / 0098 / 0100 (unic-*, unmaintained) | tauri-utils → urlpattern 0.3 | 推移的依存で mallow から差し替えられない | urlpattern / tauri-utils の置き換え |
| RUSTSEC-2026-0370 / 0371 / 0372 (zvariant / zbus_names / zvariant_derive, unmaintained) | zbus 5.16 (tauri-plugin-opener と tauri-plugin-single-instance の Linux の D-Bus) | 推移的依存で mallow から差し替えられない。zvariant は zbus 6.0 の `wire` モジュールに統合された | 両プラグインの zbus 6 への移行 |

## 検証

- pnpm lint / pnpm build / pnpm test (53 ファイル 668 件): 通過
- cargo fmt --check / cargo check / cargo test (114 件): 通過
- pnpm notices を再生成した。差分の大半はライセンス本文の参照番号 (T1…) の振り直しで、版の行は上の更新分と、mermaid 11.17 が新たに引く fastdom / strictdom、plist が引く base64 0.23.1 の追加
- AC #6 のうち TOML の正常なパースと不正な TOML の行・列の報告は config-parse の単体テストで確認できている。mermaid の図の描画は WebView でしか見られないため、pnpm tauri dev での目視はオーナーの確認待ちとして未チェック

AC #6: 2026-11-13、オーナーが pnpm tauri dev で _sandbox/task-53 のサンプル (mermaid の 5 種の図、正しい TOML、4 行目で壊れた TOML) を確認した。

## 追記 (2026-11-13、Done の後): GitHub にしかない zip のアドバイザリ

Dependabot alerts を有効にした後、上の表の zip 行には載っていない GHSA が 2 件、アラートとして出た。RustSec に対応する項目がないので、TASK-53 のスキャン (OSV.dev の RUSTSEC) にも cargo audit にも出てこない。

| advisory | 内容 | 修正版 | 残す理由 |
|---|---|---|---|
| GHSA-m665-v7pm-7grj (critical) | ZipArchive と ZipStreamReader でヘッダの解釈が食い違い、展開時にファイルを上書きされる | zip 9.0.5 | 上の zip 行と同じ。加えて updater 2.10.1 のソースで経路を確かめた: zip を展開するのは Windows でダウンロードした更新が zip だった場合だけ (updater.rs:883-905) で、その前に minisign の署名を検証する (updater.rs:712)。mallow の latest.json が Windows に配るのは .msi と -setup.exe なので、この分岐自体を通らない |
| GHSA-8hxf-qr8p-62x4 (medium) | AES エントリの HMAC 認証が EOF で迂回される | zip 9.0.0 | 同上 |

GHSA-q7v9-x93c-xqv3 (high) は RUSTSEC-2026-0429 の別名で、表の zip 行に含まれている。Dependabot alerts の katex・glib・zip の 5 件は、2026-11-13 にオーナーの判断で tolerable risk として dismiss した。
<!-- SECTION:NOTES:END -->
