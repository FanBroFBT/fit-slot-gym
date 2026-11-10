import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `<div class="card" style="text-align:center;padding:48px">
    <h1 class="accent">404</h1><p>This page does not exist.</p>
    <a class="btn btn-primary" routerLink="/">Go home</a></div>`
})
export class NotFoundComponent {}
