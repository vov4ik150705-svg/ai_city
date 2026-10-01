import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Economy } from "./blocks/economy/Economy"
import { SiteContext } from "./site"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/controls.css"

const rootEl = document.getElementById("root")
if (rootEl === null) throw new Error("preview root missing")

createRoot(rootEl).render(
  <StrictMode>
    <SiteContext.Provider value={{ navigate: () => undefined, open: () => undefined, openPlay: () => undefined }}>
      <Economy />
    </SiteContext.Provider>
  </StrictMode>,
)
