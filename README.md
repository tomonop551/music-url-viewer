# Music URL Viewer

A modern, high-performance web application built with Next.js to display music URLs stored in AWS DynamoDB.

## AI music companion

A responsive chat recommends registered tracks using Amazon Bedrock AgentCore. It uses independent MusicBrainz metadata for mood estimates and keeps the 0–10 addictiveness score separate from mood. No manual tagging is required.

See [architecture and validation](docs/ai-chat.md) and [deployment skill](.agents/skills/deploy-ai-chat/SKILL.md). The metadata coverage and live model integration must be verified in the deployment environment.

## Features

- **Server-Side Rendering (SSR)**: Securely fetches data from DynamoDB without exposing AWS credentials to the client.
- **Incremental Static Regeneration (ISR)**: Cached for 24 hours to ensure blazing-fast performance and minimal AWS costs.
- **Modern UI**: Clean, responsive card-based layout built with Tailwind CSS.
- **Auto-Sorting**: Automatically sorts entries by timestamp in descending order.
- **Secure Authentication**: Utilizes IAM Roles/Service Roles for AWS authentication, following security best practices.

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AWS SDK**: [AWS SDK for JavaScript v3](https://aws.amazon.com/sdk-for-javascript/)
- **Runtime Manager**: [mise](https://mise.jdx.dev/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Deployment**: [AWS Amplify Hosting](https://aws.amazon.com/amplify/hosting/)

## Prerequisites

- **Node.js**: LTS version (managed via `mise`)
- **AWS Account**: With a DynamoDB table named `MusicUrls`
- **DynamoDB Table Schema**:
  - Partition Key: `message_id` (String)
  - Columns: `url` (String), `user_name` (String), `timestamp` (String/ISO8601)

## Getting Started

### 1. Setup Environment

Using `mise` and `pnpm`:

```bash
# Setup runtimes
mise install
mise use node@lts
mise use pnpm@latest

# Install dependencies
pnpm install
```

### 2. AWS Authentication

This project follows the AWS best practice of using implicit credentials.

#### Local Development
Ensure you have configured your local AWS profile:
```bash
aws configure
```
The SDK will automatically use your default profile from `~/.aws/credentials`.

#### Production (AWS Amplify)
Attach the `AmazonDynamoDBReadOnlyAccess` policy to the IAM Service Role assigned to your Amplify Hosting instance. No environment variables for credentials are required.

### 3. Run Development Server

```bash
mise run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the result.

## Project Structure

- `src/app/page.tsx`: Main page with ISR configuration.
- `src/lib/dynamodb.ts`: DynamoDB client and data fetching logic.
- `src/lib/env.ts`: Type-safe environment variable management.
- `src/types/`: TypeScript definitions for music records and chat messages.

## Deployment

Use the repository's [deploy-ai-chat skill](.agents/skills/deploy-ai-chat/SKILL.md) to prepare, deploy, verify, or roll back the Terraform infrastructure and Amplify application.

Example request: `$deploy-ai-chat Prepare a deployment plan for the music companion.`

## License

MIT
