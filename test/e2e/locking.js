'use strict'
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('locking', function () {
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('install a locked package', function () {
    let workspace
    before(() => Workspace
      .create({
        'package.json': `{
          "name": "main",
          "version": "2.1.0",
          "amdDependencies": { "doo": "^1.0.0" }
        }`,
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
    )

    it('should lock direct dependency', function () {
      return workspace.run('$APM install')
      .then(() => workspace.readJson(`amd_modules/doo/package.json`))
      .then(pkg => {
        expect(pkg).to.have.property('name', 'doo')
        expect(pkg).to.have.property('version', '1.0.0')
      })
    })
    it('should lock nested dependency', function () {
      return workspace.run('$APM install')
      .then(() => workspace.readJson(`amd_modules/bar/package.json`))
      .then(pkg => {
        expect(pkg).to.have.property('name', 'bar')
        expect(pkg).to.have.property('version', '1.0.0')
      })
    })

    it('should leave amd-lock.json unchanged when re-install', function () {
      return workspace.run('$APM install bar')
      .then(() => workspace.run('$APM install foo'))
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(lock => expect(lock).to.have.nested.property('dependencies.bar.version', '1.0.0'))
    })
    it('should leave amd-lock.json unchanged as long as satisfied', function () {
      return workspace.run('$APM install')
      .then(() => workspace.run('$APM install foo --save'))
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

  describe('not satisfied dependency in amd-lock.json', function () {
    let workspace
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
})
