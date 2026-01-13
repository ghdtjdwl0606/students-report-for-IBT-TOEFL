
import React from 'react';
import { Question, StudentInput, Section } from '../types';

interface Props {
  questions: Question[];
  studentInput: StudentInput;
  setStudentInput: (input: StudentInput) => void;
  onPrev: () => void;
  onSubmit: () => void;
}

const StudentEntry: React.FC<Props> = ({ questions, studentInput, setStudentInput, onPrev, onSubmit }) => {
  const handleAnswerChange = (qId: string, val: string) => {
    setStudentInput({ ...studentInput, answers: { ...studentInput.answers, [qId]: val } });
  };

  // 엔터 키를 누르면 다음 입력 필드로 포커스 이동
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.form || document;
      const inputs = Array.from(form.querySelectorAll('input[type="text"], input[type="number"]')) as HTMLInputElement[];
      const index = inputs.indexOf(e.currentTarget);
      if (index > -1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
        inputs[index + 1].select(); // 텍스트 선택하여 바로 수정 가능하게 함
      } else if (index === inputs.length - 1) {
        // 마지막 입력 필드에서 엔터 시 제출 버튼으로 포커스 혹은 제출
        const submitBtn = document.getElementById('submit-report-btn');
        submitBtn?.focus();
      }
    }
  };

  const renderMCQInputs = (section: Section, title: string, icon: string) => {
    const sectionQs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
    if (sectionQs.length === 0) return null;
    return (
      <div className="mb-10">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i className={`fas ${icon} text-indigo-500`}></i> {title}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
          {sectionQs.map(q => (
            <div key={q.id} className="p-2 bg-white border border-slate-200 rounded-lg text-center transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">#{q.number}</span>
              <input 
                type="text" 
                value={studentInput.answers[q.id] || ''} 
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full text-center font-bold text-indigo-600 outline-none text-sm bg-transparent" 
                placeholder="-" 
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDirectInputs = (section: Section, title: string, icon: string) => {
    const sectionQs = questions.filter(q => q.section === section);
    if (sectionQs.length === 0) return null;
    return (
      <div className="mb-10">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i className={`fas ${icon} text-indigo-500`}></i> {title}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sectionQs.map(q => (
            <div key={q.id} className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
              <div className="flex-1">
                <span className="text-xs font-bold text-indigo-400 block uppercase">{q.category}</span>
                <span className="text-[10px] text-slate-400">만점: {q.points}</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-indigo-100 shadow-sm">
                <input 
                  type="number" 
                  step="0.1" 
                  value={studentInput.answers[q.id] || ''} 
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-16 text-center font-black text-indigo-600 outline-none" 
                  placeholder="0.0" 
                />
                <span className="text-slate-300 font-bold">/</span>
                <span className="text-slate-400 font-bold w-10 text-center">{q.points}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-800">2. 성적 데이터 입력</h2>
        <input 
          type="text" 
          value={studentInput.name} 
          onChange={(e) => setStudentInput({ ...studentInput, name: e.target.value })} 
          onKeyDown={handleKeyDown}
          className="mt-4 w-full md:w-1/2 border-2 border-indigo-100 rounded-2xl px-6 py-4 text-xl font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all" 
          placeholder="학생 이름을 입력하세요" 
          autoFocus
        />
      </div>
      
      <form onSubmit={(e) => e.preventDefault()}>
        {renderMCQInputs('Reading', 'Reading 답안', 'fa-book-open')}
        {renderMCQInputs('Listening', 'Listening 답안', 'fa-headphones')}
        {renderDirectInputs('Speaking', 'Speaking 획득 점수', 'fa-microphone')}
        {renderDirectInputs('Writing', 'Writing 획득 점수', 'fa-pen-nib')}
      </form>

      <div className="mt-12 flex justify-between items-center pt-8 border-t border-slate-100">
        <button onClick={onPrev} className="text-slate-400 hover:text-slate-800 font-bold flex items-center gap-2">
          <i className="fas fa-arrow-left"></i> 설정 변경
        </button>
        <button 
          id="submit-report-btn"
          onClick={onSubmit} 
          disabled={!studentInput.name} 
          className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl disabled:opacity-30 focus:ring-4 focus:ring-indigo-200 outline-none flex items-center gap-3 transition-all active:scale-95"
        >
          성적표 생성하기 <i className="fas fa-check"></i>
        </button>
      </div>
    </div>
  );
};

export default StudentEntry;
