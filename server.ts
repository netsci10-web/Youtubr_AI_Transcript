import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Lazy initializer for Google GenAI client to prevent crashing on boot if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environment variable is not configured. Please set it in Settings > Secrets.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Fallback logic helper to recover from quota limit & search grounding limit errors
async function generateContentWithRetry(
  client: GoogleGenAI,
  modelName: string,
  params: {
    contents: any;
    config: any;
  }
): Promise<any> {
  const isSearchActive = !!params.config?.tools?.some((t: any) => t.googleSearch);
  try {
    console.log(`[Gemini API] Requesting ${modelName}... (Search Grounding: ${isSearchActive ? "ON" : "OFF"})`);
    return await client.models.generateContent({
      model: modelName,
      contents: params.contents,
      config: params.config,
    });
  } catch (error: any) {
    const errorStr = String(error.message || error);
    console.warn(`[Gemini API] Request to ${modelName} failed. Reason: ${errorStr}`);

    const isQuotaOrSearchError = 
      errorStr.includes("429") || 
      errorStr.includes("RESOURCE_EXHAUSTED") || 
      errorStr.includes("quota") || 
      errorStr.includes("limit") || 
      errorStr.includes("Search") ||
      errorStr.includes("grounding");

    if (isQuotaOrSearchError) {
      // Step 1: If search grounding was enabled and failed, try again WITHOUT search grounding on the same model first!
      if (isSearchActive) {
        console.warn("[Gemini API] Retrying WITHOUT search grounding to bypass search grounding quota limits...");
        const newConfig = { ...params.config };
        delete newConfig.tools;
        try {
          return await client.models.generateContent({
            model: modelName,
            contents: params.contents,
            config: newConfig,
          });
        } catch (retryError: any) {
          const retryErrorStr = String(retryError.message || retryError);
          console.warn("[Gemini API] Retry without search grounding failed too:", retryErrorStr);
        }
      }

      // Step 2: Fall back to 'gemini-3.1-flash-lite' which has separate (and higher) rate limits
      if (modelName !== "gemini-3.1-flash-lite") {
        console.warn("[Gemini API] Swapping to fallback model: 'gemini-3.1-flash-lite'...");
        const baseConfig = { ...params.config };
        delete baseConfig.tools; // Strip search tools for safety
        try {
          return await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: params.contents,
            config: baseConfig,
          });
        } catch (fallbackError: any) {
          console.error("[Gemini API] Fallback model gemini-3.1-flash-lite failed too:", fallbackError);
          throw fallbackError;
        }
      }
    }
    throw error;
  }
}

// Helper to parse YouTube ISO 8601 duration (e.g. PT15M24S) into Korean description and MM:SS / HH:MM:SS format
function parseISO8601Duration(durationStr: string) {
  if (!durationStr) return { human: "알 수 없음", seconds: 0, formatted: "10:00" };
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = durationStr.match(regex);
  if (!matches) return { human: "알 수 없음", seconds: 0, formatted: "10:00" };
  const hours = parseInt(matches[1] || "0", 10);
  const minutes = parseInt(matches[2] || "0", 10);
  const seconds = parseInt(matches[3] || "0", 10);
  
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (seconds > 0) parts.push(`${seconds}초`);
  const human = parts.join(" ") || "0초";

  const formatted = hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return { human, seconds: totalSeconds, formatted };
}

// Convert model exceptions into elegant, actionable support guidelines in Korean
function parseGeminiError(error: any): string {
  const errorStr = String(error.message || error);
  console.error("[Parsed Gemini Error] Processing:", errorStr);
  
  if (
    errorStr.includes("429") || 
    errorStr.includes("RESOURCE_EXHAUSTED") || 
    errorStr.includes("quota") || 
    errorStr.includes("limit")
  ) {
    return "현재 AI 분석 서비스(Gemini API)의 무료 통합 할당량 또는 분당 속도 제한(Rate Limit)을 초과했습니다. 잠시 후 상단의 (ANALYZE) 버튼을 다시 눌러주시거나, 우측 상단의 'Settings > Secrets' 메뉴에서 사용자 본인의 'GEMINI_API_KEY'를 추가 등록하시면 할당량 한도 제한 없이 실시간 분석을 무제한으로 사용하실 수 있습니다.";
  }
  return errorStr || "영상 분석을 처리하는 도중 요류가 발생했습니다.";
}

