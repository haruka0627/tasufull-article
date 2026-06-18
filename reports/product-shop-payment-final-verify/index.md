# product / shop 支払い方式別 最終確認（DOM検証）

Base: http://localhost:5500
Generated: 2026-06-10T09:07:36.338Z

## product-prepaid ✅

URL: http://localhost:5500/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=product&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=product-0&liveFlowReset=1

### 01-start — 開始直後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 2 — 商品が購入されました | やりとりが開始されました
- B dom: 1 — やりとりが開始されました
- A localStorage: 商品が購入されました | やりとりが開始されました
- B localStorage: やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: —
- B: 出品者の発送をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 02-after-ship — A発送後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 商品を受け取りました / mode: purchase_receive

**③ 通知**
- A dom: 2 — 商品が購入されました | やりとりが開始されました
- B dom: 2 — 商品が発送されました | やりとりが開始されました
- A localStorage: 商品が購入されました | やりとりが開始されました
- B localStorage: 商品が発送されました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 商品を発送しました。購入者の受取確認をお待ちください。
- B: 商品が発送されました。到着後に受取確認を行ってください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 03-after-receive — B受取/完了後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 4 — 取引が完了しました | 購入者が商品を受け取りました | 商品が購入されました | やりとりが開始されました
- B dom: 3 — 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A localStorage: 取引が完了しました | 購入者が商品を受け取りました | 商品が購入されました | やりとりが開始されました
- B localStorage: 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 取引が完了しました
- B: 取引が完了しました

**⑤ レビュー**
- A review visible: true / B review visible: true

**⑥ NG**
- count: 0 

**NG全部コピー**: [product-prepaid-ng-bulk-copy.txt](product-prepaid-ng-bulk-copy.txt)

## product-bank_transfer ✅

URL: http://localhost:5500/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=product&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=product-0&liveFlowReset=1&paymentMethod=bank_transfer

### 01-start — 開始直後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 銀行振込が完了しました / mode: purchase_bank_report

**③ 通知**
- A dom: 2 — 商品が購入されました | やりとりが開始されました
- B dom: 1 — やりとりが開始されました
- A localStorage: 商品が購入されました | やりとりが開始されました
- B localStorage: やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 購入者の振込をお待ちください。
- B: 銀行振込を完了してください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 02-after-bank-report — B振込報告後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 3 — 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B dom: 2 — 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B localStorage: 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 購入者から振込完了報告が届きました。入金を確認してください。
- B: 出品者の入金確認をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 03-after-payment-confirm — A入金確認後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 3 — 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B dom: 3 — 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B localStorage: 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 入金を確認しました。商品を発送してください。
- B: 入金確認が完了しました。商品の発送をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 04-after-ship — A発送後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 商品を受け取りました / mode: purchase_receive

**③ 通知**
- A dom: 3 — 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B dom: 4 — 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B localStorage: 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 商品を発送しました。購入者の受取確認をお待ちください。
- B: 商品が発送されました。到着後に受取確認を行ってください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 05-after-receive — B受取/完了後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 5 — 取引が完了しました | 購入者が商品を受け取りました | 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B dom: 5 — 取引が完了しました | 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 取引が完了しました | 購入者が商品を受け取りました | 購入者が銀行振込完了を報告しました | 商品が購入されました | やりとりが開始されました
- B localStorage: 取引が完了しました | 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 取引が完了しました
- B: 取引が完了しました

**⑤ レビュー**
- A review visible: true / B review visible: true

**⑥ NG**
- count: 0 

**NG全部コピー**: [product-bank_transfer-ng-bulk-copy.txt](product-bank_transfer-ng-bulk-copy.txt)

## product-cash_on_delivery ✅

URL: http://localhost:5500/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=product&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=product-0&liveFlowReset=1&paymentMethod=cash_on_delivery

### 01-start — 開始直後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 2 — 商品が購入されました | やりとりが開始されました
- B dom: 1 — やりとりが開始されました
- A localStorage: 商品が購入されました | やりとりが開始されました
- B localStorage: やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: —
- B: 出品者の発送をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 02-after-ship — A発送後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 商品を受け取りました / mode: purchase_receive

