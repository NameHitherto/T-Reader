// 生成36位随机ID
const generateID = (randomLength: number) => {
  let idStr = Date.now().toString(36);
  idStr += Math.random().toString(36).substr(2, randomLength);
  return idStr;
}
// 格式化时间 xxxx-xx-xx xx:xx
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
// 将格式化的时间转换成可比较的数值
const formatDateToNumber = (date: string) => {
  // xxxx-xx-xx xx:xx
  const dateArr = date.split(' ');
  const [year, month, day] = dateArr[0].split('-');
  const [hours, minutes] = dateArr[1].split(':');
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime();
}
// 将blob格式的图片数据转化为可持久化保存的base64格式
const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
  // 使用fetch获取Blob数据
  const response = await fetch(blobUrl)
  const blob = await response.blob()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64Data = reader.result as string
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export { generateID, formatDate, formatDateToNumber, convertBlobToBase64 };