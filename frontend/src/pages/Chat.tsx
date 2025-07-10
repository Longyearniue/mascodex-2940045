import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const { ceoId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || !ceoId) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post<{ reply: string }>(`/chat/${ceoId}`, { message: userMsg.content });
      const assistantMsg: Message = { role: 'assistant', content: res.data.reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`p-2 rounded ${m.role === 'user' ? 'bg-indigo-100 text-right' : 'bg-gray-200'}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-gray-500">Thinking...</div>}
      </div>
      <div className="mt-auto">
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={sendMessage}
          className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}