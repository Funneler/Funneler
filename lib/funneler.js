'use strict';

var _ = require('underscore'),
    FunnelerStorageMemory = require('./storage/memory.js');

module.exports = class Funneler {
    constructor(instructions) {
        this.instructions   = instructions || [];
        this.config         = {};
        this.log            = [];
        this.activated      = [];
        this.promises       = [];

        this.errors = {
            invalidMap: 'Invalid value for $map, expecting a function',
            invalidInstruction: 'Each instruction must be a mutable object',
            invalidInstructions: 'Constructor expects an array of instructions, received an invalid or empty payload',
            invalidBatchData: '%item% property expects an array of 2 items (size, callback): [ batchSize, function() { ... } ]',
            tooManySlices: '$slice found multiple times, you can only slice the data one time',
            invalidSlice: 'Invalid $slice, expects a function that returns a two part offset/limit numerical array'
        };
    }

    addInstruction(instruction) {
        this.instructions.push(instruction);
    }

    exec() {
        return new Promise((resolve, reject) => {
            let errHandler = (err) => {
                if (typeof err !== 'undefined') {
                    this.log.push(err); 
                }
                reject(this.log);
            };

            if (typeof this.instructions != 'object' || !this.instructions.length) {
                return errHandler(this.errors.invalidInstructions);
            }

            this.storage = this.getConfig('storage', new FunnelerStorageMemory());

            // build the activated array and instantiate the reporting indexes
            for (let instruction of this.instructions) {
                if (false === this.activate(instruction)) {
                    return reject(this.log);
                }
            }

            if (!this.activated.length) {
                return resolve([]);
            }

            this.performMap()
            .then(() => this.storage.items.apply(this.storage, []), errHandler)
            .then(this.performReduce.bind(this), errHandler)
            .then(() => this.storage.items.apply(this.storage, []), errHandler)
            .then(this.performSortData.bind(this), errHandler)
            .then(() => this.storage.items.apply(this.storage, []), errHandler)
            .then(this.performSort.bind(this), errHandler)
            .then(this.performSlice.bind(this), errHandler)
            .then(() => this.storage.items.apply(this.storage, []), errHandler)
            .then(this.performData.bind(this), errHandler)
            .then(() => this.storage.sorted.apply(this.storage, []), errHandler)
            .then(items => {
                if (this.log.length) {
                    return errHandler();
                }
                resolve(items);
            }, errHandler)
            .catch(errHandler);
        });
    }

    getStorage() {
        return this.storage;
    }

    activate(instruction) {
        if (typeof instruction !== 'object') {
            this.log.push(this.errors.invalidInstruction);
            return false;
        }

        for (let index in instruction) {
            let value = instruction[index];

            if (index[0] != '$') {
                this.setConfig(index, value);
                delete instruction[index];
            }
        }

        if (!Object.keys(instruction).length) {
            return null;
        }

        let ins = { instruction };

        this.activated.push(ins);
        ins.index = (this.activated.length - 1);

        return ins;
    }

    isPromise(what) {
        return what && typeof what === 'object' && typeof what.then === 'function';
    }

    performSingleOrBatch(cmd, data) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction[cmd] === 'undefined') {
                continue;
            }

            let batch = [], batchSize, cb;

            if (typeof ins.instruction[cmd] == 'function') {
                batchSize = 1;
                cb = (items) => {
                    let result = ins.instruction[cmd].apply(this, [ items[0] ]);
                    if (this.isPromise(result)) {
                        this.promises.push(result);
                    }
                };

            } else {
                if (typeof ins.instruction[cmd] !== 'object' ||
                    ins.instruction[cmd].length != 2 ||
                    typeof ins.instruction[cmd][0] !== 'number' ||
                    typeof ins.instruction[cmd][1] !== 'function') {
                    this.log.push(this.errors.invalidBatchData.replace('%item%', cmd));
                    continue;
                }

                batchSize = ins.instruction[cmd][0];
                cb = ins.instruction[cmd][1];
            }

            for (let index in data) {
                var item = data[index];

                batch.push(item._id);

                if (batch.length >= batchSize) {
                    let result = cb.apply(this, [ batch ]);
                    if (this.isPromise(result)) {
                        this.promises.push(result);
                    }
                    batch = [];
                }
            }

            if (batch.length) {
                let result = cb.apply(this, [ batch ]);
                if (this.isPromise(result)) {
                    this.promises.push(result);
                }
            }
        }

        return Promise.all(this.promises);
    }

    performMap() {
        this.promises = [];

        for (let ins of this.activated) {
            // does this instruction perform any mapping?
            if (typeof ins.instruction['$map'] === 'undefined') {
                continue;
            }

            if (typeof ins.instruction['$map'] !== 'function') {
                this.promises.push(new Promise((resolve, reject) => reject(this.errors.invalidMap)));
                break;
            }

            let result = ins.instruction['$map'].apply(this, []);

            if (this.isPromise(result)) {
                this.promises.push(result);
            }
        }

        return Promise.all(this.promises);
    }

    performReduce(items) {
        return this.performSingleOrBatch('$reduce', items);
    }

    performSortData(items) {
        return this.performSingleOrBatch('$sortData', items);
    }

    performSort(items) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction['$sort'] === 'undefined') {
                continue;
            }

            items.sort(ins.instruction['$sort']);
            items.forEach((item, index) => item._order = index);

            this.promises.push(this.storage.items.apply(this.storage, [items]));
        }

        return Promise.all(this.promises);
    }

    performSlice() {
        this.promises = [];
        let slices = 0;

        for (let ins of this.activated) {
            if (typeof ins.instruction['$slice'] === 'undefined') {
                continue;
            }

            if (typeof ins.instruction['$slice'] !== 'function') {
                this.promises.push(new Promise((resolve, reject) => reject(this.errors.invalidSlice)));
                break;
            }

            if (++slices > 1) {
                this.promises.push(new Promise((resolve, reject) => reject(this.errors.tooManySlices)));
                break;
            }

            ins.instruction['$slice'].apply(this);
        }

        return Promise.all(this.promises);
    }

    performData(items) {
        return this.performSingleOrBatch('$data', items);
    }

    getConfig(name, defaultValue) {
        if (typeof this.config[name] === 'undefined') {
            if (typeof defaultValue !== 'undefined') {
                return (this.config[name] = defaultValue);
            }

            return null;
        }

        return this.config[name];
    }

    emit(id) {
        this.promises.push(this.storage.emit.apply(this.storage, [id]));
        return this;
    }

    reduce(id) {
        this.promises.push(this.storage.reduce.apply(this.storage, [id]));
        return this;
    }

    slice(offset, limit) {
        this.promises.push(this.storage.slice.apply(this.storage, [offset, limit]));
        return this;
    }

    data(item, itemOrIndex, dataOrEmpty) {
        this.promises.push(this.storage.data.apply(this.storage, [item, itemOrIndex, dataOrEmpty]));
        return this;
    }

    setConfig(name, value) {
        this.config[name] = value;
        return this;
    }

    getAllConfig() {
        return this.config;
    }
}
