import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Video, Youtube } from 'lucide-react';

export default function Videos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setVideos(data);
        }
      })
      .catch(e => console.error("Failed to load videos:", e));
  }, []);

  return (
    <div className="p-4 max-w-md mx-auto relative min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate('/')} 
          className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Videodarslar</h1>
      </div>

      <div className="space-y-4">
        {videos.length === 0 ? (
          <div className="text-center py-10">
            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
               <Video size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Hozircha videolar yo'q</p>
          </div>
        ) : (
          videos.map(video => (
            <div key={video.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transform hover:scale-[1.01] transition-transform">
              {video.videoId && !video.videoId.startsWith('http') ? (
                <div className="relative w-full pb-[56.25%] bg-black">
                  <iframe 
                    src={`https://www.youtube.com/embed/${video.videoId}`} 
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full border-0"
                  ></iframe>
                </div>
              ) : (
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="block relative w-full pb-[56.25%] bg-gray-100 flex items-center justify-center text-red-500 group">
                   <div className="absolute inset-0 flex items-center justify-center">
                     <Youtube size={48} className="group-hover:scale-110 transition-transform" />
                   </div>
                </a>
              )}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-2 line-clamp-2">{video.title}</h3>
                <p className="text-xs text-gray-500">{new Date(video.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
