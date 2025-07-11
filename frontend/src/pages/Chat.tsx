import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { chatAPI, ceoProfilesAPI } from '../services/api';
import { Send, Mic, MicOff, Volume2, VolumeX, User, Bot } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: number;
  session_id: string;
  message_type: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface CEOProfile {
  id: number;
  name: string;
  company: string;
  position: string;
  bio?: string;
}

const Chat: React.FC = () => {
  const [selectedProfile, setSelectedProfile] = useState<CEOProfile | null>(null);
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const queryClient = useQueryClient();

  // Fetch CEO profiles
  const { data: profiles = [] } = useQuery(
    'ceo-profiles',
    () => ceoProfilesAPI.getAll().then(res => res.data)
  );

  // Fetch chat sessions
  const { data: sessions = [] } = useQuery(
    'chat-sessions',
    () => chatAPI.getSessions().then(res => res.data),
    { enabled: !!selectedProfile }
  );

  // Fetch messages for current session
  const { data: messages = [] } = useQuery(
    ['chat-messages', sessionId],
    () => chatAPI.getMessages(sessionId!).then(res => res.data),
    { enabled: !!sessionId }
  );

  // Chat mutation
  const chatMutation = useMutation(
    (data: { message: string; session_id?: string; ceo_profile_id: number }) =>
      sessionId ? chatAPI.continueSession(data) : chatAPI.startSession(data),
    {
      onSuccess: (response) => {
        setSessionId(response.data.session_id);
        if (response.data.audio_url) {
          setAudioUrl(response.data.audio_url);
        }
        queryClient.invalidateQueries(['chat-messages', sessionId]);
        setMessage('');
      },
      onError: () => {
        toast.error('メッセージの送信に失敗しました');
      },
    }
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle audio playback
  useEffect(() => {
    if (audioUrl && isVoiceEnabled) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isVoiceEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedProfile) return;

    chatMutation.mutate({
      message: message.trim(),
      session_id: sessionId,
      ceo_profile_id: selectedProfile.id,
    });
  };

  const handleProfileSelect = (profile: CEOProfile) => {
    setSelectedProfile(profile);
    setSessionId(null);
    setAudioUrl(null);
  };

  const startNewSession = () => {
    setSessionId(null);
    setAudioUrl(null);
  };

  const toggleVoice = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    if (audioRef.current) {
      if (isVoiceEnabled) {
        audioRef.current.pause();
      } else if (audioUrl) {
        audioRef.current.play();
      }
    }
  };

  if (!selectedProfile) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">AI チャット</h1>
        
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">CEO プロフィールを選択してください</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile: CEOProfile) => (
              <div
                key={profile.id}
                onClick={() => handleProfileSelect(profile)}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center space-x-3">
                  <User className="h-8 w-8 text-primary-600" />
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
    <div className="max-w-4xl mx-auto h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedProfile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 戻る
            </button>
            <div>
              <h1 className="text-xl font-bold">{selectedProfile.name}</h1>
              <p className="text-sm text-gray-600">
                {selectedProfile.position} at {selectedProfile.company}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-lg ${
                isVoiceEnabled ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isVoiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              onClick={startNewSession}
              className="btn-secondary text-sm"
            >
              新しいセッション
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: Message) => (
          <div
            key={msg.id}
            className={`flex ${msg.message_type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.message_type === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                {msg.message_type === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                <span className="text-xs opacity-75">
                  {msg.message_type === 'user' ? 'あなた' : selectedProfile.name}
                </span>
              </div>
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs opacity-50 mt-1">
                {new Date(msg.created_at).toLocaleTimeString('ja-JP')}
              </p>
            </div>
          </div>
        ))}
        
        {chatMutation.isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4" />
                <span className="text-sm">入力中...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="input-field flex-1"
            disabled={chatMutation.isLoading}
          />
          <button
            type="submit"
            disabled={!message.trim() || chatMutation.isLoading}
            className="btn-primary px-6"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
};

export default Chat;