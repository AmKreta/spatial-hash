import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './docs.component.html',
})
export class DocsComponent {}
