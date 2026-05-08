import React, { useState, useEffect } from 'react';
import { User, Lock, Phone, UserCircle, CheckCircle, XCircle } from 'lucide-react';

export default function Auth({ onLogin, telegramUser }: { onLogin: (user: any) => void, telegramUser?: any }) {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
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
          }
        } catch (e) {
          console.error('Auto login failed', e);
        }
      };
      autoLogin();
    }
  }, [telegramUser, onLogin]);

  useEffect(() => {
    if (isLogin || !username) {
      setUsernameAvailable(null);
      setSuggestions([]);
      return;
    }

    // Validate username format
    if (!/^[a-z0-9_.]+$/.test(username)) {
      setUsernameAvailable(false);
      setSuggestions([]);
      return;
    }

    const checkUser = async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        if (res.ok) {
          const data = await res.json();
          setUsernameAvailable(data.available);
          if (data.suggestions) {
            setSuggestions(data.suggestions);
          } else {
            setSuggestions([]);
          }
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
    };

    const timeoutId = setTimeout(checkUser, 500);
    return () => clearTimeout(timeoutId);
  }, [username, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        let formattedUsername = username;
        if (!formattedUsername.startsWith('@')) {
          formattedUsername = '@' + formattedUsername;
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: formattedUsername, password })
        });
        const data = await res.json();
        
        if (res.ok) {
          onLogin(data.user);
        } else {
          setError(data.error || 'Xatolik yuz berdi');
        }
      } else {
        if (usernameAvailable === false) {
          setError('Bu username band yoki noto\'g\'ri formatda');
          setLoading(false);
          return;
        }

        const telegram_id = telegramUser?.id ? String(telegramUser.id) : `web_${Date.now()}`;
        let formattedUsername = username;
        if (!formattedUsername.startsWith('@')) {
          formattedUsername = '@' + formattedUsername;
        }

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
        
        if (res.ok) {
          onLogin(data.user);
        } else {
          setError(data.error || 'Xatolik yuz berdi');
        }
      }
    } catch (e) {
      setError('Tarmoq xatoligi yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
            <UserCircle size={32} className="text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isLogin ? 'Tizimga kirish' : 'Ro\'yxatdan o\'tish'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ism</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                      placeholder="Ismingiz"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Familiya</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                      placeholder="Familiyangiz"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefon raqam</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                      placeholder="+998901234567"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">@</span>
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[@\s]/g, ''))}
                  className={`block w-full pl-8 pr-10 py-3 border ${
                    !isLogin && username
                      ? usernameAvailable
                        ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                        : 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                  } rounded-xl sm:text-sm transition-colors`}
                  placeholder="username"
                />
                {!isLogin && username && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {checkingUsername ? (
                      <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                    ) : usernameAvailable ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : (
                      <XCircle size={18} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {!isLogin && (
                <div className="mt-2">
                  <p className={`text-xs ${usernameAvailable === false && username ? 'text-red-600' : 'text-gray-500'}`}>
                    {usernameAvailable === false && username 
                      ? 'Bu username band yoki noto\'g\'ri formatda. Boshqa tanlang.' 
                      : 'Faqat kichik lotin harflari, raqamlar, "_" va "." ruxsat etiladi.'}
                  </p>
                  
                  {usernameAvailable === false && suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-1">Bo'sh variantlar:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setUsername(s.replace('@', ''))}
                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 hover:bg-indigo-100 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Parol</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {!isLogin && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Parol talablari:</p>
                  <ul className="text-xs space-y-1">
                    <li className={`flex items-center gap-1.5 ${password.length >= 4 ? 'text-green-600' : 'text-gray-500'}`}>
                      {password.length >= 4 ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                      Kamida 4 ta belgi
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                      {/[a-z]/.test(password) && /[A-Z]/.test(password) ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                      Katta va kichik harflar
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                      {/[0-9]/.test(password) ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                      Kamida bitta raqam
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || (!isLogin && usernameAvailable === false)}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Kuting...' : isLogin ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Yoki</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setUsername('');
                  setPassword('');
                }}
                className="text-indigo-600 hover:text-indigo-500 font-medium text-sm"
              >
                {isLogin ? 'Yangi akkaunt ochish' : 'Mavjud akkauntga kirish'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
