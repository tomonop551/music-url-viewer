export interface MusicUrlRecord {
  message_id: string;
  url: string;
  user_name: string;
  timestamp: string;
  title?: string;
}

// Raw data as received (in case all fields could be optional)
export type MusicUrlResponseItem = Partial<MusicUrlRecord> & Record<string, any>;
