# メール本文の美しい表示方法

## オプション1: 段落分割表示（推奨）

メール本文を段落ごとに分割して、より読みやすく表示します。

### 実装方法

```tsx
// EmailDisplay.tsx コンポーネント
interface EmailDisplayProps {
  subject: string;
  body: string;
  onCopy: (text: string) => void;
}

const EmailDisplay = ({ subject, body, onCopy }: EmailDisplayProps) => {
  // 本文を段落に分割
  const paragraphs = body.split('\n\n').filter(p => p.trim());

  return (
    <div className="space-y-6">
      {/* 件名 */}
      <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r-lg shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">件名</span>
          <button
            onClick={() => onCopy(subject)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            コピー
          </button>
        </div>
        <p className="text-gray-900 font-medium">{subject}</p>
      </div>

      {/* 本文 */}
      <div className="bg-white border-l-4 border-green-500 p-6 rounded-r-lg shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">本文</span>
          <button
            onClick={() => onCopy(body)}
            className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            全文コピー
          </button>
        </div>

        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => {
            // URLを検出してリンク化
            const hasUrl = paragraph.includes('https://');

            if (hasUrl) {
              return (
                <p key={index} className="text-gray-700 leading-relaxed">
                  {paragraph.split(' ').map((word, i) => {
                    if (word.startsWith('https://')) {
                      return (
                        <a
                          key={i}
                          href={word}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {word}
                        </a>
                      );
                    }
                    return word + ' ';
                  })}
                </p>
              );
            }

            return (
              <p key={index} className="text-gray-700 leading-relaxed">
                {paragraph}
              </p>
            );
          })}
        </div>

        {/* フッター */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            💡 このメールは自動生成されています。送信前に内容をご確認ください。
          </p>
        </div>
      </div>
    </div>
  );
};
```

---

## オプション2: メールプレビュー風表示

実際のメールクライアントのような見た目にします。

```tsx
const EmailPreview = ({ subject, body, onCopy }: EmailDisplayProps) => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-3xl mx-auto">
      {/* メールヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">送信元: Goenchan 和田</p>
              <p className="text-xs text-blue-100">goenchan@example.com</p>
            </div>
          </div>
          <button
            onClick={() => onCopy(subject + '\n\n' + body)}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            全文コピー
          </button>
        </div>
        <h2 className="text-xl font-bold">{subject}</h2>
      </div>

      {/* メール本文 */}
      <div className="p-8 bg-gray-50">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="prose prose-sm max-w-none">
            {body.split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4 text-gray-700 leading-relaxed">
                {paragraph.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < paragraph.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onCopy(body)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            本文をコピー
          </button>
          <button
            onClick={() => {
              const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              window.location.href = mailtoLink;
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            メーラーで開く
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## オプション3: 編集可能なメール表示

生成後にユーザーが編集できるようにします。

```tsx
const EditableEmail = ({ subject, body, onCopy }: EmailDisplayProps) => {
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">生成されたメール</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {isEditing ? '✓ 編集完了' : '✎ 編集する'}
        </button>
      </div>

      {/* 件名 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
        {isEditing ? (
          <input
            type="text"
            value={editedSubject}
            onChange={(e) => setEditedSubject(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-center">
            <span>{editedSubject}</span>
            <button
              onClick={() => onCopy(editedSubject)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              コピー
            </button>
          </div>
        )}
      </div>

      {/* 本文 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
        {isEditing ? (
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={15}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        ) : (
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <div className="whitespace-pre-wrap text-sm leading-relaxed mb-3">
              {editedBody}
            </div>
            <button
              onClick={() => onCopy(editedBody)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              全文をコピー
            </button>
          </div>
        )}
      </div>

      {/* 統計情報 */}
      <div className="pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{editedBody.length}</p>
          <p className="text-xs text-gray-500">文字数</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{editedBody.split('\n\n').length}</p>
          <p className="text-xs text-gray-500">段落数</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{editedBody.split('。').length - 1}</p>
          <p className="text-xs text-gray-500">文数</p>
        </div>
      </div>
    </div>
  );
};
```

---

## Lovableへの追加依頼文

上記のいずれかのコンポーネントを追加したい場合：

```
生成されたメール本文をより見やすく表示するために、以下のコンポーネントを追加してください：

[オプション1/2/3のコードを貼り付け]

App.tsxの中で、outreachResultが存在し、eligible=trueの場合に、
以前の表示の代わりにこの新しいコンポーネントを使用してください。
```

---

## 使い分けのポイント

| オプション | 用途 | メリット |
|-----------|------|---------|
| **オプション1** | シンプルで読みやすい表示 | 段落分割、URLリンク化、コピーしやすい |
| **オプション2** | プロフェッショナルな見た目 | メールクライアント風、印象的 |
| **オプション3** | 編集が必要な場合 | 生成後に微調整可能、文字数表示 |

**推奨:** まずは基本的な実装を完成させ、後からオプション1を追加するのが良いでしょう。
