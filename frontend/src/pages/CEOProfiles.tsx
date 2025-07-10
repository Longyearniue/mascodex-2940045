import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ceoProfilesAPI } from '../services/api';
import { Plus, Edit, Trash2, Mic, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface CEOProfile {
  id: number;
  name: string;
  company: string;
  position: string;
  bio?: string;
  voice_sample_path?: string;
  created_at: string;
  updated_at: string;
}

const CEOProfiles: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CEOProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    position: '',
    bio: '',
  });

  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery(
    'ceo-profiles',
    () => ceoProfilesAPI.getAll().then(res => res.data)
  );

  const createMutation = useMutation(
    (data: typeof formData) => ceoProfilesAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('ceo-profiles');
        setIsModalOpen(false);
        setFormData({ name: '', company: '', position: '', bio: '' });
        toast.success('CEOプロフィールを作成しました');
      },
      onError: () => {
        toast.error('プロフィール作成に失敗しました');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      ceoProfilesAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('ceo-profiles');
        setIsModalOpen(false);
        setEditingProfile(null);
        setFormData({ name: '', company: '', position: '', bio: '' });
        toast.success('CEOプロフィールを更新しました');
      },
      onError: () => {
        toast.error('プロフィール更新に失敗しました');
      },
    }
  );

  const deleteMutation = useMutation(
    (id: number) => ceoProfilesAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('ceo-profiles');
        toast.success('CEOプロフィールを削除しました');
      },
      onError: () => {
        toast.error('プロフィール削除に失敗しました');
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (profile: CEOProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      company: profile.company,
      position: profile.position,
      bio: profile.bio || '',
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingProfile(null);
    setFormData({ name: '', company: '', position: '', bio: '' });
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CEO プロフィール</h1>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>新規作成</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile: CEOProfile) => (
          <div key={profile.id} className="card">
            <div className="flex items-center space-x-3 mb-4">
              <User className="h-8 w-8 text-primary-600" />
              <div>
                <h3 className="text-lg font-semibold">{profile.name}</h3>
                <p className="text-sm text-gray-600">{profile.position}</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="text-sm">
                <span className="font-medium">会社:</span> {profile.company}
              </p>
              {profile.bio && (
                <p className="text-sm text-gray-600 line-clamp-3">{profile.bio}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {profile.voice_sample_path && (
                  <Mic className="h-4 w-4 text-green-500" />
                )}
                <span className="text-xs text-gray-500">
                  {new Date(profile.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(profile)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(profile.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingProfile ? 'プロフィール編集' : '新規プロフィール作成'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役職
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  経歴
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="input-field"
                  rows={3}
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

export default CEOProfiles;