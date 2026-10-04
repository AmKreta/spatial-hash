import { Routes } from '@angular/router';
import { DemoComponent } from './demo.component';
import { DocsComponent } from './docs.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'docs' },
  { path: 'docs', component: DocsComponent, title: 'SpatialHash — Docs' },
  { path: 'demo', component: DemoComponent, title: 'SpatialHash — Demo' },
  { path: '**', redirectTo: 'docs' },
];
