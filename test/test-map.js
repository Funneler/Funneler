'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

describe('$map', function() {
    var f;

    beforeEach(function() {
        f = new Funneler([
            { $map() { this.emit(1).emit(1).emit(2); } }
        ]);
    });

    it('should fail on invalid constructions', function(done) {
        var f2 = new Funneler('bad');

        f2.exec().catch(err => {
            assert.equal(err, f.errors.invalidInstructions);
            done();
        });
    });

    it('should fail on invalid construction', function(done) {
        f.addInstruction('bad');

        f.exec().catch(err => {
            assert.equal(err, f.errors.invalidInstruction);
            done();
        });
    });

    it('should return unique identifiers [1, 2]', function(done) {
        f.exec().then(data => {
            let ids = [];
            data.forEach(item => ids.push(item._id));

            assert.lengthOf(ids, 2);
            assert.include(ids, 1);
            assert.include(ids, 2);
            done();
        }).catch(done);
    });

    it('should return an object for each identifier', function(done) {
        f.exec().then(data => {
            assert.equal(data[0]._id, 1);
            assert.equal(data[1]._id, 2);
            done();
        }).catch(done);
    });

    it('should map asynchronously through a promise', function(done) {
        f.addInstruction(
            { $map() {
                return new Promise((resolve, reject) => {
                    this.emit(3);
                    resolve();
                });
            } }
        );

        f.exec().then(data => {
            let ids = [];
            data.forEach(item => ids.push(item._id));

            assert.lengthOf(ids, 3);
            assert.include(ids, 1);
            assert.include(ids, 2);
            assert.include(ids, 3);
            done();
        })
        .catch(done);
    });

    it('should catch asynchronous failures', function(done) { 
        f.addInstruction(
            { $map() {
                return new Promise((resolve, reject) => {
                    reject('test error');
                });
            } }
        );

        f.exec().then(done).catch(err => {
            assert.equal(err, 'test error');
            done();
        });
    });
});
