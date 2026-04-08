export const generateID = (randomLength: number) => {
  let idStr = Date.now().toString(36)
  idStr += Math.random().toString(36).substr(2, randomLength)
  return idStr
}
