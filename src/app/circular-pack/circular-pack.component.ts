/**
 * Handles Angular lifecycle, DOM management, overall resize functionality
 */

import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { loadData, transformData } from '../utils/process-data';
import { NodeData } from '../shared/types';
import { CircularPackChart, ChartConfig } from './chart';
import {
  setupToggleInteractions,
  setupCountryClickInteractions,
  setupDrawerInteractions,
} from './interactions';

@Component({
  selector: 'app-circular-pack',
  templateUrl: './circular-pack.component.html',
  styleUrls: ['./circular-pack.component.scss'],
})
export class CircularPackComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('container', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  private chart!: CircularPackChart;
  private resizeObserver!: ResizeObserver;
  private debounceTimer: number | undefined;
  private hierarchyData!: NodeData;
  private currentValueKey: 'population' | 'landAreaKM2' = 'landAreaKM2';

  ngAfterViewInit(): void {
    this.initialiseChart();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private async initialiseChart(): Promise<void> {
    try {
      // Load and transform data
      const data = await loadData();
      this.hierarchyData = transformData(data);

      // Initialise chart
      this.chart = new CircularPackChart(this.svgRef.nativeElement);

      // Render initial chart
      this.renderChart();

      // Set up the user interactions: toggle, side drawer, click events on country nodes
      this.setupInteractions();

      // Setup resize observer
      this.setupResizeObserver();
    } catch (error) {
      console.error('Failed to initialise chart:', error);
    }
  }

  /**
   * Sets up the toggle, side drawer, and country node click events.
   */
  private setupInteractions(): void {
    setupToggleInteractions(this.svgRef.nativeElement, (newValueKey) => {
      this.onValueKeyChange(newValueKey);
    });

    setupCountryClickInteractions(this.svgRef.nativeElement, (countryData) => {
      this.onCountryClick(countryData);
    });

    setupDrawerInteractions(() => {
      this.onDrawerClose();
    });
  }

  /**
   * Sets the chart configurations (width, height and selected value key) then renders the chart
   * accordingly (calls public render method from CircularPackChart).
   */
  private renderChart(): void {
    if (!this.chart || !this.hierarchyData) return;

    const config: ChartConfig = {
      width: this.getSvgDimensions().width,
      height: this.getSvgDimensions().height,
      valueKey: this.currentValueKey,
    };

    this.chart.render(this.hierarchyData, config);

    setTimeout(() => {
      this.setupInteractions();
    }, 100); // Tiny delay to ensure DOM is ready
  }

  /**)
   * Returns the dimensions (width, height) of an SVG.
   */
  private getSvgDimensions(): { width: number; height: number } {
    const rect = this.svgRef.nativeElement.getBoundingClientRect();
    const fallback = 600; // Fallback width and height
    return {
      width: rect.width || fallback,
      height: rect.height || fallback,
    };
  }

  /**
   * Sets up the resize observer to handle window resizing.
   */
  private setupResizeObserver(): void {
    if (!('ResizeObserver' in window)) {
      console.warn('ResizeObserver not supported');
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      this.debounceResize();
    });

    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  /**
   * Debounces the resize event to prevent excessive calls.
   */
  private debounceResize(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set a 100ms debounce
    this.debounceTimer = setTimeout(() => {
      this.handleResize();
    }, 100);
  }

  /**
   * Handles resizing of the chart (calls public resize method from CircularPackChart).
   */
  private handleResize(): void {
    if (!this.chart) return;

    const dimensions = this.getSvgDimensions();
    this.chart.resize(dimensions.width, dimensions.height);
  }

  /**
   * Performs resource cleanup: clears any pending debounce timer, stops resize observer, and
   * destroys the chart instance.
   */
  private cleanup(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.chart) {
      this.chart.destroy();
    }
  }

  /**
   * Re-renders the chart in response to a change in the value key.
   *
   * @param newValueKey - new selected value key (population or land area)
   */
  private onValueKeyChange(newValueKey: 'population' | 'landAreaKM2'): void {
    if (this.currentValueKey !== newValueKey) {
      this.currentValueKey = newValueKey;
      this.renderChart();
    }
  }

  /**
   * Opens the drawer with the selected country data.
   *
   * @param countryData - Data for the current selected country.
   */
  private onCountryClick(countryData: any): void {
    if (!this.chart) {
      console.error('Chart not initialised.');
      return;
    }
    this.chart.openDrawer(countryData, () => {
      this.onDrawerClose();
    });
  }

  /**
   * Closes the drawer.
   */
  private onDrawerClose(): void {
    this.chart.closeDrawer();
  }
}
