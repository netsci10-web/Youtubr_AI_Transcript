import fetch from "node-fetch";

async function fetchYoutubeTranscript(videoId: string): Promise<{ time: string; text: string }[]> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "ko,en-US;q=0.9,en;q=0.8"
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
    console.log("Caption tracks available:", captionTracks?.map((t: any) => ({ languageCode: t.languageCode, name: t.name?.simpleText, kind: t.kind })));
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error("유튜브 동영상에서 자막 트랙(Captions)을 확인할 수 없습니다.");
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

fetchYoutubeTranscript("EnkJP6f3ics")
  .then(res => {
    console.log("Transcript loaded successfully. Count:", res.length);
    console.log("First 3 subtitles:", res.slice(0, 3));
    console.log("Last 3 subtitles:", res.slice(-3));
  })
  .catch(err => {
    console.error("fetch failed:", err);
  });
