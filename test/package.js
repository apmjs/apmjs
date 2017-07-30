const Package = require('../src/package.js')
const fs = require('fs-extra')
const chai = require('chai')
const expect = chai.expect
const mock = require('mock-fs')
chai.use(require('chai-as-promised'))

var foo = {'name': 'foo', 'version': '1.2.3'}
var bar = {'index': './a.js', 'name': 'bar'}
var coo = {'browser': './a.js', 'index': './b.js', 'name': 'coo'}

describe('package', function () {
  var pkg
  before(function () {
    pkg = new Package(foo, '/root/foo')
  })
  beforeEach(() => mock({
    '/root/foo/package.json': '{"author": "harttle", "dependencies": {"foo": "1.2.3"}}'
  }))
  afterEach(() => mock.restore())
  describe('new Package()', function () {
    it('should throw when name not defined', function () {
      expect(function () {
        // eslint-disable-next-line
        new Package({})
      }).to.throw(/name not defined/)
    })
    it('should resolve name field', function () {
      return expect(pkg).to.have.property('name', 'foo')
    })
    it('should set default dependencies', function () {
      var emptyPkg = new Package({name: 'foo'})
      return expect(emptyPkg.dependencies).to.be.an('object')
    })
    it('should resolve index.js by default', function () {
      return expect(pkg).to.have.property('filepath', '/root/foo/index.js')
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
  describe('#distname()', function () {
    it('should return name+version string', function () {
      return expect(pkg.distname('/z')).to.equal('/z/foo.js')
    })
    it('should default dirname to ""', function () {
      return expect(pkg.distname('foo.js'))
    })
  })
  describe('#saveDependencies()', function () {
    it('should save dependencies to file', function () {
      pkg.dependencies = { 'bar': '2.2.2' }
      return pkg.saveDependencies()
        .then(() => fs.readJson('/root/foo/package.json'))
        .then(json => expect(json).to.deep.equal({
          author: 'harttle',
          dependencies: {
            bar: '2.2.2'
          }
        }))
    })
  })
})
