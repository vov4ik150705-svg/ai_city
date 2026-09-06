declare module "pg" {
  export class Client {
    constructor(config: { connectionString: string })
    connect(): Promise<void>
    query(
      sql: string,
      params?: readonly unknown[],
    ): Promise<{ rows: Array<{ readonly [key: string]: unknown }> }>
    end(): Promise<void>
  }
  const pg: { Client: typeof Client }
  export default pg
}
