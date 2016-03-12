'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

chai.config.includeStack = true;

describe('$data', function() {
    var f;

    beforeEach(function() {
        f = new Funneler([
            { $map() { [1, 2, 3, 4, 5].forEach(id => this.emit(id)) } }
        ]);
    });

    it('should gather data in three batches', function(done) {
        let callCount = 0;

        f.addInstruction(
            { $data: [ 2, function(ids) {
                callCount++;

                ids.forEach(id => {
                    this.data(id, 'title', 'Title #' + id);
                });
            } ] }
        );

        f.exec().then(items => {
            assert.equal(3, callCount);

            assert.equal('Title #' + 1, items[0].title);
            assert.equal('Title #' + 2, items[1].title);
            assert.equal('Title #' + 3, items[2].title);
            assert.equal('Title #' + 4, items[3].title);
            assert.equal('Title #' + 5, items[4].title);
            done();
        }).catch(done);
    });

    it('should gather one by one', function(done) {
        let callCount = 0;

        f.addInstruction(
            { $data(id) {
                callCount++;
                this.data(id, 'title', 'Title #' + id);
            } }
        );

        f.exec().then(items => {
            assert.equal(5, callCount);

            assert.equal('Title #' + 1, items[0].title);
            assert.equal('Title #' + 2, items[1].title);
            assert.equal('Title #' + 3, items[2].title);
            assert.equal('Title #' + 4, items[3].title);
            assert.equal('Title #' + 5, items[4].title);
            done();
        }).catch(done);
    });

    it('should catch asynchronous failures', function(done) {
        f.addInstruction(
            { $data(id) { 
                return new Promise((resolve, reject) => reject('test error'));
            } }
        );

        f.exec().catch(err => {
            assert.equal('test error', err);
            done();
        });
    });
});
