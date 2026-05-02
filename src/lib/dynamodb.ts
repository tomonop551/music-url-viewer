import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { MusicUrlRecord, MusicUrlResponseItem } from "@/types/music";
import { env } from "./env";

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: env.region,
});

const docClient = DynamoDBDocumentClient.from(client);

/**
 * Fetches all records from the MusicUrls table and returns them sorted by newest first.
 */
export async function getMusicUrls(): Promise<MusicUrlRecord[]> {
  const tableName = "MusicUrls";

  try {
    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await docClient.send(command);
    const rawItems = (response.Items as MusicUrlResponseItem[]) || [];

    // Filter items that have all required fields and ensure type safety
    const validItems = rawItems.filter((item): item is MusicUrlRecord => {
      return !!(
        item.message_id &&
        item.url &&
        item.user_name &&
        item.timestamp
      );
    });

    // Sort by timestamp (ISO8601 format) in descending order
    return validItems.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  } catch (error) {
    console.error("Error fetching from DynamoDB:", error);
    throw new Error("Failed to fetch music URLs");
  }
}
