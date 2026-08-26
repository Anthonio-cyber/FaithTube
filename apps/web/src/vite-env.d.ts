/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin of the FaithTube API, e.g. https://faithtube.onrender.com.
   * Leave unset when the client and API share an origin.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
