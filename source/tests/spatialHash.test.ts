import { describe, expect, it, vi } from 'vitest';
import { SpatialHash } from '../src/spatialHash';
import type { Bounds } from '../src/types';

function box(x: number, y: number, width = 10, height = 10): Bounds {
  return { x, y, width, height };
}

describe('SpatialHash constructor', () => {
  it('uses default options when none are passed', () => {
    const world = new SpatialHash();
    world.add('a', box(0, 0));
    expect(world.size).toBe(1);
    expect(world.getItemsBetween(0, 0, 10, 10)).toEqual([box(0, 0)]);
  });

  it('throws when cellSize is not greater than 0', () => {
    expect(() => new SpatialHash({ cellSize: 0 })).toThrow('cellSize must be greater than 0');
    expect(() => new SpatialHash({ cellSize: -4 })).toThrow('cellSize must be greater than 0');
  });

  it('throws when threshold is negative', () => {
    expect(() => new SpatialHash({ threshold: -1 })).toThrow('threshold cannot be negative');
  });

  it('accepts a zero threshold', () => {
    const world = new SpatialHash({ threshold: 0 });
    world.add('a', box(0, 0));
    expect(world.getItemsBetween(0, 0, 10, 10)).toHaveLength(1);
  });
});

describe('SpatialHash items', () => {
  it('adds, counts, and clears items', () => {
    const world = new SpatialHash();
    world.add('a', box(0, 0));
    world.add('b', box(200, 200));
    expect(world.size).toBe(2);

    world.clear();
    expect(world.size).toBe(0);
    expect(world.getItemsBetween(0, 0, 300, 300)).toEqual([]);
  });

  it('throws when adding a duplicate id', () => {
    const world = new SpatialHash();
    world.add('a', box(0, 0));
    expect(() => world.add('a', box(20, 20))).toThrow('SpatialHash: item "a" already exists');
  });

  it('treats numeric and string ids as different keys', () => {
    const world = new SpatialHash();
    world.add(1, box(0, 0));
    world.add('1', box(50, 50));

    expect(world.size).toBe(2);
    expect(world.remove(1)).toBe(true);
    expect(world.size).toBe(1);
    expect(world.getItemsBetween(50, 50, 10, 10)).toEqual([box(50, 50)]);
  });

  it('removes a stored item and reports a miss', () => {
    const world = new SpatialHash();
    world.add('a', box(0, 0));

    expect(world.remove('a')).toBe(true);
    expect(world.remove('a')).toBe(false);
    expect(world.getItemsBetween(0, 0, 10, 10)).toEqual([]);
  });

  it('updates bounds and payload', () => {
    const world = new SpatialHash<Bounds & { name: string }>({ cellSize: 100 });
    world.add('player', { ...box(10, 10), name: 'idle' });

    world.update('player', { ...box(250, 10), name: 'moved' });

    expect(world.getItemsBetween(0, 0, 50, 50)).toEqual([]);
    expect(world.getItemsBetween(240, 0, 30, 30)).toEqual([{ ...box(250, 10), name: 'moved' }]);
  });

  it('keeps a payload change when the item stays in the same cells', () => {
    const world = new SpatialHash<Bounds & { name: string }>({ cellSize: 100 });
    world.add('player', { ...box(10, 10), name: 'idle' });

    world.update('player', { ...box(12, 12), name: 'renamed' });

    expect(world.getItemsBetween(0, 0, 30, 30)).toEqual([{ ...box(12, 12), name: 'renamed' }]);
  });

  it('throws when updating a missing id', () => {
    const world = new SpatialHash();
    expect(() => world.update('missing', box(0, 0))).toThrow(
      'SpatialHash: item "missing" does not exist',
    );
  });
});

describe('SpatialHash queries', () => {
  it('returns overlapping items and skips items that only share an edge', () => {
    const world = new SpatialHash({ cellSize: 100, threshold: 0 });
    world.add('inside', box(0, 0, 10, 10));
    world.add('edge', box(10, 0, 10, 10));
    world.add('far', box(80, 80, 10, 10));

    const hits = world.getItemsBetween(0, 0, 10, 10);
    expect(hits).toEqual([box(0, 0, 10, 10)]);
  });

  it('finds items in negative space', () => {
    const world = new SpatialHash({ cellSize: 50 });
    world.add('note', box(-80, -40, 20, 20));

    expect(world.getItemsBetween(-90, -50, 40, 40)).toEqual([box(-80, -40, 20, 20)]);
    expect(world.getItemsBetween(0, 0, 10, 10)).toEqual([]);
  });

  it('does not return an item stored with non-positive bounds', () => {
    const world = new SpatialHash();
    world.add('empty', box(0, 0, 0, 10));

    expect(world.size).toBe(1);
    expect(world.getItemsBetween(-10, -10, 20, 20)).toEqual([]);
  });

  it('uses a custom hash function for cell keys', () => {
    const hashFunction = vi.fn((x: number, y: number) => `${x}:${y}`);
    const world = new SpatialHash({ cellSize: 100, hashFunction });

    world.add('a', box(10, 20));

    expect(hashFunction).toHaveBeenCalled();
    expect(world.getItemsBetween(0, 0, 20, 30)).toEqual([box(10, 20)]);
  });
});
