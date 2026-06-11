import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Test } from '../types';
import { CheckCircle, XCircle, Clock, ArrowRight, Flag } from 'lucide-react';

export default function TestSession({ userId }: { userId: string }) {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<{ correct: number; wrong: number; time: number }>({ correct: 0, wrong: 0, time: 0 });
  const [startTime, setStartTime] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTests = async () => {
    setLoading(true);
    try {
      if (type?.startsWith('variant-')) {
        const variantId = type.split('-')[1];
        const res = await fetch(`/api/variants/${variantId}/tests`);
        if (res.ok) {
           const data = await res.json();
           setTests(data);
        }
      } else {
        const limit = type === '10' ? 10 : 1;
        const res = await fetch(`/api/tests/random?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          if (type === 'cheksiz') {
            setTests(prev => [...prev, ...data]);
          } else {
            setTests(data);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch tests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleAnswer = (ans: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(ans);
    
    const isCorrect = ans === tests[currentIndex].correct_answer;
    setResults(prev => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      wrong: !isCorrect ? prev.wrong + 1 : prev.wrong
    }));

    if (type === '10' || type?.startsWith('variant-')) {
      setTimeout(() => {
        if (currentIndex < tests.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setSelectedAnswer(null);
        } else {
          finishTest(isCorrect, ans);
        }
      }, 500);
    }
  };

  const nextQuestion = () => {
    if (type === 'cheksiz') {
      fetchTests();
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
    }
  };

  const finishTest = async (lastIsCorrect?: boolean, lastAns?: string) => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    // Calculate final correct/wrong including the last answer if passed
    let finalCorrect = results.correct;
    let finalWrong = results.wrong;
    
    if (lastIsCorrect !== undefined) {
       // Called from setTimeout in handleAnswer. `results` is stale.
       finalCorrect = results.correct + (lastIsCorrect ? 1 : 0);
       finalWrong = results.wrong + (!lastIsCorrect ? 1 : 0);
    } else {
       // Called from "Yakunlash" button. `results` is already up-to-date.
       finalCorrect = results.correct;
       finalWrong = results.wrong;
    }

    setResults({ correct: finalCorrect, wrong: finalWrong, time: timeSpent });
    setIsFinished(true);

    try {
      await fetch('/api/tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: userId,
          correct: finalCorrect,
          wrong: finalWrong,
          time_spent: timeSpent
        })
      });
    } catch (e) {
      console.error('Failed to submit test results:', e);
    }
  };

  if (loading && tests.length === 0) {
    return <div className="flex justify-center items-center h-[100dvh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (!loading && tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-gray-50 p-4 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Testlar mavjud emas</h2>
        <p className="text-gray-600 mb-6">Hozircha bazada testlar yo'q yoki yetarli emas. Iltimos, keyinroq urinib ko'ring.</p>
        <button 
          onClick={() => navigate('/')} 
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Asosiy menyuga qaytish
        </button>
      </div>
    );
  }

  if (!loading && type === '10' && tests.length < 10) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-gray-50 p-4 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Testlar yetarli emas</h2>
        <p className="text-gray-600 mb-6">"Test 10" rejimida ishlash uchun bazada kamida 10 ta test bo'lishi kerak. Hozirda faqat {tests.length} ta test mavjud.</p>
        <button 
          onClick={() => navigate('/')} 
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Asosiy menyuga qaytish
        </button>
      </div>
    );
  }

  if (isFinished) {
    let feedback = null;
    if (type === '10' || type?.startsWith('variant-')) {
      const total = results.correct + results.wrong;
      const percentage = (results.correct / total) * 100;
      if (percentage < 50) {
        feedback = (
          <>
            Natija yomonku. O'z ustingizda ko'p ishlashingizga to'g'ri keladi.{' '}
            <a href="https://t.me/Majburiy_Matematika_BMBA" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">
              @Majburiy_Matematika_BMBA
            </a>{' '}
            kanalini kuzatib boring. Va online kursiga qo'shiling. Albatta natijaga erishasiz.
          </>
        );
      } else if (percentage < 70) {
        feedback = (
          <>
            Natija yomonmas. Lekin yaxshi ham deb bo'lmaydi.{' '}
            <a href="https://t.me/Majburiy_Matematika_BMBA" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">
              @Majburiy_Matematika_BMBA
            </a>{' '}
            kanalini kuzatib boring. Har kuni Majburiy Matematika uchun test bo'lib o'tadi. Albatta tahlili ham bo'ladi.
          </>
        );
      } else {
        feedback = (
          <>
            Ajoyib.{' '}
            <a href="https://t.me/Majburiy_Matematika_BMBA" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">
              @Majburiy_Matematika_BMBA
            </a>{' '}
            kanalida bo'layotgan har kunlik testlar va test tahlillari orqali bilimingizni yanada mustahkamlab boring.
          </>
        );
      }
    }

    return (
      <div className="p-4 max-w-md mx-auto min-h-[100dvh] flex flex-col justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Flag size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test yakunlandi!</h2>
          
          <div className="grid grid-cols-2 gap-4 my-6">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-3xl font-bold text-emerald-600">{results.correct}</p>
              <p className="text-sm text-emerald-800 font-medium">To'g'ri</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <p className="text-3xl font-bold text-red-600">{results.wrong}</p>
              <p className="text-sm text-red-800 font-medium">Xato</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-gray-600 mb-6 bg-gray-50 py-3 rounded-lg">
            <Clock size={18} />
            <span className="font-medium">{Math.floor(results.time / 60)} daqiqa {results.time % 60} soniya</span>
          </div>

          {feedback && (
            <div className="bg-indigo-50 p-4 rounded-xl text-indigo-800 text-sm leading-relaxed mb-6 text-left border border-indigo-100">
              {feedback}
            </div>
          )}

          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-md active:scale-95 transition-transform"
          >
            Asosiy menyuga qaytish
          </button>
        </div>
      </div>
    );
  }

  const currentTest = tests[currentIndex];
  if (!currentTest) {
    return <div className="flex justify-center items-center h-[100dvh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-24">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-bold">
          {type === '10' ? `Savol ${currentIndex + 1}/10` : `Savol ${currentIndex + 1}`}
        </span>
        <span className="text-gray-500 text-sm font-medium">ID: {currentTest.id}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        {currentTest.image_url ? (
          <img src={currentTest.image_url} alt="Test" className="w-full h-auto" />
        ) : (
          <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400">Rasm yuklanmadi</div>
        )}
        <div className="p-4 bg-indigo-50 border-t border-indigo-100 text-center">
          <a href="https://t.me/Majburiy_Matematika_BMBA" target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm font-bold hover:underline">
            @Majburiy_Matematika_BMBA kanaliga obuna bo'ling
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {['A', 'B', 'C', 'D'].map(ans => {
          let btnClass = "bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-300";
          
          if (selectedAnswer) {
            if (type === '10') {
              // For type 10, only highlight the selected answer, don't show correct/wrong
              if (ans === selectedAnswer) {
                btnClass = "bg-indigo-50 border-2 border-indigo-500 text-indigo-700";
              } else {
                btnClass = "bg-gray-50 border-2 border-gray-200 text-gray-400 opacity-50";
              }
            } else {
              // For other types (cheksiz), show correct/wrong immediately
              if (ans === currentTest.correct_answer) {
                btnClass = "bg-emerald-50 border-2 border-emerald-500 text-emerald-700";
              } else if (ans === selectedAnswer) {
                btnClass = "bg-red-50 border-2 border-red-500 text-red-700";
              } else {
                btnClass = "bg-gray-50 border-2 border-gray-200 text-gray-400 opacity-50";
              }
            }
          }

          return (
            <button
              key={ans}
              onClick={() => handleAnswer(ans)}
              disabled={!!selectedAnswer}
              className={`py-4 rounded-xl text-xl font-bold transition-all ${btnClass}`}
            >
              {ans}
            </button>
          );
        })}
      </div>

      {type === 'cheksiz' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-gray-200 flex gap-3 max-w-md mx-auto">
          <button 
            onClick={() => finishTest()}
            className="flex-1 py-3 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100"
          >
            Yakunlash
          </button>
          <button 
            onClick={nextQuestion}
            disabled={!selectedAnswer}
            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${selectedAnswer ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
          >
            Keyingisi <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
