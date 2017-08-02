const fs = require('fs-extra')
const path = require('path')
const debug = require('debug')('apmjs:test:npm')
const npm = require('../src/utils/npm.js')
const chai = require('chai')
const expect = chai.expect
const nock = require('nock')
const fooInfo = require('./stub/foo.info.json')
const fooTgz = path.resolve(__dirname, './stub/foo-1.0.0.tgz')
chai.use(require('chai-as-promised'))

describe('npm', function () {
  this.timeout(1000)

  before(() => {
    nock('http://apm')
      .log(debug)
      .get('/foo')
      .reply(200, JSON.stringify(fooInfo))
      .get('/@baidu%2Ffoo')
      .reply(200, JSON.stringify(fooInfo))
      .get('/xxx')
      .reply(404, 'Not Found')
      .get('/foo/-/foo-1.0.0.tgz')
      .replyWithFile(200, fooTgz)
    return npm.load({registry: 'http://apm'})
  })
  after(() => nock.cleanAll())

  describe('getPackageInfo', function () {
    it('should get response', function () {
      return npm.getPackageInfo('foo')
        .then(info => {
          expect(info.versions).to.have.property('1.0.0')
          expect(info.versions['1.0.0']).to.deep.include({
            name: 'foo',
            dependencies: {},
            dist: {
              shasum: '943e0ec03df00ebeb6273a5b94b916ba54b47581',
              tarball: 'http://apm/foo/-/foo-1.0.0.tgz'
            }
          })
        })
    })
    it('should encode package name', function () {
      return npm.getPackageInfo('@baidu/foo')
        .then(info => {
          expect(info).to.have.property('name', 'foo')
        })
    })
    it('should throw on non-exist package', function () {
      var pending = npm.getPackageInfo('xxx', {name: 'foo'})
      var msg = 'package xxx not found, required by foo'
      return expect(pending).to.eventually.be.rejectedWith(msg)
    })
  })
  describe('downloadPackage', function () {
    it('should download and extract', function () {
      // tarball-extract does not play well with mock-fs
      return npm
        .downloadPackage(
          'http://apm/foo/-/foo-1.0.0.tgz',
          '/tmp/apm_modules/foo'
        )
        .then(() => fs.readdir('/tmp/apm_modules/foo'))
        .then(() => fs.readJson('/tmp/apm_modules/foo/package.json'))
        .then(pkg => expect(pkg.name).to.equal('foo'))
    })
  })
})
