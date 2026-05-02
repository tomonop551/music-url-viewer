# Music URL Viewer

A modern, high-performance web application built with Next.js to display music URLs stored in AWS DynamoDB.

## Features

- **Server-Side Rendering (SSR)**: Securely fetches data from DynamoDB without exposing AWS credentials to the client.
- **Incremental Static Regeneration (ISR)**: Cached for 24 hours to ensure blazing-fast performance and minimal AWS costs.
- **Modern UI**: Clean, responsive card-based layout built with Tailwind CSS.
- **Auto-Sorting**: Automatically sorts entries by timestamp in descending order.
- **Secure Authentication**: Utilizes IAM Roles/Service Roles for AWS authentication, following security best practices.

## Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
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
- `src/types/`: TypeScript definitions for domain models and process environment.

## Deployment

1. Connect your repository to **AWS Amplify Hosting**.
2. Set the environment variable `NEXT_PUBLIC_AWS_REGION` to `ap-northeast-1` (or your preferred region).
3. Ensure the Amplify Service Role has read access to your DynamoDB table.
4. Deploy!

## License

MIT
