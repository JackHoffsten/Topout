import { problemSchema } from './problemContracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Fetcher = typeof fetch;

export async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const result = problemSchema.safeParse(body);
    const messages: Record<number, string> = {
      400: 'Check the details and try again.',
      401: 'Please sign in again.',
      403: 'Your session could not be verified. Please try again.',
      404: 'This item is no longer available.',
      409: 'This change could not be saved.',
      429: 'Too many attempts. Give it a moment and try again.',
    };
    const validation = result.success
      ? Object.values(result.data.errors ?? {}).flat()[0]
      : undefined;
    throw new ApiError(
      response.status,
      validation ||
        (result.success && (result.data.detail || result.data.title)) ||
        messages[response.status] ||
        'Something went wrong. Please try again.',
    );
  }
  return body;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Could not connect. Check your connection and try again.';
}