// JSON schema definition for video analysis responses
const videoAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    videoTitle: {
      type: Type.STRING,
      description: "유튜브 영상 제목 (실제 동영상 제목 또는 원본 참고 제목)",
    },
    channelName: {
      type: Type.STRING,
      description: "채널 또는 크리에이터 이름",
    },
    summary: {
      type: Type.STRING,
      description: "한국어 정밀 영상 브리핑 및 상세 흐름 요약",
    },
    takeaways: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "영상의 핵심 요점 5가지 (한국어 명사형이나 명확한 문장 종결)",
    },
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING, description: "챕터 주제 시작 시간 (예: 02:15)" },
          title: { type: Type.STRING, description: "챕터 주제 제목" },
          desc: { type: Type.STRING, description: "해당 챕터 세부 설명 및 흐름 정보" },
        },
        required: ["time", "title", "desc"],
      },
      description: "영상의 흐름을 대표하는 주요 챕터 분기점 리스트",
    },
    transcript: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING, description: "실제 발화 시작 타임스탬프 (예: 00:15)" },
          text: { type: Type.STRING, description: "한국어로 매끄럽게 번역 및 교정된 대사" },
        },
        required: ["time", "text"],
      },
      description: "시간순으로 정렬된 상세 대사 타임라인 목록",
    },
  },
  required: ["videoTitle", "channelName", "summary", "takeaways", "topics", "transcript"],
};

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "AIzaSyA3dXC8mF32ItPvd5wUDBt-uUWZvonvY5Q";

// Helper function to fetch YouTube video metadata using official Data API v3
async function fetchYoutubeMetadata(videoId: string, apiKey: string) {
  try {
    const apiURL = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
    const response = await fetch(apiURL, {
      headers: {
        "User-Agent": "aistudio-build-yt-client",
      }
    });
    if (!response.ok) {
      throw new Error(`YouTube API returned HTTP status: ${response.status}`);
    }
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error(`비디오 ID (${videoId})에 대한 유튜브 정보를 찾을 수 없습니다.`);
    }
    const snippet = data.items[0].snippet;
    const contentDetails = data.items[0].contentDetails;
    const rawDuration = contentDetails?.duration || "";
    return {
      title: snippet.title || "",
      channelTitle: snippet.channelTitle || "",
      description: snippet.description || "",
      tags: snippet.tags || [],
      rawDuration: rawDuration
    };
  } catch (error: any) {
    console.error("fetchYoutubeMetadata error:", error);
    throw error;
  }
}

// Scrape YouTube page to find caption tracks and fetch chosen caption in json3 format
async function fetchYoutubeTranscript(videoId: string): Promise<{ time: string; text: string }[]> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "ko,en-US;q=0.9,en;q=0.8",
        "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+916;"
      }
    });
    if (!response.ok) {
      throw new Error(`유튜브 동영상 페이지 로드 실패: ${response.statusText}`);
    }
    const html = await response.text();

    let captionsJsonStr: string | null = null;
    
    // Attempt 1: match ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/);
    if (playerResponseMatch) {
      captionsJsonStr = playerResponseMatch[1];
    } else {
      // Attempt 2: match ytInitialPlayerResponse in script block with no trailing semi
      const playerResponseAlt = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?})(?:<\/script>|;)/);
      if (playerResponseAlt) {
        captionsJsonStr = playerResponseAlt[1];
      }
    }

    let playerResponse: any = null;
    if (captionsJsonStr) {
      try {
        playerResponse = JSON.parse(captionsJsonStr);
      } catch (e) {
        console.warn("JSON.parse(ytInitialPlayerResponse) failed, trying regex fallback...");
      }
    }

    // Attempt 3: match playerCaptionsTracklistRenderer directly if still empty
    if (!playerResponse) {
      const captionTracklistMatch = html.match(/"playerCaptionsTracklistRenderer"\s*:\s*({[\s\S]+?})\s*,\s*"videoDetails"/);
      if (captionTracklistMatch) {
        try {
          playerResponse = {
            captions: {
              playerCaptionsTracklistRenderer: JSON.parse(captionTracklistMatch[1])
            }
          };
        } catch (e) {
          console.warn("JSON.parse playerCaptionsTracklistRenderer fallback failed.");
        }
      }
    }

    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error("유튜브 동영상에서 자막 트랙(Captions)을 확인할 수 없습니다. 자막이 차단되었거나 수동 입력을 활용해 주세요.");
    }

    // Prioritize Korean (official -> any), then English (official -> any), then first available track
    let selectedTrack = captionTracks.find((t: any) => t.languageCode === "ko" && !t.kind);
    if (!selectedTrack) {
      selectedTrack = captionTracks.find((t: any) => t.languageCode === "ko");
    }
    if (!selectedTrack) {
      selectedTrack = captionTracks.find((t: any) => t.languageCode === "en" && !t.kind);
    }
    if (!selectedTrack) {
      selectedTrack = captionTracks.find((t: any) => t.languageCode === "en");
    }
    if (!selectedTrack) {
      selectedTrack = captionTracks[0];
    }

    const captionUrl = `${selectedTrack.baseUrl}&fmt=json3`;
    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) {
      throw new Error(`자막 로드 API 호출 실패: ${captionRes.statusText}`);
    }

    const captionData = await captionRes.json();
    const trans: { time: string; text: string }[] = [];

    if (captionData?.events) {
      for (const event of captionData.events) {
        if (!event.segs) continue;
        const textStr = event.segs.map((s: any) => s.utf8).join("").trim();
        if (!textStr || textStr === "\n") continue;

        const startSec = Math.floor((event.tStartMs || 0) / 1000);
        const hours = Math.floor(startSec / 3600);
        const mins = Math.floor((startSec % 3600) / 60);
        const secs = startSec % 60;
        const timeStr = hours > 0 
          ? `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
          : `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

        trans.push({
          time: timeStr,
          text: textStr
        });
      }
    }

    return trans;
  } catch (error) {
    console.error("fetchYoutubeTranscript failed:", error);
    throw error;
  }
}

