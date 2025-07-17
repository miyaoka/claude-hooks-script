export type Result<T, E = Error> = 
  | { value: T; error?: undefined }
  | { value?: undefined; error: E };

export function tryCatch<T>(fn: () => T): Result<T> {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: error as Error };
  }
}