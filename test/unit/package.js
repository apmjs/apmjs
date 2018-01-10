const fs = require('fs-extra')
const IntegrityError = require('../../src/utils/error.js').IntegrityError
const Workspace = require('../stub/workspace.js')
const Package = require('../../src/package.js')
const Promise = require('bluebird')
const path = require('path')
const debug = require('debug')('apmjs:test:npm')
const npm = require('../../src/utils/npm.js')
const chai = require('chai')
const expect = chai.expect
const registry = require('../stub/registry.js')
chai.use(require('chai-as-promised'))

describe('Package', function () {
  this.timeout(1000)

  before(() => Promise
    .all([
      npm.load({'@baidu:registry': registry.url, 'registry': registry.url}),
      Promise.fromCallback(cb => registry.startServer(cb))
    ])
  )
  after(cb => registry.stopServer(cb))

  describe('install', function () {
    let ws, meta
    beforeEach(() => Promise.all([
      Workspace.create().then(workspace => (ws = workspace)),
      npm.getPackageMeta('integrity').then(mt => (meta = mt))
    ]))
    it('should download and extract', function () {
      let pathname = path.join(ws.dirpath, 'amd_modules/integrity')
      let pkg = new Package(meta.versions['3.0.0'], pathname)
      return pkg.install(ws.dirpath)
        .then(() => fs.readJson(path.join(ws.dirpath, 'amd_modules/integrity/package.json')))
        .then(pkg => expect(pkg.name).to.equal('integrity'))
        .then(() => fs.readFile(path.join(ws.dirpath, 'amd_modules/integrity/index.js'), 'utf-8'))
        .then(content => expect(content).to.equal('hello-world\n'))
    })
    it('should reject if shasum(shasum) not match', function () {
      let pathname = path.join(ws.dirpath, 'amd_modules/integrity')
      let pkg = new Package(meta.versions['1.0.0'], pathname)
      return expect(pkg.install(ws.dirpath)).to.eventually.be.rejectedWith(
        IntegrityError,
        'integrity checksum failed when using sha1: wanted 943e0ec03df00ebeb6273a5b94b916ba54b47581 but got bf7aa90e5d35ef42bf9d45f066ab52f76d0731e3'
      )
    })
    it('should reject if integrity(sri) not match', function () {
      let pathname = path.join(ws.dirpath, 'amd_modules/integrity')
      let pkg = new Package(meta.versions['2.0.0'], pathname)
      return expect(pkg.install(ws.dirpath)).to.eventually.be.rejectedWith(
        IntegrityError,
        'sha512-xxx integrity checksum failed when using sha512: wanted sha512-xxx but got sha512-FrHr1+lt/2N4oA/bw8Csbm3efjn1/5AyCbz1Quv1lD00vkV1pg+RXcBRm/3MLQQDN4FiYQPIgBHu84wjgpB69g=='
      )
    })
  })
})
