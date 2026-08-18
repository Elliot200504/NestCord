/// <reference types="vite/client" />

/**
 * The browser-exposed environment, spelled out.
 *
 * `vite/client` types unknown keys as `any`, which is how a typo in a variable name
 * gets to be a runtime `undefined` instead of a build error.
 */
interface ImportMetaEnv {
  /** Comma-separated STUN servers for voice. Optional; a public default is used. */
  readonly VITE_STUN_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
