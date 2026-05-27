export interface StateStore<TData extends object> {
  read(): Promise<TData>;
  write(data: TData): Promise<void>;
  update<TResult>(mutator: (data: TData) => Promise<{ data: TData; result: TResult }> | { data: TData; result: TResult }): Promise<TResult>;
  archiveRecords?(bucket: string, records: Array<{ id: string; time: string; payload: unknown }>): Promise<number>;
  queryArchiveRecords?(input: { bucket?: string; limit?: number }): Promise<Array<{ id: number; bucket: string; recordId: string; eventTime: string; payload: unknown; archivedAt: string }>>;
  close?(): void;
}
