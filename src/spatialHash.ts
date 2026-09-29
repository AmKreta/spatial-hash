import { Bounds, SpatialItem } from "./types";
import { cantorPairing } from "./utils/contorPairing";
import { zigZagEncode } from "./utils/zigZagEncode";

export class SpatialHash<T extends Bounds> {
    private readonly cellSize: number;
    private readonly threshold: number;
    private readonly grid = new Map<number, Set<string>>();
    private readonly items = new Map<string, SpatialItem<T>>();

    constructor(cellSize: number, threshold: number) {
        if (cellSize <= 0) {
            throw new Error("cellSize must be greater than 0");
        }
        if (threshold < 0) {
            throw new Error("threshold cannot be negative");
        }
        this.cellSize = cellSize;
        this.threshold = threshold;
    }


    add(id: string, data: T): void {
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


    getItemsBetween(x: number, y: number, width: number, height: number): T[] {
        const padding = this.cellSize * this.threshold;

        const queryX = x - padding;
        const queryY = y - padding;

        const queryWidth = width + padding * 2;
        const queryHeight = height + padding * 2;

        const cells = this.getCells(queryX, queryY, queryWidth, queryHeight);


        const candidates = new Set<string>();

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

    get size(): number {
        return this.items.size;
    }

    clear(): void {
        this.grid.clear();
        this.items.clear();
    }

    private getCellX(x: number): number {
        return Math.floor(x / this.cellSize);
    }

    private getCellY(y: number): number {
        return Math.floor(y / this.cellSize);
    }

    private getCells(x: number, y: number, width: number, height: number): number[] {
        if (width <= 0 || height <= 0) {
            return [];
        }

        const minCellX = this.getCellX(x);
        const minCellY = this.getCellY(y);
        const maxCellX = this.getCellX(x + width - Number.EPSILON);
        const maxCellY = this.getCellY(y + height - Number.EPSILON);

        const cells: number[] = [];

        for (let cy = minCellY; cy <= maxCellY; cy++) {
            for (let cx = minCellX; cx <= maxCellX; cx++) {
                cells.push(this.hash(cx, cy));
            }
        }

        return cells;
    }

    private addToCell(cell: number, id: string): void {
        let bucket = this.grid.get(cell);
        if (!bucket) {
            bucket = new Set<string>();
            this.grid.set(cell, bucket);
        }
        bucket.add(id);
    }

    private removeFromCell(cell: number, id: string,): void {
        const bucket = this.grid.get(cell);
        if (!bucket) {
            return;
        }
        bucket.delete(id);
        if (bucket.size === 0) {
            this.grid.delete(cell);
        }
    }

    private haveSameCell(a: number[], b: number[]): boolean {
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

    private hash(x: number, y: number): number {
        return cantorPairing(zigZagEncode(x), zigZagEncode(y));
    }
}