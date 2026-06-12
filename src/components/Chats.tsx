import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, User as UserIcon, Smile, Check, CheckCheck, Reply, X } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

export default function Chats({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        
        // Mark as read
        if (data.some((m: any) => m.sender_id !== userId && !m.is_read)) {
          await fetch(`/api/messages/${userId}/read`, { method: 'POST' });
        }
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    if (!newMessage.trim()) return;
    
    try {
      const res = await fetch(`/api/messages/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage, reply_to: replyTo?.id })
      });
      
      if (res.ok) {
        setNewMessage('');
        setShowEmojiPicker(false);
        setReplyTo(null);
        fetchMessages();
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  return (
    <div className="p-4 max-w-md mx-auto h-[100dvh] flex flex-col pb-6">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors">
          <ArrowLeft size={20} /> Orqaga
        </button>
        <h1 className="text-xl font-bold text-gray-900">Admin bilan aloqa</h1>
        <div className="w-20"></div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Prominent Admin Profile in Scrollable Area */}
          <div className="flex flex-col items-center justify-center text-center py-6 mb-4 border-b border-gray-100">
            <div className="relative mb-3">
              <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
                <UserIcon size={48} />
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full" title="Online"></div>
            </div>
            <h3 className="font-bold text-gray-900 text-2xl mb-1">Wissen Admin</h3>
            <p className="text-sm text-gray-500 mb-5">Mijozlarni qo'llab-quvvatlash xizmati</p>
            <a 
              href="https://t.me/wissen_admin" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-full font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2"
            >
              <Send size={16} /> Telegram orqali yozish
            </a>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={32} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Adminga yozish</h2>
              <p className="text-gray-500 text-sm">
                Savol yoki takliflaringiz bo'lsa, shu yerda yozib qoldirishingiz mumkin. Admin tez orada javob beradi.
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.sender_id === userId;
              const repliedMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-2`}>
                  {!isMe && (
                    <button 
                      onClick={() => setReplyTo(msg)}
                      className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-gray-100 hidden sm:block"
                    >
                      <Reply size={14} />
                    </button>
                  )}
                  {isMe && (
                    <button 
                      onClick={() => setReplyTo(msg)}
                      className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-gray-100 hidden sm:block"
                    >
                      <Reply size={14} />
                    </button>
                  )}
                  <div 
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2 relative cursor-pointer sm:cursor-default flex flex-col ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}
                    onDoubleClick={() => setReplyTo(msg)}
                  >
                    {repliedMsg && (
                      <div className={`mb-1.5 px-2 py-1.5 text-xs rounded border-l-2 ${isMe ? 'bg-indigo-700/50 border-indigo-300 text-indigo-100' : 'bg-gray-200/50 border-indigo-400 text-gray-600'} line-clamp-1`}>
                        {repliedMsg.content}
                      </div>
                    )}
                    <p className="text-sm break-words">{msg.content}</p>
                    <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {isMe && (msg.is_read ? <CheckCheck size={14} className={isMe ? "text-indigo-200" : "text-gray-400"} /> : <Check size={14} className={isMe ? "text-indigo-200" : "text-gray-400"} />)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
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

        <div className="bg-gray-50 z-40 relative border-t border-gray-100">
          {replyTo && (
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <div className="flex-1 flex flex-col border-l-2 border-indigo-500 pl-3">
                <span className="text-xs font-bold text-indigo-600">{replyTo.sender_id === userId ? 'Siz' : 'Admin'}</span>
                <span className="text-xs text-gray-600 line-clamp-1">{replyTo.content}</span>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-2 text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-gray-400 hover:text-indigo-600 transition-colors p-2 shrink-0"
            >
              <Smile size={24} />
            </button>
            <input 
              type="text" 
              placeholder="Xabar yozing (Javob berish uchun xabarga ikki marta bosing)..." 
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 bg-white text-sm"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button 
              onClick={sendMessage} 
              disabled={!newMessage.trim()}
              className="bg-indigo-600 text-white w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-50 shrink-0"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
