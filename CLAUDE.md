# エアロバブル（aero-bubble）開発の決まり

同じ色の泡を指でなぞってつなぎ、はじけさせる、スマホ縦画面の60秒パズル。テーマはフルティガーエアロ（晴れた空・つややかな海・ガラスの泡）。仕様は docs/SPEC.md、企画は docs/PLAN.md、画面は docs/screens/。

## 構成

| 役割 | 使うもの |
|---|---|
| 土台 | Vite |
| 言語 | TypeScript（strict） |
| ルール本体 | src/core の Pure TypeScript。DOM・React・PixiJS・Zustand・localStorage・Math.random・Date.now を使わない |
| 数値と内容 | src/data の JSON＋Zod（balance.json・creatures.json。型は Zod のスキーマから作る） |
| 描画 | PixiJS（src/world）。景色（sea.ts）と盤面（board.ts）。絵は Canvas2D で描いてテクスチャにする（src/world/art） |
| 画面の部品 | React＋HTML/CSS（src/ui） |
| 橋渡し | Zustand（src/store）。画面に見せる写しだけを持つ |
| セーブ | src/save の SaveStore（localStorage。版番号つき） |
| テスト | Vitest（tests/）、Playwright（e2e/、390×844） |
| 公開 | GitHub Actions → GitHub Pages（https://109mei.github.io/aero-bubble/。Vite の base は '/aero-bubble/'） |

入れていないもの：vite-plugin-pwa、Dexie、Web Worker、音のファイル（音は src/ui/audio.ts がその場で作る）。

## 設計の決まり（必ず守る）

1. ゲームの状態の持ち主は src/core だけ。書き換えは命令（startRound・press・enter・release・cancelTouch・step）を core に渡して行う。React・Zustand・PixiJS は状態を読んで描くだけ
2. 乱数は種つきの疑似乱数（RoundState.rng）だけ。同じ種・同じ命令なら同じ結果にする（tests/determinism.test.ts）。乱数を引く順番を変えると、過去の種の結果がすべて変わる
3. ルール本体は 0.05 秒の刻みで進める。パズルなので、閉じていた間は進めない（画面が隠れたら一時停止して保存）
4. 更新の頻度を分ける：PixiJS は毎フレーム、React の数字は1秒に10回と指の操作のとき、ルール本体は決まった刻み。点数の数え上げは React を描き直さず文字だけ書き換える
5. PixiJS は React の中で管理しない（@pixi/react は使わない）。React は canvas を置く場所を1つ用意するだけ
6. 文字は HTML/CSS に置く。PixiJS には文字を描かせない
7. 指の操作は画面全体を包む要素（ui/App.tsx の frame）で受け取り、canvas には取らせない。座標は world/layout.ts で盤面のマスに直す
8. セーブには版番号を入れ、古い版から新しい版へ変換する関数（src/save/migrations.ts）を用意する。GameState に項目を足したら、src/save/schema.ts の上限つきの形も足す
9. 数値はコードに直接書かず、balance.json・creatures.json に置く（画面の寸法と絵の色は world/layout.ts と world/art）

## 安全の決まり

- 読み込めるものを絞る決まり（CSP）は vite.config.ts にあり、ビルドに入る。PixiJS は 'pixi.js/unsafe-eval'、Zod は jitless で、文字列からコードを作らせない。外から読み込むものを増やしたら CSP も直す（e2e の CSP のテストが確かめる）
- テスト用の窓口（?debug=1 の window.__aero）と ?seed= は、開発中とテスト用のビルド（--mode e2e）だけ。公開用のビルド（npm run build）には入れない（Actions が確かめる）
- 読み込むセーブ（書き出したテキストも）は疑う：長さ・数の上限と Zod の形で確かめ、知らない鍵は落とす
- 保存できなかったときは黙らずに知らせる

## 見た目の決まり

- フルティガーエアロ：晴れた空・緑の丘・光の差しこむ海・ガラスとつや・泡・レンズの光・オーロラ
- 色は src/ui/styles.css の役割の名前の変数で書く。文字は濃い紺をガラスの上に置き、明るさの比 4.5:1 以上
- 書体は M PLUS Rounded 1c だけ
- 泡の色は必ず印（しずく・はっぱ・たいよう・はな・ほし）と組にする（色だけに頼らない）
- 押せる物は44px以上。泡の直径もどの画面でも44px以上
- 動きを減らす設定では、景色・ばね・しぶきを止め、知らせは動かさずに出す

## フォルダ

- src/core：ルール本体（盤面 board・六角形の隣 hex・1回のあそび round・記録と仲間 progress・乱数 rng・ボット bot）
- src/data：balance.json・creatures.json と Zod のスキーマ
- src/store：runtime（ルール本体を動かす係）・game（Zustand）・view（写し）
- src/world：PixiJS（World・景色 sea・盤面 board・しぶき fx・寸法 layout）と絵（art/：泡・景色・生き物）
- src/ui：React の画面（App・Hud・Title・Result・sheets・Overlays）、音（audio）、振動（haptics）、CSS
- src/save：SaveStore・セーブの形・版の変換
- tests：Vitest、e2e：Playwright（app.spec.ts・screens.spec.ts・og.spec.ts）
- scripts：シミュレーター（sim.ts）
- docs：SPEC.md・PLAN.md・screens/

## コマンド

- npm run dev：開発用サーバー（http://localhost:5176/aero-bubble/。?debug=1 でテスト用の窓口）
- npm test：Vitest
- npm run e2e：Playwright
- npm run screens：主な画面を docs/screens/ に、共有用の画像を public/og.png に、アイコンを public/apple-touch-icon.png に保存
- npm run build：公開用のビルド
- npm run sim -- all 60：ボットごとの点数・つなぎ・エアロタイム（first / casual / normal / expert / spam）
- npm run sim -- progress 40：上達していく人が、何回目で仲間が増えるか

## 作業の進め方

- 変更したら npm test と npm run e2e を通してから報告する
- 画面を変えたら npm run screens で撮り直し、崩れがないか自分で確かめる
- 数値を変えたら npm run sim で測り、SPEC 5章の目安から外れていないか確かめる。外れたら SPEC の実測値も直す
- UI の文言と報告は日本語で書く
