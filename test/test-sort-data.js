'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

chai.config.includeStack = true;

describe('$sortData', function() {
    var f;

    beforeEach(function() {
        f = new Funneler([
            { $map() { this.emit([1, 2]); } }
        ]);
    });

    it('should append data keys to all documents synchronously', function(done) {
        f.addInstruction(
            { $sortData(id) { 
                assert.include([1, 2], id);
            } }
        );

        f.exec().then(items => {
            assert.lengthOf(items, 2);
            done();
        });
    });

    it('should append data keys to all documents asynchronously', function(done) {
        f.addInstruction(
            { $sortData(id) { 
                return new Promise((resolve, reject) => {
                    this.getStorage().data(id, 'sort', 'sort' + id).then(resolve).catch(reject);
                });
            } }
        );

        f.exec().then(data => {
            data.forEach(item => assert.equal('sort' + item._id, item.sort));
            done();
        }).catch(done);
    });

    it('should respond to failures', function(done) {
        f.addInstruction(
            { $sortData(id) { 
                return new Promise((resolve, reject) => {
                    reject('test error');
                });
            } }
        );

        f.exec().catch(err => {
            assert.equal('test error', err);
            done();
        });
    });
});
