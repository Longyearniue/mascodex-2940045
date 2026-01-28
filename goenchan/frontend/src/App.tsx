import { useState } from 'react';
import { checkFounderVisibility, generateOutreach } from './api';
import type { FounderVisibilityResponse, OutreachGenerateResponse } from './types';

function App() {
  const [companyName, setCompanyName] = useState('');
  const [url, setUrl] = useState('');
  const [questions, setQuestions] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibilityResult, setVisibilityResult] = useState<FounderVisibilityResponse | null>(null);
  const [outreachResult, setOutreachResult] = useState<OutreachGenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCheckedUrls, setShowCheckedUrls] = useState(false);

  const handleCheck = async () => {
    if (!url) {
      setError('URLを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setVisibilityResult(null);
    setOutreachResult(null);
    setShowCheckedUrls(false);

    try {
      const result = await checkFounderVisibility(url);
      setVisibilityResult(result);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!companyName || !url || !questions) {
      setError('会社名、URL、質問をすべて入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setOutreachResult(null);

    try {
      const result = await generateOutreach(companyName, url, questions);
      setOutreachResult(result);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('コピーしました');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Goenchan - Founder Visibility Checker
          </h1>
          <p className="text-gray-600">
            企業サイトから創業者・CEOの情報を検出し、アウトリーチメールを生成します
          </p>
        </header>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社名
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例: 株式会社サンプル"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                質問内容
              </label>
              <textarea
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder="例: 創業のきっかけは？"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCheck}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '処理中...' : '判定する'}
              </button>

              <button
                onClick={handleGenerate}
                disabled={loading || !visibilityResult?.founder_visibility}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '生成中...' : '文面を生成'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Visibility Result */}
        {visibilityResult && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">判定結果</h2>

            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700">Founder Visibility: </span>
              <span className={`font-bold ${visibilityResult.founder_visibility ? 'text-green-600' : 'text-red-600'}`}>
                {visibilityResult.founder_visibility ? 'TRUE' : 'FALSE'}
              </span>
            </div>

            {visibilityResult.evidence.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">証拠URL:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {visibilityResult.evidence.map((evidenceUrl, idx) => (
                    <li key={idx}>
                      <a
                        href={evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {evidenceUrl}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {visibilityResult.hit_keywords.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">検出キーワード:</h3>
                <div className="flex flex-wrap gap-2">
                  {visibilityResult.hit_keywords.map((keyword, idx) => (
                    <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <button
                onClick={() => setShowCheckedUrls(!showCheckedUrls)}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                {showCheckedUrls ? '確認済みURLを隠す' : `確認済みURL (${visibilityResult.checked_urls.length}件) を表示`}
              </button>

              {showCheckedUrls && (
                <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-600">
                  {visibilityResult.checked_urls.map((checkedUrl, idx) => (
                    <li key={idx}>{checkedUrl}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Outreach Result */}
        {outreachResult && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {outreachResult.eligible ? (
              <>
                <h2 className="text-xl font-semibold mb-4">生成された文面</h2>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">件名:</h3>
                    <button
                      onClick={() => copyToClipboard(outreachResult.subject || '')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    {outreachResult.subject}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">本文:</h3>
                    <button
                      onClick={() => copyToClipboard(outreachResult.body || '')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
                    {outreachResult.body}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  この企業は対象外です（Founder Visibilityが検出されませんでした）
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
