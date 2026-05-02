/** Environment variable definitions. Shared settings between server and client sides. */

export const env = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || "ap-northeast-1",
} as const;
