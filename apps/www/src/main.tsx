import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { startSmoothScroll } from "./smoothScroll"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/controls.css"
import "./styles/shell.css"
import "./docs/handbook/fonts.css"

const rootEl = document.getElementById("root")
if (rootEl === null) {
  throw new Error("www root missing")
}

startSmoothScroll()

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
