import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';

type Stats = { checks: number; hits: number; total: number };
type SimMessage = { type: 'stats'; checks: number; hits: number; total: number };

@Component({
  selector: 'app-demo-page',
  standalone: true,
  templateUrl: './demo.component.html',
})
export class DemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('naiveCanvas') naiveCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hashCanvas') hashCanvas?: ElementRef<HTMLCanvasElement>;

  readonly particleCount = signal(100);
  readonly paused = signal(false);
  readonly naiveStats = signal<Stats>({ checks: 0, hits: 0, total: 100 });
  readonly hashStats = signal<Stats>({ checks: 0, hits: 0, total: 100 });

  private workers: Worker[] = [];

  ngAfterViewInit(): void {
    this.startWorker(
      this.naiveCanvas?.nativeElement,
      () => new Worker(new URL('./brute-force.worker', import.meta.url), { type: 'module' }),
      this.naiveStats.set,
    );
    this.startWorker(
      this.hashCanvas?.nativeElement,
      () => new Worker(new URL('./spatial-hash.worker', import.meta.url), { type: 'module' }),
      this.hashStats.set,
    );
  }

  ngOnDestroy(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
  }

  setCount(event: Event): void {
    const count = Number((event.target as HTMLInputElement).value);
    this.particleCount.set(count);
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
      if (event.data.type === 'stats') update(event.data);
    };

    const canvas = element.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas, seed: 1492, count: this.particleCount() }, [canvas]);
    this.workers.push(worker);
  }
}
