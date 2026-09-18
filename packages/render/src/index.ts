export { tileOrigin, tileCenter, frontVertex, tileCubeH, floorDiv, inTileDiamond, tileFromWorld } from "./iso.js"
export type { IsoPoint } from "./iso.js"
export {
  snapZoomIndex,
  zoomAt,
  stepZoomIndex,
  zoomInPack,
  clampCamera,
  lookAtZone,
  cameraWorldOffset,
  screenToWorld,
  objectAtTile,
  hitFromWorld,
  routeSceneClick,
} from "./camera.js"
export type { ZoomLevel, CamBounds, Camera, TileHit } from "./camera.js"
export {
  isTap,
  isPan,
  isSceneTap,
  isDoubleTap,
  pinchZoomDir,
  keyPanDir,
  keyZoomDir,
  applyKeyZoom,
} from "./input.js"
export {
  cellAt,
  loadScene,
  isShore,
  isRoadCell,
  neighborMask,
  roadSprite,
  sidewalkSprite,
  topSpriteId,
  lowerSpriteId,
  padFootprints,
  tileOnPad,
  groundTopId,
} from "./ground.js"
export type { SceneObject, PadFoot } from "./ground.js"
export {
  chunkIndex,
  chunkCount,
  chunkMatchesPeriod,
  seamClosed,
  staticDrawCalls,
} from "./chunk.js"
export {
  observeVisualBudgets,
  observeVisual3Budgets,
  observeIslandBudgets,
  underVisualCaps,
  copiedFromCaps,
} from "./budget.js"
export type { VisualCaps, VisualObserved, ObserveArgs, Observe3Args, ObserveIslandArgs } from "./budget.js"
export {
  keepTiles,
  firstHitTile,
  pixelKept,
  keepMaskGraphics,
  needsColumnMask,
} from "./columnMask.js"
export { probeCanvas, gpuCode } from "./gpu.js"
export type { GpuProbe, CanvasLike } from "./gpu.js"
export {
  islandCells,
  islandBoxes,
  islandCenter,
  landCells,
  plantWater,
  shoreFoam,
} from "./island.js"
export type { IslandCell, IslandBox, WaterPlane } from "./island.js"
export { loadHeroCatalog, plantHeroes, pickHeroLod } from "./heroes.js"
export type { HeroLot, HeroCatalogRow } from "./heroes.js"
export type { OccupiedPlant, AnchorPose } from "./islandPlant.js"
export {
  STUDIO_PLANTS,
  occupiedForMode,
  warehousePackId,
} from "./islandOccupancy.js"
export type { OccupancyMode } from "./islandOccupancy.js"
export {
  fitHeroCamera,
  projectedWidthFill,
  aabbUnion,
  aabbCenter,
  aabbSize,
  azimuthToBps,
  elevationToTiltBps,
} from "./islandCamera.js"
export type { Aabb, HeroFit, Vec3 } from "./islandCamera.js"
export { zoomOrbitDistance, meshoptDecoderReady } from "./islandZoom.js"
export { bindIslandPreviewOrbit } from "./islandOrbitInput.js"
export type { IslandOrbitState } from "./islandOrbitInput.js"
export { parityMismatch } from "./islandCapture.js"
export type { IslandCaptureMeta } from "./islandCapture.js"
export { classifyIslandMaterial, applyIslandMaterials } from "./islandMaterials.js"
export {
  SHARED_ISLAND_RUNTIME,
  RENDERER_REVISION,
  WORLD_HEMI_SKY,
  WORLD_HEMI_GROUND,
  WORLD_EXPOSURE,
  HERO_FOV_DEG,
  HERO_AZIMUTH_DEG,
  HERO_ELEVATION_DEG,
  WIDTH_FILL_MIN,
  WIDTH_FILL_MAX,
  ZOOM_FACTOR,
} from "./islandConfig.js"
export { isPackedWalker, plantUnits, unitShiftBps, unitWorldPos } from "./units.js"
export type { PackedUnit, UnitPos } from "./units.js"
export {
  decorKind,
  isPackedDecor,
  isPackedVehicle,
  isPackedDrone,
  plantDecor,
  decorOfKind,
  vehicleWorldXZ,
  droneWorldXZ,
  poseVehicle,
  poseDrone,
} from "./world.js"
export type { DecorKind, DecorRow, WorldPos } from "./world.js"
export {
  hitPlaneY,
  snapTile,
  heroAtTile,
  hudSurfaceBlocksPick,
  pickFromRay,
} from "./pick.js"
export {
  clampOrbit,
  wrapOrbit,
  qturnToRad,
  turnToRad,
  orbitDefaultDistance,
  orbitEye,
} from "./orbit.js"
export type { IslandHandle, IslandObjectProjection } from "./frame.js"
export {
  cloudLift,
  painterDepth,
  painterTie,
  spriteScreenPos,
  sortPlaced,
  overlayAt,
  badgeKind,
  badgeSprite,
  badgeOnScene,
  objectIdle,
  labelsVisible,
  labelRank,
  skipOverlappingLabels,
  badgePulseOn,
  pipWorldPos,
  sceneMarkers,
  footprintDiamond,
  instanceFoot,
  instanceFlip,
} from "./sprites.js"
export type {
  SpriteFrame,
  AtlasFrame,
  OverlayRow,
  BadgeRow,
  Ranked,
  LabelBox,
  SceneMarker,
} from "./sprites.js"
export {
  hourOfDay,
  hourInPhase,
  hoursLeftInPhase,
  currentPhase,
  nextPhase,
  phaseBlendBps,
  mixBps,
  glowGainBps,
  lightsOn,
  spriteGlows,
  gradeChannel,
  gradeRgb,
} from "./light.js"
export type { PhaseRow, Rgb } from "./light.js"
export {
  mixTurnBps,
  mixSun,
  sunPose,
  sunDir,
  windowGainBps,
  signGainBps,
} from "./sun.js"
export type { SunRow, SunPhase } from "./sun.js"
export {
  worldPrng,
  isBackgroundUnit,
  isMotionUnit,
  walkerFacing,
  walkerSpriteId,
  cityMinutes,
  atlasFrame,
  smokeSpriteId,
  turbineSpriteId,
  flagSpriteId,
  billboardSpriteId,
  waterfallSpriteId,
  shoreWaveSpriteId,
  droneBobSpriteId,
  vehicleDirSprite,
  roadDirs,
  vehiclePose,
  vehicleWorldPos,
  dronePose,
  droneWorldPos,
  droneShadowPos,
  shadowAlphaBps,
  birdVisible,
  lerpIso,
} from "./motion.js"
export type { Dir, VehicleStart, DroneStart, BlockRect, VehiclePose, DronePose } from "./motion.js"
export type { GlyphMetric } from "./glyphs.js"
export { snapLutFilter } from "./lut.js"
export { popupPose, glowGainWithTick } from "./fx.js"
export type { PopupEvent, PopupPose } from "./fx.js"
