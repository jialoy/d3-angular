import { Component, signal } from '@angular/core';
import { CircularPackComponent } from './circular-pack/circular-pack.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [CircularPackComponent],
})
export class App {
  protected readonly title = signal('angular-d3');
}
