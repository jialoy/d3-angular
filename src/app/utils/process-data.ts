/**
 * Handles data processing
 */

import * as d3 from 'd3';
import { NodeData, CountryRawData } from '../shared/types';

/**
 * Reads in data from the JSON and returns it.
 *
 * @returns JSON data
 */
export async function loadData(): Promise<any> {
  const data = await d3.json('/assets/europe_population_enriched.json');
  return data;
}

/**
 * Transforms raw data from JSON into hierarchy format expected by d3's circular pack.
 *
 * @param data - The raw data from the JSON
 *
 * @returns - The transformed data
 */
export function transformData(
  data: Record<'Europe', CountryRawData>
): NodeData {
  const regions: NodeData[] = Object.entries(data.Europe).map(
    ([region, countries]) => ({
      name: region,
      children: countries.map((country) => ({
        name: country['country'] as string,
        population: country['population'] as number,
        wikipedia: country['wikipedia'] as string,
        flag: country['flag'] as string,
        landAreaKM2: country['land_area_km2'] as number,
      })),
    })
  );

  return { name: 'Europe', children: regions };
}
