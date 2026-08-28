declare module 'helmet' {
  export default function helmet(options?: Record<string, unknown>): (req: unknown, res: unknown, next: (err?: unknown) => void) => void;
  export type HelmetOptions = Record<string, unknown>;
}
