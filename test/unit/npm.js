const fs = require('fs-extra')
const os = require('os')
const Promise = require('bluebird')
const error = require('../../src/utils/error.js')
const path = require('path')
const debug = require('debug')('apmjs:test:npm')
const npm = require('../../src/utils/npm.js')
const chai = require('chai')
const expect = chai.expect
const registry = require('../stub/registry.js')
chai.use(require('chai-as-promised'))

describe('npm', function () {
  this.timeout(1000)

  before(() => Promise
    .all([
      npm.load(),
      Promise.fromCallback(cb => registry.startServer(cb))
    ])
    .then(() => {
      npm.config.set('@baidu:registry', registry.url)
      npm.config.set('registry', registry.url)
    })
  )
  after(cb => registry.stopServer(cb))

  describe('getPackageMeta', function () {
    it('should get response', function () {
      return npm.getPackageMeta('foo')
        .then(info => {
          expect(info.versions).to.have.property('1.0.0')
          expect(info.versions['1.0.0']).to.deep.include({
            name: 'foo',
            amdDependencies: {},
            dist: {
              shasum: '943e0ec03df00ebeb6273a5b94b916ba54b47581',
              tarball: `${registry.url}/foo/-/foo-1.0.0.tgz`
            }
          })
        })
    })
    it('should get scoped package name', function () {
      return npm.getPackageMeta('@baidu/foo')
        .then(info => {
          expect(info).to.have.property('name', 'foo')
        })
    })
    it('should throw on non-exist package', function () {
      var pending = npm.getPackageMeta('xxx', {name: 'foo'})
      var msg = 'package xxx not found, required by foo'
      return expect(pending).to.eventually.be.rejectedWith(msg)
    })
  })
  describe('downloadPackage', function () {
    beforeEach(() => fs.remove(
        path.join(os.tmpdir(), 'amd_modules')
    ))
    it('should download and extract', function () {
      // tarball-extract does not play well with mock-fs
      return npm
        .downloadPackage(
          `${registry.url}/foo/-/foo-1.0.0.tgz`,
          path.join(os.tmpdir(), 'amd_modules/foo')
        )
        .then(() => fs.readJson(path.join(os.tmpdir(), 'amd_modules/foo/package.json')))
        .then(pkg => expect(pkg.name).to.equal('foo'))
    })
    it('should reject if not exist', function () {
      return expect(npm.downloadPackage(
          `${registry.url}/xxx`,
          path.join(os.tmpdir(), 'amd_modules/foo')
        ))
        .to.eventually.be.rejectedWith(error.NotFound, '404 Not Found')
    })
    it('should follow 302 redirect', function () {
      return npm.downloadPackage(
          `${registry.url}/302-/foo/-/foo-1.0.0.tgz.tgz`,
          path.join(os.tmpdir(), 'amd_modules/foo')
        )
        .then(() => fs.readJson(
          path.join(os.tmpdir(), 'amd_modules/foo/package.json')
        ))
        .then(pkg => expect(pkg.name).to.equal('foo'))
    })
  })
})
