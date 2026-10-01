/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CORPORATOR_API_ORIGIN?: string
}

declare module "*?url" {
  const src: string
  export default src
}
