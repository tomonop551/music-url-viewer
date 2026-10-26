export interface MusicUrlRecord {
  message_id: string;
  url: string;
  timestamp: string;
  title?: string;
  dopamine?: number;
  [key: string]: unknown;
}
