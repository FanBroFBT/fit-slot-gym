import { Component, input, output } from '@angular/core';

/** 1-5 stars. Read-only by default; with [editable]="true" the user can click a star. */
@Component({
  selector: 'app-stars',
  template: `
    <span class="stars" [class.edit]="editable()">
      @for (n of [1, 2, 3, 4, 5]; track n) {
        <span class="star" [class.on]="n <= Math.round(value() ?? 0)"
              (click)="editable() && picked.emit(n)" [attr.aria-label]="n + ' star'">★</span>
      }
    </span>`,
  styles: `.stars{display:inline-flex;gap:2px;font-size:1.05rem;line-height:1}
    .star{color:rgba(147,160,184,.35)} .star.on{color:#FBBF24}
    .edit .star{font-size:2rem;cursor:pointer;transition:transform .1s} .edit .star:hover{transform:scale(1.2)}`
})
export class StarsComponent {
  protected Math = Math;
  value = input<number | null | undefined>(0);
  editable = input(false);
  picked = output<number>();
}
