if (typeof global.File === 'undefined') {
    const { Blob } = require('buffer');

    global.File = class File extends Blob {
        constructor(parts, name, options = {}) {
            super(parts, options);
            this.name = String(name);
            this.lastModified = options.lastModified ?? Date.now();
        }
    };
}
