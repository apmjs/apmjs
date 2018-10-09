'use strict'
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('confliction handling', function () {
  this.timeout(3000)
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('install upon broken dependencies', function () {
    var workspace
    var result
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '1.0.1' }
        }),
        'amd_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          version: '1.0.0'
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install --loglevel info'))
      .tap(res => (result = res))
    )
    it('should be successful', function () {
      expect(result.stderr).to.contain('npm info ok')
    })
    it('should install according to package.json', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.1')
      })
    })
  })
  describe('install satisfying version', function () {
    let workspace
    let result
    before(() => Workspace
      .create({
        'package.json': '{"name": "index", "amdDependencies": { "bar": "1.1.0" }}',
        'amd_modules/bar/package.json': '{"name": "bar", "version": "1.1.0"}'
      })
      .tap(ws => (workspace = ws))
      .then(() => workspace.run('$APM install doo@1.0.1'))
      .tap(res => (result = res))
    )
    it('should be successful', function () {
      return workspace.readJson(`amd_modules/doo/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'doo')
        expect(bar).to.have.property('version', '1.0.1')
      })
    })
    it('should leave already installed untouched', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.1.0')
      })
    })
    it('should print installed packages', function () {
      expect(result.stdout).to.equal(`index
├── bar@1.1.0
└─┬ doo@1.0.1 (installed)
  └── bar@1.1.0
`)
    })
    it('should not print conflict error', function () {
      expect(result.stderr).to.not.include('version conflict')
    })
  })
  describe('install conflict version', function () {
    let workspace
    let result
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { coo: '1.0.0' }
        }),
        'amd-lock.json': '{"dependencies":{"bar": {"version": "1.0.0"}, "coo": {"vesion": "1.0.0"}}}',
        'amd_modules/bar/package.json': '{"name": "bar", "version": "1.0.0"}',
        'amd_modules/coo/package.json': '{"name": "coo", "version": "1.0.0", "amdDependencies": {"bar": "<=1.0.0"}}'
      })
      .tap(ws => (workspace = ws))
      .then(() => workspace.run('$APM install bar@1.1.0 --loglevel silly'))
      .tap(res => (result = res))
    )
    it('should be successful', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.1.0')
      })
    })
    it('should print installed and removed packages', function () {
      expect(result.stdout).to.equal(`index
├─┬ coo@1.0.0
│ └── bar@1.0.0 (removed)
└── bar@1.1.0 (installed)
`)
    })
    it('should print conflict error', function () {
      var msg = 'version conflict: upgrade bar@<=1.0.0 (required by coo@1.0.0) to match 1.1.0 (required by index)'
      expect(result.stderr).to.include(msg)
    })
    it('should change package.json accordingly', function () {
      return workspace.readJson(`package.json`).then(index => {
        expect(index.amdDependencies).to.have.property('bar', '^1.1.0')
      })
    })
  })
  describe('install deeply conflict version', function () {
    let workspace
    let result
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { coo: '1.0.0' }
        }),
        'amd-lock.json': '{"dependencies":{"bar": {"version": "1.0.0"}, "coo": {"vesion": "1.0.0"}}}',
        'amd_modules/bar/package.json': '{"name": "bar", "version": "1.0.0"}',
        'amd_modules/coo/package.json': '{"name": "coo", "version": "1.0.0", "amdDependencies": {"bar": "<=1.0.0"}}'
      })
      .tap(ws => (workspace = ws))
      .then(workspace => workspace.run('$APM install doo@1.0.1'))
      .then(res => (result = res))
    )
    it('should be successful', function () {
      return workspace.readJson(`amd_modules/doo/package.json`)
        .then(json => expect(json).to.have.property('version', '1.0.1'))
    })
    it('should install conflicted package', function () {
      return workspace.readJson(`amd_modules/bar/package.json`)
        .then(json => expect(json).to.have.property('version', '1.0.0'))
    })
    it('should print installed and removed packages', function () {
      expect(result.stdout).to.equal(`index
├─┬ coo@1.0.0
│ └── bar@1.0.0
└─┬ doo@1.0.1 (installed)
  └── bar@^1.1.0 (not installed)
`)
    })
    it('should print conflict error', function () {
      var msg = 'version conflict: upgrade bar@<=1.0.0 (required by coo@1.0.0) to match ^1.1.0 (required by doo@1.0.1)'
      expect(result.stderr).to.include(msg)
    })
    it('should not change amd-lock.json', function () {
      return workspace.readJson(`amd-lock.json`)
        .then(json => {
          expect(json).to.have.nested.property('dependencies.bar.version', '1.0.0')
          expect(json).to.have.nested.property('dependencies.coo.version', '1.0.0')
          expect(json).to.have.nested.property('dependencies.doo.version', '1.0.1')
        })
    })
  })
  describe('install conflict version with --save', function () {
    var workspace
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { coo: '1.0.0' }
        }),
        'amd_modules/coo/package.json': JSON.stringify({
          name: 'coo',
          version: '1.0.0'
        }),
        'amd_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          version: '1.0.0'
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install bar@~1.1.0 --save'))
    )
    it('should make install successful', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.1.0')
      })
    })
    it('should change package.json accordingly', function () {
      return workspace.readJson(`package.json`).then(index => {
        expect(index.amdDependencies).to.have.property('bar', '^1.1.0')
      })
    })
  })
  describe('install conflict version with --no-save', function () {
    let workspace
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { coo: '1.0.0' }
        }),
        'amd_modules/coo/package.json': JSON.stringify({
          name: 'coo',
          version: '1.0.0'
        }),
        'amd_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          version: '1.0.0'
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install bar@~1.1.0 --no-save'))
    )
    it('should make install successful', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.1.0')
      })
    })
    it('should not change package.json', function () {
      return workspace.readJson(`package.json`).then(index => {
        expect(index.amdDependencies).to.not.have.property('bar')
      })
    })
  })
})
