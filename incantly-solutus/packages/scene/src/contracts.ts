import type { Color, NodeId, SceneId, Vec2, Vec3 } from "@incantly/core";
import type { Expression } from "@incantly/math";

export type Formula<T> = T | Expression;
export type Transform2D = Readonly<{ position: Formula<Vec2>; rotation: Formula<number>; scale: Formula<Vec2> }>;
export type Transform3D = Readonly<{ position: Formula<Vec3>; rotation: Formula<Vec3>; scale: Formula<Vec3> }>;

export type SceneNode = Readonly<{
  id: NodeId;
  kind: "shape2d" | "mesh3d" | "light" | "camera" | "group" | "optics";
  children: readonly NodeId[];
  visible: Formula<boolean>;
}>;

export type Scene = Readonly<{ id: SceneId; nodes: ReadonlyMap<NodeId, SceneNode> }>;
export type RenderFrame = Readonly<{ width: number; height: number; clearColor: Color; scene: Scene }>;

export interface Renderer {
  render(frame: RenderFrame): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
