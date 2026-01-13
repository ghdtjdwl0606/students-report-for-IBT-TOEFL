
import React, { useEffect, useState, useRef } from 'react';
import { EvaluationResult, Question, StudentInput, Section, CategoryResult } from '../types.ts';
import { getStudentFeedback } from '../services/geminiService.ts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  questions: Question[];
  studentInput: StudentInput;
  onReset: () => void;
  isShared?: boolean;
}

const utf8_to_b64 = (str: string) => window.btoa(unescape(encodeURIComponent(str)));

const ReportView: React.FC<Props> = ({ questions, studentInput, onReset, isShared }) => {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    calculateResults();
  }, [questions, studentInput]);

  const calculateResults = async () => {
    setLoading(true);
    const isCorrect: Record<string, boolean> = {};
    const sectionTotals: Record<Section, { earned: number; max: number }> = {
      Reading: { earned: 0, max: 0 },
      Listening: { earned: 0, max: 0 },
      Speaking: { earned: 0, max: 0 },
      Writing: { earned: 0, max: 0 }
    };
    
    const categoryMap: Record<string, CategoryResult> = {};

    questions.forEach(q => {
      const studentVal = (studentInput.answers[q.id] || '').trim();
      
      if (q.type === 'mcq') {
        const correct = studentVal.toLowerCase() === (q.correctAnswer || '').toLowerCase() && studentVal !== '';
        isCorrect[q.id] = correct;
        sectionTotals[q.section].max += q.points;
        if (correct) sectionTotals[q.section].earned += q.points;
      } else {
        const earned = parseFloat(studentVal) || 0;
        sectionTotals[q.section].max += q.points;
        sectionTotals[q.section].earned += Math.min(earned, q.points);
      }

      const key = `${q.section}-${q.category}`;
      if (!categoryMap[key]) {
        categoryMap[key] = { section: q.section, category: q.category, totalQuestions: 0, correctCount: 0, percentage: 0, maxPoints: 0 };
      }
      categoryMap[key].totalQuestions += 1;
      categoryMap[key].maxPoints += q.points;
      
      if (q.type === 'mcq') {
        if (isCorrect[q.id]) categoryMap[key].correctCount += q.points;
      } else {
        categoryMap[key].correctCount += parseFloat(studentVal) || 0;
      }
    });

    Object.values(categoryMap).forEach(cat => {
      cat.percentage = (cat.correctCount / cat.maxPoints) * 100 || 0;
    });

    const scaledScore = (section: Section) => {
      const { earned, max } = sectionTotals[section];
      if (max === 0) return 0;
      return Math.floor((earned / max) * 30);
    };

    const sR = scaledScore('Reading');
    const sL = scaledScore('Listening');
    const sS = scaledScore('Speaking');
    const sW = scaledScore('Writing');

    const finalResult: EvaluationResult = {
      studentName: studentInput.name,
      sectionScores: {
        Reading: sR,
        Listening: sL,
        Speaking: sS,
        Writing: sW
      },
      totalScore: Math.floor(sR + sL + sS + sW),
      maxScore: 120,
      categoryResults: Object.values(categoryMap),
      isCorrect,
      scoreR: sR,
      scoreL: sL,
      actualEarnedPoints: Object.values(sectionTotals).reduce((acc, s) => acc + s.earned, 0)
    };

    setResult(finalResult);
    
    try {
      const feedback = await getStudentFeedback(finalResult);
      setAiFeedback(feedback);
    } catch (err: any) {
      if (err.message === "API_KEY_MISSING") setNeedsApiKey(true);
      else setAiFeedback("분석 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !result) return;
    setIsGeneratingPdf(true);
    
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${result.studentName}_Detailed_Report.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderSectionDetail = (section: Section, color: string, icon: string) => {
    if (!result) return null;
    const score = result.sectionScores[section];
    const categories = result.categoryResults.filter(c => c.section === section);

    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
        <div className={`p-6 bg-gradient-to-r ${color} text-white flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className={`fas ${icon} text-lg`}></i>
            </div>
            <div>
              <h3 className="font-black text-xl leading-tight">{section}</h3>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Performance Analysis</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black">{score}</span>
            <span className="text-xs font-bold opacity-60"> / 30</span>
          </div>
        </div>
        
        <div className="p-8 flex-1">
          <h4 className="text-xs font-black text-slate-400 uppercase mb-5 tracking-widest flex items-center gap-2">
            <i className="fas fa-layer-group text-slate-300"></i> 세부 항목별 성취도
          </h4>
          <div className="space-y-5">
            {categories.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-sm font-bold text-slate-700">{cat.category}</span>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{Math.round(cat.percentage)}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`} 
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm italic">평가 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!result) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex justify-end gap-3 no-print">
        <button 
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf || loading}
          className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {isGeneratingPdf ? (
            <>
              <i className="fas fa-circle-notch animate-spin"></i> 생성 중...
            </>
          ) : (
            <>
              <i className="fas fa-file-pdf"></i> PDF 리포트 다운로드
            </>
          )}
        </button>
        <button onClick={() => {
          const data = { questions, studentInput };
          const encoded = encodeURIComponent(utf8_to_b64(JSON.stringify(data)));
          navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#report=${encoded}`);
          alert("링크가 복사되었습니다.");
        }} className="bg-white border border-slate-200 px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all">공유 링크 복사</button>
      </div>

      <div ref={reportRef} className="space-y-6 p-1">
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -mr-20 -mt-20"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
            <div>
              <h2 className="text-4xl font-black mb-3">{result.studentName} 학생 성적 리포트</h2>
              <p className="text-slate-400 font-bold max-w-md leading-relaxed">
                본 리포트는 IBT TOEFL 기준에 따라 학생의 4대 영역 성취도를 정밀하게 분석한 결과입니다.
              </p>
            </div>
            <div className="bg-white text-slate-900 rounded-[2.5rem] p-8 text-center min-w-[220px] shadow-2xl border-4 border-indigo-500/20">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Scaled Score</span>
              <div className="text-7xl font-black text-indigo-600 my-1">{result.totalScore}</div>
              <div className="text-slate-300 font-bold">out of 120</div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Reading', score: result.sectionScores.Reading, color: 'text-blue-400', icon: 'fa-book-open' },
              { label: 'Listening', score: result.sectionScores.Listening, color: 'text-emerald-400', icon: 'fa-headphones' },
              { label: 'Speaking', score: result.sectionScores.Speaking, color: 'text-orange-400', icon: 'fa-microphone' },
              { label: 'Writing', score: result.sectionScores.Writing, color: 'text-purple-400', icon: 'fa-pen-nib' }
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center ${s.color}`}>
                  <i className={`fas ${s.icon} text-xl`}></i>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{s.label}</span>
                  <div className="text-2xl font-black">{s.score} <span className="text-xs font-bold text-white/30">/ 30</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold flex items-center gap-2">
                 <i className="fas fa-chart-line text-indigo-500"></i> 종합 학습 진단
               </h3>
             </div>
             <div className="bg-slate-50 rounded-3xl p-7 border border-slate-100 min-h-[120px] text-slate-700 leading-relaxed text-lg">
               {loading ? (
                 <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
                   <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                   <p className="text-xs font-bold text-indigo-400 font-sans">데이터 분석 중...</p>
                 </div>
               ) : needsApiKey ? (
                 <div className="text-center py-10 text-slate-400">분석 기능을 사용하려면 관리자에게 문의하세요.</div>
               ) : (
                 <p className="font-medium whitespace-pre-line">{aiFeedback}</p>
               )}
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderSectionDetail('Reading', 'from-blue-600 to-indigo-700', 'fa-book-open')}
          {renderSectionDetail('Listening', 'from-emerald-500 to-teal-600', 'fa-headphones')}
          {renderSectionDetail('Speaking', 'from-orange-500 to-red-600', 'fa-microphone')}
          {renderSectionDetail('Writing', 'from-purple-600 to-pink-600', 'fa-pen-nib')}
        </div>
      </div>

      <div className="flex justify-center pt-10 no-print">
        <button onClick={onReset} className="bg-slate-900 text-white px-16 py-5 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">
          {isShared ? "나의 성적표도 만들기" : "새로운 데이터 입력하기"}
        </button>
      </div>
    </div>
  );
};

export default ReportView;
