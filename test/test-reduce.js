'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

chai.config.includeStack = true;

describe('$reduce', function() {
    var f;

    beforeEach(function() {
        f = new Funneler([
            { $map() { this.emit([1, 2]); } }
        ]);
    });

    it('should fail on batch with trailing parameters', function(done) {
        f.addInstruction({ $reduce: [ 1, function() { }, 'extra...' ] });

        f.exec().catch(err => {
            assert.equal(err, f.errors.invalidBatchData.replace('%item%', '$reduce'));
            done();
        });
    });

    it('should reduce synchronously', function(done) {
        f.addInstruction(
            { $reduce(id) { 
                assert.include([1, 2], id);
            } }
        );

        f.exec().then(items => done());
    });

    it('should reduce asynchronously', function(done) {
        f.addInstruction(
            { $reduce(id) { 
                return new Promise((resolve, reject) => {
                    if (id == 1) {
                        this.reduce(id);
                    }
                    resolve();
                });
            } }
        );

        f.exec().then(data => {
            let ids = [];
            data.forEach(item => ids.push(item._id));

            assert.lengthOf(ids, 1);
            assert.include(ids, 2);
            done();
        }).catch(done);
    });

    it('should batch reduce asynchronously', function(done) {
        f.addInstruction(
            { $reduce: [ 1, function(ids) { 
                ids.forEach(id => {
                    if (id == 1) {
                        this.reduce(id);
                    }
                });
            } ] }
        );

        f.exec().then(data => {
            let ids = [];
            data.forEach(item => ids.push(item._id));

            assert.lengthOf(ids, 1);
            assert.include(ids, 2);
            done();
        }).catch(done);
    });

    it('should catch asynchronous failures', function(done) {
        f.addInstruction(
            { $reduce(id) { 
                return new Promise((resolve, reject) => reject('test error'));
            } }
        );

        f.exec().catch(err => {
            assert.equal('test error', err);
            done();
        });
    });
});
