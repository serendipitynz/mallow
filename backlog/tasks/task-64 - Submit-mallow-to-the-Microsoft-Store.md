---
id: TASK-64
title: Submit mallow to the Microsoft Store
status: In Progress
assignee: []
created_date: '2026-11-17 19:38'
updated_date: '2026-11-26 09:51'
labels:
  - feature
dependencies:
  - TASK-58
references:
  - >-
    backlog/tasks/task-58 -
    Build-a-prototype-MSIX-of-mallow-for-the-Microsoft-Store-and-measure-it-on-Windows.md
  - scripts/msix-build.ps1
  - src-tauri/windows/msix/AppxManifest.xml
  - >-
    https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/create-app-submission
  - 'https://v2.tauri.app/distribute/microsoft-store/'
priority: medium
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-58 built a prototype MSIX of mallow's Store variant and measured it on Windows, under a placeholder identity (`mallow.prototype`, `CN=mallow-prototype`) and a self-signed certificate. Submitting it was out of scope there. This task takes mallow from that prototype to a listing in the Microsoft Store, so that a Windows reader can install it with no SmartScreen warning and receive updates through the Store.

**The release workflow builds no MSIX.** `release.yml` produces the NSIS and MSI bundles only, so the package for a given release is built by hand on a Windows machine with `scripts/msix-build.ps1`, from that release's tag. v0.15.0 is the first candidate.

**The identity comes from Partner Center, and reserving it is the owner's.** Reserving the app name issues the `Package/Identity/Name`, the `Publisher` (`CN=…`) and the `PublisherDisplayName` the Store will accept; the script takes them as `-IdentityName`, `-Publisher` and `-PublisherDisplayName`. Where those values live afterwards (the script's defaults, or arguments given each time) is to be decided. The Store re-signs the package it accepts, so a code-signing certificate of mallow's own is not expected to be needed; that is read from third-party guides rather than from Microsoft's documentation, and is checked on the first upload.

**The submission carries what the package does not**: pricing and availability, category, a privacy policy URL, the IARC age-rating questionnaire, the store listing (description and at least one screenshot), and a justification for `runFullTrust`. That restricted capability cannot be dropped, because mallow is a Win32 app in a package. Reports exist of individual accounts being refused submissions that use it, and of a submission staying Incomplete after the justification was given, with Partner Center support as the only way forward; this task records what happens to mallow's.

**What TASK-58 left unmeasured, and has to be settled before a reader meets it:**
- The Store build and the GitHub build share the identifier `net.serenebach.mallow`, so they share settings (measured) and possibly the single-instance check (not measured). Whether a reader with both installed gets one forwarded to the other is the question.
- TASK-63's fix (the menu acting on the window in front from launch) has not been tried inside a package.
- Launching from the package's Start menu entry, and whether uninstalling the package removes its `LocalCache` data.

