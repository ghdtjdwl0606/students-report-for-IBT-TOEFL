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
    "Vocabulary": "지문 속 특정 단어나 구절의 의미를 묻습니다. 단순히 사전적 정의를 아는 것을 넘어, 문맥상(Context) 가장 적절한 동의어를 찾는 능력을 평가합니다.",
    "Detail": "지문에 명시적으로 언급된 사실, 데이터, 세부 정보를 정확히 파악했는지 묻습니다. 본문의 내용을 그대로 옮기기보다 Paraphrasing된 문장을 찾는 것이 핵심입니다.",
    "Reference": "지문에 등장하는 대명사(it, they, which 등)가 가리키는 선행사가 무엇인지 묻습니다. 문장의 문법적 구조와 수 일치, 논리적 연결을 파악해야 합니다.",
    "Sentence Simplification": "길고 복잡한 문장의 핵심 의미를 가장 잘 요약한 선택지를 고르는 문제입니다. 중요하지 않은 수식어구는 쳐내고 '누가 무엇을 했다'는 핵심 정보를 보존하는 것이 중요합니다.",
    "Rhetorical Purpose": "작가가 특정 단어, 구절, 예시를 왜 사용했는지 그 의도나 기능을 묻습니다. 단락의 주제와 해당 부분이 어떻게 연결되는지 논리적 관계를 파악해야 합니다.",
    "Inference": "지문에 직접 언급되지는 않았지만, 주어진 정보를 바탕으로 논리적으로 유추할 수 있는 내용을 묻습니다. 지나친 비약 없이 본문의 근거 안에서 결론을 내는 것이 핵심입니다.",
    "Sentence Insertion": "새로운 문장이 들어갈 가장 적절한 위치를 찾는 문제입니다. 앞뒤 문장 간의 논리적 흐름, 연결어, 지시어 등을 단서로 활용하여 문맥의 끊김이 없는 곳을 찾습니다.",
    "Prose Summary": "지문 전체의 내용을 가장 잘 요약한 3가지 핵심 문장을 고르는 문제입니다. 지엽적인 세부 사항과 전체 주제를 구분하는 능력이 가장 중요합니다."
  },
  Listening: {
    "Main Idea": "대화나 강의의 전체적인 주제나 목적을 묻는 가장 기본적인 문제입니다. \"이 대화의 주된 목적은 무엇인가?\" 또는 \"교수는 주로 무엇에 대해 설명하고 있는가?\"를 묻습니다.",
    "Inference": "화자가 직접적으로 언급하지는 않았지만, 주어진 정보를 통해 논리적으로 유출할 수 있는 결론을 묻습니다. 말의 행간을 읽는 능력이 필요합니다.",
    "Function": "특정 문장이나 어구를 말한 의도(기능)를 묻습니다. 주로 해당 부분을 다시 들려주며(Replay), \"교수가 이 말을 왜 했는가?\"를 질문합니다.",
    "Detail": "강의나 대화 중에 언급된 구체적인 사실, 정의, 이유 등을 묻습니다. 핵심 키워드 뿐만 아니라 그와 관련된 세부 설명을 정확히 받아 적는 능력이 중요합니다.",
    "Organization": "강의의 전체적인 구조나 전개 방식을 묻습니다. 교수가 정보를 어떤 순서로 배치했는지(예: 비교와 대조, 인과관계, 시간 순서 등) 파악해야 합니다.",
    "Speaker's Attitude": "화자의 목소리 톤, 억양, 선택한 단어 등을 통해 화자의 태도, 감정, 의견을 묻습니다. 화자가 해당 주제에 대해 긍정적인지, 회의적인지 등을 판단해야 합니다."
  },
  Speaking: {
    "Information Selection": "통합형 문제(읽기+듣기)에서 중요한 포인트와 세부 정보를 얼마나 정확하게 추출했는지를 평가합니다. 불필요한 내용은 쳐내고, 정답에 꼭 필요한 핵심 근거들을 빠짐없이 포함하는 것이 중요합니다.",
    "Language & Grammar": "단순한 문장을 반복하지 않고 얼마나 다양한 어휘와 복잡한 문장 구조를 정확하게 구사하는지 봅니다. 사소한 실수는 감점이 적지만, 의미 전달을 방해하는 반복적인 문법 오류는 주의해야 합니다.",
    "Organization": "답변의 흐름이 얼마나 체계적인지 평가합니다. 서론-본론-결론의 구조를 갖추었는지, 그리고 연결어를 사용하여 아이디어 간의 관계를 논리적으로 매끄럽게 연결했는지가 핵심입니다.",
    "Fluency": "단순히 빨리 말하는 것이 아니라, 말의 속도가 일정하고 발음과 억양이 자연스러운지를 평가합니다. 너무 잦은 휴지기나 불필요한 반복을 줄여서 듣는 사람이 편안하게 이해할 수 있어야 합니다."
  },
  Writing: {
    "Topic Development": "질문에 대해 얼마나 관련성 있고 풍부한 답변을 했는지 평가합니다. 단순히 양을 채우는 것이 아니라, 주장을 뒷받침하는 구체적인 예시, 세부 정보, 논리적 근거가 얼마나 설득력 있게 제시되었는지가 핵심입니다.",
    "Organization": "글이 논리적인 순서로 배치되었는지 평가합니다. 서론-본론-결론의 명확한 구조를 갖추었는지, 단락 간의 연결이 매끄러운지, 그리고 연결어를 적절히 사용하여 독자가 흐름을 쉽게 따라올 수 있게 했는지를 봅니다.",
    "Language": "어휘 선택 및 표현력: 얼마나 적절하고 다양한 어휘를 사용하는지 평가합니다. 동일한 단어를 반복하기보다 동의어를 활용하고, 학술적인 상황에 맞는 격식 있는 표현과 구문을 정확하게 구사하는 능력이 중요합니다.",
    "Grammar": "문법 오류가 없는지뿐만 아니라, 문장 구조가 얼마나 다양한지 평가합니다. 단순문만 나열하지 않고 복합문, 관계대명사, 분사구문 등을 자유자재로 활용하면서도 시제나 수 일치 같은 기본적인 실수를 최소화해야 합니다."
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
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyLink = () => {
    // MCQ 섹션 데이터 압축: [Section, KeysString, AnswersString]
    const packMCQ = (section: Section) => {
      const qs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
      const keys = qs.map(q => q.correctAnswer || ' ').join('');
      const ans = qs.map(q => studentInput.answers[q.id] || ' ').join('');
      // 카테고리/배점 변경이 없는 경우만 고려한 초경량화
      const categories = qs.map(q => q.category === '일반' ? '' : q.category);
      const points = qs.map(q => q.points === 1 ? '' : q.points.toString());
      return [keys, ans, categories, points];
    };

    // Direct 섹션 데이터 압축: [[category, max, earned], ...]
    const packDirect = (section: Section) => {
      return questions.filter(q => q.section === section).map(q => [
        q.category,
        q.points,
        studentInput.answers[q.id] || '0'
      ]);
    };

    const rData = packMCQ('Reading');
    const lData = packMCQ('Listening');
    const sData = packDirect('Speaking');
    const wData = packDirect('Writing');

    // 최종 컴팩트 구조: [Name, Reading, Listening, Speaking, Writing]
    const ultraCompact = [
      studentInput.name,
      rData,
      lData,
      sData,
      wData
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
      alert("압축된 공유 링크가 복사되었습니다.");
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
            {categories.map((cat, i) => {
              const description = CATEGORY_DESCRIPTIONS[section]?.[cat.category];
              return (
                <div key={i} className="group relative">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex items-center gap-1.5 cursor-help">
                      <span className="text-sm font-bold text-slate-700 underline decoration-slate-200 decoration-dotted underline-offset-4 group-hover:decoration-slate-400 group-hover:text-indigo-600 transition-colors">
                        {cat.category}
                      </span>
                      {description && (
                        <i className="fas fa-info-circle text-[10px] text-slate-300 group-hover:text-indigo-400"></i>
                      )}
                    </div>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{Math.round(cat.percentage)}%</span>
                  </div>
                  {description && (
                    <div className="absolute z-10 bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 leading-relaxed font-medium pointer-events-none border border-white/10">
                      {description}
                      <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                    </div>
                  )}
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`} 
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
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
          disabled={isGeneratingPdf}
          className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {isGeneratingPdf ? <><i className="fas fa-circle-notch animate-spin"></i> 생성 중...</> : <><i className="fas fa-file-pdf"></i> PDF 리포트 다운로드</>}
        </button>
        <button onClick={handleCopyLink} className="bg-white border border-slate-200 px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all">공유 링크 복사</button>
      </div>

      <div ref={reportRef} className="space-y-6 p-1">
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -mr-20 -mt-20"></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
            <div>
              <h2 className="text-4xl font-black mb-3">{result.studentName} 학생 성적 리포트</h2>
              <p className="text-slate-400 font-bold max-w-md leading-relaxed">본 리포트는 IBT TOEFL 기준에 따라 학생의 4대 영역 성취도를 정밀하게 분석한 결과입니다.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderSectionDetail('Reading', 'from-blue-600 to-indigo-700', 'fa-book-open')}
          {renderSectionDetail('Listening', 'from-emerald-500 to-teal-600', 'fa-headphones')}
          {renderSectionDetail('Speaking', 'from-orange-500 to-red-600', 'fa-microphone')}
          {renderSectionDetail('Writing', 'from-purple-600 to-pink-600', 'fa-pen-nib')}
        </div>
      </div>
      {!isShared && (
        <div className="flex justify-center pt-10 no-print">
          <button onClick={onReset} className="bg-slate-900 text-white px-16 py-5 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">새로운 데이터 입력하기</button>
        </div>
      )}
    </div>
  );
};

export default ReportView;