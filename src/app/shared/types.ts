export type NodeData = {
  name: string;
  population?: number;
  wikipedia?: string;
  flag?: string;
  landAreaKM2?: number;
  children?: NodeData[];
};

export type CountryRawData = Record<string, Array<Record<string, unknown>>>;
