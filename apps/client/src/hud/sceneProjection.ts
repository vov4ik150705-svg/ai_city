/** CSS-pixel projection of a selected building onto the scene host.
 * `x`/`y` are the mesh center; `width`/`height` are the screen AABB. */
export type SceneProjection = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly visible: boolean
}
