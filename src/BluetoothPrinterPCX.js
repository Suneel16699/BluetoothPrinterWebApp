
import React, { useState, useEffect } from 'react';
 
const BluetoothPrinterPCX = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [server, setServer] = useState(null);
  const [characteristic, setCharacteristic] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [printLog, setPrintLog] = useState([]);
 
  const searchDevices = async () => {
    setIsSearching(true);
    try {
      const foundDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'],
      });
      setDevices([foundDevice]);
    } catch (err) {
      setError(err);
    } finally {
      setIsSearching(false);
    }
  };
 
    const connectDevice = async (device) => {
    setSelectedDevice(device);
    try {
      const server = await device.gatt.connect();
      setServer(server);
      const services = await server.getPrimaryServices();
      let foundCharacteristic = null;
 
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write && char.properties.writeWithoutResponse) {
            foundCharacteristic = char;
            // print(char);
            break;
          }
        }
        // foundCharacteristic = characteristics;
        if (foundCharacteristic) break;
      }
 
      if (!foundCharacteristic) {
        throw new Error('No writable characteristic found');
      }
 
      setCharacteristic(foundCharacteristic);
      setIsConnected(true);
      device.addEventListener('gattserverdisconnected', onDisconnected);
    } catch (err) {
      setError(err);
      setIsConnected(false);
    }
  };
 
  const onDisconnected = () => {
    setSelectedDevice(null);
    setServer(null);
    setCharacteristic(null);
    setIsConnected(false);
  };
 
 
  const print = async () => {
    if (!characteristic) {
      setError(new Error('Characteristic not found'));
      return;
    }
    console.log("Characteristic ", characteristic.uuid.toString());
 
let tscCommand2 = `
DIRECTION 1
CLS
TEXT 1300,40,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Se. "
TEXT 1340,40,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Se."
TEXT 1390,40,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Se."
TEXT 1490,40,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Se."
TEXT 1440,40,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Se."
TEXT 1400,40,"3",90,1,1,"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Se."
PRINT 1
`;
let tscCommand = `
CLS
TEXT 10,140,"RobotoB.TTF",0,14,14,"Roboto Bold 14pt"
TEXT 10,210,"RobotoM.TTF",0,14,14,"Roboto Medium 14pt"
PRINT 1
`
 
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(tscCommand);
      await sendChunk(data);
    } catch (err) {
      setError(err);
    }
  };

  async function sendChunk(data) {
    try {
      const arrayBuffer = data.buffer;
      console.log("Array Buffer: ", arrayBuffer);
      console.log("data: ", data);
      if (characteristic.properties.writeWithoutResponse) {
        return characteristic.writeValueWithoutResponse(arrayBuffer);
      } else if (characteristic.properties.write) {
        return characteristic.writeValueWithResponse(arrayBuffer);
      } else {
        throw new Error('Characteristic does not support write operations');
      }
    }catch(err) {
      console.error("Error on printing: ", err);
    }
  }

  const sendFeedCommand = async () => {
    if (!characteristic) {
      setError(new Error("Characteristic not found"));
      return;
    }
 
    const feedCommand = "FEED 100\r\n";
    const encoder = new TextEncoder();
    const data = encoder.encode(feedCommand);
 
    try {
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(data);
        setPrintLog((prevLog) => [...prevLog, `Sent: ${feedCommand.trim()}`]);
      } else if (characteristic.properties.write) {
        await characteristic.writeValueWithResponse(data);
        setPrintLog((prevLog) => [
          ...prevLog,
          `Sent (with response): ${feedCommand.trim()}`,
        ]);
      } else {
        throw new Error("Characteristic does not support write operations");
      }
    } catch (err) {
      setError(err);
    }
  };
 
  useEffect(() => {
    return () => {
      if (selectedDevice && selectedDevice.gatt.connected) {
        selectedDevice.gatt.disconnect();
      }
    };
  }, [selectedDevice]);
 
  return (
<div>
      {!isConnected && !isSearching && <button onClick={searchDevices}>Search Devices</button>}
      {isSearching && <p>Searching...</p>}
      {devices.length > 0 && !isConnected && (
<ul>
          {devices.map((device) => (
<li key={device.id}>
<button onClick={() => connectDevice(device)}>{device.name || 'Unknown Device'}</button>
</li>
          ))}
</ul>
      )}
      {isConnected && <button onClick={print}>Print MultiLine Text</button>}
      {isConnected && (
        <button onClick={sendFeedCommand}>Send FEED 100 Command</button>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      {printLog.length > 0 && (
<ul>
          {printLog.map((log, idx) => (
<li key={idx}>{log}</li>
          ))}
</ul>
      )}
</div>
  );
};
 
export default BluetoothPrinterPCX;