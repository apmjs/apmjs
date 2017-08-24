const Promise = require('bluebird')
const assert = require('assert')
const treePrinter = require('tree-printer')
const Package = require('../package.js')
const Semver = require('semver')
const debug = require('debug')('apmjs:tree-node')
const error = require('../utils/error.js')
const Version = require('./version.js')
const npm = require('../utils/npm.js')
const _ = require('lodash')

function TreeNode (pkg, required) {
  assert(pkg.name, 'package name is required')
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
  var notRoot = pkg => pkg.required !== 'ROOT'
  return _.filter(TreeNode.nodes, notRoot).map(node => node.pkg)
}

TreeNode.prototype.toPlainTree = function () {
  var obj = {
    name: this.toString(),
    children: _.map(this.children, child => child.toPlainTree())
  }
  return obj
}

TreeNode.prototype.printTree = function () {
  var tree = this.toPlainTree()
  var str = this.toString()
  var children = treePrinter(tree.children, {format: {root: ''}}).trim()
  if (children) {
    str += '\n' + children
  }
  console.log(str)
}

TreeNode.prototype.addDependency = function (name, semver) {
  debug('adding dependency', name)
  return npm
    .getPackageInfo(name, this.pkg)
    .then(info => {
      semver = semver || this.dependencies[name] || Version.derive(info)
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
  if (Semver.gte(this.version, pkg.version)) {
    return
  }
  this.setPackage(pkg)
  this.prune()
}

TreeNode.prototype.prune = function () {
  var installed = _.keys(this.children)
  var needed = _.keys(this.dependencies)
  var isolated = _.difference(installed, needed)
  debug(`pruning isolated packages for ${this}`, isolated)
  _.forEach(isolated, name => this.children[name].remove(this))
}

TreeNode.prototype.checkComformance = function (pkg, semver, parent) {
  debug('checking comformance between', `${pkg.name}@${pkg.version} and ${this}`)
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
  var dependencies = _.keys(this.dependencies)
  debug(`populating children ${dependencies} for ${this}`)
  return Promise
    // no need to pass version, since this.<dep>.version will be the default
    .each(dependencies, name => this.addDependency(name))
    .then(() => this)
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
  return Package.prototype.toString.call(this)
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
  return this
}

TreeNode.prototype.remove = function (parent) {
  debug('removing node', this.toString())
  _.forEach(this.children, child => child.remove(this))

  delete this.parents[parent.name].children[this.name]
  delete this.parents[parent.name]

  this.referenceCount--
  if (this.referenceCount <= 0) {
    delete TreeNode.nodes[this.name]
  }
}

module.exports = TreeNode
