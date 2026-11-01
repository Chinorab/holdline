// The board's anchor, on the raw WebXR Anchors API: IWSDK's XRAnchor component cannot keep
// a persistent handle. Quest Browser keeps at most 8 persistent anchors per site, none in
// private mode, and erases them with the site's history, so the service keeps one handle
// and deletes the previous one. Every call is feature detected.

/** Structural types, so the service runs against the real API and against test fakes. */
export interface SpaceLike {
  readonly __space?: never;
}

export interface AnchorLike {
  anchorSpace: SpaceLike;
  requestPersistentHandle?: () => Promise<string>;
  delete?: () => void;
}

export interface PoseLike {
  transform: { matrix: Float32Array | number[] };
}

export interface FrameLike {
  createAnchor?: (pose: unknown, space: SpaceLike) => Promise<AnchorLike> | undefined;
  getPose(space: SpaceLike, base: SpaceLike): PoseLike | null | undefined;
}

export interface SessionLike {
  restorePersistentAnchor?: (handle: string) => Promise<AnchorLike>;
  deletePersistentAnchor?: (handle: string) => Promise<void>;
}

export interface Pose {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
}

export type MakeTransform = (pose: Pose) => unknown;

export class AnchorService {
  anchor: AnchorLike | null = null;
  handle: string | null = null;

  constructor(
    private readonly makeTransform: MakeTransform,
    private readonly saveHandle: (handle: string | null) => void,
  ) {}

  static supported(frame: FrameLike): boolean {
    return typeof frame.createAnchor === 'function';
  }

  /** Anchor the board at a pose; keep a persistent handle when the browser offers one. */
  async place(frame: FrameLike, session: SessionLike, space: SpaceLike, pose: Pose, previousHandle: string | null): Promise<boolean> {
    if (!frame.createAnchor) return false;
    let anchor: AnchorLike | undefined;
    try {
      anchor = await frame.createAnchor(this.makeTransform(pose), space);
    } catch {
      return false;
    }
    if (!anchor) return false;
    this.anchor?.delete?.();
    this.anchor = anchor;
    if (previousHandle && session.deletePersistentAnchor) {
      await session.deletePersistentAnchor(previousHandle).catch(() => undefined);
    }
    this.handle = null;
    if (anchor.requestPersistentHandle) {
      try {
        this.handle = await anchor.requestPersistentHandle();
      } catch {
        this.handle = null;
      }
    }
    this.saveHandle(this.handle);
    return true;
  }

  /** Bring back the anchor saved on an earlier visit. */
  async restore(session: SessionLike, handle: string): Promise<AnchorLike | null> {
    if (!session.restorePersistentAnchor) return null;
    try {
      const anchor = await session.restorePersistentAnchor(handle);
      this.anchor = anchor;
      this.handle = handle;
      return anchor;
    } catch {
      return null;
    }
  }

  /** Forget the saved anchor (placing again elsewhere, or a handle that no longer resolves). */
  async forget(session: SessionLike, handle: string | null): Promise<void> {
    this.anchor?.delete?.();
    this.anchor = null;
    this.handle = null;
    if (handle && session.deletePersistentAnchor) await session.deletePersistentAnchor(handle).catch(() => undefined);
    this.saveHandle(null);
  }

  /** Column major 4 by 4 pose matrix of the anchor in the given space, or null when untracked. */
  poseMatrix(frame: FrameLike, space: SpaceLike): Float32Array | number[] | null {
    if (!this.anchor) return null;
    try {
      return frame.getPose(this.anchor.anchorSpace, space)?.transform.matrix ?? null;
    } catch {
      return null;
    }
  }
}
