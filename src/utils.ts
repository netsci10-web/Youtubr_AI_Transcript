/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Parses times like "02:15" or "01:23:45" into integer seconds
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  if (parts.length === 3) {
    // HH:MM:SS
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (parts.length === 2) {
    // MM:SS
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }
  return 0;
}

// Extract YouTube Video ID from any standard URL format
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

interface RawRecord {
  time: string;
  text: string;
}

// Manual parser utilizing /(?:\[|\()?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\]|\))?/
export function parseManualTranscript(rawText: string): RawRecord[] {
  if (!rawText) return [];
  const lines = rawText.split("\n");
  const results: RawRecord[] = [];
  
  // Custom regular expression as matching timeline format
  const timeRegex = /(?:\[|\()?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\]|\))?/;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const match = line.match(timeRegex);
    if (match) {
      const timestampString = match[0];
      // Strip brackets & parentheses
      const cleanTime = timestampString.replace(/[\[\]\(\)]/g, "").trim();
      const contentText = line.replace(timestampString, "").trim();

      results.push({
        time: cleanTime,
        text: contentText,
      });
    } else {
      // Loose text item: bind to previous item context
      if (results.length > 0) {
        results[results.length - 1].text += " " + line;
      } else {
        // Fallback beginning anchor
        results.push({
          time: "00:00",
          text: line,
        });
      }
    }
  }

  return results
    .map((item) => ({
      time: item.time,
      text: item.text.replace(/\s+/g, " ").trim(),
    }))
    .filter((item) => item.text.length > 0);
}

// Generates valid standard SRT subtitle string
export function generateSRT(transcript: { time: string; text: string }[]): string {
  if (!transcript || transcript.length === 0) return "";
  let srt = "";

  for (let i = 0; i < transcript.length; i++) {
    const current = transcript[i];
    const next = transcript[i + 1];
    
    const currSec = parseTimeToSeconds(current.time);
    // Find next block start time, or default to adding 4 seconds
    const nextSec = next ? parseTimeToSeconds(next.time) : currSec + 4;
    
    let endSec = nextSec;
    // Cap screen display duration to prevent overlap and overflow
    if (endSec - currSec > 5) {
      endSec = currSec + 4;
    }
    if (endSec <= currSec) {
      endSec = currSec + 2;
    }

    const formatSRTClock = (totalSec: number) => {
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = Math.floor(totalSec % 60);
      const ms = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    };

    const blockIndex = i + 1;
    const timeFrame = `${formatSRTClock(currSec)} --> ${formatSRTClock(endSec)}`;
    srt += `${blockIndex}\n${timeFrame}\n${current.text}\n\n`;
  }

  return srt;
}
