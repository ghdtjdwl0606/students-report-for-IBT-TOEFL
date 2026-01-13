
export type Section = 'Reading' | 'Listening' | 'Speaking' | 'Writing';

export interface Question {
  id: string;
  number: number;
  section: Section;
  category: string;
  correctAnswer?: string; // MCQ 전용
  points: number; // MCQ는 배점, Direct는 만점
  type: 'mcq' | 'direct';
}

export interface StudentInput {
  name: string;
  answers: Record<string, string>; // MCQ 답안 혹은 Direct 점수(문자열 저장 후 파싱)
}

export interface CategoryResult {
  category: string;
  totalQuestions: number;
  correctCount: number; // MCQ: 맞춘 개수, Direct: 획득 점수 합계
  percentage: number;
  section: Section;
  maxPoints: number; // 해당 카테고리의 총 배점/만점
}

export interface EvaluationResult {
  studentName: string;
  totalScore: number;
  maxScore: number;
  sectionScores: Record<Section, number>;
  categoryResults: CategoryResult[];
  isCorrect: Record<string, boolean>;
  // Fix: Add missing properties required by the object literal in ReportView.tsx
  scoreR: number;
  scoreL: number;
  actualEarnedPoints: number;
}
