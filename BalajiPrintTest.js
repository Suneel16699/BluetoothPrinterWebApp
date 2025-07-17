import React, { useState, useEffect } from "react";
 
const BalajiPrintTest = () => {
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
        optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"], // Replace with your printer's service UUID if known
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
      const gattServer = await device.gatt.connect();
      setServer(gattServer);
      const primaryServices = await gattServer.getPrimaryServices();
      let foundCharacteristic = null;
 
      for (const service of primaryServices) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write && char.properties.writeWithoutResponse) {
            foundCharacteristic = char;
            break;
          }
        }
        if (foundCharacteristic) break;
      }
 
      if (!foundCharacteristic) {
        throw new Error("No writable characteristic found");
      }
 
      setCharacteristic(foundCharacteristic);
      setIsConnected(true);
      device.addEventListener("gattserverdisconnected", onDisconnected);
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
      {!isConnected && !isSearching && (
        <button onClick={searchDevices}>Search Devices</button>
      )}
      {isSearching && <p>Searching...</p>}
      {devices.length > 0 && !isConnected && (
        <ul>
          {devices.map((device) => (
            <li key={device.id}>
              <button onClick={() => connectDevice(device)}>
                {device.name || "Unknown Device"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isConnected && (
        <button onClick={sendFeedCommand}>Send FEED 100 Command</button>
      )}
      {error && <p style={{ color: "red" }}>Error: {error.message}</p>}
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
 
export default BalajiPrintTest;
 
 