import { isPlatformBrowser } from '@angular/common';
import { PerformanceChartComponent } from '../../shared/charts/performance-chart.component';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  signal,
} from '@angular/core';

type Stats = { comparisons: number; inside: number; durationMs: number };
type SimMessage = {
  type: 'stats';
  comparisons: number;
  inside: number;
  durationMs: number;
  particleCount: number;
};
type SampleAccumulator = {
  frames: number;
  comparisons: number;
  inside: number;
  durationMs: number;
};

const PERFORMANCE_SAMPLE_FRAME_COUNT = 10;
const MAX_PERFORMANCE_SAMPLES = 60;

@Component({
  selector: 'app-demo-page',
  standalone: true,
  imports: [PerformanceChartComponent],
  templateUrl: './demo.component.html',
})
export class DemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('naiveCanvas') naiveCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hashCanvas') hashCanvas?: ElementRef<HTMLCanvasElement>;

  readonly particleCount = signal(100);
  readonly paused = signal(false);
  readonly naiveStats = signal<Stats>({ comparisons: 0, inside: 0, durationMs: 0 });
  readonly hashStats = signal<Stats>({ comparisons: 0, inside: 0, durationMs: 0 });
  readonly naiveHistory = signal<number[]>([]);
  readonly hashHistory = signal<number[]>([]);
  readonly naiveComparisonsHistory = signal<number[]>([]);
  readonly hashComparisonsHistory = signal<number[]>([]);

  private workers: Worker[] = [];
  private readonly naiveAccumulator: SampleAccumulator = {
    frames: 0,
    comparisons: 0,
    inside: 0,
    durationMs: 0,
  };
  private readonly hashAccumulator: SampleAccumulator = {
    frames: 0,
    comparisons: 0,
    inside: 0,
    durationMs: 0,
  };
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.startWorker(
      this.naiveCanvas?.nativeElement,
      () =>
        new Worker(new URL('./workers/brute-force.worker', import.meta.url), { type: 'module' }),
      (stats) =>
        this.recordStats(
          stats,
          this.naiveStats,
          this.naiveHistory,
          this.naiveComparisonsHistory,
          this.naiveAccumulator,
        ),
    );
    this.startWorker(
      this.hashCanvas?.nativeElement,
      () =>
        new Worker(new URL('./workers/spatial-hash.worker', import.meta.url), { type: 'module' }),
      (stats) =>
        this.recordStats(
          stats,
          this.hashStats,
          this.hashHistory,
          this.hashComparisonsHistory,
          this.hashAccumulator,
        ),
    );
  }

  ngOnDestroy(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
  }

  setCount(event: Event): void {
    const count = Number((event.target as HTMLInputElement).value);
    this.particleCount.set(count);
    this.resetSamples();
    this.workers.forEach((worker) => worker.postMessage({ type: 'count', count }));
  }

  toggleRun(): void {
    const running = this.paused();
    this.paused.set(!running);
    this.workers.forEach((worker) => worker.postMessage({ type: 'run', running }));
  }

  private startWorker(
    element: HTMLCanvasElement | undefined,
    createWorker: () => Worker,
    update: (stats: Stats) => void,
  ): void {
    if (!element || !('transferControlToOffscreen' in element)) return;

    const ratio = devicePixelRatio || 1;
    element.width = Math.max(1, Math.floor(element.clientWidth * ratio));
    element.height = Math.max(1, Math.floor(element.clientHeight * ratio));

    const worker = createWorker();
    worker.onmessage = (event: MessageEvent<SimMessage>) => {
      if (event.data.type === 'stats' && event.data.particleCount === this.particleCount()) {
        update(event.data);
      }
    };

    const canvas = element.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas, seed: 1492, count: this.particleCount() }, [canvas]);
    this.workers.push(worker);
  }

  private recordStats(
    stats: Stats,
    current: typeof this.naiveStats,
    history: typeof this.naiveHistory,
    comparisonsHistory: typeof this.naiveComparisonsHistory,
    accumulator: SampleAccumulator,
  ): void {
    accumulator.frames++;
    accumulator.comparisons += stats.comparisons;
    accumulator.inside += stats.inside;
    accumulator.durationMs += stats.durationMs;
    if (accumulator.frames < PERFORMANCE_SAMPLE_FRAME_COUNT) return;

    const sampledFrames = accumulator.frames;
    const averageComparisons = accumulator.comparisons / sampledFrames;
    const averageInside = accumulator.inside / sampledFrames;
    const averageDuration = accumulator.durationMs / sampledFrames;
    current.set({
      comparisons: averageComparisons,
      inside: Math.round(averageInside),
      durationMs: averageDuration,
    });
    history.update((samples) => [
      ...samples.slice(-(MAX_PERFORMANCE_SAMPLES - 1)),
      averageDuration,
    ]);
    comparisonsHistory.update((samples) => [
      ...samples.slice(-(MAX_PERFORMANCE_SAMPLES - 1)),
      averageComparisons,
    ]);
    accumulator.frames = 0;
    accumulator.comparisons = 0;
    accumulator.inside = 0;
    accumulator.durationMs = 0;
  }

  private resetSamples(): void {
    this.naiveStats.set({ comparisons: 0, inside: 0, durationMs: 0 });
    this.hashStats.set({ comparisons: 0, inside: 0, durationMs: 0 });
    this.naiveHistory.set([]);
    this.hashHistory.set([]);
    this.naiveComparisonsHistory.set([]);
    this.hashComparisonsHistory.set([]);
    for (const accumulator of [this.naiveAccumulator, this.hashAccumulator]) {
      accumulator.frames = 0;
      accumulator.comparisons = 0;
      accumulator.inside = 0;
      accumulator.durationMs = 0;
    }
  }
}
