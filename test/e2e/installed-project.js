const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('installed project with package.json and node_modules', function () {
  this.timeout(5000)
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('installing lower version', function () {
    var workspace
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '^1.1.0' }
        }),
        'amd_modules/foo/package.json': JSON.stringify({
          name: 'bar',
          version: '1.1.0',
          origin: true
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install bar@1.0.1 --loglevel silly'))
      .tap(result => {
        console.log('stdout', result.stdout)
        console.warn('stderr', result.stderr)
      })
    )
    it('should make install successful', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.1')
      })
    })
    it('should change package.json accordingly', function () {
      return workspace.readJson(`package.json`).then(index => {
        expect(index.amdDependencies).to.have.property('bar', '^1.0.1')
      })
    })
  })
})
