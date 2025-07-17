/**
 * Handles D3 rendering logic of the circular pack chart
 */

import * as d3 from 'd3';
import { NodeData } from '../shared/types';
import { regionColourScale } from '../utils/colours';
import { addNodeHoverEffects } from './interactions';

export interface ChartConfig {
  width: number;
  height: number;
  valueKey: 'population' | 'landAreaKM2';
}

export class CircularPackChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private group: d3.Selection<SVGGElement, unknown, null, undefined> | null =
    null;
  private nodes: d3.HierarchyCircularNode<NodeData>[] = [];
  private colourScale: d3.ScaleOrdinal<string, string>;
  private toggleGroup:
    | d3.Selection<SVGGElement, unknown, null, undefined>
    | undefined;
  private drawerContainer: d3.Selection<
    HTMLDivElement,
    unknown,
    HTMLElement,
    any
  > | null = null;

  constructor(svgElement: SVGSVGElement) {
    this.svg = d3.select(svgElement);
    this.colourScale = regionColourScale;
  }

  /**
   * Renders the circular pack chart.
   *
   * @param data - The data to be visualised
   * @param config - The chart configurations: width, height, current value key (land area or
   * population)
   */
  public render(data: NodeData, config: ChartConfig): void {
    // Clear any existing chart
    this.clear();
    const { width, height, valueKey } = config;
    const rectWidth = Math.min(width, height) * 1.2;
    const rectHeight = Math.min(width, height) * 0.8;
    const packSize: [number, number] = [rectWidth, rectHeight];

    // Set the viewbox
    this.svg.attr('viewBox', `0 0 ${rectWidth} ${rectHeight}`);

    this.svg.attr('class', 'd3-circular-pack');

    this.svg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('rx', 15)
      .attr('ry', 15)
      .attr('class', 'svg-viewbox-rect');

    // Create hierarchy and pack layout
    const root = d3
      .hierarchy<NodeData>(data)
      .sum((d: any) => d[valueKey] ?? 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3
      .pack<NodeData>()
      .size(packSize)
      .padding(Math.max(2, Math.min(packSize[0], packSize[1]) * 0.01));

    this.nodes = pack(root).descendants();

    // Apply custom positioning of the region circles
    this.positionRegionCircles(packSize[0], packSize[1]);

    // Create main group containing the region circles
    this.group = this.svg.append('g').attr('transform', `translate(0, 0)`);

    // Draw all the child nodes (region circles + country leaf nodes)
    this.drawNodes(packSize[0], packSize[1]);

    // Add the toggle for land area/population
    this.createToggle();

    // Update the initial state of the toggle based on valueKey setting
    this.updateToggleState(config.valueKey);
  }

  /**
   * Resizes chart elements based on the given width and height parameters.
   *
   * @param width - Chart width
   * @param height - Chart height
   */
  public resize(width: number, height: number): void {
    const size = Math.min(width, height);
    const rectWidth = Math.min(width, height) * 1.2;
    const rectHeight = Math.min(width, height) * 0.8;

    // Update SVG viewBox
    this.svg.attr('viewBox', `0 0 ${rectWidth} ${rectHeight}`);

    if (!this.group || this.nodes.length === 0) return;

    // Update the pack layout
    const pack = d3
      .pack<NodeData>()
      .size([rectWidth, rectHeight])
      .padding(Math.max(2, Math.min(rectWidth, rectHeight) * 0.01));

    // Re-apply pack layout to the existing hierarchy
    if (this.nodes[0]) {
      pack(this.nodes[0] as any);
    }

    // Update positioning of the region circles
    this.positionRegionCircles(rectWidth, rectHeight);

    // Update group transform
    this.group.attr('transform', `translate(0, 0)`);

    // Update node positions and sizes
    const node = this.group.selectAll('g.node');
    node
      .transition()
      .duration(300)
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Update region circles
    node
      .selectAll('circle')
      .transition()
      .duration(300)
      .attr('r', (d: any) => d.r)
      .attr('stroke-width', (d: any) => {
        const baseWidth = Math.max(0.5, size * 0.001);
        return d.children ? baseWidth * 2 : baseWidth;
      });

    // Update the side drawer dimensions (relevant if drawer is open)
    this.updateDrawerDimensions();
  }

  public clear(): void {
    this.svg.selectAll('*').remove();
    this.group = null;
    this.nodes = [];
  }

  public destroy(): void {
    if (this.toggleGroup) {
      this.toggleGroup.remove();
    }
    d3.select('.drawer').remove();
    d3.select('.drawer-overlay').remove();
    this.clear();
  }

  /**
   * Creates the toggle which allows sers to choose between population and land area.
   */
  public createToggle(): void {
    // Remove existing toggle if it exists
    if (this.toggleGroup) {
      this.toggleGroup.remove();
    }

    // Create the toggle group
    this.toggleGroup = this.svg
      .append('g')
      .attr('class', 'value-toggle')
      .attr('transform', 'translate(20, 20)');

    // Toggle background
    this.toggleGroup
      .append('rect')
      .attr('class', 'toggle-background')
      .attr('rx', 20);

    // Toggle switch background
    this.toggleGroup
      .append('rect')
      .attr('class', 'switch-background')
      .attr('x', 5)
      .attr('y', 5)
      .attr('rx', 15);

    // Toggle switch slider
    this.toggleGroup
      .append('rect')
      .attr('class', 'toggle-slider')
      .attr('x', 7)
      .attr('y', 7)
      .attr('rx', 13);

    // Left label (Land Area)
    this.toggleGroup
      .append('text')
      .attr('class', 'toggle-label-left active')
      .attr('x', 52)
      .attr('y', 25)
      .text('Land Area');

    // Right label (Population)
    this.toggleGroup
      .append('text')
      .attr('class', 'toggle-label-right')
      .attr('x', 148)
      .attr('y', 25)
      .text('Population');

    // Make the entire toggle area clickable
    this.toggleGroup
      .append('rect')
      .attr('class', 'toggle-click-area')
      .attr('width', 200)
      .attr('height', 40);
  }

  /**
   * Updates the visual state of the toggle.
   *
   * @prama valueKey - The current value being visualised (population or land area)
   */
  public updateToggleState(valueKey: 'population' | 'landAreaKM2'): void {
    if (!this.toggleGroup) return;

    const isPopulation = valueKey === 'population';

    const slider = this.toggleGroup.select('.toggle-slider');
    const leftLabel = this.toggleGroup.select('.toggle-label-left');
    const rightLabel = this.toggleGroup.select('.toggle-label-right');

    const transition = d3.transition().duration(20).ease(d3.easeSinOut);

    if (isPopulation) {
      slider
        .attr('transform', 'translate(0, 0)')
        .transition(transition)
        .attr('transform', 'translate(96, 0)');
      leftLabel
        .classed('active', false)
        .attr('fill', '#fff')
        .transition(transition)
        .attr('fill', '#666');
      rightLabel
        .classed('active', true)
        .attr('fill', '#666')
        .transition(transition)
        .attr('fill', '#fff');
    } else {
      slider
        .attr('transform', 'translate(96, 0)')
        .transition(transition)
        .attr('transform', 'translate(0, 0)');
      leftLabel
        .classed('active', true)
        .attr('fill', '#666')
        .transition(transition)
        .attr('fill', '#fff');

      rightLabel
        .classed('active', false)
        .attr('fill', '#fff')
        .transition(transition)
        .attr('fill', '#666');
    }
  }

  /**
   * Creates the side drawer that opens on click on a country node.
   */
  public createDrawer(): void {
    // Remove existing drawer if it exists
    d3.select('.drawer').remove();
    d3.select('.drawer-overlay').remove();

    const svgRect = this.svg
      .select('.svg-viewbox-rect')
      .node() as SVGRectElement;

    if (!svgRect) return;

    const rectBounds = svgRect.getBoundingClientRect();
    const drawerWidth = 400;

    d3.select('body').classed('d3-circular-pack', true);

    // Create the overlay
    const overlay = d3
      .select('body')
      .append('div')
      .attr('class', 'drawer-overlay')
      .style('top', `${rectBounds.top}px`)
      .style('left', `${rectBounds.left}px`)
      .style('width', `${rectBounds.width}px`)
      .style('height', `${rectBounds.height}px`);

    // Create the drawer
    const drawer = d3
      .select('body')
      .append('div')
      .attr('class', 'drawer')
      .style('position', 'fixed')
      .style('width', `${drawerWidth}px`)
      .style('top', `${rectBounds.top}px`)
      .style('left', `${rectBounds.right - drawerWidth}px`)
      .style('width', `${drawerWidth}px`)
      .style('height', `${rectBounds.height}px`);

    this.drawerContainer = drawer;

    // Create the drawer body section
    const content = drawer.append('div').attr('class', 'drawer-body');

    // Append the x button to the drawer body
    content
      .append('button')
      .attr('class', 'drawer-close')
      .html('&times;')
      .on('click', () => {
        this.closeDrawer();
      });

    // Append the inner drawer content section to the drawer body
    content.append('div').attr('class', 'drawer-content');

    // Trigger entrance with a slight delay
    setTimeout(() => {
      drawer.style('transform', 'translateX(0)');
      overlay.style('opacity', '1');
    }, 10);

    overlay.on('click', () => this.closeDrawer());
  }

  /**
   * Handles opening of the side drawer.
   *
   * @param countryData - Data for the current selected country
   * @param onCloseCallback - Callback when drawer is closed
   */
  public openDrawer(countryData: any, onCloseCallback?: () => void): void {
    if (!this.drawerContainer) {
      this.createDrawer();

      if (onCloseCallback) {
        this.setupDrawerCloseInteractions(onCloseCallback);
      }
    }

    // Add the drawer content and show the overlay
    this.populateDrawerContent(countryData);
    const overlay = d3.select('.drawer-overlay');
    overlay.style('visibility', 'visible').style('opacity', '1');

    // Slide in drawer
    this.drawerContainer!.style('right', '0px');
  }

  /**
   * Sets up click and listener events related to closing of the drawer.
   *
   * @param onCloseCallback - callback when drawer is closed
   */
  private setupDrawerCloseInteractions(onCloseCallback: () => void): void {
    // Setup close button interaction
    d3.select('.drawer-close').on('click', () => {
      onCloseCallback();
    });

    // Setup overlay click to close drawer
    d3.select('.drawer-overlay').on('click', () => {
      onCloseCallback();
    });

    // Prevent clicks inside drawer content from closing the drawer
    d3.select('.drawer-outer-content').on('click', function (event) {
      event.stopPropagation();
    });

    // Setup an escape key listener to also close the drawer
    d3.select('body').on('keydown.drawer', (event) => {
      if (event.key === 'Escape') {
        onCloseCallback();
      }
    });
  }

  /**
   * Removes drawer elements when the drawer is closed.
   */
  public closeDrawer(): void {
    if (!this.drawerContainer) return;

    const drawer = this.drawerContainer;
    const overlay = d3.select('.drawer-overlay');

    drawer.style('transform', 'translateX(100%)');

    overlay.style('opacity', '0');

    setTimeout(() => {
      drawer.remove();
      overlay.remove();
      this.drawerContainer = null;
    }, 300);
  }

  /**
   * Adds the content to the drawer.
   *
   * @param - Data for the current selected country
   */
  private populateDrawerContent(countryData: any): void {
    const drawerBody = d3.select('.drawer-content');

    // Clear any existing content
    drawerBody.selectAll('*').remove();

    // Add country name as the header
    drawerBody.append('h2').text(countryData.name);

    // Add the flag
    if (countryData.flag) {
      drawerBody
        .append('img')
        .attr('src', countryData.flag)
        .attr('alt', `${countryData.country} flag`);
    }

    // Create the info container, which holds area and population information
    const infoContainer = drawerBody
      .append('div')
      .attr('class', 'info-container')
      .style('margin-bottom', '20px');

    // Add land area info
    if (countryData.landAreaKM2) {
      const areaDiv = infoContainer
        .append('div')
        .style('margin-bottom', '15px');
      areaDiv.append('strong').text('Area: ');
      areaDiv
        .append('span')
        .text(`${countryData.landAreaKM2.toLocaleString()} km²`);
    }

    // Add population info
    if (countryData.population) {
      const populationDiv = infoContainer
        .append('div')
        .style('margin-bottom', '15px');
      populationDiv.append('strong').text('Population: ');
      populationDiv
        .append('span')
        .text(countryData.population.toLocaleString());
    }

    // Add the Wikipedia link
    if (countryData.wikipedia) {
      drawerBody
        .append('a')
        .attr('class', 'wikipedia-link')
        .attr('href', countryData.wikipedia)
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .text('View on Wikipedia');
    }
  }

  /**
   * Recalculates the overlay and drawer positions and dimensions based on the current
   * svg-viewbox-rect element bounds.
   */
  private updateDrawerDimensions(): void {
    const overlay = d3.select('.drawer-overlay');
    const drawer = d3.select('.drawer');

    if (overlay.empty() || drawer.empty()) return;

    const svgRect = this.svg
      .select('.svg-viewbox-rect')
      .node() as SVGRectElement;

    if (!svgRect) return;

    const rectBounds = svgRect.getBoundingClientRect();
    const drawerWidth = 400;

    // Update overlay dimensions
    overlay
      .style('top', `${rectBounds.top}px`)
      .style('left', `${rectBounds.left}px`)
      .style('width', `${rectBounds.width}px`)
      .style('height', `${rectBounds.height}px`);

    // Update drawer dimensions and position
    drawer
      .style('top', `${rectBounds.top}px`)
      .style('left', `${rectBounds.right - drawerWidth}px`)
      .style('height', `${rectBounds.height}px`);
  }

  /**
   * Draws the child nodes within the pack layout.
   *
   * @param width - Pack width
   * @param height - Pack height
   * @returns
   */
  private drawNodes(width: number, height: number): void {
    if (!this.group) return;
    const size = Math.min(width, height);

    // Filter out root node to hide the pack circle
    const nodesToRender = this.nodes.filter((d, i) => i !== 0);

    const node = this.group
      .selectAll('g')
      .data(nodesToRender)
      .join('g')
      .attr('class', (d) => {
        const baseClass = 'node';
        // Classes for region circles and country leaf nodes
        const typeClass = d.children ? 'region-node' : 'country-node';
        return `${baseClass} ${typeClass}`;
      })
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Draw region circles
    node
      .append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => {
        if (d.children) {
          // Region circles - use colour scale
          return this.colourScale(d.data.name || '');
        } else {
          // Leaf nodes
          const parentColour = this.colourScale(d.parent?.data.name || '');
          return parentColour || '#CCC';
        }
      })
      .attr('stroke', (d) => {
        if (d.children) {
          // Region circles strokes
          const fillColour = this.colourScale(d.data.name || '');
          return d3.color(fillColour)?.darker(0.5)?.toString() || '#555';
        } else {
          // Leaf nodes strokes
          const parentColour = this.colourScale(d.parent?.data.name || '');
          return d3.color(parentColour)?.darker(0.8)?.toString() || '#333';
        }
      })
      .attr('stroke-width', (d) => {
        // Thicker stroke for regions
        const baseWidth = Math.max(0.5, size * 0.001);
        return d.children ? baseWidth * 2 : baseWidth;
      })
      .attr('fill-opacity', (d) => (d.children ? 0.2 : 0.5));

    // Add text labels for leaf nodes
    this.addTextLabels(node.filter((d) => !d.children));

    // Add mouseover effects on nodes
    addNodeHoverEffects(node, size);
  }

  /**
   * Handles the wrapping and truncation logic of text labels in leaf nodes.
   *
   * @remarks
   * Words that fit are shown as-is.
   * Single word labels that are too long are truncated and ellipses are added.
   * Multiple word labels are split into lines by whitespace, then truncation logic is applied. A
   * maximum of 2 lines is enforced, with ellipses on the second line if the label is longer.
   */
  private addTextLabels(
    selection: d3.Selection<
      SVGGElement | d3.BaseType,
      d3.HierarchyCircularNode<NodeData>,
      SVGGElement | null,
      unknown
    >
  ): void {
    selection.each(function (d) {
      // Remove existing text elements first
      d3.select(this).selectAll('text').remove();
      const textElement = d3
        .select(this)
        .append('text')
        .attr('dy', '0.3em')
        .style('text-anchor', 'middle')
        .style('font-size', `${Math.max(8, d.r / 4)}px`)
        .style('fill', '#333')
        .style('pointer-events', 'none');

      const fontSize = Math.max(8, d.r / 4);
      const maxWidth = d.r * 1.6;
      const words = d.data.name.split(' ');

      if (words.length === 1) {
        // Single word - truncate if too long
        const processedText = CircularPackChart.processWordForFit(
          words[0],
          maxWidth,
          fontSize,
          d.r
        );
        textElement.text(processedText);
      } else {
        // Multiple words - process each word for up to 2 lines
        let lines: string[] = [];

        for (let i = 0; i < words.length && lines.length < 2; i++) {
          const word = words[i];
          const processedWord = CircularPackChart.processWordForFit(
            word,
            maxWidth,
            fontSize,
            d.r
          );

          // If the word was truncated (contains '...'), add it and stop processing
          if (processedWord.includes('...') || processedWord === '') {
            if (processedWord) {
              lines.push(processedWord);
            }
            break;
          } else {
            // Word fits completely, add it to lines
            lines.push(processedWord);
          }
        }

        // If we have more words than lines (meaning we stopped at 2 lines but have more words)
        // and the last line doesn't have ellipses, add ellipses to indicate truncation
        if (
          words.length > lines.length &&
          lines.length === 2 &&
          !lines[lines.length - 1].includes('...')
        ) {
          const lastLine = lines[lines.length - 1];
          // Try to add ellipses to the last word
          const withEllipses = lastLine + '...';
          if (
            CircularPackChart.getTextWidth(withEllipses, fontSize) <= maxWidth
          ) {
            lines[lines.length - 1] = withEllipses;
          } else {
            // If adding ellipses makes it too long, truncate and add ellipses
            lines[lines.length - 1] = CircularPackChart.processWordForFit(
              lastLine,
              maxWidth,
              fontSize,
              d.r,
              true
            );
          }
        }

        // Add tspan elements for each line
        lines.forEach((line, i) => {
          textElement
            .append('tspan')
            .attr('x', 0)
            .attr('dy', i === 0 ? '-0.2em' : '1.2em')
            .text(line);
        });
      }
    });
  }

  /**
   * Helper function to handle fitting a word within its circle.
   *
   * @param word - The word to test
   * @param maxWidth - Maximum width for the word
   * @param fontSize - Font size being used by this word (calculated based on the circle radius)
   * @param radius - Radius of the circle
   * @param forceEllipses - Whether to force adding ellipses to the word or not
   * @returns
   */
  private static processWordForFit(
    word: string,
    maxWidth: number,
    fontSize: number,
    radius: number,
    forceEllipses: boolean = false
  ): string {
    // First check if the word fits as-is (unless we're forcing ellipses)
    if (
      !forceEllipses &&
      CircularPackChart.getTextWidth(word, fontSize) <= maxWidth
    ) {
      return word;
    }

    // Word is too long or we're forcing ellipses, so truncate
    let truncated = word;
    for (let i = word.length; i > 0; i--) {
      const test = word.substring(0, i) + '...';
      if (CircularPackChart.getTextWidth(test, fontSize) <= maxWidth) {
        truncated = test;
        break;
      }
    }

    // Handle cases where even the shortest truncated version is still too long
    if (CircularPackChart.getTextWidth(truncated, fontSize) > maxWidth) {
      if (radius < 6) {
        return ''; // For very small circles, just show an empty string
      } else {
        return word.charAt(0) + '..'; // Otherwise just show the first letter + ..
      }
    }

    return truncated;
  }

  /**
   * Helper function to measure the width of a text string.
   *
   * @param text - The text to measure
   * @param fontSize - Font size being used by the string
   * @returns The width of the text in px
   */
  private static getTextWidth(text: string, fontSize: number): number {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Context could not be created');
    }
    context.font = `${fontSize}px sans-serif`;
    return context.measureText(text).width;
  }

  /**
   * Positions the region circles within its parent container.
   *
   * @param packWidth - Width of the circular pack element
   * @param packHeight - Height of the circular pack element
   */
  private positionRegionCircles(packWidth: number, packHeight: number): void {
    if (!this.nodes || this.nodes.length === 0) return;

    const regionNodes = this.nodes.filter((d) => d.depth === 1);
    if (regionNodes.length === 0) return;

    const centreX = packWidth / 2;
    const centreY = packHeight / 2;

    // Geographic quadrant assignments for each of the four region circles
    const quadrants: { [key: string]: string } = {
      'Northern Europe': 'top',
      'Western Europe': 'left',
      'Eastern Europe': 'right',
      'Southern Europe': 'bottom',
    };

    // Store original positions for child offset calculations
    const originalPositions = new Map();
    regionNodes.forEach((regionNode) => {
      originalPositions.set(regionNode, {
        x: regionNode.x || centreX,
        y: regionNode.y || centreY,
      });
    });

    // Calculate optimal positions for the four region circles
    const positions = this.calculateOptimalPositions(
      regionNodes,
      packWidth,
      packHeight,
      quadrants
    );

    // Apply new positions and update child nodes
    regionNodes.forEach((regionNode) => {
      if (
        regionNode.data &&
        regionNode.data.name &&
        positions.has(regionNode.data.name)
      ) {
        const original = originalPositions.get(regionNode);
        const newPos = positions.get(regionNode.data.name);

        if (!newPos) {
          throw new Error('Node position could not be calculated');
        }

        // Update region circle position
        regionNode.x = newPos.x;
        regionNode.y = newPos.y;

        // Update all child nodes to maintain their relative positions within parent circle
        const childNodes = this.nodes.filter(
          (d) => d.depth > 1 && this.isDescendantOf(d, regionNode)
        );

        childNodes.forEach((childNode) => {
          if (childNode.x !== undefined && childNode.y !== undefined) {
            const offsetX = childNode.x - original.x;
            const offsetY = childNode.y - original.y;
            childNode.x = newPos.x + offsetX;
            childNode.y = newPos.y + offsetY;
          }
        });
      }
    });
  }

  /**
   * Helper algorithm to calculate the optimal positions for the four region circles within their
   * parent container.
   *
   * @remarks
   * Algorithm assigns each region circle to a quadrant based on geographical logic, then optimises
   * its position by calculating repulsion forces between each pair of circles based on the distance
   * between the two circles and the size of each circle (larger = stronger repulsion).
   * @param regionNodes - Array containing data of the child nodes in each quadrant
   * @param packWidth - Width of the circular pack element
   * @param packHeight - Height of the circular pack element
   * @param quadrants - Mapping of quadrants to positions
   * @returns Object specifying final centre coordinates for each of the four region circles
   */
  private calculateOptimalPositions(
    regionNodes: any[],
    packWidth: number,
    packHeight: number,
    quadrants: { [key: string]: string }
  ): Map<string, { x: number; y: number }> {
    const centreX = packWidth / 2;
    const centreY = packHeight / 2;

    // Define quadrant type
    type QuadrantName = 'top' | 'bottom' | 'left' | 'right';

    // Create region info with constraints
    const regions = regionNodes.map((node) => ({
      name: node.data.name,
      radius: node.r || 0,
      quadrant: quadrants[node.data.name] as QuadrantName,
      node: node,
    }));

    // Initial positioning in quadrants
    const margin = 20; // Safety margin from edge of parent container
    const positions = new Map<string, { x: number; y: number }>();

    // Calculate available space for each quadrant: quadrants start with a default centre coordinate
    // for the circle, and min and max X and Y coordinates are calculated based on the safety margin
    // from the container edge. This generates boundary limits within which each circle can
    // potentially be positioned.
    const quadrantBounds: Record<
      QuadrantName,
      {
        centerX: number;
        centerY: number;
        maxX: number;
        maxY: number;
        minX: number;
        minY: number;
      }
    > = {
      top: {
        centerX: centreX,
        centerY: centreY * 0.5,
        maxX: packWidth - margin,
        maxY: centreY - margin,
        minX: margin,
        minY: margin,
      },
      bottom: {
        centerX: centreX,
        centerY: centreY * 1.5,
        maxX: packWidth - margin,
        maxY: packHeight - margin,
        minX: margin,
        minY: centreY + margin,
      },
      left: {
        centerX: centreX * 0.5,
        centerY: centreY,
        maxX: centreX - margin,
        maxY: packHeight - margin,
        minX: margin,
        minY: margin,
      },
      right: {
        centerX: centreX * 1.5,
        centerY: centreY,
        maxX: packWidth - margin,
        maxY: packHeight - margin,
        minX: centreX + margin,
        minY: margin,
      },
    };

    // Initial default position for each circle (centre of quadrant)
    regions.forEach((region) => {
      const bounds = quadrantBounds[region.quadrant];
      positions.set(region.name, {
        x: bounds.centerX,
        y: bounds.centerY,
      });
    });

    // Optimisation to maximise distances between circles while respecting quadrant boundaries
    const maxIterations = 50;
    const forceStrength = 2.0; // Ampilifies how aggressively circles repel on each iteration

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let totalMovement = 0;
      const forces = new Map<string, { fx: number; fy: number }>();

      // Initialise forces that will act on the circles to move them
      regions.forEach((region) => {
        forces.set(region.name, { fx: 0, fy: 0 });
      });

      // Compare every region circle with every other circle, and calculate repulsion forces between
      // each pair: if circles are too close, force is applied to push them apart; larger circles
      // (larger radius) exert stronger forces to push circles further apart
      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          const region1 = regions[i];
          const region2 = regions[j];

          const pos1 = positions.get(region1.name)!;
          const pos2 = positions.get(region2.name)!;

          const dx = pos1.x - pos2.x; // Horizontal distance between the two centres
          const dy = pos1.y - pos2.y; // Vertical distance between the two centres
          const distance = Math.sqrt(dx * dx + dy * dy); // Euclidean distance between the two

          if (distance > 0) {
            // Set how far apart the two circles should go
            const bufferDist = 30;
            const requiredDistance =
              region1.radius + region2.radius + bufferDist;

            // Normalised repulsion strength between circles: ranges from 0 (circles are far apart
            // enough) to 1 ()
            const force = Math.max(0, requiredDistance - distance) / distance;

            // Convert force to directional components
            // Divide by 2 as each circle moves half the total distance to shift
            const fx = (dx * force * forceStrength) / 2;
            const fy = (dy * force * forceStrength) / 2;

            const force1 = forces.get(region1.name)!;
            const force2 = forces.get(region2.name)!;

            force1.fx += fx; // Horizontal movement for first circle
            force1.fy += fy; // Vertical movement for first circle
            force2.fx -= fx; // Horizontal movement for second circle
            force2.fy -= fy; // Vertical movement for second circle
          }
        }
      }

      // Apply forces whilst constraining circles to their quadrants
      regions.forEach((region) => {
        const currentPos = positions.get(region.name)!;
        const force = forces.get(region.name)!;
        const bounds = quadrantBounds[region.quadrant];

        // Apply force to get updated circle position
        let newX = currentPos.x + force.fx;
        let newY = currentPos.y + force.fy;

        // Constrain to boundary limits, accounting for circle radiuses
        const paddingDist = 5; // Ensures circle does not touch parent container edge
        const effectiveRadius = region.radius + paddingDist;
        newX = Math.max(
          bounds.minX + effectiveRadius,
          Math.min(bounds.maxX - effectiveRadius, newX)
        );
        newY = Math.max(
          bounds.minY + effectiveRadius,
          Math.min(bounds.maxY - effectiveRadius, newY)
        );

        // Update the position of the circle
        positions.set(region.name, { x: newX, y: newY });

        // Track distance circles have moved in this iteration
        const movement =
          Math.abs(newX - currentPos.x) + Math.abs(newY - currentPos.y);
        totalMovement += movement;
      });

      // Check for convergence - when movement approaches stopping, break
      if (totalMovement < 1) {
        break;
      }
    }

    return positions;
  }

  /**
   * Helper function to check if a node is a child of another node.
   * @param node - The node element to check
   * @param ancestor - The node to check against
   * @returns True if node being checked is a child node, false otherwise
   */
  private isDescendantOf(node: any, ancestor: any): boolean {
    let current = node.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}
