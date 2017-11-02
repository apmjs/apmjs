'use strict'
const chai = require('chai')
const expect = chai.expect
const mock = require('mock-fs')
const Installer = require('../../src/installer.js')
const npm = require('../../src/utils/npm.js')
const fs = require('fs-extra')
const sinon = require('sinon')
const _ = require('lodash')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

describe('Installer', function () {
  let inst
  let fooDesc = require('../stub/foo.info.json').versions['1.0.0']
  let barDesc = _.chain(fooDesc).clone().set('name', 'bar').value()
  let bazDesc = _.chain(fooDesc).clone().set('name', 'baz').value()
  let sandbox

  beforeEach(function () {
    inst = new Installer('/root/amd_modules')
    sandbox = sinon.sandbox.create()
    sandbox.stub(npm, 'downloadPackage')
      .returns(Promise.resolve())
    sandbox.stub(npm, 'getPackageMeta')
      .returns(Promise.resolve(require('../stub/baz.info.json')))

    // FIXME cannot restore
    Object.defineProperty(npm, 'globalDir', {
      get: () => '/root/bar/amd_modules'
    })
    mock({'/root': {
      'amd_modules': {
        'bar': {'package.json': JSON.stringify(barDesc)},
        'baz': {'package.json': JSON.stringify(bazDesc)}
      },
      'bar': {
        'amd_modules': {}
      }
    }})
  })
  afterEach(function () {
    sandbox.restore()
    mock.restore()
  })
  describe('.globalInstall ', function () {
    beforeEach(function () {
      sandbox
        .stub(Installer.prototype, 'installPackage')
        .returns(Promise.resolve())
    })
    it('should install latest by default', function () {
      return Installer.globalInstall('foo').then(function () {
        expect(Installer.prototype.installPackage).to.have.been.calledOnce
        let args = Installer.prototype.installPackage.args[0]
        expect(args[0]).to.have.property('name', 'baz')
        expect(args[0]).to.have.property('version', '1.1.0')
      })
    })
    it('should install maxSatisfying', function () {
      return Installer.globalInstall('foo', '1.0.x').then(function () {
        expect(Installer.prototype.installPackage).to.have.been.calledOnce
        let args = Installer.prototype.installPackage.args[0]
        expect(args[0]).to.have.property('name', 'baz')
        expect(args[0]).to.have.property('version', '1.0.1')
      })
    })
  })
  describe('#saveMapping()', function () {
    it('should generate index.json', function () {
      let map = [{
        name: 'foo',
        version: '2.2.2',
        filepath: 'foo/a.js',
        fullpath: '/root/foo/a.js'
      }]
      let str = JSON.stringify(map, null, 2) + '\n'
      return inst.saveMapping(map)
        .then(() => fs.readFile('/root/amd_modules/index.json', {encoding: 'utf8'}))
        .then(index => expect(index).to.deep.equal(str))
    })
  })
})
