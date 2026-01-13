
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
      영역별 성취도 데이터: ${categorySummary}

      [분석 가이드라인]
      아래 특정 카테고리가 데이터에 포함되어 있다면, 해당 정답률 구간에 맞는 '평가 문구'를 반드시 분석 리포트에 포함하거나 기반으로 작성하세요.

      1. Vocabulary (어휘) 영역:
        - 0~35%: 지문의 핵심 단어들에 대한 이해도가 낮아 문장 전체의 의미를 왜곡하거나 해석이 끊기는 현상이 발생합니다.
        - 36%~70%: 기본적인 어휘력은 갖추고 있어 일반적인 지문 해석에는 큰 무리가 없으나, 다의어나 학술적인 고난도 어휘가 등장할 경우 문맥적 의미를 정확히 유추하는 데 기복이 보입니다.
        - 71%~100%: 전문 용어나 고난도 어휘의 문맥적 의미를 완벽히 이해하며, 동의어 치환 능력이 매우 우수합니다.

      2. Detail (세부 정보) 영역:
        - 0~35%: 지문에 명시된 정보를 정확하게 찾아내는 데 어려움이 있습니다.
        - 36%~70%: 지문의 전반적인 사실 관계는 잘 파악하고 있으나, 선택지에서 단어 하나를 교묘하게 바꾸거나 인과관계를 뒤섞어 놓은 함정 문제에서 실수가 있는 편입니다.
        - 71%~100%: 지문에 제시된 팩트를 정확하게 추출하며, 오답 선택지의 교묘한 왜곡을 찾아내는 능력이 탁월합니다.

      [작성 규칙]
      - 인사말, 격려, 사족 없이 위 가이드라인에 따른 '객관적인 분석 결과'만 2~3문장으로 작성하세요.
      - 말투는 전문적인 문어체(~임, ~함으로 분석됨 등)를 유지하세요.
      - 가이드라인에 없는 카테고리는 전체적인 성취도를 고려하여 데이터 기반으로 분석하세요.
    `;

    const response = await ai.models.generateContent({
      model: "prj_GKMXP7d6CNwgXilDiG62TjnjaRVn",
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
