const mock = require('mock-fs')
const fs = require('fs-extra')
const extract = require('../src/extract.js')
const chai = require('chai')
const expect = chai.expect
const stub = require('./stub.js')
chai.use(require('chai-as-promised'))

describe('extract', function () {
  describe('extractCurrent', function () {
    before(() => mock({
      '/foo': stub.foo
    }))
    after(() => mock.restore())
    it('should resolve package', function () {
      var ret = extract.extractCurrent('/foo')
      return expect(ret).to.eventually.deep.include({
        filepath: '/foo/index.js',
        name: 'foo',
        descriptor: {
          name: 'foo',
          version: '1.2'
        }
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
      return expect(ret).to.eventually.nested.include({
        'dependencies.doo.dependencies.foo.name': 'foo'
      })
    })
  })
  describe('flatten', function () {
    before(() => mock({
      '/laa': stub.laa
    }))
    after(() => mock.restore())
    it('should flatten all dependencies', function () {
      return extract.extractTree('/laa')
        .then(extract.flatten)
        .then(function (pkgs) {
          expect(pkgs).to.be.an('array')
          expect(pkgs.length).to.equal(4)
        })
    })
  })
  describe('writeFiles', function () {
    before(() => {
      mock({
        '/laa': stub.laa,
        '/build': {}
      })
      return extract.extractTree('/laa')
        .then(extract.flatten)
        .then(pkgs => extract.writeFiles(pkgs, '/build'))
    })
    after(() => mock.restore())
    it('should write all files', function () {
      return fs.readdir('/build').then(files => {
        expect(files.length).to.equal(4)
      })
    })
    it('should write all files', function () {
      return fs.readFile('/build/bar-1.1.js', {encoding: 'utf8'})
        .then(files => expect(files).to.equal('bar-content'))
    })
  })
})
