'use strict';

var _ = require('underscore'),
    FunnelerStorageMemory = require('./storage/memory.js');

module.exports = class Funneler {
    constructor(instructions) {
        this.instructions   = instructions;
        this.config         = {};
        this.log            = [];
        this.activated      = [];
        this.promises       = [];

        this.errors = {
            invalidInstruction: 'Each instruction must be a mutable object',
            invalidInstructions: 'Constructor expects an array of instructions, received an invalid or empty payload',
            invalidBatchReduce: '$batchReduce property expects an array of 2 items (size, callback): [ batchSize, function() { ... } ]',
            invalidBatchData: '$batchData property expects an array of 2 items (size, callback): [ batchSize, function() { ... } ]',
            invalidSortData: '$sortData property expects an array of 2 items (size, callback): [ batchSize, function() { ... } ]',
            tooManySlices: '$slice found multiple times, you can only slice the data one time',
            invalidSlice: 'Invalid $slice, expects a function that returns a two part offset/limit numerical array'
        };
    }

    exec() {
        return new Promise((resolve, reject) => {
            let errHandler = (err) => {
                this.log.push(err);
                reject(this.log);
            };

            if (typeof this.instructions != 'object' || !this.instructions.length) {
                return errHandler(this.errors.invalidInstructions);
            }

            this.storage = this.getConfig('storage', new FunnelerStorageMemory());

            // build the activated array and instantiate the reporting indexes
            let numSlices = 0;
            for (let instruction of this.instructions) {
                if (false === this.activate(instruction)) {
                    return reject(this.log);
                }

                if (typeof instruction['$slice'] !== 'undefined') {
                    if (++numSlices > 1) {
                        return errHandler(this.errors.tooManySlices);
                    }
                }
            }

            if (!this.activated.length) {
                return resolve([]);
            }

            this.performMap()
            .then(this.flushBatchReducers.bind(this), errHandler)
            .then(this.storage.getData.bind(this.storage), errHandler)
            .then(this.performSortData.bind(this), errHandler)
            .then(this.storage.getItems.bind(this.storage), errHandler)
            .then(this.performSort.bind(this), errHandler)
            .then(this.performSlice.bind(this), errHandler)
            .then(this.performData.bind(this), errHandler)
            .then(this.storage.getItems.bind(this.storage), errHandler)
            .then(this.performBatchData.bind(this), errHandler)
            .then(this.storage.getSortedItems.bind(this.storage), errHandler)
            .then(resolve, errHandler)
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

    emit(id) {
        this.storage.add(id);
        this.performReduce(id);
        this.performBatchReduce(id);
        return this;
    }

    flushBatchReducers() {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.batchReductions == 'object' &&
                ins.batchReductions.length > 0) {
                this.onBatchReduce(ins);
            }
        }

        return Promise.all(this.promises);
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

    performReduce(id) {
        for (let ins of this.activated) {
            // does this instruction do any reducing?
            if (typeof ins.instruction['$reduce'] !== 'function') {
                continue;
            }

            let result = ins.instruction['$reduce'].apply(this, [id]);

            if (this.isPromise(result)) {
                this.promises.push(result);
            }
        }
    }

    performBatchReduce(id) {
        for (let ins of this.activated) {
            if (typeof ins.instruction['$batchReduce'] === 'undefined') {
                continue;
            }

            if (typeof ins.instruction['$batchReduce'] !== 'object' ||
                ins.instruction['$batchReduce'].length != 2 || 
                typeof ins.instruction['$batchReduce'][0] != 'number' ||
                typeof ins.instruction['$batchReduce'][1] != 'function') {
                this.log.push(this.errors.invalidBatchReduce);
                continue;
            }

            if (typeof ins.batchReductions === 'undefined') {
                ins.batchReductions = {};
            }

            ins.batchReductions[id] = true;

            if (Object.keys(ins.batchReductions).length >= ins.instruction['$batchReduce'][0]) {
                this.onBatchReduce(ins);
                continue;
            }
        }
    }

    onBatchReduce(ins) {
        let ids = Object.keys(ins.batchReductions);
        ins.batchReductions = {};

        let result = ins.instruction['$batchReduce'][1].apply(this, [ ids ]);

        if (this.isPromise(result)) {
            this.promises.push(result);
        }
    }

    performSortData(data) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction['$sortData'] === 'undefined') {
                continue;
            }

            if (typeof ins.instruction['$sortData'] !== 'object' ||
                ins.instruction['$sortData'].length != 2 ||
                typeof ins.instruction['$sortData'][0] !== 'number' ||
                typeof ins.instruction['$sortData'][1] !== 'function') {
                this.log.push(this.errors.invalidSortData);
                continue;
            }

            let batchSize = ins.instruction['$sortData'][0], batch = [];

            for (let index in data) {
                var item = data[index];

                batch.push(item);
                if (batch.length >= batchSize) {
                    this.onPerformSortData(ins, batch);
                    batch = [];
                }
            }

            if (batch.length) {
                this.onPerformSortData(ins, batch);
            }
        }

        return Promise.all(this.promises);
    }

    onPerformSortData(ins, items) {
        let cb = ins.instruction['$sortData'][1],
            result = cb.apply(this, [items]);

        if (this.isPromise(result)) {
            this.promises.push(result);
        }
    }

    performSort(items) {
        this.promises = [];

        for (let ins of this.activated) {
            if (typeof ins.instruction['$sort'] !== 'function') {
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
        for (let ins of this.activated) {
            if (typeof ins.instruction['$slice'] === 'undefined') {
                continue;
            }

            if (typeof ins.instruction['$slice'] !== 'function') {
                return new Promise((resolve, reject) => reject(this.errors.invalidSlice));
            }

            let result = ins.instruction['$slice'].apply(this);

            return result;
        }
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
