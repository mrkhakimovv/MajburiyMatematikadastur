import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, Phone, UserCircle, CheckCircle, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
  telegramUser?: any;
}

export default function Auth({ onLogin, telegramUser }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBlockedUser, setIsBlockedUser] = useState(false);
  
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-login via Telegram WebApp
  useEffect(() => {
    const handleBlocked = () => {
      setIsBlockedUser(true);
    };
    window.addEventListener('auth:blocked', handleBlocked as EventListener);
    
    if (telegramUser) {
      setFirstName(telegramUser.first_name || '');
      setLastName(telegramUser.last_name || '');
      if (telegramUser.username) {
        setUsername(telegramUser.username.toLowerCase());
      }
      
      const autoLogin = async () => {
        try {
          const res = await fetch(`/api/user/${telegramUser.id}`);
          if (res.ok) {
            const data = await res.json();
            onLogin(data);
          } else if (res.status === 403) {
            const errData = await res.json();
            if (errData.isBlocked) {
              setIsBlockedUser(true);
            }
          }
        } catch (e) {
          console.error('Auto login failed', e);
        }
      };
      autoLogin();
    }
    
    return () => {
      window.removeEventListener('auth:blocked', handleBlocked as EventListener);
    }
  }, [telegramUser, onLogin]);

  if (isBlockedUser) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-gray-50 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-400/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="bg-white/80 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-sm w-full relative z-10">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 relative">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Akkaunt bloklangan</h2>
          <p className="text-gray-600 font-medium mb-6">Siz bloklangansiz, dasturdan foydalana olmaysiz. Blokni ochish uchun admin bilan bog'laning.</p>
          <a
            href="https://t.me/quvonchbek_hakimov"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-3.5 px-4 rounded-xl font-bold border border-transparent shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] text-white bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 transition-all outline-none"
          >
            Adminga murojaat
          </a>
        </div>
      </div>
    );
  }

  // Username availability check with debounce (600ms)
  useEffect(() => {
    if (isLogin || !username) {
      setUsernameAvailable(null);
      setSuggestions([]);
      return;
    }

    const rawUsername = username.replace(/[@\s]/g, '').toLowerCase();

    // Basic format validation
    if (!/^[a-z0-9_.]+$/.test(rawUsername)) {
      setUsernameAvailable(false);
      setSuggestions([]);
      return;
    }

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkTimeoutRef.current = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: rawUsername })
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
  }, [username, isLogin]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('998')) {
      val = val.slice(3);
    }
    let formatted = '+998';
    if (val.length > 0) formatted += ' ' + val.slice(0, 2);
    if (val.length > 2) formatted += ' ' + val.slice(2, 5);
    if (val.length > 5) formatted += ' ' + val.slice(5, 7);
    if (val.length > 7) formatted += ' ' + val.slice(7, 9);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let formattedUsername = username.replace(/[\s]/g, '');
      if (!formattedUsername.startsWith('@') && formattedUsername.length > 0) {
        formattedUsername = '@' + formattedUsername;
      }

      if (isLogin) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: formattedUsername, password })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          onLogin(data.user);
        } else {
          setError(data.error || 'Login yoki parol xato');
          if (data.isBlocked) {
            setIsBlockedUser(true);
          }
        }
      } else {
        if (usernameAvailable === false) {
          setError('Bu username band yoki noto\'g\'ri formatda');
          setLoading(false);
          return;
        }

        const telegram_id = telegramUser?.id ? String(telegramUser.id) : `web_${Date.now()}`;

        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id,
            first_name: firstName,
            last_name: lastName,
            username: formattedUsername,
            phone_number: phone,
            password
          })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          onLogin(data.user);
        } else {
          setError(data.error || 'Ro\'yxatdan o\'tishda xatolik yuz berdi');
        }
      }
    } catch (e) {
      setError('Tarmoq xatoligi yuz berdi. Iltimos tekshirib qayta urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-[100dvh] relative bg-gray-50 flex items-center justify-center p-4 overflow-hidden selection:bg-indigo-200 selection:text-indigo-900">
      
      {/* Background Math patterns */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%234f46e5\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        
        {/* Header Area */}
        <div className="text-center mb-8 transform transition-all duration-500 ease-in-out">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-lg shadow-indigo-200 mb-4 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            <span className="text-3xl">📐</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Majburiy Matematika
          </h2>
          <p className="mt-2 text-sm font-medium text-gray-500">
            {isLogin ? 'Hisobingizga kiring va test ishlashni boshlang' : 'Yangi hisob yarating va reytingda qatnashing'}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 ease-in-out">
          
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Registration Fields */}
            <div className={`transition-all duration-500 overflow-hidden ${isLogin ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
              <div className="space-y-5 pb-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Ism</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required={!isLogin}
                        disabled={loading}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all disabled:opacity-50 outline-none"
                        placeholder="John"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Familiya</label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={loading}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all disabled:opacity-50 outline-none"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Telefon raqam</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      required={!isLogin}
                      disabled={loading}
                      value={phone}
                      onChange={handlePhoneChange}
                      className="block w-full pl-10 pr-3 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all disabled:opacity-50 outline-none font-medium"
                      placeholder="+998 90 123 45 67"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Always Visible Fields: Username & Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-indigo-500 font-bold select-none">@</span>
                </div>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={username.replace('@', '')}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ''))}
                  className={`block w-full pl-10 pr-10 py-3 bg-gray-50/50 border outline-none
                    ${!isLogin && username
                      ? usernameAvailable
                        ? 'border-green-400 focus:ring-green-500 focus:bg-white'
                        : 'border-red-400 focus:ring-red-500 focus:bg-red-50/20'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white'
                    } rounded-xl sm:text-sm transition-all disabled:opacity-50 font-medium`}
                  placeholder="username"
                />
                
                {/* Username Validation Status Icon */}
                {!isLogin && username && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-opacity">
                    {checkingUsername ? (
                      <Loader2 size={18} className="text-indigo-500 animate-spin" />
                    ) : usernameAvailable ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : (
                      <XCircle size={18} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>

              {/* Username validation hints */}
              {!isLogin && (
                <div className="mt-2 transition-all">
                  {usernameAvailable === false && username ? (
                    <p className="text-xs font-medium text-red-500 flex items-center gap-1">
                      Bu username allaqachon band.
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      kichik lotin harflari, raqamlar, "_" va "."
                    </p>
                  )}
                  
                  {/* Suggestions block */}
                  {usernameAvailable === false && suggestions.length > 0 && !checkingUsername && (
                    <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1">
                      {suggestions.map(s => (
                         <button
                           key={s}
                           type="button"
                           onClick={() => {
                             setUsername(s.replace('@', ''));
                             setUsernameAvailable(true); // Optimistic UI
                           }}
                           className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-100 hover:bg-indigo-100 hover:scale-105 active:scale-95 transition-all outline-none font-medium"
                         >
                           {s}
                         </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                 <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">Parol</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 bg-gray-50/50 outline-none border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all disabled:opacity-50 tracking-wide font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600 transition-colors outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="animate-in fade-in slide-in-from-top-1 bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm font-medium flex gap-2 items-start shadow-sm">
                <XCircle size={18} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!isLogin && usernameAvailable === false)}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none transition-all duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative flex items-center gap-2">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? 'Kuting...' : isLogin ? 'Tizimga kirish' : 'Ro\'yxatdan o\'tish'}
              </span>
            </button>
            
          </form>

          {/* Toggle between Login and Signup */}
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500 font-medium">
              {isLogin ? 'Hisobingiz yo\'qmi?' : 'Allaqachon ro\'yxatdan o\'tganmisiz?'}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="ml-1.5 text-indigo-600 font-bold hover:text-indigo-800 hover:underline underline-offset-4 outline-none focus:ring-2 focus:ring-indigo-500 rounded transition-all"
              >
                {isLogin ? 'Yangi akkaunt ochish' : 'Kirish'}
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
