declare module "hyparquet" {
  export function asyncBufferFromFile(path: string): Promise<{
    byteLength: number;
    slice(start: number, end?: number): Promise<ArrayBuffer>;
  }>;

  export function parquetReadObjects(options: {
    file: unknown;
  }): Promise<Record<string, unknown>[]>;
}
