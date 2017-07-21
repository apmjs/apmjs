const fs = require('fs-extra')
const path = require('path')
const npm = require('../src/npm.js')
const chai = require('chai')
const expect = chai.expect
const nock = require('nock')
const fooInfo = require('./stub/foo.info.json')
const fooTgz = path.resolve(__dirname, './stub/foo-1.0.0.tgz')
chai.use(require('chai-as-promised'))

describe('npm', function () {
  this.timeout(150000)

  before(() => {
    nock('http://apm')
      .log(console.log)
      .get('/foo')
      .reply(200, JSON.stringify(fooInfo))
      .get('/foo/-/foo-1.0.0.tgz')
      .replyWithFile(200, fooTgz)
    return npm.load({registry: 'http://apm'})
  })

  describe('getPackageInfo', function () {
    it('should get response', function () {
      return npm.getPackageInfo('foo')
        .then(info => expect(info['1.0.0']).to.deep.include({
          name: 'foo',
          versions: ['1.0.0'],
          dependencies: {},
          dist: {
            shasum: '943e0ec03df00ebeb6273a5b94b916ba54b47581',
            tarball: 'http://apm/foo/-/foo-1.0.0.tgz'
          }
        }))
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
