export type Result<T, E = Error> = 
  | { value: T; error?: undefined }
  | { value?: undefined; error: E };

export function tryCatch<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: error as E };
  }
}