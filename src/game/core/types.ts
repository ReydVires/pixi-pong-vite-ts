/**
 * A value that may be absent.
 *
 * Sugar for the bare union, so fields and parameters that start out empty read
 * as one thing (`Nullable<PlayHud>`) instead of a union repeated at every site.
 */
export type Nullable<T> = T | null;
