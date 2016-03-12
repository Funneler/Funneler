'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

chai.config.includeStack = true;

describe('$sort', function() {
    var f;

    beforeEach(function() {
        f = new Funneler([
            { $map() { this.emit([1, 2, 3, 4, 5]) } }
        ]);
    });

    it('should sort', function(done) {
        f.addInstruction(
            { $sort(a, b) {
                return a._id < b._id;
            } }
        );

        f.exec().then(items => {
            assert.equal(5, items[0]._id);
            assert.equal(4, items[1]._id);
            assert.equal(3, items[2]._id);
            assert.equal(2, items[3]._id);
            assert.equal(1, items[4]._id);
            done();
        }).catch(done);
    });
});
