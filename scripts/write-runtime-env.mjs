import { writeFileSync } from "node:fs";

// Export only the application configuration required by Amplify SSR.
const names = ["NEXT_PUBLIC_AWS_REGION", "MUSIC_TABLE_NAME", "APP_ORIGIN", "AGENTCORE_RUNTIME_ARN", "CHAT_TABLE_NAME", "CHAT_DAILY_LIMIT"];
const content = names.filter(name => process.env[name] !== undefined)
  .map(name => `${name}=${JSON.stringify(process.env[name])}`).join("\n");
writeFileSync(".env.production", content + "\n", { mode: 0o600 });
