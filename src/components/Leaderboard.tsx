import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, User as UserIcon } from 'lucide-react';

export default function Leaderboard({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-[100dvh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors">
          <ArrowLeft size={20} /> Orqaga
        </button>
        <h1 className="text-xl font-bold text-gray-900">Reyting</h1>
        <div className="w-20"></div>
      </div>

      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 text-white text-center mb-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
        <Trophy size={48} className="mx-auto mb-3 text-yellow-100" />
        <h2 className="text-2xl font-black mb-1">Top Bilimdonlar</h2>
        <p className="text-yellow-100 font-medium">Eng ko'p to'g'ri javob topganlar</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {leaderboard.map((user, index) => {
          const isCurrentUser = user.telegram_id === userId;
          
          let rankStyle = "bg-gray-100 text-gray-600";
          if (index === 0) rankStyle = "bg-yellow-100 text-yellow-600 border border-yellow-200 shadow-sm";
          if (index === 1) rankStyle = "bg-gray-200 text-gray-700 border border-gray-300 shadow-sm";
          if (index === 2) rankStyle = "bg-orange-100 text-orange-700 border border-orange-200 shadow-sm";

          return (
            <div 
              key={index} 
              className={`flex items-center justify-between p-4 border-b border-gray-50 transition-colors ${isCurrentUser ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${rankStyle}`}>
                  {index + 1}
                </div>
                
                <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {user.profile_photo ? (
                    <img src={user.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={24} className="text-gray-400" />
                  )}
                </div>
                
                <div>
                  <p className={`font-bold text-sm line-clamp-1 ${isCurrentUser ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {user.first_name} {user.last_name}
                    {isCurrentUser && <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Siz</span>}
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{user.total_tests} ta test ishlagan</p>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-emerald-600">{user.correct_answers}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">To'g'ri</p>
              </div>
            </div>
          );
        })}
        
        {leaderboard.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Hali hech kim test ishlamagan
          </div>
        )}
      </div>
    </div>
  );
}
