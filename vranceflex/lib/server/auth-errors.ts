export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 409 | 429,
  ) {
    super(message);
  }
}
