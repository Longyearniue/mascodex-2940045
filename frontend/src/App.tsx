import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CeoProfiles from './pages/CeoProfiles';
import ChatPage from './pages/Chat';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-600">AI CEO Clone</h1>
            <nav className="space-x-4">
              <Link className="text-gray-700 hover:text-indigo-600" to="/">CEOs</Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<CeoProfiles />} />
            <Route path="/chat/:ceoId" element={<ChatPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;