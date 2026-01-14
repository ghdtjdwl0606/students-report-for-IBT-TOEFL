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
      if (!hash) return;

      try {
        if (hash.startsWith('#s=')) {
          const b64 = hash.replace('#s=', '').replace(/-/g, '+').replace(/_/g, '/');
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const decompressed = unzlibSync(bytes);
          const compact = JSON.parse(strFromU8(decompressed));

          const [name, rData, lData, sData, wData] = compact;
          const restoredQs: Question[] = [];
          const restoredAns: Record<string, string> = {};

          const unpackMCQ = (section: Section, data: any[]) => {
            const [keys, ans, cats, pts] = data;
            const prefix = section[0];
            keys.forEach((key: any, i: number) => {
              const id = `${prefix}-${i + 1}`;
              restoredQs.push({
                id,
                number: i + 1,
                section,
                category: String(cats[i] || '일반'),
                correctAnswer: String(key || '').trim(),
                points: (pts[i] && pts[i] !== '') ? parseFloat(pts[i]) : 1.0,
                type: 'mcq'
              });
              restoredAns[id] = String(ans[i] || '').trim();
            });
          };

          const unpackDirect = (section: Section, data: any[]) => {
            const prefix = section[0];
            data.forEach((item: any[], idx: number) => {
              const id = `${prefix}-D-${idx}`;
              restoredQs.push({
                id,
                number: idx + 1,
                section,
                category: String(item[0]),
                points: parseFloat(item[1]) || 5.0,
                type: 'direct'
              });
              restoredAns[id] = String(item[2]);
            });
          };

          unpackMCQ('Reading', rData);
          unpackMCQ('Listening', lData);
          unpackDirect('Speaking', sData);
          unpackDirect('Writing', wData);

          setQuestions(restoredQs);
          setStudentInput({ name: String(name), answers: restoredAns });
          setCurrentStep(Step.REPORT);
          setIsSharedMode(true);
          return;
        }

        // 기존 구형 포맷 하위 호환
        const isOldReport = hash.startsWith('#report=');
        if (isOldReport) {
          const encodedData = hash.replace('#report=', '');
          const decodedStr = decodeURIComponent(escape(window.atob(decodeURIComponent(encodedData))));
          const data = JSON.parse(decodedStr);
          setQuestions(data.questions);
          setStudentInput(data.studentInput);
          setCurrentStep(Step.REPORT);
          setIsSharedMode(true);
        }
      } catch (e) {
        console.error("Link decode failed", e);
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