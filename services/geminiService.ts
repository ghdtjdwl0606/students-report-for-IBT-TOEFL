
import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "../types.ts";

export const getStudentFeedback = async (result: EvaluationResult): Promise<string> => {
  // 호출 시점에 최신 API 키를 가져옵니다.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const categorySummary = result.categoryResults
      .map(c => `${c.section} ${c.category}: ${c.percentage.toFixed(1)}%`)
      .join(", ");

    const prompt = `
      학생 이름: ${result.studentName}
      총점: ${result.totalScore} / ${result.maxScore}
      영역별 성취도: ${categorySummary}

      위 데이터를 바탕으로 학생의 성적에 대한 '객관적인 분석 리포트'를 한글로 작성해주세요. 
      인사말, 격려, 학습 조언, 향후 계획 제안 등 시험 결과와 직접 관련 없는 모든 부차적인 설명(사족)은 반드시 제외하세요.
      오직 데이터에 기반하여 어떤 영역이 강점이고 어떤 영역이 취약한지에 대한 핵심 분석 결과만 2~3문장으로 명확하게 서술하세요.
      말투는 깔끔하고 전문적인 문어체(~임, ~함 또는 ~함으로 분석됨)를 사용해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "데이터 분석 결과를 불러올 수 없습니다.";
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("MODEL_NOT_FOUND");
    }
    throw error;
  }
};
