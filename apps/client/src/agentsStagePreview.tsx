import { createRoot } from "react-dom/client"
import { AgentsShowcase } from "./hud/parts/AgentsShowcase.js"

const root = document.getElementById("root")
if (root !== null) {
  createRoot(root).render(<AgentsShowcase />)
}
