'use strict'
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('re-install a package', function () {
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))
  var workspace
  beforeEach(() => Workspace
    .create({
      'package.json': '{"name": "index", "amdDependencies": { "bar": "^1.0.1" }}',
      'amd_modules/bar/package.json': '{"name": "bar", "version": "1.0.1"}'
    })
    .tap(ws => (workspace = ws))
  )
  it('should use local copy in subsequent installs', function () {
    return workspace.run('$APM install')
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.1')
      })
  })
  it('should respect installed packages in amdPrefix', function () {
    return Workspace
    .create({
      'package.json': '{"name": "index", "amdPrefix": "hei/haa", "amdDependencies": {"bar": "^1.0.1"}}',
      'hei/haa/bar/package.json': '{"name": "bar", "version": "1.0.1"}'
    })
    .then(workspace => workspace.run('$APM install --loglevel silly')
      .then(() => workspace.readJson(`hei/haa/bar/package.json`))
      .then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.1')
      })
    )
  })
  it('should only respect installed packages in amdPrefix if set', function () {
    return Workspace
    .create({
      'package.json': '{"name": "index", "amdPrefix": "hei/haa", "amdDependencies": {"bar": "^1.0.1"}}',
      'amd_modules/bar/package.json': '{"name": "bar", "version": "1.0.1"}'
    })
    .then(workspace => workspace.run('$APM install --loglevel silly')
      .then(() => workspace.readJson(`hei/haa/bar/package.json`))
      .then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.1.0')
      })
    )
  })
  it('should use local copy even listed', function () {
    return workspace.run('$APM install bar')
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.1')
      })
  })
  it('should update once specified version', function () {
    return workspace.run('$APM install bar@1.1.0')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(bar => {
        expect(bar).to.have.nested.property('dependencies.bar.version', '1.1.0')
      })
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.1.0')
      })
  })
  it('should change package.json accordingly', function () {
    return workspace.run('$APM install bar@1.1.0')
      .then(() => workspace.readJson(`package.json`))
      .then(index => expect(index.amdDependencies).to.have.property('bar', '^1.1.0'))
  })
  it('should support @latest', function () {
    return workspace.run('$APM install bar@latest')
      .then(() => workspace.readJson(`package.json`))
      .then(index => expect(index.amdDependencies).to.have.property('bar', '^1.1.0'))
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(pkg => {
        expect(pkg).to.have.property('name', 'bar')
        expect(pkg).to.have.property('version', '1.1.0')
      })
  })
  it('should install a lower version successfully', function () {
    return workspace.run('$APM install bar@1.0.1 --loglevel=silly')
    .then(() => workspace.readJson(`amd_modules/bar/package.json`))
    .then(bar => {
      expect(bar).to.have.property('name', 'bar')
      expect(bar).to.have.property('version', '1.0.1')
    })
  })
})
