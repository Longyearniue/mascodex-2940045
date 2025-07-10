declare module 'vite' {
  // Minimal subset needed for our config usage
  export interface UserConfig {
    [key: string]: unknown;
  }
  export function defineConfig(config: UserConfig): UserConfig;
}