import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Edit, Users, BarChart2, Trash2, Download, User as UserIcon, List, ArrowLeft, LogOut, MessageCircle, Smile, Home } from 'lucide-react';
import { Channel } from '../types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

export default function AdminPanel({ onLogout }: { onLogout?: () => void }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'main' | 'create' | 'edit' | 'chats' | 'stats' | 'all-tests' | 'create-variant'>('main');
  const [testId, setTestId] = useState('');
  const [testData, setTestData] = useState<any>(null);
  const [allTests, setAllTests] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [stats, setStats] = useState<any>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const [newTestImage, setNewTestImage] = useState<File | null>(null);
  const [newTestAnswer, setNewTestAnswer] = useState<string>('');
  const [editTestAnswer, setEditTestAnswer] = useState<string>('');
  const [editTestImage, setEditTestImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [variantMethod, setVariantMethod] = useState<'random' | 'manual'>('random');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [manualTests, setManualTests] = useState<Array<{file: File | null, answer: string, previewUrl: string | null}>>(Array.from({length: 10}, () => ({file: null, answer: '', previewUrl: null})));
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);

  const tg = (window as any).Telegram?.WebApp;

  const showAlert = (msg: string) => {
    if (tg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
      try {
        tg.showAlert(msg);
      } catch (e) {
        alert(msg);
      }
    } else {
      alert(msg);
    }
  };

  const createVariant = async () => {
    // allow any amount for random, it will max out at 10 on backend.
    if (variantMethod === 'manual') {
      const incomplete = manualTests.some(t => !t.file || !t.answer);
      if (incomplete) {
        showAlert("Iltimos, barcha 10 ta test uchun rasm va javobni kiriting");
        return;
      }
    }
    
    setIsCreatingVariant(true);
    try {
      let variantTestIds: string[] = [];

      if (variantMethod === 'manual') {
        const uploadedIds: string[] = [];
        for (const test of manualTests) {
          const formData = new FormData();
          formData.append('image', test.file as Blob);
          formData.append('correct_answer', test.answer);

          const res = await fetch('/api/admin/tests', {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
               uploadedIds.push(data.id);
            }
          }
        }
        
        if (uploadedIds.length !== 10) {
           showAlert("Ba'zi testlarni yuklashda xatolik yuz berdi");
           setIsCreatingVariant(false);
           return;
        }
        variantTestIds = uploadedIds;
      }

      const res = await fetch('/api/admin/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: variantMethod, testIds: variantMethod === 'manual' ? variantTestIds : selectedTestIds })
      });
      if (res.ok) {
        const data = await res.json();
        showAlert(`${data.name} muvaffaqiyatli yaratildi!`);
        setActiveTab('main');
        setManualTests(Array.from({length: 10}, () => ({file: null, answer: '', previewUrl: null})));
      } else {
         const err = await res.json();
         showAlert(err.error || "Xatolik yuz berdi.");
      }
    } catch (e) {
      showAlert("Xatolik yuz berdi");
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const createTestWeb = async () => {
    if (!newTestImage || !newTestAnswer) {
      showAlert("Iltimos, rasm va to'g'ri javobni tanlang");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', newTestImage);
    formData.append('correct_answer', newTestAnswer);

    try {
      const res = await fetch('/api/admin/tests', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        showAlert(`Test muvaffaqiyatli yaratildi! ID: ${data.id}`);
        setNewTestImage(null);
        setNewTestAnswer('');
        setActiveTab('main');
      } else {
        showAlert("Xatolik yuz berdi");
      }
    } catch (e) {
      showAlert("Xatolik yuz berdi");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchTest = async (idToFetch?: string) => {
    const targetId = idToFetch || testId;
    if (!targetId) return;
    try {
      const res = await fetch(`/api/admin/tests/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setTestData(data);
        setEditTestAnswer(data.correct_answer);
        setEditTestImage(null);
        if (idToFetch) setTestId(idToFetch);
      } else {
        showAlert('Test topilmadi');
      }
    } catch (e) {
      console.error('Failed to fetch test:', e);
      showAlert('Tarmoq xatoligi yuz berdi');
    }
  };

  const fetchAllTests = async () => {
    try {
      const res = await fetch('/api/admin/tests');
      if (res.ok) {
        setAllTests(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch all tests:', e);
    }
  };

  const updateTestAnswer = async () => {
    const answerToSave = editTestAnswer || testData.correct_answer;
    
    const formData = new FormData();
    formData.append('correct_answer', answerToSave);
    if (editTestImage) {
      formData.append('image', editTestImage);
    }

    setIsUploading(true);
    try {
      const res = await fetch(`/api/admin/tests/${testId}`, {
        method: 'PUT',
        body: formData
      });
      if (res.ok) {
        showAlert("O'zgartirishlar muvaffaqiyatli saqlandi");
        fetchTest();
      } else {
        showAlert("Xatolik yuz berdi");
      }
    } catch (e) {
      showAlert("Xatolik yuz berdi");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteTest = async () => {
    try {
      await fetch(`/api/admin/tests/${testId}`, { method: 'DELETE' });
      showAlert("Test o'chirildi");
      setTestData(null);
      setTestId('');
    } catch (e) {
      console.error('Failed to delete test:', e);
      showAlert('Tarmoq xatoligi yuz berdi');
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/admin/chats');
      if (res.ok) {
        setChats(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  };

  const fetchChatMessages = async (telegram_id: string) => {
    try {
      const res = await fetch(`/api/messages/${telegram_id}`);
      if (res.ok) {
        setChatMessages(await res.json());
        // Mark as read
        await fetch(`/api/admin/chats/${telegram_id}/read`, { method: 'POST' });
        fetchChats(); // Update unread counts
      }
    } catch (e) {
      console.error('Failed to fetch chat messages:', e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    try {
      const res = await fetch(`/api/admin/chats/${selectedChat.telegram_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage })
      });
      
      if (res.ok) {
        setNewMessage('');
        setShowEmojiPicker(false);
        fetchChatMessages(selectedChat.telegram_id);
        fetchChats();
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const exportUsers = async () => {
    try {
      const res = await fetch('/api/admin/export-users', { method: 'POST' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'foydalanuvchilar.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to export users:', e);
      showAlert('Xatolik yuz berdi');
    }
  };

  useEffect(() => {
    if (activeTab === 'chats') fetchChats();
    if (activeTab === 'stats') fetchStats();
    if (activeTab === 'all-tests') fetchAllTests();
  }, [activeTab]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'create' && activeTab !== 'edit') return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (activeTab === 'create') {
              setNewTestImage(file);
            } else if (activeTab === 'edit' && testData) {
              setEditTestImage(file);
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, testData]);

  return (
    <div className="p-4 max-w-md mx-auto relative">
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 right-4 z-50 flex items-center justify-center w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full shadow-sm border border-indigo-100 hover:bg-indigo-100 hover:scale-105 active:scale-95 transition-all"
        title="Foydalanuvchi oynasi"
      >
        <Home size={20} />
      </button>

      <h1 className="text-2xl font-bold text-center mb-6 text-indigo-900">Admin Panel</h1>

      {activeTab === 'main' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Testlarni boshqarish</h2>
            <div className="space-y-3">
              <button 
                onClick={() => setActiveTab('create')} 
                className="w-full flex items-center gap-4 bg-indigo-600 text-white p-4 rounded-xl shadow-sm active:scale-95 transition-transform"
              >
                <div className="bg-white/20 p-2.5 rounded-xl"><PlusCircle size={24} /></div>
                <div className="text-left flex-1">
                  <span className="font-bold block text-lg">Yangi test yaratish</span>
                  <span className="text-xs text-indigo-100 mt-0.5 block">Veb panel orqali maxsus sahifada test qo'shish</span>
                </div>
              </button>

              <button 
                onClick={() => { setActiveTab('create-variant'); fetchAllTests(); }} 
                className="w-full flex items-center gap-4 bg-purple-600 text-white p-4 rounded-xl shadow-sm active:scale-95 transition-transform"
              >
                <div className="bg-white/20 p-2.5 rounded-xl"><PlusCircle size={24} /></div>
                <div className="text-left flex-1">
                  <span className="font-bold block text-lg">Variant yaratish</span>
                  <span className="text-xs text-purple-100 mt-0.5 block">10 ta savoldan iborat maxsus variant tuzish</span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Asosiy menyu</h2>
            <div className="space-y-3">
              <button onClick={() => setActiveTab('all-tests')} className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-700 p-4 rounded-xl transition-colors text-left border border-gray-200">
                <List size={20} className="text-indigo-600" />
                <span className="font-medium">Barcha testlar ro'yxati</span>
              </button>

              <button onClick={() => setActiveTab('edit')} className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-700 p-4 rounded-xl transition-colors text-left border border-gray-200">
                <Edit size={20} className="text-emerald-600" />
                <span className="font-medium">Testni tahrirlash</span>
              </button>

              <button onClick={() => setActiveTab('chats')} className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-700 p-4 rounded-xl transition-colors text-left border border-gray-200">
                <MessageCircle size={20} className="text-blue-600" />
                <span className="font-medium">Foydalanuvchilar bilan chat</span>
              </button>

              <button onClick={() => setActiveTab('stats')} className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-700 p-4 rounded-xl transition-colors text-left border border-gray-200">
                <BarChart2 size={20} className="text-purple-600" />
                <span className="font-medium">Umumiy statistika</span>
              </button>
            </div>
          </div>

          {onLogout && (
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl active:scale-95 transition-transform mt-8">
              <LogOut size={20} />
              <span className="font-medium font-bold">Tizimdan chiqish</span>
            </button>
          )}
        </div>
      )}

      {activeTab === 'all-tests' && (
        <div className="space-y-4">
          <button onClick={() => setActiveTab('main')} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors mb-2 -ml-2">
            <ArrowLeft size={20} /> Orqaga
          </button>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4">Barcha testlar</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {allTests.map(test => (
                <div 
                  key={test.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-indigo-50 transition-colors"
                  onClick={() => {
                    setActiveTab('edit');
                    fetchTest(test.id.toString());
                  }}
                >
                  <div>
                    <p className="font-bold text-gray-800">Test #{test.id}</p>
                    <p className="text-xs text-gray-500">{new Date(test.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-sm">{test.correct_answer}</span>
                    <Edit size={16} className="text-indigo-400" />
                  </div>
                </div>
              ))}
              {allTests.length === 0 && <p className="text-center text-gray-500 py-4">Testlar mavjud emas</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create-variant' && (
        <div className="space-y-4">
          <button onClick={() => setActiveTab('main')} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors mb-2 -ml-2">
            <ArrowLeft size={20} /> Orqaga
          </button>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4">Variant yaratish</h2>
            
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setVariantMethod('random')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium border-2 transition-colors ${variantMethod === 'random' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'}`}
              >
                Random (Avtomatik 10ta)
              </button>
              <button 
                onClick={() => setVariantMethod('manual')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium border-2 transition-colors ${variantMethod === 'manual' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'}`}
              >
                Qo'lda kiritish
              </button>
            </div>

            {variantMethod === 'manual' && (
              <div className="mb-6 space-y-6 max-h-96 overflow-y-auto pr-2">
                <p className="font-medium text-gray-700">10 ta savolni kiriting</p>
                {manualTests.map((t, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <p className="font-bold text-gray-900 mb-3 text-lg">{idx + 1}-savol rasmi (yoki joylang)</p>
                    
                    <div className="mb-4">
                      <div 
                        className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-100 transition-colors cursor-pointer bg-white"
                        onClick={() => document.getElementById(`manual-test-upload-${idx}`)?.click()}
                        onPaste={(e) => {
                          const file = e.clipboardData.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            const updated = [...manualTests];
                            updated[idx].file = file;
                            updated[idx].previewUrl = URL.createObjectURL(file);
                            setManualTests(updated);
                          }
                        }}
                      >
                        <input 
                           id={`manual-test-upload-${idx}`}
                           type="file" 
                           accept="image/*"
                           className="hidden"
                           onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                 const updated = [...manualTests];
                                 updated[idx].file = file;
                                 updated[idx].previewUrl = URL.createObjectURL(file);
                                 setManualTests(updated);
                              }
                           }}
                        />
                        {t.previewUrl ? (
                          <div className="mt-2">
                            <img src={t.previewUrl} className="mx-auto max-h-48 object-contain rounded-lg border border-gray-200" />
                            <p className="text-sm text-indigo-600 mt-2 font-medium">Boshqa rasm tanlash</p>
                          </div>
                        ) : (
                          <div className="py-6 focus:outline-none" tabIndex={0}>
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3 pointer-events-none">
                              <PlusCircle size={24} />
                            </div>
                            <p className="text-gray-600 font-medium pointer-events-none">Rasmni tanlang yoki shu yerga joylang</p>
                            <p className="text-xs text-gray-400 mt-1 pointer-events-none">PNG, JPG, JPEG</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">To'g'ri javob</label>
                      <div className="grid grid-cols-4 gap-2">
                        {['A', 'B', 'C', 'D'].map(ans => (
                          <button 
                            key={ans}
                            onClick={() => {
                               const updated = [...manualTests];
                               updated[idx].answer = ans;
                               setManualTests(updated);
                            }}
                            className={`py-3 rounded-lg border font-bold text-lg ${t.answer === ans ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}
                          >
                            {ans}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button 
              onClick={createVariant} 
              disabled={isCreatingVariant}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all ${
                 isCreatingVariant
                 ? 'bg-purple-400 cursor-not-allowed'
                 : 'bg-purple-600 active:scale-95 shadow-sm hover:bg-purple-700'
              }`}
            >
              {isCreatingVariant ? 'Yaratilmoqda...' : 'Yaratish'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="space-y-4">
          <button onClick={() => setActiveTab('main')} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors mb-2 -ml-2">
            <ArrowLeft size={20} /> Orqaga
          </button>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4">Yangi test yaratish</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Test rasmi (yoki Ctrl+V orqali joylang)</label>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('test-image-upload')?.click()}
              >
                <input 
                  id="test-image-upload"
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setNewTestImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
                
                {newTestImage ? (
                  <div className="mt-2">
                    <img src={URL.createObjectURL(newTestImage)} alt="Preview" className="mx-auto max-h-48 object-contain rounded-lg border border-gray-200" />
                    <p className="text-sm text-indigo-600 mt-2 font-medium">Boshqa rasm tanlash</p>
                  </div>
                ) : (
                  <div className="py-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
                      <PlusCircle size={24} />
                    </div>
                    <p className="text-gray-600 font-medium">Rasmni tanlang yoki shu yerga Ctrl+V qiling</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">To'g'ri javob</label>
              <div className="grid grid-cols-4 gap-2">
                {['A', 'B', 'C', 'D'].map(ans => (
                  <button 
                    key={ans}
                    onClick={() => setNewTestAnswer(ans)}
                    className={`py-3 rounded-lg border font-bold text-lg ${newTestAnswer === ans ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                  >
                    {ans}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={createTestWeb} 
              disabled={isUploading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white ${isUploading ? 'bg-indigo-400' : 'bg-indigo-600 active:scale-95 transition-transform'}`}
            >
              {isUploading ? 'Yuklanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'edit' && (
        <div className="space-y-4">
          <button onClick={() => setActiveTab('main')} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors mb-2 -ml-2">
            <ArrowLeft size={20} /> Orqaga
          </button>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4">Testni tahrirlash</h2>
            <div className="flex gap-2 mb-4">
              <input 
                type="number" 
                placeholder="Test ID sini kiriting" 
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                value={testId}
                onChange={e => setTestId(e.target.value)}
              />
              <button onClick={() => fetchTest()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Izlash</button>
            </div>

            {testData && (
              <div className="mt-4 border-t pt-4">
                <div className="mb-4 relative group">
                  {editTestImage ? (
                    <img src={URL.createObjectURL(editTestImage)} alt="Test" className="w-full rounded-lg border border-gray-200" />
                  ) : testData.image_url ? (
                    <img src={testData.image_url} alt="Test" className="w-full rounded-lg border border-gray-200" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                      <span className="text-gray-400">Rasm yo'q</span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                    <button 
                      onClick={() => document.getElementById('edit-image-upload')?.click()}
                      className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-gray-50"
                    >
                      <Edit size={16} /> O'zgartirish
                    </button>
                    <span className="text-white/80 text-xs font-medium">yoki Ctrl+V qiling</span>
                  </div>
                  <input 
                    id="edit-image-upload"
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setEditTestImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
                
                {editTestImage && (
                  <div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-medium mb-4 flex items-center justify-center">
                    Yangi rasm tanlandi. Saqlash tugmasini bosing.
                  </div>
                )}

                <p className="text-sm text-gray-500 mb-1">Yaratilgan sana: {new Date(testData.created_at).toLocaleString()}</p>
                <p className="font-medium mb-4">To'g'ri javob: <span className="text-indigo-600">{testData.correct_answer}</span></p>
                
                <p className="text-sm text-gray-600 mb-2">Javobni tahrirlash:</p>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {['A', 'B', 'C', 'D'].map(ans => (
                    <button 
                      key={ans}
                      onClick={() => setEditTestAnswer(ans)}
                      className={`py-2 rounded-lg border font-medium ${editTestAnswer === ans ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                      {ans}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={updateTestAnswer}
                    disabled={isUploading || (editTestAnswer === testData.correct_answer && !editTestImage)}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all ${
                      isUploading || (editTestAnswer === testData.correct_answer && !editTestImage)
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-indigo-600 active:scale-95 shadow-sm hover:bg-indigo-700'
                    }`}
                  >
                    {isUploading ? 'Saqlanmoqda...' : "O'zgarishlarni saqlash"}
                  </button>

                  <button onClick={deleteTest} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors">
                    <Trash2 size={18} />
                    Testni o'chirish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chats' && (
        <div className="space-y-4">
          <button onClick={() => {
            if (selectedChat) {
              setSelectedChat(null);
              fetchChats();
            } else {
              setActiveTab('main');
            }
          }} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors mb-2 -ml-2">
            <ArrowLeft size={20} /> Orqaga
          </button>
          
          <div className="bg-white p-4 rounded-xl shadow-sm h-[calc(100dvh-120px)] min-h-[500px] flex flex-col">
            {!selectedChat ? (
              <>
                <h2 className="text-lg font-bold mb-4">Chatlar</h2>
                <div className="space-y-2 overflow-y-auto flex-1">
                  {chats.map(chat => (
                    <div 
                      key={chat.telegram_id} 
                      onClick={() => {
                        setSelectedChat(chat);
                        fetchChatMessages(chat.telegram_id);
                      }}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-indigo-50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                        {chat.profile_photo ? (
                          <img src={chat.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={24} className="text-indigo-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-gray-800 truncate">{chat.first_name} {chat.last_name}</p>
                          {chat.last_message_time && (
                            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                              {new Date(chat.last_message_time).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{chat.last_message || 'Xabar yo\'q'}</p>
                      </div>
                      {chat.unread_count > 0 && (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {chat.unread_count}
                        </div>
                      )}
                    </div>
                  ))}
                  {chats.length === 0 && <p className="text-gray-500 text-center py-4">Chatlar yo'q</p>}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                    {selectedChat.profile_photo ? (
                      <img src={selectedChat.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={20} className="text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800">{selectedChat.first_name} {selectedChat.last_name}</h2>
                    <p className="text-xs text-gray-500">{selectedChat.username}</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                  {chatMessages.map(msg => {
                    const isAdmin = msg.sender_id === '1986422890' || msg.sender_id === process.env.ADMIN_ID; // Simplified check
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isAdmin ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-[10px] mt-1 text-right ${isAdmin ? 'text-indigo-200' : 'text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {chatMessages.length === 0 && <p className="text-center text-gray-500 text-sm">Xabarlar yo'q</p>}
                </div>
                
                {showEmojiPicker && (
                  <div className="absolute bottom-[76px] left-0 right-0 z-50 p-2" ref={emojiPickerRef}>
                    <div className="shadow-2xl rounded-2xl overflow-hidden border border-gray-100 bg-white">
                      <EmojiPicker 
                        onEmojiClick={onEmojiClick} 
                        width="100%" 
                        height={300} 
                        searchDisabled={false}
                        skinTonesDisabled={true}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t border-gray-100 items-center relative z-40">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors p-2 shrink-0"
                  >
                    <Smile size={24} />
                  </button>
                  <input 
                    type="text" 
                    placeholder="Xabar yozing..." 
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-indigo-500"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  />
                  <button 
                    onClick={sendMessage} 
                    disabled={!newMessage.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl disabled:opacity-50 shrink-0"
                  >
                    Yuborish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-4">
          <button onClick={() => setActiveTab('main')} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors mb-2 -ml-2">
            <ArrowLeft size={20} /> Orqaga
          </button>
          
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm text-center border border-indigo-50">
                  <p className="text-sm text-gray-500 mb-1">Foydalanuvchilar</p>
                  <p className="text-2xl font-bold text-indigo-900">{stats.totalUsers}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm text-center border border-indigo-50">
                  <p className="text-sm text-gray-500 mb-1">Jami testlar</p>
                  <p className="text-2xl font-bold text-indigo-900">{stats.totalTests}</p>
                </div>
              </div>

              <button onClick={exportUsers} className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl shadow-sm active:scale-95 transition-transform">
                <Download size={20} />
                <span className="font-medium">Foydalanuvchilar (.xls)</span>
              </button>

              <div className="bg-white p-4 rounded-xl shadow-sm mt-4">
                <h2 className="text-lg font-bold mb-4 text-indigo-900">Top 30 Foydalanuvchilar</h2>
                <div className="space-y-3">
                  {stats.topUsers.map((u: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {i + 1}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                          {u.profile_photo ? (
                            <img src={u.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={20} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm line-clamp-1">{u.first_name} {u.last_name}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600">{u.correct_answers} to'g'ri</p>
                        <p className="text-xs text-gray-500">{u.total_tests} ta test</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
