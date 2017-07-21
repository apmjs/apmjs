const Package = require('../src/package.js')
const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-as-promised'))

var foo = {'name': 'foo', 'version': '1.2.3'}
var bar = {'index': './a.js', 'name': 'bar'}
var coo = {'browser': './a.js', 'index': './b.js', 'name': 'coo'}

describe('package', function () {
  var pkg
  before(function () {
    pkg = new Package(foo, '/root')
  })
  describe('new Package', function () {
    it('should throw when name not defined', function () {
      expect(function () {
        // eslint-disable-next-line
        new Package({})
      }).to.throw(/name not defined/)
    })
    it('should resolve name field', function () {
      return expect(pkg).to.have.property('name', 'foo')
    })
    it('should resolve index.js by default', function () {
      return expect(pkg).to.have.property('filepath', '/root/index.js')
    })
    it('should save descriptor', function () {
      return expect(pkg).to.include({
        'descriptor': foo
      })
    })
    it('should respect package.json/index field', function () {
      return expect(new Package(bar, '/bar')).to.include({
        filepath: '/bar/a.js'
      })
    })
    it('should take browser field over index field', function () {
      return expect(new Package(coo, '/coo')).to.include({
        filepath: '/coo/a.js'
      })
    })
  })
  describe('#distname', function () {
    it('should return name+version string', function () {
      return expect(pkg.distname('/z')).to.equal('/z/foo.js')
    })
    it('should default dirname to ""', function () {
      return expect(pkg.distname('foo.js'))
    })
  })
})
