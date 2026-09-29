import { Bounds, Hash, ItemId, SpatialHashOptions, SpatialItem } from "./types";
import { cantorPairing } from "./utils/contorPairing";
import { zigZagEncode } from "./utils/zigZagEncode";

/**
 * Uniform grid of axis-aligned items.
 *
 * An item is stored in every cell its bounds overlap. A query gathers candidate
 * ids from the covered cells, then keeps items whose bounds intersect the query.
 */
export class SpatialHash<T extends Bounds> {
    /** World-space size of one grid cell. */
    private readonly cellSize: number;
    /** Query margin, measured in cells, applied on each side of a lookup. */
    private readonly threshold: number;
    /** Cell hash to the ids currently stored in that cell. */
    private readonly grid = new Map<Hash, Set<ItemId>>();
    /** Item id to its payload and the cell hashes it occupies. */
    private readonly items = new Map<ItemId, SpatialItem<T>>();

    /**
     * Creates an empty spatial hash.
     * @param options - Cell size and query margin. Omitted values use the defaults.
     * @throws If `cellSize` is not greater than `0`, or if `threshold` is negative.
     */
    constructor({cellSize = 100, threshold = 1}: SpatialHashOptions) {
        if (cellSize <= 0) {
            throw new Error("cellSize must be greater than 0");
        }
        if (threshold < 0) {
            throw new Error("threshold cannot be negative");
        }
        this.cellSize = cellSize;
        this.threshold = threshold;
    }


    /**
     * Inserts an item and indexes it in every cell its bounds overlap.
     * @param id - Unique id for the item.
     * @param data - Axis-aligned bounds and any payload stored with them.
     * @throws If `id` is already present.
     */
    add(id: ItemId, data: T): void {
        if (this.items.has(id)) {
            throw new Error(`SpatialHash: item "${id}" already exists`);
        }
        const cells = this.getCells(data.x, data.y, data.width, data.height);
        const item: SpatialItem<T> = { id, data, cells };
        this.items.set(id, item);
        for (const cell of cells) {
            this.addToCell(cell, id);
        }
    }

    /**
     * Removes an item and drops it from every cell it occupies.
     * @param id - Id of the item to remove.
     * @returns `true` when the item was removed, `false` when it was not stored.
     */
    remove(id: string): boolean {
        const item = this.items.get(id);
        if (!item) {
            return false;
        }
        for (const cell of item.cells) {
            this.removeFromCell(cell, id);
        }
        this.items.delete(id);
        return true;
    }

    /**
     * Replaces an item's bounds and moves it between cells when its coverage changes.
     * @param id - Id of the stored item.
     * @param data - New bounds and payload.
     * @throws If `id` is not stored.
     */
    update(id: string, data: T): void {
        const item = this.items.get(id);
        if (!item) {
            throw new Error(`SpatialHash: item "${id}" does not exist`);
        }
        const oldCells = item.cells;
        const newCells = this.getCells(data.x, data.y, data.width, data.height);

        // Bounds are re-checked precisely on query, so data must be stored even
        // when the cell membership is unchanged.
        item.data = data;

        if (
            oldCells.length === newCells.length &&
            this.haveSameCell(oldCells, newCells)
        ) {
            return;
        }

        const newCellSet = new Set(newCells);
        for (const oldCell of oldCells) {
            if (!newCellSet.has(oldCell)) {
                this.removeFromCell(oldCell, id);
            }
        }

        const oldCellSet = new Set(oldCells);
        for (const newCell of newCells) {
            if (!oldCellSet.has(newCell)) {
                this.addToCell(newCell, id);
            }
        }

        item.cells = newCells;
    }


