'use strict';

module.exports = class FunnelerStorageMemory {
    constructor() {
        this.storage = {};
        this.errors = {
            invalidItemType: 'All stored items must be scalar values (strings or numbers)',
            invalidDataObject: 'Invalid parameter received for data object, expecting a hash'
        };
    }

    isValid(item) {
        return ['string', 'number'].indexOf(typeof item) !== -1;
    }

    getData() {
        return new Promise((resolve, reject) => {
            resolve(this.storage);
        });
    }

    setData(data) {
        return new Promise((resolve, reject) => {
            this.storage = {};

            for (let item of data) {
                this.storage[item._id] = item;
            }

            resolve(true);
        });
    }

    slice(offset, limit) {
        return new Promise((resolve, reject) => {
            let ret = [];

            for (let index in this.storage) {
                ret.push(this.storage[index]);
            }

            ret.sort((a, b) => a.order > b.order);

            this.storage = {};

            resolve(ret.slice(offset, offset + limit).forEach(item => {
                this.storage[item._id] = item;
            }));
        });
    }

    getSortedItems() {
        return new Promise((resolve, reject) => {
            let ret = [];

            for (let index in this.storage) {
                ret.push(this.storage[index]);
            }

            ret.sort((a, b) => a.order > b.order).forEach(item => {
                delete item['order'];
            });

            resolve(ret);
        });
    }

    getItems() {
        return new Promise((resolve, reject) => {
            let ret = [];

            for (let index in this.storage) {
                ret.push(this.storage[index]);
            }

            resolve(ret);
        });
    }

    getIds() {
        return new Promise((resolve, reject) => {
            resolve(Object.keys(this.storage));
        });
    }

    extend(item, data) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            if (typeof this.storage[item] === 'undefined') {
                this.storage[item] = {};
            }

            data._id = item;

            resolve(this.storage[item][index] = _.extend(
                this.storage[item][index],
                data
            ));
        });
    }

    set(item, data) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            if (typeof data !== 'object') {
                return reject(this.errors.invalidDataObject);
            }

            data._id = item;

            return resolve(this.storage[item] = data);
        });
    }

    data(item, index, value) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            if (typeof this.storage[item] === 'undefined') {
                this.storage[item] = { _id: item };
            }

            if (typeof this.storage[item][index] === 'undefined' && 
                typeof value === 'undefined') {
                return resolve(null);
            }

            if (typeof value === 'undefined') {
                return resolve(this.storage[item][index]);
            }

            if (index == '_id') {
                value = item;
            }

            resolve(this.storage[item][index] = value);
        });
    }

    add(item) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            if (typeof this.storage[item] === 'undefined') {
                this.storage[item] = { _id: item };
            }

            resolve(Object.keys(this.storage).length - 1);
        });
    }

    remove(item) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            delete this.storage[item];
            resolve();
        });
    }

    exists(item) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            return typeof this.storage[item] !== 'undefined';
        });
    }
}
