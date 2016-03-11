'use strict';

var Funneler = require('../index.js'),
    chai = require('chai'),
    assert = chai.assert;

describe('Configuration', function() {
    var f;

    beforeEach(function() {
        f = new Funneler();
    });

    it('should assign configuration values from non-commands', function() {
        f.addInstruction({ test: 'value' });
        f.addInstruction({ $map() { } });
        f.exec();

        assert.equal('value', f.getConfig('test'));
        assert.isNull(f.getConfig('$map'));
    });

    it('should be able to assign a value manually', function() {
        f.setConfig('test', 'value');
        assert.equal('value', f.getConfig('test'));
    });

    it('should use a default value if not set', function() {
        assert.equal('value', f.getConfig('test', 'value'));
    });

    it('should use null as default', function() {
        assert.isNull(f.getConfig('test'));
    });
});
