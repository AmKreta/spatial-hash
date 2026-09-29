export type Bounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

// stored item
export type SpatialItem<T extends Bounds> = {
    id: string;
    cells: number[];
    data: T
};