import React, { useState } from 'react';
 
const TSCBluetoothPrinter = () => {

  const [device, setDevice] = useState(null);

  const [characteristic, setCharacteristic] = useState(null);
 
  const serviceUUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455'; // TSC printers often use this
 
  const connectToPrinter = async () => {

    try {

      const device = await navigator.bluetooth.requestDevice({

        filters: [{ namePrefix: 'A2R' }],

        optionalServices: [serviceUUID],

      });
 
      const server = await device.gatt?.connect();

      const service = await server?.getPrimaryService(serviceUUID);

      const characteristics = await service.getCharacteristics();
      let foundCharacteristic = null;

      console.log(`Found ${characteristics.length} characteristics. Searching for writable...`);
      for (const char of characteristics) {
        // Prioritize characteristics that support write operations (with or without response)
         if (char.properties.write && char.properties.writeWithoutResponse) {
           console.log(`Found writable characteristic: ${char.uuid} (Write: ${char.properties.write}, WriteWithoutResponse: ${char.properties.writeWithoutResponse})`);
           foundCharacteristic = char;
           if(char.uuid.toString().slice(-3) === "bb3"){
            break;
           }
           // Prefer writeWithResponse if available, but take either for now
          //  break;
         }
      }
 
      if (foundCharacteristic) {

        setDevice(device);

        setCharacteristic(foundCharacteristic);

        alert('Printer connected');

      }

    } catch (error) {

      console.error('Connection failed:', error);

    }

  };
 
  const sendCommand = async (command) => {

    if (!characteristic) return console.error('No characteristic available');
 
    const encoder = new TextEncoder();

    const data = encoder.encode(command);

    const chunkSize = 180; // Safe MTU size for iOS
 
    for (let i = 0; i < data.length; i += chunkSize) {

      const chunk = data.slice(i, i + chunkSize);

      try {

        await characteristic.writeValue(chunk);

      } catch (err) {

        console.error('Failed to send chunk:', err);

      }

    }

  };
 
  const printLabel = async () => {

    const tscCommand = `
DIRECTION 1

CLS

TEXT 100,50,"0",90,1,1,"Hello from TSC!"

TEXT 100,100,"0",90,1,1,"Second Line"

TEXT 100,150,"0",90,1,1,"Third Line"

PRINT 1,1

`;
 
    await sendCommand(tscCommand);

  };
 
  return (
<div className="p-4 space-y-4">
<button

        onClick={connectToPrinter}

        className="px-4 py-2 bg-blue-600 text-white rounded"
>

        Connect to Printer
</button>
 
      <button

        onClick={printLabel}

        className="px-4 py-2 bg-green-600 text-white rounded"

        disabled={!characteristic}
>

        Print Label
</button>
</div>

  );

};
 
export default TSCBluetoothPrinter;

 