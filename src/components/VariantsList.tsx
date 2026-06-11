import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PlayCircle } from 'lucide-react';

export default function VariantsList({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [variants, setVariants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/variants')
      .then(res => res.json())
      .then(data => {
        setVariants(data);
        setIsLoading(false);
      })
      .catch(e => {
        console.error('Failed to load variants:', e);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6 relative">
        <button onClick={() => navigate('/')} className="bg-white p-2.5 rounded-full shadow-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Barcha Variantlar</h1>
      </div>

      <div className="space-y-3">
        {isLoading ? (
           <div className="flex justify-center p-8">
             <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
           </div>
        ) : variants.length === 0 ? (
          <p className="text-center text-gray-500 py-8 bg-white rounded-2xl shadow-sm border border-gray-100">Hozircha variantlar yo'q</p>
        ) : (
          variants.map((v) => (
            <div key={v.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-purple-200 transition-colors">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{v.name}</h3>
                <p className="text-sm text-gray-500">{new Date(v.created_at).toLocaleDateString()}</p>
                <p className="text-xs font-medium text-purple-600 mt-1">{v.testIds?.length || 10} ta savol</p>
              </div>
              <button 
                onClick={() => navigate(`/test/variant-${v.id}`)}
                className="bg-purple-100 text-purple-700 w-12 h-12 rounded-full flex items-center justify-center hover:bg-purple-200 active:scale-95 transition-all outline-none"
              >
                <PlayCircle size={28} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
