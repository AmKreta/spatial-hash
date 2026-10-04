export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ItemId = number | string;

export type Hash = number | string;

export type HashFunction = (x: number, y: number) => number | string;

// stored item
export type SpatialItem<T extends Bounds> = {
  /** Unique id for the item. */
  id: ItemId;
  /** hashes of the cells the item occupies. */
  cells: Hash[];
  /** Payload stored with the item. */
  data: T;
};

export type SpatialHashOptions = {
  cellSize?: number;
  threshold?: number;
  hashFunction?: HashFunction;
};
