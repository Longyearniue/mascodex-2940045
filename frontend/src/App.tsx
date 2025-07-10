import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import CEOProfiles from './pages/CEOProfiles';
import Documents from './pages/Documents';
import Interviews from './pages/Interviews';
import Chat from './pages/Chat';

const App: React.FC = () => {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/profiles" replace />} />
        <Route path="/profiles" element={<CEOProfiles />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/interviews" element={<Interviews />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Layout>
  );
};

export default App;