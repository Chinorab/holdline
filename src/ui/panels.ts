// Spatial panels created at runtime from UIKitML files: placed relative to the board,
// sized in meters, clickable by hand ray, gaze, controller or touch only while shown.

import {
  PanelDocument,
  PanelUI,
  PokeInteractable,
  RayInteractable,
  type Entity,
  type UIKitDocument,
  type World,
} from '@iwsdk/core';
import { HoldlinePanel } from '../game/tags.js';

type Element = NonNullable<ReturnType<UIKitDocument['getElementById']>>;
type Props = Parameters<Element['setProperties']>[0];

export class Panel {
  readonly entity: Entity;
  document: UIKitDocument | null = null;
  private shown = false;
  private readonly texts = new Map<string, string>();
  private readonly props = new Map<string, Props>();
  private readonly clicks: [string, () => void][] = [];

  constructor(
    world: World,
    parent: Entity,
    readonly id: string,
    url: string,
    readonly widthM: number,
    readonly heightM: number,
    /** Panels without buttons stay out of the way of rays and gaze. */
    readonly interactive = true,
  ) {
    this.entity = world.createTransformEntity(undefined, { parent });
    const object = this.entity.object3D;
    if (object) {
      object.name = id;
      object.visible = false;
    }
    this.entity.addComponent(HoldlinePanel, { panelId: id });
    this.entity.addComponent(PanelUI, { config: url });
  }

  /** True once the UIKitML document exists; applies queued texts and handlers. */
  poll(): boolean {
    if (this.document) return true;
    const doc = this.entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    if (!doc) return false;
    this.document = doc;
    doc.setTargetDimensions(this.widthM, this.heightM);
    for (const [id, text] of this.texts) this.element(id)?.setProperties({ text } as Props);
    for (const [id, p] of this.props) this.element(id)?.setProperties(p);
    for (const [id, fn] of this.clicks) {
      const el = this.element(id);
      if (el) {
        el.name = id;
        el.addEventListener('click', fn);
      }
    }
    return true;
  }

  private element(id: string): Element | null {
    return this.document?.getElementById(id) ?? null;
  }

  setText(id: string, text: string): void {
    if (this.texts.get(id) === text) return;
    this.texts.set(id, text);
    this.element(id)?.setProperties({ text } as Props);
  }

  setProps(id: string, props: Props): void {
    this.props.set(id, { ...(this.props.get(id) ?? {}), ...props });
    this.element(id)?.setProperties(props);
  }

  onClick(id: string, fn: () => void): void {
    this.clicks.push([id, fn]);
    const el = this.element(id);
    if (el) {
      el.name = id;
      el.addEventListener('click', fn);
    }
  }

  get visible(): boolean {
    return this.shown;
  }

  show(on: boolean): void {
    if (this.shown === on) return;
    this.shown = on;
    const object = this.entity.object3D;
    if (object) object.visible = on;
    if (on && this.interactive) {
      if (!this.entity.hasComponent(RayInteractable)) this.entity.addComponent(RayInteractable);
      if (!this.entity.hasComponent(PokeInteractable)) this.entity.addComponent(PokeInteractable);
    } else if (!on) {
      if (this.entity.hasComponent(RayInteractable)) this.entity.removeComponent(RayInteractable);
      if (this.entity.hasComponent(PokeInteractable)) this.entity.removeComponent(PokeInteractable);
    }
  }

  /** Position on the board, tilted back by `tiltRad`, turned by `yawRad` (toward +x). */
  place(x: number, y: number, z: number, tiltRad: number, yawRad = 0): void {
    const object = this.entity.object3D;
    if (!object) return;
    object.position.set(x, y, z);
    object.rotation.set(tiltRad, yawRad, 0, 'YXZ');
  }
}

export function uiUrl(file: string): string {
  return `${import.meta.env.BASE_URL}ui/${file}`;
}
