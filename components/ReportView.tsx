import React, { useEffect, useState, useRef } from 'react';
import { EvaluationResult, Question, StudentInput, Section, CategoryResult } from '../types.ts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { zlibSync, strToU8 } from 'fflate';

interface Props {
  questions: Question[];
  studentInput: StudentInput;
  onReset: () => void;
  isShared?: boolean;
}

const CATEGORY_DESCRIPTIONS: Record<string, Record<string, string>> = {
  Reading: {
    "Vocabulary": "지문 속 특정 단어나 구절의 의미를 묻습니다. 문맥상 가장 적절한 의미를 찾는 능력을 평가합니다.",
    "Detail": "지문에 명시된 사실, 데이터, 세부 정보를 정확히 파악했는지 평가합니다.",
    "Reference": "대명사가 가리키는 대상을 논리적으로 파악하는 능력을 평가합니다.",
    "Sentence Simplification": "복잡한 문장의 핵심 의미를 요약하는 능력을 평가합니다.",
    "Rhetorical Purpose": "작가가 특정 표현을 사용한 의도나 기능을 파악하는지 봅니다.",
    "Inference": "정보를 바탕으로 논리적으로 유추할 수 있는 내용을 찾는 능력을 평가합니다.",
    "Sentence Insertion": "문맥의 흐름을 파악하여 문장이 들어갈 적절한 위치를 찾는 능력입니다.",
    "Prose Summary": "지문 전체의 핵심 내용을 요약적으로 파악하는 능력을 평가합니다."
  },
  Listening: {
    "Main Idea": "대화나 강의의 전체적인 주제나 목적을 파악하는 능력을 평가합니다.",
    "Inference": "주어진 정보를 통해 논리적으로 유출할 수 있는 결론을 묻습니다.",
    "Function": "특정 표현을 사용한 의도나 기능을 다시 듣고 파악하는 능력입니다.",
    "Detail": "강의나 대화 중 언급된 구체적인 사실이나 정의를 파악하는 능력입니다.",
    "Organization": "강의의 전체적인 구조나 전개 방식을 파악하는 능력입니다.",
    "Speaker's Attitude": "화자의 어조나 선택 단어를 통해 태도와 감정을 파악하는 능력입니다."
  },
  Speaking: {
    "Information Selection": "핵심 정보를 정확히 추출하여 답변에 포함하는 능력을 평가합니다.",
    "Language & Grammar": "어휘의 다양성과 문법적 정확도를 평가합니다.",
    "Organization": "답변의 논리적 흐름과 체계적인 구조를 평가합니다.",
    "Fluency": "발음, 억양 및 말하기의 자연스러운 속도를 평가합니다."
  },
  Writing: {
    "Topic Development": "주장을 뒷받침하는 구체적인 근거와 예시의 적절성을 평가합니다.",
    "Organization": "글의 논리적 순서와 단락 간의 매끄러운 연결을 평가합니다.",
    "Language": "학술적 상황에 맞는 적절하고 다양한 어휘 구사력을 평가합니다.",
    "Grammar": "문장 구조의 다양성과 문법적 정확도를 평가합니다."
  }
};

