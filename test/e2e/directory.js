const chai = require('chai')
const expect = chai.expect
const pkg = require('../../package.json')
const Workspace = require('../stub/workspace')
const registry = require('../stub/registry.js')

describe('directory without package.json', function () {
  this.timeout(5000)
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  it('should print version via --version', function () {
    return Workspace.create({}).then(ws => ws
      .run('$APM --version')
      .then(result => expect(result.stdout).to.contain(pkg.version)))
  })

  it('should print version via -v', function () {
    return Workspace.create({}).then(ws => ws
      .run('$APM --v')
      .then(result => expect(result.stdout).to.contain(pkg.version)))
  })

  it('should install latest by default', function () {
    return Workspace.create({}).then(ws => ws
      .run('$APM install bar')
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(foo => {
        expect(foo).to.have.property('name', 'bar')
        expect(foo).to.have.property('version', '1.1.0')
      }))
  })

  it('should install a latest satisfying version', function () {
    return Workspace.create({}).then(ws => ws
      .run('$APM install bar@~1.0.0')
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(foo => {
        expect(foo).to.have.property('name', 'bar')
        expect(foo).to.have.property('version', '1.0.1')
      }))
  })

  it('should install a specific version', function () {
    return Workspace.create({}).then(ws => ws
      .run('$APM install bar@1.0.0')
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(foo => {
        expect(foo).to.have.property('name', 'bar')
        expect(foo).to.have.property('version', '1.0.0')
      }))
  })
})