Out of scope: building the MSIX in CI (a separate task once the Store route is settled), the `mallow` command inside the package (`uap5:AppExecutionAlias`), ARM64 Windows, and code signing of the NSIS / MSI bundles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The app name is reserved in Partner Center, the identity it issued (Name, Publisher, PublisherDisplayName) is recorded in the task, and where those values live in the repository is decided
- [x] #2 Inside an MSIX built with that identity, TASK-63's fix, a launch from the Start menu entry, both builds installed side by side (single-instance forwarding and settings) and what an uninstall leaves behind are measured and recorded
- [ ] #3 A package built from a release tag passes the Windows App Certification Kit, and the steps that built and checked it are recorded
- [x] #4 The submission's listing, category, privacy policy URL, age rating and runFullTrust justification are written, and their text is recorded in the task
- [ ] #5 The submission passes certification and mallow installs from the Microsoft Store, or the refusal and its stated reason are recorded
- [ ] #6 README tells Windows readers about the Store route and how it differs from the GitHub bundles: updates through the Store, no mallow command, and where settings live
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 着手時の判断 (オーナー確認、2026-11-26): identity は scripts/msix-build.ps1 の既定値に置く。プライバシーポリシーはリポジトリの PRIVACY.md / PRIVACY.ja.md とし、github.com の URL を掲載ページに書く。最初の申請は、この変更を含む次のリリース (v0.16.0 のタグのスクリプトは仮の identity のまま)。価格は無料、提供は全市場、カテゴリは開発者ツール、掲載は日英。PR は 2 本に分け、README (AC #6) は Store に掲載されてから別の PR にする。
2. msix-build.ps1: 既定値を Partner Center が発行した identity に置き換える。HEAD が tauri.conf.json の版数の v タグを指していて作業ツリーがクリーンでなければ止める。計測用のビルドは -AllowUntagged で通す。ヘルプの自己署名証明書の手順は発行された CN で書き直す。マニフェストのコメントから「仮の identity」の記述を外す。
3. PRIVACY.md / PRIVACY.ja.md: 収集するデータはないこと。ネットワークに出るのは文書が指すリモート画像 (CSP の img-src) と、GitHub 版の更新確認だけであること (Store 版には更新確認がない)。設定は端末の中にだけ保存されること。
4. 掲載文、カテゴリ、プライバシーポリシーの URL、年齢区分の回答案、runFullTrust の理由をタスクのノートに書く (AC #4)。
5. AGENTS.md / AGENTS.ja.md のコマンド一覧の説明を更新する。
6. AC #2 / #3 / #5 の Windows での計測と申請はオーナーの作業。手順と計測項目をノートに書いて渡す。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (オーナー確認、2026-11-26)

- identity は `scripts/msix-build.ps1` の既定値に置く。秘密情報ではなく (インストールしたパッケージのマニフェストに載る)、どのビルドもそのまま申請に使える。手元に入れるときは同じ CN の自己署名証明書で署名する。
- プライバシーポリシーはリポジトリの `PRIVACY.md` / `PRIVACY.ja.md`。最初の申請は、この変更を含む次のリリース。タスク本文の v0.15.0 も、その後に出た v0.16.0 も、タグのスクリプトが仮の identity を既定値に持ち、タグの確認もしないため (PR #147 の 1 回目のレビュー)。v0.16.0 に引数で identity を渡す案は、タグの確認がないまま作ることになるので取らない。
- PR は 2 本に分ける。1 本目は identity、タグの確認、ポリシー、AGENTS のコマンド一覧。README (AC #6) は Store に掲載されてから 2 本目で書く。掲載前の README に Store のリンクは書けないため。

## Partner Center の identity (AC #1、2026-11-26)

「MSIX または PWA アプリ」(一覧に同じ名前が二つあり、もう一方はゲーム用) で「mallow」を予約した。製品 ID ページが発行した値:

| 項目 | 値 |
|---|---|
| Package/Identity/Name | `SerendpityNZ-SimpleBoxes.mallow` |
| Package/Identity/Publisher | `CN=489A8945-B788-471B-A41E-79B040EEF003` |
| Package/Properties/PublisherDisplayName | `SerendipityNZ - SimpleBoxes` |
| Package Family Name | `SerendpityNZ-SimpleBoxes.mallow_amkd9pgwdnzqg` |
| Store ID / URL | `9MZ73QHVHCWD` / https://apps.microsoft.com/detail/9MZ73QHVHCWD |

- `SerendpityNZ` は Serendipity の i が抜けた綴りで、アカウント作成時のもの。オーナーがアカウント設定の発行者の表示名を直した (2026-11-26)。直後は製品 ID ページの値が変わらなかったが、同日のうちに PublisherDisplayName だけが `SerendipityNZ - SimpleBoxes` に変わった。Name と PFN は `SerendpityNZ` のまま。発行された値をそのまま既定値にしている。アップロード時の検証が別の PublisherDisplayName を求めたら、それに合わせる。
- 置き場所: `msix-build.ps1` の `-IdentityName` / `-Publisher` / `-PublisherDisplayName` の既定値。マニフェストのコメントから仮の identity の記述を外した。

## スクリプトの変更

- 既定では、HEAD が `tauri.conf.json` の版数の `vX.Y.Z` タグを指し、作業ツリーがクリーン (未追跡ファイルを含む) でなければ、ビルドの前に止まる。パッケージはどのコミットから作ったかを記録しないため、ここで確定させる。AC #2 の計測用に、ブランチから作る `-AllowUntagged` を設けた (アップロードには使わない)。
- PowerShell は手元 (macOS) にないため、スクリプトの実行は未確認。最初の Windows での実行が確認になる。

## 申請の文面 (AC #4)

- 価格: 無料。提供: 全市場、公開。カテゴリ: 開発者ツール (Developer tools)。
- プライバシーポリシーの URL: https://github.com/serendipitynz/mallow/blob/main/PRIVACY.md (日本語版は PRIVACY.ja.md。どちらも PR がマージされてから有効)
- サポートの連絡先: https://github.com/serendipitynz/mallow/issues 、Web サイト: https://github.com/serendipitynz/mallow
- 説明 (en):

  > mallow is a lightweight viewer for Markdown and configuration files. Open a folder, pick a file from the tree, and read it: Markdown with GitHub-equivalent rendering — tables, task lists, alerts, syntax-highlighted code and mermaid diagrams — and JSON, YAML and TOML as a collapsible tree. HTML documents are rendered in a sandboxed frame that runs none of their script, and images, PDFs and videos are shown too. Marp slide decks can be presented, with a laser pointer. Files are reloaded as they change on disk, so mallow sits beside your editor. mallow collects no data.

- 説明 (ja):

  > mallow は Markdown と設定ファイルのための軽量なビューアです。フォルダを開き、ツリーからファイルを選ぶだけで読めます。Markdown は GitHub と同等の表示 (表、タスクリスト、アラート、シンタックスハイライト、mermaid の図) で、JSON・YAML・TOML は折りたためるツリーで表示します。HTML 文書はスクリプトを一切実行しないサンドボックスの中で表示し、画像・PDF・動画も開けます。Marp のスライドはレーザーポインター付きで発表できます。ディスク上のファイルが変わると自動で読み直すので、エディタの横に置いて使えます。mallow はデータを一切収集しません。

- 機能 (en / ja、各 7 項目):
  1. GitHub-flavored Markdown with syntax highlighting and mermaid diagrams / GitHub 互換の Markdown 表示 (シンタックスハイライト、mermaid の図)
  2. JSON, YAML and TOML as a collapsible tree / JSON・YAML・TOML を折りたためるツリーで表示
  3. CSV / TSV tables and XML trees / CSV・TSV の表と XML のツリー
  4. HTML rendered in a sandbox that runs no script / HTML はスクリプトを実行しないサンドボックスで表示
  5. Marp slide decks, presented with a laser pointer / Marp のスライドをレーザーポインター付きで発表
  6. Live reload as files change / ファイルの変更を自動で反映
  7. Find, outline, print and PDF export / 検索、アウトライン、印刷と PDF 書き出し
- 検索語 (最大 7): Markdown, viewer, YAML, JSON, TOML, mermaid, Marp
- スクリーンショット: 1 枚以上必須。`docs/assets/tour.webp` は動画なので使えない。オーナーが Windows で撮る (1366×768 以上の PNG)。
- 年齢区分 (IARC の回答案): アプリの種類は「ゲームではない」。暴力・性的表現・薬物・ギャンブル・不適切な言葉はすべて「いいえ」。利用者同士のやり取りやコンテンツ共有、位置情報の共有、アプリ内購入はすべて「いいえ」。「制限のないインターネットアクセス (Web ブラウザなど)」も「いいえ」。mallow はブラウザではなく、ネットワークに出るのは開いた文書が参照する画像と、利用者が選んだリンクを既定のブラウザに渡す場合だけ。見込みは IARC 3+ / 全年齢。
- runFullTrust の理由 (en。申請画面の欄は英語で書く):

  > mallow is a desktop Win32 application (Tauri / WebView2) packaged with the Desktop Bridge, and runFullTrust is what lets it run as one. It is a viewer for a folder of documents the user chooses: it lists and reads files anywhere on disk with ordinary file APIs, watches the folder so that edits made in another application appear at once, and opens a file in the user's own editor or reveals it in File Explorer by starting those programs. None of this fits inside an AppContainer without asking for a file location the user has not chosen yet. mallow collects no data and makes no network request of its own; the Store build has no self-updater.

## Windows での作業 (オーナー、AC #2 / #3 / #5)

**AC #2 の計測** (main の最新から `.\scripts\msix-build.ps1 -AllowUntagged -Thumbprint <拇印>`。証明書はスクリプト冒頭のヘルプにある手順で、新しい CN で作り直す。先に TASK-58 の試作は `Get-AppxPackage mallow.prototype | Remove-AppxPackage` で外す):
1. TASK-63: 起動直後のウィンドウ 1 枚のまま、メニューから Settings… / Open… / Print… / Export as PDF… / Toggle Explorer / Back / Forward / Find… / Close Window が動くか。markdown のプレビューで、ウィンドウを切り替えずに Print… と Export as PDF… が有効になるか。
2. スタートメニュー: アプリ一覧の mallow から起動できるか。
3. 両方の版を同時に入れた場合 (GitHub の NSIS v0.16.0 とパッケージ): 片方を起動した状態でもう片方を起動し、新しいプロセスが立つか、起動中の版へ転送されるか。設定画面の更新欄 (GitHub 版は自動確認の切り替え、Store 版は「Updates arrive through the Microsoft Store.」) で、どちらの版のウィンドウかが分かる。順序を逆にしてもう一度。設定をどちらの場所から読んでいるか (`%APPDATA%\net.serenebach.mallow` と `%LOCALAPPDATA%\Packages\SerendpityNZ-SimpleBoxes.mallow_<hash>\LocalCache`)。
4. アンインストール: `Get-AppxPackage SerendpityNZ-SimpleBoxes.mallow | Remove-AppxPackage` の後に、`%LOCALAPPDATA%\Packages\<PFN>` と `%APPDATA%\net.serenebach.mallow` が残るか。

**AC #3** (この変更を含む最初のリリースタグ `vX.Y.Z` から):
1. `git checkout vX.Y.Z` の後に `.\scripts\msix-build.ps1 -Thumbprint <拇印>` を実行する。WACK はパッケージをインストールして調べるので、署名が要るはず (未確認)。
2. `& "${env:ProgramFiles(x86)}\Windows Kits\10\App Certification Kit\appcert.exe" test -appxpackagepath <msix> -reportoutputpath wack.xml`。GUI の Windows App Cert Kit でもよい。結果と、失敗した項目があればその内容を記録する。

**AC #5**: 申請の開始 → 上の文面を入力 → パッケージをアップロードする。署名付きのパッケージが受け付けられるか、署名なしで作り直す必要があるかも記録する。

## PR

- 1 本目: PR#147 (identity の既定値、スクリプトのタグ確認、プライバシーポリシー)。2026-11-26 マージ。
- 追加の修正: PublisherDisplayName の既定値を、製品 ID ページの更新後の値に合わせる。PR#147 のマージ後に値の変化が分かったため。README の PR (AC #6) は予定どおり掲載後に出す。

## AC #2 の計測結果 (Windows、2026-11-26)

Windows 11 Home 25H2 (10.0.26200)。パッケージは main の `e8e4f0d` から `-AllowUntagged` で作った `0.16.0.0`、GitHub 版は NSIS の `0.16.0` (per-user、`%LOCALAPPDATA%\mallow`)。計測は Windows の Claude Code (指示書 `_sandbox/handoff/task-64/windows-measure.md`、報告 `windows-report.md` と生ログ・スクリーンショット)。メニュー操作とスタートメニューのクリックはオーナーの手作業。

- スクリプト: Windows で最初から最後まで動き、署名したパッケージが `Add-AppxPackage` で入った (「スクリプトの変更」の未確認を解消)。設定画面の更新欄は「Updates arrive through the Microsoft Store.」で、`MALLOW_STORE=1` のビルドが入っている。
- TASK-63: パッケージを起動したウィンドウ 1 枚のまま、Settings… / Open… / Print… / Export as PDF… / Toggle Explorer / Back / Forward / Find… / Close Window がすべて有効で動いた (オーナーの目視。スクリーンショットなし)。
- スタートメニュー: パッケージは起動する。ただし GitHub 版と並べて入れると、検索結果に同じ名前・同じアイコンの「mallow」が 2 つ並び、**どちらをクリックしてもパッケージ版が起動した**。GitHub 版は検索からは起動できず、デスクトップのショートカット (AUMID `net.serenebach.mallow`) と `shell:AppsFolder\net.serenebach.mallow` からは起動した。検索結果の 2 つがそれぞれ何に対応しているかは計測していない。
- 同時起動: 両方の順序で、2 つ目のビルドは起動から約 10〜15 ms で終了し、ウィンドウは増えず、1 つ目のビルドのウィンドウが前面に来た (8/8 回、オーナーの手作業でも同じ)。**2 つのビルドは同時に動かせない。** tauri-plugin-single-instance 2.5.5 は Windows のミューテックスとウィンドウの名前をアプリの identifier から作る (`src/platform_impl/windows.rs:81-90`、`{id}-sim` / `{id}-sic` / `{id}-siw`)。両ビルドとも identifier が `net.serenebach.mallow` なので、互いに転送し合う。両ビルドのウィンドウ一覧にこの名前のウィンドウがあることも観測した。
- 設定: **両ビルドが同じ設定を読み書きする。** パッケージも実際の `%APPDATA%\net.serenebach.mallow\settings.json` を読み (`explorerSide` と復元セッション)、終了時に書き込んだ。localStorage も実際の `%LOCALAPPDATA%\net.serenebach.mallow\EBWebView` に書き込んでいる。Light / Dark はパッケージで変えると GitHub 版に引き継がれた (オーナーの手作業)。パッケージの `Packages\<PFN>\LocalCache` には `settings.json` も `EBWebView` も一度も作られなかった。
- アンインストール: `Packages\<PFN>`、`WindowsApps` のインストール先、スタートメニューの項目は消えた。実際の `%APPDATA%` / `%LOCALAPPDATA%` にある mallow の設定は、前後で名前・サイズ・更新時刻・ハッシュとも変わらず、GitHub 版はその設定のまま起動した。

**未計測**: GitHub 版を入れたことのないマシンに Store 版だけを入れた場合。上の「実際の AppData を読み書きする」は、GitHub 版の設定フォルダがすでにある状態での結果。MSIX は、新しく作るファイルをパッケージ専用の場所 (`LocalCache`) へ振り替えて、既存のファイルはその場で変更させる。そのため、Store 版だけの環境では設定が `LocalCache` に作られ、アンインストールで消える可能性がある (推測)。README (AC #6) で「設定の場所」と「アンインストールで消えるもの」を書く前に、実際の設定フォルダ 2 つを一時的に別名にした状態で計測する。AC #3 でタグからのパッケージを入れるときに一緒に行う。

README (AC #6) に書くこと (計測から): 2 つのビルドは同時に動かず、設定を共有する。両方を入れるとスタートメニューの検索では Store 版しか起動しない。
<!-- SECTION:NOTES:END -->
