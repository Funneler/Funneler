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
            .then(this.storage.getData.bind(this.storage), errHandler)
            .then(this.performReduce.bind(this), errHandler)
            .then(this.storage.getData.bind(this.storage), errHandler)
            .then(this.performSortData.bind(this), errHandler)
            .then(this.storage.getItems.bind(this.storage), errHandler)
            .then(this.performSort.bind(this), errHandler)
            .then(this.performSlice.bind(this), errHandler)
            .then(this.performData.bind(this), errHandler)
            .then(this.storage.getItems.bind(this.storage), errHandler)
            .then(this.performBatchData.bind(this), errHandler)
            .then(this.storage.getSortedItems.bind(this.storage), errHandler)
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

    emit(id) {
        this.storage.add(id);
        return this;
    }

    performMap() {
        this.promises = [];

        for (let ins of this.activated) {
            // does this instruction perform any mapping?
            if (typeof ins.instruction['$map'] !== 'function') {
                continue;
            }

            let result = ins.instruction['$map'].apply(this, []);

            if (this.isPromise(result)) {
                this.promises.push(result);
            }
        }

        return Promise.all(this.promises);
    }

    performReduce(data) {
        return this.performSingleOrBatch('$reduce', data);
    }

    performSortData(data) {
        return this.performSingleOrBatch('$sortData', data);
    }

    performSort(items) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction['$sort'] === 'undefined') {
                continue;
            }

            items.sort(ins.instruction['$sort']);
            items.forEach((item, index) => item.order = index);

            let result = this.storage.setData(items);

            this.promises.push(result);
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

            let result = ins.instruction['$slice'].apply(this);

            if (this.isPromise(result)) {
                this.promises.push(result);
            }
        }

        return Promise.all(this.promises);
    }

    performData(items) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction['$data'] === 'undefined') {
                continue;
            }

            for (let item of items) {
                let result = ins.instruction['$data'].apply(this, [item._id]);

                if (this.isPromise(result)) {
                    this.promises.push(result);
                }
            }
        }

        return Promise.all(this.promises);
    }

    performBatchData(items) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction['$batchData'] === 'undefined') {
                continue;
            }

            if (typeof ins.instruction['$batchData'] !== 'object' ||
                ins.instruction['$batchData'].length != 2 ||
                typeof ins.instruction['$batchData'][0] !== 'number' ||
                typeof ins.instruction['$batchData'][1] !== 'function') {
                this.log.push(this.errors.invalidBatchData);
                continue;
            }

            if (typeof ins.batchData === 'undefined') {
                ins.batchData = {};
            }

            for (let item of items) {
                ins.batchData[item._id] = true;

                if (Object.keys(ins.batchData).length >= ins.instruction['$batchData'][0]) {
                    this.onPerformBatchData(ins);
                }
            }

            if (Object.keys(ins.batchData).length) {
                this.onPerformBatchData(ins);
            }
        }

        return Promise.all(this.promises);
    }

    onPerformBatchData(ins) {
        let ids = Object.keys(ins.batchData);
        ins.batchData = {};

        let result = ins.instruction['$batchData'][1].apply(this, [ids]);

        if (this.isPromise(result)) {
            this.promises.push(result);
        }
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

    setConfig(name, value) {
        this.config[name] = value;
        return this;
    }

    getAllConfig() {
        return this.config;
    }
}
