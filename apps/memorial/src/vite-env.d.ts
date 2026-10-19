/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_PORT?: string;
  readonly VITE_ADMIN_URL?: string;
  readonly VITE_PUBLIC_URL?: string;
  readonly VITE_ADMIN_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
