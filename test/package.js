const Package = require('../src/package.js')
const fs = require('fs-extra')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const mock = require('mock-fs')
chai.use(require('chai-as-promised'))

var foo = {'name': 'foo', 'version': '1.2.3'}
var bar = {'main': './a.js', 'name': 'bar'}
var coo = {'browser': './a.js', 'main': './b.js', 'name': 'coo'}

describe('package', function () {
  var pkg
  var tmpPkg
  before(function () {
    pkg = new Package(foo, '/root/foo')
    tmpPkg = new Package({name: 'tmp'})
  })
  beforeEach(() => mock({
    '/root/foo/package.json': '{"name": "foo", "author": "harttle", "dependencies": {"foo": "1.2.3"}}'
  }))
  afterEach(() => mock.restore())
  describe('.load()', function () {
    it('should load package', function () {
      return Package.load('/root/foo').then(pkg => {
        expect(pkg).to.have.property('name', 'foo')
      })
    })
    it('should load empty package.json without exception', function () {
      return Package.load('/root/bar').then(pkg => {
        expect(pkg).to.have.property('name', 'tmp')
      })
    })
  })
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
      return expect(pkg).to.have.property('fullpath', '/root/foo/index.js')
    })
    it('should save descriptor', function () {
      return expect(pkg).to.include({
        'descriptor': foo
      })
    })
    it('should respect package.json/main field', function () {
      return expect(new Package(bar, '/bar')).to.include({
        fullpath: '/bar/a.js',
        filepath: 'bar/a.js'
      })
    })
    it('should take browser field over main field', function () {
      return expect(new Package(coo, '/coo/haa')).to.include({
        fullpath: '/coo/haa/a.js',
        filepath: 'haa/a.js'
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
    beforeEach(() => sinon.stub(console, 'warn'))
    afterEach(() => console.warn.restore())
    it('should skip saving when package.json not exist', function () {
      return tmpPkg.saveDependencies().then(() => {
        expect(console.warn).to.be.calledWith('package.json not exist, skip saving...')
      })
    })
    it('should save dependencies to file', function () {
      pkg.dependencies = { 'bar': '2.2.2' }
      return pkg.saveDependencies()
        .then(() => fs.readJson('/root/foo/package.json'))
        .then(json => expect(json).to.deep.equal({
          name: 'foo',
          author: 'harttle',
          dependencies: {
            bar: '2.2.2'
          }
        }))
    })
  })
})
