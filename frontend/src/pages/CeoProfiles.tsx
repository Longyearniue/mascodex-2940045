import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface CeoProfile {
  id: number;
  name: string;
  description?: string;
}

export default function CeoProfiles() {
  const [ceos, setCeos] = useState<CeoProfile[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchCeos = async () => {
    const res = await api.get<CeoProfile[]>('/ceos');
    setCeos(res.data);
  };

  useEffect(() => {
    fetchCeos();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await api.post('/ceos', { name, description });
    setName('');
    setDescription('');
    fetchCeos();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">CEO Profiles</h2>

      <form onSubmit={handleAdd} className="space-y-2 mb-8">
        <input
          className="border p-2 rounded w-full"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="border p-2 rounded w-full"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">
          Add CEO
        </button>
      </form>

      <ul className="grid gap-4 md:grid-cols-2">
        {ceos.map((c) => (
          <li key={c.id} className="bg-white rounded shadow p-4 flex flex-col">
            <h3 className="text-lg font-bold mb-2">{c.name}</h3>
            <p className="flex-1 text-sm text-gray-700 mb-4">{c.description}</p>
            <Link
              to={`/chat/${c.id}`}
              className="self-start text-indigo-600 hover:underline font-medium"
            >
              Chat →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}