import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserWithStats } from '../types';
import { User as UserIcon, Trophy, Target, Clock, Edit2, Camera, Trash2, ArrowLeft, CheckCircle, XCircle, LogOut, Palette, Award, MessageSquare } from 'lucide-react';

const colorMap: Record<string, any> = {
  indigo: { gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-600', text: 'text-indigo-600', hover: 'hover:bg-indigo-700', light: 'bg-indigo-50' },
  emerald: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-600', text: 'text-emerald-600', hover: 'hover:bg-emerald-700', light: 'bg-emerald-50' },
  rose: { gradient: 'from-rose-500 to-pink-600', bg: 'bg-rose-600', text: 'text-rose-600', hover: 'hover:bg-rose-700', light: 'bg-rose-50' },
  amber: { gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-600', text: 'text-amber-600', hover: 'hover:bg-amber-700', light: 'bg-amber-50' },
  blue: { gradient: 'from-blue-500 to-cyan-600', bg: 'bg-blue-600', text: 'text-blue-600', hover: 'hover:bg-blue-700', light: 'bg-blue-50' },
};

const badgeMap: Record<string, any> = {
  first_step: { icon: '🌟', label: 'Birinchi qadam' },
  bronze: { icon: '🥉', label: 'Bronza bilimdon' },
  silver: { icon: '🥈', label: 'Kumush bilimdon' },
  gold: { icon: '🥇', label: 'Oltin bilimdon' },
  speedster: { icon: '⚡', label: 'Tezkor' },
  perfect: { icon: '🎯', label: 'Xatosiz' },
};

export default function Profile({ userId, onLogout }: { userId: string, onLogout?: () => void }) {
  const navigate = useNavigate();
  const { username: searchUsername } = useParams<{ username?: string }>();
  const [user, setUser] = useState<UserWithStats | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  const [newStatus, setNewStatus] = useState('');
  const [newAccentColor, setNewAccentColor] = useState('indigo');
  const [newSelectedBadge, setNewSelectedBadge] = useState('');

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = !searchUsername || (user && user.telegram_id === userId);

  const fetchUser = async () => {
    setError(null);
    const url = searchUsername 
      ? `/api/user/by-username/${encodeURIComponent(searchUsername)}` 
      : `/api/user/${encodeURIComponent(userId)}`;
    try {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type");
      
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setUser(data);
        setNewName(data.first_name);
        setNewLastName(data.last_name || '');
        setNewUsername(data.username || '');
        setNewPhone(data.phone_number || '');
        setNewStatus(data.status || '');
        setNewAccentColor(data.accent_color || 'indigo');
        setNewSelectedBadge(data.selected_badge || '');
      } else {
        setError("Foydalanuvchi topilmadi");
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
      setError('Tarmoq xatoligi yuz berdi');
    }
  };

  useEffect(() => {
    fetchUser();
  }, [searchUsername, userId]);

  useEffect(() => {
    if (!isEditing) return;
    const rawUsername = newUsername.startsWith('@') ? newUsername.slice(1) : newUsername;
    
    if (rawUsername.length < 3) {
      setUsernameAvailable(null);
      setSuggestions([]);
      return;
    }

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    checkTimeoutRef.current = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: rawUsername, current_user_id: userId })
        });
        if (res.ok) {
          const data = await res.json();
          setUsernameAvailable(data.available);
          setSuggestions(data.suggestions || []);
        } else {
          setUsernameAvailable(false);
          setSuggestions([]);
        }
      } catch (e) {
        setUsernameAvailable(null);
        setSuggestions([]);
      } finally {
        setCheckingUsername(false);
      }
    }, 600);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [newUsername, isEditing, userId]);

  const saveName = async () => {
    if (!newName.trim() || !newUsername.trim() || !newPhone.trim()) {
      alert("Ism, username va telefon raqam kiritilishi shart");
      return;
    }
    
    try {
      const res = await fetch(`/api/user/${userId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          first_name: newName, 
          last_name: newLastName,
          username: newUsername.startsWith('@') ? newUsername : `@${newUsername}`,
          phone_number: newPhone
        })
      });
      
      if (res.ok) {
        setIsEditing(false);
        fetchUser();
      } else {
        const data = await res.json();
        alert(data.error || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error('Failed to save name:', e);
      alert('Tarmoq xatoligi yuz berdi');
    }
  };

  const saveCustomization = async () => {
    try {
      const res = await fetch(`/api/user/${userId}/customization`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          accent_color: newAccentColor,
          selected_badge: newSelectedBadge
        })
      });
      
      if (res.ok) {
        setIsCustomizing(false);
        fetchUser();
      } else {
        alert("Xatolik yuz berdi");
      }
    } catch (e) {
      console.error('Failed to save customization:', e);
      alert('Tarmoq xatoligi yuz berdi');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-gray-50 p-4 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{error}</h2>
        <button 
          onClick={() => navigate('/')} 
          className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Asosiy menyuga qaytish
        </button>
      </div>
    );
  }

  if (!user) return <div className="flex justify-center items-center h-[100dvh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="p-4 max-w-md mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors">
          <ArrowLeft size={20} /> Orqaga
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isOwnProfile ? 'Profil' : 'Foydalanuvchi'}</h1>
        <div className="w-20"></div> {/* Spacer for centering */}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 mb-6 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-r ${colorMap[user.accent_color || 'indigo']?.gradient || colorMap.indigo.gradient}`}></div>
        
        {isOwnProfile && onLogout && (
          <button 
            onClick={onLogout}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 text-white/90 hover:text-white px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm transition-all text-sm font-medium"
            title="Tizimdan chiqish"
          >
            <LogOut size={16} />
            Chiqish
          </button>
        )}
        
        <div className="relative z-10 pt-16 px-6 pb-6 text-center">
          <div className="relative inline-block mx-auto mb-4">
            <div className="w-28 h-28 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden relative">
              <div className="w-full h-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-4xl uppercase">
                {user.first_name ? user.first_name.charAt(0) : 'U'}
              </div>
            </div>
            
            {/* Rank Badge */}
            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 font-black text-sm px-3 py-1 rounded-full shadow-md border-2 border-white flex items-center gap-1">
              <Trophy size={14} /> #{user.rank}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 mb-1">
            {isEditing && isOwnProfile ? (
              <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 w-full max-w-xs">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 outline-none w-full"
                  placeholder="Ism"
                  autoFocus
                />
                <input 
                  type="text" 
                  value={newLastName} 
                  onChange={e => setNewLastName(e.target.value)}
                  className="bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 outline-none w-full"
                  placeholder="Familiya"
                />
                <div className="relative">
                  <input 
                    type="text" 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)}
                    className={`bg-white px-3 py-2 rounded-lg border text-sm font-medium text-gray-900 outline-none w-full pr-10 ${
                      newUsername.length < 3 ? 'border-gray-200 focus:border-indigo-500' :
                      usernameAvailable === true ? 'border-emerald-400 focus:border-emerald-500 bg-emerald-50/20' :
                      usernameAvailable === false ? 'border-red-400 focus:border-red-500 bg-red-50/20' :
                      'border-gray-200 focus:border-indigo-500'
                    }`}
                    placeholder="Username"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : newUsername.length >= 3 && usernameAvailable === true ? (
                      <CheckCircle size={18} className="text-emerald-500" />
                    ) : newUsername.length >= 3 && usernameAvailable === false ? (
                      <XCircle size={18} className="text-red-500" />
                    ) : null}
                  </div>
                </div>
                {newUsername.length >= 3 && usernameAvailable === false && (
                  <div className="flex flex-col gap-1 items-start text-left mt-0.5 mb-1 px-1">
                    <p className="text-xs font-medium text-red-500">Bu username band. Tavsiyalar:</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setNewUsername(sug)}
                          className="px-2 py-1 bg-white text-indigo-600 text-xs rounded-md border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input 
                  type="tel" 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)}
                  className="bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 outline-none w-full"
                  placeholder="Telefon raqam"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold shadow-sm">Bekor qilish</button>
                  <button 
                    onClick={saveName} 
                    disabled={checkingUsername || (newUsername.length >= 3 && usernameAvailable === false)}
                    className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm disabled:bg-indigo-400"
                  >
                    Saqlash
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center group relative">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
                  {user.selected_badge && badgeMap[user.selected_badge] && (
                    <span className="text-xl" title={badgeMap[user.selected_badge].label}>
                      {badgeMap[user.selected_badge].icon}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 font-medium text-sm mb-1">{user.username}</p>
                {user.status && (
                  <p className="text-gray-700 italic text-sm mb-2 px-4 text-center">"{user.status}"</p>
                )}
                {isOwnProfile && (
                  <p className={`${colorMap[user.accent_color || 'indigo']?.text || 'text-indigo-600'} font-medium text-sm mb-4 ${colorMap[user.accent_color || 'indigo']?.light || 'bg-indigo-50'} inline-block px-3 py-1 rounded-full`}>{user.phone_number || 'Telefon raqam kiritilmagan'}</p>
                )}
                
                {isOwnProfile && (
                  <div className="absolute -right-12 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                    <button onClick={() => setIsEditing(true)} className={`text-gray-400 ${colorMap[user.accent_color || 'indigo']?.hover ? colorMap[user.accent_color || 'indigo'].hover.replace('bg-', 'text-').replace('700', '600') : 'hover:text-indigo-600'} transition-colors p-1.5 rounded-full ${colorMap[user.accent_color || 'indigo']?.light ? colorMap[user.accent_color || 'indigo'].light.replace('bg-', 'hover:bg-') : 'hover:bg-indigo-50'}`} title="Tahrirlash">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setIsCustomizing(true)} className={`text-gray-400 ${colorMap[user.accent_color || 'indigo']?.hover ? colorMap[user.accent_color || 'indigo'].hover.replace('bg-', 'text-').replace('700', '600') : 'hover:text-indigo-600'} transition-colors p-1.5 rounded-full ${colorMap[user.accent_color || 'indigo']?.light ? colorMap[user.accent_color || 'indigo'].light.replace('bg-', 'hover:bg-') : 'hover:bg-indigo-50'}`} title="Moslashtirish">
                      <Palette size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>


          {isOwnProfile && isCustomizing && (
            <div className="mt-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Palette size={18} /> Profilni moslashtirish</h3>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Status (qisqa ma'lumot)</label>
                <input 
                  type="text" 
                  value={newStatus} 
                  onChange={e => setNewStatus(e.target.value)}
                  maxLength={50}
                  className="bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 outline-none w-full"
                  placeholder="O'zingiz haqingizda..."
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Asosiy rang</label>
                <div className="flex gap-2">
                  {Object.keys(colorMap).map(color => (
                    <button
                      key={color}
                      onClick={() => setNewAccentColor(color)}
                      className={`w-8 h-8 rounded-full ${colorMap[color].bg} ${newAccentColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Nishon (Badge)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setNewSelectedBadge('')}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${newSelectedBadge === '' ? 'bg-gray-200 border-gray-300 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    Yo'q
                  </button>
                  {user.earned_badges?.map(badgeId => (
                    <button
                      key={badgeId}
                      onClick={() => setNewSelectedBadge(badgeId)}
                      className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1 ${newSelectedBadge === badgeId ? 'bg-gray-200 border-gray-300 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}
                      title={badgeMap[badgeId]?.label}
                    >
                      {badgeMap[badgeId]?.icon} {badgeMap[badgeId]?.label}
                    </button>
                  ))}
                  {(!user.earned_badges || user.earned_badges.length === 0) && (
                    <span className="text-xs text-gray-400 italic py-1.5">Hali nishonlar olinmagan</span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIsCustomizing(false)} className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold shadow-sm">Bekor qilish</button>
                <button onClick={saveCustomization} className={`flex-1 ${colorMap[newAccentColor]?.bg || 'bg-indigo-600'} text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm`}>Saqlash</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-lg font-bold text-gray-900">Statistika</h3>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Barcha vaqt</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className={`absolute -right-4 -top-4 w-16 h-16 ${colorMap[user.accent_color || 'indigo']?.light || 'bg-indigo-50'} rounded-full opacity-50`}></div>
          <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[user.accent_color || 'indigo']?.gradient || 'from-indigo-100 to-indigo-200'} text-white rounded-full flex items-center justify-center mb-3 shadow-sm`}>
            <Trophy size={24} />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Reyting</p>
          <p className="text-3xl font-black text-gray-900">#{user.rank}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className={`absolute -right-4 -top-4 w-16 h-16 ${colorMap[user.accent_color || 'indigo']?.light || 'bg-indigo-50'} rounded-full opacity-50`}></div>
          <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[user.accent_color || 'indigo']?.gradient || 'from-indigo-100 to-indigo-200'} text-white rounded-full flex items-center justify-center mb-3 shadow-sm`}>
            <Target size={24} />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Jami testlar</p>
          <p className="text-3xl font-black text-gray-900">{user.stats?.total_tests || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-50 flex justify-between items-center hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="font-bold text-gray-900">To'g'ri javoblar</p>
              <p className="text-xs text-gray-500 font-medium">Barcha to'g'ri ishlanganlar</p>
            </div>
          </div>
          <span className="font-black text-emerald-600 text-2xl">{user.stats?.correct_answers || 0}</span>
        </div>

        <div className="p-5 border-b border-gray-50 flex justify-between items-center hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shadow-sm">
              <XCircle size={20} />
            </div>
            <div>
              <p className="font-bold text-gray-900">Noto'g'ri javoblar</p>
              <p className="text-xs text-gray-500 font-medium">Xato belgilanganlar</p>
            </div>
          </div>
          <span className="font-black text-red-600 text-2xl">{user.stats?.wrong_answers || 0}</span>
        </div>

        <div className="p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shadow-sm">
              <Clock size={20} />
            </div>
            <div>
              <p className="font-bold text-gray-900">Sarflangan vaqt</p>
              <p className="text-xs text-gray-500 font-medium">Test ishlash uchun</p>
            </div>
          </div>
          <span className="font-black text-gray-900 text-xl">
            {Math.floor((user.stats?.time_spent || 0) / 60)}<span className="text-sm font-medium text-gray-500 ml-1">daq</span> {(user.stats?.time_spent || 0) % 60}<span className="text-sm font-medium text-gray-500 ml-1">son</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 mb-4 px-2">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Award size={20} className={`${colorMap[user.accent_color || 'indigo']?.text || 'text-indigo-600'}`}/> Yutuqlar va nishonlar</h3>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        {(!user.earned_badges || user.earned_badges.length === 0) ? (
          <div className="text-center py-6 text-gray-500 flex flex-col items-center">
            <Award size={32} className="text-gray-300 mb-2" />
            <p className="text-sm font-medium">Hali yutuqlar yo'q</p>
            <p className="text-xs mt-1">Testlarda faol qatnashib nishonlarni qo'lga kiriting!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {user.earned_badges.map(badgeId => (
              <div key={badgeId} className={`flex flex-col items-center justify-center p-4 rounded-xl border ${user.selected_badge === badgeId ? `border-${colorMap[user.accent_color || 'indigo']?.bg ? colorMap[user.accent_color || 'indigo'].bg.replace('bg-', '') : 'indigo-600'} ${colorMap[user.accent_color || 'indigo']?.light || 'bg-indigo-50'}` : 'border-gray-100 bg-gray-50'}`}>
                <span className="text-4xl mb-2 filter drop-shadow-sm">{badgeMap[badgeId]?.icon}</span>
                <span className="text-xs font-bold text-gray-900 text-center">{badgeMap[badgeId]?.label}</span>
                {user.selected_badge === badgeId && (
                  <span className={`text-[10px] mt-1 font-bold ${colorMap[user.accent_color || 'indigo']?.text || 'text-indigo-600'} uppercase tracking-wider`}>Tanlangan</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
