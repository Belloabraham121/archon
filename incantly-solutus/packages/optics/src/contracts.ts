import type { Color, Vec2, Vec3 } from "@incantly/core";
import type { Formula } from "@incantly/scene";

export type GlassMaterial = Readonly<{
  ior: Formula<number>;
  thickness: Formula<number>;
  tint: Formula<Color>;
  absorption: Formula<Vec3>;
  roughness: Formula<number>;
  transmission: Formula<number>;
  dispersion?: Formula<number>;
}>;

export type LightEmitter = Readonly<{
  kind: "laser" | "point" | "directional";
  position: Formula<Vec2>;
  direction: Formula<Vec2>;
  color: Formula<Color>;
  intensity: Formula<number>;
}>;

export type OpticsQuality = "interactive" | "preview" | "high";
export type OpticsSettings = Readonly<{ quality: OpticsQuality; maxBounces: number; samplesPerBeam: number }>;
