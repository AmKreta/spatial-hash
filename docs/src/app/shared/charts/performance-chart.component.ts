import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  inject,
  ViewChild,
} from '@angular/core';
import type { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-performance-chart',
  standalone: true,
  template: `
    <section class="performance-chart" [attr.aria-label]="title + ' comparison chart'">
      <h3>{{ title }}</h3>
      <div class="chart-canvas-wrap">
        <canvas
          #chartCanvas
          [attr.aria-label]="title + ' for brute force and SpatialHash'"
        ></canvas>
      </div>
    </section>
  `,
})
export class PerformanceChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) title = '';
  @Input({ required: true }) unit = '';
  @Input() bruteForce: number[] = [];
  @Input() spatialHash: number[] = [];
  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart<'line', number[], number>;
  private destroyed = false;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser || !this.chartCanvas) return;

    const { default: ChartJS } = await import('chart.js/auto');
    if (this.destroyed || !this.chartCanvas) return;

    this.chart = new ChartJS(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Brute force',
            data: [],
            borderColor: '#ffa779',
            backgroundColor: '#ffa779',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.22,
          },
          {
            label: 'SpatialHash',
            data: [],
            borderColor: '#c5f36a',
            backgroundColor: '#c5f36a',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.22,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: '#aab1a9', boxWidth: 8, boxHeight: 8, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${(context.parsed['y'] ?? 0).toLocaleString()} ${this.unit}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Recent frames', color: '#798178' },
            ticks: { display: false },
            grid: { display: false },
            border: { color: '#343a35' },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: this.unit, color: '#798178' },
            ticks: { color: '#899189', maxTicksLimit: 5 },
            grid: { color: '#2a302d' },
            border: { display: false },
          },
        },
      },
    });
    this.updateChart();
  }

  ngOnChanges(): void {
    this.updateChart();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.chart?.destroy();
  }

  private updateChart(): void {
    if (!this.chart) return;
    const length = Math.max(this.bruteForce.length, this.spatialHash.length);
    this.chart.data.labels = Array.from({ length }, (_, index) => index + 1);
    this.chart.data.datasets[0].data = [...this.bruteForce];
    this.chart.data.datasets[1].data = [...this.spatialHash];
    this.chart.options.scales!['y']!.title!.text = this.unit;
    this.chart.update('none');
  }
}
