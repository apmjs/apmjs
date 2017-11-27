'use strict'
const stubRegistry = require('../stub/registry.js')
const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('installed project with package.json and node_modules', function () {
  this.timeout(5000)
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('install lower version', function () {
    var workspace
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '^1.1.0' }
        }),
        'amd_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          version: '1.1.0'
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install bar@1.0.1'))
    )
    it('should be successful', function () {
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
  describe('locked dependencies', function () {
    var workspace
    before(() => Workspace
      .create({
        'package.json': `{
          "name": "main",
          "version": "2.1.0",
          "amdDependencies": { "doo": "^1.0.0" }
        }`,
        'amd_modules/doo/package.json': `{
          "name": "doo",
          "version": "1.0.0",
          "amdDependencies": { "bar": "~1.0.0" }
        }`,
        'amd_modules/bar/package.json': `{ "name": "bar", "version": "1.0.0" }`,
        'amd-lock.json': `{"dependencies": {
          "doo": {
            "version": "1.0.0",
            "integrity": "xxx"
          },
          "bar": {
            "version": "1.0.0",
            "integrity": "xxx"
          }
        }}`
      })
      .then(ws => (workspace = ws))
      .then(ws => ws.run('$APM install'))
    )

    it('should lock direct dependency', function () {
      return workspace.readJson(`amd_modules/doo/package.json`)
      .then(pkg => {
        expect(pkg).to.have.property('name', 'doo')
        expect(pkg).to.have.property('version', '1.0.0')
      })
    })
    it('should lock nested dependency', function () {
      return workspace.readJson(`amd_modules/bar/package.json`)
      .then(pkg => {
        expect(pkg).to.have.property('name', 'bar')
        expect(pkg).to.have.property('version', '1.0.0')
      })
    })

    it('should leave amd-lock.json unchanged as long as satisfied', function () {
      return workspace
      .run('$APM install foo --save')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(lock => {
        expect(lock).to.have.nested.property('dependencies.foo')
        expect(lock).to.have.nested.property('dependencies.foo.version', '1.0.0')
        expect(lock).to.have.nested.property('dependencies.doo')
        expect(lock).to.have.nested.property('dependencies.doo.version', '1.0.0')
        expect(lock).to.have.nested.property('dependencies.bar')
        expect(lock).to.have.nested.property('dependencies.bar.version', '1.0.0')
      })
    })
  })
  describe('not satisfied dependency in amd-lock.json', function () {
    let workspace
    let tarball = stubRegistry.applyStubServer('http://apmjs.com/bar/-/bar-1.0.0.tgz')
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'main',
          version: '2.1.0',
          amdDependencies: { bar: '1.1.0' }
        }),
        'amd_modules/bar/package.json': '{ "name": "bar", "version": "1.0.0" }',
        'amd-lock.json': `{ "dependencies": {
            "bar": {
              "version": "1.0.0",
              "resolved": "${tarball}",
              "integrity": "xxx"
            }
        }}`
      })
      .then(ws => (workspace = ws))
    )

    it('should install according to package.json', function () {
      return workspace
      .run('$APM install')
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(pkg => {
        expect(pkg).to.have.property('name', 'bar')
        expect(pkg).to.have.property('version', '1.1.0')
      })
    })

    it('should update amd-lock.json on apmjs install', function () {
      return workspace
      .run('$APM install')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(pkg => {
        expect(pkg).to.have.nested.property('dependencies.bar')
        expect(pkg).to.have.nested.property('dependencies.bar.version', '1.1.0')
      })
    })

    it('should update specified dependency in subsequent installs', function () {
      return workspace
      .run('$APM install foo --save')
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(pkg => {
        expect(pkg).to.have.property('name', 'bar')
        expect(pkg).to.have.property('version', '1.1.0')
      })
    })

    it('should update amd-lock.json in subsequent installs', function () {
      return workspace
      .run('$APM install foo --save')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(pkg => {
        expect(pkg).to.have.nested.property('dependencies.bar')
        expect(pkg).to.have.nested.property('dependencies.bar.version', '1.1.0')
      })
    })
  })
  describe('installing higher version', function () {
    var workspace
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '1.0.1' }
        }),
        'amd_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          version: '1.0.1'
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install bar@1.1.0'))
    )
    it('should be successful', function () {
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
  describe('installing upon broken dependencies', function () {
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
  describe('installing upon linked dependencies', function () {
    let workspace
    let result
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '1.0.1' }
        }),
        'amd_modules': {
          '.gitignore': 'placeholder '
        },
        'foo/bar': 'BAR'
      })
      .tap(ws => {
        workspace = ws
        let file = path.resolve(ws.dirpath, 'foo')
        let link = path.resolve(ws.dirpath, 'amd_modules/bar')
        return fs.symlink(file, link)
      })
      .then(() => workspace.run('$APM install --loglevel info'))
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
  describe('installing another package', function () {
    let workspace
    let result
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '^1.0.0' }
        }),
        'amd_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          version: '1.0.0'
        })
      })
      .tap(ws => (workspace = ws))
      .then(ws => ws.run('$APM install foo@1.0.0 --save'))
      .tap(res => (result = res))
    )
    it('should make install successful', function () {
      return workspace.readJson(`amd_modules/foo/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'foo')
        expect(bar).to.have.property('version', '1.0.0')
      })
    })
    it('should output installed packages', function () {
      expect(result.stdout).to.equal('index\n├── bar@1.0.0\n└── foo@1.0.0 (newly installed)\n')
    })
    it('should retain others', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.0')
      })
    })
    it('should change package.json accordingly', function () {
      return workspace.readJson(`package.json`).then(index => {
        expect(index.amdDependencies).to.have.property('bar', '^1.0.0')
        expect(index.amdDependencies).to.have.property('foo', '^1.0.0')
      })
    })
    it('should write amd-lock.json', function () {
      return workspace.readJson(`amd-lock.json`).then(json => {
        expect(json).to.have.property('name', 'index')
        expect(json).to.have.nested.property('dependencies.bar.version', '1.0.0')
        expect(json).to.have.nested.property('dependencies.foo.version', '1.0.0')
      })
    })
  })
  describe('install incompatible version', function () {
    let workspace
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
    )
    it('should be successful', function () {
      return workspace.run('$APM install bar@1.1.0')
        .then(() => workspace.readJson(`amd_modules/bar/package.json`))
        .then(bar => {
          expect(bar).to.have.property('name', 'bar')
          expect(bar).to.have.property('version', '1.1.0')
        })
    })
    it('should print incompatible error', function () {
      return workspace.run('$APM install bar@1.1.0')
        .then(result => {
          var msg = 'version conflict: upgrade bar@<=1.0.0 (required by coo@1.0.0) to match 1.1.0 (required by index)'
          expect(result.stderr).to.include(msg)
        })
    })
    it('should not change package.json', function () {
      return workspace.run('$APM install bar@1.1.0')
        .then(() => workspace.readJson(`package.json`))
        .then(index => {
          expect(index.amdDependencies).to.not.have.property('bar')
        })
    })
    it('should not change amd-lock.json', function () {
      return workspace.run('$APM install doo@1.0.1')
        .then(() => workspace.readJson(`amd-lock.json`))
        .then(json => {
          expect(json).to.have.nested.property('dependencies.bar.version', '1.0.0')
          expect(json).to.have.nested.property('dependencies.coo.version', '1.0.0')
          expect(json).to.not.have.nested.property('dependencies.doo')
        })
    })
  })
  describe('install incompatible version with --save', function () {
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
})
