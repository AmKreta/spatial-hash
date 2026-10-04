import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppShellComponent } from './app/core/layout/app-shell.component';
import { config } from './app/core/app.config.server';

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppShellComponent, config, context);

export default bootstrap;
