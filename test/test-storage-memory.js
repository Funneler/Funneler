'use strict';

var FunnelerStorageMemory = require('../lib/storage/memory.js'),
    Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

describe('FunnelerStorageMemory', function() {
    var s;

    beforeEach(function() {
        s = new FunnelerStorageMemory();
    });

    it('should allow getting and setting the ids from a list of ids', function(done) {
        s.ids([1, 2, 3])
            .then(() => s.ids())
            .then(ids => {
                assert.lengthOf(ids, 3);
                assert.equal(1, ids[0]);
                done();
            })
            .catch(done);
    });

    it('should allow getting and setting items from a list of documents', function(done) {
        s.items([ { title: 'test' } ])
            .then(() => s.items())
            .then(items => {
                assert.lengthOf(items, 1);
                assert.equal('test', items[0].title);
                done();
            })
            .catch(done);
    });

    it('should allow setting items from a list of documents', function(done) {
        s.items([ { title: 'test' } ])
            .then(() => s.items())
            .then(items => {
                assert.lengthOf(items, 1);
                assert.equal('test', items[0].title);
                done();
            })
            .catch(done);
    });

    it('should return a sorted list of ids', function(done) {
        s.ids([5, 3, 4, 2, 1])
            .then(() => s.sorted())
            .then(items => {
                assert.lengthOf(items, 5);
                assert.equal(1, items[0]._id);
                assert.equal(2, items[1]._id);
                assert.equal(3, items[2]._id);
                assert.equal(4, items[3]._id);
                assert.equal(5, items[4]._id);
                done();
            })
            .catch(done);
    });

    it('should report an invalid index', function() {
        assert.isFalse(s.isValid({}));
        assert.isFalse(s.isValid([]));
        assert.isTrue(s.isValid(1));
        assert.isTrue(s.isValid('test'));
    });

    it('should emit a value', function(done) {
        s.emit(1)
        .then(() => s.data(1))
        .then(d => {
            assert.equal(1, d._id);
            done();
        })
        .catch(done);
    });

    it('should emit multiple values', function(done) {
        s.emit([1, 2, 3, 4, 5])
        .then(() => s.items())
        .then(items => {
            assert.lengthOf(items, 5);
            done();
        })
        .catch(done);
    });

    it('should reduce a value', function(done) {
        s.emit([1, 2, 3, 4, 5])
        .then(() => s.reduce(2))
        .then(() => s.items())
        .then(items => {
            assert.lengthOf(items, 4);
            assert.equal(3, items[1]._id);
            done();
        })
        .catch(done);
    });

    it('should report a value exists', function(done) {
        s.emit([1, 2, 3, 4, 5])
        .then(() => s.exists(2))
        .then(yn => {
            assert.isTrue(yn);
            done();
        })
        .catch(done);
    });

    it('should report a value does not exist', function(done) {
        s.emit([1, 2, 3, 4, 5])
        .then(() => s.exists(9))
        .then(yn => {
            assert.isFalse(yn);
            done();
        })
        .catch(done);
    });

    it('should slice documents', function(done) {
        s.emit([1, 2, 3, 4, 5])
        .then(() => s.slice(1, 3))
        .then(() => s.items())
        .then(items => {
            assert.lengthOf(items, 3);
            assert.equal(2, items[0]._id);
            assert.equal(3, items[1]._id);
            assert.equal(4, items[2]._id);
            done();
        })
        .catch(done);
    });

    describe('data', function() {
        it('should receive a single value', function(done) {
            s.items([{ _id: 1, title: 'test' }])
                .then(() => s.data(1, 'title'))
                .then(value => {
                    assert.equal('test', value);
                    done();
                })
                .catch(done);
        });

        it('should set a single value', function(done) {
            s.items([{ _id: 1 }])
                .then(() => s.data(1, 'title', 'test'))
                .then(() => s.data(1, 'title'))
                .then(value => {
                    assert.equal('test', value);
                    done();
                })
                .catch(done);
        });

        it('should set an item', function(done) {
            s.data(1, { title: 'test' })
            .then(() => s.data(1, 'title'))
            .then(value => {
                assert.equal('test', value);
                done();
            })
            .catch(done);
        });

        it('should extend an item and return the document with one parameter', function(done) {
            s.data(1, { title: 'test' })
            .then(() => s.data(1, { name: 'test' }, true))
            .then(() => s.data(1))
            .then(doc => {
                assert.equal('test', doc.title);
                assert.equal('test', doc.name);
                done();
            })
            .catch(done);
        }); 
    });
});
