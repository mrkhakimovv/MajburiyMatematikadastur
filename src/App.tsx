import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './components/AdminPanel';
import UserPanel from './components/UserPanel';
import TestSession from './components/TestSession';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';
import Auth from './components/Auth';
import Chats from './components/Chats';
import VariantsList from './components/VariantsList';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [telegramUser, setTelegramUser] = useState<any>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      setTelegramUser(tg.initDataUnsafe.user);
    }

    const savedUserId = localStorage.getItem('authUserId');
    const savedIsAdmin = localStorage.getItem('authIsAdmin') === 'true';

    if (savedUserId) {
      setUserId(savedUserId);
      setIsAdmin(savedIsAdmin);
    }
    setIsReady(true);
  }, []);

  const handleLogin = (user: any) => {
    setUserId(user.telegram_id);
    setIsAdmin(user.isAdmin || false);
    localStorage.setItem('authUserId', user.telegram_id);
    localStorage.setItem('authIsAdmin', String(user.isAdmin || false));
  };

  const handleLogout = () => {
    setUserId(null);
    setIsAdmin(false);
    localStorage.removeItem('authUserId');
    localStorage.removeItem('authIsAdmin');
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-gray-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!userId) {
    return <Auth onLogin={handleLogin} telegramUser={telegramUser} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-[100dvh] bg-gray-50 text-gray-900 font-sans pb-[calc(2.5rem+env(safe-area-inset-bottom))] relative">
        <Routes>
          <Route path="/" element={<UserPanel userId={userId} onLogout={handleLogout} isAdmin={isAdmin} />} />
          <Route path="/admin" element={isAdmin ? <AdminPanel onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/test/:type" element={<TestSession userId={userId} />} />
          <Route path="/profile" element={<Profile userId={userId} onLogout={handleLogout} />} />
          <Route path="/user/:username" element={<Profile userId={userId} />} />
          <Route path="/leaderboard" element={<Leaderboard userId={userId} />} />
          <Route path="/chats" element={<Chats userId={userId} />} />
          <Route path="/variants" element={<VariantsList userId={userId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
