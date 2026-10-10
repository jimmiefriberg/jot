/** An expected outcome the caller must handle: a value, or an error message to show. */
export type Result<T> = { isOk: true; value: T } | { isOk: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { isOk: true, value };
}

export function err<T>(error: string): Result<T> {
  return { isOk: false, error };
}
