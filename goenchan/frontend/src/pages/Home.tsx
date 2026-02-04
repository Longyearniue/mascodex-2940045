import { useState } from 'react';
import { Link } from 'react-router-dom';
import { checkFounderVisibility, generateOutreach } from '../api';
import type { FounderVisibilityResponse, OutreachGenerateResponse } from '../types';

export default function Home() {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Goenchan</h1>
          <Link
            to="/admin/prompts"
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
          >
            プロンプト管理
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                会社名
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: 株式会社サンプル"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                質問
              </label>
              <textarea
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="質問を入力してください"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCheck}
                disabled={loading || !url}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {loading ? '確認中...' : '創業者可視性チェック'}
              </button>

              <button
                onClick={handleGenerate}
                disabled={loading || !companyName || !url || !questions}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {loading ? '生成中...' : 'アウトリーチ生成'}
              </button>
            </div>
          </div>

          {visibilityResult && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">創業者可視性チェック結果</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">結果:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      visibilityResult.founder_visibility
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {visibilityResult.founder_visibility ? '可視性あり' : '可視性なし'}
                  </span>
                </div>

                {visibilityResult.evidence.length > 0 && (
                  <div>
                    <span className="font-medium">証拠:</span>
                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                      {visibilityResult.evidence.map((evidence, index) => (
                        <li key={index} className="text-gray-700">
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visibilityResult.hit_keywords.length > 0 && (
                  <div>
                    <span className="font-medium">検出キーワード:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {visibilityResult.hit_keywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <button
                    onClick={() => setShowCheckedUrls(!showCheckedUrls)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {showCheckedUrls ? '▼' : '▶'} チェックしたURL ({visibilityResult.checked_urls.length})
                  </button>
                  {showCheckedUrls && (
                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm text-gray-600">
                      {visibilityResult.checked_urls.map((url, index) => (
                        <li key={index}>{url}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {outreachResult && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">アウトリーチ生成結果</h2>
              {outreachResult.eligible ? (
                <div className="space-y-4">
                  <div>
                    <span className="font-medium">件名:</span>
                    <p className="mt-2 p-3 bg-white rounded border border-gray-200">
                      {outreachResult.subject}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">本文:</span>
                    <p className="mt-2 p-3 bg-white rounded border border-gray-200 whitespace-pre-wrap">
                      {outreachResult.body}
                    </p>
                  </div>
                  {outreachResult.evidence && outreachResult.evidence.length > 0 && (
                    <div>
                      <span className="font-medium">根拠:</span>
                      <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                        {outreachResult.evidence.map((evidence, index) => (
                          <li key={index} className="text-gray-700">
                            {evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800">
                    <span className="font-medium">理由:</span> {outreachResult.reason}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
