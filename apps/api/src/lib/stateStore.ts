export interface StateStore<TData extends object> {
  read(): Promise<TData>;
  write(data: TData): Promise<void>;
  update<TResult>(mutator: (data: TData) => Promise<{ data: TData; result: TResult }> | { data: TData; result: TResult }): Promise<TResult>;
  close?(): void;
}
