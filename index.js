// Connect to a Bluetooth printer
import { BLEManager } from "./bleManager";

const bleManager = new BLEManager();
export async function connectPrinter() {
  try {
      await bleManager.requestDevice();
      await bleManager.connect();
      console.log('Printer connected successfully!');
  } catch (error) {
      console.error('Error connecting to printer:', error);
      throw error;
  }
}

export async function sendTextCommand(x,y,font,rotation,x_multiply,y_multiply,content,alignment= 0){
  //TEXT 1320, 40, "3", 90, 1, 1,  "Hello Bluetooth  WebPOC!!"
  const textString = `
TEXT ${x},${y},"${font}",${rotation},${x_multiply},${y_multiply},"${content}"
`;
  console.log("Text command to printer : ", textString);
  await sendCommandsToPrinter(textString);
}

export async function sendBarcodeCommand(x,y,codeType,height,humanReadable,rotation,narrow,wide,content){
  //BARCODE 1230,880,"UPCA",60,1,90,2,2,"512300211784"
  const barcodeCommand =`
BARCODE ${x},${y},"${codeType},${height},${humanReadable},${rotation},${narrow},${wide},"${content}"
`;
  await sendCommandsToPrinter(barcodeCommand);
}

export async function sendRSSCommand(x,y,sym,rotate,pixMult,sepHeight,lineHeight,content){
  //RSS 1480,880,"RSSEXP",90,2,2,10,"81101001230014765631501102113210331541234567890"
  const rssCommand =`
RSS ${x},${y},"${sym}",${rotate},${pixMult},${sepHeight},${lineHeight},"${content}
`;
  await sendCommandsToPrinter(rssCommand);
}

export async function sendBlockCommand(x,y,width,height,font,rotation,x_multiplication,y_multiplication,space,fit,content){
  //BLOCK 1280, 60, 600, 110, "ROMAN.TTF", 90, 16, 11, 3, 1,  "SURGEON GENERAL'S WARNING: Smoking\nBy Pregnant Women May Result in Fetal\nInjury,Premature Birth, And Low Birth Weight."
  const blockCommand =`
BLOCK ${x},${y},${width},${height},"${font}",${rotation},${x_multiplication},${y_multiplication},${space},${fit},"${content}"
`;
  await sendCommandsToPrinter(blockCommand);
}

export async function sendBoxCommand(x,y,x_end,y_end,lineThickness){
  //BOX 1160,30,1300,630,5
  const boxCommand = `
BOX ${x},${y},${x_end},${y_end},${lineThickness}
`;
  await sendCommandsToPrinter(boxCommand);
}

export async function sendReverseBoxCommand(x,y,x_end,y_end){
  //REVERSE 1502,1160,30,180
  const reverseBoxCommand =`
REVERSE ${x},${y},${x_end},${y_end}
`;
  await sendCommandsToPrinter(reverseBoxCommand);
}

export async function sendQRCommand(x,y,ecc_level,cell_width,mode,rotation,model,content){
  //QRCODE x,y,ECC Level,cell width,mode,rotation,[justification,]model,]mask,]area],]length]"content" 
  //QRCODE 200,900,L,8,M,90,M2,"B0026http://www.instagram.com" 
  const qrCommand = `
QRCODE ${x},${y},${ecc_level},${cell_width},${mode},${rotation},${model},${content}
`;
  await sendCommandsToPrinter(qrCommand);
}

export async function sendCircleCommand(x_start,y_start,diameter,thickness){
  //CIRCLE X_start,Y_start,diameter,thickness 
  //CIRCLE 150,1000,10,5
  const circleCommand = `
CIRCLE ${x_start},${y_start},${diameter},${thickness}
`;
  await sendCommandsToPrinter(circleCommand);
}

export async function sendCommand(content){
  console.log("Send command Content: ",content);
  const sendcommand = `
${content}
`;
  await sendCommandsToPrinter(sendcommand);
}

export async function sendPrintCommand(labelCount = 1,copyCount=1){
  const printCommand = `
PRINT ${labelCount},${copyCount}
`;
  console.log("Print Command to printer: ",printCommand);
  await sendCommandsToPrinter(printCommand);
}

export async function sendSETCommand(item,action){
  // SET REPRINT ON
  const setCommand = `
SET ${item} ${action}
`;
  await sendCommandsToPrinter(setCommand);
}

export async function clearBuffer(){
  //CLS
  const clsCommmand = `
CLS
`;
  await sendCommandsToPrinter(clsCommmand);
}

export async function formFeed(){
  //FORMFEED
  const formfeedCommand = `
FORMFEED
`;
  await sendCommandsToPrinter(formfeedCommand);
}

export function getPCXCommand(x,y,fileName){
  const pcxCommand = `
PUTPCX ${x},${y},"${fileName}"
`;
  return pcxCommand;
}

export function getDownloadCommand(filename,bitmapByteLength,storeLocation = "F"){
  //DOWNLOAD F,"TMP.PCX",${bitmapBytes.length}
  const dowloadCommand =`
DOWNLOAD ${storeLocation},"${filename}",${bitmapByteLength};
`;
  return dowloadCommand;
}

export const writePCXfileToPrinter = async (fileName) => {
  try {
    const response = await fetch(fileName);
    console.log("Coupon fileName : ",`COUPON${fileName.toUpperCase()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bitmapBytes = new Uint8Array(arrayBuffer);

    const prefixCmd = `DOWNLOAD F,"COUPON.PCX",${bitmapBytes.length},`;
    // const prefixCmd = getDownloadCommand("COUPON.PCX",bitmapBytes.length);
    console.log("prefixCommand : ",prefixCmd);
    const prefixBytes = new TextEncoder().encode(prefixCmd);

    const suffixCmd = `
PUTPCX 0,20,"COUPON.PCX"
`;
    // const suffixCmd = getPCXCommand(0,20,"COUPON.PCX");
    console.log("Suffix Command : ", suffixCmd);
    const suffixBytes = new TextEncoder().encode(suffixCmd);
    const totalLength = prefixBytes.length + bitmapBytes.length + suffixBytes.length;
    const fullData = new Uint8Array(totalLength);
    fullData.set(prefixBytes, 0);
    fullData.set(bitmapBytes, prefixBytes.length);
    fullData.set(suffixBytes, prefixBytes.length + bitmapBytes.length);

    await bleManager.writeBinary(fullData);

  } catch (e) {
    console.error('Failed to send bitmap: ' + e.message);
  }
};

// Send content to the printer
export async function sendCommandsToPrinter(content) {
  try {
      await bleManager.writeUtf8String(content);
      console.log('Content printed successfully!');
  } catch (error) {
      console.error('Error printing content:', error);
      throw error;
  }
}

// Disconnect from the printer
export function disconnectPrinter() {
  bleManager.disconnect();
}
