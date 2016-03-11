'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

describe('$slice', function() {
    var f;

    beforeEach(function() {
        f = new Funneler([
            { $map() { [1, 2, 3, 4, 5].forEach(id => this.emit(id)) } }
        ]);
    });

    it('should slice from a promise', function(done) {
        f.addInstruction(
            { $slice() {
                return this.getStorage().slice.apply(this.getStorage(), [1, 3]);
            } }
        );

        f.exec().then(items => {
            assert.lengthOf(items, 3);
            assert.equal(2, items[0]._id);
            assert.equal(3, items[1]._id);
            assert.equal(4, items[2]._id);
            done();
        }).catch(done);
    });

    it('should fail with multiple slices', function(done) {
        f.addInstruction({ $slice() { } });
        f.addInstruction({ $slice() { } });

        f.exec().catch(err => {
            assert.equal(err, f.errors.tooManySlices);
            done();
        });
    });
});
