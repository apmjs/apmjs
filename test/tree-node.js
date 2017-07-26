const chai = require('chai')
const Promise = require('bluebird')
const npm = require('../src/npm.js')
const _ = require('lodash')
const error = require('../src/error.js')
const debug = require('debug')('apmjs:test:tree-node')
const nock = require('nock')
const expect = chai.expect
const TreeNode = require('../src/resolver/tree-node.js')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))
require('mocha-sinon')

describe('TreeNode', function () {
  this.timeout(1000)

  before(() => {
    nock('http://apm')
      .log(debug)
      .get('/foo')
      .reply(200, JSON.stringify(require('./stub/foo.info.json')))
      .get('/bar')
      .reply(200, JSON.stringify(require('./stub/bar.info.json')))
      .get('/baz')
      .reply(200, JSON.stringify(require('./stub/baz.info.json')))
      .get('/baa')
      .reply(200, JSON.stringify(require('./stub/baa.info.json')))
      .get('/coo')
      .reply(200, JSON.stringify(require('./stub/coo.info.json')))
      .get('/laa')
      .reply(200, JSON.stringify(require('./stub/laa.info.json')))
    return npm.load({registry: 'http://apm'})
  })
  after(() => nock.cleanAll())
  afterEach(() => (TreeNode.nodes = {}))

  describe('new TreeNode()', function () {
    it('should create child without error', function () {
      var versions = {'1.0.0': {name: 'foo'}}
      var parent = {name: 'mine', dependencies: {'foo': '1.0.x'}}
      function fn () { return new TreeNode('foo', versions, parent) }
      expect(fn).to.not.throw()
    })
    it('should create root without error', function () {
      var versions = {'1.0.0': {name: 'foo'}}
      function gn () { return new TreeNode('foo', versions) }
      expect(gn).to.not.throw()
    })
  })
  describe('#pickVersion', function () {
    it('should throw EUNMET if no version available', function () {
      var parent = {name: 'mine', dependencies: {'foo': '1.0.x'}}
      function gn () { return new TreeNode('foo', {}, parent) }
      expect(gn).to.throw('foo@1.0.x not available, required by mine')
    })
    it('should throw when versions undefined for the root', function () {
      function gn () { return new TreeNode('foo', {}) }
      expect(gn).to.throw(/empty versions for the root/)
    })
  })
  describe('.create', function () {
    it('should retrieve info and create', function () {
      var parent = {name: 'parent', dependencies: {'foo': '1.0.x'}}
      return TreeNode.create('foo', parent).then(foo => {
        expect(foo.name).to.equal('foo')
        expect(foo.semver).to.equal('1.0.x')
        expect(foo.pkg.version).to.equal('1.0.0')
      })
    })
    it('should throw when trying to create root', function () {
      function gn () { return TreeNode.create('foo', null) }
      expect(gn).to.throw(/create root manually/)
    })
    it('should not throw when creating the same', function () {
      var parent = {name: 'parent', dependencies: {'bar': '1.x'}}
      return TreeNode.create('bar', parent).then(() => {
        expect(TreeNode.create('bar', parent)).to.be.fulfilled
      })
    })
    it('should not throw when creating the same parallel', function () {
      var parent = {name: 'parent', dependencies: {'bar': '1.x'}}
      return expect(Promise
        .all([
          TreeNode.create('bar', parent),
          TreeNode.create('bar', parent)
        ]))
        .to.be.fulfilled
    })
    it('should not create new if already exist', function () {
      var parent = {name: 'parent', dependencies: {'bar': '1.x'}}
      expect(_.size(TreeNode.nodes)).to.equal(0)
      return Promise
        .all([
          TreeNode.create('bar', parent),
          TreeNode.create('bar', parent)
        ])
        .then(() => expect(_.size(TreeNode.nodes)).to.equal(1))
    })
    it('should create when compliant', function () {
      var parent1 = {name: 'parent1', dependencies: {'bar': '>=1.0.1'}}
      var parent2 = {name: 'parent2', dependencies: {'bar': '1.0.x'}}
      return TreeNode.create('bar', parent1)
        .then(() => TreeNode.create('bar', parent2))
        .then(() => {
          expect(_.size(TreeNode.nodes)).to.equal(1)
          expect(TreeNode.nodes.bar).to.have.property('name', 'bar')
          expect(TreeNode.nodes.bar).to.have.property('version', '1.0.1')
        })
    })
    it('should throw when not available', function () {
      var parent = {name: 'parent', dependencies: {'bar': '2.0.0'}}
      return expect(TreeNode.create('bar', parent))
        .to.be.rejectedWith(
          error.UnmetDependency,
          /bar@2.0.0 not available, required by parent/
        )
    })
    it('should install newer when not compliant 1', function () {
      return Promise.each([
        {name: 'parent2', dependencies: {'bar': '>=1.0.1'}},
        {name: 'parent1', dependencies: {'bar': '1.0.0'}}
      ], parent => TreeNode.create('bar', parent))
      .then(() => {
        expect(TreeNode.nodes.bar).to.have.property('version', '1.0.1')
      })
    })
    it('should install newer when not compliant 2', function () {
      return Promise.each([
        {name: 'parent1', dependencies: {'bar': '1.0.0'}},
        {name: 'parent2', dependencies: {'bar': '>=1.0.1'}}
      ], parent => TreeNode.create('bar', parent))
      .then(() => {
        expect(TreeNode.nodes.bar).to.have.property('version', '1.0.1')
      })
    })
  })
  describe('dependency trees', function () {
    beforeEach(function () {
      this.sinon.stub(console, 'warn')
    })
    afterEach(function () {
      console.warn.restore()
    })
    it('should install latest available', function () {
      var root = new TreeNode('root', {'1.0.0': {
        name: 'root',
        dependencies: { foo: '1.0.0', baz: '1.x' }
      }})
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.baz).to.have.property('version', '1.1.0')
      })
    })
    it('should install latest compatible', function () {
      var root = new TreeNode('root', {'1.0.0': {
        name: 'root',
        dependencies: { foo: '1.0.0', baz: '1.0.x' }
      }})
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.baz).to.have.property('version', '1.0.1')
      })
    })
    it('should reuse installed compatible package', function () {
      var root = new TreeNode('root', {'1.0.0': {
        name: 'root',
        dependencies: { bar: '1.0.0', baa: '1.0.0' }
      }})
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.bar).to.have.property('version', '1.0.0')
      })
    })
    it('should warn to upgrade former packages', function () {
      var root = new TreeNode('root', {'1.0.0': {
        name: 'root',
        dependencies: { bar: '1.0.0', coo: '1.0.x' }
      }})
      return root.populateChildren().then(() => {
        expect(console.warn).to.have.been.calledWith('WARN: multi versions of bar, upgrade bar@1.0.0 (in root) to match 1.0.1 (as required by coo@1.0.1)')
      })
    })
    it('should warn to upgrade latter packages', function () {
      var root = new TreeNode('root', {'1.0.0': {
        name: 'root',
        dependencies: { bar: '1.0.x', laa: '1.0.0' }
      }})
      return root.populateChildren().then(() => {
        expect(console.warn).to.have.been.calledWith('WARN: multi versions of bar, upgrade bar@1.0.0 (in laa) to match 1.0.x (as required by root@0.0.0)')
      })
    })
  })
})
