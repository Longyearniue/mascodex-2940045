import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { documentsAPI, ceoProfilesAPI } from '../services/api';
import { Upload, FileText, File, Trash2, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface Document {
  id: number;
  filename: string;
  file_type: string;
  content_summary: string;
  created_at: string;
}

interface CEOProfile {
  id: number;
  name: string;
  company: string;
  position: string;
}

const Documents: React.FC = () => {
  const [selectedProfile, setSelectedProfile] = useState<CEOProfile | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);

  const queryClient = useQueryClient();

  // Fetch CEO profiles
  const { data: profiles = [] } = useQuery(
    'ceo-profiles',
    () => ceoProfilesAPI.getAll().then(res => res.data)
  );

  // Fetch documents for selected profile
  const { data: documents = [], isLoading } = useQuery(
    ['documents', selectedProfile?.id],
    () => documentsAPI.getAll(selectedProfile!.id).then(res => res.data),
    { enabled: !!selectedProfile }
  );

  // Upload document mutation
  const uploadMutation = useMutation(
    (file: File) => documentsAPI.upload(selectedProfile!.id, file),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documents', selectedProfile?.id]);
        setIsUploadModalOpen(false);
        setUploadedFile(null);
        toast.success('ドキュメントをアップロードしました');
      },
      onError: () => {
        toast.error('アップロードに失敗しました');
      },
    }
  );

  // Delete document mutation
  const deleteMutation = useMutation(
    (documentId: number) => documentsAPI.delete(selectedProfile!.id, documentId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documents', selectedProfile?.id]);
        toast.success('ドキュメントを削除しました');
      },
      onError: () => {
        toast.error('削除に失敗しました');
      },
    }
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleUpload = () => {
    if (uploadedFile && selectedProfile) {
      uploadMutation.mutate(uploadedFile);
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'docx':
        return <FileText className="h-6 w-6 text-blue-500" />;
      case 'txt':
        return <File className="h-6 w-6 text-gray-500" />;
      default:
        return <File className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!selectedProfile) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">会社資料管理</h1>
        
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
                  <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">
                      {profile.name.charAt(0)}
                    </span>
                  </div>
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
          <h1 className="text-2xl font-bold text-gray-900">会社資料管理</h1>
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
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Upload className="h-5 w-5" />
            <span>ドキュメントアップロード</span>
          </button>
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">読み込み中...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc: Document) => (
            <div key={doc.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getFileIcon(doc.file_type)}
                  <div>
                    <h3 className="font-semibold text-sm">{doc.filename}</h3>
                    <p className="text-xs text-gray-500 uppercase">{doc.file_type}</p>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => setPreviewDocument(doc)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="プレビュー"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {doc.content_summary && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">要約</h4>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {doc.content_summary}
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">ドキュメントアップロード</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ファイルを選択
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  対応形式: PDF, DOCX, TXT (最大10MB)
                </p>
              </div>
              
              {uploadedFile && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    {getFileIcon(uploadedFile.name.split('.').pop() || '')}
                    <div>
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(uploadedFile.size)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={handleUpload}
                  disabled={!uploadedFile || uploadMutation.isLoading}
                  className="btn-primary flex-1"
                >
                  {uploadMutation.isLoading ? 'アップロード中...' : 'アップロード'}
                </button>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{previewDocument.filename}</h2>
              <button
                onClick={() => setPreviewDocument(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {getFileIcon(previewDocument.file_type)}
                <div>
                  <p className="font-medium">{previewDocument.filename}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(previewDocument.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>
              
              {previewDocument.content_summary && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">AI要約</h3>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {previewDocument.content_summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;