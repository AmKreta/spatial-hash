import { bootstrapApplication } from '@angular/platform-browser';
import { AppShellComponent } from './app/core/layout/app-shell.component';
import { appConfig } from './app/core/app.config';

bootstrapApplication(AppShellComponent, appConfig).catch((error: unknown) => console.error(error));
