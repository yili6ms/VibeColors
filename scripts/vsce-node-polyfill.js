const { Blob } = require('buffer');

if (typeof globalThis.File === 'undefined') {
	/**
	 * Minimal File implementation to satisfy VSCE's undici dependency when Node.js
	 * doesn't provide a native File class (Node < 20). Keeps API surface tiny but
	 * compatible with what vsce needs to bundle extensions.
	 */
	class File extends Blob {
		constructor(fileBits, fileName, options = {}) {
			super(fileBits, options);
			if (arguments.length < 2) {
				throw new TypeError("Failed to construct 'File': 2 arguments required.");
			}
			this.name = String(fileName);
			this.lastModified = options.lastModified ?? Date.now();
		}
	}

	Object.defineProperties(File.prototype, {
		name: { enumerable: true },
		lastModified: { enumerable: true },
		[Symbol.toStringTag]: { value: 'File', configurable: true }
	});

	globalThis.File = File;
}
