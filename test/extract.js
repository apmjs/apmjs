const mock = require('mock-fs')
const extract = require('../src/extract.js')
const chai = require('chai')
const expect = chai.expect
const stub = require('./stub.js')
chai.use(require('chai-as-promised'))

describe('extract', function () {
  describe('extractCurrent', function () {
    before(() => mock({
      '/foo': stub.foo,
      '/bar': stub.bar,
      '/coo': stub.coo
    }))
    after(() => mock.restore())
    it('should resolve index.js by default', function () {
      var ret = extract.extractCurrent('/foo')
      return expect(ret).to.eventually.deep.equal({
        filepath: '/foo/index.js',
        name: 'foo',
        content: 'foo-content',
        pkg: {
          name: 'foo'
        }
      })
    })
    it('should respect package.json/index field', function () {
      var ret = extract.extractCurrent('/bar')
      return expect(ret).to.eventually.include({
        filepath: '/bar/a.js',
        content: 'bar-content'
      })
    })
    it('should take browser field over index field', function () {
      var ret = extract.extractCurrent('/coo')
      return expect(ret).to.eventually.include({
        filepath: '/coo/a.js',
        content: 'coo-content'
      })
    })
  })
  describe('extractTree', function () {
    before(() => mock({
      '/laa': stub.laa
    }))
    after(() => mock.restore())
    it('should load child modules', function () {
      var ret = extract.extractTree('/laa')
      return expect(ret).to.eventually.have.deep.property(
        'dependencies.doo.dependencies.foo.content',
        'foo-content')
    })
  })
})
