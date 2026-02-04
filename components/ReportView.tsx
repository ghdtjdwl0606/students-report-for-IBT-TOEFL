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
    "Vocabulary": "지문 속 특정 단어나 구절의 의미를 묻습니다. 단순히 사전적 정의를 아는 것을 넘어, 문맥상 가장 적절한 의미를 찾는 능력을 평가합니다.",
    "Detail": "지문에 명시적으로 언급된 사실, 데이터, 세부 정보를 정확히 파악했는지 묻습니다. 본문 내용을 그대로 옮기기보다 Paraphrasing된 문장을 찾는 것이 핵심입니다.",
    "Reference": "지문에 등장하는 대명사(it, they, which 등)가 가리키는 선행사가 무엇인지 묻습니다. 문법적 구조와 논리적 연결을 파악해야 합니다.",
    "Sentence Simplification": "길고 복잡한 문장의 핵심 의미를 가장 잘 요약한 선택지를 고르는 문제입니다. 중요하지 않은 수식어구는 제외하고 핵심 정보를 보존하는 능력을 봅니다.",
    "Rhetorical Purpose": "작가가 특정 단어, 구절, 예시를 왜 사용했는지 그 의도나 기능을 묻습니다. 단락의 주제와 해당 부분이 어떻게 연결되는지 논리적 관계를 파악해야 합니다.",
    "Inference": "지문에 직접 언급되지는 않았지만, 주어진 정보를 바탕으로 논리적으로 유추할 수 있는 내용을 묻습니다. 본문의 근거 안에서 결론을 내는 것이 핵심입니다.",
    "Sentence Insertion": "새로운 문장이 들어갈 가장 적절한 위치를 찾는 문제입니다. 앞뒤 문장 간의 논리적 흐름, 연결어, 지시어 등을 단서로 활용합니다.",
    "Prose Summary": "지문 전체의 내용을 가장 잘 요약한 3가지 핵심 문장을 고르는 문제입니다. 지엽적인 세부 사항과 전체 주제를 구분하는 능력이 가장 중요합니다."
  },
  Listening: {
    "Main Idea": "대화나 강의의 전체적인 주제나 목적을 묻습니다. 교수가 주로 무엇에 대해 설명하고 있는지 파악하는 능력을 평가합니다.",
    "Inference": "화자가 직접적으로 언급하지는 않았지만, 주어진 정보를 통해 논리적으로 유출할 수 있는 결론을 묻습니다. 말의 행간을 읽는 능력이 필요합니다.",
    "Function": "특정 문장이나 어구를 말한 의도(기능)를 묻습니다. 주로 해당 부분을 다시 들려주며 말한 이유를 질문합니다.",
    "Detail": "강의나 대화 중에 언급된 구체적인 사실, 정의, 이유 등을 묻습니다. 핵심 키워드와 관련된 세부 설명을 정확히 파악하는 능력이 중요합니다.",
    "Organization": "강의의 전체적인 구조나 전개 방식을 묻습니다. 교수가 정보를 어떤 순서로 배치했는지(비교/대조, 인과관계 등) 파악해야 합니다.",
    "Speaker's Attitude": "화자의 목소리 톤, 억양 등을 통해 화자의 태도, 감정, 의견을 묻습니다. 긍정/부정/회의적 태도 등을 판단해야 합니다."
  },
  Speaking: {
    "Information Selection": "통합형 문제에서 중요한 포인트와 세부 정보를 얼마나 정확하게 추출했는지를 평가합니다. 핵심 근거를 빠짐없이 포함하는 것이 중요합니다.",
    "Language & Grammar": "얼마나 다양한 어휘와 복잡한 문장 구조를 정확하게 구사하는지 봅니다. 의미 전달을 방해하는 반복적인 문법 오류는 주의해야 합니다.",
    "Organization": "답변의 흐름이 얼마나 체계적인지 평가합니다. 서론-본론-결론의 구조와 연결어 사용 능력을 봅니다.",
    "Fluency": "말의 속도가 일정하고 발음과 억양이 자연스러운지를 평가합니다. 너무 잦은 휴지기나 불필요한 반복을 줄여야 합니다."
  },
  Writing: {
    "Topic Development": "질문에 대해 얼마나 관련성 있고 풍부한 답변을 했는지 평가합니다. 구체적인 예시와 논리적 근거가 설득력 있게 제시되어야 합니다.",
    "Organization": "글이 논리적인 순서로 배치되었는지 평가합니다. 단락 간의 연결이 매끄럽고 독자가 흐름을 쉽게 따라올 수 있어야 합니다.",
    "Language": "어휘 선택 및 표현력을 평가합니다. 학술적인 상황에 맞는 격식 있는 표현과 구문을 정확하게 구사하는 능력이 중요합니다.",
    "Grammar": "문법 오류 여부와 문장 구조의 다양성을 평가합니다. 관계대명사, 분사구문 등을 자유자재로 활용하는 능력을 봅니다."
  }
};

