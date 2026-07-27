export interface WebDavError {
  statusCode: number
  operation: 'delete' | 'upload' | 'download' | 'exists' | 'list'
  resource: string
  message: string
}

export const isWebDavError = (error: unknown): error is WebDavError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    'operation' in error &&
    typeof (error as WebDavError).statusCode === 'number'
  )
}
