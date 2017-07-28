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
  this.children = []
  this.required = required || 'ROOT'
  this.setPackage(pkg)
  TreeNode.nodes[this.name] = this
}

TreeNode.nodes = {}

TreeNode.packageList = function () {
  return _.map(TreeNode.nodes, node => node.pkg)
}

TreeNode.prototype.getSemver = function (versionMap) {
  if (!this.parent) {
    return '*'
  }
  if (_.has(this.parent.dependencies, this.name)) {
    return this.parent.dependencies[this.name]
  }
  var last = _.chain(versionMap).keys().sort().last().value()
  return last ? Version.abstract(last) : '*'
}

TreeNode.prototype.addDependency = function (name) {
  return npm
    .getPackageInfo(name, this.pkg)
    .then(info => {
      var semver = this.dependencies[name]
      var pkg = this.pickChildPackage(info, semver)
      var node = new TreeNode(pkg, semver)
      return node.populateChildren().then(() => node)
    })
    .then(node => {
      this.appendChild(node)
      return node
    })
}

TreeNode.prototype.populateChildren = function () {
  debug('populating children for', this.name)
  var dependencies = _.map(this.dependencies, (semver, name) => name)
  return Promise.each(dependencies, name => this.addDependency(name))
}

TreeNode.prototype.isRoot = function () {
  return !this.parent
}

TreeNode.prototype.pickChildPackage = function (info, semver) {
  var name = info.name
  var maxSatisfiying = Package.maxSatisfying(info.versions, semver)

  if (!maxSatisfiying) {
    var msg = this
      ? `${name}@${semver} not available, required by ${this}`
      : 'empty versions for the root, at least one required'
    throw new error.UnmetDependency(msg)
  }

  var installed = TreeNode.nodes[name]
  if (installed) {
    if (installed.version !== maxSatisfiying.version) {
      var installing = {
        version: maxSatisfiying.version,
        required: semver,
        parent: this
      }
      Version.upgradeWarning(name, installed, installing)
    }
    if (Semver.gt(installed.version, maxSatisfiying.version)) {
      maxSatisfiying = installed.pkg
    }
    installed.setPackage(maxSatisfiying)
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

TreeNode.prototype.appendChild = function (child) {
  child.parent = this
  this.children.push(child)
}

module.exports = TreeNode
