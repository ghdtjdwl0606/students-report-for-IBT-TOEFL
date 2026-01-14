import React, { useState, useEffect } from 'react';
import { Question, StudentInput, Section } from './types.ts';
import QuestionSetup from './components/QuestionSetup.tsx';
import StudentEntry from './components/StudentEntry.tsx';
import ReportView from './components/ReportView.tsx';
import { unzlibSync, strFromU8 } from 'fflate';

enum Step {
  SETUP,
  INPUT,
  REPORT
}

const generateInitialQuestions = (): Question[] => {
  const reading: Question[] = Array.from({ length: 30 }, (_, i) => ({
    id: `R-${i + 1}`,
    number: i + 1,
    section: 'Reading',
    category: '일반',
    correctAnswer: '',
    points: 1.00,
    type: 'mcq'
  }));

  const listening: Question[] = Array.from({ length: 30 }, (_, i) => ({
    id: `L-${i + 1}`,
    number: i + 1,
    section: 'Listening',
    category: '일반',
    correctAnswer: '',
    points: 1.00,
    type: 'mcq'
  }));

  return [...reading, ...listening];
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.SETUP);
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(generateInitialQuestions());
  const [studentInput, setStudentInput] = useState<StudentInput>({
    name: '',
    answers: {}
  });

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      // 압축된 새 형식 'r=' 혹은 기존 'report=' 대응
      if (hash && (hash.startsWith('#r=') || hash.startsWith('#report='))) {
        try {
          const isNewFormat = hash.startsWith('#r=');
          const encodedData = isNewFormat ? hash.replace('#r=', '') : hash.replace('#report=', '');
          
          if (isNewFormat) {
            // URL Safe Base64 복원
            const normalizedB64 = encodedData.replace(/-/g, '+').replace(/_/g, '/');
            const binary = atob(normalizedB64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            
            const decompressed = unzlibSync(bytes);
            const jsonStr = strFromU8(decompressed);
            const minified = JSON.parse(jsonStr);
            
            // 데이터 복원 (Hydration)
            const sectionMap: Record<string, Section> = { 'R': 'Reading', 'L': 'Listening', 'S': 'Speaking', 'W': 'Writing' };
            const restoredQuestions: Question[] = minified.q.map((q: any) => ({
              id: q.i,
              number: q.n,
              section: sectionMap[q.s],
              category: q.c,
              correctAnswer: q.a,
              points: q.p,
              type: q.t === 0 ? 'mcq' : 'direct'
            }));
            
            setQuestions(restoredQuestions);
            setStudentInput({
              name: minified.s.n,
              answers: minified.s.a
            });
          } else {
            // 구식 형식 (하위 호환)
            const decodedStr = decodeURIComponent(escape(window.atob(decodeURIComponent(encodedData))));
            const decodedData = JSON.parse(decodedStr);
            setQuestions(decodedData.questions);
            setStudentInput(decodedData.studentInput);
          }
          
          setCurrentStep(Step.REPORT);
          setIsSharedMode(true);
        } catch (e) {
          console.error("Failed to decode share link", e);
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleReset = () => {
    if (isSharedMode) {
      window.location.hash = '';
      setIsSharedMode(false);
      setCurrentStep(Step.SETUP);
      setQuestions(generateInitialQuestions());
      setStudentInput({ name: '', answers: {} });
    } else {
      setStudentInput({ name: '', answers: {} });
      setCurrentStep(Step.INPUT);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fas fa-graduation-cap text-lg"></i>
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">TOEFL 스마트 성적표</h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">4-Section Analysis Tool</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: Step.SETUP, label: '정보 설정', icon: 'fa-cog' },
              { id: Step.INPUT, label: '데이터 입력', icon: 'fa-edit' },
              { id: Step.REPORT, label: '결과 리포트', icon: 'fa-chart-pie' }
            ].map((s) => (
              <button
                key={s.id}
                disabled={currentStep < s.id && !isSharedMode}
                onClick={() => !isSharedMode && setCurrentStep(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  currentStep === s.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className={`fas ${s.icon}`}></i> {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-10">
        {currentStep === Step.SETUP && (
          <QuestionSetup questions={questions} setQuestions={setQuestions} onNext={() => setCurrentStep(Step.INPUT)} />
        )}
        {currentStep === Step.INPUT && (
          <StudentEntry questions={questions} studentInput={studentInput} setStudentInput={setStudentInput} onPrev={() => setCurrentStep(Step.SETUP)} onSubmit={() => setCurrentStep(Step.REPORT)} />
        )}
        {currentStep === Step.REPORT && (
          <ReportView questions={questions} studentInput={studentInput} onReset={handleReset} isShared={isSharedMode} />
        )}
      </main>
    </div>
  );
};

export default App;