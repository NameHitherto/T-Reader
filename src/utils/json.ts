export const stringifyJson = (value: unknown): string => JSON.stringify(value, null, 2)

export const encodeJson = (value: unknown): Uint8Array => {
  return new TextEncoder().encode(stringifyJson(value))
}
