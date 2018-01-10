const chai = require('chai')
const registry = require('../stub/registry.js')
const Promise = require('bluebird')
const npm = require('../../src/utils/npm.js')
const _ = require('lodash')
const resolver = require('../../src/resolver')
const expect = chai.expect
const TreeNode = require('../../src/resolver/tree-node.js')
chai.use(require('chai-as-promised'))

describe('resolver', function () {
  before(() => Promise
    .all([
      npm.load({'@baidu:registry': registry.url, 'registry': registry.url}),
      Promise.fromCallback(cb => registry.startServer(cb))
    ])
  )
  after(cb => registry.stopServer(cb))

  beforeEach(() => {
    TreeNode.nodes = {}
    TreeNode.pending = {}
    TreeNode.lock = {dependencies: {}}
  })

  describe('.getDependantPackages()', function () {
    beforeEach(function () {
      var root = new TreeNode({
        version: '0.0.1',
        name: 'root',
        dependencies: { bar: '1.0.x', foo: '1.0.0' }
      })
      root.isRoot = true
      return root.populateChildren()
    })
    it('should return all dependent packages', function () {
      var nodes = resolver.getDependantPackages()
      var keys = _.fromPairs(nodes.map(pkg => [pkg.name, pkg]))
      expect(keys).to.have.property('bar')
      expect(keys).to.have.property('foo')
    })
    it('should filter out root package', function () {
      var nodes = resolver.getDependantPackages()
      var keys = _.fromPairs(nodes.map(pkg => [pkg.name, pkg]))
      expect(nodes).to.have.lengthOf(2)
      expect(keys).to.not.have.property('root')
    })
  })
})
