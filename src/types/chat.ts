export interface Recommendation {
  id: string;
  title: string;
  url: string;
  dopamine?: number;
  reason: string;
}
export interface ChatReply {
  message: string;
  recommendations: Recommendation[];
}
export interface ChatMessage extends ChatReply {
  role: "user" | "assistant";
}
