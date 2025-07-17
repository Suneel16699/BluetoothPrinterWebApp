import React, { useState, useEffect } from 'react';
import {connectPrinter, sendTextCommand, sendPrintCommand, sendCommand, writePCXfileToPrinter, sendSETCommand, clearBuffer} from 'react-alpha-2r-printer-actions';

const Librarytest = () => {
  const [deviceConnected , setDeviceConnected] = useState(false);
  const connectToPrinter = async () => {
    try{
      await connectPrinter();
      setDeviceConnected(true);
    }catch(exp){
      console.error("Exception while connecting ",exp);
      setDeviceConnected(false);
    }
  };
 
 
  const printLabel = async () => {

    const tscCommand = `
DIRECTION 1
CLS
TEXT 1320, 40, "3", 90, 1, 1,  "www.newport-pleasure.com      www.vusevapor.com           www.mygrizzly.com"
PRINT 1
`
    // await sendCommand(tscCommand);
    await sendCommand("DIRECTION 1");
    await sendCommand("CLS");
    await sendTextCommand(1320, 40, "3", 90, 1, 1,  "www.newport-pleasure.com      www.vusevapor.com           www.mygrizzly.com");
    await sendPrintCommand(1,1);

  };

  const printPCXImage = async()=>{
    try{
      await sendCommand("SIZE 1.89,6.875");
      await clearBuffer();
      await sendCommand("DIRECTION 1");
      await sendSETCommand("REPRINT","ON");
      await sendSETCommand("PRINTQUALITY", "OPTIMUM");
      await sendSETCommand("SLEEPTIME", "OFF");
      await writePCXfileToPrinter("153100.pcx");
      await sendPrintCommand(1,1);
      await clearBuffer();
      await sendCommand("KILL F, \"*\"\n");
    }catch(e){
      console.error("Error while printing pcx file:" ,e);
    }
  }
 
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

        disabled={!deviceConnected}
>

        Print Label
</button>
<button

onClick={printPCXImage}

className="px-4 py-2 bg-green-600 text-white rounded"

disabled={!deviceConnected}
>

Print PCX file
</button>
<br></br>
<br></br>
{deviceConnected && <div>connected Successfully</div>}
</div>

  );

};
 
export default Librarytest;

 