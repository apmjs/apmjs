const chai = require('chai')
const expect = chai.expect
const debug = require('debug')('apmjs:test:version')
const TreeNode = require('../src/resolver/tree-node.js')
const Version = require('../src/resolver/version.js')
const _tostr = TreeNode.prototype.toString

describe('Version', function () {
  this.timeout(1000)

  describe('.abstract()', function () {
    it('should return 1.0.x for 1.0.0', function () {
      expect(Version.abstract('1.0.0')).to.equal('1.0.x')
    })
    it('should return 1.2.x for 1.2.38', function () {
      expect(Version.abstract('1.2.0')).to.equal('1.2.x')
    })
    it('should return 1.x for 1.2', function () {
      expect(Version.abstract('1.2')).to.equal('1.x')
    })
  })
  describe('.upgradeWarning()', function () {
    beforeEach(function () {
      this.sinon.stub(console, 'warn')
    })
    afterEach(function () {
      console.warn.restore()
    })
    it('should warn to upgrade former packages', function () {
      var installing = {
        name: 'bar',
        semver: '1.0.1',
        parent: { name: 'parent1', version: '2.0.0', toString: _tostr },
        toString: _tostr}
      var installed = {
        name: 'bar',
        semver: '1.0.0',
        version: '1.0.0',
        parent: {name: 'parent2', toString: _tostr},
        toString: _tostr}

      Version.upgradeWarning(installing, installed)
      var msg = 'WARN: multi versions of bar, upgrade bar@1.0.0 (in parent2) to match 1.0.1 (as required by parent1@2.0.0)'
      return expect(console.warn).to.have.been.calledWith(msg)
    })
    it('should warn to upgrade latter packages', function () {
      var installed = {
        name: 'bar',
        semver: '1.0.1',
        version: '1.0.1',
        parent: { name: 'parent1', version: '2.0.0', toString: _tostr },
        toString: _tostr}
      var installing = {
        name: 'bar',
        semver: '1.0.0',
        parent: {name: 'parent2', toString: _tostr},
        toString: _tostr}
      Version.upgradeWarning(installing, installed)
      var msg = 'WARN: multi versions of bar, upgrade bar@1.0.0 (in parent2) to match 1.0.1 (as required by parent1@2.0.0)'
      return expect(console.warn).to.have.been.calledWith(msg)
    })
  })
})
