'use strict'
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('locking', function () {
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('respecting lock', function () {
    let workspace
    beforeEach(() => Workspace
      .create({
        'package.json': `{
          "name": "main",
          "version": "2.1.0",
          "amdDependencies": { "doo": "^1.0.0" }
        }`,
        'amd-lock.json': `{"dependencies": {
          "doo": {"version": "1.0.0"},
          "bar": {"version": "1.0.0"}
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
  })

  describe('updating lock', function () {
    let workspace
    beforeEach(() => Workspace
      .create({
        'package.json': `{
          "name": "main",
          "version": "2.1.0",
          "amdDependencies": { "doo": "^1.0.0" }
        }`,
        'amd-lock.json': `{"dependencies": {
          "doo": {"version": "1.0.0"},
          "bar": {"version": "1.0.0", "integrity": "sha512-hssCTy6V5o2Lpakooc5SdtaT+idGKd+6+meJBNXggzV+aFLmdMvk7N4BjKfNJSs4HaUnpFrt7f6XGAzKQ/LpwQ=="}
        }}`
      })
      .then(ws => {
        workspace = ws
        return workspace.run('$APM install')
      })
    )
    it('should not change locked version when installed again', function () {
      return workspace.run('$APM install bar')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(lock => {
        expect(lock).to.have.nested.property('dependencies.doo.version', '1.0.0')
        expect(lock).to.have.nested.property('dependencies.bar.version', '1.0.0')
      })
    })
    it('should generate integrity', function () {
      return workspace.run('$APM install bar --save')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(lock => {
        expect(lock).to.have.nested.property('dependencies.doo.integrity', 'sha512-kg2DYN5eVb3kJfC/MuyB/IAWaQ+oKA73xi/ugxwhhP9Zg4jxFzKYzUNu4fQDbX/yS28NJm3DTpZchUXQc+ZTQg==')
        expect(lock).to.have.nested.property('dependencies.bar.integrity', 'sha512-hssCTy6V5o2Lpakooc5SdtaT+idGKd+6+meJBNXggzV+aFLmdMvk7N4BjKfNJSs4HaUnpFrt7f6XGAzKQ/LpwQ==')
      })
    })
    it('should not change locked version when installed again with --save', function () {
      return workspace.run('$APM install bar --save')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(lock => {
        expect(lock).to.have.nested.property('dependencies.doo.version', '1.0.0')
        expect(lock).to.have.nested.property('dependencies.bar.version', '1.0.0')
      })
    })
    it('should update lock when installing with version spec', function () {
      return workspace.run('$APM install bar@1.0.1 --loglevel=silly')
      .then(() => workspace.readJson(`amd-lock.json`))
      .then(lock => {
        expect(lock).to.have.nested.property('dependencies.doo.version', '1.0.0')
        expect(lock).to.have.nested.property('dependencies.bar.version', '1.0.1')
      })
    })
  })

  describe('not satisfied lock', function () {
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
            "bar": { "version": "1.0.0" }
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
