export type SceneNodeKind =
  | "frame"
  | "group"
  | "rectangle"
  | "ellipse"
  | "line"
  | "polygon"
  | "text";

export interface SolidFill {
  type: "solid";
  color: string; // CSS hex/rgba
  opacity: number; // 0-1
}

export interface GradientStop {
  offset: number; // 0-1
  color: string;
}

export interface GradientFill {
  type: "linear" | "radial";
  stops: GradientStop[];
  opacity: number;
}

export type Fill = SolidFill | GradientFill;

export interface ShadowEffect {
  type: "drop-shadow" | "inner-shadow";
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
}

export interface BlurEffect {
  type: "layer-blur" | "background-blur";
  radius: number;
}

export type Effect = ShadowEffect | BlurEffect;

export interface Stroke {
  color: string;
  width: number;
  position: "inside" | "center" | "outside";
  opacity: number;
}

export interface TextProps {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

export interface SceneNode {
  id: string;
  kind: SceneNodeKind;
  name: string;
  parentId: string | null;
  childIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  visible: boolean;
  locked: boolean;
  fills: Fill[];
  strokes: Stroke[];
  cornerRadius?: number; // rectangle
  polygonSides?: number; // polygon, default 3
  clipsContent?: boolean; // frame
  text?: TextProps; // text
  effects?: Effect[];
}

export interface SceneGraph {
  rootId: string;
  nodes: Record<string, SceneNode>;
}
