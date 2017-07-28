const Promise = require('bluebird')
const Package = require('../package.js')
const Semver = require('semver')
const debug = require('debug')('apmjs:tree-node')
const error = require('../error.js')
const Version = require('./version.js')
const npm = require('../npm.js')
const _ = require('lodash')

function TreeNode (pkg, required) {
  this.name = pkg.name
  this.parents = {}
  this.children = {}
  this.referenceCount = 0
  this.required = required || 'ROOT'
  this.setPackage(pkg)
  TreeNode.nodes[this.name] = this
  debug(this.toString(), 'created')
}

TreeNode.nodes = {}
TreeNode.referenceCounts = {}

TreeNode.packageList = function () {
  return _.map(TreeNode.nodes, node => node.pkg)
}

TreeNode.prototype.addDependency = function (name) {
  debug('adding dependency', name)
  return npm
    .getPackageInfo(name, this.pkg)
    .then(info => {
      var semver = this.dependencies[name] || Version.derive(info)
      var latestPackage = this.latestPackage(info, semver)
      var node = TreeNode.nodes[name]

      if (node) {
        node.checkComformance(latestPackage, semver, this)
        node.upgradeIfNeeded(latestPackage)
      } else {
        node = new TreeNode(latestPackage, semver)
      }
      return node.populateChildren().then(() => {
        this.appendChild(node, semver)
        return node
      })
    })
}

TreeNode.prototype.upgradeIfNeeded = function (pkg) {
  if (Semver.lt(this.version, pkg.version)) {
    return this.setPackage(pkg)
  }
}

TreeNode.prototype.checkComformance = function (pkg, semver, parent) {
  debug('checking comformance between', `${pkg.name}@${pkg.version} and`, this.toString())
  if (this.version === pkg.version) {
    return
  }
  var p = _.sample(this.parents)
  var installed = {
    version: this.version,
    required: p ? p.dependencies[this.name] : '*',
    parent: p || 'ROOT'
  }
  var installing = {
    version: pkg.version,
    required: semver,
    parent: parent
  }
  Version.upgradeWarning(this.name, installed, installing)
}

TreeNode.prototype.populateChildren = function () {
  var dependencies = _.map(this.dependencies, (semver, name) => name)
  debug('populating children', dependencies, 'for', this.toString())
  return Promise.each(dependencies, name => this.addDependency(name))
}

TreeNode.prototype.latestPackage = function (info, semver) {
  var name = info.name
  var maxSatisfiying = Package.maxSatisfying(info.versions, semver)

  if (!maxSatisfiying) {
    var msg = this
      ? `${name}@${semver} not available, required by ${this}`
      : 'empty versions for the root, at least one required'
    throw new error.UnmetDependency(msg)
  }

  return maxSatisfiying
}

TreeNode.prototype.toString = function () {
  return this.name + '@' + this.version
}

TreeNode.prototype.setPackage = function (pkg) {
  debug('setPackage for', pkg.name, 'to', pkg.version)
  this.pkg = pkg
  this.dependencies = pkg.dependencies || {}
  this.version = pkg.version
}

TreeNode.prototype.appendChild = function (child, semver) {
  debug('appendingChild', child.toString(), 'to', this.toString())
  this.dependencies[child.name] = semver
  child.parents[this.name] = this
  child.referenceCount++
  this.children[child.name] = child
}

TreeNode.prototype.remove = function () {
  debug('removing node', this.toString())
  _.forEach(this.children, child => child.remove())
  // delete this.parents[].children[this.name]
  // this.parents[] = null
  this.deReference()
}

TreeNode.prototype.deReference = function () {
  TreeNode.referenceCounts[this.name] --
  if (TreeNode.referenceCounts[this.name] <= 0) {
    delete TreeNode.nodes[this.name]
  }
}

module.exports = TreeNode