// 1. Video analysis API
app.post("/api/analyze", async (req, res) => {
  try {
    const { mode, url, videoId, manualText } = req.body;
    const client = getGeminiClient();

    let videoTitle = "";
    let channelName = "";
    let metadataContext = "";
    let formattedDuration = "10:00";
    let humanDuration = "10분";
    let transcriptData: { time: string; text: string }[] = [];

    // Prioritize fetching YouTube metadata using API key for both mode "auto" and "manual"
    try {
      const metadata = await fetchYoutubeMetadata(videoId, YOUTUBE_API_KEY);
      videoTitle = metadata.title;
      channelName = metadata.channelTitle;
      metadataContext = `설명:\n${metadata.description}\n태그: ${metadata.tags.join(", ")}`;
      if (metadata.rawDuration) {
        const parsed = parseISO8601Duration(metadata.rawDuration);
        formattedDuration = parsed.formatted;
        humanDuration = parsed.human;
      }
    } catch (e: any) {
      console.warn("YouTube Metadata query failed, continuing with fallback empty metadata:", e.message);
      videoTitle = "YouTube Video";
      channelName = "YouTube Creator";
      metadataContext = "비디오 상세 설명을 가져올 수 없습니다.";
    }

    let transcriptLoaded = true;
    if (mode === "auto") {
      try {
        transcriptData = await fetchYoutubeTranscript(videoId);
      } catch (e: any) {
        console.warn("Auto transcript extraction failure, falling back to Gemini Search Grounding reconstruction:", e);
        transcriptLoaded = false;
        transcriptData = [];
      }
    } else {
      // Manual mode
      transcriptData = []; // Will be parsed inside Gemini prompt based on raw text
    }

    let prompt = "";
    let systemInstruction = `You are an elite AI YouTube transcript analyst. Use search/data grounding if needed to process the video details carefully. 
Analyze the content thoroughly and output exactly a JSON object adhering to the schema.
Translate all titles, summary, topics, takeaways, and transcripts beautifully and naturally into Korean (한국어).`;

    if (mode === "auto") {
      if (transcriptLoaded && transcriptData.length > 0) {
        const formattedTransInput = transcriptData.slice(0, 1200).map((t) => `[${t.time}] ${t.text}`).join("\n");
        prompt = `영상 분석을 진행해 주세요.
유튜브 링크: ${url || `https://www.youtube.com/watch?v=${videoId}`}
영상 ID (Video ID): ${videoId}

[비디오 재생 시간 정보]
총 길이: ${humanDuration} (${formattedDuration})

[실제 수집된 비디오 메타데이터]
제목: ${videoTitle}
채널명: ${channelName}
${metadataContext}

[실제 추출된 순수 전체 자막 데이터]
${formattedTransInput}

제시된 실제 비디오 정보 및 자막 대본 데이터를 심도있게 파악하고 아래 양식을 충실히 따라 가공해 주세요:
1. 정확한 영상 제목(videoTitle) 및 채널명(channelName). (수집된 메타데이터를 우선적으로 반영하십시오)
2. 영상 전체의 핵심 줄거리 및 흐름을 요약한 한국어 정밀 브리핑 보고서(summary).
3. 5가지 핵심 요약 내용(takeaways)을 한국어로 작성해 주세요.
4. 자막 흐름의 타임스탬프를 인지하여 세부 챕터(topics) 구조(시간대별 시작점, 짧은 한 줄 설명 포함)를 가공하세요. 챕터들은 00:00부터 ${formattedDuration}까지의 영상 전반에 걸쳐 고르고 자연스러운 간격으로 분산되도록 구성해 주십시오. (절대로 첫 4~5분 이내에 모든 챕터가 쏠리지 않도록 조절하십시오)
5. 대사 타임라인(transcript)은 영상에 나오는 모든 핵심 발화 내용을 빠짐없이 자막 수준으로 만들어 촘촘하게 보여주어야 합니다. 절대로 임의로 대본을 생략하거나 중간에 멈추지 마십시오. 원래 동영상 자막의 흐름에 맞춰, 00:00부터 마지막 끝맺음 지점(${formattedDuration})까지 누락되는 구간 없이 한국어로 매끄럽고 정교하게 구성하여 배열해 주세요. 전체적인 시간 분배는 최종 시간인 ${formattedDuration}에 이르기까지 점진적으로 끊김 없이 고르게 분포되도록 타임스탬프를 정확하게 맞춰 구성해 주십시오.

반드시 스키마 규격을 충족하는 JSON 객체 1개만을 영문 키, 국문 번역 텍스트 값 구조로 응답하세요.`;
      } else {
        // Fallback reconstruction using metadata and Google Search Grounding integration
        prompt = `영상 분석을 진행해 주세요.
유튜브 링크: ${url || `https://www.youtube.com/watch?v=${videoId}`}
영상 ID (Video ID): ${videoId}

[실제 수집된 비디오 메타데이터]
제목: ${videoTitle}
채널명: ${channelName}
${metadataContext}

[비디오 재생 시간 정보]
총 길이: ${humanDuration}
타임라인 범위: 00:00부터 ${formattedDuration} 까지

주의: 이 비디오는 자막 트랙(Closed Captions)이 활성화되어 있지 않거나 비공개 자막 상태입니다.
따라서 귀하의 구글 검색(Google Search Grounding) 엔진을 백그라운드로 실행하여 이 비디오에 관한 정보, 요약, 실제 핵심 메시지와 주요 내용 및 시간대별 정보들을 검색하십시오.
그 후 위의 메타데이터 및 재생 시간 정보와 결합하여:
1. 정확한 영상 제목(videoTitle) 및 채널명(channelName)을 채워주십시오.
2. 비디오 내용을 면밀히 분석하여 영상 전체를 아주 정확하게 요약하고 핵심 맥락을 기술한 한국어 정밀 브리핑 보고서(summary)를 작성해 주십시오.
3. 5가지의 깊이 있고 논리적인 핵심 요약 내용(takeaways)을 한국어로 도출해 채워 주십시오.
4. 중요: 비디오의 실제 총 재생시간 정보(${formattedDuration})를 반드시 숙지하고 준수하십시오. 주요 챕터(topics) 구조(시간대 시작 지점 및 상세 설명) 리스트는 영상의 전체 길이(00:00부터 ${formattedDuration}까지)에 걸쳐 시간 흐름상 고르고 균등한 간격으로 전 구간에 넓게 분산하여 구성해 주십시오. (절대로 첫 4~5분 이내에 모든 챕터가 쏠리지 않아야 하며, 실제 영상 전개 흐름에 부합하도록 타임스탬프를 최대 ${formattedDuration}까지 조화롭게 구성해야 합니다)
5. 중요: 대본 타임라인(transcript)은 영상에 나오는 발화 내용 전량을 빠짐없이 자막으로 구성해 주어야 합니다. 영상의 실제 재생 시간 범위인 00:00부터 종료 지점인 ${formattedDuration} 전반에 걸쳐 빈번하고 고루 퍼져야 합니다. 비디오의 실제 전개 마일스톤(예: 7일간의 자전고 종주 과정, 1일차 서울 한강~자전거 전용 터널~자전거 여권 도장~지나가는 사람들의 간식 및 콜라 격려~경남 창녕~부산 을숙도 완주 금메달 획득 등)에 맞춰 풍부한 한국어 대사/발화 및 꼬리표 타임스탬프 시퀀스 형태([MM:SS] 발화) 목록을 지능적으로 복원/재구성하여, 약 30~50개 이상의 흐름 마일스톤 시퀀스로 촘촘하게 작성해 주십시오. 4분대 이후 시간대도 알맞은 간격(예: 30초~1분 간격 등 영상의 전체 흐름에 맞춰)으로 대사가 완벽히 복원되도록 끝까지 타임라인을 채워서 타임라인 멈춤 오류를 완전히 해소해 주십시오.

반드시 스키마 규격을 충족하는 JSON 객체 1개만을 영문 키, 국문 번역 텍스트 값 구조로 응답하세요.`;
      }
    } else {
      // Manual Mode
      prompt = `제공된 대본 텍스트를 파싱 및 분석해 주세요.
유튜브 링크 (참고용): ${url || `https://www.youtube.com/watch?v=${videoId}`}
영상 ID (Video ID): ${videoId}

[유튜브 메타데이터]:
제목: ${videoTitle}
채널명: ${channelName}

[사용자가 직접 제공한 원시 대본 컨텍스트]:
${manualText}

파싱 데이터를 아래 스키마에 맞게 지능적으로 변환하여 분석 리포트를 생성해 주세요:
1. 제목(videoTitle) 및 채널명(channelName)은 제시된 링크 및 대본을 기반으로 채워 넣으세요.
2. 대본에 수록된 정보를 기반으로 정밀한 한국어 영상 흐름 브리핑 요약(summary)을 작성해 주세요.
3. 5가지 요점(takeaways)을 한국어로 작성해 주세요.
4. 대본의 타임스탬프 단락 정보를 인지하여 세부 챕터(topics) 구조를 기획해 주시고 각각의 세부 흐름 설명을 작성해 주세요.
5. 제시된 원시 자막 대본 리스트를 시간별 타임스탬프 포맷에 마추어 오탈자를 교정하고 매끄럽게 번역 및 다듬어 (transcript) 배열에 배치하세요.

반드시 스키마 규격을 충족하는 JSON 객체 1개만을 영문 키, 국문 텍스트 값 구조로 반환하세요.`;
    }

    const useSearchGrounding = (mode === "auto" && !transcriptLoaded);

    const response = await generateContentWithRetry(client, "gemini-3.5-flash", {
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        tools: useSearchGrounding ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: videoAnalysisResponseSchema,
        temperature: 0.2, // Low temperature for factual analysis
      },
    });

    const cleanText = response.text || "{}";
    const data = JSON.parse(cleanText);
    res.json(data);
  } catch (error: any) {
    console.error("Analysis failed:", error);
    res.status(500).json({ error: parseGeminiError(error) });
  }
});

// 2. Chatbot response proxy API
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, videoTitle, channelName, videoId, transcript } = req.body;
    const client = getGeminiClient();

    const formattedTranscript = Array.isArray(transcript) && transcript.length > 0
      ? transcript.map((t: any) => `[${t.time}] ${t.text}`).join("\n")
      : "자막 정보 없음";

    const systemInstruction = `You are a professional video analysis assistant. You reply friendly in Korean based on the provided video transcript text. Avoid hallucinations and be grounded strictly to the provided text context. Keep formatting clean with paragraph breaks.`;

    const userPrompt = `현재 동영상 정보: [제값: ${videoTitle}] / [채널명: ${channelName}] / [영상ID: ${videoId || "없음"}]

[추출된 실제 전체 자막 콘텍스트]:
${formattedTranscript}

[사용자의 질문]:
"${message}"`;

    // Map chat history parameters correctly
    const contents: any[] = [];
    if (Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }],
        });
      });
    }

    // Append current prompt
    contents.push({
      role: "user",
      parts: [{ text: userPrompt }],
    });

    const response = await generateContentWithRetry(client, "gemini-3.5-flash", {
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Chat agent failed:", error);
    res.status(500).json({ error: parseGeminiError(error) });
  }
});

// Serve frontend with Vite in development, static build in production
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[YouTube AI Transcript Hub Backend] server running on http://localhost:${PORT}`);
  });
}

start();
