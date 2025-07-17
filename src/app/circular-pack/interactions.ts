/**
 * User interaction functions
 */

import * as d3 from 'd3';
import { NodeData } from '../shared/types';

type ValueKeyChangeCallback = (
  newValueKey: 'population' | 'landAreaKM2'
) => void;

// State to track current value key
let currentValueKey: 'population' | 'landAreaKM2' = 'landAreaKM2';

/**
 * Sets up all interactions related to the population/land area toggle.
 *
 * @param svgElement - The parent SVG element of the toggle
 * @param onValueKeyChange - Callback function for when toggle value is changed
 */
export function setupToggleInteractions(
  svgElement: SVGSVGElement,
  onValueKeyChange: ValueKeyChangeCallback
): void {
  const svg = d3.select(svgElement);

  // Setup toggle click handler
  svg.select('.value-toggle .toggle-click-area').on('click', function (event) {
    handleToggleClick(event, svg, onValueKeyChange);
  });

  // Handle clicks on labels
  svg.select('.toggle-label-left').on('click', function (event) {
    if (currentValueKey !== 'landAreaKM2') {
      handleToggleClick(event, svg, onValueKeyChange);
    }
  });

  svg.select('.toggle-label-right').on('click', function (event) {
    if (currentValueKey !== 'population') {
      handleToggleClick(event, svg, onValueKeyChange);
    }
  });
}

/**
 * Handles click events on the toggle - toggle the value key and notify the component about the
 * change.
 */
function handleToggleClick(
  event: MouseEvent,
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  onValueKeyChange: ValueKeyChangeCallback
): void {
  event.stopPropagation();

  const newValueKey =
    currentValueKey === 'landAreaKM2' ? 'population' : 'landAreaKM2';
  currentValueKey = newValueKey;

  onValueKeyChange(newValueKey);
}

/**
 * Updates the current value key based on the selection.
 *
 * @param valueKey - The selected key (population or land area)
 */
export function setCurrentValueKey(
  valueKey: 'population' | 'landAreaKM2'
): void {
  currentValueKey = valueKey;
}

/**
 * Gets the current value key and returns it.
 */
export function getCurrentValueKey(): 'population' | 'landAreaKM2' {
  return currentValueKey;
}

/**
 * Sets up all interactions related to the country leaf nodes.
 *
 * @param svgElement - The parent SVG element
 * @param onCountryClick - Callback function when a country node is clicked
 */
export function setupCountryClickInteractions(
  svgElement: SVGSVGElement,
  onCountryClick: (countryData: any) => void
): void {
  const svg = d3.select(svgElement);

  const nodes = svg.selectAll('.node').filter((d: any) => !d.children);

  nodes.style('cursor', 'pointer').on('click', function (event, d: any) {
    event.stopPropagation();

    const countryData = d.data;

    if (countryData && (countryData.country || countryData.name)) {
      onCountryClick(countryData);
    } else {
      console.warn('No valid country data found:', countryData);
    }
  });
}

/**
 * Sets up all interactions related to the side drawer.
 *
 * @param onCloseDrawer - Callback function when the drawer is closed
 */
export function setupDrawerInteractions(onCloseDrawer: () => void): void {
  // Setup close button to close the drawer
  d3.select('.drawer-close').on('click', function () {
    onCloseDrawer();
  });

  // Setup overlay click to close the drawer
  d3.select('.drawer-overlay').on('click', function () {
    onCloseDrawer();
  });

  // Prevent clicks inside drawer content from closing the drawer
  d3.select('.drawer-body').on('click', function (event) {
    event.stopPropagation();
  });
}

/**
 * Handles mouseover events in the visualisation: shows tooltips (region circles and country
 * nodes), makes circle stroke thicker, and animates country nodes.
 *
 * @param nodeSelection - D3 selection of node groups
 * @param size
 */
export function addNodeHoverEffects(
  nodeSelection: d3.Selection<
    SVGGElement | d3.BaseType,
    d3.HierarchyCircularNode<NodeData>,
    SVGGElement,
    unknown
  >,
  size: number
): void {
  d3.select('body').classed('d3-circular-pack', true);
  const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

  nodeSelection
    .on('mouseover', function (event: MouseEvent, d: any) {
      const node = d3.select(this);
      const circle = node.select('circle');

      // Show tooltip for region circle and country leaf nodes
      const tooltipText = d.data.name;
      tooltip
        .style('visibility', 'visible')
        .html(tooltipText.replace(/\n/g, '<br>'))
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 10 + 'px');

      // For country nodes, make the circle stroke thicker
      if (!d.children) {
        circle
          .transition()
          .duration(200)
          .attr('fill-opacity', 0.8)
          .attr('stroke-width', () => {
            const baseWidth = Math.max(0.5, size * 0.001);
            return baseWidth * 3;
          });

        // Add a tiny wiggle
        const shiftCoordinates = [
          [2, -0.5],
          [-2, -0.5],
          [2, 0],
          [-2, 0],
          [0, 0],
        ];
        let transition = node.transition().duration(0);
        shiftCoordinates.forEach(([x, y]) => {
          transition = transition
            .transition()
            .duration(125)
            .attr('transform', (d: any) => `translate(${d.x + x},${d.y + y})`);
        });
      }
    })
    .on('mousemove', function (event: MouseEvent) {
      // Update tooltip position
      tooltip
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 10 + 'px');
    })
    .on('mouseout', function (event: MouseEvent, d: any) {
      const node = d3.select(this);
      const circle = node.select('circle');

      // Hide tooltip
      tooltip.style('visibility', 'hidden');

      // Reset stroke thickness
      if (!d.children) {
        circle
          .transition()
          .duration(200)
          .attr('fill-opacity', 0.5)
          .attr('stroke-width', () => {
            const baseWidth = Math.max(0.5, size * 0.001);
            return baseWidth;
          });
      }
    });
}
