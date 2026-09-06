import { preview } from "../src/preview.js"

const p = preview({ fund: 1n })
p["fund"] = 2n
