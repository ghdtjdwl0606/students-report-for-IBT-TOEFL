import React, { useState } from 'react';
import { Question, Section } from '../types.ts';

interface Props {
  questions: Question[];
  setQuestions: (qs: Question[]) => void;
  onNext: () => void;
}

const QuestionSetup: React.FC<Props> = ({ questions, setQuestions, onNext }) => {
  const [showBulk, setShowBulk] = useState<Record<string, boolean>>({});
  const [bulkInput, setBulkInput] = useState<Record<string, string>>({});

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleBulkPasteMCQ = (section: Section) => {
    const text = bulkInput[section] || "";
    if (!text.trim()) return;

    const rows = text.split('\n').filter(row => row.trim() !== "");
    const sectionQs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
    
    const newQuestions = [...questions];

    rows.forEach((row, index) => {
      if (index < sectionQs.length) {
        const targetQ = sectionQs[index];
        const cells = row.split('\t'); 
        
        let category = targetQ.category;
        let answer = targetQ.correctAnswer;
        let points = targetQ.points;

        if (cells.length === 1) {
          answer = cells[0].trim();
        } else if (cells.length === 2) {
          category = cells[0].trim();
          answer = cells[1].trim();
        } else if (cells.length >= 3) {
          category = cells[0].trim();
          answer = cells[1].trim();
          points = parseFloat(cells[2].trim()) || targetQ.points;
        }

        const qIndex = newQuestions.findIndex(q => q.id === targetQ.id);
        if (qIndex !== -1) {
          newQuestions[qIndex] = {
            ...newQuestions[qIndex],
            category,
            correctAnswer: answer,
            points
          };
        }
      }
    });

    setQuestions(newQuestions);
    setShowBulk({ ...showBulk, [section]: false });
    setBulkInput({ ...bulkInput, [section]: "" });
    alert(`${section} 섹션의 ${Math.min(rows.length, sectionQs.length)}개 문항 데이터가 업데이트되었습니다.`);
  };

  const handleBulkPasteDirect = (section: Section) => {
    const text = bulkInput[section] || "";
    if (!text.trim()) return;

    const rows = text.split('\n').filter(row => row.trim() !== "");
    const otherSectionsQs = questions.filter(q => q.section !== section);
    
    const newDirectItems: Question[] = rows.map((row, index) => {
      const cells = row.split('\t');
      const category = cells[0]?.trim() || `Task ${index + 1}`;
      const points = cells[1] ? parseFloat(cells[1].trim()) || 5.0 : 5.0;
      
      return {
        id: `${section.charAt(0)}-Direct-${Date.now()}-${index}`,
        number: index + 1,
        section,
        category,
        points,
        type: 'direct'
      };
    });

    setQuestions([...otherSectionsQs, ...newDirectItems]);
    setShowBulk({ ...showBulk, [section]: false });
    setBulkInput({ ...bulkInput, [section]: "" });
    alert(`${section} 섹션에 ${newDirectItems.length}개의 평가 항목이 새로 설정되었습니다.`);
  };

  const addDirectItem = (section: Section) => {
    const sectionItems = questions.filter(q => q.section === section);
    const newId = `${section.charAt(0)}-Direct-${Date.now()}`;
    const newItem: Question = {
      id: newId,
      number: sectionItems.length + 1,
      section,
      category: `Task ${sectionItems.length + 1}`,
      points: 5.0,
      type: 'direct'
    };
    setQuestions([...questions, newItem]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const renderMCQSection = (section: Section, title: string, color: string) => {
    const sectionQs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
    const isBulkOpen = showBulk[section];

    return (
      <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className={`px-6 py-4 flex justify-between items-center bg-gradient-to-r ${color} text-white`}>
          <h3 className="font-bold flex items-center gap-2">
            <i className={`fas ${section === 'Reading' ? 'fa-book-open' : 'fa-headphones'}`}></i> {title}
          </h3>
          <button 
            onClick={() => setShowBulk({ ...showBulk, [section]: !isBulkOpen })}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
          >
            <i className="fas fa-file-excel"></i> 엑셀 붙여넣기
          </button>
        </div>

        {isBulkOpen && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <p className="text-[11px] text-slate-500 mb-2 font-medium">
              형식: 카테고리 [탭] 정답 [탭] 배점
            </p>
            <textarea 
              value={bulkInput[section] || ""}
              onChange={(e) => setBulkInput({ ...bulkInput, [section]: e.target.value })}
              className="w-full h-32 p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="엑셀에서 복사한 데이터를 붙여넣으세요..."
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowBulk({ ...showBulk, [section]: false })} className="text-xs font-bold text-slate-400 px-3 py-2">취소</button>
              <button 
                onClick={() => handleBulkPasteMCQ(section)}
                className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm"
              >
                데이터 적용하기
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 w-16 text-center">번호</th>
                <th className="px-4 py-3">영역/카테고리</th>
                <th className="px-4 py-3">정답</th>
                <th className="px-4 py-3 w-24">배점</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectionQs.map(q => (
                <tr key={q.id}>
                  <td className="px-4 py-3 text-center font-bold text-slate-400">{q.number}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={q.category} onChange={(e) => updateQuestion(q.id, 'category', e.target.value)} className="w-full border-none focus:ring-0 bg-transparent" placeholder="영역 입력" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={q.correctAnswer} onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)} className="w-full border-none focus:ring-0 bg-transparent font-bold" placeholder="정답" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" step="0.1" value={q.points} onChange={(e) => updateQuestion(q.id, 'points', parseFloat(e.target.value) || 0)} className="w-full border-none focus:ring-0 bg-transparent font-medium" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDirectSection = (section: Section, title: string, color: string) => {
    const sectionQs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
    const isBulkOpen = showBulk[section];

    return (
      <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className={`px-6 py-4 flex justify-between items-center bg-gradient-to-r ${color} text-white`}>
          <h3 className="font-bold flex items-center gap-2">
            <i className={`fas ${section === 'Speaking' ? 'fa-microphone' : 'fa-pen-nib'}`}></i> {title}
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowBulk({ ...showBulk, [section]: !isBulkOpen })}
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
            >
              <i className="fas fa-file-excel"></i> 엑셀 붙여넣기
            </button>
            <button onClick={() => addDirectItem(section)} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>

        {isBulkOpen && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <p className="text-[11px] text-slate-500 mb-2 font-medium">
              형식: 평가 항목명 [탭] 만점 (예: Delivery [탭] 5)
            </p>
            <textarea 
              value={bulkInput[section] || ""}
              onChange={(e) => setBulkInput({ ...bulkInput, [section]: e.target.value })}
              className="w-full h-32 p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="엑셀 데이터를 붙여넣으면 기존 항목이 대체됩니다..."
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowBulk({ ...showBulk, [section]: false })} className="text-xs font-bold text-slate-400 px-3 py-2">취소</button>
              <button 
                onClick={() => handleBulkPasteDirect(section)}
                className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm"
              >
                리스트 재구성하기
              </button>
            </div>
          </div>
        )}

        <div className="p-4">
          {sectionQs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic text-sm">항목을 추가하여 평가를 구성하세요.</div>
          ) : (
            <div className="space-y-3">
              {sectionQs.map(q => (
                <div key={q.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">영역 명칭</label>
                    <input type="text" value={q.category} onChange={(e) => updateQuestion(q.id, 'category', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">만점</label>
                    <input type="number" step="0.1" value={q.points} onChange={(e) => updateQuestion(q.id, 'points', parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-medium" />
                  </div>
                  {/* Fixed: Removed incorrect named parameter syntax 'id: q.id' which was causing syntax and parsing errors */}
                  <button onClick={() => removeQuestion(q.id)} className="mt-4 p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <i className="fas fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">1. 시험 구성 및 정보 설정</h2>
        <p className="text-slate-500 mt-1">Reading/Listening은 문항별 정답을, Speaking/Writing은 평가 항목을 설정하세요.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {renderMCQSection('Reading', 'Reading Section', 'from-blue-500 to-indigo-600')}
          {renderMCQSection('Listening', 'Listening Section', 'from-emerald-500 to-teal-600')}
        </div>
        <div className="space-y-6">
          {renderDirectSection('Speaking', 'Speaking Section', 'from-orange-500 to-red-600')}
          {renderDirectSection('Writing', 'Writing Section', 'from-purple-500 to-pink-600')}
        </div>
      </div>
      <div className="mt-10 flex justify-end">
        <button onClick={onNext} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold shadow-xl active:scale-95 flex items-center gap-3">
          다음 단계: 점수 및 답안 입력 <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default QuestionSetup;