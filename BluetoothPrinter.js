import React, { useState, useEffect } from 'react';

const BluetoothPrinter = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  // server state removed as it wasn't used directly after connection logic
  const [characteristic, setCharacteristic] = useState(null);
  const [readChar , setReadChar] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [printLog, setPrintLog] = useState([]); // To show logs in the UI

  // Helper function to add logs to both console and state
  const addLog = (message) => {
    console.log(message);
    setPrintLog(prevLog => [...prevLog, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const searchDevices = async () => {
    addLog('Searching for devices...');
    setIsSearching(true);
    setError(null); // Clear previous errors
    setDevices([]); // Clear previous device list
    try {
      const foundDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true, // Be careful with this in production
        // Filter for specific services if possible - e.g., common print services
        // optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'], // Example: Printer Service UUID
        optionalServices: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'], // Your original service
      });
      setDevices([foundDevice]); // requestDevice returns a single device
      addLog(`Device found: ${foundDevice.name || 'Unknown Device'}`);
      setIsSearching(false);
    } catch (err) {
      addLog(`Error searching devices: ${err.message}`);
      setError(err);
      setIsSearching(false);
    }
  };

  const connectDevice = async (device) => {
    addLog(`Connecting to ${device.name || 'Unknown Device'}...`);
    setSelectedDevice(device);
    setError(null);
    try {
      // Add listener *before* connecting
      device.addEventListener('gattserverdisconnected', onDisconnected);

      const server = await device.gatt.connect();
      addLog('Connected to GATT server.');
      // We don't need to store the server state if only used here

      // Try to find a writable characteristic
      // Using a common printer service UUID first might be more reliable
      // const primaryServiceUUID = '000018f0-0000-1000-8000-00805f9b34fb'; // Printer Service
      const primaryServiceUUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455'; // Your original service

      addLog(`Getting primary service: ${primaryServiceUUID}`);
      const service = await server.getPrimaryService(primaryServiceUUID);
      addLog('Service found.');

      const characteristics = await service.getCharacteristics();
      console.log('Getting characteristics...',characteristics);
      let foundCharacteristic = null;

      addLog(`Found ${characteristics.length} characteristics. Searching for writable...`);
      for (const char of characteristics) {
        // Prioritize characteristics that support write operations (with or without response)
         if (char.properties.write && char.properties.writeWithoutResponse) {
           addLog(`Found writable characteristic: ${char.uuid} (Write: ${char.properties.write}, WriteWithoutResponse: ${char.properties.writeWithoutResponse})`);
           foundCharacteristic = char;
           if(char.uuid.toString().slice(-3) === "bb3"){
            break;
           }
           // Prefer writeWithResponse if available, but take either for now
          //  break;
         }
      }

      for (const char of characteristics){
        if(char.properties.read){
          setReadChar(char);
          await getPrinterStatus(char);
          break;
        }
      }
      
      if (!foundCharacteristic) {
        addLog('No suitable writable characteristic found in the primary service.');
        // Optional: Fallback to searching all services (less efficient)
        // const services = await server.getPrimaryServices();
        // for (const srv of services) { /* ... search characteristics in other services ... */ }
        throw new Error('No writable characteristic found');
      }
      
      console.log('readChar',readChar);
      setCharacteristic(foundCharacteristic);
      setIsConnected(true);
      addLog(`Successfully connected and found characteristic: ${foundCharacteristic.uuid}`);

    } catch (err) {
      addLog(`Error connecting: ${err.message}`);
      setError(err);
      setIsConnected(false);
      setSelectedDevice(null);
      // Ensure listener is removed if connection fails midway
      if (device) {
         device.removeEventListener('gattserverdisconnected', onDisconnected);
         if(device.gatt.connected) {
            device.gatt.disconnect();
         }
      }
    }
  };

  const onDisconnected = (event) => {
    const device = event.target;
    addLog(`Device ${device.name || 'Unknown Device'} disconnected.`);
    setSelectedDevice(null);
    // server state removed
    setCharacteristic(null);
    setIsConnected(false);
    // No need to remove listener here, it's done in useEffect cleanup
  };

  async function printPCXFromServer(pcxFileName, offerCode) {
    try {
      const response = await fetch(`/${pcxFileName}`); // Fetch from server.
      console.log("Pcx file fetching response: ", response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const pcxData = await response.arrayBuffer();
      console.log( "pcxData = response.arrayBuffer :",pcxData); //inspect the data.
      const pcxUint8 = new Uint8Array(pcxData);
      console.log("pcxUint8", pcxUint8);
  
const tscCommand = `
DOWNLOAD "${pcxFileName}",${pcxUint8.length},${pcxUint8},
DIRECTION 1
CLS
PUTPCX 50, 20, "${pcxFileName}"
PRINT 1
EOP`
      const encoder = new TextEncoder();
      await sendChunk(encoder.encode(tscCommand));
    } catch (error) {
      console.error('Error printing PCX from server:', error);
    }
  }

  const print = async () => {
    if (!characteristic) {
      const errMsg = 'Cannot print: No characteristic found.';
      addLog(errMsg);
      setError(new Error(errMsg));
      return;
    }

    setError(null); // Clear previous errors specific to printing
    addLog('Preparing print command...');
      const pcxUint8 = new Uint8Array([
        // Replace this with your actual PCX data. Example(small image):
        10, 0, 1, 1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]);
      console.log("pcxUint8", pcxUint8);

      const pcxFileName = "153100.PCX";

    // --- IMPORTANT: Test with smaller data first! ---
    // A 600KB string is VERY large for BLE. Start testing with maybe 10KB or 50KB
    // const largeDataString = 'a'.repeat(10000); // Example: 10KB
    const largeDataString = 'a'.repeat(360); // Your original 600KB string

    let tscCommand1 = `
DIRECTION 1
CLS
TEXT 40,10,"3",90,1,1,"Start-${Date.now()}"
TEXT 70,10,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
TEXT 100,10,"1",90,1,1,"${largeDataString}"
BLOCK 1531, 40, 1400, 1000, "0", 90, 12.9, 12.9, 10, 1,  "Information about privacy practices, including information about the rights of California, Virginia,\nColorado, Connecticut, and Utah residents under the omnibus consumer privacy acts in those \nstates, can be found in the Privacy Policy located in the footer links on any of the branded websites \nlisted below:"
TEXT 130,10,"3",90,1,1,"End-${Date.now()}"
PRINT 1,1
`;
let tscCommand2 = `
DIRECTION 1
CLS
TEXT 1320, 40, "3", 90, 1, 1,  "www.newport-pleasure.com     www.vusevapor.com          www.mygrizzly.com"
TEXT 1290, 40, "3", 90, 1, 1,  "www.luckystrike.com          www.velo.com               www.camelsnus.com"
TEXT 1260, 40, "3", 90, 1, 1,  "www.camel.com                www.levigarrett.com        www.cougardips.com"
TEXT 1230, 40, "3", 90, 1, 1,  "www.pallmallusa.com          www.sensavape.com          www.kodiakspirit.com"
TEXT 1200, 40, "3", 90, 1, 1,  "www.americanspirit.com"
BLOCK 1531, 40, 1400, 1000, "0", 90, 12.9, 12.9, 10, 1,  "Information about privacy practices, including information about the rights of California, Virginia,\nColorado, Connecticut, and Utah residents under the omnibus consumer privacy acts in those \nstates, can be found in the Privacy Policy located in the footer links on any of the branded websites \nlisted below:"
PRINT 1,1
`;
const tscCommand3 = `
DOWNLOAD "${pcxFileName}",${pcxUint8.length},${pcxUint8},
DIRECTION 1
PUTPCX 100, 20, "${pcxFileName}"
PRINT 1
EOP`;

let tscCommand4 = `
DIRECTION 1
CLS
BARCODE 1500,50,"UPCA",100,1,90,2,2,"011620003004"
PRINT 1,1
`;

// BARCODE 1480,860,"128M",100,1,90,2,2,"!105!102011234567890123421123456!10210!100ABCD1234" 
let tscCommand5 = `
DIRECTION 1
CLS
BOX 1430,10,1520,820,20
TEXT 1490,40,"ROMAN.TTF",90,17,9,"WARNING:This product containes nicotine.Nicotine is an addictive chemical."
TEXT 1420,10,"ROMAN.TTF",90,16,9,"UNDERAGE SALE PROHIBITED"
TEXT 1420,600,"ROMAN.TTF",90,16,9,"NICOTINE PRODUCTS"
TEXT 1340,10,"5.EFT",90,2,2,"VELO"
TEXT 1370,340,"ROMAN.TTF",90,20,20,"GET 1 VELO CAN"
TEXT 1290,340,"ROMAN.TTF",90,20,20,"FOR $"
TEXT 1310,480,"ROMAN.TTF",90,50,30,"2.OO*"
TEXT 1230,540,"ROMAN.TTF",90,9,7,"* Plus applicable sales tax"
BOX 1502,950,1530,1160,2
BOX 1502,1164,1530,1364,2
TEXT 1196,750,"ROMAN.TTF",90,8,8,"156583"
TEXT 1176,730,"ROMAN.TTF",90,7,7,"@2024 MBI"
TEXT 1520,958,"1",90,1,1,"MANUFACTURER COUPON"
TEXT 1520,1168,"1",90,1,1,"EXPIRES 31/12/2025"
RSS 1480,860,"RSSEXP",90,2,2,10,"81101061414112345628911012012120850100480002140256" 
TEXT 1318,860,"1",90,1,1,"10614141123456289110120121208"
TEXT 1304,1180,"ROMAN.TTF",90,6,6,"Retailer: Subtract the dollar"
TEXT 1288,1180,"ROMAN.TTF",90,6,6,"value printed on this coupon"
TEXT 1272,1160,"ROMAN.TTF",90,6,6,"from normal retail price (do not"
TEXT 1256,1180,"ROMAN.TTF",90,6,6,"include sale tax). Write that"
TEXT 1240,1170,"ROMAN.TTF",90,6,6,"amount in the space provided."
BOX 1170,1204,1220,1374,2
BARCODE 1250,860,"UPCA",60,1,90,2,2,"540170112009"
PRINT 1,1
`;
let tscCommand6 = `
DIRECTION 1
CLS
TEXT 1320, 40, "3", 90, 1, 1,  "www.newport-pleasure.com      www.vusevapor.com           www.mygrizzly.com"
PRINT 1
`

    // Note: Added PRINT 1,1 - your original command was missing the final PRINT

    addLog(`Command prepared (Data length: ${largeDataString.length}). Encoding...`);

    try {
      const encoder = new TextEncoder();
      const response = await fetch(`/${pcxFileName}`); // Fetch from server.
      console.log("Pcx file fetching response: ", response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const pcxData = await response.arrayBuffer();
      console.log( "pcxData = response.arrayBuffer :",pcxData.byteLength); //inspect the data.
      const pcxUint8 = new Uint8Array(pcxData);
      let tscCommand = "FEED 100\r\n";
let printCommand = `
DIRECTION 1
PUTBMP 0, 20, "${pcxFileName}"
PRINT 1
CLS
`
      let BTModeCommand = `
      BT PAIRMODE LEGACY
      BT MODE BT4.0
      `
      const data = encoder.encode(tscCommand);

      // await printPCX(pcxUint8,pcxFileName)
      addLog(`Data encoded (Total size: ${data.byteLength} bytes). Sending large data...`);
      await sendChunk(data);
      // await sendLargeData(data);
      // await sendLargeData(encoder.encode(pcxUint8));
      // await sendLargeData(encoder.encode(printCommand));
      // addLog('Print command sent successfully.');
    } catch (err) {
      addLog(`Error during print process: ${err.message}`);
      setError(err);
    }
    finally{
      await getPrinterStatus(readChar);
    }
  };

  async function printPCX(pcxUint8, pcxFileName, imageWidthBytes, imageHeightPixels) { // Assuming you have width in bytes and height
    const encoder = new TextEncoder();
  
    // --- PRINTER INITIALIZATION ---
    const initCommand = `
SPEED 2
DENSITY 3
GAP 0,0
DIRECTION 1
CLS
`;
    await sendLargeData(encoder.encode(initCommand));
    addLog('Printer initialized.');
  
    try {
      // --- DOWNLOAD COMMAND WITH DATA ---
  //     const downloadHeader = encoder.encode(`DOWNLOAD "${pcxFileName}",${pcxUint8.length}\r\n`);
  //     const combinedData = new Uint8Array(downloadHeader.byteLength + pcxUint8.length);
  //     combinedData.set(downloadHeader, 0);
  //     combinedData.set(pcxUint8, downloadHeader.byteLength);
  
  //     addLog(`Sending DOWNLOAD command with ${pcxUint8.length} bytes of image data...`);
  //     await sendLargeData(combinedData);
  //     addLog('PCX data downloaded to printer.');
  
  //     // --- PRINT COMMAND ---
  //     const printCommand = `
  // PUTBMP 0,20,"${pcxFileName}"
  // PRINT 1
  // CLS
  // `;
  //     await sendLargeData(encoder.encode(printCommand));
  const tinyBitmapData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
  const tinyFileName = "TEST.BMP";
  const tinyDownloadCommand = new TextEncoder().encode(`DOWNLOAD "<span class="math-inline">{tinyFileName}",</span>{tinyBitmapData.length}\r\n`);
  const combinedTinyData = new Uint8Array(tinyDownloadCommand.byteLength + tinyBitmapData.length);
  combinedTinyData.set(tinyDownloadCommand, 0);
  combinedTinyData.set(tinyBitmapData, tinyDownloadCommand.byteLength);
  const tinyPrintCommand = new TextEncoder().encode(`PUTBMP 20,20,"${tinyFileName}"\r\nPRINT 1\r\nCLS\r\n`);
  await sendLargeData(combinedTinyData);
  await sendLargeData(tinyPrintCommand);
  
      addLog('Print command sent.');
  
    } catch (err) {
      addLog(`Error during print process: ${err.message}`);
      setError(err);
    }
  }

  async function sendLargeData(data) {
    // --- ADJUSTABLE PARAMETERS ---
    const chunkSize = 200; // Reduced chunk size (Try 100, 150, 200, etc.)
    const delayBetweenChunks = 20; // Increased delay in ms (Try 50, 100, 200, etc.)
    // ---------------------------

    let offset = 0;
    const totalChunks = Math.ceil(data.byteLength / chunkSize);
    addLog(`Starting data transmission: ${data.byteLength} bytes in ${totalChunks} chunks of size ${chunkSize}...`);

    while (offset < data.byteLength) {
      const chunk = data.slice(offset, offset + chunkSize);
      const chunkNumber = Math.floor(offset / chunkSize) + 1;
      addLog(`Preparing chunk ${chunkNumber}/${totalChunks} (Bytes ${offset}-${offset + chunk.byteLength})...`);

      try {
        await sendChunk(chunk);
        addLog(`Chunk ${chunkNumber}/${totalChunks} sent.`);
        offset += chunk.byteLength; // Use chunk.byteLength in case it's the last smaller chunk

        if (offset < data.byteLength) {
            if (delayBetweenChunks > 0) {
               addLog(`Waiting ${delayBetweenChunks}ms before next chunk...`);
               await delay(delayBetweenChunks);
            }
        }
      } catch (err) {
          addLog(`Error sending chunk ${chunkNumber}: ${err.message}`);
          // Re-throw the error to stop the printing process
          throw new Error(`Failed to send chunk ${chunkNumber}: ${err.message}`);
      }
    }
    addLog('All chunks transmitted.');
  }

  function decodePrinterStatus(dataView) {
    const uint8Array = new Uint8Array(dataView.buffer);
    console.log('Raw Bytes:', uint8Array);

    // Example decoding (adjust based on printer specifications):
    return {
        operationComplete: uint8Array[0] & 0x01, // Bit indicating completion
        errorOccurred: uint8Array[1] & 0x02, // Bit indicating error
        paperOut: uint8Array[2] & 0x04, // Bit indicating paper status
    };
}

  const getPrinterStatus = async(readChar)=>{
    console.log("Inside GetPrinterstatus");
    const statusValue = await readChar.readValue();
    console.log("statusValue.dataView.buffer", statusValue.buffer)
    console.log(`statusValue.arraybufferdata = ${statusValue.buffer}`);
    // const decodedStatusValue = decodePrinterStatus(statusValue);
    // console.log("Printer DecdedStatus Value Object", decodedStatusValue);
    console.log("Printer Status", statusValue);
    // console.log('Printer Status decoded:', new TextDecoder().decode(statusValue));
  }

  async function sendChunk(dataChunk) {
    if (!characteristic) {
        throw new Error('Characteristic not available');
    }

    const arrayBuffer = dataChunk.buffer; // Get ArrayBuffer from Uint8Array view

    try {
      // Prioritize writeWithResponse for potentially better reliability with large data
      if (characteristic.properties.writeWithoutResponse) {
        addLog(`Sending chunk (size: ${arrayBuffer.byteLength}) using writeValueWithResponse...`);
        await characteristic.writeValueWithoutResponse(arrayBuffer);
        addLog("Chunk sent successfully (with response).");
      }
      // Fallback to writeWithoutResponse if write isn't supported
      else if (characteristic.properties.write) {
        addLog(`Sending chunk (size: ${arrayBuffer.byteLength}) using writeValueWithoutResponse...`);
        await characteristic.writeValueWithResponse(arrayBuffer);
        addLog("Chunk sent successfully (without response).");
      }
      // Should not happen if connectDevice found a writable characteristic, but check anyway
      else {
        throw new Error('Characteristic does not support write or writeWithoutResponse operations');
      }
    } catch (err) {
      addLog(`Error during characteristic write: ${err.message}`);
      // Wrap the error for more context if needed, then re-throw
      throw new Error(`Characteristic write failed: ${err.message}`);
    }
  }

  // Simple delay function
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (selectedDevice) {
        addLog(`Cleaning up connection to ${selectedDevice.name || 'Unknown Device'}`);
        selectedDevice.removeEventListener('gattserverdisconnected', onDisconnected);
        if (selectedDevice.gatt?.connected) {
          addLog('Disconnecting GATT server...');
          selectedDevice.gatt.disconnect();
        }
      }
    };
  }, [selectedDevice]); // Depend only on selectedDevice

  return (
    <div>
      <h1>BLE Printer Test</h1>
      {!isConnected && !isSearching && (
        <button onClick={searchDevices} disabled={isSearching}>Search for Printer</button>
      )}
      {isSearching && <p>Searching for devices...</p>}

      {devices.length > 0 && !isConnected && (
        <div>
          <h3>Available Devices:</h3>
          <ul>
            {devices.map((device) => (
              <li key={device.id}>
                <button onClick={() => connectDevice(device)}>
                  Connect to {device.name || `ID: ${device.id.substring(0,10)}...`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isConnected && characteristic && (
        <div>
          <p style={{ color: 'green' }}>
            Connected to: {selectedDevice?.name || 'Unknown Device'} <br/>
            Characteristic: {characteristic.uuid} <br/>
            (Write: {characteristic.properties.write ? 'Yes' : 'No'}, WriteWithoutResponse: {characteristic.properties.writeWithoutResponse ? 'Yes' : 'No'})
          </p>
          <button onClick={print}>Print Test Label</button>
          {/* <button onClick={getPrinterStatus}>Get Printer Status</button> */}
          <button onClick={() => selectedDevice?.gatt?.disconnect()}>Disconnect</button>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}

      <h3>Print Log:</h3>
      <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px', background: '#f9f9f9' }}>
        {printLog.length === 0 && <p>No logs yet.</p>}
        <ul>
          {printLog.map((log, index) => (
            <li key={index} style={{ fontSize: '0.9em',color:'red' }}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BluetoothPrinter;