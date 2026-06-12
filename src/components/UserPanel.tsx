import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, Target, MessageCircle, User as UserIcon, Trophy, Search, LogOut, MessageSquare, Video } from 'lucide-react';

export default function UserPanel({ userId, onLogout, isAdmin = false }: { userId: string, onLogout?: () => void, isAdmin?: boolean }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setSuggestions(data.users || []);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.error('Failed to fetch suggestions', e);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      let query = searchQuery.trim();
      if (query.startsWith('@')) {
        query = query.substring(1);
      }
      if (query) {
        navigate(`/user/${query}`);
      }
    }
  };

  const handleSuggestionClick = (username: string) => {
    let query = username;
    if (query.startsWith('@')) {
      query = query.substring(1);
    }
    navigate(`/user/${query}`);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="relative">
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="absolute -top-4 -right-4 md:-right-16 md:top-0 z-50 flex items-center justify-center w-12 h-12 bg-white text-indigo-600 rounded-full shadow-lg border border-indigo-100 hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all"
            title="Admin Panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </button>
        )}

        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
          
          <h1 className="text-2xl font-bold mb-2 mt-4 relative z-10">Majburiy Matematika</h1>
          <p className="text-indigo-100 relative z-10 pr-16">Bilimingizni sinab ko'ring va reytingda ko'tariling!</p>

          <button 
            onClick={() => navigate('/profile')}
            className="absolute top-1/2 -translate-y-1/2 right-6 z-20 flex items-center justify-center w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-md shadow-lg transition-all border border-white/10"
            title="Profilim"
          >
            <UserIcon size={28} className="text-white drop-shadow-sm" />
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="absolute top-3 left-4 z-20 flex items-center justify-center w-8 h-8 bg-white/10 hover:bg-white/20 hover:text-red-300 rounded-full backdrop-blur-md transition-all text-white/90"
              title="Tizimdan chiqish"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      <form ref={searchRef} onSubmit={handleSearch} className="mb-6 relative">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Username orqali qidirish..."
            className="w-full pl-11 pr-24 py-4 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim()}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Qidirish
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {suggestions.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSuggestionClick(user.username)}
                className="w-full flex items-center p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden mr-3 flex-shrink-0">
                  {user.profile_photo ? (
                    <img src={user.profile_photo} alt={user.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={20} className="text-indigo-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{user.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="space-y-4">
        <button 
          onClick={() => navigate('/test/cheksiz')} 
          className="w-full flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mr-4">
            <PlayCircle size={24} />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-gray-900 text-lg">Cheksiz test ishlash</h3>
            <p className="text-sm text-gray-500">Random savollar orqali mashq qiling</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/test/10')} 
          className="w-full flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-4">
            <Target size={24} />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-gray-900 text-lg">Test 10</h3>
            <p className="text-sm text-gray-500">10 ta savol va natijalar tahlili</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/variants')} 
          className="w-full flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mr-4">
            <Target size={24} />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-gray-900 text-lg">Variantlar</h3>
            <p className="text-sm text-gray-500">Maxsus tuzilgan variantlarni yechish</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/leaderboard')} 
          className="w-full flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mr-4">
            <Trophy size={24} />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-gray-900 text-lg">Reyting</h3>
            <p className="text-sm text-gray-500">Eng kuchli bilimdonlar ro'yxati</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/chats')}
          className="w-full flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mr-4">
            <MessageCircle size={24} />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-gray-900 text-lg">Adminga murojaat</h3>
            <p className="text-sm text-gray-500">Muammo yoki takliflar uchun</p>
          </div>
        </button>

        <button 
          onClick={() => navigate('/videos')}
          className="w-full flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mr-4">
            <Video size={24} />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-gray-900 text-lg">Videodarslar</h3>
            <p className="text-sm text-gray-500">Mavzulashtirilgan video darsliklar</p>
          </div>
        </button>

        <div className="pt-4 space-y-3">
          <a 
            href="https://t.me/hakimov_matematika" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-indigo-100 active:scale-95 transition-transform relative overflow-hidden group animate-ad-shine"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mr-4 shadow-md z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </div>
            <div className="text-left flex-1 z-10">
              <h3 className="font-bold text-gray-900 text-base leading-tight">Matematikadan foydali darslar</h3>
              <p className="text-sm text-indigo-600 font-medium mt-0.5">@hakimov_matematika</p>
            </div>
          </a>

          <a 
            href="https://t.me/Matematika_PanjiSoatov" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center p-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl shadow-sm border border-blue-100 active:scale-95 transition-transform relative overflow-hidden group animate-ad-shine"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4 shadow-md z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </div>
            <div className="text-left flex-1 z-10">
              <h3 className="font-bold text-gray-900 text-base leading-tight">Majburiy Matematika kanali</h3>
              <p className="text-sm text-blue-600 font-medium mt-0.5">@Matematika_PanjiSoatov</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
