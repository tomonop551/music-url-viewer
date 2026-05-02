export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly NEXT_PUBLIC_AWS_REGION?: string;
      readonly NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}