const ReportView: React.FC<Props> = ({ questions, studentInput, onReset, isShared }) => {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

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

    // 점수 산정 로직 수정: Reading/Listening 기본 점수 5점 부여
    const scaledScore = (section: Section) => {
      const { earned, max } = sectionTotals[section];
      if (max === 0) return 0;
      
      if (section === 'Reading' || section === 'Listening') {
        // 기본 5점 + (25점 만점으로 환산한 성취도)
        return Math.floor(5 + (earned / max) * 25);
      } else {
        // Speaking/Writing은 기존 방식(30점 만점 환산) 유지
        return Math.floor((earned / max) * 30);
      }
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
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      
      let currentY = margin;

      const captureAndAddToPdf = async (el: HTMLElement) => {
        const canvas = await html2canvas(el, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#f8fafc',
          windowWidth: 1200
        });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const displayHeight = (imgProps.height * contentWidth) / imgProps.width;

        if (currentY + displayHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.addImage(imgData, 'PNG', margin, currentY, contentWidth, displayHeight);
        currentY += displayHeight + 5;
      };

      if (headerRef.current) await captureAndAddToPdf(headerRef.current);
      for (const sectionEl of sectionRefs.current) {
        if (sectionEl) await captureAndAddToPdf(sectionEl);
      }

      pdf.save(`${result.studentName}_Detailed_TOEFL_Report.pdf`);
    } catch (error) {
      console.error("PDF creation error:", error);
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
      const b64 = btoa(String.fromCharCode(...compressed)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const shareUrl = `${window.location.origin}${window.location.pathname}#s=${b64}`;
      navigator.clipboard.writeText(shareUrl);
      alert("공유 링크가 복사되었습니다.");
    } catch (e) {
      alert("링크 생성 실패");
    }
  };

  const renderSectionDetail = (section: Section, color: string, icon: string, index: number) => {
    if (!result) return null;
    const score = result.sectionScores[section];
    const categories = result.categoryResults.filter(c => c.section === section);

    return (
      <div 
        ref={el => sectionRefs.current[index] = el}
        className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-full transition-all hover:shadow-md relative"
      >
        <div className={`p-5 md:p-6 bg-gradient-to-r ${color} text-white flex justify-between items-center rounded-t-[2rem] md:rounded-t-[2.5rem]`}>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center">
              <i className={`fas ${icon} text-sm md:text-lg`}></i>
            </div>
            <div>
              <h3 className="font-black text-lg md:text-xl leading-tight">{section}</h3>
              <p className="text-[9px] md:text-[10px] font-bold opacity-80 uppercase tracking-wider">Skill Assessment</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl md:text-3xl font-black">{score}</span>
            <span className="text-[10px] md:text-xs font-bold opacity-60"> / 30</span>
          </div>
        </div>
        
        <div className="p-6 md:p-8 flex-1">
          <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-4 md:mb-5 tracking-widest flex items-center gap-2">
            <i className="fas fa-layer-group text-slate-300"></i> 영역별 상세 분석
          </h4>
          <div className="space-y-6">
            {categories.map((cat, i) => {
              const description = CATEGORY_DESCRIPTIONS[section]?.[cat.category];
              return (
                <div key={i} className="group">
                  <div className="flex justify-between items-center mb-2 px-1 relative">
                    <div className="flex items-center gap-2 cursor-help">
                      <span className="text-xs md:text-sm font-bold text-slate-700 underline decoration-slate-200 decoration-dotted underline-offset-4 group-hover:text-indigo-600 group-hover:decoration-indigo-300 transition-all">
                        {cat.category}
                      </span>
                      {description && (
                        <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                           <i className="fas fa-info text-[8px] text-slate-400 group-hover:text-indigo-500"></i>
                        </div>
                      )}

                      {/* 정보 가이드 툴팁 - z-index 최상단 배치 및 overflow 무시를 위해 absolute 위치 조정 */}
                      {description && (
                        <div className="absolute z-[100] bottom-full left-0 mb-4 w-64 p-4 bg-slate-900 text-white text-[11px] rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 leading-relaxed font-medium pointer-events-none border border-white/10 no-print">
                          <div className="font-bold text-indigo-300 mb-1.5 flex items-center gap-1.5 border-b border-white/10 pb-1.5">
                            <i className="fas fa-lightbulb text-yellow-400"></i>
                            {cat.category} 가이드
                          </div>
                          {description}
                          {/* 화살표 아이콘 */}
                          <div className="absolute top-full left-4 -mt-1 w-3 h-3 bg-slate-900 rotate-45 border-b border-r border-white/10"></div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] md:text-xs font-black text-indigo-600 bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded-md">{Math.round(cat.percentage)}%</span>
                  </div>

                  <div className="h-2.5 md:h-3.5 bg-slate-100 rounded-full overflow-hidden">
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
    <div className="max-w-6xl mx-auto space-y-6 px-2 md:px-0 pb-20">
      <div className="flex flex-col sm:flex-row justify-end gap-2 md:gap-3 no-print">
        <button 
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 text-sm md:text-base"
        >
          {isGeneratingPdf ? <><i className="fas fa-circle-notch animate-spin"></i> PDF 생성 중...</> : <><i className="fas fa-file-pdf"></i> PDF 다운로드</>}
        </button>
        <button onClick={handleCopyLink} className="bg-white border border-slate-200 px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all text-sm md:text-base">공유 링크 복사</button>
      </div>

      <div ref={reportRef} className="space-y-6">
        <div ref={headerRef} className="bg-slate-900 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-indigo-500/10 blur-[60px] md:blur-[100px] -mr-10 md:-mr-20 -mt-10 md:-mt-20"></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8 mb-8 md:mb-10">
            <div>
              <h2 className="text-2xl md:text-4xl font-black mb-2 md:mb-3">{result.studentName} 학생 성적 리포트</h2>
              <p className="text-slate-400 font-bold max-w-md text-xs md:text-sm leading-relaxed">본 리포트는 IBT TOEFL 기준에 따라 학생의 4대 영역 성취도를 정밀 분석한 결과입니다.</p>
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
          {renderSectionDetail('Reading', 'from-blue-600 to-indigo-700', 'fa-book-open', 0)}
          {renderSectionDetail('Listening', 'from-emerald-500 to-teal-600', 'fa-headphones', 1)}
          {renderSectionDetail('Speaking', 'from-orange-500 to-red-600', 'fa-microphone', 2)}
          {renderSectionDetail('Writing', 'from-purple-600 to-pink-600', 'fa-pen-nib', 3)}
        </div>
      </div>
      
      {!isShared && (
        <div className="flex justify-center pt-10 no-print">
          <button onClick={onReset} className="w-full md:w-auto bg-slate-900 text-white px-10 md:px-16 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black shadow-2xl active:scale-95 transition-all text-sm md:text-base">새로운 데이터 입력하기</button>
        </div>
      )}
    </div>
  );
};

export default ReportView;