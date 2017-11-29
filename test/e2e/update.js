'use strict'
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('update a package', function () {
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))
  var workspace
  beforeEach(() => Workspace
    .create({
      'package.json': '{"name": "index", "amdDependencies": { "doo": "^1.0.0", "eow": "~1.0.0" }}',
      'amd_modules/doo/package.json': '{"name": "doo", "version": "1.0.0", "amdDependencies": { "bar": "~1.0.0" }}',
      'amd_modules/bar/package.json': '{"name": "bar", "version": "1.0.0"}',
      'amd_modules/eow/package.json': '{"name": "eow", "version": "1.0.0"}',
      'amd-lock.json': '{"dependencies": {"bar": {"version": "1.0.0"}, "eow": {"version": "1.0.0"}}}'
    })
    .tap(ws => (workspace = ws))
  )
  it('should update direct dependency', function () {
    return workspace.run('$APM update')
      .then(() => workspace.readJson(`amd_modules/doo/package.json`))
      .then(bar => expect(bar).to.have.property('version', '1.0.1'))
      .then(() => workspace.readJson(`amd_modules/eow/package.json`))
      .then(bar => expect(bar).to.have.property('version', '1.0.1'))
  })
  it('should update deep dependency', function () {
    return workspace.run('$APM update')
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(bar => expect(bar).to.have.property('version', '1.1.0'))
  })
  it('should update amd-lock.json accordingly', function () {
    return workspace.run('$APM update').then(() => workspace.readJson(`amd-lock.json`).then(lock => {
      expect(lock).to.have.nested.property('dependencies.eow.version', '1.0.1')
      expect(lock).to.have.nested.property('dependencies.doo.version', '1.0.1')
      expect(lock).to.have.nested.property('dependencies.bar.version', '1.1.0')
    }))
  })
  it('should update a single dependency', function () {
    return workspace.run('$APM update eow --loglevel silly')
      .then(() => workspace.readJson(`amd_modules/eow/package.json`))
      .then(bar => expect(bar).to.have.property('version', '1.0.1'))
  })
  it('should update a single dependency deeply', function () {
    return workspace.run('$APM update doo')
      .then(() => workspace.readJson(`amd_modules/doo/package.json`))
      .then(bar => expect(bar).to.have.property('version', '1.0.1'))
      .then(() => workspace.readJson(`amd_modules/eow/package.json`))
      .then(bar => expect(bar).to.have.property('version', '1.0.0'))
  })
  it('should update the lock of that package', function () {
    return workspace.run('$APM update eow').then(() => workspace.readJson(`amd-lock.json`).then(lock => {
      expect(lock).to.have.nested.property('dependencies.eow.version', '1.0.1')
      expect(lock).to.have.nested.property('dependencies.doo.version', '1.0.0')
      expect(lock).to.have.nested.property('dependencies.bar.version', '1.0.0')
    }))
  })
})
