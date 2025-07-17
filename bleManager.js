class Uint8ArrayCollector {
	constructor() {
		this.chunks = [];
	}

	add(chunk) {
		if (!(chunk instanceof Uint8Array)) throw new TypeError("Only Uint8Array allowed");
		this.chunks.push(chunk);
	}

	assemble() {
		const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of this.chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		return result;
	}

	reset() {
		this.chunks = [];
	}
}

class BLECommandManager {
	constructor(timeoutMs = 1000) {
		this.currentResolve = null;
		this.collector = new Uint8ArrayCollector();
		this.timeout = null;
		this.timeoutMs = timeoutMs;
	}

	async send(writeFn, data) {
		if (this.currentResolve) {
			throw new Error("A command is already in progress.");
		}

		const chunkSize = 512;
		const totalChunks = Math.ceil(data.byteLength / chunkSize);

		return new Promise(async (resolve, reject) => {
			this.currentResolve = resolve;

			try {
				for (let i = 0; i < totalChunks; i++) {
					const start = i * chunkSize;
					const end = Math.min(start + chunkSize, data.byteLength);
					const chunk = data.slice(start, end);
					await writeFn(chunk);
				}
			} catch (e) {
				this.currentResolve = null;
				reject(new Error("Write failed: " + e.message));
				return;
			}

			this.timeout = setTimeout(() => {
				this.currentResolve = null;
				this.collector.reset();
				reject(new Error("Response timeout"));
			}, this.timeoutMs);
		});
	}

	receive(chunk) {
		this.collector.add(chunk);
		clearTimeout(this.timeout);

		this.timeout = setTimeout(() => {
			const full = this.collector.assemble();
			this.collector.reset();
			if (this.currentResolve) {
				this.currentResolve(full);
				this.currentResolve = null;
			}
		}, 1000);
	}

	cancel() {
		clearTimeout(this.timeout);
		this.currentResolve = null;
		this.collector.reset();
	}
}

export class BLEManager {
	constructor(logCallback) {
		this.serviceUUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
		this.rxUUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';
		this.txUUID = '49535343-1e4d-4bd9-ba61-23c647249616';

		this.device = null;
		this.server = null;
		this.rxCharacteristic = null;
		this.txCharacteristic = null;

		this.logCallback = logCallback || console.log;
		this.onReceive = null;

		this.cmdManager = new BLECommandManager();
	}

	log(message) {
		const timestamp = new Date().toLocaleTimeString('en-US', {
			hour12: false
		});
		this.logCallback(`${timestamp}: ${message}`);
	}

	async requestDevice() {
		this.log('Searching for devices...');
		try {
			this.device = await navigator.bluetooth.requestDevice({
				acceptAllDevices: true,
				optionalServices: [this.serviceUUID]
			});
			this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
			this.log(`Device found: ${this.device.name}`);
			return this.device;
		} catch (err) {
			this.log('Device discovery failed.');
			throw err;
		}
	}

	async connect() {
		if (!this.device) throw new Error('Please call requestDevice() first.');

		this.log(`Connecting to ${this.device.name}...`);
		this.server = await this.device.gatt.connect();
		this.log('Connected to GATT server.');

		this.log(`Getting primary service: ${this.serviceUUID}`);
		const service = await this.server.getPrimaryService(this.serviceUUID);
		this.log('Service found.');

		this.log('Getting characteristics...');
		const characteristics = await service.getCharacteristics();
		this.log(`Found ${characteristics.length} characteristics. Searching for writable...`);

		for (const char of characteristics) {
			const props = char.properties;
			const charUuid = char.uuid.toLowerCase();
			const rxUuid = this.rxUUID.toLowerCase();
			const txUuid = this.txUUID.toLowerCase();
			if (charUuid === rxUuid && (props.write || props.writeWithoutResponse)) {
				this.rxCharacteristic = char;
			}
			if (charUuid === txUuid) {
				this.txCharacteristic = char;
			}
		}

		if (!this.rxCharacteristic) throw new Error('No writable characteristic found.');

		this.log(`Successfully connected and found RX: ${this.rxCharacteristic.uuid}`);

		if (this.txCharacteristic) {
			await this.txCharacteristic.startNotifications();
			this.txCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
				const chunk = new Uint8Array(event.target.value.buffer);
				const isCommandWaiting = !!this.cmdManager.currentResolve;

				this.cmdManager.receive(chunk);

				if (!isCommandWaiting && this.onReceive) {
					const text = new TextDecoder().decode(chunk);
					this.onReceive(text);
				}
			});
			this.log('TX notifications enabled.');
		}
	}

	disconnect() {
		if (this.device?.gatt?.connected) {
			this.device.gatt.disconnect();
			this.log('Disconnected from device.');
		}
		this.cmdManager.cancel();
	}

	onDisconnected() {
		this.log('Device has been disconnected.');
		this.cmdManager.cancel();
	}

	async writeUtf8String(data) {
		const encoder = new TextEncoder();
		const bytes = encoder.encode(data);
		await this.writeBinary(bytes);
	}

	async writeBinary(bytes) {
		if (!this.rxCharacteristic) throw new Error('RX characteristic not initialized.');

		this.log(`Preparing binary data (Size: ${bytes.byteLength} bytes)...`);
		const chunkSize = 512;
		const totalChunks = Math.ceil(bytes.byteLength / chunkSize);
		this.log(`Starting binary transmission: ${bytes.byteLength} bytes in ${totalChunks} chunks...`);

		for (let i = 0; i < totalChunks; i++) {
			const start = i * chunkSize;
			const end = Math.min(start + chunkSize, bytes.byteLength);
			const chunk = bytes.slice(start, end);

			this.log(`Sending chunk ${i + 1}/${totalChunks}...`);
			await this.rxCharacteristic.writeValueWithResponse(chunk);
		}

		this.log('All chunks sent.');
	}

	async writeUtf8StringWithResponse(data) {
		const encoder = new TextEncoder();
		const bytes = encoder.encode(data);
		return await this.cmdManager.send(
			(chunk) => this.rxCharacteristic.writeValueWithResponse(chunk),
			bytes
		);
	}

	async writeBinaryWithResponse(bytes) {
		return await this.cmdManager.send(
			(chunk) => this.rxCharacteristic.writeValueWithResponse(chunk),
			bytes
		);
	}

	setReceiveCallback(callback) {
		this.onReceive = callback;
	}
}