# SpatialHash

A uniform grid for axis-aligned items. Each item is stored in every cell its bounds overlap. A rectangle query collects the ids in those cells, then keeps only the items whose bounds actually intersect the rectangle.

Use it when you need nearby objects in a 2D scene — sprites, colliders, map markers — without testing every item.

## Use cases

- **Games** — broad-phase collision, pickup and enemy queries, and “what is around this actor?” checks. Update a moving sprite each frame, then query a box around the player instead of walking the whole entity list.
- **Infinite canvas** — whiteboards, node editors, and design tools where objects sit at any x/y, including negative space. Query the current viewport so only on-screen frames, sticky notes, or wires are drawn or hit-tested.
- **Maps and tile worlds** — markers, spawn regions, and trigger zones on a large map. A camera or search rectangle returns the local set without loading every pin.
- **UI hit-testing** — overlapping cards, windows, or annotations. A pointer-sized query returns the few bounds under the cursor.
- **Simulations** — particles, agents, or crowd members that only interact with neighbors. Each tick, update positions and query a neighborhood box.

The default hash keeps negative cell coordinates unique, so the grid does not need a fixed origin or world size.

Works in Node and in the browser: ESM for bundlers and modern Node, CommonJS for `require`, and an IIFE build for a script tag.

## Install

```sh
npm install @amk-utils/spatialhash
```

## Use

```ts
import { SpatialHash } from '@amk-utils/spatialhash';

type Sprite = {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
};

const world = new SpatialHash<Sprite>({ cellSize: 100 });

world.add('player', { x: 10, y: 20, width: 32, height: 32, name: 'player' });
world.add(2, { x: 80, y: 40, width: 16, height: 16, name: 'coin' });

const nearby = world.getItemsBetween(0, 0, 100, 100);
const { items, comparisons } = world.getItemsBetweenWithStats(0, 0, 100, 100);

world.update('player', { x: 50, y: 20, width: 32, height: 32, name: 'player' });
world.remove(2);

world.clear();
```

An item needs `x`, `y`, `width`, and `height`. Extra fields are kept and returned with the item. `width` and `height` must be greater than `0`; otherwise the item is stored but occupies no cells, so queries will not find it.

Ids are `number` or `string`. `1` and `"1"` are different ids.

Node CommonJS:

```js
const { SpatialHash } = require('@amk-utils/spatialhash');
```

Browser script tag (IIFE). Named exports are on the `SpatialHash` global:

```html
<script src="https://unpkg.com/@amk-utils/spatialhash"></script>
<script>
  const world = new SpatialHash.SpatialHash();
</script>
```

## Query

`getItemsBetween(x, y, width, height)` returns the stored items that overlap that rectangle. Result order is not defined. Rectangles that only share an edge do not count as overlapping.

Before the cell lookup, the query is expanded by `cellSize * threshold` on every side. The overlap test still uses the rectangle you passed.

## API

| Method                                          | Behavior                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `add(id, data)`                                 | Inserts an item. Throws if `id` is already stored.                                                                  |
| `remove(id)`                                    | Removes an item. Returns `true` when it was stored, `false` otherwise.                                              |
| `update(id, data)`                              | Replaces bounds and payload, and moves the item between cells when its coverage changes. Throws if `id` is missing. |
| `getItemsBetween(x, y, width, height)`          | Returns items that overlap the rectangle.                                                                           |
| `getItemsBetweenWithStats(x, y, width, height)` | Returns matching items and the number of candidate bounds checked.                                                  |
| `size`                                          | Number of stored items.                                                                                             |
| `clear()`                                       | Removes every item.                                                                                                 |

## Options

```ts
new SpatialHash<Sprite>({
  cellSize: 100,
  threshold: 1,
  hashFunction: (column, row) => `${column},${row}`,
});
```

- `cellSize` — world-space size of one cell. Default `100`. Must be greater than `0`. A size close to a typical item keeps each query to a few cells.
- `threshold` — extra cells added on each side of a query before buckets are collected. Default `1`. Must be `0` or greater.
- `hashFunction` — maps a cell column and row to a `number` or `string` bucket key. The default zigzag-encodes the coordinates, then combines them with Cantor pairing so negative cells stay unique.

## Scripts

```sh
npm test
npm run build
```

## Publish

Publishing is handled by `.github/workflows/publish.yml` on every push to `main`. The job typechecks, tests, builds ESM / CJS / IIFE plus declaration files, then publishes with provenance. The npm package page can also use GitHub as a [trusted publisher](https://docs.npmjs.com/trusted-publishers) so the OIDC token is enough.
