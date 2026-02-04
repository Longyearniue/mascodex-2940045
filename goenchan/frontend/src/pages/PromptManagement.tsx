import React, { useState, useEffect } from 'react';
import { supabase, type Prompt } from '../supabaseClient';

export default function PromptManagement() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    variables: ['company_name', 'company_info', 'questions'],
    is_active: true,
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      content: prompt.content,
      variables: prompt.variables,
      is_active: prompt.is_active,
    });
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedPrompt(null);
    setFormData({
      name: '',
      content: '',
      variables: ['company_name', 'company_info', 'questions'],
      is_active: true,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    if (selectedPrompt) {
      setFormData({
        name: selectedPrompt.name,
        content: selectedPrompt.content,
        variables: selectedPrompt.variables,
        is_active: selectedPrompt.is_active,
      });
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (isCreating) {
        // Create new prompt
        const { error } = await supabase.from('prompts').insert({
          name: formData.name,
          content: formData.content,
          variables: formData.variables,
          is_active: formData.is_active,
        });

        if (error) throw error;
        setSuccess('プロンプトを作成しました');
        setIsCreating(false);
      } else if (isEditing && selectedPrompt) {
        // Update existing prompt
        const { error } = await supabase
          .from('prompts')
          .update({
            name: formData.name,
            content: formData.content,
            variables: formData.variables,
            is_active: formData.is_active,
          })
          .eq('id', selectedPrompt.id);

        if (error) throw error;
        setSuccess('プロンプトを更新しました');
        setIsEditing(false);
      }

      fetchPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    }
  };

  const handleDelete = async () => {
    if (!selectedPrompt || !confirm('このプロンプトを削除しますか？')) return;

    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase.from('prompts').delete().eq('id', selectedPrompt.id);

      if (error) throw error;
      setSuccess('プロンプトを削除しました');
      setSelectedPrompt(null);
      fetchPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete prompt');
    }
  };

  const handleVariableAdd = () => {
    setFormData({
      ...formData,
      variables: [...formData.variables, ''],
    });
  };

  const handleVariableRemove = (index: number) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index),
    });
  };

  const handleVariableChange = (index: number, value: string) => {
    const newVariables = [...formData.variables];
    newVariables[index] = value;
    setFormData({
      ...formData,
      variables: newVariables,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">プロンプト管理</h1>
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            新規作成
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          {/* Prompt List */}
          <div className="col-span-1 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">プロンプト一覧</h2>
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => handleSelectPrompt(prompt)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedPrompt?.id === prompt.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{prompt.name}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span className={prompt.is_active ? 'text-green-600' : 'text-gray-400'}>
                      {prompt.is_active ? '● 有効' : '○ 無効'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Details/Editor */}
          <div className="col-span-2 bg-white rounded-lg shadow p-6">
            {!selectedPrompt && !isCreating ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                プロンプトを選択してください
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    {isCreating ? '新規プロンプト作成' : isEditing ? 'プロンプト編集' : 'プロンプト詳細'}
                  </h2>
                  {!isCreating && !isEditing && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleEdit}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                      >
                        編集
                      </button>
                      <button
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        削除
                      </button>
                    </div>
                  )}
                  {(isCreating || isEditing) && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        保存
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      プロンプト名 <span className="text-red-500">*</span>
                    </label>
                    {isCreating || isEditing ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例: sales_letter_default"
                      />
                    ) : (
                      <div className="text-lg font-medium">{formData.name}</div>
                    )}
                  </div>

                  {/* Active Status */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        disabled={!isCreating && !isEditing}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">有効</span>
                    </label>
                  </div>

                  {/* Variables */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      変数
                      {(isCreating || isEditing) && (
                        <button
                          onClick={handleVariableAdd}
                          className="ml-2 text-blue-600 hover:text-blue-700 text-xs"
                        >
                          + 追加
                        </button>
                      )}
                    </label>
                    <div className="space-y-2">
                      {formData.variables.map((variable, index) => (
                        <div key={index} className="flex items-center gap-2">
                          {isCreating || isEditing ? (
                            <>
                              <input
                                type="text"
                                value={variable}
                                onChange={(e) => handleVariableChange(index, e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="例: company_name"
                              />
                              <button
                                onClick={() => handleVariableRemove(index)}
                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                              >
                                削除
                              </button>
                            </>
                          ) : (
                            <div className="px-4 py-2 bg-gray-100 rounded-lg">
                              <code className="text-sm">{'{{' + variable + '}}'}</code>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      プロンプト内容 <span className="text-red-500">*</span>
                    </label>
                    {isCreating || isEditing ? (
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={15}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="プロンプトの内容を入力してください。変数は {{variable_name}} の形式で使用できます。"
                      />
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <pre className="whitespace-pre-wrap font-mono text-sm">{formData.content}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