**③ 通知**
- A dom: 2 — 商品が購入されました | やりとりが開始されました
- B dom: 2 — 商品が発送されました | やりとりが開始されました
- A localStorage: 商品が購入されました | やりとりが開始されました
- B localStorage: 商品が発送されました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 商品を発送しました。購入者の受取確認をお待ちください。
- B: 商品が発送されました。到着時に代金をお支払いください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 03-after-receive — B受取/完了後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 4 — 取引が完了しました | 購入者が商品を受け取りました | 商品が購入されました | やりとりが開始されました
- B dom: 3 — 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A localStorage: 取引が完了しました | 購入者が商品を受け取りました | 商品が購入されました | やりとりが開始されました
- B localStorage: 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A postMessage: やりとりが開始されました | 商品が購入されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 取引が完了しました
- B: 取引が完了しました

**⑤ レビュー**
- A review visible: true / B review visible: true

**⑥ NG**
- count: 0 

**NG全部コピー**: [product-cash_on_delivery-ng-bulk-copy.txt](product-cash_on_delivery-ng-bulk-copy.txt)

## shop-prepaid ✅

URL: http://localhost:5500/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=shop&demoConnect=1&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=shop-1&liveFlowReset=1

### 01-start — 開始直後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 1 — やりとりが開始されました
- B dom: 1 — やりとりが開始されました
- A localStorage: やりとりが開始されました
- B localStorage: やりとりが開始されました
- A postMessage: やりとりが開始されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: —
- B: 出品者の発送をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 02-after-ship — A発送後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 商品を受け取りました / mode: purchase_receive

**③ 通知**
- A dom: 1 — やりとりが開始されました
- B dom: 2 — 商品が発送されました | やりとりが開始されました
- A localStorage: やりとりが開始されました
- B localStorage: 商品が発送されました | やりとりが開始されました
- A postMessage: やりとりが開始されました
- B postMessage: 商品が発送されました | やりとりが開始されました

**④ チャット内ステータス**
- A: 商品を発送しました。購入者の受取確認をお待ちください。
- B: 商品が発送されました。到着後に受取確認を行ってください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 03-after-receive — B受取/完了後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 3 — 取引完了手数料をお支払いください | 購入者が商品を受け取りました | やりとりが開始されました
- B dom: 3 — 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A localStorage: 取引完了手数料をお支払いください | 購入者が商品を受け取りました | やりとりが開始されました
- B localStorage: 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A postMessage: 購入者が商品を受け取りました | 取引完了手数料をお支払いください | やりとりが開始されました
- B postMessage: 取引が完了しました | 商品が発送されました | やりとりが開始されました

**④ チャット内ステータス**
- A: 取引が完了しました
- B: 取引が完了しました

**⑤ レビュー**
- A review visible: true / B review visible: true

**⑥ NG**
- count: 0 

**NG全部コピー**: [shop-prepaid-ng-bulk-copy.txt](shop-prepaid-ng-bulk-copy.txt)

## shop-bank_transfer ✅

URL: http://localhost:5500/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=shop&demoConnect=1&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=shop-1&liveFlowReset=1&paymentMethod=bank_transfer

### 01-start — 開始直後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 銀行振込が完了しました / mode: purchase_bank_report

**③ 通知**
- A dom: 1 — やりとりが開始されました
- B dom: 1 — やりとりが開始されました
- A localStorage: やりとりが開始されました
- B localStorage: やりとりが開始されました
- A postMessage: やりとりが開始されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: 購入者の振込をお待ちください。
- B: 銀行振込を完了してください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 02-after-bank-report — B振込報告後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 2 — 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B dom: 2 — 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B localStorage: 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B postMessage: 銀行振込完了を報告しました | やりとりが開始されました

