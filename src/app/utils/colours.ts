import * as d3 from 'd3';

// Mapping of regions to colours
const regionColourMap = {
  'Northern Europe': '#9372c7',
  'Eastern Europe': '#0A84FF',
  'Southern Europe': '#ffA600',
  'Western Europe': '#12BC00',
};

export const regionColourScale = d3
  .scaleOrdinal<string, string>()
  .domain(Object.keys(regionColourMap))
  .range(Object.values(regionColourMap));
