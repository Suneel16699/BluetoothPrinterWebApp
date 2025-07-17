import React, { useState } from "react";
import "./App.css" ;
import BluetoothPrinterPCX from "./BluetoothPrinterPCX";
import BalajiprintTest from "./BalajiPrintTest";
import BluetoothPrinter from "./BluetoothPrinter";
import TSCBluetoothPrinter from "./TSCBluetoothPrinter";
import Librarytest from "./Librarytest";

function App() {
  const [device, setDevice] = useState(null);
  const [server, setServer] = useState(null);
  const [service, setService] = useState(null);
  const [isPrintable, setIsPrintable] = useState(null);
  const [characteristic , setCharacteristic] = useState(null);
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState("");

  async function GetUUIDs() {
    try {
      const services = await server.getPrimaryServices();
      // Iterate through services to log their UUIDs
      for (const service of services) {
        console.log("Service details:", service, ": ", service);
        // Get characteristics of each service
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
          console.log(
            "Characteristic UUID: ",
            characteristic.uuid
          );
          console.log(`Properties:`, characteristic.properties);
          let charactProperties = characteristic.properties;
        }
      }
    } catch (error) {
      console.error("Error connecting to printer or retrieving UUIDs:", error);
    }
  }

  async function sendData(data){
    const block = 100;
    for(let i= 0;i< data.length ; i+=block){
      await characteristic.writeValueWithoutResponse(data.slice(i,i+block));
    }
  }

  async function sendText(text){
    let enc = new TextEncoder();
    let bytes = new Uint8Array(5);
    bytes[0] = 0x10; bytes[1] = 0xff;
    bytes[2] = 0xfe; bytes[3] = 0x01;
    bytes[4] = 99;
    await sendData(bytes);
    await sendData(enc.encode(text));
    // await characteristic.writeValueWithoutResponse(enc.encode("Hello World\n"));
  }

  const handleConnect = async () => {
    try {
      setError(null); // Reset error state
      let options = {
        filters: [
          {namePrefix : "A2R"}
        ],
        optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"],
      };
      const result = await navigator.bluetooth.requestDevice(options);
      console.log("Result :: ", result);
      const device = result;
      setDevice(device);
      setDeviceName(device.name);
      console.log("Connected to device:", device);

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("49535343-fe7d-4ae5-8fa9-9fafd205e455");
      setServer(server);
      // const characteristic = await service.getCharacteristic("49535343-8841-43f4-a8d4-ecbe34729bb3");
      setService(service);
      // setCharacteristic(characteristic);
      console.log("Connected to GATT server:", server);
      GetUUIDs();
    } catch (error) {
      setError("Failed to connect to device. Please try again.");
      console.error("Error connecting to device:", error);
    }
  };

  const handleShowDeviceName = () => {
    if (device?.gatt?.connected) {
      setConnectedDeviceName(device.name);
    } else {
      setConnectedDeviceName("No device connected at device level");
    }
  };

  const connectToPrinter = async () => {
    try {
      // const services = await server.getPrimaryService("49535343-fe7d-4ae5-8fa9-9fafd205e455"); 
      // for (const service of services) {
      //   // Get characteristics of each service
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
          if(characteristic.properties.write && characteristic.properties.writeWithoutResponse){
            setCharacteristic(characteristic);
            break;
          }
        }
        if(characteristic){
          printTestPaper();
        }
      // }
      console.log('Connected to printer!');
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  const printTestPaper = async () => {

    if (!characteristic) {
      setError(new Error('Characteristic not found'));
      return;
    }
 
    try {
      // TSC TSPL/TSPL2 commands (adjust to your needs!)
      const tscCommands = `
SIZE 100 mm, 105 mm\r\n
GAP 3 mm, 0 mm\r\n
DIRECTION 1\r\n
CLS\r\n
TEXT 10,10,"3",0,1,1,"Hello TSC Printer!"\r\n
BARCODE 10,50,"128",100,1,0,2,2,"123456"\r\n
TEXT 10,70,"3",0,1,1,${characteristic}\r\n
PRINT 1,1\r\n
`;
 
      const encoder = new TextEncoder();
      const data = encoder.encode(tscCommands);
      console.log("Data from encoder :: ", data);
 
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(data);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("Success : print data", characteristic);
        // setPrintLog((prevLog) => [...prevLog, 'Data sent to TSC Printer (without response): ' + tscCommands]);
      } else if (characteristic.properties.write) {
        await characteristic.writeValueWithResponse(data);
        console.log("Success : print data 22", characteristic);
        // setPrintLog((prevLog) => [...prevLog, 'Data sent to TSC Printer (with response): ' + tscCommands]);
      } else {
        throw new Error('Characteristic does not support write operations');
      }
    } catch (err) {
      console.error("WriteValue Error:: ", err);
    }
  };

  const formatCPCLTestPaper = () => {
    const escposData = "TEXT 1320, 40, \"3\", 90, 1, 1,  \"Testing Printer Functionality\"\n";
    const dummdata = "Hello World!!\r"
    const encoder = new TextEncoder();
    return encoder.encode(dummdata);
  };
  return (
    <div className="App">
      <header className="App-header">
        <h1>Bluetooth Print Demo</h1>
        {/* <button onClick={handleConnect}>Connect to Printer</button> 
        {device && <p>Connected to Bluetooth Device</p>}
        {error && <p className="error">{error}</p>}
        <button onClick={handleShowDeviceName}>
          Show Connected Device Name
        </button>
        {connectedDeviceName && <p>{connectedDeviceName}</p>}
        <button onClick={connectToPrinter}>Print Test Paper</button> */}
        {/* <TSCBluetoothPrinter/> */}
        {/* <BluetoothPrinterPCX/> */}
        {/* <BalajiprintTest/> */}
        {/* <BluetoothPrinter/> */}
        <Librarytest/>
      </header>
    </div>
  );
}

export default App;
