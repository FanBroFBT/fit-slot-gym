import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; type: 'success' | 'error' | 'info'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 1;
  show(text: string, type: Toast['type'] = 'info') {
    const id = this.next++;
    this.toasts.update(t => [...t, { id, text, type }]);
    setTimeout(() => this.toasts.update(t => t.filter(x => x.id !== id)), 4000);
  }
}
