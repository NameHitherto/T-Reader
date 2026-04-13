export const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
  const response = await fetch(blobUrl)
  const blob = await response.blob()

  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
