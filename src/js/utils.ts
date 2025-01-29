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

export { generateID, formatDate };