    /**
     * Returns items whose bounds intersect the given rectangle.
     *
     * Cell lookup is expanded by `cellSize * threshold` on every side. Candidates
     * are then filtered with a precise bounds test against the original rectangle.
     * @param x - Left edge of the query rectangle.
     * @param y - Top edge of the query rectangle.
     * @param width - Width of the query rectangle.
     * @param height - Height of the query rectangle.
     * @returns Payloads of the intersecting items. Order is not defined.
     */
    getItemsBetween(x: number, y: number, width: number, height: number): T[] {
        const padding = this.cellSize * this.threshold;

        const queryX = x - padding;
        const queryY = y - padding;

        const queryWidth = width + padding * 2;
        const queryHeight = height + padding * 2;

        const cells = this.getCells(queryX, queryY, queryWidth, queryHeight);


        const candidates = new Set<ItemId>();

        for (const cell of cells) {
            const bucket = this.grid.get(cell);
            if (!bucket) {
                continue;
            }
            bucket.forEach(id => candidates.add(id));
        }

        const result: SpatialItem<T>[] = [];

        candidates.forEach(id => {
            const item = this.items.get(id);
            if (!item) {
                return;
            }
            if (
                item.data.x < x + width &&
                item.data.x + item.data.width > x &&
                item.data.y < y + height &&
                item.data.y + item.data.height > y
            ) {
                result.push(item);
            }
        });

        return result.map(item => item.data);
    }

    /** Number of items currently stored. */
    get size(): number {
        return this.items.size;
    }

    /** Removes every item and clears the grid. */
    clear(): void {
        this.grid.clear();
        this.items.clear();
    }

    /**
     * Converts a world-space x coordinate into a cell column.
     * @param x - World-space x coordinate.
     * @returns Column index, rounded toward negative infinity.
     */
    private getCellX(x: number): number {
        return Math.floor(x / this.cellSize);
    }

    /**
     * Converts a world-space y coordinate into a cell row.
     * @param y - World-space y coordinate.
     * @returns Row index, rounded toward negative infinity.
     */
    private getCellY(y: number): number {
        return Math.floor(y / this.cellSize);
    }

    /**
     * Lists the cell hashes covered by an axis-aligned rectangle.
     * The far edges are inset by one epsilon so a rectangle that ends on a
     * cell boundary is not also indexed in the next cell.
     * @param x - Left edge.
     * @param y - Top edge.
     * @param width - Rectangle width.
     * @param height - Rectangle height.
     * @returns Cell hashes, or an empty list when width or height is not positive.
     */
    private getCells(x: number, y: number, width: number, height: number): Hash[] {
        if (width <= 0 || height <= 0) {
            return [];
        }

        const minCellX = this.getCellX(x);
        const minCellY = this.getCellY(y);
        const maxCellX = this.getCellX(x + width - Number.EPSILON);
        const maxCellY = this.getCellY(y + height - Number.EPSILON);

        const cells: Hash[] = [];

        for (let cy = minCellY; cy <= maxCellY; cy++) {
            for (let cx = minCellX; cx <= maxCellX; cx++) {
                cells.push(this.hash(cx, cy));
            }
        }

        return cells;
    }

    /**
     * Adds an id to a cell bucket, creating the bucket when needed.
     * @param cell - Cell hash.
     * @param id - Item id to store in that cell.
     */
    private addToCell(cell: Hash, id: ItemId): void {
        let bucket = this.grid.get(cell);
        if (!bucket) {
            bucket = new Set<ItemId>();
            this.grid.set(cell, bucket);
        }
        bucket.add(id);
    }

    /**
     * Removes an id from a cell bucket and deletes the bucket when it becomes empty.
     * @param cell - Cell hash.
     * @param id - Item id to remove from that cell.
     */
    private removeFromCell(cell: Hash, id: string,): void {
        const bucket = this.grid.get(cell);
        if (!bucket) {
            return;
        }
        bucket.delete(id);
        if (bucket.size === 0) {
            this.grid.delete(cell);
        }
    }

    /**
     * Reports whether two cell lists contain the same hashes in the same order.
     * @param a - First cell-hash list.
     * @param b - Second cell-hash list.
     * @returns `true` when both lists match element for element.
     */
    private haveSameCell(a: Hash[], b: Hash[]): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Hashes a cell coordinate into a single bucket key.
     * Negative coordinates are zigzag-encoded so Cantor pairing stays in the non-negative domain.
     * @param x - Cell column.
     * @param y - Cell row.
     * @returns Bucket key for that cell.
     */
    private hash(x: number, y: number): Hash {
        return cantorPairing(zigZagEncode(x), zigZagEncode(y));
    }
}