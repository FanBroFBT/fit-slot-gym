import { Injectable, signal } from '@angular/core';

/** The same AI coach panel can be opened from the dashboard or the floating action button. */
@Injectable({ providedIn: 'root' })
export class CoachPanelService {
  readonly opened = signal(false);
  open() { this.opened.set(true); }
  close() { this.opened.set(false); }
  toggle() { this.opened.update(open => !open); }
}
