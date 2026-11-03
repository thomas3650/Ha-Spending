const two = (n: number) => String(n).padStart(2, "0");

export function stamp(date: Date): string {
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
    `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
  );
}

export const logger = {
  info: (message: string): void => console.log(`${stamp(new Date())} ${message}`),
  warn: (message: string): void => console.warn(`${stamp(new Date())} ${message}`),
  error: (message: string): void => console.error(`${stamp(new Date())} ${message}`),
};
