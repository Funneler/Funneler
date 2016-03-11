'use strict';

var Funneler = require('../lib/index.js'),
    chai = require('chai'),
    assert = chai.assert;

describe('$map', function() {
    var f;

    before(function() {
        f = new Funneler([
            { $map() { this.emit(1).emit(1).emit(2); } }
        ]);
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
});
