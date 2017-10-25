const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const Registry = require('../stub/registry.js')

describe('fresh project with package.json', function () {
  var port = process.env.REGISTRY_PORT || '8723'
  var ws
  var reg
  this.timeout(2000)

  before(function () {
    ws = new Workspace(port)
    reg = new Registry(port)
    return Promise.all([ws.create(), reg.startServer()])
  })
  after(function () {
    return Promise.all([ws.destroy(), reg.stopServer()])
  })

  it('should install a single package', function () {
    return ws.createTree({
      'package.json': JSON.stringify({
        name: 'main',
        amdDependencies: { foo: '^1.0.0' }
      })
    })
    .then(() => ws.run('$APM install --loglevel info'))
    .then(result => {
      expect(result.stderr).to.contain('npm info ok')
      return ws.readJson(`amd_modules/foo/package.json`)
    })
    .then(foo => {
      expect(foo).to.have.property('name', 'foo')
      expect(foo).to.have.property('version', '1.0.0')
    })
  })

  it('should install a latest satisfying version', function () {
    return ws.createTree({
      'package.json': JSON.stringify({
        name: 'main',
        amdDependencies: { bar: '~1.0.0' }
      })
    })
    .then(() => ws.run('$APM install'))
    .then(() => ws.readJson(`amd_modules/bar/package.json`))
    .then(foo => {
      expect(foo).to.have.property('name', 'bar')
      expect(foo).to.have.property('version', '1.0.1')
    })
  })

  it('should install the right dependency', function () {
    return ws.createTree({
      'package.json': JSON.stringify({
        name: 'main',
        amdDependencies: { coo: '1.0.0' }
      })
    })
    .then(() => ws.run('$APM install'))
    .then(() => ws.readJson(`amd_modules/coo/package.json`))
    .then(foo => expect(foo).to.have.property('version', '1.0.0'))
    .then(() => ws.readJson(`amd_modules/bar/package.json`))
    .then(foo => expect(foo).to.have.property('version', '1.0.0'))
  })

  it('should give warning and install higher version when conflict', function () {
    return ws.createTree({
      'package.json': JSON.stringify({
        name: 'main',
        version: '1.0',
        amdDependencies: { coo: '1.0.0', bar: '1.0.1' }
      })
    })
    .then(() => ws.run('$APM install'))
    .then(result => {
      expect(result.stderr).to.contain('WARN: multi versions of bar, upgrade bar@<=1.0.0 (in coo@1.0.0) to match 1.0.1 (as required by main@1.0)')
    })
    .then(() => ws.readJson(`amd_modules/coo/package.json`))
    .then(pkg => expect(pkg).to.have.property('version', '1.0.0'))
    .then(() => ws.readJson(`amd_modules/bar/package.json`))
    .then(pkg => expect(pkg).to.have.property('version', '1.0.1'))
  })
})