**④ チャット内ステータス**
- A: 購入者から振込完了報告が届きました。入金を確認してください。
- B: 出品者の入金確認をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 03-after-payment-confirm — A入金確認後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 2 — 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B dom: 3 — 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B localStorage: 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B postMessage: 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました

**④ チャット内ステータス**
- A: 入金を確認しました。商品を発送してください。
- B: 入金確認が完了しました。商品の発送をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 04-after-ship — A発送後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 商品を受け取りました / mode: purchase_receive

**③ 通知**
- A dom: 2 — 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B dom: 4 — 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B localStorage: 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B postMessage: 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました

**④ チャット内ステータス**
- A: 商品を発送しました。購入者の受取確認をお待ちください。
- B: 商品が発送されました。到着後に受取確認を行ってください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 05-after-receive — B受取/完了後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 4 — 取引完了手数料をお支払いください | 購入者が商品を受け取りました | 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B dom: 5 — 取引が完了しました | 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A localStorage: 取引完了手数料をお支払いください | 購入者が商品を受け取りました | 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B localStorage: 取引が完了しました | 商品が発送されました | 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました
- A postMessage: 購入者が銀行振込完了を報告しました | やりとりが開始されました
- B postMessage: 入金確認が完了しました | 銀行振込完了を報告しました | やりとりが開始されました

**④ チャット内ステータス**
- A: 取引が完了しました
- B: 取引が完了しました

**⑤ レビュー**
- A review visible: true / B review visible: true

**⑥ NG**
- count: 0 

**NG全部コピー**: [shop-bank_transfer-ng-bulk-copy.txt](shop-bank_transfer-ng-bulk-copy.txt)

## shop-cash_on_delivery ✅

URL: http://localhost:5500/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=shop&demoConnect=1&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=shop-1&liveFlowReset=1&paymentMethod=cash_on_delivery

### 01-start — 開始直後

**① A側ボタン**
- visible: true / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 1 — やりとりが開始されました
- B dom: 1 — やりとりが開始されました
- A localStorage: やりとりが開始されました
- B localStorage: やりとりが開始されました
- A postMessage: やりとりが開始されました
- B postMessage: やりとりが開始されました

**④ チャット内ステータス**
- A: —
- B: 出品者の発送をお待ちください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 02-after-ship — A発送後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: true / text: 商品を受け取りました / mode: purchase_receive

**③ 通知**
- A dom: 1 — やりとりが開始されました
- B dom: 2 — 商品が発送されました | やりとりが開始されました
- A localStorage: やりとりが開始されました
- B localStorage: 商品が発送されました | やりとりが開始されました
- A postMessage: やりとりが開始されました
- B postMessage: 商品が発送されました | やりとりが開始されました

**④ チャット内ステータス**
- A: 商品を発送しました。購入者の受取確認をお待ちください。
- B: 商品が発送されました。到着時に代金をお支払いください。

**⑤ レビュー**
- A review visible: false / B review visible: false

**⑥ NG**
- count: 0 

### 03-after-receive — B受取/完了後

**① A側ボタン**
- visible: false / text: — / mode: —

**② B側ボタン**
- visible: false / text: — / mode: —

**③ 通知**
- A dom: 3 — 取引完了手数料をお支払いください | 購入者が商品を受け取りました | やりとりが開始されました
- B dom: 3 — 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A localStorage: 取引完了手数料をお支払いください | 購入者が商品を受け取りました | やりとりが開始されました
- B localStorage: 取引が完了しました | 商品が発送されました | やりとりが開始されました
- A postMessage: 購入者が商品を受け取りました | 取引完了手数料をお支払いください | やりとりが開始されました
- B postMessage: 取引が完了しました | 商品が発送されました | やりとりが開始されました

**④ チャット内ステータス**
- A: 取引が完了しました
- B: 取引が完了しました

**⑤ レビュー**
- A review visible: true / B review visible: true

**⑥ NG**
- count: 0 

**NG全部コピー**: [shop-cash_on_delivery-ng-bulk-copy.txt](shop-cash_on_delivery-ng-bulk-copy.txt)
