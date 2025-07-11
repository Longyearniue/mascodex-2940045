import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { interviewsAPI, ceoProfilesAPI } from '../services/api';
import { Plus, Edit, Trash2, MessageSquare, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Interview {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CEOProfile {
  id: number;
  name: string;
  company: string;
  position: string;
}

const Interviews: React.FC = () => {
  const [selectedProfile, setSelectedProfile] = useState<CEOProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  const queryClient = useQueryClient();

  // Fetch CEO profiles
  const { data: profiles = [] } = useQuery(
    'ceo-profiles',
    () => ceoProfilesAPI.getAll().then(res => res.data)
  );

  // Fetch interviews for selected profile
  const { data: interviews = [], isLoading } = useQuery(
    ['interviews', selectedProfile?.id],
    () => interviewsAPI.getAll(selectedProfile!.id).then(res => res.data),
    { enabled: !!selectedProfile }
  );

  // Create interview mutation
  const createMutation = useMutation(
    (data: typeof formData) => interviewsAPI.create(selectedProfile!.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['interviews', selectedProfile?.id]);
        setIsModalOpen(false);
        setFormData({ title: '', content: '' });
        toast.success('インタビューを作成しました');
      },
      onError: () => {
        toast.error('インタビュー作成に失敗しました');
      },
    }
  );

  // Update interview mutation
  const updateMutation = useMutation(
    ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      interviewsAPI.update(selectedProfile!.id, id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['interviews', selectedProfile?.id]);
        setIsModalOpen(false);
        setEditingInterview(null);
        setFormData({ title: '', content: '' });
        toast.success('インタビューを更新しました');
      },
      onError: () => {
        toast.error('インタビュー更新に失敗しました');
      },
    }
  );

  // Delete interview mutation
  const deleteMutation = useMutation(
    (id: number) => interviewsAPI.delete(selectedProfile!.id, id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['interviews', selectedProfile?.id]);
        toast.success('インタビューを削除しました');
      },
      onError: () => {
        toast.error('インタビュー削除に失敗しました');
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingInterview) {
      updateMutation.mutate({ id: editingInterview.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (interview: Interview) => {
    setEditingInterview(interview);
    setFormData({
      title: interview.title,
      content: interview.content,
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingInterview(null);
    setFormData({ title: '', content: '' });
    setIsModalOpen(true);
  };

  if (!selectedProfile) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">インタビュー管理</h1>
        
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">CEO プロフィールを選択してください</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile: CEOProfile) => (
              <div
                key={profile.id}
                onClick={() => setSelectedProfile(profile)}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-8 w-8 text-primary-600" />
                  <div>
                    <h3 className="font-semibold">{profile.name}</h3>
                    <p className="text-sm text-gray-600">{profile.position}</p>
                    <p className="text-sm text-gray-500">{profile.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">インタビュー管理</h1>
          <p className="text-gray-600">
            {selectedProfile.name} - {selectedProfile.company}
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedProfile(null)}
            className="btn-secondary"
          >
            プロフィール選択に戻る
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>新規インタビュー</span>
          </button>
        </div>
      </div>

      {/* Interviews List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">読み込み中...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview: Interview) => (
            <div key={interview.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <MessageSquare className="h-5 w-5 text-primary-600" />
                    <h3 className="text-lg font-semibold">{interview.title}</h3>
                  </div>
                  
                  <div className="prose max-w-none">
                    <p className="text-gray-600 whitespace-pre-wrap">
                      {interview.content}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        作成: {new Date(interview.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    {interview.updated_at !== interview.created_at && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          更新: {new Date(interview.updated_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => openEditModal(interview)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="編集"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(interview.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {interviews.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                インタビューがありません
              </h3>
              <p className="text-gray-600 mb-4">
                最初のインタビューを作成して、AIの学習データを充実させましょう。
              </p>
              <button
                onClick={openCreateModal}
                className="btn-primary"
              >
                インタビューを作成
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingInterview ? 'インタビュー編集' : '新規インタビュー作成'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  インタビュー内容
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input-field"
                  rows={10}
                  required
                  placeholder="インタビューの質問と回答を記録してください..."
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="btn-primary flex-1"
                >
                  {createMutation.isLoading || updateMutation.isLoading
                    ? '保存中...'
                    : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interviews;