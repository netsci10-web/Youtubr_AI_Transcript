/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TopicItem {
  time: string;
  title: string;
  desc: string;
  seconds?: number; // Calculated for player jumping
}

export interface TranscriptItem {
  time: string;
  text: string;
  seconds?: number; // Calculated for player jumping
}

export interface VideoAnalysis {
  videoTitle: string;
  channelName: string;
  summary: string;
  takeaways: string[];
  topics: TopicItem[];
  transcript: TranscriptItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}
