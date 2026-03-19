import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TiktokLP from './pages/TiktokLP';
import Apply from './pages/Apply';
import Goen from './pages/Goen';
import Home from './pages/Home';
import PromptManagement from './pages/PromptManagement';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TiktokLP />} />
        <Route path="/recruit" element={<Apply />} />
        <Route path="/show" element={<Goen />} />
        <Route path="/tool" element={<Home />} />
        <Route path="/admin/prompts" element={<PromptManagement />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
