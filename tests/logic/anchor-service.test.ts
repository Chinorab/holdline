import { describe, expect, it } from 'vitest';
import { AnchorService, type AnchorLike, type FrameLike, type SessionLike } from '../../src/xr/anchor-service';

const pose = { position: { x: 0, y: 0.75, z: -0.5 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
const space = {};

function fakes() {
  const deleted: string[] = [];
  const store = new Map<string, AnchorLike>();
  let next = 1;
  const anchor = (): AnchorLike => {
    const a: AnchorLike = {
      anchorSpace: {},
      requestPersistentHandle: async () => {
        const handle = `h${next++}`;
        store.set(handle, a);
        return handle;
      },
    };
    return a;
  };
  const frame: FrameLike = {
    createAnchor: async () => anchor(),
    getPose: () => ({ transform: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0.75, -0.5, 1] } }),
  };
  const session: SessionLike = {
    restorePersistentAnchor: async (h) => {
      const a = store.get(h);
      if (!a) throw new Error('unknown handle');
      return a;
    },
    deletePersistentAnchor: async (h) => {
      deleted.push(h);
      store.delete(h);
    },
  };
  return { frame, session, deleted, store };
}

describe('anchor service', () => {
  it('anchors, saves one persistent handle and deletes the previous one', async () => {
    const saved: (string | null)[] = [];
    const { frame, session, deleted, store } = fakes();
    const service = new AnchorService((p) => p, (h) => saved.push(h));
    expect(await service.place(frame, session, space, pose, null)).toBe(true);
    expect(saved).toEqual(['h1']);
    expect(await service.place(frame, session, space, pose, 'h1')).toBe(true);
    expect(deleted).toEqual(['h1']);
    expect(saved).toEqual(['h1', 'h2']);
    expect(store.size).toBe(1);
    expect(service.poseMatrix(frame, space)?.[13]).toBe(0.75);
  });

  it('restores a saved anchor and reports unknown handles', async () => {
    const { frame, session } = fakes();
    const service = new AnchorService((p) => p, () => undefined);
    await service.place(frame, session, space, pose, null);
    const handle = service.handle as string;
    const other = new AnchorService((p) => p, () => undefined);
    expect(await other.restore(session, handle)).not.toBeNull();
    expect(await other.restore(session, 'missing')).toBeNull();
  });

  it('degrades without the API: no anchors, no persistence, no throw', async () => {
    const saved: (string | null)[] = [];
    const service = new AnchorService((p) => p, (h) => saved.push(h));
    const bare: FrameLike = { getPose: () => null };
    expect(AnchorService.supported(bare)).toBe(false);
    expect(await service.place(bare, {}, space, pose, null)).toBe(false);
    expect(await service.restore({}, 'h1')).toBeNull();
    const noPersist: FrameLike = { createAnchor: async () => ({ anchorSpace: {} }), getPose: () => null };
    expect(await service.place(noPersist, {}, space, pose, null)).toBe(true);
    expect(saved).toEqual([null]);
    expect(service.poseMatrix(noPersist, space)).toBeNull();
  });
});
