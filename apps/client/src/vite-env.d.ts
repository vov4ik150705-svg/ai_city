/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_CORPORATOR_API_ORIGIN?: string
  }
}

declare module "*?url" {
  const src: string
  export default src
}


