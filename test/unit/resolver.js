const chai = require('chai')
const path = require('path')
const fs = require('fs-extra')
const npm = require('../../src/utils/npm.js')
const _ = require('lodash')
const resolver = require('../../src/resolver')
const expect = chai.expect
const TreeNode = require('../../src/resolver/tree-node.js')
const nock = require('nock')
chai.use(require('chai-as-promised'))

describe('resolver', function () {
  before(() => {
    ['bar', 'laa'].reduce((server, id) => {
      var file = path.resolve(__dirname, `../stub/${id}.info.json`)
      return server.get(`/${id}`).reply(200, fs.readFileSync(file))
    }, nock('http://apm'))
    return npm.load({registry: 'http://apm'})
  })
  after(() => nock.cleanAll())
  beforeEach(() => {
    TreeNode.nodes = {}
    TreeNode.pending = {}
    TreeNode.dependencyLocks = {}
  })

  describe('.getDependantPackages()', function () {
    beforeEach(function () {
      var root = new TreeNode({
        version: '0.0.1',
        name: 'root',
        dependencies: { bar: '1.0.x', laa: '1.0.0' }
      })
      root.isRoot = true
      return root.populateChildren()
    })
    it('should return all dependent packages', function () {
      var nodes = resolver.getDependantPackages()
      var keys = _.fromPairs(nodes.map(pkg => [pkg.name, pkg]))
      expect(keys).to.have.property('bar')
      expect(keys).to.have.property('laa')
    })
    it('should filter out root package', function () {
      var nodes = resolver.getDependantPackages()
      var keys = _.fromPairs(nodes.map(pkg => [pkg.name, pkg]))
      expect(nodes).to.have.lengthOf(2)
      expect(keys).to.not.have.property('root')
    })
  })
})