const ReportView: React.FC<Props> = ({ questions, studentInput, onReset, isShared }) => {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    calculateResults();
  }, [questions, studentInput]);

  const calculateResults = () => {
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
      sectionScores: { Reading: sR, Listening: sL, Speaking: sS, Writing: sW },
      totalScore: Math.floor(sR + sL + sS + sW),
      maxScore: 120,
      categoryResults: Object.values(categoryMap),
      isCorrect,
      scoreR: sR,
      scoreL: sL,
      actualEarnedPoints: Object.values(sectionTotals).reduce((acc, s) => acc + s.earned, 0)
    };
    setResult(finalResult);
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !result) return;
    setIsGeneratingPdf(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 3, // 초고화질
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
        windowWidth: 1200 // PC 레이아웃 고정 캡처
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / (imgWidth / 3); // scale 3 고려
      const totalPdfHeightInMm = (imgHeight / 3) * ratio;

      let heightLeft = totalPdfHeightInMm;
      let position = 0;

      // 첫 페이지
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeightInMm);
      heightLeft -= pdfHeight;

      // 추가 페이지 처리 (내용이 길 경우)
      while (heightLeft > 0) {
        position = heightLeft - totalPdfHeightInMm;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeightInMm);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${result.studentName}_TOEFL_Report.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyLink = () => {
    const packMCQ = (section: Section) => {
      const qs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
      return [
        qs.map(q => q.correctAnswer || ''),
        qs.map(q => studentInput.answers[q.id] || ''),
        qs.map(q => q.category === '일반' ? '' : q.category),
        qs.map(q => q.points === 1 ? '' : q.points.toString())
      ];
    };

    const packDirect = (section: Section) => {
      return questions.filter(q => q.section === section).map(q => [
        q.category,
        q.points,
        studentInput.answers[q.id] || '0'
      ]);
    };

    const ultraCompact = [
      studentInput.name,
      packMCQ('Reading'),
      packMCQ('Listening'),
      packDirect('Speaking'),
      packDirect('Writing')
    ];
    
    try {
      const jsonStr = JSON.stringify(ultraCompact);
      const compressed = zlibSync(strToU8(jsonStr));
      const b64 = btoa(String.fromCharCode(...compressed))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const shareUrl = `${window.location.origin}${window.location.pathname}#s=${b64}`;
      navigator.clipboard.writeText(shareUrl);
      alert("공유 링크가 복사되었습니다.");
    } catch (e) {
      console.error(e);
      alert("링크 생성 실패");
    }
  };

  const renderSectionDetail = (section: Section, color: string, icon: string) => {
    if (!result) return null;
    const score = result.sectionScores[section];
    const categories = result.categoryResults.filter(c => c.section === section);

    return (
      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
        <div className={`p-5 md:p-6 bg-gradient-to-r ${color} text-white flex justify-between items-center`}>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center">
              <i className={`fas ${icon} text-sm md:text-lg`}></i>
            </div>
            <div>
              <h3 className="font-black text-lg md:text-xl leading-tight">{section}</h3>
              <p className="text-[9px] md:text-[10px] font-bold opacity-80 uppercase tracking-wider">Analysis</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl md:text-3xl font-black">{score}</span>
            <span className="text-[10px] md:text-xs font-bold opacity-60"> / 30</span>
          </div>
        </div>
        
        <div className="p-6 md:p-8 flex-1">
          <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-4 md:mb-5 tracking-widest flex items-center gap-2">
            <i className="fas fa-layer-group text-slate-300"></i> 세부 항목별 성취도
          </h4>
          <div className="space-y-4 md:space-y-5">
            {categories.map((cat, i) => {
              const description = CATEGORY_DESCRIPTIONS[section]?.[cat.category];
              return (
                <div key={i} className="group relative">
                  <div className="flex justify-between items-center mb-1.5 md:mb-2 px-1">
                    <div className="flex items-center gap-1.5 cursor-help">
                      <span className="text-xs md:text-sm font-bold text-slate-700 underline decoration-slate-200 decoration-dotted underline-offset-4">
                        {cat.category}
                      </span>
                      {description && (
                        <i className="fas fa-info-circle text-[9px] md:text-[10px] text-slate-300"></i>
                      )}
                    </div>
                    <span className="text-[10px] md:text-xs font-black text-indigo-600 bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded-md">{Math.round(cat.percentage)}%</span>
                  </div>
                  <div className="h-2 md:h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`} 
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!result) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 px-2 md:px-0 pb-20">
      <div className="flex flex-col sm:flex-row justify-end gap-2 md:gap-3 no-print">
        <button 
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="bg-indigo-600 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 text-sm md:text-base"
        >
          {isGeneratingPdf ? <><i className="fas fa-circle-notch animate-spin"></i> PDF 생성 중...</> : <><i className="fas fa-file-pdf"></i> PDF 다운로드</>}
        </button>
        <button onClick={handleCopyLink} className="bg-white border border-slate-200 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all text-sm md:text-base">공유 링크 복사</button>
      </div>

      <div ref={reportRef} className="space-y-4 md:space-y-6">
        <div className="bg-slate-900 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-indigo-500/10 blur-[60px] md:blur-[100px] -mr-10 md:-mr-20 -mt-10 md:-mt-20"></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8 mb-8 md:mb-10">
            <div>
              <h2 className="text-2xl md:text-4xl font-black mb-2 md:mb-3">{result.studentName} 학생 성적 리포트</h2>
              <p className="text-slate-400 font-bold max-w-md text-xs md:text-sm leading-relaxed">IBT TOEFL 기준 4대 영역 정밀 분석 결과입니다.</p>
            </div>
            <div className="bg-white text-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 text-center w-full md:min-w-[220px] shadow-2xl border-2 md:border-4 border-indigo-500/20">
              <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Total Scaled Score</span>
              <div className="text-5xl md:text-7xl font-black text-indigo-600 my-1">{result.totalScore}</div>
              <div className="text-xs md:text-sm text-slate-300 font-bold">out of 120</div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Reading', score: result.sectionScores.Reading, color: 'text-blue-400', icon: 'fa-book-open' },
              { label: 'Listening', score: result.sectionScores.Listening, color: 'text-emerald-400', icon: 'fa-headphones' },
              { label: 'Speaking', score: result.sectionScores.Speaking, color: 'text-orange-400', icon: 'fa-microphone' },
              { label: 'Writing', score: result.sectionScores.Writing, color: 'text-purple-400', icon: 'fa-pen-nib' }
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 p-3 md:p-5 rounded-2xl md:rounded-3xl flex items-center gap-3 md:gap-4">
                <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-white/10 flex items-center justify-center ${s.color}`}>
                  <i className={`fas ${s.icon} text-sm md:text-xl`}></i>
                </div>
                <div>
                  <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 tracking-wider">{s.label}</span>
                  <div className="text-lg md:text-2xl font-black">{s.score} <span className="text-[10px] md:text-xs font-bold text-white/30">/ 30</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {renderSectionDetail('Reading', 'from-blue-600 to-indigo-700', 'fa-book-open')}
          {renderSectionDetail('Listening', 'from-emerald-500 to-teal-600', 'fa-headphones')}
          {renderSectionDetail('Speaking', 'from-orange-500 to-red-600', 'fa-microphone')}
          {renderSectionDetail('Writing', 'from-purple-600 to-pink-600', 'fa-pen-nib')}
        </div>
      </div>
      
      {!isShared && (
        <div className="flex justify-center pt-10 no-print">
          <button onClick={onReset} className="w-full md:w-auto bg-slate-900 text-white px-8 md:px-16 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black shadow-2xl active:scale-95 transition-all text-sm md:text-base">새로운 데이터 입력하기</button>
        </div>
      )}
    </div>
  );
};

export default ReportView;