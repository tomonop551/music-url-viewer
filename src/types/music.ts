export interface MusicUrlRecord {
  message_id: string;
  url: string;
  user_name: string;
  timestamp: string;
  title?: string;
  dopamine?: number;
  [key: string]: unknown;
}

// 受信生データ（どのフィールドも省略され得る場合の型）
export type MusicUrlResponseItem = Partial<MusicUrlRecord> & Record<string, unknown>;
