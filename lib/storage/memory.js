'use strict';

var _ = require('underscore');

module.exports = class FunnelerStorageMemory {
    constructor() {
        this.db = {};
        this.errors = {
            invalidItemType: 'All stored items must be scalar values (strings or numbers)',
            invalidDataObject: 'Invalid parameter received for data object, expecting a hash'
        };
    }

    isValid(item) {
        return ['string', 'number'].indexOf(typeof item) !== -1;
    }

    items(items) {
        return new Promise((resolve, reject) => {
            if (typeof items === 'undefined') {
                let ret = [];

                for (let index in this.db) {
                    ret.push(this.db[index]);
                }

                return resolve(ret);
            }

            this.db = {};

            for (let index in items) {
                let item = _.extend({ _id: typeof items[index]._id !== 'undefined' ? items[index]._id : index }, items[index]);
                this.db[item._id] = item;
            }

            resolve();
        });
    }

    ids(ids) {
        return new Promise((resolve, reject) => {
            if (typeof ids === 'undefined') {
                return resolve(Object.keys(this.db));
            }

            this.db = {};

            ids.forEach(id => {
                this.db[id] = { _id: id };
            });

            resolve();
        });
    }

    sorted() {
        return new Promise((resolve, reject) => {
            let ret = [];

            for (let index in this.db) {
                ret.push(this.db[index]);
            }

            ret.sort((a, b) => a._order > b._order).forEach(item => {
                delete item['_order'];
            });

            resolve(ret);
        });
    }

    data(item, itemOrIndex, dataOrEmpty) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            if (typeof itemOrIndex == 'object') {
                itemOrIndex._id = item;

                if (dataOrEmpty && typeof this.db[item] === 'object') {
                    return resolve(this.db[item] = _.extend(this.db[item], itemOrIndex));
                }

                return resolve(this.db[item] = itemOrIndex);
            }

            if (typeof this.db[item] === 'undefined') {
                this.db[item] = { _id: item };
            }

            if (typeof itemOrIndex === 'undefined') {
                return resolve(this.db[item]);
            }

            if (typeof this.db[item][itemOrIndex] === 'undefined' && 
                typeof dataOrEmpty === 'undefined') {
                return resolve(null);
            }

            if (typeof dataOrEmpty === 'undefined') {
                return resolve(this.db[item][itemOrIndex]);
            }

            if (itemOrIndex == '_id') {
                dataOrEmpty = item;
            }

            resolve(this.db[item][itemOrIndex] = dataOrEmpty);
        });
    }

    emit(item) {
        return new Promise((resolve, reject) => {
            if (typeof item === 'object' && typeof item.length == 'number') {
                item.forEach(i => {
                    if (!this.isValid(i)) {
                        return reject(this.errors.invalidItemType);
                    }

                    this.db[i] = { _id: i };
                });

                resolve();
            }

            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            if (typeof this.db[item] === 'undefined') {
                this.db[item] = { _id: item };
            }

            resolve();
        });
    }

    reduce(item) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            delete this.db[item];
            resolve();
        });
    }

    exists(item) {
        return new Promise((resolve, reject) => {
            if (!this.isValid(item)) {
                return reject(this.errors.invalidItemType);
            }

            resolve(typeof this.db[item] !== 'undefined');
        });
    }

    slice(offset, limit) {
        return new Promise((resolve, reject) => {
            let ret = [];

            for (let index in this.db) {
                ret.push(this.db[index]);
            }

            ret.sort((a, b) => a._order > b._order);

            this.db = {};

            resolve(ret.slice(offset, offset + limit).forEach(item => {
                this.db[item._id] = item;
            }));
        });
    }
}
