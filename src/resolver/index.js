const _ = require('lodash')
const Tree = require('./tree')
const TreeNode = require('./tree-node.js')

function resolve (pkg) {
  var root = new Tree()
  _.forOwn(pkg.descriptor.dependencies, (semver, name) => {
    var node = new TreeNode(name, semver)
    root.tryInstall(node, root)
  })
}

module.exports = resolve
