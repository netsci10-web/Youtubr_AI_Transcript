/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Youtube, 
  Play, 
  Check, 
  Copy, 
  Download, 
  Search, 
  MessageSquare, 
  Send, 
  Sparkles, 
  BookOpen, 
  Save, 
  RefreshCw, 
  FileText, 
  Layers, 
  Video, 
  AlertCircle, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Flame, 
  User, 
  Smile, 
  HelpCircle,
  FileJson,
  CornerDownRight,
  ChevronRight,
  Info
} from "lucide-react";
import { 
  parseTimeToSeconds, 
  extractYoutubeId, 
  parseManualTranscript, 
  generateSRT 
} from "./utils";
import { 
  VideoAnalysis, 
  ChatMessage, 
  TopicItem, 
  TranscriptItem 
} from "./types";
import { 
  demoAnalysisData, 
  DEMO_VIDEO_ID, 
  DEMO_VIDEO_URL 
} from "./demoData";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export default function App() {
  // Config & Tabs
  const [analysisMode, setAnalysisMode] = useState<"auto" | "manual">("auto");
  const [activeTab, setActiveTab] = useState<"transcript" | "summary" | "chapters" | "save">("transcript");
  
  // Inputs
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [manualText, setManualText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loading Screen States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Analysis State
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [videoId, setVideoId] = useState<string>("");
  
  // Interactive Seek Player state
  const [playerStart, setPlayerStart] = useState<number>(0);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: "안녕하세요! YouTube AI Transcript Hub 어시스턴트입니다. 🎥\n\n분석할 유튜브 동영상 링크 주소를 상단에 입력하고 분석 보고서를 완성한 다음, 궁금한 점을 질문해 주세요. 대본 속 실제 타임스탬프 자료를 명확하게 참조하여 상세하게 답변해 드립니다.",
      timestamp: "방금 전",
    },
  ]);
  const [inputChat, setInputChat] = useState<string>("");
  const [isChatTyping, setIsChatTyping] = useState<boolean>(false);

  // Toast Alerts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Ref scroll to bottom for chatbot log
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto Scroll Chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatTyping]);

  // Toast Trigger Helper
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Run Demo Sandbox Mode explicit triggers
  const handleLaunchDemo = () => {
    setVideoUrl(DEMO_VIDEO_URL);
    setVideoId(DEMO_VIDEO_ID);
    setAnalysis(demoAnalysisData);
    setPlayerStart(0);
    setChatMessages([
      {
        id: "demo-welcome",
        role: "model",
        text: "스티브 잡스의 역사적인 2007 아이폰 발표 데모가 성공적으로 활성화되었습니다! 🍏\n\n우측 워크스테이션에서 챕터를 선택하거나 대사를 클릭하여 비디오 플레이어 구간을 자유롭게 이동하고, 하단 인공지능 챗봇에게 아이폰의 멀티터치 혁신에 대해 질문해 보세요.",
        timestamp: "방금 전",
      }
    ]);
    showToast("스티브 잡스 2007 아이폰 키노트 데모 데이터를 로드했습니다.", "success");
  };

  // Safe manual parsed test sandbox
  const handleQuickManualDemoFill = () => {
    const formattedManualSample = demoAnalysisData.transcript
      .map((t) => `[${t.time}] ${t.text}`)
      .join("\n");
    setManualText(formattedManualSample);
    setAnalysisMode("manual");
    showToast("테스트용 자막 원문이 입력 필드에 자동으로 붙여넣어졌습니다.", "info");
  };

  // Clear workspace
  const handleResetWorkspace = () => {
    setVideoUrl("");
    setManualText("");
    setAnalysis(null);
    setVideoId("");
    setPlayerStart(0);
    setChatMessages([
      {
        id: "reset-welcome",
        role: "model",
        text: "워크스테이션이 완전히 초기화되었습니다. 분석할 유튜브 URL 또는 직접 복사한 텍스트 대본을 위 칸에 등록해 주세요.",
        timestamp: "방금 전",
      }
    ]);
    showToast("작업 내역이 초기화되었습니다.", "info");
  };

  // Core Analysis Trigger with dynamic stage simulator to emulate high-end radar scans
  const handleRunAnalysis = async () => {
    const parsedId = extractYoutubeId(videoUrl);
    if (!parsedId) {
      showToast("올바른 유튜브 주소(URL)를 입력해주세요.", "error");
      return;
    }

    if (analysisMode === "manual" && !manualText.trim()) {
      showToast("수동 분석 모드가 설정되었으나 복사된 자막 텍스트가 비어 있습니다.", "error");
      return;
    }

    setIsLoading(true);
    setLoadingProgress(10);
    setLoadingStep("1단계: YouTube 동영상 고유 식별 주소(ID) 해석 완료...");

    try {
      // 20% progress update
      await new Promise((r) => setTimeout(r, 800));
      setLoadingProgress(25);
      setLoadingStep("2단계: Gemini 2.5 Flash API 및 Search Grounding 커넥션 활성화 중...");

      // 45% progress update (Simulate parsing raw text if manual or searching web if auto)
      await new Promise((r) => setTimeout(r, 800));
      setLoadingProgress(50);
      setLoadingStep(
        analysisMode === "auto" 
          ? "3단계: 구글 검색 그라운딩 엔진 구동으로 크롤링 우회 데이터 수집 중..." 
          : "3단계: 수동 입력 대본 분석 및 시간 정규식 파서 로직 실행 중..."
      );

      // Perform real API call
      const payload = {
        mode: analysisMode,
        url: videoUrl,
        videoId: parsedId,
        manualText: analysisMode === "manual" ? manualText : ""
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s max analysis timeout

      setLoadingProgress(70);
      setLoadingStep("4단계: 제미나이 심층 심사 보고서(JSON) 생성 중...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "API 응답 오류 발생");
      }

      const resData = await response.json();
      
      // If result seems empty or structure mismatch, fallback helper
      if (!resData.videoTitle) {
        throw new Error("결과 포맷 구조가 올바르지 않습니다.");
      }

      setLoadingProgress(90);
      setLoadingStep("5단계: 자막 인덱스 맵 구축 및 플레이어 트리거 인터페이스 분석 완료.");
      await new Promise((r) => setTimeout(r, 600));

      setVideoId(parsedId);
      setAnalysis(resData);
      setPlayerStart(0);
      
      // Reset chatbot configuration
      setChatMessages([
        {
          id: "analysis-welcome",
          role: "model",
          text: `[${resData.videoTitle}]에 대한 AI 분석이 완벽히 성공적으로 완료되었습니다! 🥂\n\n요약 정보를 훑어보거나, 시간표 버튼을 눌러 정밀 매칭 탐색을 체험해보세요. 아래 채팅창으로 영상 내용에 대해 질문하면 즉각적으로 대변해 드립니다.`,
          timestamp: "방금 전",
        }
      ]);

      showToast("영상 분석 자료 동기화 완료!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(`분석 실패: ${err.message || "서버 혹은 네트워크 연결 에러가 발생했습니다."}`, "error");
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
      setLoadingStep("");
    }
  };

  // Click handler to instantly update video player cursor and update states
  const handleSeekVideo = (timeStr: string) => {
    const totalSeconds = parseTimeToSeconds(timeStr);
    setPlayerStart(totalSeconds);
    showToast(`비디오 재생 지점을 ${timeStr} (${totalSeconds}초) 위치로 동기화합니다.`, "info");
  };

  // Chat Submission Agent Action
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChat.trim()) return;

    if (!analysis) {
      showToast("분석된 비디오 정보가 가용하지 상태입니다. 먼저 비디오 분석을 진행해 주세요.", "error");
      return;
    }

    const userMessageText = inputChat.trim();
    const messageId = Math.random().toString(36).slice(2, 9);
    const newMsg: ChatMessage = {
      id: messageId,
      role: "user",
      text: userMessageText,
      timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputChat("");
    setIsChatTyping(true);

    try {
      // Package recent 10 messages of chat history as guidelines
      const recentHistoryMap = chatMessages
        .filter((m) => m.id !== "welcome" && m.id !== "demo-welcome" && m.id !== "reset-welcome" && m.id !== "analysis-welcome")
        .slice(-8)
        .map((m) => ({
          role: m.role,
          text: m.text
        }));

      const payload = {
        message: userMessageText,
        history: recentHistoryMap,
        videoTitle: analysis.videoTitle,
        channelName: analysis.channelName,
        videoId: videoId,
        transcript: analysis.transcript
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("채팅 커뮤니케이션 도중 통신 오류가 발생했습니다.");
      }

      const resData = await response.json();
      
      const modelMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2, 9),
        role: "model",
        text: resData.reply || "죄송합니다, 빈 답변이 반환되었습니다.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      };

      setChatMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.error(err);
      showToast(`챗봇 오류: ${err.message}`, "error");
      
      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 9),
          role: "model",
          text: "⚠️ 제미나이 챗봇 응답 수신 도중 에러가 발견되었습니다. 인터넷 커넥션 수립 여부를 진단하고 재시도해주세요.",
          timestamp: "방금 전"
        }
      ]);
    } finally {
      setIsChatTyping(false);
    }
  };

  // Helper: Copy string text utility with responsive toast
  const handleCopyText = (content: string, typeName: string) => {
    navigator.clipboard.writeText(content);
    showToast(`${typeName} 클립보드 복사 성공!`, "success");
  };

  // Downloads static generated chunks with customizable file extensities
  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${filename} 다운로드 완료!`, "success");
  };

  // Filter & search keywords in the transcript lines
  const filteredTranscript = analysis 
    ? analysis.transcript.filter((item) => 
        item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.time.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Re-highlight helper inside transcript tabs
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/30 text-yellow-300 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Subtitle plain data structures for various formats
  const getPlainTranscript = () => {
    if (!analysis) return "";
    return analysis.transcript.map((t) => t.text).join(" ");
  };

  const getTimestampedTranscript = () => {
    if (!analysis) return "";
    return analysis.transcript.map((t) => `[${t.time}] ${t.text}`).join("\n");
  };

  const getSrtTranscript = () => {
    if (!analysis) return "";
    return generateSRT(analysis.transcript);
  };

  const getJsonTranscript = () => {
    if (!analysis) return "{}";
    return JSON.stringify(analysis, null, 2);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 flex flex-col selection:bg-rose-600/30 font-sans antialiased custom-scrollbar overflow-x-hidden relative">
      
      {/* Dynamic Absolute Grid Glows */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none z-0" />
      <div className="absolute top-[400px] right-0 w-[500px] h-[500px] bg-indigo-900/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Primary Top Bar Header */}
      <header className="relative z-10 border-b border-white/10 bg-slate-900/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  YouTube AI <span className="text-indigo-400">Transcript Hub</span>
                </h1>
                <div className="flex items-center bg-slate-800/50 rounded-full px-2.5 py-1 border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-none">Gemini 3.5 Flash Online</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                서버리스 하이브리드 AI 유튜브 자막 분석 플랫폼
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-3 hidden sm:block">
              <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-mono">YouTube API v3</span>
              <span className="block text-[9px] text-emerald-400 font-mono">Pre-Configured &amp; Active</span>
            </div>
            <button
              onClick={handleResetWorkspace}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-white/5 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              대본 초기화
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-6 relative z-10 space-y-6">
        
        {/* URL Inputs + Dual-Mode Configuration Station Panel */}
        <section className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-[300px] h-full bg-linear-to-l from-indigo-500/5 to-transparent pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                <Layers className="w-4 h-4 text-indigo-400" />
                분석 매커니즘 환경 설정 (Configuration Station)
              </h2>
              <p className="text-xs text-slate-400">
                원클릭 자동 수집 또는 직접 드래그한 원본 자막 교정 모드를 변경하세요.
              </p>
            </div>

            {/* Mode Dual Switcher Tabs */}
            <div className="bg-slate-950 border border-white/10 p-1 rounded-lg flex items-center self-start md:self-auto">
              <button
                onClick={() => setAnalysisMode("auto")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  analysisMode === "auto"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                자동 분석 모드 (Auto)
              </button>
              <button
                onClick={() => setAnalysisMode("manual")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  analysisMode === "manual"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                수동 자막 파싱 모드 (Manual)
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Input Row 1: YouTube URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                유튜브 동영상 주소 (YouTube URL)
                <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="유튜브 URL을 입력하세요..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-24 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all outline-none"
                />
                <button
                  onClick={handleRunAnalysis}
                  disabled={isLoading}
                  className="absolute right-2 top-2 bottom-2 px-4 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer"
                >
                  {isLoading ? "Analyzing..." : "Analyze"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                • 지원 포맷: youtube.com, youtu.be, shorts 주소에서 비디오 식별 코드를 자동 발췌합니다.
              </p>
            </div>

            {/* Input Row 2: Manual Transcript Area (Only rendered in manual mode) */}
            {analysisMode === "manual" && (
              <div className="space-y-1.5 pt-1 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                    복사된 로우 자막 스크립트 붙여넣기
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickManualDemoFill}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-all font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    자막 자동 예제 붙여넣기
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    rows={5}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="YouTube 플레이어 하단 [더보기] -> [대본 표시]를 통해 드래그 복사한 불규칙한 원시 대본 텍스트를 그대로 붙여넣으세요.&#10;예시:&#10;[00:15] 안녕하세요 오늘 설명해드릴 기기는...&#10;01:23 이 장점은 엄청난 효율입니다.&#10;(02:10) 드디어 본문으로 들어갑니다."
                    className="w-full p-4 text-xs font-mono bg-slate-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600/50 text-slate-200 transition-all outline-none custom-scrollbar"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  • 텍스트 파서 정규식이 타임라인 <span className="text-indigo-400">{"/(?:\\[|\\()?(?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:\\]|\\))?/"}</span>을 정밀 식별해 문장 단위로 자동 자간 정합 처리를 진행합니다.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Outer Grid Workspace Block */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Media Companion Player + Meta Information + Client Chatbot */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            
            {/* Companion Player Glassbox */}
            <div className="bg-slate-950/50 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    인터랙티브 컴패니언 플레이어
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-mono font-bold tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AUTO SEEK LIVE
                </span>
              </div>

              {/* Responsive Video Canvas Frame with Dynamic Force-reboot IFrame Key */}
              <div className="relative aspect-video bg-black group border-b border-white/5">
                {videoId ? (
                  <iframe
                    key={`${videoId}-${playerStart}`}
                    id="youtube-player"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${playerStart}&enablejsapi=1`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full border-0"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#030712]">
                    <div className="w-14 h-14 bg-red-600/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-white ml-0.5 fill-current" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wide">비디오 준비 대기 중</p>
                      <p className="text-[10px] text-slate-500 max-w-[250px] mx-auto mt-1">유튜브 URL 링크를 등록하고 정밀 분석을 구동하십시오.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata Card below Player */}
              <div className="p-4 bg-slate-900/40 space-y-2.5">
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                    {analysis ? analysis.videoTitle : "[WWDC 2007] iPhone Introduction - Macworld San Francisco"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-semibold">
                      {analysis ? analysis.channelName : "Apple Archive"}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide font-mono font-bold">
                      #{videoId || "Q2a4W_u3eZc"}
                    </span>
                  </div>
                </div>

                {analysis && (
                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono bg-white/5 text-slate-300 px-2 py-1 rounded border border-white/5 font-bold">
                      ID: {videoId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyText(videoId, "영상 고유 ID")}
                        className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer border border-white/5"
                        title="영상 ID 복사"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        복사
                      </button>
                      <a
                        href={`https://www.youtube.com/watch?v=${videoId}`}
                        target="_blank"
                        rel="referrer noopener"
                        className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border border-white/5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        원본 보기
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Assistant Chatbot Panel */}
            <div className="flex flex-col bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden h-[450px] shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
              
              <div className="p-3 border-b border-white/10 flex items-center justify-between bg-slate-850/30 relative z-10">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                    AI Assistant Chatbot
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setChatMessages([
                    {
                      id: "welcome-re",
                      role: "model",
                      text: "대화방을 청소했습니다. 영상의 내용과 단락 데이터에 기반하여 무엇이든 자유롭게 문의해 주세요.",
                      timestamp: "방금 전"
                    }
                  ])}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              {/* Scrollable chat body */}
              <div className="flex-1 p-3.5 space-y-4 overflow-y-auto custom-scrollbar bg-slate-950/30 relative z-10" ref={chatScrollRef}>
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 max-w-[90%] ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        msg.role === "user"
                          ? "bg-red-600 text-white"
                          : "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                      }`}
                    >
                      {msg.role === "user" ? "MY" : "AI"}
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-xs p-2.5 rounded-lg border leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#1e152a]/60 border-indigo-500/20 text-slate-200 rounded-tr-none"
                            : "bg-slate-800/80 border-white/5 text-slate-300 rounded-tl-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="block text-[9px] text-slate-500 font-mono tracking-tighter text-right">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {isChatTyping && (
                  <div className="flex gap-2.5 items-center text-slate-500 text-xs animate-pulse">
                    <div className="w-6 h-6 rounded bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                      AI
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Footer Form */}
              <form onSubmit={handleSendChatMessage} className="p-3 border-t border-white/10 bg-slate-900/60 relative z-10 flex gap-2">
                <input
                  type="text"
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  placeholder={analysis ? "비디오 내용 검색 혹은 질문..." : "비디오 분석 후 활성화됩니다..."}
                  disabled={!analysis || isChatTyping}
                  className="flex-grow px-3 py-2 bg-slate-950/60 border border-white/10 rounded-lg text-xs placeholder:text-slate-500 text-white outline-none focus:border-indigo-500 transition-all disabled:bg-slate-950/20 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!analysis || !inputChat.trim() || isChatTyping}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-505 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center cursor-pointer gap-1"
                >
                  <Send className="w-3 h-3" />
                  전송
                </button>
              </form>
            </div>

          </div>

          {/* RIGHT COLUMN: Tab-Based Workstation Workspace Panel */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            
            {/* Workspace Glassmorphism Panel Container */}
            <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[600px] relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none z-0" />
              
              {/* Tab Selector Header */}
              <div className="border-b border-white/10 bg-slate-950/40 p-2 flex flex-wrap gap-1 relative z-10">
                <button
                  onClick={() => setActiveTab("transcript")}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "transcript"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  📝 대본 타임라인
                </button>
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "summary"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  ✨ AI 정밀 요약
                </button>
                <button
                  onClick={() => setActiveTab("chapters")}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "chapters"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  📌 비디오 챕터
                </button>
                <button
                  onClick={() => setActiveTab("save")}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "save"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  💾 데이터 저장
                </button>
              </div>

              {/* Active Tab Panel Frame Body */}
              <div className="flex-grow p-5 md:p-6 bg-slate-950/20 relative z-10">
                {analysis ? (
                  <div className="space-y-4 animate-fadeIn">
                    
                    {/* ====== TAB 1: TRANSCRIPT TRANSCRIPTION TIMELINE ====== */}
                    {activeTab === "transcript" && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-2 border-b border-white/10">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              대본 타임라인 분석 대화록
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              타임코드 버튼을 클릭하면 동영상이 해당 위치로 바로 점프합니다.
                            </p>
                          </div>

                          {/* Dynamic Search Keyword Filter */}
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="대본 내 문장 검색..."
                              className="w-full pl-8.5 pr-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs placeholder:text-slate-500 text-white outline-none focus:border-indigo-500 transition-all"
                            />
                          </div>
                        </div>

                        {/* Scrolling Transcript Wrapper */}
                        <div className="max-h-[480px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                          {filteredTranscript.length > 0 ? (
                            filteredTranscript.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => handleSeekVideo(item.time)}
                                className="group bg-slate-800/20 hover:bg-slate-800/50 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors flex gap-3 items-start select-none cursor-pointer text-left"
                              >
                                <span className="text-red-500 font-bold font-mono text-xs mt-0.5 shrink-0 flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/10 group-hover:bg-red-600 group-hover:text-white transition-all">
                                  <Clock className="w-3 h-3" />
                                  {item.time}
                                </span>
                                <p className="text-xs md:text-sm text-slate-300 group-hover:text-white leading-relaxed flex-grow">
                                  {renderHighlightedText(item.text, searchQuery)}
                                </p>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-all self-center shrink-0 opacity-0 group-hover:opacity-100" />
                              </div>
                            ))
                          ) : (
                            <div className="py-12 text-center text-xs text-slate-500">
                              <Search className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                              검색어 &ldquo;<span className="text-slate-300">{searchQuery}</span>&rdquo;와(과) 일치하는 대본 자락을 찾지 못했습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ====== TAB 2: AI SUMMARY & TAKEAWAYS ====== */}
                    {activeTab === "summary" && (
                      <div className="space-y-6">
                        
                        {/* Summary briefing widget */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Executive Briefing</span>
                             <div className="flex-grow h-[1px] bg-white/10"></div>
                          </div>
                          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4.5 md:p-5 backdrop-blur-xl">
                            <p className="text-xs md:text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                              {analysis.summary}
                            </p>
                          </div>
                        </div>

                        {/* Top 5 Takeaways check points */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Key Takeaways</span>
                             <div className="flex-1 h-[1px] bg-white/10"></div>
                          </div>
                          <div className="space-y-2">
                            {analysis.takeaways.map((item, idx) => (
                              <div
                                key={idx}
                                className="group bg-slate-850/40 hover:bg-slate-850/60 p-3 rounded-xl border border-white/5 transition-all flex gap-3 text-slate-300"
                              >
                                <span className="text-red-500 font-bold font-mono text-sm">{(idx + 1).toString().padStart(2, "0")}.</span>
                                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                                  {item}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Aesthetic Strategic Insights card block from mockup! */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Strategic Insights</span>
                             <div className="flex-1 h-[1px] bg-white/10"></div>
                          </div>
                          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-indigo-300">시장 파괴 및 UX 혁신 전략</h4>
                              <p className="text-xs text-slate-400">자막 데이터를 종합 분석하여 도출한 시장 침투 및 지식 아카이브 요점입니다. 인공지능이 감지한 기술적 통합성을 토대로 가치가 있는 단락들을 정기적으로 내보낼 수 있습니다.</p>
                              <div className="pt-2 flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-slate-400 border border-white/5 uppercase font-mono font-bold">#UX_혁신</span>
                                <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-slate-400 border border-white/5 uppercase font-mono font-bold">#기술통합</span>
                                <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-slate-400 border border-white/5 uppercase font-mono font-bold">#AI_요약</span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* ====== TAB 3: VIDEO CHAPTERS ====== */}
                    {activeTab === "chapters" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Video Chapters</span>
                           <div className="flex-grow h-[1px] bg-white/10"></div>
                        </div>

                        <div className="space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                          {analysis.topics.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSeekVideo(item.time)}
                              className="group bg-slate-800/20 hover:bg-slate-800/50 p-3.5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer flex gap-4 text-left select-none"
                            >
                              <button
                                type="button"
                                className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 self-start flex items-center gap-1 border border-indigo-500/10"
                              >
                                {item.time}
                              </button>

                              <div className="space-y-1">
                                <h5 className="text-xs md:text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                                  {item.title}
                                </h5>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ====== TAB 4: FILE EXPORTERS ====== */}
                    {activeTab === "save" && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Export Formats</span>
                           <div className="flex-grow h-[1px] bg-white/10"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Export Option 1: Clean plaintext outline */}
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/10 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center gap-1.5 text-white font-semibold text-xs uppercase tracking-wide">
                                <FileText className="w-4 h-4 text-red-500" />
                                단순 문장 원문 (.TXT)
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                시간 기호를 제외하고 발화 텍스트들을 띄어쓰기로 통합한 온전한 한국어 완성 연설 대본입니다.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 self-end pt-2">
                              <button
                                onClick={() => handleCopyText(getPlainTranscript(), "단순 문장 자막")}
                                className="px-3 py-1.5 text-xs font-semibold bg-slate-850 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer border border-white/5"
                              >
                                <Copy className="w-3.5 h-3.5" /> 복사
                              </button>
                              <button
                                onClick={() => handleDownloadFile(getPlainTranscript(), `${analysis.videoTitle}_plain.txt`)}
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> 다운로드
                              </button>
                            </div>
                          </div>

                          {/* Export Option 2: Timestampped rows text */}
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/10 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center gap-1.5 text-white font-semibold text-xs uppercase tracking-wide">
                                <Clock className="w-4 h-4 text-indigo-400" />
                                타임라인 포함 자막 기록 (.TXT)
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                각 단락 열 지점마다 고정 타임스탬프를 보존하여 인덱싱 열람이 가능한 텍스트 파일입니다.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 self-end pt-2">
                              <button
                                onClick={() => handleCopyText(getTimestampedTranscript(), "타임스탬프 자막")}
                                className="px-3 py-1.5 text-xs font-semibold bg-slate-850 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer border border-white/5"
                              >
                                <Copy className="w-3.5 h-3.5" /> 복사
                              </button>
                              <button
                                onClick={() => handleDownloadFile(getTimestampedTranscript(), `${analysis.videoTitle}_timetables.txt`)}
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> 다운로드
                              </button>
                            </div>
                          </div>

                          {/* Export Option 3: Standard SRT Subtitle file with duration interpolation */}
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/10 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center gap-1.5 text-white font-semibold text-xs uppercase tracking-wide">
                                <Video className="w-4 h-4 text-emerald-400" />
                                표준 미디어 자막 포맷 (.SRT)
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                플레이어 자막 트랙 싱크 업로드 및 프리미어, 곰플레이어에 즉시 주입 가능한 국제 자막 규격 자물쇠 파일입니다.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 self-end pt-2">
                              <button
                                onClick={() => handleCopyText(getSrtTranscript(), "SRT 자막 시퀀스")}
                                className="px-3 py-1.5 text-xs font-semibold bg-slate-850 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer border border-white/5"
                              >
                                <Copy className="w-3.5 h-3.5" /> 복사
                              </button>
                              <button
                                onClick={() => handleDownloadFile(getSrtTranscript(), `${analysis.videoTitle}.srt`)}
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> 다운로드
                              </button>
                            </div>
                          </div>

                          {/* Export Option 4: Full structural JSON representation */}
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/10 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex items-center gap-1.5 text-white font-semibold text-xs uppercase tracking-wide">
                                <FileJson className="w-4 h-4 text-amber-400" />
                                데이터 구조화 통계 개체 (.JSON)
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                제미나이가 최종 빌드한 메타데이터 전반(요점, 챕터, 자막 포함)의 순수 구조체 JSON 스펙 파일입니다.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 self-end pt-2">
                              <button
                                onClick={() => handleCopyText(getJsonTranscript(), "데이터 구조체 JSON")}
                                className="px-3 py-1.5 text-xs font-semibold bg-slate-850 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer border border-white/5"
                              >
                                <Copy className="w-3.5 h-3.5" /> 복사
                              </button>
                              <button
                                onClick={() => handleDownloadFile(getJsonTranscript(), `${analysis.videoTitle}.json`)}
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> 다운로드
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="py-24 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500 shadow-inner">
                      <Layers className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-300">
                        대본 및 요약 분석 워크스테이션이 비어 있습니다.
                      </p>
                      <p className="text-xs text-slate-500 max-w-[340px] mx-auto mt-1 leading-relaxed">
                        상단에서 유튜브 동영상 주소(URL)를 입력한 뒤 &lsquo;AI 정밀 분석 실행(Analyze)&rsquo;을 누르시면 자막 정보와 실시간 AI 정밀 요약이 구축됩니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </section>

      </main>

      {/* Primary Brand Footer info */}
      <footer className="relative z-10 border-t border-white/5 bg-slate-950/80 py-6 mt-12 text-slate-500 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; 2026 YouTube AI Transcript Hub &bull; Powered by Gemini 3.5 &amp; Google Search Grounding.
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
              ● API CLIENT COUPLING SECURED
            </span>
          </div>
        </div>
      </footer>

      {/* ================= LOADING SCREEN OVERLAY ================= */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none animate-fadeIn">
          
          {/* Radar Radar Ripples */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full bg-rose-600/10 border border-rose-500/30 animate-pulse-radar" />
            <div className="absolute inset-4 rounded-full bg-indigo-600/10 border border-indigo-500/30 animate-pulse-radar [animation-delay:0.8s]" />
            <div className="absolute inset-8 rounded-full bg-rose-600/10 border border-rose-500/30 animate-pulse-radar [animation-delay:1.6s]" />
            
            <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center shadow-2xl shadow-rose-600/50 z-10">
              <Sparkles className="w-6 h-6 text-white animate-spin" />
            </div>
          </div>

          <div className="text-center max-w-md space-y-3.5">
            <h3 className="text-lg font-display font-bold text-white uppercase tracking-wider">
              Gemini AI Transcribing...
            </h3>
            
            <div className="w-64 h-1.5 bg-slate-900 border border-white/5 rounded-full mx-auto overflow-hidden">
              <div 
                className="h-full bg-linear-to-r from-rose-500 to-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            <p className="text-xs text-slate-300 font-medium font-mono min-h-[30px]">
              {loadingStep}
            </p>

            <span className="text-[10px] text-slate-500">
              구글 서치 수집 및 자막 해석 과정에서 최대 30초 가량 소요됩니다. 잠시만 기다려 주십시오.
            </span>
          </div>
        </div>
      )}

      {/* ================= CUSTOM PREMIUM FLOATING TOASTS ================= */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border flex items-start gap-3 shadow-lg transition-all duration-300 animate-slideUp ${
              toast.type === "success"
                ? "bg-emerald-950/85 border-emerald-500/30 text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-950/85 border-rose-500/30 text-rose-200"
                : "bg-indigo-950/85 border-indigo-500/30 text-indigo-200"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-400 stroke-[3px]" />
              ) : toast.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <Info className="w-4 h-4 text-indigo-400" />
              )}
            </div>

            <div className="space-y-0.5 flex-grow">
              <p className="text-xs font-semibold">
                {toast.type === "success" ? "성공" : toast.type === "error" ? "오류 알림" : "안내"}
              </p>
              <p className="text-[11px] font-medium leading-relaxed opacity-90">
                {toast.message}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
