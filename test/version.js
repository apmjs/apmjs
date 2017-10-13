const chai = require('chai')
const error = require('../src/utils/error.js')
const expect = chai.expect
const debug = require('debug')('apmjs:test:version')
const Version = require('../src/resolver/version.js')

describe('Version', function () {
  this.timeout(1000)

  describe('.derive()', function () {
    it('should return 1.0.x for 1.0.0, 0.0.0', function () {
      var info = {versions: {'1.0.0': true, '0.0.0': true}}
      expect(Version.derive(info)).to.equal('^1.0.0')
    })
    it('should return 1.2.x for 1.2.38', function () {
      var info = {versions: {'1.2.38': true}}
      expect(Version.derive(info)).to.equal('^1.2.38')
    })
    it('should return 1.x for 1.2', function () {
      var info = {versions: {'1.2': true, '0.0': true}}
      expect(Version.derive(info)).to.equal('^1.2')
    })
  })
  describe('.parseDependencyDeclaration()', function () {
    it('should parse both name and semver components', function () {
      expect(Version.parseDependencyDeclaration('foo@>=1.1.0')).to.deep.equal({
        name: 'foo',
        semver: '>=1.1.0'
      })
    })
    it('should parse scoped name', function () {
      expect(Version.parseDependencyDeclaration('@baidu/foo@>=1.1.0')).to.deep.equal({
        name: '@baidu/foo',
        semver: '>=1.1.0'
      })
    })
    it('should throw for invalid package name', function () {
      function fn () {
        Version.parseDependencyDeclaration('>=2.2')
      }
      expect(fn).to.throw(error.InvalidPackageName, /invalid package name/)
    })
    it('should parse as * when given only name', function () {
      expect(Version.parseDependencyDeclaration('foo')).to.deep.equal({
        name: 'foo',
        semver: '*'
      })
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
      Version.upgradeWarning('bar', {
        version: '1.0.1',
        required: '1.0.1',
        parent: 'parent1@2.0.0'
      }, {
        version: '1.0.0',
        required: '1.0.0',
        parent: 'parent2'
      })
      var msg = 'WARN: multi versions of bar, upgrade bar@1.0.0 (in parent2) to match 1.0.1 (as required by parent1@2.0.0)'
      expect(console.warn.args[0][0]).to.equal(msg)
    })

    it('should warn to upgrade latter packages', function () {
      Version.upgradeWarning('bar', {
        required: '1.0.1',
        version: '1.0.1',
        parent: 'parent1@2.0.0'
      }, {
        version: '1.0.0',
        required: '1.0.0',
        parent: 'parent2'
      })
      var msg = 'WARN: multi versions of bar, upgrade bar@1.0.0 (in parent2) to match 1.0.1 (as required by parent1@2.0.0)'
      expect(console.warn.args[0][0]).to.equal(msg)
    })
  })
})
